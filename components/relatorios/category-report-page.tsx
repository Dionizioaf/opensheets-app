"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import type { CategoryReportData } from "@/lib/relatorios/types";
import type { CategoryOption, FilterState } from "./types";
import { CategoryReportFilters } from "./category-report-filters";
import { CategoryReportTable } from "./category-report-table";
import { CategoryReportCards } from "./category-report-cards";
import { CategoryReportExport } from "./category-report-export";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { RiFilter3Line, RiPieChartLine } from "@remixicon/react";
import PageDescription from "@/components/page-description";

interface CategoryReportPageProps {
    initialData: CategoryReportData;
    categories: CategoryOption[];
    initialFilters: FilterState;
}

export function CategoryReportPage({
    initialData,
    categories,
    initialFilters,
}: CategoryReportPageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [filters, setFilters] = useState<FilterState>(initialFilters);
    const [data, setData] = useState<CategoryReportData>(initialData);

    // Debounce timer
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

    const handleFiltersChange = useCallback((newFilters: FilterState) => {
        setFilters(newFilters);

        // Clear existing timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        // Set new debounced timer (300ms)
        const timer = setTimeout(() => {
            startTransition(() => {
                // Build new URL with query params
                const params = new URLSearchParams(searchParams.toString());

                params.set("inicio", newFilters.startPeriod);
                params.set("fim", newFilters.endPeriod);

                if (newFilters.selectedCategories.length > 0) {
                    params.set("categorias", newFilters.selectedCategories.join(","));
                } else {
                    params.delete("categorias");
                }

                // Navigate with new params (this will trigger server component re-render)
                router.push(`?${params.toString()}`, { scroll: false });
            });
        }, 300);

        setDebounceTimer(timer);
    }, [debounceTimer, router, searchParams]);

    // Update data when initialData changes (from server)
    useMemo(() => {
        setData(initialData);
    }, [initialData]);

    // Check if no categories are available
    const hasNoCategories = categories.length === 0;

    // Check if no data in period
    const hasNoData = data.categories.length === 0 && !hasNoCategories;

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">
                    Relatório de Categorias por Período
                </h1>
                <PageDescription title="Acompanhe a evolução dos seus gastos e receitas por categoria ao longo do tempo" />
            </div>

            {/* Filters and Export */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1">
                    <CategoryReportFilters
                        categories={categories}
                        filters={filters}
                        onFiltersChange={handleFiltersChange}
                    />
                </div>
                <div className="flex justify-end md:justify-start">
                    <CategoryReportExport data={data} filters={filters} />
                </div>
            </div>

            {/* Loading State */}
            {isPending && (
                <div className="space-y-4">
                    <Skeleton className="h-[400px] w-full" />
                </div>
            )}

            {/* Empty States */}
            {!isPending && hasNoCategories && (
                <EmptyState
                    title="Nenhuma categoria cadastrada"
                    description="Você precisa cadastrar categorias antes de visualizar o relatório."
                    media={<RiPieChartLine className="h-12 w-12" />}
                    mediaVariant="icon"
                />
            )}

            {!isPending && !hasNoCategories && hasNoData && filters.selectedCategories.length === 0 && (
                <EmptyState
                    title="Selecione pelo menos uma categoria"
                    description="Use o filtro acima para selecionar as categorias que deseja visualizar no relatório."
                    media={<RiFilter3Line className="h-12 w-12" />}
                    mediaVariant="icon"
                />
            )}

            {!isPending && !hasNoCategories && hasNoData && filters.selectedCategories.length > 0 && (
                <EmptyState
                    title="Nenhum lançamento encontrado"
                    description="Não há transações no período selecionado para as categorias filtradas."
                    media={<RiPieChartLine className="h-12 w-12" />}
                    mediaVariant="icon"
                />
            )}

            {/* Desktop Table (visible on >= 768px) */}
            {!isPending && !hasNoCategories && !hasNoData && (
                <div className="hidden md:block">
                    <CategoryReportTable data={data} />
                </div>
            )}

            {/* Mobile Cards (visible on < 768px) */}
            {!isPending && !hasNoCategories && !hasNoData && (
                <CategoryReportCards data={data} />
            )}
        </div>
    );
}
