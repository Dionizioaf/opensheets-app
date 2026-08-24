import {
  LANCAMENTO_PAYMENT_METHODS,
  LANCAMENTO_TRANSACTION_TYPES,
} from "@/lib/lancamentos/constants";
import { z } from "zod";

export const mcpPeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must use YYYY-MM.");

export const mcpDateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: "Date must use YYYY-MM-DD.",
  });

export const mcpUuidSchema = z.string().uuid();

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(120)
  .regex(/^[A-Za-z0-9._:-]+$/, "Use a stable, non-secret idempotency key.");

/**
 * Two-step protocol for high-risk mutations. `preview` performs zero writes and
 * returns a structured impact summary; `apply` runs the audited, transactional
 * mutation. Defaults to `preview` so an accidental call never mutates.
 */
export const mcpMutationModeSchema = z
  .enum(["preview", "apply"])
  .default("preview");

export type McpMutationMode = z.infer<typeof mcpMutationModeSchema>;

export const overviewInputSchema = z.object({
  period: mcpPeriodSchema,
});

export const listTransactionsInputSchema = z.object({
  period: mcpPeriodSchema.optional(),
  dateFrom: mcpDateSchema.optional(),
  dateTo: mcpDateSchema.optional(),
  accountId: mcpUuidSchema.optional(),
  cardId: mcpUuidSchema.optional(),
  categoryId: mcpUuidSchema.optional(),
  payerId: mcpUuidSchema.optional(),
  transactionType: z.enum(LANCAMENTO_TRANSACTION_TYPES).optional(),
  settled: z.boolean().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.number().int().min(1).max(10_000).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

export const entityIdInputSchema = z.object({
  id: mcpUuidSchema,
});

export const accountStatementInputSchema = z.object({
  accountId: mcpUuidSchema,
  period: mcpPeriodSchema,
});

export const invoiceInputSchema = z.object({
  cardId: mcpUuidSchema,
  period: mcpPeriodSchema,
});

export const budgetsInputSchema = z.object({
  period: mcpPeriodSchema,
});

export const categoryReportInputSchema = z
  .object({
    startPeriod: mcpPeriodSchema,
    endPeriod: mcpPeriodSchema,
    categoryIds: z.array(mcpUuidSchema).max(100).optional(),
  })
  .refine((value) => value.startPeriod <= value.endPeriod, {
    message: "startPeriod must not be after endPeriod.",
  });

export const lookupInputSchema = z.object({
  query: z.string().trim().max(100).default(""),
  entityTypes: z
    .array(z.enum(["account", "card", "category", "payer"]))
    .min(1)
    .max(4)
    .default(["account", "card", "category", "payer"]),
  limit: z.number().int().min(1).max(50).default(20),
});

export const upcomingInputSchema = z.object({
  from: mcpDateSchema,
  days: z.number().int().min(1).max(120).default(30),
});

export const createTransactionInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  name: z.string().trim().min(1).max(200),
  amount: z.number().positive().max(999_999_999.99),
  purchaseDate: mcpDateSchema,
  dueDate: mcpDateSchema.nullish(),
  paymentDate: mcpDateSchema.nullish(),
  transactionType: z.enum(["Despesa", "Receita"]),
  paymentMethod: z.enum(LANCAMENTO_PAYMENT_METHODS),
  accountId: mcpUuidSchema.nullish(),
  cardId: mcpUuidSchema.nullish(),
  categoryId: mcpUuidSchema.nullish(),
  payerId: mcpUuidSchema.nullish(),
  note: z.string().trim().max(500).nullish(),
  settled: z.boolean().default(false),
});

export const updateTransactionInputSchema =
  createTransactionInputSchema.extend({
    transactionId: mcpUuidSchema,
  });

export const settleTransactionInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  transactionId: mcpUuidSchema,
  settled: z.boolean(),
  paymentDate: mcpDateSchema.optional(),
});

export const transferInputSchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    fromAccountId: mcpUuidSchema,
    toAccountId: mcpUuidSchema,
    amount: z.number().positive().max(999_999_999.99),
    date: mcpDateSchema,
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    message: "Source and destination accounts must be different.",
  });

export const deleteTransactionInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  transactionId: mcpUuidSchema,
  mode: mcpMutationModeSchema,
});

export const reverseTransferInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  transferId: mcpUuidSchema,
  mode: mcpMutationModeSchema,
});

export const payInvoiceInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  cardId: mcpUuidSchema,
  period: mcpPeriodSchema,
  paymentDate: mcpDateSchema.optional(),
  mode: mcpMutationModeSchema,
});

export const reverseInvoicePaymentInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  cardId: mcpUuidSchema,
  period: mcpPeriodSchema,
  mode: mcpMutationModeSchema,
});

/**
 * Which rows of a recurring/installment series a bulk edit or delete touches,
 * relative to the anchor transaction: only it, it plus every later period, or
 * the whole series. Mirrors the dashboard bulk actions.
 */
export const seriesScopeSchema = z.enum(["current", "future", "all"]);

export const updateSeriesInputSchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    transactionId: mcpUuidSchema,
    scope: seriesScopeSchema,
    mode: mcpMutationModeSchema,
    name: z.string().trim().min(1).max(200).optional(),
    amount: z.number().positive().max(999_999_999.99).optional(),
    categoryId: mcpUuidSchema.nullish(),
    payerId: mcpUuidSchema.nullish(),
    accountId: mcpUuidSchema.nullish(),
    cardId: mcpUuidSchema.nullish(),
    note: z.string().trim().max(500).nullish(),
    dueDate: mcpDateSchema.nullish(),
    boletoPaymentDate: mcpDateSchema.nullish(),
  })
  .refine(
    (value) =>
      [
        value.name,
        value.amount,
        value.categoryId,
        value.payerId,
        value.accountId,
        value.cardId,
        value.note,
        value.dueDate,
        value.boletoPaymentDate,
      ].some((field) => field !== undefined),
    { message: "Provide at least one field to update." }
  );

export const deleteSeriesInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  transactionId: mcpUuidSchema,
  scope: seriesScopeSchema,
  mode: mcpMutationModeSchema,
});

export const anticipateInstallmentsInputSchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    seriesId: mcpUuidSchema,
    /** Period the consolidated anticipation lançamento is recorded in. */
    anticipationPeriod: mcpPeriodSchema,
    // Exactly one selector for which eligible installments to anticipate.
    installmentIds: z.array(mcpUuidSchema).min(1).max(120).optional(),
    count: z.number().int().min(1).max(120).optional(),
    throughPeriod: mcpPeriodSchema.optional(),
    discount: z.number().min(0).max(999_999_999.99).optional(),
    payerId: mcpUuidSchema.optional(),
    categoryId: mcpUuidSchema.optional(),
    note: z.string().trim().max(500).optional(),
    mode: mcpMutationModeSchema,
  })
  .refine(
    (value) =>
      [value.installmentIds, value.count, value.throughPeriod].filter(
        (selector) => selector !== undefined
      ).length === 1,
    {
      message:
        "Provide exactly one of installmentIds, count, or throughPeriod.",
    }
  );

export const upsertBudgetInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  categoryId: mcpUuidSchema,
  period: mcpPeriodSchema,
  amount: z.number().min(0).max(999_999_999.99),
});

export type ListTransactionsInput = z.infer<
  typeof listTransactionsInputSchema
>;
export type CreateTransactionInput = z.infer<
  typeof createTransactionInputSchema
>;
export type UpdateTransactionInput = z.infer<
  typeof updateTransactionInputSchema
>;
export type SettleTransactionInput = z.infer<
  typeof settleTransactionInputSchema
>;
export type TransferInput = z.infer<typeof transferInputSchema>;
export type UpsertBudgetInput = z.infer<typeof upsertBudgetInputSchema>;
export type DeleteTransactionInput = z.infer<
  typeof deleteTransactionInputSchema
>;
export type ReverseTransferInput = z.infer<typeof reverseTransferInputSchema>;
export type AnticipateInstallmentsInput = z.infer<
  typeof anticipateInstallmentsInputSchema
>;
export type SeriesScope = z.infer<typeof seriesScopeSchema>;
export type UpdateSeriesInput = z.infer<typeof updateSeriesInputSchema>;
export type DeleteSeriesInput = z.infer<typeof deleteSeriesInputSchema>;
export type PayInvoiceInput = z.infer<typeof payInvoiceInputSchema>;
export type ReverseInvoicePaymentInput = z.infer<
  typeof reverseInvoicePaymentInputSchema
>;
