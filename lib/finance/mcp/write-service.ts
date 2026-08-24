import {
  cartoes,
  categorias,
  contas,
  lancamentos,
  mcpAuditLogs,
  orcamentos,
  pagadores,
} from "@/db/schema";
import {
  INITIAL_BALANCE_NOTE,
  INITIAL_BALANCE_PAYMENT_METHOD,
} from "@/lib/accounts/constants";
import { db } from "@/lib/db";
import { PAGADOR_ROLE_ADMIN } from "@/lib/pagadores/constants";
import {
  TRANSFER_CATEGORY_NAME,
  TRANSFER_CONDITION,
  TRANSFER_ESTABLISHMENT,
  TRANSFER_PAYMENT_METHOD,
} from "@/lib/transferencias/constants";
import { formatDecimalForDbRequired } from "@/lib/utils/currency";
import { INVOICE_PAYMENT_STATUS } from "@/lib/faturas";
import {
  applyInvoicePaymentStatus,
  previewInvoicePaymentStatus,
} from "@/lib/finance/invoice-payment-service";
import {
  applySeriesDelete,
  applySeriesUpdate,
  previewSeriesDelete,
  previewSeriesUpdate,
} from "@/lib/finance/series-service";
import {
  applyAnticipation,
  previewAnticipation,
} from "@/lib/finance/anticipation-service";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import type {
  AnticipateInstallmentsInput,
  CreateTransactionInput,
  DeleteSeriesInput,
  DeleteTransactionInput,
  PayInvoiceInput,
  ReverseInvoicePaymentInput,
  ReverseTransferInput,
  SettleTransactionInput,
  TransferInput,
  UpdateSeriesInput,
  UpdateTransactionInput,
  UpsertBudgetInput,
} from "./schemas";

const PROTECTED_CATEGORIES = ["Saldo inicial", "Pagamentos"];

const parseDate = (value: string) => new Date(`${value}T12:00:00`);
const periodFromDate = (value: string) => value.slice(0, 7);
const signedAmount = (
  amount: number,
  type: "Despesa" | "Receita"
): string =>
  formatDecimalForDbRequired(
    type === "Despesa" ? -Math.abs(amount) : Math.abs(amount)
  );

type MutationResult = Record<string, unknown>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function requestHash(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function redactArguments(input: Record<string, unknown>) {
  const sensitiveKeys = new Set(["name", "note", "amount"]);
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => key !== "idempotencyKey")
      .map(([key, value]) => [
        key,
        sensitiveKeys.has(key) && value !== null && value !== undefined
          ? "[REDACTED]"
          : value,
      ])
  );
}

export async function runAuditedMutation<T extends MutationResult>({
  userId,
  toolName,
  idempotencyKey,
  input,
  execute,
}: {
  userId: string;
  toolName: string;
  idempotencyKey: string;
  input: Record<string, unknown>;
  execute: () => Promise<T>;
}): Promise<T & { replayed?: boolean }> {
  const hash = requestHash(input);
  const existing = await db.query.mcpAuditLogs.findFirst({
    where: and(
      eq(mcpAuditLogs.userId, userId),
      eq(mcpAuditLogs.toolName, toolName),
      eq(mcpAuditLogs.idempotencyKey, idempotencyKey)
    ),
  });

  if (existing) {
    if (existing.requestHash !== hash) {
      throw new Error(
        "This idempotency key was already used with different arguments."
      );
    }
    if (existing.status === "succeeded" && existing.result) {
      return { ...(existing.result as T), replayed: true };
    }
    if (existing.status === "failed") {
      throw new Error(existing.error ?? "The previous mutation failed.");
    }
    throw new Error("A mutation with this idempotency key is still pending.");
  }

  const [claim] = await db
    .insert(mcpAuditLogs)
    .values({
      userId,
      toolName,
      idempotencyKey,
      requestHash: hash,
      arguments: redactArguments(input),
      status: "pending",
    })
    .onConflictDoNothing()
    .returning({ id: mcpAuditLogs.id });

  if (!claim) {
    throw new Error(
      "The idempotency key was claimed concurrently. Retry the same call."
    );
  }

  try {
    const result = await execute();
    await db
      .update(mcpAuditLogs)
      .set({
        status: "succeeded",
        result,
        updatedAt: new Date(),
      })
      .where(eq(mcpAuditLogs.id, claim.id));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mutation failed.";
    await db
      .update(mcpAuditLogs)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(mcpAuditLogs.id, claim.id));
    throw error;
  }
}

/**
 * Two-step wrapper for high-risk tools. In `preview` mode it runs `preview` and
 * returns its impact summary tagged `{ mode: "preview", applied: false }` without
 * any write or audit record. In `apply` mode it runs `apply` through
 * `runAuditedMutation` (idempotency + audit) and tags the result
 * `{ mode: "apply", applied: true }`.
 */
export async function runPreviewableMutation<
  P extends MutationResult,
  A extends MutationResult
>({
  mode,
  userId,
  toolName,
  idempotencyKey,
  input,
  preview,
  apply,
}: {
  mode: "preview" | "apply";
  userId: string;
  toolName: string;
  idempotencyKey: string;
  input: Record<string, unknown>;
  preview: () => Promise<P>;
  apply: () => Promise<A>;
}): Promise<
  (P & { mode: "preview"; applied: false }) | (A & { mode: "apply"; applied: true; replayed?: boolean })
> {
  if (mode === "preview") {
    const summary = await preview();
    return { ...summary, mode: "preview", applied: false };
  }

  const result = await runAuditedMutation({
    userId,
    toolName,
    idempotencyKey,
    input,
    execute: apply,
  });
  return { ...result, mode: "apply", applied: true };
}

async function validateTransactionReferences(
  userId: string,
  input: CreateTransactionInput | UpdateTransactionInput
) {
  if (input.paymentMethod === "Cartão de crédito") {
    if (!input.cardId || input.accountId) {
      throw new Error(
        "Credit-card transactions require cardId and must not include accountId."
      );
    }
  } else if (input.cardId) {
    throw new Error(
      "Only credit-card transactions may include a cardId."
    );
  }

  const [account, card, category, payer] = await Promise.all([
    input.accountId
      ? db.query.contas.findFirst({
          columns: { id: true },
          where: and(
            eq(contas.id, input.accountId),
            eq(contas.userId, userId)
          ),
        })
      : null,
    input.cardId
      ? db.query.cartoes.findFirst({
          columns: { id: true },
          where: and(
            eq(cartoes.id, input.cardId),
            eq(cartoes.userId, userId)
          ),
        })
      : null,
    input.categoryId
      ? db.query.categorias.findFirst({
          columns: { id: true, type: true },
          where: and(
            eq(categorias.id, input.categoryId),
            eq(categorias.userId, userId)
          ),
        })
      : null,
    input.payerId
      ? db.query.pagadores.findFirst({
          columns: { id: true },
          where: and(
            eq(pagadores.id, input.payerId),
            eq(pagadores.userId, userId)
          ),
        })
      : null,
  ]);

  if (input.accountId && !account) throw new Error("Account not found.");
  if (input.cardId && !card) throw new Error("Card not found.");
  if (input.categoryId && !category) throw new Error("Category not found.");
  if (input.payerId && !payer) throw new Error("Payer not found.");

  if (category) {
    const expected =
      input.transactionType === "Despesa" ? "despesa" : "receita";
    if (category.type.toLocaleLowerCase("pt-BR") !== expected) {
      throw new Error(
        `The selected category is not compatible with ${input.transactionType}.`
      );
    }
  }
}

async function resolvePayerId(userId: string, payerId?: string | null) {
  if (payerId) return payerId;
  const payer = await db.query.pagadores.findFirst({
    columns: { id: true },
    where: and(
      eq(pagadores.userId, userId),
      eq(pagadores.role, PAGADOR_ROLE_ADMIN)
    ),
  });
  if (!payer) throw new Error("Administrator payer not found.");
  return payer.id;
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput
) {
  return runAuditedMutation({
    userId,
    toolName: "finance_create_transaction",
    idempotencyKey: input.idempotencyKey,
    input,
    execute: async () => {
      await validateTransactionReferences(userId, input);
      const payerId = await resolvePayerId(userId, input.payerId);
      const [created] = await db
        .insert(lancamentos)
        .values({
          condition: "À vista",
          name: input.name,
          paymentMethod: input.paymentMethod,
          note: input.note || null,
          amount: signedAmount(input.amount, input.transactionType),
          purchaseDate: parseDate(input.purchaseDate),
          dueDate: input.dueDate ? parseDate(input.dueDate) : null,
          boletoPaymentDate:
            input.paymentMethod === "Boleto" && input.settled
              ? parseDate(
                  input.paymentDate ??
                    new Date().toISOString().slice(0, 10)
                )
              : null,
          transactionType: input.transactionType,
          period: periodFromDate(input.purchaseDate),
          isSettled:
            input.paymentMethod === "Cartão de crédito"
              ? null
              : input.settled,
          userId,
          contaId: input.accountId || null,
          cartaoId: input.cardId || null,
          categoriaId: input.categoryId || null,
          pagadorId: payerId,
        })
        .returning({ id: lancamentos.id });
      if (!created) throw new Error("Could not create transaction.");
      return { transactionId: created.id, created: true };
    },
  });
}

export async function updateTransaction(
  userId: string,
  input: UpdateTransactionInput
) {
  return runAuditedMutation({
    userId,
    toolName: "finance_update_transaction",
    idempotencyKey: input.idempotencyKey,
    input,
    execute: async () => {
      const existing = await db.query.lancamentos.findFirst({
        where: and(
          eq(lancamentos.id, input.transactionId),
          eq(lancamentos.userId, userId)
        ),
        with: { categoria: { columns: { name: true } } },
      });
      if (!existing) throw new Error("Transaction not found.");
      if (existing.seriesId || existing.transferId) {
        throw new Error(
          "Series and transfer records cannot be updated by this safe-write tool."
        );
      }
      if (
        existing.note === INITIAL_BALANCE_NOTE ||
        (existing.categoria?.name &&
          PROTECTED_CATEGORIES.includes(existing.categoria.name))
      ) {
        throw new Error("This protected transaction cannot be updated.");
      }

      await validateTransactionReferences(userId, input);
      const payerId = await resolvePayerId(userId, input.payerId);
      const [updated] = await db
        .update(lancamentos)
        .set({
          condition: "À vista",
          name: input.name,
          paymentMethod: input.paymentMethod,
          note: input.note || null,
          amount: signedAmount(input.amount, input.transactionType),
          purchaseDate: parseDate(input.purchaseDate),
          dueDate: input.dueDate ? parseDate(input.dueDate) : null,
          boletoPaymentDate:
            input.paymentMethod === "Boleto" && input.settled
              ? parseDate(
                  input.paymentDate ??
                    new Date().toISOString().slice(0, 10)
                )
              : null,
          transactionType: input.transactionType,
          period: periodFromDate(input.purchaseDate),
          isSettled:
            input.paymentMethod === "Cartão de crédito"
              ? null
              : input.settled,
          contaId: input.accountId || null,
          cartaoId: input.cardId || null,
          categoriaId: input.categoryId || null,
          pagadorId: payerId,
        })
        .where(
          and(
            eq(lancamentos.id, input.transactionId),
            eq(lancamentos.userId, userId)
          )
        )
        .returning({ id: lancamentos.id });
      if (!updated) throw new Error("Transaction not found.");
      return { transactionId: updated.id, updated: true };
    },
  });
}

export async function setTransactionSettled(
  userId: string,
  input: SettleTransactionInput
) {
  return runAuditedMutation({
    userId,
    toolName: "finance_set_transaction_settled",
    idempotencyKey: input.idempotencyKey,
    input,
    execute: async () => {
      const existing = await db.query.lancamentos.findFirst({
        where: and(
          eq(lancamentos.id, input.transactionId),
          eq(lancamentos.userId, userId)
        ),
        columns: {
          id: true,
          paymentMethod: true,
          note: true,
          transactionType: true,
          condition: true,
          transferId: true,
        },
        with: { categoria: { columns: { name: true } } },
      });
      if (!existing) throw new Error("Transaction not found.");
      if (
        existing.transferId ||
        (existing.categoria?.name &&
          PROTECTED_CATEGORIES.includes(existing.categoria.name))
      ) {
        throw new Error(
          "Transfers and protected transactions cannot be settled individually."
        );
      }
      if (existing.paymentMethod === "Cartão de crédito") {
        throw new Error(
          "Credit-card transactions are reconciled through their invoice."
        );
      }
      if (
        existing.note === INITIAL_BALANCE_NOTE &&
        existing.paymentMethod === INITIAL_BALANCE_PAYMENT_METHOD
      ) {
        throw new Error("The initial-balance transaction is protected.");
      }

      await db
        .update(lancamentos)
        .set({
          isSettled: input.settled,
          boletoPaymentDate:
            existing.paymentMethod === "Boleto" && input.settled
              ? parseDate(
                  input.paymentDate ??
                    new Date().toISOString().slice(0, 10)
                )
              : null,
        })
        .where(
          and(
            eq(lancamentos.id, input.transactionId),
            eq(lancamentos.userId, userId)
          )
        );
      return {
        transactionId: input.transactionId,
        settled: input.settled,
      };
    },
  });
}

export async function transferBetweenAccounts(
  userId: string,
  input: TransferInput
) {
  return runAuditedMutation({
    userId,
    toolName: "finance_transfer_between_accounts",
    idempotencyKey: input.idempotencyKey,
    input,
    execute: async () => {
      const transferId = randomUUID();
      const result = await db.transaction(async (tx) => {
        const [from, to, category, payer] = await Promise.all([
          tx.query.contas.findFirst({
            where: and(
              eq(contas.id, input.fromAccountId),
              eq(contas.userId, userId)
            ),
          }),
          tx.query.contas.findFirst({
            where: and(
              eq(contas.id, input.toAccountId),
              eq(contas.userId, userId)
            ),
          }),
          tx.query.categorias.findFirst({
            where: and(
              eq(categorias.userId, userId),
              eq(categorias.name, TRANSFER_CATEGORY_NAME)
            ),
          }),
          tx.query.pagadores.findFirst({
            where: and(
              eq(pagadores.userId, userId),
              eq(pagadores.role, PAGADOR_ROLE_ADMIN)
            ),
          }),
        ]);
        if (!from) throw new Error("Source account not found.");
        if (!to) throw new Error("Destination account not found.");
        if (!category) throw new Error("Transfer category not found.");
        if (!payer) throw new Error("Administrator payer not found.");

        const common = {
          condition: TRANSFER_CONDITION,
          paymentMethod: TRANSFER_PAYMENT_METHOD,
          purchaseDate: parseDate(input.date),
          transactionType: "Transferência",
          period: periodFromDate(input.date),
          isSettled: true,
          userId,
          categoriaId: category.id,
          pagadorId: payer.id,
          transferId,
        };
        const created = await tx
          .insert(lancamentos)
          .values([
            {
              ...common,
              name: `${TRANSFER_ESTABLISHMENT} → ${to.name}`,
              note: `Transferência para ${to.name}`,
              amount: formatDecimalForDbRequired(-Math.abs(input.amount)),
              contaId: from.id,
            },
            {
              ...common,
              name: `${TRANSFER_ESTABLISHMENT} ← ${from.name}`,
              note: `Transferência de ${from.name}`,
              amount: formatDecimalForDbRequired(Math.abs(input.amount)),
              contaId: to.id,
            },
          ])
          .returning({ id: lancamentos.id });
        if (created.length !== 2) {
          throw new Error("Could not create both sides of the transfer.");
        }
        return created.map((item) => item.id);
      });

      return { transferId, transactionIds: result, created: true };
    },
  });
}

async function loadDeletableTransaction(userId: string, transactionId: string) {
  const existing = await db.query.lancamentos.findFirst({
    where: and(
      eq(lancamentos.id, transactionId),
      eq(lancamentos.userId, userId)
    ),
    with: { categoria: { columns: { name: true } } },
  });
  if (!existing) throw new Error("Transaction not found.");
  if (existing.seriesId) {
    throw new Error(
      "This transaction belongs to a series. Use the series tools to delete it."
    );
  }
  if (existing.transferId) {
    throw new Error(
      "This transaction is a transfer leg. Use finance_reverse_transfer instead."
    );
  }
  if (existing.anticipationId || existing.isAnticipated) {
    throw new Error(
      "Anticipated transactions must be reversed through the anticipation tools."
    );
  }
  if (
    existing.note === INITIAL_BALANCE_NOTE ||
    (existing.categoria?.name &&
      PROTECTED_CATEGORIES.includes(existing.categoria.name))
  ) {
    throw new Error("This protected transaction cannot be deleted.");
  }
  return existing;
}

export async function deleteTransaction(
  userId: string,
  input: DeleteTransactionInput
) {
  return runPreviewableMutation({
    mode: input.mode,
    userId,
    toolName: "finance_delete_transaction",
    idempotencyKey: input.idempotencyKey,
    input,
    preview: async () => {
      const row = await loadDeletableTransaction(userId, input.transactionId);
      return {
        transactionId: row.id,
        willDelete: {
          name: row.name,
          amount: Number(row.amount),
          transactionType: row.transactionType,
          paymentMethod: row.paymentMethod,
          purchaseDate: row.purchaseDate.toISOString().slice(0, 10),
          period: row.period,
          accountId: row.contaId,
          cardId: row.cartaoId,
          categoryId: row.categoriaId,
        },
      };
    },
    apply: async () => {
      const row = await loadDeletableTransaction(userId, input.transactionId);
      await db
        .delete(lancamentos)
        .where(
          and(
            eq(lancamentos.id, input.transactionId),
            eq(lancamentos.userId, userId)
          )
        );
      // Store the full pre-delete snapshot in the audit result so the deletion
      // is reconstructable (no soft-delete column exists).
      return {
        transactionId: row.id,
        deleted: true,
        snapshot: {
          name: row.name,
          amount: row.amount,
          transactionType: row.transactionType,
          paymentMethod: row.paymentMethod,
          note: row.note,
          purchaseDate: row.purchaseDate.toISOString().slice(0, 10),
          dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
          period: row.period,
          isSettled: row.isSettled,
          contaId: row.contaId,
          cartaoId: row.cartaoId,
          categoriaId: row.categoriaId,
          pagadorId: row.pagadorId,
        },
      };
    },
  });
}

async function loadTransferLegs(userId: string, transferId: string) {
  const legs = await db.query.lancamentos.findMany({
    where: and(
      eq(lancamentos.transferId, transferId),
      eq(lancamentos.userId, userId)
    ),
    columns: {
      id: true,
      name: true,
      amount: true,
      contaId: true,
      purchaseDate: true,
      period: true,
    },
  });
  if (legs.length === 0) throw new Error("Transfer not found.");
  if (legs.length !== 2) {
    throw new Error(
      `Expected exactly two transfer legs but found ${legs.length}. Refusing to reverse a malformed transfer.`
    );
  }
  return legs;
}

export async function reverseTransfer(
  userId: string,
  input: ReverseTransferInput
) {
  return runPreviewableMutation({
    mode: input.mode,
    userId,
    toolName: "finance_reverse_transfer",
    idempotencyKey: input.idempotencyKey,
    input,
    preview: async () => {
      const legs = await loadTransferLegs(userId, input.transferId);
      return {
        transferId: input.transferId,
        willDelete: legs.map((leg) => ({
          transactionId: leg.id,
          name: leg.name,
          accountId: leg.contaId,
          amount: Number(leg.amount),
          period: leg.period,
        })),
      };
    },
    apply: async () => {
      const deletedIds = await db.transaction(async (tx) => {
        const legs = await tx.query.lancamentos.findMany({
          where: and(
            eq(lancamentos.transferId, input.transferId),
            eq(lancamentos.userId, userId)
          ),
          columns: { id: true },
        });
        if (legs.length !== 2) {
          throw new Error(
            `Expected exactly two transfer legs but found ${legs.length}. Refusing to reverse a malformed transfer.`
          );
        }
        await tx
          .delete(lancamentos)
          .where(
            and(
              eq(lancamentos.transferId, input.transferId),
              eq(lancamentos.userId, userId)
            )
          );
        return legs.map((leg) => leg.id);
      });
      return { transferId: input.transferId, transactionIds: deletedIds, reversed: true };
    },
  });
}

export async function payInvoice(userId: string, input: PayInvoiceInput) {
  return runPreviewableMutation({
    mode: input.mode,
    userId,
    toolName: "finance_pay_invoice",
    idempotencyKey: input.idempotencyKey,
    input,
    preview: () =>
      previewInvoicePaymentStatus(userId, {
        cartaoId: input.cardId,
        period: input.period,
        status: INVOICE_PAYMENT_STATUS.PAID,
      }),
    apply: async () => {
      const result = await db.transaction((tx) =>
        applyInvoicePaymentStatus(tx, {
          userId,
          cartaoId: input.cardId,
          period: input.period,
          status: INVOICE_PAYMENT_STATUS.PAID,
          paymentDate: input.paymentDate,
        })
      );
      return { ...result, paid: true };
    },
  });
}

export async function reverseInvoicePayment(
  userId: string,
  input: ReverseInvoicePaymentInput
) {
  return runPreviewableMutation({
    mode: input.mode,
    userId,
    toolName: "finance_reverse_invoice_payment",
    idempotencyKey: input.idempotencyKey,
    input,
    preview: () =>
      previewInvoicePaymentStatus(userId, {
        cartaoId: input.cardId,
        period: input.period,
        status: INVOICE_PAYMENT_STATUS.PENDING,
      }),
    apply: async () => {
      const result = await db.transaction((tx) =>
        applyInvoicePaymentStatus(tx, {
          userId,
          cartaoId: input.cardId,
          period: input.period,
          status: INVOICE_PAYMENT_STATUS.PENDING,
        })
      );
      return { ...result, reversed: true };
    },
  });
}

/** Maps the MCP schema's field names to the shared service's column names. */
function seriesUpdateFields(input: UpdateSeriesInput) {
  const updates: {
    name?: string;
    amount?: number;
    categoriaId?: string | null;
    pagadorId?: string | null;
    contaId?: string | null;
    cartaoId?: string | null;
    note?: string | null;
    dueDate?: string | null;
    boletoPaymentDate?: string | null;
  } = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.amount !== undefined) updates.amount = input.amount;
  if (input.categoryId !== undefined) updates.categoriaId = input.categoryId;
  if (input.payerId !== undefined) updates.pagadorId = input.payerId;
  if (input.accountId !== undefined) updates.contaId = input.accountId;
  if (input.cardId !== undefined) updates.cartaoId = input.cardId;
  if (input.note !== undefined) updates.note = input.note;
  if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
  if (input.boletoPaymentDate !== undefined)
    updates.boletoPaymentDate = input.boletoPaymentDate;
  return updates;
}

export async function updateSeries(userId: string, input: UpdateSeriesInput) {
  return runPreviewableMutation({
    mode: input.mode,
    userId,
    toolName: "finance_update_series",
    idempotencyKey: input.idempotencyKey,
    input,
    preview: () =>
      previewSeriesUpdate({
        userId,
        transactionId: input.transactionId,
        scope: input.scope,
        updates: seriesUpdateFields(input),
      }),
    apply: async () => {
      const result = await db.transaction((tx) =>
        applySeriesUpdate(tx, {
          userId,
          transactionId: input.transactionId,
          scope: input.scope,
          updates: seriesUpdateFields(input),
        })
      );
      return { ...result, updated: true };
    },
  });
}

export async function deleteSeries(userId: string, input: DeleteSeriesInput) {
  return runPreviewableMutation({
    mode: input.mode,
    userId,
    toolName: "finance_delete_series",
    idempotencyKey: input.idempotencyKey,
    input,
    preview: () =>
      previewSeriesDelete({
        userId,
        transactionId: input.transactionId,
        scope: input.scope,
      }),
    apply: async () => {
      const result = await db.transaction((tx) =>
        applySeriesDelete(tx, {
          userId,
          transactionId: input.transactionId,
          scope: input.scope,
        })
      );
      return { ...result, deleted: true };
    },
  });
}

/**
 * Resolves the tool's installment selector (explicit ids, next-N count, or a
 * through-period) to concrete eligible installment ids ordered by installment
 * number. Read-only, so it is safe to run in preview mode.
 */
async function resolveAnticipationInstallmentIds(
  userId: string,
  input: AnticipateInstallmentsInput
): Promise<string[]> {
  if (input.installmentIds) return input.installmentIds;

  const eligible = await db.query.lancamentos.findMany({
    where: and(
      eq(lancamentos.seriesId, input.seriesId),
      eq(lancamentos.userId, userId),
      eq(lancamentos.condition, "Parcelado"),
      or(eq(lancamentos.isSettled, false), isNull(lancamentos.isSettled)),
      eq(lancamentos.isAnticipated, false)
    ),
    orderBy: [asc(lancamentos.currentInstallment)],
    columns: { id: true, period: true },
  });

  let selected = eligible;
  if (input.throughPeriod) {
    selected = eligible.filter((row) => row.period <= input.throughPeriod!);
  } else if (input.count !== undefined) {
    if (eligible.length < input.count) {
      throw new Error(
        `Only ${eligible.length} eligible installment(s) available to anticipate.`
      );
    }
    selected = eligible.slice(0, input.count);
  }

  if (selected.length === 0) {
    throw new Error("Nenhuma parcela elegível para antecipação.");
  }
  return selected.map((row) => row.id);
}

export async function anticipateInstallments(
  userId: string,
  input: AnticipateInstallmentsInput
) {
  const installmentIds = await resolveAnticipationInstallmentIds(userId, input);
  const params = {
    userId,
    seriesId: input.seriesId,
    installmentIds,
    anticipationPeriod: input.anticipationPeriod,
    discount: input.discount,
    pagadorId: input.payerId ?? null,
    categoriaId: input.categoryId ?? null,
    note: input.note ?? null,
  };

  return runPreviewableMutation({
    mode: input.mode,
    userId,
    toolName: "finance_anticipate_installments",
    idempotencyKey: input.idempotencyKey,
    input,
    preview: () => previewAnticipation(params),
    apply: async () => {
      const result = await db.transaction((tx) =>
        applyAnticipation(tx, params)
      );
      return { ...result, anticipated: true };
    },
  });
}

export async function upsertBudget(userId: string, input: UpsertBudgetInput) {
  return runAuditedMutation({
    userId,
    toolName: "finance_upsert_budget",
    idempotencyKey: input.idempotencyKey,
    input,
    execute: async () => {
      const category = await db.query.categorias.findFirst({
        where: and(
          eq(categorias.id, input.categoryId),
          eq(categorias.userId, userId)
        ),
      });
      if (!category) throw new Error("Category not found.");
      if (category.type.toLocaleLowerCase("pt-BR") !== "despesa") {
        throw new Error("Budgets require an expense category.");
      }

      const existing = await db.query.orcamentos.findFirst({
        where: and(
          eq(orcamentos.userId, userId),
          eq(orcamentos.period, input.period),
          eq(orcamentos.categoriaId, input.categoryId)
        ),
      });
      if (existing) {
        await db
          .update(orcamentos)
          .set({ amount: formatDecimalForDbRequired(input.amount) })
          .where(
            and(
              eq(orcamentos.id, existing.id),
              eq(orcamentos.userId, userId)
            )
          );
        return { budgetId: existing.id, created: false, updated: true };
      }

      const [created] = await db
        .insert(orcamentos)
        .values({
          userId,
          categoriaId: input.categoryId,
          period: input.period,
          amount: formatDecimalForDbRequired(input.amount),
        })
        .returning({ id: orcamentos.id });
      if (!created) throw new Error("Could not create budget.");
      return { budgetId: created.id, created: true, updated: false };
    },
  });
}
