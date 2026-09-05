"use server";

import {
  categorias,
  installmentAnticipations,
  lancamentos,
  pagadores,
  type InstallmentAnticipation,
  type Lancamento,
} from "@/db/schema";
import { handleActionError } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/server";
import { applyAnticipation } from "@/lib/finance/anticipation-service";
import type {
  CancelAnticipationInput,
  CreateAnticipationInput,
  EligibleInstallment,
  InstallmentAnticipationWithRelations,
} from "@/lib/installments/anticipation-types";
import { uuidSchema } from "@/lib/schemas/common";
import { formatDecimalForDbRequired } from "@/lib/utils/currency";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Schema de validação para criar antecipação
 */
const createAnticipationSchema = z.object({
  seriesId: uuidSchema("Série"),
  installmentIds: z
    .array(uuidSchema("Parcela"))
    .min(1, "Selecione pelo menos uma parcela para antecipar."),
  anticipationPeriod: z
    .string()
    .trim()
    .regex(/^(\d{4})-(\d{2})$/, {
      message: "Selecione um período válido.",
    }),
  discount: z.coerce
    .number()
    .min(0, "Informe um desconto maior ou igual a zero.")
    .optional()
    .default(0),
  pagadorId: uuidSchema("Pagador").optional(),
  categoriaId: uuidSchema("Categoria").optional(),
  note: z.string().trim().optional(),
});

/**
 * Schema de validação para cancelar antecipação
 */
const cancelAnticipationSchema = z.object({
  anticipationId: uuidSchema("Antecipação"),
});

/**
 * Busca parcelas elegíveis para antecipação de uma série
 */
export async function getEligibleInstallmentsAction(
  seriesId: string
): Promise<ActionResult<EligibleInstallment[]>> {
  try {
    const user = await getUser();

    // Validar seriesId
    const validatedSeriesId = uuidSchema("Série").parse(seriesId);

    // Buscar todas as parcelas da série que estão elegíveis
    const rows = await db.query.lancamentos.findMany({
      where: and(
        eq(lancamentos.seriesId, validatedSeriesId),
        eq(lancamentos.userId, user.id),
        eq(lancamentos.condition, "Parcelado"),
        // Apenas parcelas não pagas e não antecipadas
        or(eq(lancamentos.isSettled, false), isNull(lancamentos.isSettled)),
        eq(lancamentos.isAnticipated, false)
      ),
      orderBy: [asc(lancamentos.currentInstallment)],
      columns: {
        id: true,
        name: true,
        amount: true,
        period: true,
        purchaseDate: true,
        dueDate: true,
        currentInstallment: true,
        installmentCount: true,
        paymentMethod: true,
        categoriaId: true,
        pagadorId: true,
      },
    });

    const eligibleInstallments: EligibleInstallment[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      period: row.period,
      purchaseDate: row.purchaseDate,
      dueDate: row.dueDate,
      currentInstallment: row.currentInstallment,
      installmentCount: row.installmentCount,
      paymentMethod: row.paymentMethod,
      categoriaId: row.categoriaId,
      pagadorId: row.pagadorId,
    }));

    return {
      success: true,
      data: eligibleInstallments,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Cria uma antecipação de parcelas
 */
export async function createInstallmentAnticipationAction(
  input: CreateAnticipationInput
): Promise<ActionResult> {
  try {
    const user = await getUser();
    const data = createAnticipationSchema.parse(input);

    const result = await db.transaction((tx) =>
      applyAnticipation(tx, {
        userId: user.id,
        seriesId: data.seriesId,
        installmentIds: data.installmentIds,
        anticipationPeriod: data.anticipationPeriod,
        discount: data.discount,
        pagadorId: data.pagadorId,
        categoriaId: data.categoriaId,
        note: data.note,
      })
    );

    revalidatePath("/lancamentos");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `${result.installmentCount} ${
        result.installmentCount === 1
          ? "parcela antecipada"
          : "parcelas antecipadas"
      } com sucesso!`,
    };

  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Busca histórico de antecipações de uma série
 */
export async function getInstallmentAnticipationsAction(
  seriesId: string
): Promise<ActionResult<InstallmentAnticipationWithRelations[]>> {
  try {
    const user = await getUser();

    // Validar seriesId
    const validatedSeriesId = uuidSchema("Série").parse(seriesId);

    // Usar query builder ao invés de db.query para evitar problemas de tipagem
    const anticipations = await db
      .select({
        id: installmentAnticipations.id,
        seriesId: installmentAnticipations.seriesId,
        anticipationPeriod: installmentAnticipations.anticipationPeriod,
        anticipationDate: installmentAnticipations.anticipationDate,
        anticipatedInstallmentIds: installmentAnticipations.anticipatedInstallmentIds,
        totalAmount: installmentAnticipations.totalAmount,
        installmentCount: installmentAnticipations.installmentCount,
        discount: installmentAnticipations.discount,
        lancamentoId: installmentAnticipations.lancamentoId,
        pagadorId: installmentAnticipations.pagadorId,
        categoriaId: installmentAnticipations.categoriaId,
        note: installmentAnticipations.note,
        userId: installmentAnticipations.userId,
        createdAt: installmentAnticipations.createdAt,
        // Joins
        lancamento: lancamentos,
        pagador: pagadores,
        categoria: categorias,
      })
      .from(installmentAnticipations)
      .leftJoin(lancamentos, eq(installmentAnticipations.lancamentoId, lancamentos.id))
      .leftJoin(pagadores, eq(installmentAnticipations.pagadorId, pagadores.id))
      .leftJoin(categorias, eq(installmentAnticipations.categoriaId, categorias.id))
      .where(
        and(
          eq(installmentAnticipations.seriesId, validatedSeriesId),
          eq(installmentAnticipations.userId, user.id)
        )
      )
      .orderBy(desc(installmentAnticipations.createdAt));

    return {
      success: true,
      data: anticipations,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Cancela uma antecipação de parcelas
 * Remove o lançamento de antecipação e restaura as parcelas originais
 */
export async function cancelInstallmentAnticipationAction(
  input: CancelAnticipationInput
): Promise<ActionResult> {
  try {
    const user = await getUser();
    const data = cancelAnticipationSchema.parse(input);

    await db.transaction(async (tx) => {
      // 1. Buscar antecipação usando query builder
      const anticipationRows = await tx
        .select({
          id: installmentAnticipations.id,
          seriesId: installmentAnticipations.seriesId,
          anticipationPeriod: installmentAnticipations.anticipationPeriod,
          anticipationDate: installmentAnticipations.anticipationDate,
          anticipatedInstallmentIds: installmentAnticipations.anticipatedInstallmentIds,
          totalAmount: installmentAnticipations.totalAmount,
          installmentCount: installmentAnticipations.installmentCount,
          discount: installmentAnticipations.discount,
          lancamentoId: installmentAnticipations.lancamentoId,
          pagadorId: installmentAnticipations.pagadorId,
          categoriaId: installmentAnticipations.categoriaId,
          note: installmentAnticipations.note,
          userId: installmentAnticipations.userId,
          createdAt: installmentAnticipations.createdAt,
          lancamento: lancamentos,
        })
        .from(installmentAnticipations)
        .leftJoin(lancamentos, eq(installmentAnticipations.lancamentoId, lancamentos.id))
        .where(
          and(
            eq(installmentAnticipations.id, data.anticipationId),
            eq(installmentAnticipations.userId, user.id)
          )
        )
        .limit(1);

      const anticipation = anticipationRows[0];

      if (!anticipation) {
        throw new Error("Antecipação não encontrada.");
      }

      // 2. Verificar se o lançamento já foi pago
      if (anticipation.lancamento?.isSettled === true) {
        throw new Error(
          "Não é possível cancelar uma antecipação já paga. Remova o pagamento primeiro."
        );
      }

      // 3. Calcular valor original por parcela (totalAmount sem desconto / quantidade)
      const originalTotalAmount = Number(anticipation.totalAmount);
      const originalValuePerInstallment =
        originalTotalAmount / anticipation.installmentCount;

      // 4. Remover flag de antecipação e restaurar valores das parcelas
      await tx
        .update(lancamentos)
        .set({
          isAnticipated: false,
          anticipationId: null,
          amount: formatDecimalForDbRequired(originalValuePerInstallment),
        })
        .where(
          inArray(
            lancamentos.id,
            anticipation.anticipatedInstallmentIds as string[]
          )
        );

      // 5. Deletar lançamento de antecipação
      await tx
        .delete(lancamentos)
        .where(eq(lancamentos.id, anticipation.lancamentoId));

      // 6. Deletar registro de antecipação
      await tx
        .delete(installmentAnticipations)
        .where(eq(installmentAnticipations.id, data.anticipationId));
    });

    revalidatePath("/lancamentos");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Antecipação cancelada com sucesso!",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Busca detalhes de uma antecipação específica
 */
export async function getAnticipationDetailsAction(
  anticipationId: string
): Promise<ActionResult<InstallmentAnticipationWithRelations>> {
  try {
    const user = await getUser();

    // Validar anticipationId
    const validatedId = uuidSchema("Antecipação").parse(anticipationId);

    const anticipation = await db.query.installmentAnticipations.findFirst({
      where: and(
        eq(installmentAnticipations.id, validatedId),
        eq(installmentAnticipations.userId, user.id)
      ),
      with: {
        lancamento: true,
        pagador: true,
        categoria: true,
      },
    });

    if (!anticipation) {
      return {
        success: false,
        error: "Antecipação não encontrada.",
      };
    }

    return {
      success: true,
      data: anticipation,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
