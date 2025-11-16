"use client";

import MoneyValues from "@/components/money-values";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiPieChartLine } from "@remixicon/react";

type AnalysisSummaryPanelProps = {
  totalInstallments: number;
  grandTotal: number;
  selectedCount: number;
};

export function AnalysisSummaryPanel({
  totalInstallments,
  grandTotal,
  selectedCount,
}: AnalysisSummaryPanelProps) {
  return (
    <Card className="border-primary/20">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <RiPieChartLine className="size-4 text-primary" />
          <CardTitle className="text-base">Resumo</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        {/* Total geral */}
        <div className="flex flex-col items-center gap-2 rounded-lg bg-primary/10 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total Selecionado
          </p>
          <MoneyValues
            amount={grandTotal}
            className="text-2xl font-bold text-primary"
          />
          <p className="text-xs text-muted-foreground">
            {selectedCount} {selectedCount === 1 ? "parcela" : "parcelas"}
          </p>
        </div>

        {/* Mensagem quando nada está selecionado */}
        {selectedCount === 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Selecione parcelas para ver o resumo
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
