"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    RiCheckLine,
    RiArrowLeftLine,
    RiCalendarLine,
    RiMoneyDollarCircleLine,
    RiFileListLine,
    RiAlertLine,
} from "@remixicon/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils/ui";
import type { ConfirmStepProps } from "./types";

export function ConfirmStep({
    summary,
    transactions,
    isImporting,
    importProgress,
    error,
    onConfirm,
    onGoBack,
}: ConfirmStepProps) {
    /**
     * Get selected transactions for display
     */
    const selectedTransactions = useMemo(() => {
        return transactions.filter((t) => t.isSelected && !t.isDuplicate);
    }, [transactions]);

    /**
     * Format currency
     */
    const formatCurrency = (value: string) => {
        const num = parseFloat(value);
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(num);
    };

    /**
     * Format date range
     */
    const formatDateRange = () => {
        if (!summary.dateRange) return "N/A";

        const { start, end } = summary.dateRange;
        const startFormatted = format(start, "dd/MM/yyyy", { locale: ptBR });
        const endFormatted = format(end, "dd/MM/yyyy", { locale: ptBR });

        return startFormatted === endFormatted
            ? startFormatted
            : `${startFormatted} - ${endFormatted}`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <h3 className="text-lg font-medium">Confirmar importação</h3>
                <p className="text-sm text-muted-foreground">
                    Revise o resumo da importação antes de confirmar. As transações serão adicionadas à sua conta.
                </p>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive bg-destructive/10">
                    <RiAlertLine className="w-5 h-5 text-destructive mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-destructive">Erro na importação</p>
                        <p className="text-sm text-muted-foreground mt-1">{error}</p>
                    </div>
                </div>
            )}

            {/* Import Summary Card */}
            <div className="space-y-4 p-6 rounded-lg border bg-muted/50">
                <h4 className="font-medium">Resumo da importação</h4>

                <div className="grid grid-cols-2 gap-4">
                    {/* Selected Count */}
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-background">
                            <RiFileListLine className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Transações</p>
                            <p className="text-2xl font-bold">{summary.selectedCount}</p>
                            <p className="text-xs text-muted-foreground">
                                de {summary.totalCount} no arquivo
                            </p>
                        </div>
                    </div>

                    {/* Total Amount */}
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-background">
                            <RiMoneyDollarCircleLine className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Valor total</p>
                            <p className="text-2xl font-bold">{formatCurrency(summary.totalAmount)}</p>
                            <p className="text-xs text-muted-foreground">
                                {summary.typeBreakdown.despesas.count} despesas • {summary.typeBreakdown.receitas.count} receitas
                            </p>
                        </div>
                    </div>

                    {/* Date Range */}
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-background">
                            <RiCalendarLine className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Período</p>
                            <p className="text-base font-medium">{formatDateRange()}</p>
                        </div>
                    </div>

                    {/* Duplicates Skipped */}
                    {summary.duplicatesSkipped > 0 && (
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-background">
                                <RiAlertLine className="w-5 h-5 text-warning" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Duplicadas</p>
                                <p className="text-base font-medium text-warning">
                                    {summary.duplicatesSkipped} ignoradas
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Type Breakdown */}
                {summary.typeBreakdown && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Detalhamento por tipo</p>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge variant="destructive" className="font-normal">
                                        Despesas
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                        {summary.typeBreakdown.despesas.count} transações
                                    </span>
                                </div>
                                <span className="text-sm font-medium text-destructive">
                                    -{formatCurrency(summary.typeBreakdown.despesas.amount)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-green-600 font-normal">
                                        Receitas
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                        {summary.typeBreakdown.receitas.count} transações
                                    </span>
                                </div>
                                <span className="text-sm font-medium text-green-600">
                                    +{formatCurrency(summary.typeBreakdown.receitas.amount)}
                                </span>
                            </div>
                        </div>
                    </>
                )}

                {/* Category Breakdown */}
                {summary.categoryBreakdown && summary.categoryBreakdown.length > 0 && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Principais categorias</p>
                            {summary.categoryBreakdown.slice(0, 5).map((cat) => (
                                <div key={cat.categoriaId} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">{cat.categoryName}</span>
                                        <span className="text-xs text-muted-foreground">
                                            ({cat.count} {cat.count === 1 ? "transação" : "transações"})
                                        </span>
                                    </div>
                                    <span className="text-sm font-medium">{formatCurrency(cat.amount)}</span>
                                </div>
                            ))}
                            {summary.categoryBreakdown.length > 5 && (
                                <p className="text-xs text-muted-foreground">
                                    e mais {summary.categoryBreakdown.length - 5} categorias...
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Transactions List */}
            <div className="space-y-2">
                <h4 className="font-medium">Transações a importar</h4>
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                    {selectedTransactions.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <p className="text-sm">Nenhuma transação selecionada para importação</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {selectedTransactions.map((transaction) => (
                                <div
                                    key={transaction.id}
                                    className={cn(
                                        "flex items-center justify-between p-4 hover:bg-muted/50 transition-colors",
                                        transaction.isEdited && "bg-accent/20"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium truncate">{transaction.nome}</p>
                                            {transaction.isEdited && (
                                                <Badge variant="secondary" className="text-xs">
                                                    Editada
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {format(transaction.data_compra, "dd/MM/yyyy", { locale: ptBR })}
                                        </p>
                                    </div>
                                    <div className="text-right ml-4">
                                        <p
                                            className={cn(
                                                "text-sm font-medium",
                                                transaction.tipo_transacao === "Despesa"
                                                    ? "text-destructive"
                                                    : "text-green-600"
                                            )}
                                        >
                                            {transaction.tipo_transacao === "Despesa" && "-"}
                                            {formatCurrency(transaction.valor)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Bar (shown during import) */}
            {isImporting && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Importando transações...</span>
                        <span className="font-medium">{importProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300 ease-out"
                            style={{ width: `${importProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
                <Button
                    variant="outline"
                    onClick={onGoBack}
                    disabled={isImporting}
                >
                    <RiArrowLeftLine className="w-4 h-4 mr-2" />
                    Voltar
                </Button>

                <Button
                    onClick={onConfirm}
                    disabled={isImporting || selectedTransactions.length === 0}
                    className="min-w-[140px]"
                >
                    {isImporting ? (
                        <>
                            <Spinner className="w-4 h-4 mr-2" />
                            Importando...
                        </>
                    ) : (
                        <>
                            <RiCheckLine className="w-4 h-4 mr-2" />
                            Confirmar importação
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
