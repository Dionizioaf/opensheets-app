import { installmentAnticipations, lancamentos } from "@/db/schema";
import { db } from "@/lib/db";
import {
  generateAnticipationDescription,
  generateAnticipationNote,
  getAnticipatedInstallmentNumbers,
} from "@/lib/installments/anticipation-helpers";
import type { EligibleInstallment } from "@/lib/installments/anticipation-types";
import { formatDecimalForDbRequired } from "@/lib/utils/currency";
import { and, eq, inArray, isNull, or } from "drizzle-orm";

/**
 * Shared installment-anticipation logic, single-sourced between the dashboard
 * action (`createInstallmentAnticipationAction`) and the MCP tool
 * (`finance_anticipate_installments`) so the two surfaces compute the same
 * discount/total/final figures and write the same records. Callers own the
 * transaction and any cache revalidation.
 */
type DbHandle = typeof db;

export interface AnticipationParams {
  userId: string;
  seriesId: string;
  /** Concrete eligible installment ids to anticipate (the MCP tool resolves any
   * count/through-period selector to ids before calling in). */
  installmentIds: string[];
  anticipationPeriod: string;
  discount?: number;
  pagadorId?: string | null;
  categoriaId?: string | null;
  note?: string | null;
}

type InstallmentRow = typeof lancamentos.$inferSelect;

/**
 * Loads and validates the selected installments: every id must belong to the
 * user + series and still be eligible (unpaid and not already anticipated).
 */
async function loadAnticipationInstallments(
  handle: DbHandle,
  userId: string,
  seriesId: string,
  installmentIds: string[]
): Promise<InstallmentRow[]> {
  if (installmentIds.length === 0) {
    throw new Error("Nenhuma parcela selecionada para antecipação.");
  }

  const installments = await handle.query.lancamentos.findMany({
    where: and(
      inArray(lancamentos.id, installmentIds),
      eq(lancamentos.userId, userId),
      eq(lancamentos.seriesId, seriesId),
      or(eq(lancamentos.isSettled, false), isNull(lancamentos.isSettled)),
      eq(lancamentos.isAnticipated, false)
    ),
  });

  if (installments.length !== installmentIds.length) {
    throw new Error(
      "Algumas parcelas não estão elegíveis para antecipação."
    );
  }

  return installments;
}

/** Total/discount/final figures. Mirrors the dashboard action exactly. */
function computeAnticipation(
  installments: InstallmentRow[],
  discountInput?: number
) {
  const totalAmountCents = installments.reduce(
    (sum, inst) => sum + Number(inst.amount) * 100,
    0
  );
  const totalAmount = totalAmountCents / 100;
  const totalAmountAbs = Math.abs(totalAmount);
  const discount = discountInput || 0;

  if (discount > totalAmountAbs) {
    throw new Error(
      "O desconto não pode ser maior que o valor total das parcelas."
    );
  }

  // Expense totals are negative: adding the discount reduces the expense.
  const finalAmount =
    totalAmount < 0 ? totalAmount + discount : totalAmount - discount;

  return { totalAmount, totalAmountAbs, discount, finalAmount };
}

/** Maps a full installment row to the helper-facing shape. */
function toEligible(inst: InstallmentRow): EligibleInstallment {
  return {
    id: inst.id,
    name: inst.name,
    amount: inst.amount,
    period: inst.period,
    purchaseDate: inst.purchaseDate,
    dueDate: inst.dueDate,
    currentInstallment: inst.currentInstallment,
    installmentCount: inst.installmentCount,
    paymentMethod: inst.paymentMethod,
    categoriaId: inst.categoriaId,
    pagadorId: inst.pagadorId,
  };
}

/** Non-mutating impact summary for an anticipation. Safe in MCP `preview` mode. */
export async function previewAnticipation(params: AnticipationParams) {
  const { userId, seriesId, installmentIds, anticipationPeriod, discount } =
    params;
  const installments = await loadAnticipationInstallments(
    db,
    userId,
    seriesId,
    installmentIds
  );
  const figures = computeAnticipation(installments, discount);

  return {
    seriesId,
    anticipationPeriod,
    installmentCount: installments.length,
    anticipatedInstallmentIds: installments.map((inst) => inst.id),
    installmentNumbers: getAnticipatedInstallmentNumbers(
      installments.map(toEligible)
    ),
    totalAmount: figures.totalAmount,
    discount: figures.discount,
    finalAmount: figures.finalAmount,
  };
}

/**
 * Mutating anticipation. Must run inside a caller-owned transaction. Creates the
 * anticipation lançamento and record, then flags the source installments as
 * anticipated and zeroes their amounts so they are not counted twice.
 */
export async function applyAnticipation(
  tx: DbHandle,
  params: AnticipationParams
) {
  const { userId, seriesId, installmentIds, anticipationPeriod, note } = params;
  const installments = await loadAnticipationInstallments(
    tx,
    userId,
    seriesId,
    installmentIds
  );
  const { totalAmount, discount, finalAmount } = computeAnticipation(
    installments,
    params.discount
  );

  const firstInstallment = installments[0]!;

  const [newLancamento] = await tx
    .insert(lancamentos)
    .values({
      name: generateAnticipationDescription(
        firstInstallment.name,
        installments.length
      ),
      condition: "À vista",
      transactionType: firstInstallment.transactionType,
      paymentMethod: firstInstallment.paymentMethod,
      amount: formatDecimalForDbRequired(finalAmount),
      purchaseDate: new Date(),
      period: anticipationPeriod,
      dueDate: null,
      isSettled: false,
      pagadorId: params.pagadorId ?? firstInstallment.pagadorId,
      categoriaId: params.categoriaId ?? firstInstallment.categoriaId,
      cartaoId: firstInstallment.cartaoId,
      contaId: firstInstallment.contaId,
      note: note || generateAnticipationNote(installments.map(toEligible)),
      userId,
      installmentCount: null,
      currentInstallment: null,
      recurrenceCount: null,
      isAnticipated: false,
      isDivided: false,
      seriesId: null,
      transferId: null,
      anticipationId: null,
      boletoPaymentDate: null,
    })
    .returning();

  const [anticipation] = await tx
    .insert(installmentAnticipations)
    .values({
      seriesId,
      anticipationPeriod,
      anticipationDate: new Date(),
      anticipatedInstallmentIds: installmentIds,
      totalAmount: formatDecimalForDbRequired(totalAmount),
      installmentCount: installments.length,
      discount: formatDecimalForDbRequired(discount),
      lancamentoId: newLancamento.id,
      pagadorId: params.pagadorId ?? firstInstallment.pagadorId,
      categoriaId: params.categoriaId ?? firstInstallment.categoriaId,
      note: note || null,
      userId,
    })
    .returning();

  await tx
    .update(lancamentos)
    .set({
      isAnticipated: true,
      anticipationId: anticipation.id,
      amount: "0",
    })
    .where(inArray(lancamentos.id, installmentIds));

  return {
    anticipationId: anticipation.id,
    lancamentoId: newLancamento.id,
    seriesId,
    anticipationPeriod,
    installmentCount: installments.length,
    anticipatedInstallmentIds: installmentIds,
    totalAmount,
    discount,
    finalAmount,
  };
}
