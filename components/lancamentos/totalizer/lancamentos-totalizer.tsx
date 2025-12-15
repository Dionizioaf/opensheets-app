"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MoneyValues from "@/components/money-values";
import type { TotalizerData } from "@/lib/lancamentos/totalizers";
import { RiArrowUpSLine, RiArrowDownSLine } from "@remixicon/react";
import { cn } from "@/lib/utils/ui";

interface LancamentosTotalizerProps {
    totalizerData: TotalizerData;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

export default function LancamentosTotalizer({
    totalizerData,
    isCollapsed = false,
    onToggleCollapse,
}: LancamentosTotalizerProps) {
    const { totalIncome, totalExpenses, netTotal } = totalizerData;
    const isPositiveNet = netTotal >= 0;

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-lg font-semibold">
                    Resumo Financeiro
                </CardTitle>
                {onToggleCollapse && (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onToggleCollapse}
                        aria-label={isCollapsed ? "Expandir resumo" : "Recolher resumo"}
                    >
                        {isCollapsed ? (
                            <RiArrowDownSLine className="h-5 w-5" />
                        ) : (
                            <RiArrowUpSLine className="h-5 w-5" />
                        )}
                    </Button>
                )}
            </CardHeader>

            {!isCollapsed && (
                <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3 grid-cols-1">
                        {/* Total Income */}
                        <div
                            className={cn(
                                "flex flex-col space-y-1.5 rounded-lg border-2 p-4",
                                "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                            )}
                        >
                            <p className="text-sm font-medium text-muted-foreground">
                                Receitas
                            </p>
                            <div className="flex items-baseline gap-2">
                                <MoneyValues
                                    amount={totalIncome}
                                    className="text-2xl font-bold text-green-600 dark:text-green-400"
                                />
                            </div>
                        </div>

                        {/* Total Expenses */}
                        <div
                            className={cn(
                                "flex flex-col space-y-1.5 rounded-lg border-2 p-4",
                                "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                            )}
                        >
                            <p className="text-sm font-medium text-muted-foreground">
                                Despesas
                            </p>
                            <div className="flex items-baseline gap-2">
                                <MoneyValues
                                    amount={totalExpenses}
                                    className="text-2xl font-bold text-red-600 dark:text-red-400"
                                />
                            </div>
                        </div>

                        {/* Net Total */}
                        <div
                            className={cn(
                                "flex flex-col space-y-1.5 rounded-lg border-2 p-4",
                                isPositiveNet
                                    ? "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20"
                                    : "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                            )}
                        >
                            <p className="text-sm font-medium text-muted-foreground">Saldo</p>
                            <div className="flex items-baseline gap-2">
                                <MoneyValues
                                    amount={netTotal}
                                    className={cn(
                                        "text-2xl font-bold",
                                        isPositiveNet
                                            ? "text-blue-600 dark:text-blue-400"
                                            : "text-red-600 dark:text-red-400"
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
