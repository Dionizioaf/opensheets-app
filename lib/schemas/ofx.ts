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
    bankId: z.string(),
    accountId: z.string(),
    accountType: z.string(),
    balance: z.number(),
    balanceDate: z.string(),
    currency: z.string(),
    transactions: z.array(z.object({
        id: z.string(),
        date: z.string(),
        amount: z.number(),
        type: z.string(),
        description: z.string(),
        memo: z.string().optional(),
        checkNum: z.string().optional(),
        refNum: z.string().optional(),
    })),
});

/**
 * Complete OFX file schema
 */
export const OfxFileSchema = z.object({
    bankName: z.string().optional(),
    accounts: z.array(OfxAccountSchema),
    dtStart: z.string(),
    dtEnd: z.string(),
    rawText: z.string(),
});

/**
 * Parsed OFX data type
 */
export type OfxTransaction = z.infer<typeof OfxTransactionSchema>;
export type OfxAccount = z.infer<typeof OfxAccountSchema>;
export type OfxFile = z.infer<typeof OfxFileSchema>;