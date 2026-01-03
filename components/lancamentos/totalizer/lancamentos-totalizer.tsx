"use client";

import MoneyValues from "@/components/money-values";
import type { TotalizerData } from "@/lib/lancamentos/totalizers";
import { cn } from "@/lib/utils/ui";

interface LancamentosTotalizerProps {
    totalizerData: TotalizerData;
}

export default function LancamentosTotalizer({
    totalizerData,
}: LancamentosTotalizerProps) {
    const { totalIncome, totalExpenses, netTotal } = totalizerData;
    const isPositiveNet = netTotal >= 0;

    return (
        <div className="flex gap-2 items-center flex-wrap">
            {/* Total Income */}
            <div
                className={cn(
                    "flex flex-col space-y-0.5 rounded border px-2.5 py-1.5",
                    "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                )}
            >
                <p className="text-xs font-medium text-muted-foreground">
                    Receitas
                </p>
                <MoneyValues
                    amount={totalIncome}
                    className="text-sm font-bold text-green-600 dark:text-green-400"
                />
            </div>

            {/* Total Expenses */}
            <div
                className={cn(
                    "flex flex-col space-y-0.5 rounded border px-2.5 py-1.5",
                    "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                )}
            >
                <p className="text-xs font-medium text-muted-foreground">
                    Despesas
                </p>
                <MoneyValues
                    amount={totalExpenses}
                    className="text-sm font-bold text-red-600 dark:text-red-400"
                />
            </div>

            {/* Net Total */}
            <div
                className={cn(
                    "flex flex-col space-y-0.5 rounded border px-2.5 py-1.5",
                    isPositiveNet
                        ? "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20"
                        : "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                )}
            >
                <p className="text-xs font-medium text-muted-foreground">Saldo</p>
                <MoneyValues
                    amount={netTotal}
                    className={cn(
                        "text-sm font-bold",
                        isPositiveNet
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-red-600 dark:text-red-400"
                    )}
                />
            </div>
        </div>
    );
}
