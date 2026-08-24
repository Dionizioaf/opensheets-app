import { cartoes, contas, lancamentos, pagadores } from "@/db/schema";
import { db } from "@/lib/db";
import { PAGADOR_ROLE_ADMIN } from "@/lib/pagadores/constants";
import { formatDecimalForDbRequired } from "@/lib/utils/currency";
import type { CategorySuggestion } from "@/lib/ofx/category-suggester";
import { suggestCategoriesForTransactions } from "@/lib/ofx/category-suggester";
import type { DuplicateMatch } from "@/lib/ofx/duplicate-detector";
import { detectDuplicatesBatch } from "@/lib/ofx/duplicate-detector";
import type { ColumnMapping, CsvDelimiter } from "@/lib/csv/types";
import { mapCsvRowToTransaction } from "@/lib/csv/mapper";
import { parseCsvString } from "@/lib/csv/parser";
import {
  generateImportNote,
  mapOfxTransactionsToLancamentos,
} from "@/lib/ofx/mapper";
import { parseOfxFile } from "@/lib/ofx/parser";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export type ImportSourceType = "ofx" | "csv";
export type ImportAccountType = "bank" | "card";

/**
 * Cross-format normalized import candidate. Every parsed row — regardless of
 * source — is coerced to this shape before dedup/suggest/apply so downstream
 * logic never branches on source format.
 */
export interface ImportCandidate {
  /** Stable client-facing row id (uuid). Passed back on apply. */
  rowId: string;
  name: string;
  /** Absolute amount as decimal string (e.g. "123.45"). Signed at insert. */
  amount: string;
  purchaseDate: Date;
  period: string;
  transactionType: "Despesa" | "Receita";
  paymentMethod: string;
  note: string | null;
  /** OFX FITID, when the source is OFX. */
  fitId?: string;
  /** Suggested category from history, if any. */
  suggestedCategoryId?: string;
  categoryConfidence?: "high" | "medium" | "low";
  /** Highest-confidence duplicate match, when one exists. */
  duplicate?: {
    lancamentoId: string;
    matchReason: DuplicateMatch["matchReason"];
    similarity: number;
    existingName: string;
    existingAmount: string;
  };
}

export interface ImportPreviewSummary {
  totalRows: number;
  duplicateRows: number;
  uniqueRows: number;
  totalIncome: number;
  totalExpense: number;
}

export interface ImportPreviewResult {
  candidates: ImportCandidate[];
  summary: ImportPreviewSummary;
}

export interface ParseImportSourceParams {
  sourceType: ImportSourceType;
  /** Decoded UTF-8 file content. Callers handle base64/file-read. */
  content: string;
  /** CSV only: which columns hold date/amount/description. */
  csvMapping?: ColumnMapping;
  csvDelimiter?: CsvDelimiter;
}

export interface EnrichCandidatesParams {
  userId: string;
  accountId: string;
  accountType: ImportAccountType;
  candidates: ImportCandidate[];
}

export interface ApplyImportParams {
  userId: string;
  accountId: string;
  accountType: ImportAccountType;
  candidates: ImportCandidate[];
  /** Optional defaults applied when a candidate leaves the field unset. */
  defaults?: {
    categoryId?: string | null;
    payerId?: string | null;
    paymentMethod?: string;
  };
}

export interface ApplyImportResult {
  importedIds: string[];
  importedCount: number;
  skippedDuplicateCount: number;
}

const MAX_IMPORT_ROWS = 1000;

/** Parses an OFX or CSV payload and returns normalized candidates. */
export async function parseImportSource(
  params: ParseImportSourceParams
): Promise<ImportCandidate[]> {
  if (params.sourceType === "ofx") {
    const statement = await parseOfxFile(params.content);
    const mapped = mapOfxTransactionsToLancamentos(statement.transactions);
    return mapped.map((row, index) => {
      const raw = statement.transactions[index];
      const note = raw ? generateImportNote(raw) : (row.anotacao ?? null);
      return {
        rowId: randomUUID(),
        name: row.nome,
        amount: row.valor,
        purchaseDate: row.data_compra,
        period: row.periodo,
        transactionType: row.tipo_transacao,
        paymentMethod: row.forma_pagamento,
        note,
        fitId: row.fitId,
      } satisfies ImportCandidate;
    });
  }

  if (!params.csvMapping) {
    throw new Error("CSV imports require a column mapping.");
  }
  const parsed = parseCsvString(params.content, {
    delimiter: params.csvDelimiter,
  });
  if (!parsed.success) {
    const first = parsed.errors?.[0]?.message;
    throw new Error(first ? `CSV parse failed: ${first}` : "CSV parse failed.");
  }

  const candidates: ImportCandidate[] = [];
  for (let index = 0; index < parsed.rows.length; index++) {
    // The CSV mapper writes fields with English keys at runtime even though
    // its declared type (CsvImportTransaction extends ParsedOfxTransaction)
    // uses Portuguese ones — a pre-existing quirk of that module. Read the
    // runtime shape.
    const mapped = mapCsvRowToTransaction(
      parsed.rows[index],
      params.csvMapping,
      index
    ) as unknown as {
      name: string;
      amount: string;
      purchaseDate: Date;
      period: string;
      transactionType: "Despesa" | "Receita";
      paymentMethod: string;
    } | null;
    if (!mapped) continue;
    candidates.push({
      rowId: randomUUID(),
      name: mapped.name,
      amount: mapped.amount,
      purchaseDate: mapped.purchaseDate,
      period: mapped.period,
      transactionType: mapped.transactionType,
      paymentMethod: mapped.paymentMethod,
      note: `Importado de CSV em ${new Date().toISOString()}`,
    });
  }
  return candidates;
}

/**
 * Runs the batch duplicate detector and the history-based category suggester
 * over a set of candidates and returns them annotated with the best matches.
 */
export async function enrichCandidates(
  params: EnrichCandidatesParams
): Promise<ImportPreviewResult> {
  const { userId, accountId, accountType, candidates } = params;
  if (candidates.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Import is capped at ${MAX_IMPORT_ROWS} rows per preview (received ${candidates.length}).`
    );
  }

  const owned =
    accountType === "bank"
      ? await db.query.contas.findFirst({
          columns: { id: true },
          where: and(eq(contas.id, accountId), eq(contas.userId, userId)),
        })
      : await db.query.cartoes.findFirst({
          columns: { id: true },
          where: and(eq(cartoes.id, accountId), eq(cartoes.userId, userId)),
        });
  if (!owned) {
    throw new Error(
      accountType === "bank" ? "Account not found." : "Card not found."
    );
  }

  const [dupMap, catMap] = await Promise.all([
    candidates.length > 0
      ? detectDuplicatesBatch(
          userId,
          accountId,
          accountType,
          candidates.map((row) => ({
            id: row.rowId,
            name: row.name,
            amount: row.amount,
            purchaseDate: row.purchaseDate,
            fitId: row.fitId,
          }))
        )
      : Promise.resolve(new Map<string, DuplicateMatch[]>()),
    candidates.length > 0
      ? suggestCategoriesForTransactions(
          userId,
          candidates.map((row) => ({
            id: row.rowId,
            name: row.name,
            amount: row.amount,
            transactionType: row.transactionType,
          }))
        )
      : Promise.resolve(new Map<string, CategorySuggestion>()),
  ]);

  let duplicateRows = 0;
  let totalIncome = 0;
  let totalExpense = 0;

  const enriched: ImportCandidate[] = candidates.map((row) => {
    const dup = dupMap.get(row.rowId)?.[0];
    const suggestion = catMap.get(row.rowId);
    const value = Number(row.amount);
    if (row.transactionType === "Despesa") totalExpense += value;
    else totalIncome += value;
    if (dup) duplicateRows += 1;
    return {
      ...row,
      suggestedCategoryId: suggestion?.categoriaId,
      categoryConfidence: suggestion?.confidence,
      duplicate: dup
        ? {
            lancamentoId: dup.lancamentoId,
            matchReason: dup.matchReason,
            similarity: dup.similarity,
            existingName: dup.existingTransaction.nome,
            existingAmount: String(dup.existingTransaction.valor),
          }
        : undefined,
    };
  });

  return {
    candidates: enriched,
    summary: {
      totalRows: enriched.length,
      duplicateRows,
      uniqueRows: enriched.length - duplicateRows,
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpense: Number(totalExpense.toFixed(2)),
    },
  };
}

type DbHandle = typeof db;

/**
 * Inserts the accepted candidates into `lancamentos`. Caller owns the
 * transaction. Re-checks duplicates by FITID (OFX) and by name+amount+date
 * (all sources) as a safety net; matches are counted as
 * `skippedDuplicateCount` rather than inserted.
 */
export async function applyImportCandidates(
  tx: DbHandle,
  params: ApplyImportParams
): Promise<ApplyImportResult> {
  const { userId, accountId, accountType, candidates } = params;

  if (candidates.length === 0) {
    throw new Error("Nenhuma linha aceita para importação.");
  }
  if (candidates.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Import is capped at ${MAX_IMPORT_ROWS} rows per apply (received ${candidates.length}).`
    );
  }

  const owned =
    accountType === "bank"
      ? await tx.query.contas.findFirst({
          columns: { id: true },
          where: and(eq(contas.id, accountId), eq(contas.userId, userId)),
        })
      : await tx.query.cartoes.findFirst({
          columns: { id: true },
          where: and(eq(cartoes.id, accountId), eq(cartoes.userId, userId)),
        });
  if (!owned) {
    throw new Error(
      accountType === "bank" ? "Account not found." : "Card not found."
    );
  }

  const payerId =
    params.defaults?.payerId ??
    (
      await tx.query.pagadores.findFirst({
        columns: { id: true },
        where: and(
          eq(pagadores.userId, userId),
          eq(pagadores.role, PAGADOR_ROLE_ADMIN)
        ),
      })
    )?.id;
  if (!payerId) {
    throw new Error("Administrator payer not found.");
  }

  const existing = await tx.query.lancamentos.findMany({
    where: and(
      eq(lancamentos.userId, userId),
      accountType === "bank"
        ? eq(lancamentos.contaId, accountId)
        : eq(lancamentos.cartaoId, accountId)
    ),
    columns: {
      name: true,
      amount: true,
      purchaseDate: true,
      note: true,
    },
  });

  const fitIdSet = new Set<string>();
  const dedupKeySet = new Set<string>();
  const fitIdPattern = /FITID:\s*([^\s|]+)/i;
  for (const row of existing) {
    if (row.note) {
      const match = row.note.match(fitIdPattern);
      if (match?.[1]) fitIdSet.add(match[1]);
    }
    const key = `${row.name.trim().toLowerCase()}|${Math.abs(
      Number(row.amount)
    ).toFixed(2)}|${row.purchaseDate.toISOString().slice(0, 10)}`;
    dedupKeySet.add(key);
  }

  const toInsert: ImportCandidate[] = [];
  let skipped = 0;
  for (const candidate of candidates) {
    if (candidate.fitId && fitIdSet.has(candidate.fitId)) {
      skipped += 1;
      continue;
    }
    const key = `${candidate.name.trim().toLowerCase()}|${Math.abs(
      Number(candidate.amount)
    ).toFixed(2)}|${candidate.purchaseDate.toISOString().slice(0, 10)}`;
    if (dedupKeySet.has(key)) {
      skipped += 1;
      continue;
    }
    toInsert.push(candidate);
  }

  if (toInsert.length === 0) {
    return { importedIds: [], importedCount: 0, skippedDuplicateCount: skipped };
  }

  const defaults = params.defaults ?? {};
  const rows = toInsert.map((candidate) => {
    const abs = Math.abs(Number(candidate.amount));
    const signed = candidate.transactionType === "Despesa" ? -abs : abs;
    return {
      condition: "À vista" as const,
      name: candidate.name,
      paymentMethod: defaults.paymentMethod ?? candidate.paymentMethod,
      note: candidate.note,
      amount: formatDecimalForDbRequired(signed),
      purchaseDate: candidate.purchaseDate,
      transactionType: candidate.transactionType,
      period: candidate.period,
      isSettled: accountType === "card" ? false : true,
      userId,
      contaId: accountType === "bank" ? accountId : null,
      cartaoId: accountType === "card" ? accountId : null,
      categoriaId: candidate.suggestedCategoryId ?? defaults.categoryId ?? null,
      pagadorId: payerId,
    };
  });

  const inserted = await tx
    .insert(lancamentos)
    .values(rows)
    .returning({ id: lancamentos.id });

  return {
    importedIds: inserted.map((row) => row.id),
    importedCount: inserted.length,
    skippedDuplicateCount: skipped,
  };
}
