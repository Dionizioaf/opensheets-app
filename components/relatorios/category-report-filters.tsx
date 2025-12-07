"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { validateDateRange } from "@/lib/relatorios/utils";
import { getIconComponent } from "@/lib/utils/icons";
import { cn } from "@/lib/utils/ui";
import { RiCheckLine, RiCloseLine, RiFilterLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import type { CategoryOption, CategoryReportFiltersProps, FilterState } from "./types";

/**
 * Category Report Filters Component
 * Provides filters for categories selection and date range
 */
export function CategoryReportFilters({
  categories,
  filters,
  onFiltersChange,
  isLoading = false,
}: CategoryReportFiltersProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchValue) return categories;
    const search = searchValue.toLowerCase();
    return categories.filter((cat) =>
      cat.name.toLowerCase().includes(search)
    );
  }, [categories, searchValue]);

  // Get selected categories for display
  const selectedCategories = useMemo(() => {
    if (filters.selectedCategories.length === 0) return [];
    return categories.filter((cat) =>
      filters.selectedCategories.includes(cat.id)
    );
  }, [categories, filters.selectedCategories]);

  // Handle category toggle
  const handleCategoryToggle = (categoryId: string) => {
    const newSelected = filters.selectedCategories.includes(categoryId)
      ? filters.selectedCategories.filter((id) => id !== categoryId)
      : [...filters.selectedCategories, categoryId];

    onFiltersChange({
      ...filters,
      selectedCategories: newSelected,
    });
  };

  // Handle select all
  const handleSelectAll = () => {
    onFiltersChange({
      ...filters,
      selectedCategories: categories.map((cat) => cat.id),
    });
  };

  // Handle clear all
  const handleClearAll = () => {
    onFiltersChange({
      ...filters,
      selectedCategories: [],
    });
  };

  // Handle date change
  const handleDateChange = (field: "startPeriod" | "endPeriod", value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value,
    });
  };

  // Validate date range
  const validation = useMemo(() => {
    if (!filters.startPeriod || !filters.endPeriod) {
      return { isValid: true };
    }
    return validateDateRange(filters.startPeriod, filters.endPeriod);
  }, [filters.startPeriod, filters.endPeriod]);

  // Check if filters are valid for applying
  const canApply = validation.isValid && filters.startPeriod && filters.endPeriod;

  // Display text for selected categories
  const selectedText = useMemo(() => {
    if (selectedCategories.length === 0) {
      return "Todas as categorias";
    }
    if (selectedCategories.length === categories.length) {
      return "Todas as categorias";
    }
    if (selectedCategories.length === 1) {
      return selectedCategories[0].name;
    }
    return `${selectedCategories.length} categorias`;
  }, [selectedCategories, categories.length]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        {/* Category Multi-Select */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="category-filter">Categorias</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                id="category-filter"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full sm:w-[280px] justify-between"
                disabled={isLoading}
              >
                <span className="truncate">{selectedText}</span>
                <RiFilterLine className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Buscar categoria..."
                  value={searchValue}
                  onValueChange={setSearchValue}
                />
                <CommandList>
                  <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                  <CommandGroup>
                    {/* Select All / Clear All */}
                    <div className="flex gap-1 p-2 border-b">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={handleSelectAll}
                      >
                        Todas
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={handleClearAll}
                      >
                        Limpar
                      </Button>
                    </div>

                    {/* Category List */}
                    {filteredCategories.map((category) => {
                      const isSelected = filters.selectedCategories.includes(
                        category.id
                      );
                      const IconComponent = category.icon
                        ? getIconComponent(category.icon)
                        : null;

                      return (
                        <CommandItem
                          key={category.id}
                          value={category.id}
                          onSelect={() => handleCategoryToggle(category.id)}
                          className="cursor-pointer"
                        >
                          <div
                            className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50 [&_svg]:invisible"
                            )}
                          >
                            <RiCheckLine className="h-4 w-4" />
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            {IconComponent && (
                              <IconComponent className="h-4 w-4 shrink-0" />
                            )}
                            <span className="truncate">{category.name}</span>
                          </div>
                          <span
                            className={cn(
                              "ml-2 text-xs px-1.5 py-0.5 rounded",
                              category.type === "despesa"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            )}
                          >
                            {category.type === "despesa" ? "D" : "R"}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Start Period Input */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="start-period">Data Inicial</Label>
          <Input
            id="start-period"
            type="month"
            value={filters.startPeriod}
            onChange={(e) => handleDateChange("startPeriod", e.target.value)}
            placeholder="AAAA-MM"
            className="w-full sm:w-[160px]"
            disabled={isLoading}
            required
          />
        </div>

        {/* End Period Input */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="end-period">Data Final</Label>
          <Input
            id="end-period"
            type="month"
            value={filters.endPeriod}
            onChange={(e) => handleDateChange("endPeriod", e.target.value)}
            placeholder="AAAA-MM"
            className="w-full sm:w-[160px]"
            disabled={isLoading}
            required
          />
        </div>
      </div>

      {/* Validation Message */}
      {!validation.isValid && validation.error && (
        <div className="text-sm text-destructive sm:col-span-full">
          {validation.error}
        </div>
      )}
    </div>
  );
}
