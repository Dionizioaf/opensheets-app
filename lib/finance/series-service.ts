import { lancamentos } from "@/db/schema";
import { db } from "@/lib/db";
import { addMonthsToDate, parseLocalDateString } from "@/lib/utils/date";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

/**
 * Shared recurring/installment series edit + delete logic, single-sourced between
 * the dashboard bulk actions (`updateLancamentoBulkAction`,
 * `deleteLancamentoBulkAction`) and the MCP tools (`finance_update_series`,
 * `finance_delete_series`) so the two surfaces cannot drift. Callers own the
 * transaction and any cache revalidation.
 *
 * Update semantics are a partial patch: only fields explicitly provided
 * (`!== undefined`) are written, so an MCP caller can change one field without
 * wiping the rest. The dashboard action passes every field on every call, so its
 * full-replace behaviour is unchanged.
 */
type DbHandle = typeof db;

export type SeriesScope = "current" | "future" | "all";

/**
 * Editable series fields. `undefined` means "leave untouched"; `null` clears the
 * column. `amount` is an absolute value — its sign is derived from the anchor's
 * transaction type.
 */
export interface SeriesUpdateFields {
  name?: string;
  amount?: number;
  categoriaId?: string | null;
  pagadorId?: string | null;
  contaId?: string | null;
  cartaoId?: string | null;
  note?: string | null;
  /** YYYY-MM-DD or null to clear. */
  dueDate?: string | null;
  /** YYYY-MM-DD or null to clear. */
  boletoPaymentDate?: string | null;
}

type SeriesAnchor = {
  id: string;
  seriesId: string;
  period: string;
  transactionType: string;
  purchaseDate: Date | null;
};

const centsToDecimalString = (value: number) => {
  const decimal = value / 100;
  const formatted = decimal.toFixed(2);
  return Object.is(decimal, -0) ? "0.00" : formatted;
};

async function loadSeriesAnchor(
  handle: DbHandle,
  userId: string,
  transactionId: string
): Promise<SeriesAnchor> {
  const row = await handle.query.lancamentos.findFirst({
    columns: {
      id: true,
      seriesId: true,
      period: true,
      transactionType: true,
      purchaseDate: true,
    },
    where: and(
      eq(lancamentos.id, transactionId),
      eq(lancamentos.userId, userId)
    ),
  });
  if (!row) {
    throw new Error("Lançamento não encontrado.");
  }
  if (!row.seriesId) {
    throw new Error("Este lançamento não faz parte de uma série.");
  }
  return {
    id: row.id,
    seriesId: row.seriesId,
    period: row.period,
    transactionType: row.transactionType,
    purchaseDate: row.purchaseDate ?? null,
  };
}

/** Rows a scope selects, ordered by purchase date. */
async function selectSeriesRows(
  handle: DbHandle,
  userId: string,
  anchor: SeriesAnchor,
  scope: SeriesScope
): Promise<Array<{ id: string; purchaseDate: Date | null }>> {
  if (scope === "current") {
    return [{ id: anchor.id, purchaseDate: anchor.purchaseDate }];
  }

  const where =
    scope === "future"
      ? and(
          eq(lancamentos.seriesId, anchor.seriesId),
          eq(lancamentos.userId, userId),
          sql`${lancamentos.period} >= ${anchor.period}`
        )
      : and(
          eq(lancamentos.seriesId, anchor.seriesId),
          eq(lancamentos.userId, userId)
        );

  const rows = await handle.query.lancamentos.findMany({
    columns: { id: true, purchaseDate: true },
    where,
    orderBy: asc(lancamentos.purchaseDate),
  });
  return rows.map((row) => ({
    id: row.id,
    purchaseDate: row.purchaseDate ?? null,
  }));
}

function buildBasePayload(
  updates: SeriesUpdateFields,
  anchor: SeriesAnchor
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.categoriaId !== undefined)
    payload.categoriaId = updates.categoriaId;
  if (updates.note !== undefined) payload.note = updates.note;
  if (updates.pagadorId !== undefined) payload.pagadorId = updates.pagadorId;
  if (updates.contaId !== undefined) payload.contaId = updates.contaId;
  if (updates.cartaoId !== undefined) payload.cartaoId = updates.cartaoId;
  if (updates.amount !== undefined) {
    const sign: 1 | -1 = anchor.transactionType === "Despesa" ? -1 : 1;
    const amountCents = Math.round(Math.abs(updates.amount) * 100);
    payload.amount = centsToDecimalString(amountCents * sign);
  }
  return payload;
}

/**
 * The due date shifts by the same month offset each row's purchase date has
 * relative to the anchor, matching the single-row write helpers.
 */
function buildDueDatePlan(updates: SeriesUpdateFields, anchor: SeriesAnchor) {
  const hasUpdate = updates.dueDate !== undefined;
  const baseDueDate =
    hasUpdate && updates.dueDate
      ? parseLocalDateString(updates.dueDate)
      : null;
  return { hasUpdate, baseDueDate, basePurchaseDate: anchor.purchaseDate };
}

function dueDateForRecord(
  recordPurchaseDate: Date | null,
  plan: ReturnType<typeof buildDueDatePlan>
): Date | null | undefined {
  if (!plan.hasUpdate) return undefined;
  if (!plan.baseDueDate) return null;
  if (!plan.basePurchaseDate || !recordPurchaseDate) return plan.baseDueDate;

  const monthDiff =
    (recordPurchaseDate.getFullYear() - plan.basePurchaseDate.getFullYear()) *
      12 +
    (recordPurchaseDate.getMonth() - plan.basePurchaseDate.getMonth());

  return addMonthsToDate(plan.baseDueDate, monthDiff);
}

export type SeriesUpdateParams = {
  userId: string;
  transactionId: string;
  scope: SeriesScope;
  updates: SeriesUpdateFields;
};

export type SeriesDeleteParams = {
  userId: string;
  transactionId: string;
  scope: SeriesScope;
};

/** Non-mutating impact summary for a series update. Safe in MCP `preview` mode. */
export async function previewSeriesUpdate(params: SeriesUpdateParams) {
  const { userId, transactionId, scope, updates } = params;
  const anchor = await loadSeriesAnchor(db, userId, transactionId);
  const rows = await selectSeriesRows(db, userId, anchor, scope);
  const changedFields = Object.keys(buildBasePayload(updates, anchor));
  if (updates.dueDate !== undefined) changedFields.push("dueDate");
  if (updates.boletoPaymentDate !== undefined)
    changedFields.push("boletoPaymentDate");
  return {
    seriesId: anchor.seriesId,
    scope,
    affectedTransactions: rows.length,
    transactionIds: rows.map((row) => row.id),
    changedFields,
  };
}

/**
 * Mutating series update. Must run inside a caller-owned transaction. Applies the
 * patch to every row the scope selects, shifting each row's due date by its own
 * month offset from the anchor.
 */
export async function applySeriesUpdate(
  tx: DbHandle,
  params: SeriesUpdateParams
) {
  const { userId, transactionId, scope, updates } = params;
  const anchor = await loadSeriesAnchor(tx, userId, transactionId);
  const rows = await selectSeriesRows(tx, userId, anchor, scope);

  const basePayload = buildBasePayload(updates, anchor);
  const dueDatePlan = buildDueDatePlan(updates, anchor);
  const hasBoletoUpdate = updates.boletoPaymentDate !== undefined;
  const boletoValue =
    hasBoletoUpdate && updates.boletoPaymentDate
      ? parseLocalDateString(updates.boletoPaymentDate)
      : null;

  for (const record of rows) {
    const payload: Record<string, unknown> = { ...basePayload };

    const nextDueDate = dueDateForRecord(record.purchaseDate, dueDatePlan);
    if (nextDueDate !== undefined) payload.dueDate = nextDueDate;
    if (hasBoletoUpdate) payload.boletoPaymentDate = boletoValue;

    if (Object.keys(payload).length === 0) continue;

    await tx
      .update(lancamentos)
      .set(payload)
      .where(
        and(eq(lancamentos.id, record.id), eq(lancamentos.userId, userId))
      );
  }

  return {
    seriesId: anchor.seriesId,
    scope,
    updatedTransactionIds: rows.map((row) => row.id),
  };
}

/** Non-mutating impact summary for a series delete. Safe in MCP `preview` mode. */
export async function previewSeriesDelete(params: SeriesDeleteParams) {
  const { userId, transactionId, scope } = params;
  const anchor = await loadSeriesAnchor(db, userId, transactionId);
  const rows = await selectSeriesRows(db, userId, anchor, scope);
  return {
    seriesId: anchor.seriesId,
    scope,
    affectedTransactions: rows.length,
    transactionIds: rows.map((row) => row.id),
  };
}

/**
 * Mutating series delete. Must run inside a caller-owned transaction. Deletes
 * every row the scope selects.
 */
export async function applySeriesDelete(
  tx: DbHandle,
  params: SeriesDeleteParams
) {
  const { userId, transactionId, scope } = params;
  const anchor = await loadSeriesAnchor(tx, userId, transactionId);
  const rows = await selectSeriesRows(tx, userId, anchor, scope);
  const ids = rows.map((row) => row.id);

  if (ids.length > 0) {
    await tx
      .delete(lancamentos)
      .where(
        and(inArray(lancamentos.id, ids), eq(lancamentos.userId, userId))
      );
  }

  return {
    seriesId: anchor.seriesId,
    scope,
    deletedTransactionIds: ids,
  };
}
