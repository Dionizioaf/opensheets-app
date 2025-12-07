"use client";

import { formatCurrency, formatPercentageChange } from "@/lib/relatorios/utils";
import { cn } from "@/lib/utils/ui";
import { RiArrowDownLine, RiArrowUpLine } from "@remixicon/react";

interface CategoryCellProps {
    value: number;
    previousValue: number;
    categoryType: "despesa" | "receita";
    isFirstMonth: boolean;
}

/**
 * Category Cell Component
 * Displays a value with variation indicator for category report table
 */
export function CategoryCell({
    value,
    previousValue,
    categoryType,
    isFirstMonth,
}: CategoryCellProps) {
    // Calculate percentage change
    const percentageChange = isFirstMonth
        ? null
        : previousValue === 0 && value > 0
            ? 100
            : previousValue === 0 && value === 0
                ? null
                : previousValue === 0
                    ? null
                    : ((value - previousValue) / Math.abs(previousValue)) * 100;

    // Determine if variation is "bad" or "good"
    // For despesas: increase is bad (red), decrease is good (green)
    // For receitas: increase is good (green), decrease is bad (red)
    const hasIncrease = percentageChange !== null && percentageChange > 0;
    const hasDecrease = percentageChange !== null && percentageChange < 0;

    const isBadVariation =
        categoryType === "despesa" ? hasIncrease : hasDecrease;
    const isGoodVariation =
        categoryType === "despesa" ? hasDecrease : hasIncrease;

    return (
        <div className="flex flex-col items-end gap-0.5 py-2">
            {/* Value */}
            <span className="text-sm font-medium text-foreground">
                {formatCurrency(value)}
            </span>

            {/* Variation Indicator */}
            {!isFirstMonth && percentageChange !== null && (
                <span
                    className={cn(
                        "flex items-center gap-0.5 text-xs",
                        isBadVariation && "text-red-600 dark:text-red-400",
                        isGoodVariation && "text-green-600 dark:text-green-400",
                        !isBadVariation && !isGoodVariation && "text-muted-foreground"
                    )}
                >
                    {hasIncrease && <RiArrowUpLine className="size-3" />}
                    {hasDecrease && <RiArrowDownLine className="size-3" />}
                    {formatPercentageChange(percentageChange)}
                </span>
            )}

            {/* First month - no indicator */}
            {isFirstMonth && (
                <span className="text-xs text-muted-foreground">-</span>
            )}
        </div>
    );
}
