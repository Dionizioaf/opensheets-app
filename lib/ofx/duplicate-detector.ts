import { db } from "@/lib/db";
import { lancamentos } from "@/db/schema";
import { eq, and, between, gte, lte } from "drizzle-orm";
import Fuzzysort from "fuzzysort";

/**
 * Match reason for duplicate detection
 */
export type MatchReason =
    | "fitid" // Exact FITID match in notes
    | "exact" // Exact date + amount + name match
    | "similar" // Similar date (±3 days) + exact amount + similar description (>80%)
    | "likely"; // Similar date + exact amount + somewhat similar description (>60%)

/**
 * Duplicate match result
 */
export interface DuplicateMatch {
    lancamentoId: string;
    matchReason: MatchReason;
    similarity: number; // 0-1, how similar the descriptions are
    existingTransaction: {
        nome: string;
        valor: string;
        purchaseDate: Date;
        anotacao: string | null;
    };
}

/**
 * Minimum similarity thresholds for duplicate detection
 */
const SIMILARITY_THRESHOLDS = {
    HIGH: 0.8, // 80% similarity for "similar" matches
    MEDIUM: 0.6, // 60% similarity for "likely" matches
};

/**
 * Date tolerance in days for duplicate detection
 */
const DATE_TOLERANCE_DAYS = 3;

/**
 * Detect potential duplicate transactions in the database
 *
 * @param userId - User ID who owns the transactions
 * @param contaId - Account ID to check for duplicates
 * @param transactionName - Name/description of the transaction
 * @param transactionAmount - Amount of the transaction (as decimal string)
 * @param transactionDate - Date of the transaction
 * @param fitId - Optional FITID from OFX file
 * @returns Array of potential duplicate matches, ordered by match quality
 */
export async function detectDuplicates(
    userId: string,
    contaId: string,
    transactionName: string,
    transactionAmount: string,
    transactionDate: Date,
    fitId?: string
): Promise<DuplicateMatch[]> {
    const matches: DuplicateMatch[] = [];

    // Normalize input
    const normalizedName = transactionName.trim().toLowerCase();

    if (!normalizedName || normalizedName.length < 3) {
        return []; // Too short to match reliably
    }

    // Calculate date range (±3 days)
    const startDate = new Date(transactionDate);
    startDate.setDate(startDate.getDate() - DATE_TOLERANCE_DAYS);

    const endDate = new Date(transactionDate);
    endDate.setDate(endDate.getDate() + DATE_TOLERANCE_DAYS);

    // Query existing transactions for the same account with similar dates and amounts
    const existingTransactions = await db.query.lancamentos.findMany({
        columns: {
            id: true,
            nome: true,
            valor: true,
            purchaseDate: true,
            anotacao: true,
        },
        where: and(
            eq(lancamentos.userId, userId),
            eq(lancamentos.contaId, contaId),
            eq(lancamentos.amount, transactionAmount),
            gte(lancamentos.purchaseDate, startDate),
            lte(lancamentos.purchaseDate, endDate)
        ),
        limit: 100, // Reasonable limit for duplicate checking
    });

    if (existingTransactions.length === 0) {
        return [];
    }

    // Check each existing transaction for duplicates
    for (const existing of existingTransactions) {
        // Priority 1: Check for FITID match in notes
        if (fitId && existing.anotacao) {
            const fitIdPattern = new RegExp(`FITID:\\s*${fitId}`, "i");
            if (fitIdPattern.test(existing.anotacao)) {
                matches.push({
                    lancamentoId: existing.id,
                    matchReason: "fitid",
                    similarity: 1.0,
                    existingTransaction: {
                        nome: existing.nome,
                        valor: existing.valor,
                        purchaseDate: existing.purchaseDate,
                        anotacao: existing.anotacao,
                    },
                });
                continue; // FITID is definitive, skip other checks
            }
        }

        const existingNormalized = existing.nome.trim().toLowerCase();
        const daysDifference = Math.abs(
            Math.floor(
                (transactionDate.getTime() - existing.purchaseDate.getTime()) /
                (1000 * 60 * 60 * 24)
            )
        );

        // Priority 2: Exact match (same date, amount, and name)
        if (daysDifference === 0 && normalizedName === existingNormalized) {
            matches.push({
                lancamentoId: existing.id,
                matchReason: "exact",
                similarity: 1.0,
                existingTransaction: {
                    nome: existing.nome,
                    valor: existing.valor,
                    purchaseDate: existing.purchaseDate,
                    anotacao: existing.anotacao,
                },
            });
            continue;
        }

        // Priority 3: Fuzzy match with high similarity
        const fuzzyResult = Fuzzysort.single(normalizedName, existingNormalized);

        if (fuzzyResult) {
            // Normalize score to 0-1 range (fuzzysort scores are negative, lower is better)
            // Convert to similarity: perfect match = 0 → 1.0, poor match = -1000 → 0
            const normalizedScore = Math.max(
                0,
                Math.min(1, (fuzzyResult.score + 1000) / 1000)
            );

            // High similarity match (>80%)
            if (normalizedScore >= SIMILARITY_THRESHOLDS.HIGH) {
                matches.push({
                    lancamentoId: existing.id,
                    matchReason: "similar",
                    similarity: normalizedScore,
                    existingTransaction: {
                        nome: existing.nome,
                        valor: existing.valor,
                        purchaseDate: existing.purchaseDate,
                        anotacao: existing.anotacao,
                    },
                });
            }
            // Medium similarity match (>60%)
            else if (normalizedScore >= SIMILARITY_THRESHOLDS.MEDIUM) {
                matches.push({
                    lancamentoId: existing.id,
                    matchReason: "likely",
                    similarity: normalizedScore,
                    existingTransaction: {
                        nome: existing.nome,
                        valor: existing.valor,
                        purchaseDate: existing.purchaseDate,
                        anotacao: existing.anotacao,
                    },
                });
            }
        }
    }

    // Sort by match quality: fitid > exact > similar > likely, then by similarity
    matches.sort((a, b) => {
        const matchPriority = { fitid: 4, exact: 3, similar: 2, likely: 1 };
        const priorityDiff =
            matchPriority[b.matchReason] - matchPriority[a.matchReason];

        if (priorityDiff !== 0) return priorityDiff;

        return b.similarity - a.similarity;
    });

    return matches;
}

/**
 * Check multiple transactions for duplicates in a single batch
 * More efficient than calling detectDuplicates multiple times
 *
 * @param userId - User ID who owns the transactions
 * @param contaId - Account ID to check for duplicates
 * @param transactions - Array of transactions to check
 * @returns Map of transaction IDs to their duplicate matches
 */
export async function detectDuplicatesBatch(
    userId: string,
    contaId: string,
    transactions: Array<{
        id: string;
        nome: string;
        valor: string;
        purchaseDate: Date;
        fitId?: string;
    }>
): Promise<Map<string, DuplicateMatch[]>> {
    const results = new Map<string, DuplicateMatch[]>();

    if (transactions.length === 0) {
        return results;
    }

    // Find the date range that covers all transactions
    const allDates = transactions.map((t) => t.purchaseDate.getTime());
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));

    // Expand by tolerance
    minDate.setDate(minDate.getDate() - DATE_TOLERANCE_DAYS);
    maxDate.setDate(maxDate.getDate() + DATE_TOLERANCE_DAYS);

    // Get all amounts to check
    const amounts = [...new Set(transactions.map((t) => t.valor))];

    // Single query to fetch all potentially matching transactions
    const existingTransactions = await db.query.lancamentos.findMany({
        columns: {
            id: true,
            name: true,
            amount: true,
            purchaseDate: true,
            note: true,
        },
        where: and(
            eq(lancamentos.userId, userId),
            eq(lancamentos.contaId, contaId),
            gte(lancamentos.purchaseDate, minDate),
            lte(lancamentos.purchaseDate, maxDate)
        ),
        limit: 500, // Reasonable limit for batch checking
    });

    console.log("[Duplicate Detector] Query results", {
        userId,
        contaId,
        dateRange: { minDate, maxDate },
        amounts,
        existingCount: existingTransactions.length,
        sampleExisting: existingTransactions[0]
    });

    // Filter by amounts (since we can't use IN clause easily with Drizzle)
    const filteredTransactions = existingTransactions.filter(
        (t: typeof existingTransactions[0]) => amounts.includes(t.amount)
    );

    console.log("[Duplicate Detector] After amount filter", {
        filteredCount: filteredTransactions.length
    });

    // Check each input transaction against existing ones
    for (const transaction of transactions) {
        const matches: DuplicateMatch[] = [];
        const normalizedName = transaction.nome.trim().toLowerCase();

        if (normalizedName.length < 3) {
            results.set(transaction.id, []);
            continue;
        }

        const transactionTime = transaction.purchaseDate.getTime();

        for (const existing of filteredTransactions) {
            // Skip if amount doesn't match
            if (existing.amount !== transaction.valor) continue;

            // Calculate date difference
            const daysDifference = Math.abs(
                Math.floor(
                    (transactionTime - existing.purchaseDate.getTime()) /
                    (1000 * 60 * 60 * 24)
                )
            );

            // Skip if outside date tolerance
            if (daysDifference > DATE_TOLERANCE_DAYS) continue;

            // Check for FITID match
            if (transaction.fitId && existing.note) {
                const fitIdPattern = new RegExp(
                    `FITID:\\s*${transaction.fitId}`,
                    "i"
                );

                console.log("[Duplicate Detector] Checking FITID", {
                    transactionId: transaction.id,
                    transactionName: transaction.nome,
                    fitId: transaction.fitId,
                    existingId: existing.id,
                    existingNote: existing.note,
                    patternMatches: fitIdPattern.test(existing.note)
                });

                if (fitIdPattern.test(existing.note)) {
                    console.log("[Duplicate Detector] FITID match found!", {
                        transactionId: transaction.id,
                        existingId: existing.id
                    });
                    matches.push({
                        lancamentoId: existing.id,
                        matchReason: "fitid",
                        similarity: 1.0,
                        existingTransaction: {
                            nome: existing.nome,
                            valor: existing.valor,
                            purchaseDate: existing.purchaseDate,
                            anotacao: existing.anotacao,
                        },
                    });
                    continue;
                }
            }

            const existingNormalized = existing.name.trim().toLowerCase();

            // Check for exact match
            if (daysDifference === 0 && normalizedName === existingNormalized) {
                matches.push({
                    lancamentoId: existing.id,
                    matchReason: "exact",
                    similarity: 1.0,
                    existingTransaction: {
                        nome: existing.nome,
                        valor: existing.valor,
                        purchaseDate: existing.purchaseDate,
                        anotacao: existing.anotacao,
                    },
                });
                continue;
            }

            // Fuzzy match
            const fuzzyResult = Fuzzysort.single(normalizedName, existingNormalized);

            if (fuzzyResult) {
                const normalizedScore = Math.max(
                    0,
                    Math.min(1, (fuzzyResult.score + 1000) / 1000)
                );

                if (normalizedScore >= SIMILARITY_THRESHOLDS.HIGH) {
                    matches.push({
                        lancamentoId: existing.id,
                        matchReason: "similar",
                        similarity: normalizedScore,
                        existingTransaction: {
                            nome: existing.nome,
                            valor: existing.valor,
                            purchaseDate: existing.purchaseDate,
                            anotacao: existing.anotacao,
                        },
                    });
                } else if (normalizedScore >= SIMILARITY_THRESHOLDS.MEDIUM) {
                    matches.push({
                        lancamentoId: existing.id,
                        matchReason: "likely",
                        similarity: normalizedScore,
                        existingTransaction: {
                            nome: existing.nome,
                            valor: existing.valor,
                            purchaseDate: existing.purchaseDate,
                            anotacao: existing.anotacao,
                        },
                    });
                }
            }
        }

        // Sort matches by quality
        matches.sort((a, b) => {
            const matchPriority = { fitid: 4, exact: 3, similar: 2, likely: 1 };
            const priorityDiff =
                matchPriority[b.matchReason] - matchPriority[a.matchReason];

            if (priorityDiff !== 0) return priorityDiff;

            return b.similarity - a.similarity;
        });

        results.set(transaction.id, matches);
    }

    console.log("[Duplicate Detector] Batch detection complete", {
        totalTransactions: transactions.length,
        resultsSize: results.size,
        transactionsWithDuplicates: Array.from(results.values()).filter(m => m.length > 0).length
    });

    return results;
}

/**
 * Check a single transaction for duplicates
 * Convenience wrapper around detectDuplicates() that provides a simpler interface
 *
 * @param userId - User ID who owns the transactions
 * @param contaId - Account ID to check for duplicates
 * @param transaction - Transaction to check for duplicates
 * @returns Object with isDuplicate flag and array of matches, or null if no duplicates found
 */
export async function checkTransactionForDuplicates(
    userId: string,
    contaId: string,
    transaction: {
        nome: string;
        valor: string;
        purchaseDate: Date;
        fitId?: string;
    }
): Promise<{
    isDuplicate: boolean;
    matches: DuplicateMatch[];
    bestMatch: DuplicateMatch | null;
} | null> {
    const matches = await detectDuplicates(
        userId,
        contaId,
        transaction.nome,
        transaction.valor,
        transaction.purchaseDate,
        transaction.fitId
    );

    if (matches.length === 0) {
        return null;
    }

    return {
        isDuplicate: true,
        matches,
        bestMatch: matches[0], // Already sorted by match quality in detectDuplicates
    };
}
