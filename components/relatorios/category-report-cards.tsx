"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { getIconComponent } from "@/lib/utils/icons";
import { formatPeriodLabel, formatCurrency, formatPercentageChange } from "@/lib/relatorios/utils";
import type { CategoryReportData } from "@/lib/relatorios/types";
import { cn } from "@/lib/utils/ui";
import { RiArrowDownLine, RiArrowUpLine, RiPieChartLine } from "@remixicon/react";

interface CategoryReportCardsProps {
    data: CategoryReportData;
}

export function CategoryReportCards({ data }: CategoryReportCardsProps) {
    const { categories, periods, totals, grandTotal } = data;

    // Empty state when no categories
    if (categories.length === 0) {
        return (
            <EmptyState
                title="Nenhuma categoria encontrada"
                description="Não há categorias para exibir com os filtros selecionados."
                media={<RiPieChartLine className="h-12 w-12" />}
                mediaVariant="icon"
            />
        );
    }

    return (
        <div className="flex flex-col gap-4 md:hidden">
            {/* Category Cards */}
            {categories.map((category) => {
                const Icon = category.icon ? getIconComponent(category.icon) : null;

                return (
                    <Card key={category.categoryId}>
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {Icon && <Icon className="h-5 w-5 shrink-0" />}
                                    <CardTitle className="text-base truncate">
                                        {category.name}
                                    </CardTitle>
                                    <Badge
                                        variant={
                                            category.type === "despesa" ? "destructive" : "success"
                                        }
                                        className="shrink-0"
                                    >
                                        {category.type === "despesa" ? "D" : "R"}
                                    </Badge>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-sm font-semibold">
                                        {formatCurrency(category.total)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Total</div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="months" className="border-none">
                                    <AccordionTrigger className="py-2 text-sm">
                                        Ver detalhes por mês ({periods.length} períodos)
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 pt-2">
                                            {periods.map((period, periodIndex) => {
                                                const monthData = category.monthlyData.get(period);
                                                const isFirstMonth = periodIndex === 0;
                                                const value = monthData?.amount ?? 0;
                                                const previousValue = monthData?.previousAmount ?? 0;

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
                                                const hasIncrease = percentageChange !== null && percentageChange > 0;
                                                const hasDecrease = percentageChange !== null && percentageChange < 0;

                                                const isBadVariation =
                                                    category.type === "despesa" ? hasIncrease : hasDecrease;
                                                const isGoodVariation =
                                                    category.type === "despesa" ? hasDecrease : hasIncrease;

                                                return (
                                                    <div
                                                        key={period}
                                                        className="flex items-center justify-between gap-4 py-2 border-b last:border-b-0"
                                                    >
                                                        <span className="text-sm font-medium text-muted-foreground">
                                                            {formatPeriodLabel(period)}
                                                        </span>
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <span className="text-sm font-medium">
                                                                {formatCurrency(value)}
                                                            </span>
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
                                                            {isFirstMonth && (
                                                                <span className="text-xs text-muted-foreground">-</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                );
            })}

            {/* Totals Card */}
            <Card className="bg-muted/50">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Totais Gerais</CardTitle>
                        <div className="text-right">
                            <div className="text-sm font-semibold">
                                {formatCurrency(grandTotal)}
                            </div>
                            <div className="text-xs text-muted-foreground">Total Geral</div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="totals" className="border-none">
                            <AccordionTrigger className="py-2 text-sm">
                                Ver totais por mês ({periods.length} períodos)
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-3 pt-2">
                                    {periods.map((period) => {
                                        const periodTotal = totals.get(period) ?? 0;

                                        return (
                                            <div
                                                key={period}
                                                className="flex items-center justify-between gap-4 py-2 border-b last:border-b-0"
                                            >
                                                <span className="text-sm font-medium text-muted-foreground">
                                                    {formatPeriodLabel(period)}
                                                </span>
                                                <span className="text-sm font-semibold">
                                                    {formatCurrency(periodTotal)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}
