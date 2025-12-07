import { AccountDialog } from "@/components/contas/account-dialog";
import { AccountStatementCard } from "@/components/contas/account-statement-card";
import type { Account } from "@/components/contas/types";
import { OfxImportDialog } from "@/components/contas/ofx-import/ofx-import-dialog";
import { LancamentosPage as LancamentosSection } from "@/components/lancamentos/page/lancamentos-page";
import MonthPicker from "@/components/month-picker/month-picker";
import { Button } from "@/components/ui/button";
import { lancamentos } from "@/db/schema";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/auth/server";
import {
  buildLancamentoWhere,
  buildOptionSets,
  buildSluggedFilters,
  buildSlugMaps,
  extractLancamentoSearchFilters,
  fetchLancamentoFilterSources,
  getSingleParam,
  mapLancamentosData,
  type ResolvedSearchParams,
} from "@/lib/lancamentos/page-helpers";
import { loadLogoOptions } from "@/lib/logo/options";
import { parsePeriodParam } from "@/lib/utils/period";
import { RiFileUploadLine, RiPencilLine } from "@remixicon/react";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { fetchAccountData, fetchAccountSummary } from "./data";

type PageSearchParams = Promise<ResolvedSearchParams>;

type PageProps = {
  params: Promise<{ contaId: string }>;
  searchParams?: PageSearchParams;
};

const capitalize = (value: string) =>
  value.length > 0 ? value[0]?.toUpperCase().concat(value.slice(1)) : value;

export default async function Page({ params, searchParams }: PageProps) {
  const { contaId } = await params;
  const userId = await getUserId();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const periodoParamRaw = getSingleParam(resolvedSearchParams, "periodo");
  const {
    period: selectedPeriod,
    monthName,
    year,
  } = parsePeriodParam(periodoParamRaw);

  const searchFilters = extractLancamentoSearchFilters(resolvedSearchParams);

  const account = await fetchAccountData(userId, contaId);

  if (!account) {
    notFound();
  }

  const [filterSources, logoOptions, accountSummary] = await Promise.all([
    fetchLancamentoFilterSources(userId),
    loadLogoOptions(),
    fetchAccountSummary(userId, contaId, selectedPeriod),
  ]);
  const sluggedFilters = buildSluggedFilters(filterSources);
  const slugMaps = buildSlugMaps(sluggedFilters);

  const filters = buildLancamentoWhere({
    userId,
    period: selectedPeriod,
    filters: searchFilters,
    slugMaps,
    accountId: account.id,
  });

  filters.push(eq(lancamentos.isSettled, true));

  const lancamentoRows = await db.query.lancamentos.findMany({
    where: and(...filters),
    with: {
      pagador: true,
      conta: true,
      cartao: true,
      categoria: true,
    },
    orderBy: desc(lancamentos.purchaseDate),
  });

  const lancamentosData = mapLancamentosData(lancamentoRows);

  const { openingBalance, currentBalance, totalIncomes, totalExpenses } =
    accountSummary;

  const periodLabel = `${capitalize(monthName)} de ${year}`;

  const accountDialogData: Account = {
    id: account.id,
    name: account.name,
    accountType: account.accountType,
    status: account.status,
    note: account.note,
    logo: account.logo,
    initialBalance: Number(account.initialBalance ?? 0),
    balance: currentBalance,
  };

  const {
    pagadorOptions,
    splitPagadorOptions,
    defaultPagadorId,
    contaOptions,
    cartaoOptions,
    categoriaOptions,
    pagadorFilterOptions,
    categoriaFilterOptions,
    contaCartaoFilterOptions,
  } = buildOptionSets({
    ...sluggedFilters,
    pagadorRows: filterSources.pagadorRows,
    limitContaId: account.id,
  });

  return (
    <main className="flex flex-col gap-6">
      <MonthPicker />

      <AccountStatementCard
        accountName={account.name}
        accountType={account.accountType}
        status={account.status}
        periodLabel={periodLabel}
        openingBalance={openingBalance}
        currentBalance={currentBalance}
        totalIncomes={totalIncomes}
        totalExpenses={totalExpenses}
        logo={account.logo}
        actions={
          <div className="flex items-center gap-1">
            {account.status.toLowerCase() === "ativa" && (
              <OfxImportDialog
                contaId={account.id}
                categorias={categoriaOptions.map((c) => ({
                  id: c.value,
                  nome: c.label,
                  icone: c.icon ?? undefined,
                }))}
                pagadores={pagadorOptions.map((p) => ({
                  id: p.value,
                  nome: p.label,
                  logo: p.icon ?? undefined,
                }))}
                defaultCategoriaId={categoriaOptions[0]?.value}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Importar OFX"
                  >
                    <RiFileUploadLine className="size-4" />
                  </Button>
                }
              />
            )}
            <AccountDialog
              mode="update"
              account={accountDialogData}
              logoOptions={logoOptions}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Editar conta"
                >
                  <RiPencilLine className="size-4" />
                </Button>
              }
            />
          </div>
        }
      />

      <section className="flex flex-col gap-4">
        <LancamentosSection
          lancamentos={lancamentosData}
          pagadorOptions={pagadorOptions}
          splitPagadorOptions={splitPagadorOptions}
          defaultPagadorId={defaultPagadorId}
          contaOptions={contaOptions}
          cartaoOptions={cartaoOptions}
          categoriaOptions={categoriaOptions}
          pagadorFilterOptions={pagadorFilterOptions}
          categoriaFilterOptions={categoriaFilterOptions}
          contaCartaoFilterOptions={contaCartaoFilterOptions}
          estabelecimentos={[]}
          selectedPeriod={selectedPeriod}
          allowCreate={false}
        />
      </section>
    </main>
  );
}
