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
import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type {
  CreateTransactionInput,
  SettleTransactionInput,
  TransferInput,
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
