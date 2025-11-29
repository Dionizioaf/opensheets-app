/**
 * Server actions for OFX import processing
 *
 * This module handles the complete OFX import workflow including:
 * - File parsing and validation
 * - Transaction processing and categorization
 * - Database insertion with proper relations
 * - Duplicate handling and conflict resolution
 * - Error handling and rollback capabilities
 */

"use server";

import { db } from "@/lib/db";
import { lancamentos } from "@/db/schema";
import { getUserId } from "@/lib/auth/server";
import { handleActionError, revalidateForEntity } from "@/lib/actions/helpers";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Import schemas and utilities
import { OfxFileSchema } from "@/lib/schemas/ofx";
import { categorizeTransaction } from "@/lib/utils/ai-categorization";
import { parseOfxFile } from "@/lib/ofx-parser/parser";
import { getErrorMessage } from "@/lib/ofx-parser/error-messages";

// Timeout for AI categorization requests (milliseconds)
const AI_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => void): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { onTimeout(); } catch {}
      resolve(undefined);
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(undefined);
      });
  });
}

// Types for import process
export interface ImportTransaction {
  date: string;
  amount: number;
  description: string;
  payee?: string;
  categoryId?: string;
  duplicateAction?: "skip" | "import" | "update";
  existingTransactionId?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  updated: number;
  errors: number;
  transactionIds: string[];
  message: string;
}

export interface ImportOptions {
  accountId: string;
  transactions: ImportTransaction[];
  fieldMappings: Record<string, string>;
  skipDuplicates: boolean;
  updateExisting: boolean;
}

/**
 * Main import action that processes OFX transactions
 */
export async function importOFXTransactionsAction(
  options: ImportOptions
): Promise<ImportResult> {
  try {
    const userId = await getUserId();

    const { accountId, transactions, fieldMappings, skipDuplicates, updateExisting } = options;

    // Zod validation for input
    const importOptionsSchema = z.object({
      accountId: z.string().min(1),
      transactions: z.array(
        z.object({
          date: z.string().min(1),
          amount: z.number(),
          description: z.string().min(1),
          payee: z.string().optional(),
          categoryId: z.string().optional(),
          duplicateAction: z.enum(["skip", "import", "update"]).optional(),
          existingTransactionId: z.string().optional(),
        })
      ),
      fieldMappings: z.record(z.string(), z.string()),
      skipDuplicates: z.boolean(),
      updateExisting: z.boolean(),
    });
    const parseResult = importOptionsSchema.safeParse(options);
    if (!parseResult.success) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        updated: 0,
        errors: 0,
        transactionIds: [],
        message: "Dados de importação inválidos",
      };
    }

    // Transaction count limit (999)
    if (transactions.length > 999) {
      const errorMsg = getErrorMessage("TRANSACTION_LIMIT_EXCEEDED");
      return {
        success: false,
        imported: 0,
        skipped: 0,
        updated: 0,
        errors: 0,
        transactionIds: [],
        message: `${errorMsg.title}: ${errorMsg.description}`,
      };
    }

    let imported = 0;
    let skipped = 0;
    let updated = 0;
    let errors = 0;
    const transactionIds: string[] = [];

    // All DB operations in a transaction for consistency
    await db.transaction(async (tx) => {
      for (const transaction of transactions) {
        try {
          // Skip duplicates if requested
          if (skipDuplicates && transaction.duplicateAction === "skip") {
            skipped++;
            continue;
          }

          // Update existing transaction if requested
          if (transaction.duplicateAction === "update" && transaction.existingTransactionId) {
            // Update existing transaction with all relevant relations
            await tx
              .update(lancamentos)
              .set({
                nome: transaction.description, // DB field is 'nome'
                valor: transaction.amount.toString(), // DB field is 'valor'
                data_compra: new Date(transaction.date), // DB field is 'data_compra'
                categoria_id: transaction.categoryId || null, // DB field is 'categoria_id'
                anotacao: transaction.payee || null, // DB field is 'anotacao'
                updated_at: new Date(), // DB field is 'updated_at'
                conta_id: accountId, // Ensure relation to account
                user_id: userId, // Ensure relation to user
              })
              .where(eq(lancamentos.id, transaction.existingTransactionId));
            updated++;
            transactionIds.push(transaction.existingTransactionId);
          } else {
            // Insert new transaction with all relations
            const result = await tx
              .insert(lancamentos)
              .values({
                user_id: userId,
                conta_id: accountId,
                categoria_id: transaction.categoryId || null,
                nome: transaction.description,
                valor: transaction.amount.toString(),
                data_compra: new Date(transaction.date),
                tipo_transacao: transaction.amount >= 0 ? "Receita" : "Despesa",
                condicao: "À vista",
                forma_pagamento: "Cartão de débito",
                anotacao: transaction.payee || null,
                realizado: true,
                created_at: new Date(),
                updated_at: new Date(),
              })
              .returning({ id: lancamentos.id });
            imported++;
            transactionIds.push(result[0].id);
          }
        } catch (error) {
          console.error("Error processing transaction:", error);
          errors++;
        }
      }
    });


    // Explicitly revalidate the 'lancamentos' entity after import to update UI and cache
    await revalidateForEntity("lancamentos");

    const totalProcessed = imported + skipped + updated + errors;
    const message = `Importação concluída: ${imported} importadas, ${updated} atualizadas, ${skipped} ignoradas, ${errors} erros de ${totalProcessed} transações`;

    return {
      success: true,
      imported,
      skipped,
      updated,
      errors,
      transactionIds,
      message,
    };
  } catch (error) {
    const handled = handleActionError(error);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      updated: 0,
      errors: 0,
      transactionIds: [],
      message: (handled as any)?.message || "Erro ao importar transações OFX",
    };
  }
}

/**
 * Parse and validate OFX file content
 */
export async function parseOFXFileAction(
  fileContent: string,
  accountId: string
): Promise<{
  success: boolean;
  transactions?: ImportTransaction[];
  warnings?: string[];
  error?: string;
}> {
  try {
    const userId = await getUserId();

    // Parse the OFX file
    let parsedData;
    try {
      parsedData = await parseOfxFile(fileContent);
      console.log("[OFX Action] parsedData:", JSON.stringify(parsedData, null, 2));
    } catch (err) {
      console.error("[OFX Action] parseOfxFile error:", err);
      throw err;
    }

    // Validate the parsed data
    const validationResult = OfxFileSchema.safeParse(parsedData);
    console.log("[OFX Action] validationResult.success:", validationResult.success);
    if (!validationResult.success) {
      console.error("[OFX Action] validation errors:", validationResult.error);
      const errorMsg = getErrorMessage("PARSE_INVALID_FORMAT");
      return {
        success: false,
        error: `${errorMsg.title}: ${errorMsg.description}`,
      };
    }

    // Sanitize & filter incomplete transactions
    const warnings: string[] = [];
    const sanitized: ImportTransaction[] = [];
    let skippedCount = 0;
    for (const tx of parsedData.transactions) {
      if (!tx.date || typeof tx.amount !== "number") {
        skippedCount++;
        continue; // Skip invalid core data
      }
      let description = tx.description?.trim();
      if (!description) {
        description = "Sem descrição"; // Default description
        warnings.push("Descrição ausente substituída por 'Sem descrição'.");
      }
      sanitized.push({
        date: tx.date,
        amount: tx.amount,
        description,
        payee: tx.payee?.trim() || undefined,
      });
    }
    if (skippedCount > 0) {
      warnings.push(`${skippedCount} transação(ões) inválida(s) ignorada(s) (faltando data ou valor).`);
    }
    if (sanitized.length === 0) {
      const errorMsg = getErrorMessage("PARSE_NO_TRANSACTIONS");
      return { success: false, error: `${errorMsg.title}: ${errorMsg.description}` };
    }
    return { success: true, transactions: sanitized, warnings };
  } catch (error) {
    console.error("Error parsing OFX file:", error);
    const errorMsg = getErrorMessage("PARSE_FAILED");
    return {
      success: false,
      error: `${errorMsg.title}: ${errorMsg.description}`,
    };
  }
}

/**
 * Get AI categorization suggestions for transactions
 */
export async function categorizeTransactionsAction(
  transactions: Array<{
    description: string;
    amount: number;
    date: string;
  }>,
  availableCategories: Array<{
    id: string;
    name: string;
    type: "despesa" | "receita";
  }>
): Promise<{
  success: boolean;
  categorizations?: Array<{
    transactionIndex: number;
    suggestions: Array<{
      categoryId: string;
      categoryName: string;
      confidence: number;
    }>;
  }>;
  warnings?: string[];
  error?: string;
}> {
  try {
    const userId = await getUserId();
    const timeoutWarnings: string[] = [];
    const categorizations = await Promise.all(
      transactions.map(async (tx, index) => {
        try {
          const result = await withTimeout(
            categorizeTransaction(
              tx.description,
              tx.amount,
              availableCategories,
              "gpt-4", // Default model, could be configurable
              userId
            ),
            AI_TIMEOUT_MS,
            () => {
              timeoutWarnings.push(`Categorização com IA excedeu o tempo para a transação #${index + 1}.`);
            }
          );

          return {
            transactionIndex: index,
            suggestions: result && (result as any).primarySuggestion
              ? [(result as any).primarySuggestion, ...(result as any).alternativeSuggestions]
              : [],
          };
        } catch (error) {
          console.error(`Error categorizing transaction ${index}:`, error);
          return {
            transactionIndex: index,
            suggestions: [],
          };
        }
      })
    );
    const failedCount = categorizations.filter(c => c.suggestions.length === 0).length;
    const warnings: string[] = [];
    if (failedCount > 0) {
      warnings.push(`${failedCount} transação(ões) sem sugestão de categoria da IA. Use seleção manual.`);
    }
    if (timeoutWarnings.length > 0) {
      warnings.push(...timeoutWarnings);
    }
    return {
      success: true,
      categorizations,
      warnings,
    };
  } catch (error) {
    console.error("Error in bulk categorization:", error);
    return {
      success: false,
      error: "Erro ao categorizar transações",
    };
  }
}

/**
 * Validate import data before processing
 */
export async function validateImportDataAction(
  options: ImportOptions
): Promise<{
  success: boolean;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const userId = await getUserId();

    // Validate account exists and belongs to user
    const account = await db.query.contas.findFirst({
      where: (contas, { eq, and }) =>
        and(eq(contas.id, options.accountId), eq(contas.userId, userId)),
    });
    if (!account) {
      errors.push("Conta não encontrada ou sem permissão de acesso");
    }

    // Validate transactions array
    if (!options.transactions || !Array.isArray(options.transactions) || options.transactions.length === 0) {
      errors.push("Nenhuma transação para importar");
    } else {
      // Validate each transaction for required fields
      options.transactions.forEach((tx, idx) => {
        if (!tx.date || !tx.description || typeof tx.amount !== "number") {
          errors.push(`Transação #${idx + 1} está incompleta (data, descrição ou valor ausente)`);
        }
      });

      // Check for transactions without categories
      const uncategorized = options.transactions.filter(tx => !tx.categoryId);
      if (uncategorized.length > 0) {
        warnings.push(`${uncategorized.length} transações sem categoria definida`);
      }

      // Check for potential duplicates not handled
      const unhandledDuplicates = options.transactions.filter(
        tx => tx.duplicateAction === undefined && (tx.isDuplicate === true)
      );
      if (unhandledDuplicates.length > 0) {
        warnings.push(`${unhandledDuplicates.length} duplicatas não resolvidas`);
      }

      // Check for invalid duplicateAction values
      options.transactions.forEach((tx, idx) => {
        if (tx.isDuplicate && !["skip", "import", "update"].includes(tx.duplicateAction || "")) {
          warnings.push(`Transação duplicada #${idx + 1} sem ação de resolução definida`);
        }
      });
    }

    // Validate fieldMappings
    if (!options.fieldMappings || typeof options.fieldMappings !== "object") {
      errors.push("Mapeamento de campos ausente ou inválido");
    }

    return {
      success: true,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    console.error("Error validating import data:", error);
    return {
      success: false,
      isValid: false,
      errors: ["Erro interno de validação"],
      warnings: [],
    };
  }
}