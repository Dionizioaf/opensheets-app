import { lancamentos } from "@/db/schema";
import { db } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";

export interface TransactionForComparison {
  date: string; // ISO date string
  amount: number;
  description: string;
  payee?: string;
}

export interface DuplicateMatch {
  existingTransactionId: string;
  existingDate: string;
  existingAmount: number;
  existingDescription: string;
  similarity: number; // 0-1, where 1 is exact match
  matchReasons: string[]; // e.g., ["exact_date", "exact_amount", "similar_description"]
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  bestMatch?: DuplicateMatch;
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 * Returns a score between 0 (completely different) and 1 (identical)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0;

  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);

  return 1 - distance / maxLength;
}

/**
 * Check if two transactions are potential duplicates based on multiple criteria
 */
export function checkTransactionDuplicate(
  newTransaction: TransactionForComparison,
  existingTransaction: {
    id: string;
    date: string;
    amount: number;
    name: string;
    note?: string | null;
  }
): DuplicateMatch | null {
  const matchReasons: string[] = [];

  // Exact date match (most important)
  const dateMatch = newTransaction.date === existingTransaction.date;
  if (dateMatch) matchReasons.push("exact_date");

  // Exact amount match (very important)
  const amountMatch = Math.abs(newTransaction.amount - existingTransaction.amount) < 0.01;
  if (amountMatch) matchReasons.push("exact_amount");

  // Description similarity (important but flexible)
  const descriptionSimilarity = calculateStringSimilarity(
    newTransaction.description,
    existingTransaction.name
  );

  let payeeSimilarity = 0;
  if (newTransaction.payee && existingTransaction.note) {
    payeeSimilarity = calculateStringSimilarity(
      newTransaction.payee,
      existingTransaction.note
    );
  }

  const maxDescriptionSimilarity = Math.max(descriptionSimilarity, payeeSimilarity);

  if (maxDescriptionSimilarity >= 0.8) {
    matchReasons.push("similar_description");
  } else if (maxDescriptionSimilarity >= 0.6) {
    matchReasons.push("partial_description_match");
  }

  // Calculate overall similarity score
  let similarity = 0;

  if (dateMatch && amountMatch) {
    // Strong match if date and amount are exact
    similarity = 0.9 + (maxDescriptionSimilarity * 0.1);
  } else if (dateMatch || amountMatch) {
    // Medium match if either date or amount matches
    similarity = 0.6 + (maxDescriptionSimilarity * 0.3);
  } else if (maxDescriptionSimilarity >= 0.8) {
    // Weak match based on description only
    similarity = 0.4 + (maxDescriptionSimilarity * 0.4);
  }

  // Only consider it a potential duplicate if similarity is high enough
  if (similarity >= 0.7 && matchReasons.length >= 2) {
    return {
      existingTransactionId: existingTransaction.id,
      existingDate: existingTransaction.date,
      existingAmount: existingTransaction.amount,
      existingDescription: existingTransaction.name,
      similarity,
      matchReasons,
    };
  }

  return null;
}

/**
 * Find potential duplicates for a transaction in the database
 */
export async function findTransactionDuplicates(
  userId: string,
  accountId: string,
  transaction: TransactionForComparison,
  lookbackDays: number = 90
): Promise<DuplicateDetectionResult> {
  // Calculate date range for duplicate checking
  const transactionDate = new Date(transaction.date);
  const startDate = new Date(transactionDate);
  startDate.setDate(startDate.getDate() - lookbackDays);

  const endDate = new Date(transactionDate);
  endDate.setDate(endDate.getDate() + lookbackDays);

  // Query existing transactions in the date range
  const existingTransactions = await db
    .select({
      id: lancamentos.id,
      date: lancamentos.purchaseDate,
      amount: lancamentos.amount,
      name: lancamentos.name,
      note: lancamentos.note,
    })
    .from(lancamentos)
    .where(
      and(
        eq(lancamentos.userId, userId),
        eq(lancamentos.contaId, accountId),
        sql`${lancamentos.purchaseDate} >= ${startDate.toISOString().split('T')[0]}`,
        sql`${lancamentos.purchaseDate} <= ${endDate.toISOString().split('T')[0]}`
      )
    );

  const matches: DuplicateMatch[] = [];

  for (const existing of existingTransactions) {
    const match = checkTransactionDuplicate(transaction, existing);
    if (match) {
      matches.push(match);
    }
  }

  // Sort by similarity (highest first)
  matches.sort((a, b) => b.similarity - a.similarity);

  // Take only the top matches (limit to prevent overwhelming the user)
  const topMatches = matches.slice(0, 5);

  const isDuplicate = topMatches.length > 0 && topMatches[0].similarity >= 0.85;

  return {
    isDuplicate,
    matches: topMatches,
    bestMatch: topMatches[0],
  };
}

/**
 * Find duplicates for multiple transactions (batch processing)
 */
export async function findBatchTransactionDuplicates(
  userId: string,
  accountId: string,
  transactions: TransactionForComparison[],
  lookbackDays: number = 90
): Promise<DuplicateDetectionResult[]> {
  const results: DuplicateDetectionResult[] = [];

  // Process in batches to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    const batchPromises = batch.map(tx =>
      findTransactionDuplicates(userId, accountId, tx, lookbackDays)
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}