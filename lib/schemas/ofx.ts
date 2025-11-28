import { z } from "zod";

/**
 * OFX (Open Financial Exchange) data schemas
 * Based on ofx-data-extractor library output
 */

/**
 * Individual OFX transaction schema
 */
export const OfxTransactionSchema = z.object({
    // Date when transaction was posted (required)
    date: z.string().refine((value) => !isNaN(Date.parse(value)), {
        message: "Data da transação inválida.",
    }),

    // Transaction amount (required, can be positive or negative)
    amount: z.number({
        message: "Valor da transação é obrigatório.",
    }),

    // Transaction description/memo (optional)
    description: z.string().optional(),

    // Payee name (optional)
    payee: z.string().optional(),

    // Transaction type (debit/credit, optional)
    type: z.enum(["debit", "credit"]).optional(),

    // Transaction ID (optional, for duplicate detection)
    id: z.string().optional(),

    // Check number (optional)
    checkNumber: z.string().optional(),

    // Reference number (optional)
    refNumber: z.string().optional(),
});

/**
 * OFX file/account information schema
 */
export const OfxAccountSchema = z.object({
    // Account ID
    accountId: z.string().optional(),

    // Account type (checking, savings, etc.)
    accountType: z.string().optional(),

    // Bank ID
    bankId: z.string().optional(),

    // Currency
    currency: z.string().optional(),
});

/**
 * Complete OFX file schema
 */
export const OfxFileSchema = z.object({
    // Account information
    account: OfxAccountSchema.optional(),

    // Array of transactions
    transactions: z.array(OfxTransactionSchema),

    // File metadata
    startDate: z.string().optional(),
    endDate: z.string().optional(),
});

/**
 * Parsed OFX data type
 */
export type OfxTransaction = z.infer<typeof OfxTransactionSchema>;
export type OfxAccount = z.infer<typeof OfxAccountSchema>;
export type OfxFile = z.infer<typeof OfxFileSchema>;