import { db } from "@/lib/db";
import { lancamentos } from "@/db/schema";
import { eq, and, between, gte, lte, desc } from "drizzle-orm";
import Fuzzysort from "fuzzysort";

/**
 * Match reason for duplicate detection
 *
 * - `fitid`: FITID pattern found in existing transaction note (e.g., "FITID: 12345")
 * - `exact`: Same date, amount, and name
 * - `similar`: Within ±3 days, same amount, >80% name similarity
 * - `likely`: Within ±3 days, same amount, >60% name similarity
 */
export type MatchReason =
    | "fitid" // Exact FITID match in notes
    | "exact" // Exact date + amount + name match
    | "similar" // Similar date (±3 days) + exact amount + similar description (>80%)
    | "likely"; // Similar date + exact amount + somewhat similar description (>60%)

/**
 * Duplicate match result
 *
 * Note: `existingTransaction` fields use database column names for compatibility
 * with frontend display code, but Drizzle queries use JS field names
 * (name/amount/note in code → nome/valor/anotacao in DB).
 */
export interface DuplicateMatch {
    lancamentoId: string;
    matchReason: MatchReason;
    similarity: number; // 0-1, how similar the descriptions are
    existingTransaction: {
        nome: string; // DB column name for display
        valor: string; // DB column name for display
        purchaseDate: Date;
        anotacao: string | null; // DB column name for display
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
 *
 * Transactions within ±3 days of each other are considered potential duplicates
 */
const DATE_TOLERANCE_DAYS = 3;

/**
 * Detect potential duplicate transactions in the database
 *
 * Uses FITID pattern matching (if available), exact matching, and fuzzy string
 * similarity to identify potential duplicates. Searches within a ±3 day window
 * and requires exact amount match.
 *
 * FITID Format: Stored as "FITID: <id>" in transaction note field.
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

    // Note: DB stores amounts with sign (negative for expenses, positive for income)
    // but OFX transactions use absolute values, so we need to check both signed values
    const transactionAmountNum = typeof transactionAmount === "string"
        ? parseFloat(transactionAmount)
        : transactionAmount;
    const positiveAmount = Math.abs(transactionAmountNum).toFixed(2);
    const negativeAmount = (-Math.abs(transactionAmountNum)).toFixed(2);

    // Query existing transactions for the same account with similar dates and amounts
    // Check both positive and negative amounts to handle signed DB storage
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
            gte(lancamentos.purchaseDate, startDate),
            lte(lancamentos.purchaseDate, endDate)
        ),
        limit: 100, // Reasonable limit for duplicate checking
    });

    // Filter by amount (absolute value comparison)
    const filteredTransactions = existingTransactions.filter((t) => {
        const dbAmount = typeof t.amount === "string" ? t.amount : String(t.amount);
        return dbAmount === positiveAmount || dbAmount === negativeAmount;
    });

    if (filteredTransactions.length === 0) {
        return [];
    }

    // Check each existing transaction for duplicates
    for (const existing of filteredTransactions) {
        // Priority 1: Check for FITID match in notes
        if (fitId && existing.note) {
            const fitIdPattern = new RegExp(`FITID:\\s*${fitId}`, "i");
            if (fitIdPattern.test(existing.note)) {
                matches.push({
                    lancamentoId: existing.id,
                    matchReason: "fitid",
                    similarity: 1.0,
                    existingTransaction: {
                        nome: existing.name,
                        valor: existing.amount,
                        purchaseDate: existing.purchaseDate,
                        anotacao: existing.note,
                    },
                });
                continue; // FITID is definitive, skip other checks
            }
        }

        const existingNormalized = existing.name.trim().toLowerCase();
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
                    nome: existing.name,
                    valor: existing.amount,
                    purchaseDate: existing.purchaseDate,
                    anotacao: existing.note,
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
                        nome: existing.name,
                        valor: existing.amount,
                        purchaseDate: existing.purchaseDate,
                        anotacao: existing.note,
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
                        nome: existing.name,
                        valor: existing.amount,
                        purchaseDate: existing.purchaseDate,
                        anotacao: existing.note,
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
 *
 * More efficient than calling detectDuplicates multiple times. Fetches all
 * potentially matching existing transactions in a single query, then checks
 * each input transaction against the filtered results.
 *
 * Important: Input transactions use JS field names (name/amount), but query
 * results are also accessed with JS field names. The existingTransaction
 * in results is mapped to DB column names (nome/valor/anotacao) for compatibility.
 *
 * @param userId - User ID who owns the transactions
 * @param accountId - Account ID to check for duplicates (contaId or cartaoId)
 * @param accountType - Type of account: "bank" for contaId, "card" for cartaoId
 * @param transactions - Array of transactions to check (with JS field names)
 * @returns Map of transaction IDs to their duplicate matches
 */
export async function detectDuplicatesBatch(
    userId: string,
    accountId: string,
    accountType: "bank" | "card",
    transactions: Array<{
        id: string;
        name: string;
        amount: string;
        purchaseDate: Date;
        fitId?: string;
    }>
): Promise<Map<string, DuplicateMatch[]>> {
    const results = new Map<string, DuplicateMatch[]>();

    if (transactions.length === 0) {
        return results;
    }

    // Find the date range that covers all transactions (ignore invalid dates)
    const validDates = transactions
        .map((t) => new Date(t.purchaseDate))
        .filter((date) => !Number.isNaN(date.getTime()));

    if (validDates.length === 0) {
        return results;
    }

    const minDate = new Date(Math.min(...validDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime())));

    // Expand by tolerance
    minDate.setDate(minDate.getDate() - DATE_TOLERANCE_DAYS);
    maxDate.setDate(maxDate.getDate() + DATE_TOLERANCE_DAYS);

    // Get all amounts to check (both positive and negative for signed DB storage)
    const amountPairs = transactions.map((t) => {
        const amountNum = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
        const absAmount = Math.abs(amountNum);
        return {
            positive: absAmount.toFixed(2),
            negative: (-absAmount).toFixed(2),
        };
    });
    const allAmountsToCheck = new Set<string>();
    amountPairs.forEach((pair) => {
        const positive = parseFloat(pair.positive);
        const negative = parseFloat(pair.negative);
        const deltas = [0, 0.01, -0.01];

        deltas.forEach((delta) => {
            const pos = (positive + delta).toFixed(2);
            const neg = (negative + delta).toFixed(2);
            allAmountsToCheck.add(pos);
            allAmountsToCheck.add(neg);
        });
    });

    console.log("[Duplicate Detector Batch] Amount pairs to check:", {
        samplePairs: amountPairs.slice(0, 3),
        allAmountsSize: allAmountsToCheck.size,
        allAmountsSample: Array.from(allAmountsToCheck).slice(0, 6),
    });

    // Build query condition based on account type
    const accountCondition = accountType === "bank"
        ? eq(lancamentos.contaId, accountId)
        : eq(lancamentos.cartaoId, accountId);

    // Single query to fetch all potentially matching transactions
    // Note: Query uses Drizzle JS field names (name, amount, note)
    // which map to DB columns (nome, valor, anotacao)
    const existingTransactionsQuery = db
        .select({
            id: lancamentos.id,
            name: lancamentos.name,
            amount: lancamentos.amount,
            purchaseDate: lancamentos.purchaseDate,
            note: lancamentos.note,
        })
        .from(lancamentos)
        .where(and(
            eq(lancamentos.userId, userId),
            accountCondition,
            gte(lancamentos.purchaseDate, minDate),
            lte(lancamentos.purchaseDate, maxDate)
        ))
        .orderBy(desc(lancamentos.purchaseDate))
        .limit(999); // Reasonable limit for batch checking

    const sql = existingTransactionsQuery.toSQL();
    console.log("[Duplicate Detector Batch] SQL query:", sql.sql, sql.params);

    const existingTransactions = await existingTransactionsQuery;

    // Filter by amounts (absolute value comparison to handle signed DB storage)
    const filteredTransactions = existingTransactions.filter(
        (t: typeof existingTransactions[0]) => {
            if (t.name === "Github  Inc.") {
                console.log(`[Duplicate Detector Batch] Special case for transaction - DEBUG`);
            }
            const dbAmountNum = typeof t.amount === "string"
                ? parseFloat(t.amount)
                : t.amount;
            if (Number.isNaN(dbAmountNum)) {
                return false;
            }
            const dbAmountFixed = dbAmountNum.toFixed(2);
            const dbAmountAbsFixed = Math.abs(dbAmountNum).toFixed(2);

            return (
                allAmountsToCheck.has(dbAmountFixed) ||
                allAmountsToCheck.has(dbAmountAbsFixed)
            );
        }
    );

    console.log("[Duplicate Detector Batch] Filtered transactions:", {
        totalExisting: existingTransactions.length,
        afterFiltering: filteredTransactions.length,
        sampleExisting: existingTransactions.slice(0, 3).map((t) => ({
            name: t.name,
            amount: String(t.amount),
            amountType: typeof t.amount,
        })),
        sampleFiltered: filteredTransactions.slice(0, 3).map((t) => ({
            name: t.name,
            amount: String(t.amount),
            amountType: typeof t.amount,
        })),
    });

    console.log(
        "[Duplicate Detector Batch] Filtered transactions list:",
        filteredTransactions.map((t) => ({
            id: t.id,
            name: t.name,
            amount: String(t.amount),
            purchaseDate: t.purchaseDate,
        }))
    );

    // Check each input transaction against existing ones
    for (const transaction of transactions) {
        const matches: DuplicateMatch[] = [];
        const normalizedName = transaction.name.trim().toLowerCase();

        if (normalizedName.length < 3) {
            results.set(transaction.id, []);
            continue;
        }

        const transactionDate = new Date(transaction.purchaseDate);
        if (Number.isNaN(transactionDate.getTime())) {
            results.set(transaction.id, []);
            continue;
        }

        const transactionTime = transactionDate.getTime();
        const transactionAmountNum = typeof transaction.amount === "string"
            ? parseFloat(transaction.amount)
            : transaction.amount;
        const transactionAbsAmount = Math.abs(transactionAmountNum);
        if (transaction.name === "Github  Inc.") {
            console.log(`[Duplicate Check] Special case for transaction - DEBUG`);
        }
        console.log(`[Duplicate Check] Checking transaction:`, {
            name: transaction.name,
            normalizedName,
            amount: transaction.amount,
            date: transactionDate,
            candidateCount: filteredTransactions.length
        });

        for (const existing of filteredTransactions) {
            // Compare absolute amounts to handle signed DB storage
            const existingAmountNum = typeof existing.amount === "string"
                ? parseFloat(existing.amount)
                : existing.amount;
            const existingAbsAmount = Math.abs(existingAmountNum);

            console.log(`[Duplicate Detector] Comparing transaction "${transaction.name}" (${transactionAbsAmount}) with existing "${existing.name}" (${existingAbsAmount})`);

            if (Math.abs(existingAbsAmount - transactionAbsAmount) >= 0.01) {
                console.log(`  [Skip] Amount mismatch: ${existingAbsAmount} !== ${transactionAbsAmount}`);
                continue;
            }

            console.log(`  [Match] Amount matches! Checking other criteria...`);

            // Calculate date difference
            const daysDifference = Math.abs(
                Math.floor(
                    (transactionTime - existing.purchaseDate.getTime()) /
                    (1000 * 60 * 60 * 24)
                )
            );

            // Skip if outside date tolerance
            if (daysDifference > DATE_TOLERANCE_DAYS) continue;

            // Check for FITID match (format: "FITID: <id>" in note field)
            if (transaction.fitId && existing.note) {
                const fitIdPattern = new RegExp(
                    `FITID:\\s*${transaction.fitId}`,
                    "i"
                );

                if (fitIdPattern.test(existing.note)) {
                    matches.push({
                        lancamentoId: existing.id,
                        matchReason: "fitid",
                        similarity: 1.0,
                        // Map Drizzle JS field names to DB column names for frontend
                        existingTransaction: {
                            nome: existing.name,
                            valor: existing.amount,
                            purchaseDate: existing.purchaseDate,
                            anotacao: existing.note,
                        },
                    });
                    continue;
                }
            }

            const existingNormalized = existing.name.trim().toLowerCase();

            console.log(`    [Compare] Existing: "${existing.name}" (normalized: "${existingNormalized}"), amount: "${existing.amount}", days diff: ${daysDifference}`);

            // Check for exact match
            if (daysDifference === 0 && normalizedName === existingNormalized) {
                console.log(`    [MATCH] Exact match found!`);
                matches.push({
                    lancamentoId: existing.id,
                    matchReason: "exact",
                    similarity: 1.0,
                    existingTransaction: {
                        nome: existing.name,
                        valor: existing.amount,
                        purchaseDate: existing.purchaseDate,
                        anotacao: existing.note,
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

                console.log(`    [Fuzzy] Similarity score: ${normalizedScore.toFixed(3)}`);

                if (normalizedScore >= SIMILARITY_THRESHOLDS.HIGH) {
                    console.log(`    [MATCH] Similar match (HIGH confidence)`);
                    matches.push({
                        lancamentoId: existing.id,
                        matchReason: "similar",
                        similarity: normalizedScore,
                        existingTransaction: {
                            nome: existing.name,
                            valor: existing.amount,
                            purchaseDate: existing.purchaseDate,
                            anotacao: existing.note,
                        },
                    });
                } else if (normalizedScore >= SIMILARITY_THRESHOLDS.MEDIUM) {
                    console.log(`    [MATCH] Likely match (MEDIUM confidence)`);
                    matches.push({
                        lancamentoId: existing.id,
                        matchReason: "likely",
                        similarity: normalizedScore,
                        existingTransaction: {
                            nome: existing.name,
                            valor: existing.amount,
                            purchaseDate: existing.purchaseDate,
                            anotacao: existing.note,
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

        console.log(`[Duplicate Check] Transaction "${transaction.name}" found ${matches.length} matches`);
        results.set(transaction.id, matches);
    }

    console.log(`[Duplicate Check] Batch complete: checked ${transactions.length} transactions, found duplicates for ${Array.from(results.values()).filter(m => m.length > 0).length} transactions`);
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
