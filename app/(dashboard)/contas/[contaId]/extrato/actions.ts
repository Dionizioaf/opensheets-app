"use server";

import { getUser } from "@/lib/auth/server";
import { handleActionError, revalidateForEntity } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { errorResult, successResult } from "@/lib/actions/types";
import { parseOfxFile } from "@/lib/ofx/parser";
import { mapOfxTransactionsToLancamentos } from "@/lib/ofx/mapper";
import type { ParsedOfxTransaction, OfxParsingError } from "@/lib/ofx/types";
import {
    suggestCategoriesForTransactions,
    type CategorySuggestion,
} from "@/lib/ofx/category-suggester";
import {
    detectDuplicatesBatch,
    type DuplicateMatch,
} from "@/lib/ofx/duplicate-detector";
import { db } from "@/lib/db";
import { contas, lancamentos } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

/**
 * Server actions for OFX import functionality
 * Located in account statement context for import operations
 */

// ===================== RATE LIMITING =====================

/**
 * Rate limit configuration for OFX imports
 * Reads from environment variables with fallback defaults
 */
const RATE_LIMIT_MAX_IMPORTS = parseInt(
    process.env.OFX_RATE_LIMIT_MAX_IMPORTS || "60",
    10
);
const RATE_LIMIT_WINDOW_MS = parseInt(
    process.env.OFX_RATE_LIMIT_WINDOW_MS || "1800000",
    10
); // Default: 1 hour in milliseconds

/**
 * In-memory store for rate limiting
 * Maps userId to array of import timestamps
 */
const importAttemptsStore = new Map<string, number[]>();

/**
 * Check if user has exceeded rate limit for OFX imports
 * @param userId - User ID to check
 * @returns true if rate limit exceeded, false otherwise
 */
function isRateLimitExceeded(userId: string): boolean {
    const now = Date.now();
    const attempts = importAttemptsStore.get(userId) || [];

    // Filter out attempts older than the rate limit window
    const recentAttempts = attempts.filter(
        (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
    );

    // Update store with only recent attempts
    if (recentAttempts.length === 0) {
        importAttemptsStore.delete(userId);
    } else {
        importAttemptsStore.set(userId, recentAttempts);
    }

    return recentAttempts.length >= RATE_LIMIT_MAX_IMPORTS;
}

/**
 * Record an import attempt for rate limiting
 * @param userId - User ID to record
 */
function recordImportAttempt(userId: string): void {
    const now = Date.now();
    const attempts = importAttemptsStore.get(userId) || [];

    // Add current attempt
    attempts.push(now);

    // Keep only recent attempts
    const recentAttempts = attempts.filter(
        (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
    );

    importAttemptsStore.set(userId, recentAttempts);
}

/**
 * Get remaining imports count for user
 * @param userId - User ID to check
 * @returns Number of imports remaining in current window
 */
function getRemainingImports(userId: string): number {
    const now = Date.now();
    const attempts = importAttemptsStore.get(userId) || [];

    const recentAttempts = attempts.filter(
        (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
    );

    return Math.max(0, RATE_LIMIT_MAX_IMPORTS - recentAttempts.length);
}

// ===================== ERROR HANDLING =====================

/**
 * Check if error is an OFX parsing error with specific error codes
 */
function isOfxParsingError(error: unknown): error is OfxParsingError {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        "message" in error
    );
}

/**
 * Get user-friendly error message for OFX parsing errors
 */
function getOfxErrorMessage(error: OfxParsingError): string {
    const errorMessages: Record<OfxParsingError["code"], string> = {
        INVALID_FILE: "Arquivo OFX inválido. Verifique se o arquivo está correto.",
        PARSE_ERROR:
            "Erro ao processar o arquivo OFX. O formato pode estar corrompido.",
        NO_TRANSACTIONS: "Nenhuma transação encontrada no arquivo OFX.",
        UNSUPPORTED_VERSION:
            "Versão do arquivo OFX não suportada. Tente exportar em outro formato.",
    };

    return errorMessages[error.code] || error.message;
}

// Validation schemas
const parseOfxFileSchema = z.object({
    fileContent: z
        .string({ message: "Conteúdo do arquivo é obrigatório" })
        .min(1, "Arquivo OFX vazio"),
});

const suggestCategoriesSchema = z.object({
    contaId: z.string().uuid("ID da conta inválido"),
    transactions: z
        .array(
            z.object({
                id: z.string(),
                nome: z.string(),
                valor: z.string(),
                tipo_transacao: z.string(),
            })
        )
        .min(1, "Lista de transações vazia"),
});

const detectDuplicatesSchema = z.object({
    contaId: z.string().uuid("ID da conta inválido"),
    transactions: z
        .array(
            z.object({
                id: z.string(),
                nome: z.string(),
                valor: z.string(),
                data_compra: z.date(),
                fitId: z.string().optional(),
            })
        )
        .min(1, "Lista de transações vazia"),
});

const importTransactionsSchema = z.object({
    contaId: z.string().uuid("ID da conta inválido"),
    transactions: z
        .array(
            z.object({
                nome: z.string().min(1, "Nome da transação obrigatório"),
                valor: z.string().regex(/^\d+\.\d{2}$/, "Valor inválido"),
                data_compra: z.date({ message: "Data da compra obrigatória" }),
                tipo_transacao: z.enum(["Despesa", "Receita"]),
                forma_pagamento: z.string().min(1, "Forma de pagamento obrigatória"),
                condicao: z.string().min(1, "Condição obrigatória"),
                periodo: z
                    .string()
                    .regex(/^\d{4}-\d{2}$/, "Período deve estar no formato YYYY-MM"),
                anotacao: z.string().optional(),
                fitId: z.string().optional(),
                categoriaId: z.string().uuid().optional().or(z.literal(undefined)),
                pagadorId: z.string().uuid().optional().or(z.literal(undefined)),
            })
        )
        .min(1, "Lista de transações vazia")
        .max(1000, "Máximo de 1000 transações por importação"),
    defaults: z
        .object({
            categoriaId: z.string().uuid().optional().or(z.literal(undefined)),
            pagadorId: z.string().uuid().optional().or(z.literal(undefined)),
            metodoPagamento: z.string().optional().or(z.literal(undefined)),
        })
        .optional()
        .default({}),
});

/**
 * Parse OFX file and return transactions
 * Server action for parsing OFX file content
 * 
 * @param fileContent - Raw OFX file content as string
 * @returns Parsed transactions or error
 */
export async function parseOfxFileAction(
    fileContent: string
): Promise<ActionResult<ParsedOfxTransaction[]>> {
    try {
        // Validate user authentication
        const user = await getUser();
        if (!user) {
            return errorResult("Usuário não autenticado") as ActionResult<
                ParsedOfxTransaction[]
            >;
        }

        // Validate input
        const validation = parseOfxFileSchema.safeParse({ fileContent });
        if (!validation.success) {
            return errorResult(
                validation.error.issues[0]?.message ?? "Dados inválidos"
            ) as ActionResult<ParsedOfxTransaction[]>;
        }

        // Server-side file size validation (approximate - 5MB limit)
        const fileSizeInBytes = new TextEncoder().encode(fileContent).length;
        const maxSizeInBytes = 5 * 1024 * 1024; // 5MB

        if (fileSizeInBytes > maxSizeInBytes) {
            return errorResult(
                "Arquivo muito grande. Tamanho máximo: 5MB"
            ) as ActionResult<ParsedOfxTransaction[]>;
        }

        // Parse OFX file
        const statement = await parseOfxFile(fileContent);

        // Map OFX transactions to lancamento format
        const parsedTransactions = mapOfxTransactionsToLancamentos(
            statement.transactions
        );

        if (parsedTransactions.length === 0) {
            return errorResult(
                "Nenhuma transação encontrada no arquivo OFX"
            ) as ActionResult<ParsedOfxTransaction[]>;
        }

        return successResult(
            `${parsedTransactions.length} transações encontradas`,
            parsedTransactions
        );
    } catch (error) {
        // Handle OFX-specific parsing errors with user-friendly messages
        if (isOfxParsingError(error)) {
            return errorResult(getOfxErrorMessage(error)) as ActionResult<
                ParsedOfxTransaction[]
            >;
        }

        return handleActionError(error) as ActionResult<ParsedOfxTransaction[]>;
    }
}

/**
 * Suggest categories for OFX transactions
 * Server action for getting category suggestions based on historical data
 * 
 * @param contaId - Account ID to verify ownership
 * @param transactions - Array of transactions to get suggestions for
 * @returns Map of transaction ID to category suggestion
 */
export async function suggestCategoriesForOfxAction(
    contaId: string,
    transactions: Array<{
        id: string;
        nome: string;
        valor: string;
        tipo_transacao: string;
    }>
): Promise<ActionResult<Map<string, CategorySuggestion>>> {
    try {
        // Validate user authentication
        const user = await getUser();
        if (!user) {
            return errorResult("Usuário não autenticado") as ActionResult<
                Map<string, CategorySuggestion>
            >;
        }

        // Validate input
        const validation = suggestCategoriesSchema.safeParse({
            contaId,
            transactions,
        });
        if (!validation.success) {
            return errorResult(
                validation.error.issues[0]?.message ?? "Dados inválidos"
            ) as ActionResult<Map<string, CategorySuggestion>>;
        }

        // Verify user owns the account
        const account = await db.query.contas.findFirst({
            where: and(eq(contas.id, contaId), eq(contas.userId, user.id)),
            columns: { id: true },
        });

        if (!account) {
            return errorResult(
                "Conta não encontrada ou você não tem permissão para acessá-la"
            ) as ActionResult<Map<string, CategorySuggestion>>;
        }

        // Get category suggestions for all transactions
        const suggestions = await suggestCategoriesForTransactions(
            user.id,
            transactions.map((t) => ({
                id: t.id,
                name: t.nome,
                amount: t.valor,
                transactionType: t.tipo_transacao,
            }))
        );

        return successResult(
            `Sugestões geradas para ${suggestions.size} transações`,
            suggestions
        );
    } catch (error) {
        return handleActionError(error) as ActionResult<
            Map<string, CategorySuggestion>
        >;
    }
}

/**
 * Detect duplicate OFX transactions
 * Server action for detecting potential duplicates in existing transactions
 * 
 * @param contaId - Account ID to verify ownership
 * @param transactions - Array of transactions to check for duplicates
 * @returns Map of transaction ID to duplicate matches
 */
export async function detectOfxDuplicatesAction(
    contaId: string,
    transactions: Array<{
        id: string;
        nome: string;
        valor: string;
        data_compra: Date;
        fitId?: string;
    }>
): Promise<ActionResult<Map<string, DuplicateMatch[]>>> {
    try {
        // Validate user authentication
        const user = await getUser();
        if (!user) {
            return errorResult("Usuário não autenticado") as ActionResult<
                Map<string, DuplicateMatch[]>
            >;
        }

        // Validate input
        const validation = detectDuplicatesSchema.safeParse({
            contaId,
            transactions,
        });
        if (!validation.success) {
            return errorResult(
                validation.error.issues[0]?.message ?? "Dados inválidos"
            ) as ActionResult<Map<string, DuplicateMatch[]>>;
        }

        // Verify user owns the account
        const account = await db.query.contas.findFirst({
            where: and(eq(contas.id, contaId), eq(contas.userId, user.id)),
            columns: { id: true },
        });

        if (!account) {
            return errorResult(
                "Conta não encontrada ou você não tem permissão para acessá-la"
            ) as ActionResult<Map<string, DuplicateMatch[]>>;
        }

        // Detect duplicates for all transactions in batch
        const duplicates = await detectDuplicatesBatch(
            user.id,
            contaId,
            transactions.map((t) => ({
                id: t.id,
                nome: t.nome,
                valor: t.valor,
                purchaseDate: t.data_compra,
                fitId: t.fitId,
            }))
        );

        // Count transactions with duplicates
        const duplicateCount = Array.from(duplicates.values()).filter(
            (matches) => matches.length > 0
        ).length;

        return successResult(
            `${duplicateCount} transações com possíveis duplicatas encontradas`,
            duplicates
        );
    } catch (error) {
        return handleActionError(error) as ActionResult<
            Map<string, DuplicateMatch[]>
        >;
    }
}

// OFX import actions will be implemented in subsequent tasks:
// - importOfxTransactionsAction() - Task 5.5

/**
 * Import OFX transactions to database
 * Server action for batch importing transactions with database transaction
 *
 * @param contaId - Target account UUID
 * @param transactions - Array of parsed OFX transactions to import
 * @param defaults - Default values for categoriaId, pagadorId, metodoPagamento
 * @returns Success result with imported count or error
 */
export async function importOfxTransactionsAction(
    contaId: string,
    transactions: Array<{
        nome: string;
        valor: string;
        data_compra: Date;
        tipo_transacao: "Despesa" | "Receita";
        forma_pagamento: string;
        condicao: string;
        periodo: string;
        anotacao?: string;
        fitId?: string;
        categoriaId?: string;
        pagadorId?: string;
    }>,
    defaults: {
        categoriaId?: string;
        pagadorId?: string;
        metodoPagamento?: string;
    }
): Promise<ActionResult<{ importedCount: number }>> {
    try {
        console.log("[OFX Import] Starting import", {
            contaId,
            transactionCount: transactions.length,
            defaults,
            sampleTransaction: transactions[0]
        });

        // Validate user authentication
        const user = await getUser();
        if (!user) {
            return errorResult("Usuário não autenticado") as ActionResult<{
                importedCount: number;
            }>;
        }

        // Check rate limit before processing
        if (isRateLimitExceeded(user.id)) {
            const remaining = getRemainingImports(user.id);
            return errorResult(
                `Limite de importações excedido. Você atingiu o máximo de ${RATE_LIMIT_MAX_IMPORTS} importações por hora. Tente novamente mais tarde.`
            ) as ActionResult<{ importedCount: number }>;
        }

        // Validate input
        const validation = importTransactionsSchema.safeParse({
            contaId,
            transactions,
            defaults,
        });
        if (!validation.success) {
            console.error("[OFX Import] Validation failed", {
                errors: validation.error.issues
            });
            return errorResult(
                validation.error.issues[0]?.message ?? "Dados inválidos"
            ) as ActionResult<{ importedCount: number }>;
        }

        // Verify account ownership
        const conta = await db.query.contas.findFirst({
            where: and(eq(contas.id, contaId), eq(contas.userId, user.id)),
        });

        if (!conta) {
            return errorResult(
                "Conta não encontrada ou você não tem permissão para acessá-la"
            ) as ActionResult<{ importedCount: number }>;
        }

        // Filter out transactions with duplicate FITIDs
        // Check existing lancamentos for FITIDs in notes field
        const transactionsWithFitId = transactions.filter((t) => t.fitId);
        let skippedDuplicates = 0;
        let transactionsToImport = transactions;

        if (transactionsWithFitId.length > 0) {
            // Query existing lancamentos for this account that might have FITIDs
            const existingLancamentos = await db.query.lancamentos.findMany({
                where: and(eq(lancamentos.contaId, contaId), eq(lancamentos.userId, user.id)),
                columns: {
                    id: true,
                    note: true,
                },
            });

            // Extract FITIDs from existing notes
            const existingFitIds = new Set<string>();
            for (const lancamento of existingLancamentos) {
                if (lancamento.note) {
                    // Match FITID pattern: "FITID: {value}"
                    const fitIdMatch = lancamento.note.match(/FITID:\s*([^\s|]+)/);
                    if (fitIdMatch && fitIdMatch[1]) {
                        existingFitIds.add(fitIdMatch[1]);
                    }
                }
            }

            // Filter out transactions with existing FITIDs
            transactionsToImport = transactions.filter((t) => {
                if (t.fitId && existingFitIds.has(t.fitId)) {
                    skippedDuplicates++;
                    return false; // Skip this transaction
                }
                return true; // Keep this transaction
            });

            // If all transactions are duplicates, return early
            if (transactionsToImport.length === 0) {
                return errorResult(
                    "Todas as transações já foram importadas anteriormente (FITIDs duplicados)"
                ) as ActionResult<{ importedCount: number }>;
            }
        }

        // Use database transaction for atomic batch insert
        let importedCount: number;
        try {
            importedCount = await db.transaction(async (tx: typeof db) => {
                // Transform transactions to lancamentos format
                const lancamentosToInsert = transactionsToImport.map((t) => {
                    const categoriaId = t.categoriaId ?? defaults.categoriaId;
                    const pagadorId = t.pagadorId ?? defaults.pagadorId;
                    const formaPagamento =
                        t.forma_pagamento ?? defaults.metodoPagamento ?? "Cartão de débito";

                    // Add import metadata to note
                    const importTimestamp = new Date().toISOString();
                    const fitIdNote = t.fitId ? `FITID: ${t.fitId}` : "";
                    const importNote = `Importado via OFX em ${importTimestamp}`;
                    const originalNote = t.anotacao ?? "";
                    const combinedNote = [fitIdNote, importNote, originalNote]
                        .filter(Boolean)
                        .join(" | ");

                    return {
                        name: t.nome,
                        amount: t.valor,
                        purchaseDate: t.data_compra,
                        transactionType: t.tipo_transacao,
                        paymentMethod: formaPagamento,
                        condition: t.condicao,
                        period: t.periodo,
                        note: combinedNote,
                        isSettled: true, // Always true for OFX imports
                        contaId: contaId,
                        categoriaId: categoriaId ?? null,
                        pagadorId: pagadorId ?? null,
                        userId: user.id,
                        // Optional fields set to null
                        cartaoId: null,
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
            // Handle database transaction errors with specific message
            console.error("[OFX Import] Database error", dbError);
            return errorResult(
                "Erro ao salvar transações no banco de dados. Tente novamente."
            ) as ActionResult<{ importedCount: number }>;
        }

        console.log("[OFX Import] Successfully imported", {
            importedCount,
            contaId
        });

        // Revalidate lancamentos pages
        revalidateForEntity("lancamentos");

        // Record successful import attempt for rate limiting
        recordImportAttempt(user.id);

        // Build success message
        let message = `${importedCount} ${importedCount === 1 ? "transação importada" : "transações importadas"} com sucesso`;

        if (skippedDuplicates > 0) {
            message += `. ${skippedDuplicates} ${skippedDuplicates === 1 ? "transação duplicada foi ignorada" : "transações duplicadas foram ignoradas"}`;
        }

        return successResult(message, { importedCount });
    } catch (error) {
        console.error("[OFX Import] Unexpected error", error);
        return handleActionError(error) as ActionResult<{
            importedCount: number;
        }>;
    }
}
