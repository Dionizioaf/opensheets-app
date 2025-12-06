"use client";

import { cn } from "@/lib/utils/ui";
import {
  RiArrowLeftRightLine,
  RiDeleteBin5Line,
  RiEyeOffLine,
  RiFileList2Line,
  RiPencilLine,
} from "@remixicon/react";
import type React from "react";
import MoneyValues from "../money-values";
import { Card, CardContent, CardFooter } from "../ui/card";

export interface AccountCardProps {
  accountName: string;
  accountType: string;
  balance: number;
  status?: string;
  icon?: React.ReactNode;
  excludeFromBalance?: boolean;
  onViewStatement?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  onTransfer?: () => void;
  extraActions?: React.ReactNode;
  className?: string;
}

export function AccountCard({
  accountName,
  accountType,
  balance,
  status,
  icon,
  excludeFromBalance,
  onViewStatement,
  onEdit,
  onRemove,
  onTransfer,
  extraActions,
  className,
}: AccountCardProps) {
  const isInactive = status?.toLowerCase() === "inativa";

  const actions = [
    {
      label: "editar",
      icon: <RiPencilLine className="size-4" aria-hidden />,
      onClick: onEdit,
      variant: "default" as const,
    },
    {
      label: "extrato",
      icon: <RiFileList2Line className="size-4" aria-hidden />,
      onClick: onViewStatement,
      variant: "default" as const,
    },
    {
      label: "transferir",
      icon: <RiArrowLeftRightLine className="size-4" aria-hidden />,
      onClick: onTransfer,
      variant: "default" as const,
    },
    {
      label: "remover",
      icon: <RiDeleteBin5Line className="size-4" aria-hidden />,
      onClick: onRemove,
      variant: "destructive" as const,
    },
  ].filter((action) => typeof action.onClick === "function");

  return (
    <Card className={cn("h-full w-96 gap-0", className)}>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-2">
          {icon ? (
            <div
              className={cn(
                "flex items-center justify-center",
                isInactive && "[&_img]:grayscale [&_img]:opacity-40"
              )}
            >
              {icon}
            </div>
          ) : null}
          <h2 className="text-lg font-semibold text-foreground">
            {accountName}
          </h2>
          {excludeFromBalance ? (
            <div
              className="flex items-center gap-1 text-muted-foreground"
              title="Excluída do saldo geral"
            >
              <RiEyeOffLine className="size-4" aria-hidden />
            </div>
          ) : null}
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Saldo</p>
          <p className="text-3xl text-foreground">
            <MoneyValues amount={balance} className="text-3xl" />
          </p>
          <p className="text-sm text-muted-foreground">{accountType}</p>
        </div>
      </CardContent>

      {actions.length > 0 || extraActions ? (
        <CardFooter className="flex flex-wrap gap-3 px-6 pt-6 text-sm">
          {actions.map(({ label, icon, onClick, variant }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className={cn(
                "flex items-center gap-1 font-medium transition-opacity hover:opacity-80",
                variant === "destructive" ? "text-destructive" : "text-primary"
              )}
              aria-label={`${label} conta`}
            >
              {icon}
              {label}
            </button>
          ))}
          {extraActions}
        </CardFooter>
      ) : null}
    </Card>
  );
}
