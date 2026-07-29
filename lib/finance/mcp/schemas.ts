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
