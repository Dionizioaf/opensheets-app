"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { getIconComponent } from "@/lib/utils/icons";
import { formatPeriodLabel } from "@/lib/relatorios/utils";
import type { CategoryReportData } from "@/lib/relatorios/types";
import { CategoryCell } from "./category-cell";
import { formatCurrency } from "@/lib/relatorios/utils";
import { RiPieChartLine } from "@remixicon/react";

interface CategoryReportTableProps {
    data: CategoryReportData;
}

export function CategoryReportTable({ data }: CategoryReportTableProps) {
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
        <div className="rounded-md border">
            <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                        <TableHead className="w-[250px] min-w-[250px] sticky left-0 bg-background border-r z-20">
                            Categoria
                        </TableHead>
                        {periods.map((period) => (
                            <TableHead key={period} className="text-right min-w-[120px]">
                                {formatPeriodLabel(period)}
                            </TableHead>
                        ))}
                        <TableHead className="text-right min-w-[120px] font-semibold">
                            Total
                        </TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {categories.map((category, categoryIndex) => {
                        const Icon = category.icon ? getIconComponent(category.icon) : null;

                        return (
                            <TableRow key={category.categoryId}>
                                <TableCell className="sticky left-0 bg-background border-r z-10">
                                    <div className="flex items-center gap-2">
                                        {Icon && <Icon className="h-4 w-4 shrink-0" />}
                                        <span className="font-medium truncate">{category.name}</span>
                                        <Badge
                                            variant={
                                                category.type === "despesa" ? "destructive" : "success"
                                            }
                                            className="ml-auto shrink-0"
                                        >
                                            {category.type === "despesa" ? "D" : "R"}
                                        </Badge>
                                    </div>
                                </TableCell>
                                {periods.map((period, periodIndex) => {
                                    const monthData = category.monthlyData.get(period);
                                    const isFirstMonth = periodIndex === 0;

                                    return (
                                        <TableCell key={period} className="text-right">
                                            <CategoryCell
                                                value={monthData?.amount ?? 0}
                                                previousValue={monthData?.previousAmount ?? 0}
                                                categoryType={category.type}
                                                isFirstMonth={isFirstMonth}
                                            />
                                        </TableCell>
                                    );
                                })}
                                <TableCell className="text-right font-semibold">
                                    {formatCurrency(category.total)}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>

                <TableFooter>
                    <TableRow>
                        <TableCell className="sticky left-0 bg-muted/50 border-r z-10 font-semibold">
                            Total Geral
                        </TableCell>
                        {periods.map((period) => {
                            const periodTotal = totals.get(period) ?? 0;
                            return (
                                <TableCell key={period} className="text-right font-semibold">
                                    {formatCurrency(periodTotal)}
                                </TableCell>
                            );
                        })}
                        <TableCell className="text-right font-semibold">
                            {formatCurrency(grandTotal)}
                        </TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
