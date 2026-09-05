"use server";

import { cartoes, lancamentos } from "@/db/schema";
import { buildInvoicePaymentNote } from "@/lib/accounts/constants";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/server";
import {
  INVOICE_PAYMENT_STATUS,
  INVOICE_STATUS_VALUES,
  PERIOD_FORMAT_REGEX,
  type InvoicePaymentStatus,
} from "@/lib/faturas";
import { applyInvoicePaymentStatus } from "@/lib/finance/invoice-payment-service";
import { parseLocalDateString } from "@/lib/utils/date";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateInvoicePaymentStatusSchema = z.object({
  cartaoId: z
    .string({ message: "Cartão inválido." })
    .uuid("Cartão inválido."),
  period: z
    .string({ message: "Período inválido." })
    .regex(PERIOD_FORMAT_REGEX, "Período inválido."),
  status: z.enum(
    INVOICE_STATUS_VALUES as [InvoicePaymentStatus, ...InvoicePaymentStatus[]]
  ),
  paymentDate: z.string().optional(),
});

type UpdateInvoicePaymentStatusInput = z.infer<
  typeof updateInvoicePaymentStatusSchema
>;

type ActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

const successMessageByStatus: Record<InvoicePaymentStatus, string> = {
  [INVOICE_PAYMENT_STATUS.PAID]: "Fatura marcada como paga.",
  [INVOICE_PAYMENT_STATUS.PENDING]: "Pagamento da fatura foi revertido.",
};

export async function updateInvoicePaymentStatusAction(
  input: UpdateInvoicePaymentStatusInput
): Promise<ActionResult> {
  try {
    const user = await getUser();
    const data = updateInvoicePaymentStatusSchema.parse(input);

    await db.transaction(async (tx: typeof db) => {
      await applyInvoicePaymentStatus(tx, {
        userId: user.id,
        cartaoId: data.cartaoId,
        period: data.period,
        status: data.status,
        paymentDate: data.paymentDate,
      });
    });

    revalidatePath(`/cartoes/${data.cartaoId}/fatura`);
    revalidatePath("/cartoes");
    revalidatePath("/contas");

    return { success: true, message: successMessageByStatus[data.status] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? "Dados inválidos.",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro inesperado.",
    };
  }
}

const updatePaymentDateSchema = z.object({
  cartaoId: z
    .string({ message: "Cartão inválido." })
    .uuid("Cartão inválido."),
  period: z
    .string({ message: "Período inválido." })
    .regex(PERIOD_FORMAT_REGEX, "Período inválido."),
  paymentDate: z.string({ message: "Data de pagamento inválida." }),
});

type UpdatePaymentDateInput = z.infer<typeof updatePaymentDateSchema>;

export async function updatePaymentDateAction(
  input: UpdatePaymentDateInput
): Promise<ActionResult> {
  try {
    const user = await getUser();
    const data = updatePaymentDateSchema.parse(input);

    await db.transaction(async (tx: typeof db) => {
      const card = await tx.query.cartoes.findFirst({
        columns: { id: true },
        where: and(eq(cartoes.id, data.cartaoId), eq(cartoes.userId, user.id)),
      });

      if (!card) {
        throw new Error("Cartão não encontrado.");
      }

      const invoiceNote = buildInvoicePaymentNote(card.id, data.period);

      const existingPayment = await tx.query.lancamentos.findFirst({
        columns: { id: true },
        where: and(
          eq(lancamentos.userId, user.id),
          eq(lancamentos.note, invoiceNote)
        ),
      });

      if (!existingPayment) {
        throw new Error("Pagamento não encontrado.");
      }

      await tx
        .update(lancamentos)
        .set({
          purchaseDate: parseLocalDateString(data.paymentDate),
        })
        .where(eq(lancamentos.id, existingPayment.id));
    });

    revalidatePath(`/cartoes/${data.cartaoId}/fatura`);
    revalidatePath("/cartoes");
    revalidatePath("/contas");

    return { success: true, message: "Data de pagamento atualizada." };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? "Dados inválidos.",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro inesperado.",
    };
  }
}
