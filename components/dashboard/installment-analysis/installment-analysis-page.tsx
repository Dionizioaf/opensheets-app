"use client";

import MoneyValues from "@/components/money-values";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMemo, useState } from "react";
import type { InstallmentAnalysisData } from "./types";
import { InstallmentGroupCard } from "./installment-group-card";
import { AnalysisSummaryPanel } from "./analysis-summary-panel";
import {
  RiCalculatorLine,
  RiCheckboxBlankLine,
  RiCheckboxLine,
} from "@remixicon/react";

type InstallmentAnalysisPageProps = {
  data: InstallmentAnalysisData;
};

export function InstallmentAnalysisPage({
  data,
}: InstallmentAnalysisPageProps) {
  // Estado para parcelas selecionadas: Map<seriesId, Set<installmentId>>
  const [selectedInstallments, setSelectedInstallments] = useState<
    Map<string, Set<string>>
  >(new Map());

  // Calcular se está tudo selecionado (apenas parcelas não pagas)
  const isAllSelected = useMemo(() => {
    const allInstallmentsSelected = data.installmentGroups.every((group) => {
      const groupSelection = selectedInstallments.get(group.seriesId);
      const unpaidInstallments = group.pendingInstallments.filter(
        (i) => !i.isSettled
      );
      if (!groupSelection || unpaidInstallments.length === 0) return false;
      return groupSelection.size === unpaidInstallments.length;
    });

    return allInstallmentsSelected && data.installmentGroups.length > 0;
  }, [selectedInstallments, data]);

  // Função para selecionar/desselecionar tudo
  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Desmarcar tudo
      setSelectedInstallments(new Map());
    } else {
      // Marcar tudo (exceto parcelas já pagas)
      const newInstallments = new Map<string, Set<string>>();
      data.installmentGroups.forEach((group) => {
        const unpaidIds = group.pendingInstallments
          .filter((i) => !i.isSettled)
          .map((i) => i.id);
        if (unpaidIds.length > 0) {
          newInstallments.set(group.seriesId, new Set(unpaidIds));
        }
      });

      setSelectedInstallments(newInstallments);
    }
  };

  // Função para selecionar/desselecionar um grupo de parcelas
  const toggleGroupSelection = (seriesId: string, installmentIds: string[]) => {
    const newMap = new Map(selectedInstallments);
    const current = newMap.get(seriesId) || new Set<string>();

    if (current.size === installmentIds.length) {
      // Já está tudo selecionado, desmarcar
      newMap.delete(seriesId);
    } else {
      // Marcar tudo
      newMap.set(seriesId, new Set(installmentIds));
    }

    setSelectedInstallments(newMap);
  };

  // Função para selecionar/desselecionar parcela individual
  const toggleInstallmentSelection = (seriesId: string, installmentId: string) => {
    const newMap = new Map(selectedInstallments);
    const current = newMap.get(seriesId) || new Set<string>();

    if (current.has(installmentId)) {
      current.delete(installmentId);
      if (current.size === 0) {
        newMap.delete(seriesId);
      } else {
        newMap.set(seriesId, current);
      }
    } else {
      current.add(installmentId);
      newMap.set(seriesId, current);
    }

    setSelectedInstallments(newMap);
  };

  // Calcular totais
  const { totalInstallments, grandTotal, selectedCount } = useMemo(() => {
    let installmentsSum = 0;
    let installmentsCount = 0;

    selectedInstallments.forEach((installmentIds, seriesId) => {
      const group = data.installmentGroups.find(
        (g) => g.seriesId === seriesId
      );
      if (group) {
        installmentIds.forEach((id) => {
          const installment = group.pendingInstallments.find(
            (i) => i.id === id
          );
          if (installment && !installment.isSettled) {
            installmentsSum += installment.amount;
            installmentsCount++;
          }
        });
      }
    });

    return {
      totalInstallments: installmentsSum,
      grandTotal: installmentsSum,
      selectedCount: installmentsCount,
    };
  }, [selectedInstallments, data]);

  const hasNoData = data.installmentGroups.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <RiCalculatorLine className="size-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Análise de Parcelas</h1>
          <p className="text-xs text-muted-foreground">
            Quanto você gastaria pagando tudo que está em aberto
          </p>
        </div>
      </div>

      {/* Card de resumo principal */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-5">
          <p className="text-xs font-medium text-muted-foreground">
            Se você pagar tudo que está selecionado:
          </p>
          <MoneyValues
            amount={grandTotal}
            className="text-3xl font-bold text-primary"
          />
          <p className="text-xs text-muted-foreground">
            {selectedCount} {selectedCount === 1 ? "parcela" : "parcelas"} selecionadas
          </p>
        </CardContent>
      </Card>

      {/* Botões de ação */}
      {!hasNoData && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            className="gap-2"
          >
            {isAllSelected ? (
              <RiCheckboxLine className="size-4" />
            ) : (
              <RiCheckboxBlankLine className="size-4" />
            )}
            {isAllSelected ? "Desmarcar Tudo" : "Selecionar Tudo"}
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Conteúdo principal */}
        <div className="flex flex-col gap-6">
          {/* Seção de Lançamentos Parcelados */}
          {data.installmentGroups.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Separator className="flex-1" />
                <h2 className="text-lg font-semibold">Lançamentos Parcelados</h2>
                <Separator className="flex-1" />
              </div>

              <div className="flex flex-col gap-3">
                {data.installmentGroups.map((group) => (
                  <InstallmentGroupCard
                    key={group.seriesId}
                    group={group}
                    selectedInstallments={
                      selectedInstallments.get(group.seriesId) || new Set()
                    }
                    onToggleGroup={() =>
                      toggleGroupSelection(
                        group.seriesId,
                        group.pendingInstallments
                          .filter((i) => !i.isSettled)
                          .map((i) => i.id)
                      )
                    }
                    onToggleInstallment={(installmentId) =>
                      toggleInstallmentSelection(group.seriesId, installmentId)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Estado vazio */}
          {hasNoData && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
                <RiCalculatorLine className="size-12 text-muted-foreground/50" />
                <div className="text-center">
                  <p className="font-medium">Nenhuma parcela pendente</p>
                  <p className="text-sm text-muted-foreground">
                    Você está em dia com seus pagamentos!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Painel lateral de resumo (sticky) */}
        {!hasNoData && (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <AnalysisSummaryPanel
              totalInstallments={totalInstallments}
              grandTotal={grandTotal}
              selectedCount={selectedCount}
            />
          </div>
        )}
      </div>
    </div>
  );
}
