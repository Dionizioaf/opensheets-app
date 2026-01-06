"use server";

import { contas, lancamentos } from "@/db/schema";
import {
  INITIAL_BALANCE_CONDITION,
  INITIAL_BALANCE_NOTE,
  INITIAL_BALANCE_PAYMENT_METHOD,
  INITIAL_BALANCE_TRANSACTION_TYPE,
} from "@/lib/accounts/constants";
import { handleActionError, revalidateForEntity } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { errorResult } from "@/lib/actions/types";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/server";
import {
  LANCAMENTO_CONDITIONS,
  LANCAMENTO_PAYMENT_METHODS,
  LANCAMENTO_TRANSACTION_TYPES,
} from "@/lib/lancamentos/constants";
import {
  buildEntriesByPagador,
  sendPagadorAutoEmails,
} from "@/lib/pagadores/notifications";
import { noteSchema, uuidSchema } from "@/lib/schemas/common";
import { formatDecimalForDbRequired } from "@/lib/utils/currency";
import {
  getTodayDate,
  getTodayDateString,
  parseLocalDateString,
} from "@/lib/utils/date";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const resolvePeriod = (purchaseDate: string, period?: string | null) => {
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    return period;
  }

  const date = parseLocalDateString(purchaseDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data da transação inválida.");
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const baseFields = z.object({
  purchaseDate: z
    .string({ message: "Informe a data da transação." })
    .trim()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Data da transação inválida.",
    }),
  period: z
    .string()
    .trim()
    .regex(/^(\d{4})-(\d{2})$/, {
      message: "Selecione um período válido.",
    })
    .optional(),
  name: z
    .string({ message: "Informe o estabelecimento." })
    .trim()
    .min(1, "Informe o estabelecimento."),
  transactionType: z
    .enum(LANCAMENTO_TRANSACTION_TYPES, {
      message: "Selecione um tipo de transação válido.",
    })
    .default(LANCAMENTO_TRANSACTION_TYPES[0]),
  amount: z.coerce
    .number({ message: "Informe o valor da transação." })
    .min(0, "Informe um valor maior ou igual a zero."),
  condition: z.enum(LANCAMENTO_CONDITIONS, {
    message: "Selecione uma condição válida.",
  }),
  paymentMethod: z.enum(LANCAMENTO_PAYMENT_METHODS, {
    message: "Selecione uma forma de pagamento válida.",
  }),
  pagadorId: uuidSchema("Pagador").nullable().optional(),
  secondaryPagadorId: uuidSchema("Pagador secundário").optional(),
  isSplit: z.boolean().optional().default(false),
  contaId: uuidSchema("Conta").nullable().optional(),
  cartaoId: uuidSchema("Cartão").nullable().optional(),
  categoriaId: uuidSchema("Categoria").nullable().optional(),
  note: noteSchema,
  installmentCount: z.coerce
    .number()
    .int()
    .min(1, "Selecione uma quantidade válida.")
    .max(60, "Selecione uma quantidade válida.")
    .optional(),
  recurrenceCount: z.coerce
    .number()
    .int()
    .min(1, "Selecione uma recorrência válida.")
    .max(60, "Selecione uma recorrência válida.")
    .optional(),
  dueDate: z
    .string()
    .trim()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
      message: "Informe uma data de vencimento válida.",
    })
    .optional(),
  boletoPaymentDate: z
    .string()
    .trim()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
      message: "Informe uma data de pagamento válida.",
    })
    .optional(),
  isSettled: z.boolean().nullable().optional(),
});

const refineLancamento = (
  data: z.infer<typeof baseFields> & { id?: string },
  ctx: z.RefinementCtx
) => {
  if (data.condition === "Parcelado") {
    if (!data.installmentCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["installmentCount"],
        message: "Informe a quantidade de parcelas.",
      });
    } else if (data.installmentCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["installmentCount"],
        message: "Selecione pelo menos duas parcelas.",
      });
    }
  }

  if (data.condition === "Recorrente") {
    if (!data.recurrenceCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrenceCount"],
        message: "Informe por quantos meses a recorrência acontecerá.",
      });
    } else if (data.recurrenceCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrenceCount"],
        message: "A recorrência deve ter ao menos dois meses.",
      });
    }
  }

  if (data.isSplit) {
    if (!data.pagadorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pagadorId"],
        message: "Selecione o pagador principal para dividir o lançamento.",
      });
    }

    if (!data.secondaryPagadorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryPagadorId"],
        message: "Selecione o pagador secundário para dividir o lançamento.",
      });
    } else if (data.pagadorId && data.secondaryPagadorId === data.pagadorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryPagadorId"],
        message: "Escolha um pagador diferente para dividir o lançamento.",
      });
    }
  }
};

const createSchema = baseFields.superRefine(refineLancamento);
const updateSchema = baseFields
  .extend({
    id: uuidSchema("Lançamento"),
  })
  .superRefine(refineLancamento);

const deleteSchema = z.object({
  id: uuidSchema("Lançamento"),
});

const toggleSettlementSchema = z.object({
  id: uuidSchema("Lançamento"),
  value: z.boolean({
    message: "Informe o status de pagamento.",
  }),
});

type BaseInput = z.infer<typeof baseFields>;
type CreateInput = z.infer<typeof createSchema>;
type UpdateInput = z.infer<typeof updateSchema>;
type DeleteInput = z.infer<typeof deleteSchema>;
type ToggleSettlementInput = z.infer<typeof toggleSettlementSchema>;

const revalidate = () => revalidateForEntity("lancamentos");

const resolveUserLabel = (user: {
  name?: string | null;
  email?: string | null;
}) => {
  if (user?.name && user.name.trim().length > 0) {
    return user.name;
  }
  if (user?.email && user.email.trim().length > 0) {
    return user.email;
  }
  return "Opensheets";
};

type InitialCandidate = {
  note: string | null;
  transactionType: string | null;
  condition: string | null;
  paymentMethod: string | null;
};

const isInitialBalanceLancamento = (record?: InitialCandidate | null) =>
  !!record &&
  record.note === INITIAL_BALANCE_NOTE &&
  record.transactionType === INITIAL_BALANCE_TRANSACTION_TYPE &&
  record.condition === INITIAL_BALANCE_CONDITION &&
  record.paymentMethod === INITIAL_BALANCE_PAYMENT_METHOD;

const centsToDecimalString = (value: number) => {
  const decimal = value / 100;
  const formatted = decimal.toFixed(2);
  return Object.is(decimal, -0) ? "0.00" : formatted;
};

const splitAmount = (totalCents: number, parts: number) => {
  if (parts <= 0) {
    return [];
  }

  const base = Math.trunc(totalCents / parts);
  const remainder = totalCents % parts;

  return Array.from(
    { length: parts },
    (_, index) => base + (index < remainder ? 1 : 0)
  );
};

const addMonthsToPeriod = (period: string, offset: number) => {
  const [yearStr, monthStr] = period.split("-");
  const baseYear = Number(yearStr);
  const baseMonth = Number(monthStr);

  if (!baseYear || !baseMonth) {
    throw new Error("Período inválido.");
  }

  const date = new Date(baseYear, baseMonth - 1, 1);
  date.setMonth(date.getMonth() + offset);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
};

const addMonthsToDate = (value: Date, offset: number) => {
  const result = new Date(value);
  const originalDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + offset);

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(originalDay, lastDay));
  return result;
};

type Share = {
  pagadorId: string | null;
  amountCents: number;
};

const buildShares = ({
  totalCents,
  pagadorId,
  isSplit,
  secondaryPagadorId,
}: {
  totalCents: number;
  pagadorId: string | null;
  isSplit: boolean;
  secondaryPagadorId?: string;
}): Share[] => {
  if (isSplit) {
    if (!pagadorId || !secondaryPagadorId) {
      throw new Error("Configuração de divisão inválida para o lançamento.");
    }

    const [primaryAmount, secondaryAmount] = splitAmount(totalCents, 2);
    return [
      { pagadorId, amountCents: primaryAmount },
      { pagadorId: secondaryPagadorId, amountCents: secondaryAmount },
    ];
  }

  return [{ pagadorId, amountCents: totalCents }];
};

type BuildLancamentoRecordsParams = {
  data: BaseInput;
  userId: string;
  period: string;
  purchaseDate: Date;
  dueDate: Date | null;
  boletoPaymentDate: Date | null;
  shares: Share[];
  amountSign: 1 | -1;
  shouldNullifySettled: boolean;
  seriesId: string | null;
};

type LancamentoInsert = typeof lancamentos.$inferInsert;

const buildLancamentoRecords = ({
  data,
  userId,
  period,
  purchaseDate,
  dueDate,
  boletoPaymentDate,
  shares,
  amountSign,
  shouldNullifySettled,
  seriesId,
}: BuildLancamentoRecordsParams): LancamentoInsert[] => {
  const records: LancamentoInsert[] = [];

  const basePayload = {
    name: data.name,
    transactionType: data.transactionType,
    condition: data.condition,
    paymentMethod: data.paymentMethod,
    note: data.note ?? null,
    contaId: data.contaId ?? null,
    cartaoId: data.cartaoId ?? null,
    categoriaId: data.categoriaId ?? null,
    recurrenceCount: null as number | null,
    installmentCount: null as number | null,
    currentInstallment: null as number | null,
    isDivided: data.isSplit ?? false,
    userId,
    seriesId,
  };

  const resolveSettledValue = (cycleIndex: number) => {
    if (shouldNullifySettled) {
      return null;
    }
    const initialSettled = data.isSettled ?? false;
    if (data.condition === "Parcelado" || data.condition === "Recorrente") {
      return cycleIndex === 0 ? initialSettled : false;
    }
    return initialSettled;
  };

  if (data.condition === "Parcelado") {
    const installmentTotal = data.installmentCount ?? 0;
    const amountsByShare = shares.map((share) =>
      splitAmount(share.amountCents, installmentTotal)
    );

    for (
      let installment = 0;
      installment < installmentTotal;
      installment += 1
    ) {
      const installmentPeriod = addMonthsToPeriod(period, installment);
      const installmentPurchaseDate = addMonthsToDate(
        purchaseDate,
        installment
      );
      const installmentDueDate = dueDate
        ? addMonthsToDate(dueDate, installment)
        : null;

      shares.forEach((share, shareIndex) => {
        const amountCents = amountsByShare[shareIndex]?.[installment] ?? 0;
        const settled = resolveSettledValue(installment);
        records.push({
          ...basePayload,
          amount: centsToDecimalString(amountCents * amountSign),
          pagadorId: share.pagadorId,
          purchaseDate: installmentPurchaseDate,
          period: installmentPeriod,
          isSettled: settled,
          installmentCount: installmentTotal,
          currentInstallment: installment + 1,
          recurrenceCount: null,
          dueDate: installmentDueDate,
          boletoPaymentDate:
            data.paymentMethod === "Boleto" && settled
              ? boletoPaymentDate
              : null,
        });
      });
    }

    return records;
  }

  if (data.condition === "Recorrente") {
    const recurrenceTotal = data.recurrenceCount ?? 0;

    for (let index = 0; index < recurrenceTotal; index += 1) {
      const recurrencePeriod = addMonthsToPeriod(period, index);
      const recurrencePurchaseDate = addMonthsToDate(purchaseDate, index);
      const recurrenceDueDate = dueDate
        ? addMonthsToDate(dueDate, index)
        : null;

      shares.forEach((share) => {
        const settled = resolveSettledValue(index);
        records.push({
          ...basePayload,
          amount: centsToDecimalString(share.amountCents * amountSign),
          pagadorId: share.pagadorId,
          purchaseDate: recurrencePurchaseDate,
          period: recurrencePeriod,
          isSettled: settled,
          recurrenceCount: recurrenceTotal,
          dueDate: recurrenceDueDate,
          boletoPaymentDate:
            data.paymentMethod === "Boleto" && settled
              ? boletoPaymentDate
              : null,
        });
      });
    }

    return records;
  }

  shares.forEach((share) => {
    const settled = resolveSettledValue(0);
    records.push({
      ...basePayload,
      amount: centsToDecimalString(share.amountCents * amountSign),
      pagadorId: share.pagadorId,
      purchaseDate,
      period,
      isSettled: settled,
      dueDate,
      boletoPaymentDate:
        data.paymentMethod === "Boleto" && settled ? boletoPaymentDate : null,
    });
  });

  return records;
};

export async function createLancamentoAction(
  input: CreateInput
): Promise<ActionResult> {
  try {
    const user = await getUser();
    const data = createSchema.parse(input);

    const period = resolvePeriod(data.purchaseDate, data.period);
    const purchaseDate = parseLocalDateString(data.purchaseDate);
    const dueDate = data.dueDate ? parseLocalDateString(data.dueDate) : null;
    const shouldSetBoletoPaymentDate =
      data.paymentMethod === "Boleto" && (data.isSettled ?? false);
    const boletoPaymentDate = shouldSetBoletoPaymentDate
      ? data.boletoPaymentDate
        ? parseLocalDateString(data.boletoPaymentDate)
        : getTodayDate()
      : null;

    const amountSign: 1 | -1 = data.transactionType === "Despesa" ? -1 : 1;
    const totalCents = Math.round(Math.abs(data.amount) * 100);
    const shouldNullifySettled = data.paymentMethod === "Cartão de crédito";

    const shares = buildShares({
      totalCents,
      pagadorId: data.pagadorId ?? null,
      isSplit: data.isSplit ?? false,
      secondaryPagadorId: data.secondaryPagadorId,
    });

    const isSeriesLancamento =
      data.condition === "Parcelado" || data.condition === "Recorrente";
    const seriesId = isSeriesLancamento ? randomUUID() : null;

    const records = buildLancamentoRecords({
      data,
      userId: user.id,
      period,
      purchaseDate,
      dueDate,
      shares,
      amountSign,
      shouldNullifySettled,
      boletoPaymentDate,
      seriesId,
    });

    if (!records.length) {
      throw new Error("Não foi possível criar os lançamentos solicitados.");
    }

    await db.transaction(async (tx: typeof db) => {
      await tx.insert(lancamentos).values(records);
    });

    const notificationEntries = buildEntriesByPagador(
      records.map((record) => ({
        pagadorId: record.pagadorId ?? null,
        name: record.name ?? null,
        amount: record.amount ?? null,
        transactionType: record.transactionType ?? null,
        paymentMethod: record.paymentMethod ?? null,
        condition: record.condition ?? null,
        purchaseDate: record.purchaseDate ?? null,
        period: record.period ?? null,
        note: record.note ?? null,
      }))
    );

    if (notificationEntries.size > 0) {
      await sendPagadorAutoEmails({
        userLabel: resolveUserLabel(user),
        action: "created",
        entriesByPagador: notificationEntries,
      });
    }

    revalidate();

    return { success: true, message: "Lançamento criado com sucesso." };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateLancamentoAction(
  input: UpdateInput
): Promise<ActionResult> {
  try {
    const user = await getUser();
    const data = updateSchema.parse(input);

    const existing = await db.query.lancamentos.findFirst({
      columns: {
        id: true,
        note: true,
        transactionType: true,
        condition: true,
        paymentMethod: true,
        contaId: true,
        categoriaId: true,
      },
      where: and(eq(lancamentos.id, data.id), eq(lancamentos.userId, user.id)),
      with: {
        categoria: {
          columns: {
            name: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, error: "Lançamento não encontrado." };
    }

    // Bloquear edição de lançamentos com categorias protegidas
    // Nota: "Transferência interna" foi removida para permitir correção de valores
    const categoriasProtegidasEdicao = ["Saldo inicial", "Pagamentos"];
    if (
      existing.categoria?.name &&
      categoriasProtegidasEdicao.includes(existing.categoria.name)
    ) {
      return {
        success: false,
        error: `Lançamentos com a categoria '${existing.categoria.name}' não podem ser editados.`,
      };
    }

    const period = resolvePeriod(data.purchaseDate, data.period);
    const amountSign: 1 | -1 = data.transactionType === "Despesa" ? -1 : 1;
    const amountCents = Math.round(Math.abs(data.amount) * 100);
    const normalizedAmount = centsToDecimalString(amountCents * amountSign);
    const normalizedSettled =
      data.paymentMethod === "Cartão de crédito"
        ? null
        : data.isSettled ?? false;
    const shouldSetBoletoPaymentDate =
      data.paymentMethod === "Boleto" && Boolean(normalizedSettled);
    const boletoPaymentDateValue = shouldSetBoletoPaymentDate
      ? data.boletoPaymentDate
        ? parseLocalDateString(data.boletoPaymentDate)
        : getTodayDate()
      : null;

    await db
      .update(lancamentos)
      .set({
        name: data.name,
        purchaseDate: parseLocalDateString(data.purchaseDate),
        transactionType: data.transactionType,
        amount: normalizedAmount,
        condition: data.condition,
        paymentMethod: data.paymentMethod,
        pagadorId: data.pagadorId ?? null,
        contaId: data.contaId ?? null,
        cartaoId: data.cartaoId ?? null,
        categoriaId: data.categoriaId ?? null,
        note: data.note ?? null,
        isSettled: normalizedSettled,
        installmentCount: data.installmentCount ?? null,
        recurrenceCount: data.recurrenceCount ?? null,
        dueDate: data.dueDate ? parseLocalDateString(data.dueDate) : null,
        boletoPaymentDate: boletoPaymentDateValue,
        period,
      })
      .where(and(eq(lancamentos.id, data.id), eq(lancamentos.userId, user.id)));

    if (isInitialBalanceLancamento(existing) && existing?.contaId) {
      const updatedInitialBalance = formatDecimalForDbRequired(
        Math.abs(data.amount ?? 0)
      );
      await db
        .update(contas)
        .set({ initialBalance: updatedInitialBalance })
        .where(
          and(eq(contas.id, existing.contaId), eq(contas.userId, user.id))
        );
    }

    revalidate();

    return { success: true, message: "Lançamento atualizado com sucesso." };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteLancamentoAction(
  input: DeleteInput
): Promise<ActionResult> {
  try {
    const user = await getUser();
    const data = deleteSchema.parse(input);

    const existing = await db.query.lancamentos.findFirst({
      columns: {
        id: true,
        name: true,
        pagadorId: true,
        amount: true,
        transactionType: true,
        paymentMethod: true,
        condition: true,
        purchaseDate: true,
        period: true,
        note: true,
        categoriaId: true,
      },
      where: and(eq(lancamentos.id, data.id), eq(lancamentos.userId, user.id)),
      with: {
        categoria: {
          columns: {
            name: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, error: "Lançamento não encontrado." };
    }

    // Bloquear remoção de lançamentos com categorias protegidas
    // Nota: "Transferência interna" foi removida para permitir correção/exclusão
    const categoriasProtegidasRemocao = ["Saldo inicial", "Pagamentos"];
    if (
      existing.categoria?.name &&
      categoriasProtegidasRemocao.includes(existing.categoria.name)
    ) {
      return {
        success: false,
        error: `Lançamentos com a categoria '${existing.categoria.name}' não podem ser removidos.`,
      };
    }

    await db
      .delete(lancamentos)
      .where(and(eq(lancamentos.id, data.id), eq(lancamentos.userId, user.id)));

    if (existing.pagadorId) {
      const notificationEntries = buildEntriesByPagador([
        {
          pagadorId: existing.pagadorId,
          name: existing.name ?? null,
          amount: existing.amount ?? null,
          transactionType: existing.transactionType ?? null,
          paymentMethod: existing.paymentMethod ?? null,
          condition: existing.condition ?? null,
          purchaseDate: existing.purchaseDate ?? null,
          period: existing.period ?? null,
          note: existing.note ?? null,
        },
      ]);

      await sendPagadorAutoEmails({
        userLabel: resolveUserLabel(user),
        action: "deleted",
        entriesByPagador: notificationEntries,
      });
    }

    revalidate();

    return { success: true, message: "Lançamento removido com sucesso." };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function toggleLancamentoSettlementAction(
  input: ToggleSettlementInput
): Promise<ActionResult> {
  try {
    const user = await getUser();
    const data = toggleSettlementSchema.parse(input);

    const existing = await db.query.lancamentos.findFirst({
      columns: { id: true, paymentMethod: true },
      where: and(eq(lancamentos.id, data.id), eq(lancamentos.userId, user.id)),
    });

    if (!existing) {
      return { success: false, error: "Lançamento não encontrado." };
    }

    if (existing.paymentMethod === "Cartão de crédito") {
      return {
        success: false,
        error: "Pagamentos com cartão são conciliados automaticamente.",
      };
    }

    const isBoleto = existing.paymentMethod === "Boleto";
    const boletoPaymentDate = isBoleto
      ? data.value
        ? getTodayDate()
        : null
      : null;

    await db
      .update(lancamentos)
      .set({
        isSettled: data.value,
        boletoPaymentDate,
      })
      .where(and(eq(lancamentos.id, data.id), eq(lancamentos.userId, user.id)));

    revalidate();

    return {
      success: true,
      message: data.value
        ? "Lançamento marcado como pago."
        : "Pagamento desfeito com sucesso.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

const deleteBulkSchema = z.object({
  id: uuidSchema("Lançamento"),
  scope: z.enum(["current", "future", "all"], {
    message: "Escopo de ação inválido.",
  }),
});

type DeleteBulkInput = z.infer<typeof deleteBulkSchema>;

export async function deleteLancamentoBulkAction(
  input: DeleteBulkInput
): Promise<ActionResult> {
  try {
    const user = await getUser();
    const data = deleteBulkSchema.parse(input);

    const existing = await db.query.lancamentos.findFirst({
      columns: {
        id: true,
        name: true,
        seriesId: true,
        period: true,
        condition: true,
      },
      where: and(eq(lancamentos.id, data.id), eq(lancamentos.userId, user.id)),
    });

    if (!existing) {
      return { success: false, error: "Lançamento não encontrado." };
    }

    if (!existing.seriesId) {
      return {
        success: false,
        error: "Este lançamento não faz parte de uma série.",
      };
    }

    if (data.scope === "current") {
      await db
        .delete(lancamentos)
        .where(
          and(eq(lancamentos.id, data.id), eq(lancamentos.userId, user.id))
        );

      revalidate();
      return { success: true, message: "Lançamento removido com sucesso." };
    }

    if (data.scope === "future") {
      await db
        .delete(lancamentos)
        .where(
          and(
            eq(lancamentos.seriesId, existing.seriesId),
            eq(lancamentos.userId, user.id),
            sql`${lancamentos.period} >= ${existing.period}`
          )
        );

      revalidate();
      return {
        success: true,
        message: "Lançamentos removidos com sucesso.",
      };
    }

    if (data.scope === "all") {
      await db
        .delete(lancamentos)
        .where(
          and(
            eq(lancamentos.seriesId, existing.seriesId),
            eq(lancamentos.userId, user.id)
          )
        );

      revalidate();
      return {
        success: true,
        message: "Todos os lançamentos da série foram removidos.",
      };
    }

    return { success: false, error: "Escopo de ação inválido." };
  } catch (error) {
    return handleActionError(error);
  }
}

const updateBulkSchema = z.object({
  id: uuidSchema("Lançamento"),
  scope: z.enum(["current", "future", "all"], {
    message: "Escopo de ação inválido.",
  }),
  name: z
    .string({ message: "Informe o estabelecimento." })
    .trim()
    .min(1, "Informe o estabelecimento."),
  categoriaId: uuidSchema("Categoria").nullable().optional(),
  note: noteSchema,
  pagadorId: uuidSchema("Pagador").nullable().optional(),
  contaId: uuidSchema("Conta").nullable().optional(),
  cartaoId: uuidSchema("Cartão").nullable().optional(),
  amount: z.coerce
    .number({ message: "Informe o valor da transação." })
    .min(0, "Informe um valor maior ou igual a zero.")
    .optional(),
  dueDate: z
    .string()
    .trim()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
      message: "Informe uma data de vencimento válida.",
    })
    .optional()
    .nullable(),
  boletoPaymentDate: z
    .string()
    .trim()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
      message: "Informe uma data de pagamento válida.",
    })
    .optional()
    .nullable(),
});

type UpdateBulkInput = z.infer<typeof updateBulkSchema>;

export async function updateLancamentoBulkAction(
  input: UpdateBulkInput
): Promise<ActionResult> {
  try {
    const user = await getUser();
    const data = updateBulkSchema.parse(input);

    const existing = await db.query.lancamentos.findFirst({
      columns: {
        id: true,
        name: true,
        seriesId: true,
        period: true,
        condition: true,
        transactionType: true,
        purchaseDate: true,
      },
      where: and(eq(lancamentos.id, data.id), eq(lancamentos.userId, user.id)),
    });

    if (!existing) {
      return { success: false, error: "Lançamento não encontrado." };
    }

    if (!existing.seriesId) {
      return {
        success: false,
        error: "Este lançamento não faz parte de uma série.",
      };
    }

    const baseUpdatePayload: Record<string, unknown> = {
      name: data.name,
      categoriaId: data.categoriaId ?? null,
      note: data.note ?? null,
      pagadorId: data.pagadorId ?? null,
      contaId: data.contaId ?? null,
      cartaoId: data.cartaoId ?? null,
    };

    if (data.amount !== undefined) {
      const amountSign: 1 | -1 =
        existing.transactionType === "Despesa" ? -1 : 1;
      const amountCents = Math.round(Math.abs(data.amount) * 100);
      baseUpdatePayload.amount = centsToDecimalString(amountCents * amountSign);
    }

    const hasDueDateUpdate = data.dueDate !== undefined;
    const hasBoletoPaymentDateUpdate = data.boletoPaymentDate !== undefined;

    const baseDueDate =
      hasDueDateUpdate && data.dueDate
        ? parseLocalDateString(data.dueDate)
        : hasDueDateUpdate
          ? null
          : undefined;

    const baseBoletoPaymentDate =
      hasBoletoPaymentDateUpdate && data.boletoPaymentDate
        ? parseLocalDateString(data.boletoPaymentDate)
        : hasBoletoPaymentDateUpdate
          ? null
          : undefined;

    const basePurchaseDate = existing.purchaseDate ?? null;

    const buildDueDateForRecord = (recordPurchaseDate: Date | null) => {
      if (!hasDueDateUpdate) {
        return undefined;
      }

      if (!baseDueDate) {
        return null;
      }

      if (!basePurchaseDate || !recordPurchaseDate) {
        return baseDueDate;
      }

      const monthDiff =
        (recordPurchaseDate.getFullYear() - basePurchaseDate.getFullYear()) *
        12 +
        (recordPurchaseDate.getMonth() - basePurchaseDate.getMonth());

      return addMonthsToDate(baseDueDate, monthDiff);
    };

    const applyUpdates = async (
      records: Array<{ id: string; purchaseDate: Date | null }>
    ) => {
      if (records.length === 0) {
        return;
      }

      await db.transaction(async (tx: typeof db) => {
        for (const record of records) {
          const perRecordPayload: Record<string, unknown> = {
            ...baseUpdatePayload,
          };

          const dueDateForRecord = buildDueDateForRecord(record.purchaseDate);
          if (dueDateForRecord !== undefined) {
            perRecordPayload.dueDate = dueDateForRecord;
          }

          if (hasBoletoPaymentDateUpdate) {
            perRecordPayload.boletoPaymentDate = baseBoletoPaymentDate ?? null;
          }

          await tx
            .update(lancamentos)
            .set(perRecordPayload)
            .where(
              and(
                eq(lancamentos.id, record.id),
                eq(lancamentos.userId, user.id)
              )
            );
        }
      });
    };

    if (data.scope === "current") {
      await applyUpdates([
        {
          id: data.id,
          purchaseDate: existing.purchaseDate ?? null,
        },
      ]);

      revalidate();
      return { success: true, message: "Lançamento atualizado com sucesso." };
    }

    if (data.scope === "future") {
      const futureLancamentos = await db.query.lancamentos.findMany({
        columns: {
          id: true,
          purchaseDate: true,
        },
        where: and(
          eq(lancamentos.seriesId, existing.seriesId),
          eq(lancamentos.userId, user.id),
          sql`${lancamentos.period} >= ${existing.period}`
        ),
        orderBy: asc(lancamentos.purchaseDate),
      });

      await applyUpdates(
        futureLancamentos.map((item) => ({
          id: item.id,
          purchaseDate: item.purchaseDate ?? null,
        }))
      );

      revalidate();
      return {
        success: true,
        message: "Lançamentos atualizados com sucesso.",
      };
    }

    if (data.scope === "all") {
      const allLancamentos = await db.query.lancamentos.findMany({
        columns: {
          id: true,
          purchaseDate: true,
        },
        where: and(
          eq(lancamentos.seriesId, existing.seriesId),
          eq(lancamentos.userId, user.id)
        ),
        orderBy: asc(lancamentos.purchaseDate),
      });

      await applyUpdates(
        allLancamentos.map((item) => ({
          id: item.id,
          purchaseDate: item.purchaseDate ?? null,
        }))
      );

      revalidate();
      return {
        success: true,
        message: "Todos os lançamentos da série foram atualizados.",
      };
    }

    return { success: false, error: "Escopo de ação inválido." };
  } catch (error) {
    return handleActionError(error);
  }
}

// Mass Add Schema
const massAddTransactionSchema = z.object({
  purchaseDate: z
    .string({ message: "Informe a data da transação." })
    .trim()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Data da transação inválida.",
    }),
  name: z
    .string({ message: "Informe o estabelecimento." })
    .trim()
    .min(1, "Informe o estabelecimento."),
  amount: z.coerce
    .number({ message: "Informe o valor da transação." })
    .min(0, "Informe um valor maior ou igual a zero."),
  categoriaId: uuidSchema("Categoria").nullable().optional(),
});

const massAddSchema = z.object({
  fixedFields: z.object({
    transactionType: z.enum(LANCAMENTO_TRANSACTION_TYPES).optional(),
    pagadorId: uuidSchema("Pagador").nullable().optional(),
    paymentMethod: z.enum(LANCAMENTO_PAYMENT_METHODS).optional(),
    condition: z.enum(LANCAMENTO_CONDITIONS).optional(),
    period: z
      .string()
      .trim()
      .regex(/^(\d{4})-(\d{2})$/, {
        message: "Selecione um período válido.",
      })
      .optional(),
    contaId: uuidSchema("Conta").nullable().optional(),
    cartaoId: uuidSchema("Cartão").nullable().optional(),
  }),
  transactions: z
    .array(massAddTransactionSchema)
    .min(1, "Adicione pelo menos uma transação."),
});

type MassAddInput = z.infer<typeof massAddSchema>;

export async function createMassLancamentosAction(
  input: MassAddInput
): Promise<ActionResult> {
  try {
    const user = await getUser();
    const data = massAddSchema.parse(input);

    // Default values for non-fixed fields
    const defaultTransactionType = LANCAMENTO_TRANSACTION_TYPES[0];
    const defaultCondition = LANCAMENTO_CONDITIONS[0];
    const defaultPaymentMethod = LANCAMENTO_PAYMENT_METHODS[0];

    const allRecords: LancamentoInsert[] = [];
    const notificationData: Array<{
      pagadorId: string | null;
      name: string | null;
      amount: string | null;
      transactionType: string | null;
      paymentMethod: string | null;
      condition: string | null;
      purchaseDate: Date | null;
      period: string | null;
      note: string | null;
    }> = [];

    // Process each transaction
    for (const transaction of data.transactions) {
      const transactionType =
        data.fixedFields.transactionType ?? defaultTransactionType;
      const condition = data.fixedFields.condition ?? defaultCondition;
      const paymentMethod =
        data.fixedFields.paymentMethod ?? defaultPaymentMethod;
      const pagadorId = data.fixedFields.pagadorId ?? null;
      const contaId =
        paymentMethod === "Cartão de crédito"
          ? null
          : data.fixedFields.contaId ?? null;
      const cartaoId =
        paymentMethod === "Cartão de crédito"
          ? data.fixedFields.cartaoId ?? null
          : null;
      const categoriaId = transaction.categoriaId ?? null;

      const period =
        data.fixedFields.period ?? resolvePeriod(transaction.purchaseDate);
      const purchaseDate = parseLocalDateString(transaction.purchaseDate);
      const amountSign: 1 | -1 = transactionType === "Despesa" ? -1 : 1;
      const totalCents = Math.round(Math.abs(transaction.amount) * 100);
      const amount = centsToDecimalString(totalCents * amountSign);
      const isSettled = paymentMethod === "Cartão de crédito" ? null : false;

      const record: LancamentoInsert = {
        name: transaction.name,
        purchaseDate,
        period,
        transactionType,
        amount,
        condition,
        paymentMethod,
        pagadorId,
        contaId,
        cartaoId,
        categoriaId,
        note: null,
        installmentCount: null,
        recurrenceCount: null,
        currentInstallment: null,
        isSettled,
        isDivided: false,
        dueDate: null,
        boletoPaymentDate: null,
        userId: user.id,
        seriesId: null,
      };

      allRecords.push(record);

      notificationData.push({
        pagadorId,
        name: transaction.name,
        amount,
        transactionType,
        paymentMethod,
        condition,
        purchaseDate,
        period,
        note: null,
      });
    }

    if (!allRecords.length) {
      throw new Error("Não foi possível criar os lançamentos solicitados.");
    }

    // Insert all records in a single transaction
    await db.transaction(async (tx: typeof db) => {
      await tx.insert(lancamentos).values(allRecords);
    });

    // Send notifications
    const notificationEntries = buildEntriesByPagador(notificationData);

    if (notificationEntries.size > 0) {
      await sendPagadorAutoEmails({
        userLabel: resolveUserLabel(user),
        action: "created",
        entriesByPagador: notificationEntries,
      });
    }

    revalidate();

    const count = allRecords.length;
    return {
      success: true,
      message: `${count} ${count === 1 ? "lançamento criado" : "lançamentos criados"
        } com sucesso.`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

// Delete multiple lancamentos at once
const deleteMultipleSchema = z.object({
  ids: z
    .array(uuidSchema("Lançamento"))
    .min(1, "Selecione pelo menos um lançamento."),
});

type DeleteMultipleInput = z.infer<typeof deleteMultipleSchema>;

export async function deleteMultipleLancamentosAction(
  input: DeleteMultipleInput
): Promise<ActionResult> {
  try {
    const user = await getUser();
    const data = deleteMultipleSchema.parse(input);

    // Fetch all lancamentos to be deleted
    const existing = await db.query.lancamentos.findMany({
      columns: {
        id: true,
        name: true,
        pagadorId: true,
        amount: true,
        transactionType: true,
        paymentMethod: true,
        condition: true,
        purchaseDate: true,
        period: true,
        note: true,
      },
      where: and(
        inArray(lancamentos.id, data.ids),
        eq(lancamentos.userId, user.id)
      ),
    });

    if (existing.length === 0) {
      return { success: false, error: "Nenhum lançamento encontrado." };
    }

    // Delete all lancamentos
    await db
      .delete(lancamentos)
      .where(
        and(inArray(lancamentos.id, data.ids), eq(lancamentos.userId, user.id))
      );

    // Send notifications
    const notificationData = existing
      .filter(
        (
          item
        ): item is typeof item & {
          pagadorId: NonNullable<typeof item.pagadorId>;
        } => Boolean(item.pagadorId)
      )
      .map((item) => ({
        pagadorId: item.pagadorId,
        name: item.name ?? null,
        amount: item.amount ?? null,
        transactionType: item.transactionType ?? null,
        paymentMethod: item.paymentMethod ?? null,
        condition: item.condition ?? null,
        purchaseDate: item.purchaseDate ?? null,
        period: item.period ?? null,
        note: item.note ?? null,
      }));

    if (notificationData.length > 0) {
      const notificationEntries = buildEntriesByPagador(notificationData);

      await sendPagadorAutoEmails({
        userLabel: resolveUserLabel(user),
        action: "deleted",
        entriesByPagador: notificationEntries,
      });
    }

    revalidate();

    const count = existing.length;
    return {
      success: true,
      message: `${count} ${count === 1 ? "lançamento removido" : "lançamentos removidos"
        } com sucesso.`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

// Get unique establishment names from the last 3 months
export async function getRecentEstablishmentsAction(): Promise<string[]> {
  try {
    const user = await getUser();

    // Calculate date 3 months ago
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Fetch establishment names from the last 3 months
    const results = await db
      .select({ name: lancamentos.name })
      .from(lancamentos)
      .where(
        and(
          eq(lancamentos.userId, user.id),
          gte(lancamentos.purchaseDate, threeMonthsAgo)
        )
      )
      .orderBy(desc(lancamentos.purchaseDate));

    // Remove duplicates and filter empty names
    const uniqueNames = Array.from(
      new Set(
        results
          .map((r) => r.name)
          .filter(
            (name): name is string =>
              name != null &&
              name.trim().length > 0 &&
              !name.toLowerCase().startsWith("pagamento fatura")
          )
      )
    );

    // Return top 50 most recent unique establishments
    return uniqueNames.slice(0, 100);
  } catch (error) {
    console.error("Error fetching recent establishments:", error);
    return [];
  }
}

/**
 * CSV Import Server Actions
 */

/**
 * Parse CSV file content
 * Validates file content and returns parsed data with headers and rows
 */
export async function parseCsvFileAction(
  fileContent: string,
  delimiter?: ";" | "," | "\t" | "auto"
): Promise<
  ActionResult<{
    headers: Array<{ name: string; originalName: string }>;
    rows: Array<Record<string, string>>;
    rowCount: number;
    detectedDelimiter: ";" | "," | "\t";
  }>
> {
  try {
    // Validate user authentication
    const user = await getUser();
    if (!user) {
      return errorResult("Usuário não autenticado.");
    }

    // Validate file content
    if (!fileContent || fileContent.trim().length === 0) {
      return errorResult("Arquivo CSV vazio.");
    }

    // Import CSV parser (dynamic import to avoid client-side bundle)
    const { parseCsvString } = await import("@/lib/csv/parser");

    // Parse CSV content directly
    const parseResult = parseCsvString(fileContent, {
      delimiter: delimiter === "auto" ? undefined : delimiter,
      trimHeaders: true,
    });

    // Check for parsing errors
    if (!parseResult.success) {
      return errorResult(
        parseResult.errors?.[0]?.message || "Erro ao processar arquivo CSV."
      );
    }

    // Return parsed data
    return {
      success: true,
      message: "Arquivo CSV processado com sucesso.",
      data: {
        headers: parseResult.headers,
        rows: parseResult.rows,
        rowCount: parseResult.rowCount,
        detectedDelimiter: parseResult.detectedDelimiter,
      },
    };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Detect duplicate CSV transactions
 * Server action for detecting potential duplicates in existing transactions
 *
 * @param accountId - Account ID (contaId or cartaoId) to check for duplicates
 * @param accountType - Type of account ("bank" or "card")
 * @param transactions - Array of CSV transactions to check for duplicates
 * @returns Map of transaction IDs to their duplicate matches
 */
export async function detectCsvDuplicatesAction(
  accountId: string,
  accountType: "bank" | "card",
  transactions: Array<{
    id: string;
    name: string;
    amount: string;
    purchaseDate: Date;
  }>
): Promise<
  ActionResult<
    Map<
      string,
      Array<{
        lancamentoId: string;
        matchReason: "fitid" | "exact" | "similar" | "likely";
        similarity: number;
        existingTransaction: {
          nome: string;
          valor: string;
          purchaseDate: Date;
          anotacao: string | null;
        };
      }>
    >
  >
> {
  try {
    // Validate user authentication
    const user = await getUser();
    if (!user) {
      return errorResult("Usuário não autenticado.");
    }

    // Validate inputs
    if (!accountId || !z.string().uuid().safeParse(accountId).success) {
      return errorResult("ID da conta inválido.");
    }

    if (transactions.length === 0) {
      return errorResult("Lista de transações vazia.");
    }

    if (transactions.length > 1000) {
      return errorResult("Máximo de 1000 transações por verificação.");
    }

    // Verify account ownership based on account type
    if (accountType === "bank") {
      const account = await db.query.contas.findFirst({
        where: and(eq(contas.id, accountId), eq(contas.userId, user.id)),
        columns: { id: true },
      });

      if (!account) {
        return errorResult(
          "Conta não encontrada ou você não tem permissão para acessá-la."
        );
      }
    } else {
      const { cartoes } = await import("@/db/schema");
      const card = await db.query.cartoes.findFirst({
        where: and(eq(cartoes.id, accountId), eq(cartoes.userId, user.id)),
        columns: { id: true },
      });

      if (!card) {
        return errorResult(
          "Cartão não encontrado ou você não tem permissão para acessá-lo."
        );
      }
    }

    // Import duplicate detector
    const { detectDuplicatesBatch } = await import(
      "@/lib/ofx/duplicate-detector"
    );

    console.log("[CSV Duplicate Action] Calling duplicate detector with:", {
      userId: user.id,
      accountId,
      accountType,
      transactionCount: transactions.length,
      sampleTransaction: transactions[0]
    });

    // Detect duplicates using the same logic as OFX imports
    const duplicates = await detectDuplicatesBatch(
      user.id,
      accountId,
      accountType,
      transactions
    );

    console.log("[CSV Duplicate Action] Duplicate detection complete:", {
      duplicatesMapSize: duplicates.size,
      transactionsWithDuplicates: Array.from(duplicates.entries())
        .filter(([_, matches]) => matches.length > 0)
        .map(([id, matches]) => ({ id, matchCount: matches.length }))
    });

    // Convert Map to plain object for serialization (Next.js server actions don't serialize Maps properly)
    const duplicatesObject: Record<string, Array<{
      lancamentoId: string;
      matchReason: "fitid" | "exact" | "similar" | "likely";
      similarity: number;
      existingTransaction: {
        nome: string;
        valor: string;
        purchaseDate: Date;
        anotacao: string | null;
      };
    }>> = {};

    for (const [id, matches] of duplicates.entries()) {
      duplicatesObject[id] = matches;
    }

    console.log("[CSV Duplicate Action] Converted to object, sample keys:", Object.keys(duplicatesObject).slice(0, 3));

    return {
      success: true,
      message: `Verificação de duplicatas concluída para ${transactions.length} transações.`,
      data: duplicatesObject,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Suggest categories for CSV transactions
 * Server action for getting category suggestions based on historical data
 *
 * @param transactions - Array of CSV transactions to get suggestions for
 * @returns Map of transaction ID to category suggestion
 */
export async function suggestCsvCategoriesAction(
  transactions: Array<{
    id: string;
    name: string;
    amount: string;
    transactionType: string;
  }>
): Promise<
  ActionResult<
    Record<
      string,
      {
        categoriaId: string;
        confidence: "high" | "medium" | "low";
        score: number;
        matchReason: "exact" | "fuzzy" | "amount-pattern";
      }
    >
  >
> {
  try {
    // Validate user authentication
    const user = await getUser();
    if (!user) {
      return errorResult("Usuário não autenticado.");
    }

    // Validate input
    if (transactions.length === 0) {
      return errorResult("Lista de transações vazia.");
    }

    if (transactions.length > 1000) {
      return errorResult("Máximo de 1000 transações por sugestão.");
    }

    // Import category suggester
    const { suggestCategoriesForTransactions } = await import(
      "@/lib/ofx/category-suggester"
    );

    // Get category suggestions using the same logic as OFX imports
    const suggestions = await suggestCategoriesForTransactions(
      user.id,
      transactions.map((t) => ({
        id: t.id,
        name: t.name,
        amount: t.amount,
        transactionType: t.transactionType,
      }))
    );

    return {
      success: true,
      message: `Sugestões geradas para ${suggestions.size} transações.`,
      data: suggestions,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Rate limit configuration for CSV imports
 * Reuses OFX import rate limits
 */
const CSV_RATE_LIMIT_MAX_IMPORTS = 60;
const CSV_RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * In-memory store for CSV import rate limiting
 * Maps userId to array of import timestamps
 */
const csvImportAttemptsStore = new Map<string, number[]>();

/**
 * Check if user has exceeded rate limit for CSV imports
 */
function isCsvRateLimitExceeded(userId: string): boolean {
  const now = Date.now();
  const attempts = csvImportAttemptsStore.get(userId) || [];

  const recentAttempts = attempts.filter(
    (timestamp) => now - timestamp < CSV_RATE_LIMIT_WINDOW_MS
  );

  if (recentAttempts.length === 0) {
    csvImportAttemptsStore.delete(userId);
  } else {
    csvImportAttemptsStore.set(userId, recentAttempts);
  }

  return recentAttempts.length >= CSV_RATE_LIMIT_MAX_IMPORTS;
}

/**
 * Record a CSV import attempt for rate limiting
 */
function recordCsvImportAttempt(userId: string): void {
  const now = Date.now();
  const attempts = csvImportAttemptsStore.get(userId) || [];
  attempts.push(now);

  const recentAttempts = attempts.filter(
    (timestamp) => now - timestamp < CSV_RATE_LIMIT_WINDOW_MS
  );

  csvImportAttemptsStore.set(userId, recentAttempts);
}

/**
 * Import CSV transactions to database
 * Server action for batch inserting validated CSV transactions
 *
 * @param accountId - Account ID (contaId or cartaoId) to import transactions to
 * @param accountType - Type of account ("bank" or "card")
 * @param transactions - Array of validated transactions to import
 * @returns Success result with imported count or error
 */
export async function importCsvTransactionsAction(
  accountId: string,
  accountType: "bank" | "card" | "banco" | "cartao",
  transactions: Array<{
    nome: string;
    valor: string;
    data_compra: Date;
    tipo_transacao: "Despesa" | "Receita";
    forma_pagamento?: string;
    condicao?: string;
    periodo?: string;
    anotacao?: string;
    categoriaId?: string;
    pagadorId?: string;
  }>,
  periodOverride?: string
): Promise<ActionResult<{ importedCount: number; skippedCount: number }>> {
  try {
    // Validate user authentication
    const user = await getUser();
    if (!user) {
      return errorResult("Usuário não autenticado.");
    }

    // Normalize account type to English
    const normalizedAccountType: "bank" | "card" =
      accountType === "banco" ? "bank" :
        accountType === "cartao" ? "card" :
          accountType;

    // Check rate limit before processing
    if (isCsvRateLimitExceeded(user.id)) {
      return { success: false, error: `Limite de importações excedido. Você atingiu o máximo de ${CSV_RATE_LIMIT_MAX_IMPORTS} importações em 30 minutos. Tente novamente mais tarde.` };
    }

    // Validate inputs
    if (!accountId || !z.string().uuid().safeParse(accountId).success) {
      return errorResult("ID da conta inválido.");
    }

    if (transactions.length === 0) {
      return errorResult("Lista de transações vazia.");
    }

    if (transactions.length > 1000) {
      return { success: false, error: "Máximo de 1000 transações por importação." };
    }

    // Verify account ownership based on account type
    if (normalizedAccountType === "bank") {
      const account = await db.query.contas.findFirst({
        where: and(eq(contas.id, accountId), eq(contas.userId, user.id)),
        columns: { id: true },
      });

      if (!account) {
        return errorResult(
          "Conta não encontrada ou você não tem permissão para acessá-la."
        );
      }
    }

    // Get card details including closing day for period calculation
    let cardClosingDay: number | null = null;
    if (normalizedAccountType === "card") {
      const { cartoes } = await import("@/db/schema");
      const card = await db.query.cartoes.findFirst({
        where: and(eq(cartoes.id, accountId), eq(cartoes.userId, user.id)),
        columns: { id: true, closingDay: true },
      });

      if (!card) {
        return errorResult(
          "Cartão não encontrado ou você não tem permissão para acessá-lo."
        );
      }

      // Parse closing day (stored as string like "02", "15", etc.)
      const parsed = parseInt(card.closingDay, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) {
        cardClosingDay = parsed;
      }
    }

    // Get user's ADMIN pagador for default fallback (create if doesn't exist)
    const { pagadores, PAGADOR_ROLE_ADMIN } = await import("@/db/schema");
    let adminPagador = await db.query.pagadores.findFirst({
      where: and(
        eq(pagadores.userId, user.id),
        eq(pagadores.role, PAGADOR_ROLE_ADMIN)
      ),
      columns: { id: true },
    });

    // Auto-create ADMIN pagador if missing (legacy users or failed setup)
    if (!adminPagador) {
      const { DEFAULT_PAGADOR_AVATAR, PAGADOR_STATUS_OPTIONS } = await import("@/lib/pagadores/constants");
      const { normalizeNameFromEmail } = await import("@/lib/pagadores/utils");

      const name = user.name?.trim() || normalizeNameFromEmail(user.email) || "Pagador Principal";

      // Create ADMIN pagador directly
      const [created] = await db.insert(pagadores).values({
        name,
        email: user.email ?? null,
        status: PAGADOR_STATUS_OPTIONS[0],
        role: PAGADOR_ROLE_ADMIN,
        avatarUrl: DEFAULT_PAGADOR_AVATAR,
        note: null,
        isAutoSend: false,
        userId: user.id,
      }).returning({ id: pagadores.id });

      if (!created) {
        return {
          success: false,
          error: "Erro ao criar pagador padrão. Entre em contato com o suporte."
        };
      }

      adminPagador = created;
    }

    // Check for existing transactions to avoid duplicates
    // Fetch all existing transactions for this account
    const existingImports = await db.query.lancamentos.findMany({
      where: and(
        normalizedAccountType === "bank"
          ? eq(lancamentos.contaId, accountId)
          : eq(lancamentos.cartaoId, accountId),
        eq(lancamentos.userId, user.id)
      ),
      columns: {
        id: true,
        note: true,
        name: true,
        amount: true,
        purchaseDate: true,
      },
    });

    // Filter out duplicates (same name, amount, and purchase date)
    let skippedDuplicates = 0;
    const transactionsToImport = transactions.filter((t) => {
      const isDuplicate = existingImports.some((existing) => {
        // Compare name (case-insensitive, trimmed)
        const nameMatch = existing.name.trim().toLowerCase() === t.nome.trim().toLowerCase();

        // Compare amount (convert both to numbers for comparison)
        const existingAmount = typeof existing.amount === 'string'
          ? parseFloat(existing.amount)
          : existing.amount;
        const newAmount = typeof t.valor === 'string'
          ? parseFloat(t.valor)
          : t.valor;
        const amountMatch = Math.abs(existingAmount - newAmount) < 0.01; // Allow for tiny rounding differences

        // Compare dates (only year, month, day - ignore time)
        const existingDate = new Date(existing.purchaseDate);
        const newDate = new Date(t.data_compra);
        const dateMatch =
          existingDate.getFullYear() === newDate.getFullYear() &&
          existingDate.getMonth() === newDate.getMonth() &&
          existingDate.getDate() === newDate.getDate();

        return nameMatch && amountMatch && dateMatch;
      });

      if (isDuplicate) {
        skippedDuplicates++;
        return false;
      }
      return true;
    });

    // If all transactions are duplicates, return early
    if (transactionsToImport.length === 0) {
      return errorResult(
        "Todas as transações já foram importadas anteriormente."
      );
    }

    // Use database transaction for atomic batch insert
    let importedCount: number;
    try {
      importedCount = await db.transaction(async (tx) => {
        // Transform transactions to lancamentos format
        const lancamentosToInsert = transactionsToImport.map((t) => {
          const categoriaId = t.categoriaId ?? null;
          const pagadorId = t.pagadorId ?? adminPagador.id;

          // Add import metadata to note
          const importTimestamp = new Date().toISOString();
          const importNote = `Importado de CSV em ${importTimestamp}`;
          const originalNote = t.anotacao ?? "";
          const combinedNote = [importNote, originalNote]
            .filter(Boolean)
            .join(" | ");

          // Helper to check if value is undefined marker from frontend
          const isUndefined = (val: any) => !val || val === "$undefined";

          // Calculate period based on override, card closing day, or transaction date
          let period: string;
          if (!isUndefined(t.periodo)) {
            // Use period from transaction data if provided
            period = t.periodo;
          } else if (periodOverride) {
            // Use manual period override for entire import (credit card option)
            period = periodOverride;
          } else if (normalizedAccountType === "card" && cardClosingDay) {
            // Card period calculation based on closing day
            const transactionDate = new Date(t.data_compra);
            const transactionDay = transactionDate.getDate();
            let year = transactionDate.getFullYear();
            let month = transactionDate.getMonth() + 1; // 0-indexed to 1-indexed

            // If transaction is after closing day, period is next month
            if (transactionDay > cardClosingDay) {
              month += 1;
              if (month > 12) {
                month = 1;
                year += 1;
              }
            }

            period = `${year}-${String(month).padStart(2, "0")}`;
          } else {
            // Bank account or no closing day: use transaction month
            period = resolvePeriod(t.data_compra.toISOString());
          }

          // Ensure required fields have valid defaults based on account type
          const condition = isUndefined(t.condicao) ? "À vista" : t.condicao;
          const paymentMethod = isUndefined(t.forma_pagamento)
            ? (normalizedAccountType === "card" ? "Cartão de Crédito" : "Dinheiro")
            : t.forma_pagamento;

          return {
            name: t.nome,
            amount: t.valor,
            purchaseDate: t.data_compra,
            transactionType: t.tipo_transacao,
            paymentMethod,
            condition,
            period,
            note: combinedNote,
            isSettled: true, // Always true for CSV imports (already settled)
            contaId: normalizedAccountType === "bank" ? accountId : null,
            cartaoId: normalizedAccountType === "card" ? accountId : null,
            categoriaId,
            pagadorId,
            userId: user.id,
            // Optional fields set to null
            installmentCount: null,
            currentInstallment: null,
            recurrenceCount: null,
            dueDate: null,
            boletoPaymentDate: null,
            isDivided: false,
            isAnticipated: false,
            anticipationId: null,
            seriesId: null,
            transferId: null,
          };
        });

        // Batch insert all transactions
        await tx.insert(lancamentos).values(lancamentosToInsert);

        return lancamentosToInsert.length;
      });
    } catch (dbError) {
      console.error("[CSV Import] Database error", dbError);
      return errorResult(
        "Erro ao salvar transações no banco de dados. Tente novamente."
      );
    }

    // Revalidate lancamentos pages
    revalidateForEntity("lancamentos");

    // Record successful import attempt for rate limiting
    recordCsvImportAttempt(user.id);

    // Build success message
    let message = `${importedCount} ${importedCount === 1 ? "transação importada" : "transações importadas"
      } com sucesso`;

    if (skippedDuplicates > 0) {
      message += `. ${skippedDuplicates} ${skippedDuplicates === 1
        ? "transação duplicada foi ignorada"
        : "transações duplicadas foram ignoradas"
        }`;
    }

    return {
      success: true,
      message,
      data: { importedCount, skippedCount: skippedDuplicates },
    };
  } catch (error) {
    console.error("[CSV Import] Unexpected error", error);
    return handleActionError(error);
  }
}
