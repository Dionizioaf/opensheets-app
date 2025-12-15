"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RiRefreshLine, RiSettings4Line } from "@remixicon/react";
import type { Table } from "@tanstack/react-table";
import type { LancamentoItem } from "../types";

type ColumnSelectorProps = {
    table: Table<LancamentoItem>;
    onReset: () => void;
};

export default function ColumnSelector({
    table,
    onReset,
}: ColumnSelectorProps) {
    const columns = table
        .getAllColumns()
        .filter((column) => column.getCanHide());

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <RiSettings4Line className="h-4 w-4" aria-hidden />
                    <span>Colunas</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Exibir colunas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-96 overflow-y-auto">
                    {columns.map((column) => {
                        const label =
                            (column.columnDef.meta as { label?: string } | undefined)?.label ||
                            column.id;

                        return (
                            <DropdownMenuItem
                                key={column.id}
                                className="flex items-center gap-2 cursor-pointer"
                                onSelect={(e) => {
                                    e.preventDefault();
                                    column.toggleVisibility(!column.getIsVisible());
                                }}
                            >
                                <Checkbox
                                    checked={column.getIsVisible()}
                                    onCheckedChange={(value) =>
                                        column.toggleVisibility(!!value)
                                    }
                                    aria-label={`Toggle ${label} column`}
                                />
                                <span className="flex-1">{label}</span>
                            </DropdownMenuItem>
                        );
                    })}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onSelect={onReset}
                >
                    <RiRefreshLine className="h-4 w-4" aria-hidden />
                    <span>Restaurar padrão</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
