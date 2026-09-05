import {
  cartoes,
  categorias,
  contas,
  faturas,
  lancamentos,
  orcamentos,
  pagadores,
} from "@/db/schema";
import {
  ACCOUNT_AUTO_INVOICE_NOTE_PREFIX,
  INITIAL_BALANCE_NOTE,
} from "@/lib/accounts/constants";
import { db } from "@/lib/db";
import { PAGADOR_ROLE_ADMIN } from "@/lib/pagadores/constants";
import { fetchCategoryReport } from "@/lib/relatorios/fetch-category-report";
import { buildPeriodRange } from "@/lib/utils/period";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { ListTransactionsInput } from "./schemas";

const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const dateValue = (value: Date | null | undefined) =>
  value ? value.toISOString().slice(0, 10) : null;

const parseDate = (value: string) => new Date(`${value}T12:00:00`);

export async function getFinanceOverview(userId: string, period: string) {
  const [totals, accounts, budgets, obligations] = await Promise.all([
    db
      .select({
        transactionType: lancamentos.transactionType,
        total: sql<string>`coalesce(sum(${lancamentos.amount}), 0)`,
        count: count(),
      })
      .from(lancamentos)
      .innerJoin(pagadores, eq(lancamentos.pagadorId, pagadores.id))
      .where(
        and(
          eq(lancamentos.userId, userId),
          eq(lancamentos.period, period),
          eq(pagadores.role, PAGADOR_ROLE_ADMIN),
          or(
            isNull(lancamentos.note),
            sql`${lancamentos.note} NOT LIKE ${`${ACCOUNT_AUTO_INVOICE_NOTE_PREFIX}%`}`
          ),
          sql`${lancamentos.transactionType} <> 'Transferência'`
        )
      )
      .groupBy(lancamentos.transactionType),
    listAccounts(userId),
    listBudgets(userId, period),
    db
      .select({
        pending: count(),
        total: sql<string>`coalesce(sum(abs(${lancamentos.amount})), 0)`,
      })
      .from(lancamentos)
      .where(
        and(
          eq(lancamentos.userId, userId),
          eq(lancamentos.period, period),
          or(eq(lancamentos.isSettled, false), isNull(lancamentos.isSettled))
        )
      ),
  ]);

  const income = totals
    .filter((item) => item.transactionType === "Receita")
    .reduce((sum, item) => sum + Math.abs(numberValue(item.total)), 0);
  const expenses = totals
    .filter((item) => item.transactionType === "Despesa")
    .reduce((sum, item) => sum + Math.abs(numberValue(item.total)), 0);

  return {
    period,
    income,
    expenses,
    net: income - expenses,
    savingsRatePercent: income > 0 ? ((income - expenses) / income) * 100 : null,
    accountBalance: accounts
      .filter((item) => !item.excludeFromBalance)
      .reduce((sum, item) => sum + item.balance, 0),
    accounts,
    budgets,
    pending: {
      count: numberValue(obligations[0]?.pending),
      total: numberValue(obligations[0]?.total),
    },
  };
}

export async function listAccounts(userId: string) {
  const rows = await db
    .select({
      id: contas.id,
      name: contas.name,
      accountType: contas.accountType,
      status: contas.status,
      initialBalance: contas.initialBalance,
      excludeFromBalance: contas.excludeFromBalance,
      movements: sql<string>`
        coalesce(sum(
          case
            when ${lancamentos.note} = ${INITIAL_BALANCE_NOTE} then 0
            when ${pagadores.role} <> ${PAGADOR_ROLE_ADMIN} then 0
            when ${lancamentos.isSettled} = true then ${lancamentos.amount}
            else 0
          end
        ), 0)
      `,
    })
    .from(contas)
    .leftJoin(
      lancamentos,
      and(
        eq(lancamentos.contaId, contas.id),
        eq(lancamentos.userId, userId)
      )
    )
    .leftJoin(pagadores, eq(lancamentos.pagadorId, pagadores.id))
    .where(eq(contas.userId, userId))
    .groupBy(contas.id)
    .orderBy(asc(contas.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    accountType: row.accountType,
    status: row.status,
    initialBalance: numberValue(row.initialBalance),
    balance: numberValue(row.initialBalance) + numberValue(row.movements),
    excludeFromBalance: row.excludeFromBalance,
  }));
}

export async function listTransactions(
  userId: string,
  input: ListTransactionsInput
) {
  const conditions: SQL[] = [eq(lancamentos.userId, userId)];
  if (input.period) conditions.push(eq(lancamentos.period, input.period));
  if (input.dateFrom) {
    conditions.push(gte(lancamentos.purchaseDate, parseDate(input.dateFrom)));
  }
  if (input.dateTo) {
    conditions.push(lte(lancamentos.purchaseDate, parseDate(input.dateTo)));
  }
  if (input.accountId) conditions.push(eq(lancamentos.contaId, input.accountId));
  if (input.cardId) conditions.push(eq(lancamentos.cartaoId, input.cardId));
  if (input.categoryId) {
    conditions.push(eq(lancamentos.categoriaId, input.categoryId));
  }
  if (input.payerId) conditions.push(eq(lancamentos.pagadorId, input.payerId));
  if (input.transactionType) {
    conditions.push(eq(lancamentos.transactionType, input.transactionType));
  }
  if (input.settled !== undefined) {
    conditions.push(eq(lancamentos.isSettled, input.settled));
  }
  if (input.search) {
    conditions.push(ilike(lancamentos.name, `%${input.search}%`));
  }

  const where = and(...conditions);
  const offset = (input.page - 1) * input.limit;
  const [rows, totalRows] = await Promise.all([
    db.query.lancamentos.findMany({
      where,
      with: {
        conta: { columns: { id: true, name: true } },
        cartao: { columns: { id: true, name: true } },
        categoria: { columns: { id: true, name: true, type: true } },
        pagador: { columns: { id: true, name: true } },
      },
      orderBy: [desc(lancamentos.purchaseDate), desc(lancamentos.createdAt)],
      limit: input.limit,
      offset,
    }),
    db.select({ value: count() }).from(lancamentos).where(where),
  ]);

  return {
    page: input.page,
    limit: input.limit,
    total: numberValue(totalRows[0]?.value),
    transactions: rows.map(serializeTransaction),
  };
}

export async function getTransaction(userId: string, id: string) {
  const row = await db.query.lancamentos.findFirst({
    where: and(eq(lancamentos.id, id), eq(lancamentos.userId, userId)),
    with: {
      conta: { columns: { id: true, name: true } },
      cartao: { columns: { id: true, name: true } },
      categoria: { columns: { id: true, name: true, type: true } },
      pagador: { columns: { id: true, name: true } },
      anticipation: true,
    },
  });
  if (!row) throw new Error("Transaction not found.");

  let series: ReturnType<typeof serializeTransaction>[] = [];
  if (row.seriesId) {
    const seriesRows = await db.query.lancamentos.findMany({
      where: and(
        eq(lancamentos.userId, userId),
        eq(lancamentos.seriesId, row.seriesId)
      ),
      with: {
        conta: { columns: { id: true, name: true } },
        cartao: { columns: { id: true, name: true } },
        categoria: { columns: { id: true, name: true, type: true } },
        pagador: { columns: { id: true, name: true } },
      },
      orderBy: asc(lancamentos.purchaseDate),
    });
    series = seriesRows.map(serializeTransaction);
  }

  return { transaction: serializeTransaction(row), series };
}

export async function getAccountStatement(
  userId: string,
  accountId: string,
  period: string
) {
  const account = await db.query.contas.findFirst({
    where: and(eq(contas.id, accountId), eq(contas.userId, userId)),
  });
  if (!account) throw new Error("Account not found.");

  const result = await listTransactions(userId, {
    accountId,
    period,
    page: 1,
    limit: 100,
  });
  const allAccounts = await listAccounts(userId);
  const current = allAccounts.find((item) => item.id === accountId)!;
  const income = result.transactions
    .filter((item) => item.transactionType === "Receita")
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const expenses = result.transactions
    .filter((item) => item.transactionType === "Despesa")
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);

  return {
    account: current,
    period,
    income,
    expenses,
    net: income - expenses,
    ...result,
  };
}

export async function listCards(userId: string) {
  const rows = await db.query.cartoes.findMany({
    where: eq(cartoes.userId, userId),
    with: { conta: { columns: { id: true, name: true } } },
    orderBy: asc(cartoes.name),
  });
  const usageRows = await db
    .select({
      cardId: lancamentos.cartaoId,
      total: sql<string>`coalesce(sum(abs(${lancamentos.amount})), 0)`,
    })
    .from(lancamentos)
    .where(
      and(
        eq(lancamentos.userId, userId),
        or(eq(lancamentos.isSettled, false), isNull(lancamentos.isSettled))
      )
    )
    .groupBy(lancamentos.cartaoId);
  const usage = new Map(
    usageRows
      .filter((row) => row.cardId)
      .map((row) => [row.cardId!, numberValue(row.total)])
  );

  return rows.map((row) => {
    const inUse = usage.get(row.id) ?? 0;
    const limit = row.limit === null ? null : numberValue(row.limit);
    return {
      id: row.id,
      name: row.name,
      brand: row.brand,
      status: row.status,
      closingDay: Number(row.closingDay),
      dueDay: Number(row.dueDay),
      limit,
      limitInUse: inUse,
      limitAvailable: limit === null ? null : Math.max(limit - inUse, 0),
      account: row.conta,
    };
  });
}

export async function getInvoice(
  userId: string,
  cardId: string,
  period: string
) {
  const card = await db.query.cartoes.findFirst({
    where: and(eq(cartoes.id, cardId), eq(cartoes.userId, userId)),
  });
  if (!card) throw new Error("Card not found.");

  const [invoice, result] = await Promise.all([
    db.query.faturas.findFirst({
      where: and(
        eq(faturas.userId, userId),
        eq(faturas.cartaoId, cardId),
        eq(faturas.period, period)
      ),
    }),
    listTransactions(userId, { cardId, period, page: 1, limit: 100 }),
  ]);

  return {
    ...result,
    card: { id: card.id, name: card.name, dueDay: Number(card.dueDay) },
    period,
    paymentStatus: invoice?.paymentStatus ?? "Pendente",
    invoiceTotal: result.transactions.reduce(
      (sum, item) => sum + Math.abs(item.amount),
      0
    ),
  };
}

export async function listBudgets(userId: string, period: string) {
  const rows = await db.query.orcamentos.findMany({
    where: and(eq(orcamentos.userId, userId), eq(orcamentos.period, period)),
    with: { categoria: { columns: { id: true, name: true, icon: true } } },
  });

  return Promise.all(
    rows.map(async (row) => {
      const [spent] = await db
        .select({
          total: sql<string>`coalesce(sum(abs(${lancamentos.amount})), 0)`,
        })
        .from(lancamentos)
        .where(
          and(
            eq(lancamentos.userId, userId),
            eq(lancamentos.period, period),
            eq(lancamentos.categoriaId, row.categoriaId!),
            eq(lancamentos.transactionType, "Despesa")
          )
        );
      const amount = numberValue(row.amount);
      const spentAmount = numberValue(spent?.total);
      return {
        id: row.id,
        period,
        amount,
        spent: spentAmount,
        remaining: amount - spentAmount,
        utilizationPercent: amount > 0 ? (spentAmount / amount) * 100 : null,
        category: row.categoria,
      };
    })
  );
}

export async function getCategoryReport(
  userId: string,
  input: {
    startPeriod: string;
    endPeriod: string;
    categoryIds?: string[];
  }
) {
  const periods = buildPeriodRange(input.startPeriod, input.endPeriod);
  if (periods.length > 36) {
    throw new Error("Category report is limited to 36 months.");
  }
  const report = await fetchCategoryReport(userId, input);
  return {
    periods: report.periods,
    grandTotal: report.grandTotal,
    totals: Object.fromEntries(report.totals),
    categories: report.categories.map((item) => ({
      categoryId: item.categoryId,
      name: item.name,
      icon: item.icon,
      type: item.type,
      total: item.total,
      monthlyData: Object.fromEntries(item.monthlyData),
    })),
  };
}

export async function lookupEntities(
  userId: string,
  input: {
    query: string;
    entityTypes: Array<"account" | "card" | "category" | "payer">;
    limit: number;
  }
) {
  const pattern = `%${input.query}%`;
  const results: Record<string, unknown[]> = {};
  if (input.entityTypes.includes("account")) {
    results.accounts = await db
      .select({ id: contas.id, name: contas.name, status: contas.status })
      .from(contas)
      .where(and(eq(contas.userId, userId), ilike(contas.name, pattern)))
      .limit(input.limit);
  }
  if (input.entityTypes.includes("card")) {
    results.cards = await db
      .select({ id: cartoes.id, name: cartoes.name, status: cartoes.status })
      .from(cartoes)
      .where(and(eq(cartoes.userId, userId), ilike(cartoes.name, pattern)))
      .limit(input.limit);
  }
  if (input.entityTypes.includes("category")) {
    results.categories = await db
      .select({
        id: categorias.id,
        name: categorias.name,
        type: categorias.type,
      })
      .from(categorias)
      .where(
        and(eq(categorias.userId, userId), ilike(categorias.name, pattern))
      )
      .limit(input.limit);
  }
  if (input.entityTypes.includes("payer")) {
    results.payers = await db
      .select({
        id: pagadores.id,
        name: pagadores.name,
        status: pagadores.status,
      })
      .from(pagadores)
      .where(and(eq(pagadores.userId, userId), ilike(pagadores.name, pattern)))
      .limit(input.limit);
  }
  return results;
}

export async function getUpcomingObligations(
  userId: string,
  from: string,
  days: number
) {
  const start = parseDate(from);
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  const rows = await db.query.lancamentos.findMany({
    where: and(
      eq(lancamentos.userId, userId),
      or(eq(lancamentos.isSettled, false), isNull(lancamentos.isSettled)),
      or(
        and(
          gte(lancamentos.dueDate, start),
          lte(lancamentos.dueDate, end)
        ),
        and(
          isNull(lancamentos.dueDate),
          gte(lancamentos.purchaseDate, start),
          lte(lancamentos.purchaseDate, end)
        )
      )
    ),
    with: {
      conta: { columns: { id: true, name: true } },
      cartao: { columns: { id: true, name: true } },
      categoria: { columns: { id: true, name: true, type: true } },
      pagador: { columns: { id: true, name: true } },
    },
    orderBy: [asc(lancamentos.dueDate), asc(lancamentos.purchaseDate)],
    limit: 200,
  });

  return {
    from,
    to: end.toISOString().slice(0, 10),
    count: rows.length,
    total: rows.reduce((sum, row) => sum + Math.abs(numberValue(row.amount)), 0),
    obligations: rows.map(serializeTransaction),
  };
}

type SerializableTransaction = {
  id: string;
  name: string;
  amount: string | number;
  purchaseDate: Date;
  dueDate: Date | null;
  boletoPaymentDate: Date | null;
  period: string;
  transactionType: string;
  condition: string;
  paymentMethod: string;
  isSettled: boolean | null;
  note: string | null;
  installmentCount: number | null;
  currentInstallment: number | null;
  recurrenceCount: number | null;
  seriesId: string | null;
  transferId: string | null;
  isAnticipated: boolean | null;
  conta?: unknown;
  cartao?: unknown;
  categoria?: unknown;
  pagador?: unknown;
};

function serializeTransaction(row: SerializableTransaction) {
  return {
    id: row.id as string,
    name: row.name as string,
    amount: numberValue(row.amount),
    absoluteAmount: Math.abs(numberValue(row.amount)),
    purchaseDate: dateValue(row.purchaseDate),
    dueDate: dateValue(row.dueDate),
    boletoPaymentDate: dateValue(row.boletoPaymentDate),
    period: row.period as string,
    transactionType: row.transactionType as string,
    condition: row.condition as string,
    paymentMethod: row.paymentMethod as string,
    settled: row.isSettled as boolean | null,
    note: row.note as string | null,
    installment: row.installmentCount
      ? {
          current: row.currentInstallment as number | null,
          total: row.installmentCount as number,
        }
      : null,
    recurrenceCount: row.recurrenceCount as number | null,
    seriesId: row.seriesId as string | null,
    transferId: row.transferId as string | null,
    anticipated: row.isAnticipated as boolean | null,
    account: row.conta ?? null,
    card: row.cartao ?? null,
    category: row.categoria ?? null,
    payer: row.pagador ?? null,
  };
}
