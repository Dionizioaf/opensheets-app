"use client";

import { deleteAccountAction } from "@/app/(dashboard)/contas/actions";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { AccountCard } from "@/components/contas/account-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getCurrentPeriod } from "@/lib/utils/period";
import type { SelectOption } from "@/components/lancamentos/types";
import { RiAddCircleLine, RiBankLine, RiFileUploadLine } from "@remixicon/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "../ui/card";
import { AccountDialog } from "./account-dialog";
import { TransferDialog } from "./transfer-dialog";
import { OfxImportDialog } from "./ofx-import/ofx-import-dialog";
import type { Account } from "./types";

interface AccountsPageProps {
  accounts: Account[];
  logoOptions: string[];
  categoriaOptions: SelectOption[];
  pagadorOptions: SelectOption[];
}

const resolveLogoSrc = (logo: string | null) => {
  if (!logo) {
    return undefined;
  }

  const fileName = logo.split("/").filter(Boolean).pop() ?? logo;
  return `/logos/${fileName}`;
};

export function AccountsPage({
  accounts,
  logoOptions,
  categoriaOptions,
  pagadorOptions,
}: AccountsPageProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [accountToRemove, setAccountToRemove] = useState<Account | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFromAccount, setTransferFromAccount] =
    useState<Account | null>(null);
  const [importingAccountId, setImportingAccountId] = useState<string | null>(
    null
  );

  const hasAccounts = accounts.length > 0;

  const orderedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      // Coloca inativas no final
      const aIsInactive = a.status?.toLowerCase() === "inativa";
      const bIsInactive = b.status?.toLowerCase() === "inativa";

      if (aIsInactive && !bIsInactive) return 1;
      if (!aIsInactive && bIsInactive) return -1;

      // Mesma ordem alfabética dentro de cada grupo
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    });
  }, [accounts]);

  const handleEdit = useCallback((account: Account) => {
    setSelectedAccount(account);
    setEditOpen(true);
  }, []);

  const handleEditOpenChange = useCallback((open: boolean) => {
    setEditOpen(open);
    if (!open) {
      setSelectedAccount(null);
    }
  }, []);

  const handleRemoveRequest = useCallback((account: Account) => {
    setAccountToRemove(account);
    setRemoveOpen(true);
  }, []);

  const handleRemoveOpenChange = useCallback((open: boolean) => {
    setRemoveOpen(open);
    if (!open) {
      setAccountToRemove(null);
    }
  }, []);

  const handleRemoveConfirm = useCallback(async () => {
    if (!accountToRemove) {
      return;
    }

    const result = await deleteAccountAction({ id: accountToRemove.id });

    if (result.success) {
      toast.success(result.message);
      return;
    }

    toast.error(result.error);
    throw new Error(result.error);
  }, [accountToRemove]);

  const handleTransferRequest = useCallback((account: Account) => {
    setTransferFromAccount(account);
    setTransferOpen(true);
  }, []);

  const handleTransferOpenChange = useCallback((open: boolean) => {
    setTransferOpen(open);
    if (!open) {
      setTransferFromAccount(null);
    }
  }, []);

  const handleImportStateChange = useCallback(
    (accountId: string, isImporting: boolean) => {
      setImportingAccountId(isImporting ? accountId : null);
    },
    []
  );

  const handleImportComplete = useCallback((count: number) => {
    setImportingAccountId(null);
    // Data will be revalidated automatically by the server action
  }, []);

  const removeTitle = accountToRemove
    ? `Remover conta "${accountToRemove.name}"?`
    : "Remover conta?";

  return (
    <>
      <div className="flex w-full flex-col gap-6">
        <div className="flex justify-start">
          <AccountDialog
            mode="create"
            logoOptions={logoOptions}
            trigger={
              <Button>
                <RiAddCircleLine className="size-4" />
                Nova conta
              </Button>
            }
          />
        </div>

        {hasAccounts ? (
          <div className="flex flex-wrap gap-4">
            {orderedAccounts.map((account) => {
              const logoSrc = resolveLogoSrc(account.logo);
              const isActive = account.status.toLowerCase() === "ativa";

              return (
                <div key={account.id}>
                  <AccountCard
                    accountName={account.name}
                    accountType={`${account.accountType} - ${account.status}`}
                    balance={account.balance ?? account.initialBalance ?? 0}
                    status={account.status}
                    excludeFromBalance={account.excludeFromBalance}
                    icon={
                      logoSrc ? (
                        <Image
                          src={logoSrc}
                          alt={`Logo da conta ${account.name}`}
                          width={42}
                          height={42}
                          className="rounded-lg"
                        />
                      ) : undefined
                    }
                    onEdit={() => handleEdit(account)}
                    onRemove={() => handleRemoveRequest(account)}
                    onTransfer={() => handleTransferRequest(account)}
                    onViewStatement={() =>
                      router.push(`/contas/${account.id}/extrato`)
                    }
                    extraActions={
                      isActive ? (
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
                          onImportStateChange={(isImporting) =>
                            handleImportStateChange(account.id, isImporting)
                          }
                          onImportComplete={handleImportComplete}
                          trigger={
                            <button
                              type="button"
                              className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-80 text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="importar OFX"
                              disabled={importingAccountId === account.id}
                            >
                              <RiFileUploadLine className="size-4" aria-hidden />
                              {importingAccountId === account.id
                                ? "importando..."
                                : "importar OFX"}
                            </button>
                          }
                        />
                      ) : undefined
                    }
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="flex min-h-[50vh] w-full items-center justify-center py-12">
            <EmptyState
              media={<RiBankLine className="size-6 text-primary" />}
              title="Nenhuma conta cadastrada"
              description="Cadastre sua primeira conta para começar a organizar os lançamentos."
            />
          </Card>
        )}
      </div>

      <AccountDialog
        mode="update"
        logoOptions={logoOptions}
        account={selectedAccount ?? undefined}
        open={editOpen && !!selectedAccount}
        onOpenChange={handleEditOpenChange}
      />

      <ConfirmActionDialog
        open={removeOpen && !!accountToRemove}
        onOpenChange={handleRemoveOpenChange}
        title={removeTitle}
        description="Ao remover esta conta, todos os dados relacionados a ela serão perdidos."
        confirmLabel="Remover conta"
        pendingLabel="Removendo..."
        confirmVariant="destructive"
        onConfirm={handleRemoveConfirm}
      />

      {transferFromAccount && (
        <TransferDialog
          accounts={accounts.map((a) => ({
            ...a,
            balance: a.balance ?? a.initialBalance ?? 0,
            excludeFromBalance: a.excludeFromBalance ?? false,
          }))}
          fromAccountId={transferFromAccount.id}
          currentPeriod={getCurrentPeriod()}
          open={transferOpen}
          onOpenChange={handleTransferOpenChange}
        />
      )}
    </>
  );
}
