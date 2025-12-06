import { db } from "@/lib/db";
import { lancamentos } from "@/db/schema";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import Fuzzysort from "fuzzysort";

/**
 * Confidence level for category suggestions
 */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Category suggestion result
 */
export interface CategorySuggestion {
    categoriaId: string;
    confidence: ConfidenceLevel;
    score: number;
    matchReason: "exact" | "fuzzy" | "amount-pattern";
}

/**
 * Minimum score thresholds for confidence levels
 */
const CONFIDENCE_THRESHOLDS = {
    HIGH: 0.9, // 90% similarity
    MEDIUM: 0.7, // 70% similarity
    LOW: 0.5, // 50% similarity (below this, no suggestion)
};

/**
 * Suggest a category for a transaction based on historical data
 * 
 * @param userId - User ID who owns the transactions
 * @param transactionName - Name/description of the transaction
 * @param transactionAmount - Amount of the transaction (optional, for pattern matching)
 * @param transactionType - Type of transaction ("Despesa" or "Receita")
 * @returns Category suggestion with confidence level, or null if no match
 */
export async function suggestCategory(
    userId: string,
    transactionName: string,
    transactionAmount?: string,
    transactionType?: string
): Promise<CategorySuggestion | null> {
    // Normalize input
    const normalizedName = transactionName.trim().toLowerCase();

    if (!normalizedName || normalizedName.length < 3) {
        return null; // Too short to match reliably
    }

    // Build query conditions
    const conditions = [
        eq(lancamentos.userId, userId),
        isNotNull(lancamentos.categoriaId),
    ];

    // Filter by transaction type if provided
    if (transactionType) {
        conditions.push(eq(lancamentos.transactionType, transactionType));
    }

    // Query historical transactions with categories
    const historicalTransactions = await db.query.lancamentos.findMany({
        where: and(...conditions),
        columns: {
            id: true,
            name: true,
            amount: true,
            categoriaId: true,
        },
        limit: 500, // Limit for performance
    });

    if (historicalTransactions.length === 0) {
        return null; // No historical data
    }

    // Check for exact match first (case-insensitive)
    const exactMatch = historicalTransactions.find(
        (t: typeof historicalTransactions[0]) => t.name.toLowerCase() === normalizedName
    );

    if (exactMatch && exactMatch.categoriaId) {
        return {
            categoriaId: exactMatch.categoriaId,
            confidence: "high",
            score: 1.0,
            matchReason: "exact",
        };
    }

    // Prepare data for fuzzy matching
    interface FuzzyTarget {
        target: string;
        categoriaId: string;
        amount: string;
    }

    const targets: FuzzyTarget[] = historicalTransactions
        .filter((t: typeof historicalTransactions[0]) => t.categoriaId)
        .map((t: typeof historicalTransactions[0]) => ({
            target: t.name.toLowerCase(),
            categoriaId: t.categoriaId!,
            amount: t.amount,
        }));

    // Perform fuzzy search
    const fuzzyResults = Fuzzysort.go(normalizedName, targets, {
        key: "target",
        threshold: -10000, // Include all results for scoring
        limit: 10,
    });

    if (fuzzyResults.length === 0) {
        return null;
    }

    // Calculate category scores (aggregate by category)
    const categoryScores = new Map<string, { totalScore: number; count: number }>();

    for (const result of fuzzyResults) {
        const obj = result.obj as FuzzyTarget;
        const categoriaId = obj.categoriaId;

        // Normalize score to 0-1 range (fuzzysort scores are negative)
        // Score ranges from 0 (no match) to 1 (perfect match)
        const normalizedScore = Math.max(0, Math.min(1, (result.score + 1000) / 1000));

        // Weight by amount similarity if provided
        let weightedScore = normalizedScore;
        if (transactionAmount && obj.amount) {
            const amountDiff = Math.abs(
                parseFloat(transactionAmount) - parseFloat(obj.amount)
            );
            const amountSimilarity = Math.max(0, 1 - amountDiff / 1000); // Normalize to 0-1
            weightedScore = (normalizedScore * 0.8) + (amountSimilarity * 0.2);
        }

        const existing = categoryScores.get(categoriaId);
        if (existing) {
            existing.totalScore += weightedScore;
            existing.count += 1;
        } else {
            categoryScores.set(categoriaId, { totalScore: weightedScore, count: 1 });
        }
    }

    // Find best category (highest average score)
    let bestCategory: { categoriaId: string; score: number } | null = null;

    for (const [categoriaId, { totalScore, count }] of categoryScores.entries()) {
        const avgScore = totalScore / count;

        if (!bestCategory || avgScore > bestCategory.score) {
            bestCategory = { categoriaId, score: avgScore };
        }
    }

    if (!bestCategory || bestCategory.score < CONFIDENCE_THRESHOLDS.LOW) {
        return null; // Score too low
    }

    // Determine confidence level
    let confidence: ConfidenceLevel;
    if (bestCategory.score >= CONFIDENCE_THRESHOLDS.HIGH) {
        confidence = "high";
    } else if (bestCategory.score >= CONFIDENCE_THRESHOLDS.MEDIUM) {
        confidence = "medium";
    } else {
        confidence = "low";
    }

    return {
        categoriaId: bestCategory.categoriaId,
        confidence,
        score: bestCategory.score,
        matchReason: "fuzzy",
    };
}

/**
 * Suggest categories for multiple transactions efficiently
 * Processes all transactions with a single DB query for better performance
 * 
 * @param userId - User ID who owns the transactions
 * @param transactions - Array of transactions to suggest categories for
 * @returns Map of transaction identifier to category suggestion
 */
export async function suggestCategoriesForTransactions(
    userId: string,
    transactions: Array<{
        id: string;
        name: string;
        amount?: string;
        transactionType?: string;
    }>
): Promise<Map<string, CategorySuggestion>> {
    const suggestions = new Map<string, CategorySuggestion>();

    if (transactions.length === 0) {
        return suggestions;
    }

    // Build query conditions - fetch historical data once for all transactions
    const conditions = [
        eq(lancamentos.userId, userId),
        isNotNull(lancamentos.categoriaId),
    ];

    // Query historical transactions once for all transaction types
    const historicalTransactions = await db.query.lancamentos.findMany({
        where: and(...conditions),
        columns: {
            id: true,
            name: true,
            amount: true,
            categoriaId: true,
            transactionType: true,
        },
        limit: 1000, // Increased limit for batch processing
    });

    if (historicalTransactions.length === 0) {
        return suggestions; // No historical data
    }

    // Group historical transactions by type for efficiency
    const historicalByType = new Map<string, typeof historicalTransactions>();
    for (const hist of historicalTransactions) {
        const type = hist.transactionType;
        if (!historicalByType.has(type)) {
            historicalByType.set(type, []);
        }
        historicalByType.get(type)!.push(hist);
    }

    // Process each transaction with the pre-fetched historical data
    for (const transaction of transactions) {
        const normalizedName = transaction.name.trim().toLowerCase();

        if (!normalizedName || normalizedName.length < 3) {
            continue; // Skip too short names
        }

        // Get relevant historical transactions (by type if specified, or all)
        const relevantHistory = transaction.transactionType
            ? historicalByType.get(transaction.transactionType) || []
            : historicalTransactions;

        if (relevantHistory.length === 0) {
            continue;
        }

        // Check for exact match first
        const exactMatch = relevantHistory.find(
            (t: typeof historicalTransactions[0]) => t.name.toLowerCase() === normalizedName
        );

        if (exactMatch && exactMatch.categoriaId) {
            suggestions.set(transaction.id, {
                categoriaId: exactMatch.categoriaId,
                confidence: "high",
                score: 1.0,
                matchReason: "exact",
            });
            continue;
        }

        // Prepare data for fuzzy matching
        interface FuzzyTarget {
            target: string;
            categoriaId: string;
            amount: string;
        }

        const targets: FuzzyTarget[] = relevantHistory
            .filter((t: typeof historicalTransactions[0]) => t.categoriaId)
            .map((t: typeof historicalTransactions[0]) => ({
                target: t.name.toLowerCase(),
                categoriaId: t.categoriaId!,
                amount: t.amount,
            }));

        if (targets.length === 0) {
            continue;
        }

        // Perform fuzzy search
        const fuzzyResults = Fuzzysort.go(normalizedName, targets, {
            key: "target",
            threshold: -10000,
            limit: 10,
        });

        if (fuzzyResults.length === 0) {
            continue;
        }

        // Calculate category scores
        const categoryScores = new Map<string, { totalScore: number; count: number }>();

        for (const result of fuzzyResults) {
            const obj = result.obj as FuzzyTarget;
            const categoriaId = obj.categoriaId;

            const normalizedScore = Math.max(0, Math.min(1, (result.score + 1000) / 1000));

            let weightedScore = normalizedScore;
            if (transaction.amount && obj.amount) {
                const amountDiff = Math.abs(
                    parseFloat(transaction.amount) - parseFloat(obj.amount)
                );
                const amountSimilarity = Math.max(0, 1 - amountDiff / 1000);
                weightedScore = (normalizedScore * 0.8) + (amountSimilarity * 0.2);
            }

            const existing = categoryScores.get(categoriaId);
            if (existing) {
                existing.totalScore += weightedScore;
                existing.count += 1;
            } else {
                categoryScores.set(categoriaId, { totalScore: weightedScore, count: 1 });
            }
        }

        // Find best category
        let bestCategory: { categoriaId: string; score: number } | null = null;

        for (const [categoriaId, { totalScore, count }] of categoryScores.entries()) {
            const avgScore = totalScore / count;

            if (!bestCategory || avgScore > bestCategory.score) {
                bestCategory = { categoriaId, score: avgScore };
            }
        }

        if (!bestCategory || bestCategory.score < CONFIDENCE_THRESHOLDS.LOW) {
            continue;
        }

        // Determine confidence level
        let confidence: ConfidenceLevel;
        if (bestCategory.score >= CONFIDENCE_THRESHOLDS.HIGH) {
            confidence = "high";
        } else if (bestCategory.score >= CONFIDENCE_THRESHOLDS.MEDIUM) {
            confidence = "medium";
        } else {
            confidence = "low";
        }

        suggestions.set(transaction.id, {
            categoriaId: bestCategory.categoriaId,
            confidence,
            score: bestCategory.score,
            matchReason: "fuzzy",
        });
    }

    return suggestions;
}
