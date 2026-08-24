import {
  cartoes,
  categorias,
  faturas,
  lancamentos,
  pagadores,
} from "@/db/schema";
import { buildInvoicePaymentNote } from "@/lib/accounts/constants";
import { db } from "@/lib/db";
import {
  INVOICE_PAYMENT_STATUS,
  type InvoicePaymentStatus,
} from "@/lib/faturas";
import { PAGADOR_ROLE_ADMIN } from "@/lib/pagadores/constants";
import { parseLocalDateString } from "@/lib/utils/date";
import { and, eq, sql } from "drizzle-orm";

/**
 * Shared credit-card invoice payment logic, single-sourced between the dashboard
 * server action (`updateInvoicePaymentStatusAction`) and the MCP write tools
 * (`finance_pay_invoice` / `finance_reverse_invoice_payment`) so the two surfaces
 * cannot drift. Callers own transactions and cache revalidation.
 */
type DbHandle = typeof db;

export type InvoicePaymentParams = {
  userId: string;
  cartaoId: string;
  period: string;
  status: InvoicePaymentStatus;
  /** Payment date (YYYY-MM-DD); defaults to today when marking as paid. */
  paymentDate?: string;
};

const formatDecimal = (value: number) =>
  (Math.round(value * 100) / 100).toFixed(2);

async function loadInvoiceCard(
  handle: DbHandle,
  userId: string,
  cartaoId: string
) {
  const card = await handle.query.cartoes.findFirst({
    columns: { id: true, contaId: true, name: true },
    where: and(eq(cartoes.id, cartaoId), eq(cartoes.userId, userId)),
  });
  if (!card) {
    throw new Error("Cartão não encontrado.");
  }
  return card;
}

/** Sum of the admin payer's expenses on the invoice (positive number). */
async function loadInvoiceAdminShare(
  handle: DbHandle,
  userId: string,
  cardId: string,
  period: string
) {
  const [row] = await handle
    .select({
      total: sql<number>`
        coalesce(
          sum(
            case
              when ${lancamentos.transactionType} = 'Despesa' then ${lancamentos.amount}
              else 0
            end
          ),
          0
        )
      `,
    })
    .from(lancamentos)
    .leftJoin(pagadores, eq(lancamentos.pagadorId, pagadores.id))
    .where(
      and(
        eq(lancamentos.userId, userId),
        eq(lancamentos.cartaoId, cardId),
        eq(lancamentos.period, period),
        eq(pagadores.role, PAGADOR_ROLE_ADMIN)
      )
    );
  return Math.abs(Number(row?.total ?? 0));
}

/**
 * Non-mutating impact summary for an invoice payment status change. Safe to call
 * in MCP `preview` mode.
 */
export async function previewInvoicePaymentStatus(
  userId: string,
  params: Pick<InvoicePaymentParams, "cartaoId" | "period" | "status">
) {
  const { cartaoId, period, status } = params;
  const card = await loadInvoiceCard(db, userId, cartaoId);

  const existingInvoice = await db.query.faturas.findFirst({
    columns: { paymentStatus: true },
    where: and(
      eq(faturas.cartaoId, cartaoId),
      eq(faturas.userId, userId),
      eq(faturas.period, period)
    ),
  });
  const currentStatus =
    existingInvoice?.paymentStatus ?? INVOICE_PAYMENT_STATUS.PENDING;

  const invoiceNote = buildInvoicePaymentNote(card.id, period);
  const existingPayment = await db.query.lancamentos.findFirst({
    columns: { id: true, amount: true },
    where: and(
      eq(lancamentos.userId, userId),
      eq(lancamentos.note, invoiceNote)
    ),
  });

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(lancamentos)
    .where(
      and(
        eq(lancamentos.userId, userId),
        eq(lancamentos.cartaoId, card.id),
        eq(lancamentos.period, period)
      )
    );
  const affectedTransactions = Number(countRow?.total ?? 0);

  const willMarkPaid = status === INVOICE_PAYMENT_STATUS.PAID;
  const adminShare = willMarkPaid
    ? await loadInvoiceAdminShare(db, userId, card.id, period)
    : 0;

  return {
    cardId: card.id,
    cardName: card.name,
    period,
    currentStatus,
    targetStatus: status,
    affectedTransactions,
    adminShare,
    willCreatePayment: willMarkPaid && adminShare > 0 && !!card.contaId,
    willRemovePayment: !willMarkPaid && !!existingPayment,
  };
}

/**
 * Mutating invoice payment status change. Must run inside a caller-owned
 * transaction. Marks every card transaction in the period settled/unsettled,
 * upserts the invoice row, and creates or removes the admin payment lançamento.
 */
export async function applyInvoicePaymentStatus(
  tx: DbHandle,
  params: InvoicePaymentParams
) {
  const { userId, cartaoId, period, status, paymentDate } = params;
  const card = await loadInvoiceCard(tx, userId, cartaoId);

  const existingInvoice = await tx.query.faturas.findFirst({
    columns: { id: true },
    where: and(
      eq(faturas.cartaoId, cartaoId),
      eq(faturas.userId, userId),
      eq(faturas.period, period)
    ),
  });

  if (existingInvoice) {
    await tx
      .update(faturas)
      .set({ paymentStatus: status })
      .where(eq(faturas.id, existingInvoice.id));
  } else {
    await tx.insert(faturas).values({
      cartaoId,
      period,
      paymentStatus: status,
      userId,
    });
  }

  const shouldMarkAsPaid = status === INVOICE_PAYMENT_STATUS.PAID;

  await tx
    .update(lancamentos)
    .set({ isSettled: shouldMarkAsPaid })
    .where(
      and(
        eq(lancamentos.userId, userId),
        eq(lancamentos.cartaoId, card.id),
        eq(lancamentos.period, period)
      )
    );

  const invoiceNote = buildInvoicePaymentNote(card.id, period);
  let paymentTransactionId: string | null = null;

  if (shouldMarkAsPaid) {
    const adminShare = await loadInvoiceAdminShare(
      tx,
      userId,
      card.id,
      period
    );

    if (adminShare > 0 && card.contaId) {
      const adminPagador = await tx.query.pagadores.findFirst({
        columns: { id: true },
        where: and(
          eq(pagadores.userId, userId),
          eq(pagadores.role, PAGADOR_ROLE_ADMIN)
        ),
      });

      const paymentCategory = await tx.query.categorias.findFirst({
        columns: { id: true },
        where: and(
          eq(categorias.userId, userId),
          eq(categorias.name, "Pagamentos")
        ),
      });

      if (adminPagador) {
        const invoiceDate = paymentDate
          ? parseLocalDateString(paymentDate)
          : new Date();

        const amount = `-${formatDecimal(adminShare)}`;
        const payload = {
          condition: "À vista",
          name: `Pagamento fatura - ${card.name}`,
          paymentMethod: "Pix",
          note: invoiceNote,
          amount,
          purchaseDate: invoiceDate,
          transactionType: "Despesa" as const,
          period,
          isSettled: true,
          userId,
          contaId: card.contaId,
          categoriaId: paymentCategory?.id ?? null,
          pagadorId: adminPagador.id,
        };

        const existingPayment = await tx.query.lancamentos.findFirst({
          columns: { id: true },
          where: and(
            eq(lancamentos.userId, userId),
            eq(lancamentos.note, invoiceNote)
          ),
        });

        if (existingPayment) {
          await tx
            .update(lancamentos)
            .set(payload)
            .where(eq(lancamentos.id, existingPayment.id));
          paymentTransactionId = existingPayment.id;
        } else {
          const [created] = await tx
            .insert(lancamentos)
            .values(payload)
            .returning({ id: lancamentos.id });
          paymentTransactionId = created?.id ?? null;
        }
      }
    }
  } else {
    await tx
      .delete(lancamentos)
      .where(
        and(
          eq(lancamentos.userId, userId),
          eq(lancamentos.note, invoiceNote)
        )
      );
  }

  return {
    cardId: card.id,
    period,
    status,
    paymentTransactionId,
  };
}
