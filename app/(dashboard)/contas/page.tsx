import { AccountsPage } from "@/components/contas/accounts-page";
import { getUserId } from "@/lib/auth/server";
import { fetchLancamentoFilterSources, buildOptionSets, buildSluggedFilters } from "@/lib/lancamentos/page-helpers";
import { fetchAccountsForUser } from "./data";

export default async function Page() {
  const userId = await getUserId();
  const now = new Date();

  const [{ accounts, logoOptions }, filterSources] = await Promise.all([
    fetchAccountsForUser(userId),
    fetchLancamentoFilterSources(userId),
  ]);

  const sluggedFilters = buildSluggedFilters(filterSources);
  const { pagadorOptions, categoriaOptions } = buildOptionSets({
    ...sluggedFilters,
    pagadorRows: filterSources.pagadorRows,
  });

  return (
    <main className="flex flex-col items-start gap-6">
      <AccountsPage
        accounts={accounts}
        logoOptions={logoOptions.map(option => option.value)}
        categoriaOptions={categoriaOptions}
        pagadorOptions={pagadorOptions}
      />
    </main>
  );
}
