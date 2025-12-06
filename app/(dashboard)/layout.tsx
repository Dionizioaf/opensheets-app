import { PrivacyProvider } from "@/components/privacy-provider";
import { SidebarLayout } from "@/components/sidebar/sidebar-layout";
import { getUserSession } from "@/lib/auth/server";
import { fetchDashboardNotifications } from "@/lib/dashboard/notifications";
import { fetchPagadoresWithAccess } from "@/lib/pagadores/access";
import { PAGADOR_ROLE_ADMIN } from "@/lib/pagadores/constants";
import { parsePeriodParam } from "@/lib/utils/period";

export default async function DashboardLayout({
  children,
  searchParams,
}: Readonly<{
  children: React.ReactNode;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const session = await getUserSession();
  const pagadoresList = await fetchPagadoresWithAccess(session.user.id);

  // Encontrar o pagador admin do usuário
  const adminPagador = pagadoresList.find(
    (p) => p.role === PAGADOR_ROLE_ADMIN && p.userId === session.user.id
  );

  // Buscar notificações para o período atual
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const periodoParam = resolvedSearchParams?.periodo;
  const singlePeriodoParam =
    typeof periodoParam === "string"
      ? periodoParam
      : Array.isArray(periodoParam)
        ? periodoParam[0]
        : null;
  const { period: currentPeriod } = parsePeriodParam(
    singlePeriodoParam ?? null
  );
  const notificationsSnapshot = await fetchDashboardNotifications(
    session.user.id,
    currentPeriod
  );

  return (
    <PrivacyProvider>
      <SidebarLayout
        user={{ ...session.user, image: session.user.image ?? null }}
        pagadorAvatarUrl={adminPagador?.avatarUrl ?? null}
        pagadores={pagadoresList.map((item) => ({
          id: item.id,
          name: item.name,
          avatarUrl: item.avatarUrl,
          canEdit: item.canEdit,
        }))}
        notificationsSnapshot={notificationsSnapshot}
      >
        {children}
      </SidebarLayout>
    </PrivacyProvider>
  );
}
