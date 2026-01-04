"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    RiMagicLine,
    RiInformationLine,
    RiErrorWarningLine,
    RiCheckLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils/ui";
import type { CsvColumnMappingStepProps } from "./types";
import type { SystemField, ColumnMapping } from "@/lib/csv/types";

/**
 * System field configuration
 */
const SYSTEM_FIELDS: Array<{
    key: SystemField;
    label: string;
    required: boolean;
    description: string;
}> = [
        {
            key: "date",
            label: "Data",
            required: true,
            description: "Data da transação (ex: 01/12/2024)",
        },
        {
            key: "amount",
            label: "Valor",
            required: true,
            description: "Valor da transação (ex: R$ 123,45)",
        },
        {
            key: "description",
            label: "Descrição",
            required: false,
            description: "Descrição ou nome da transação",
        },
    ];

/**
 * CSV Column Mapping Step
 * 
 * Step 2: Map CSV columns to transaction fields
 * Displays detected CSV headers and allows user to map them to system fields
 */
export function CsvColumnMappingStep({
    columnMapping,
    availableColumns,
    previewRows,
    totalRows,
    isAutoDetecting,
    error,
    onMappingChange,
    onAutoDetect,
    onValidate,
}: CsvColumnMappingStepProps) {
    /**
     * Check if mapping is complete (all required fields mapped)
     */
    const isMappingComplete = useMemo(() => {
        return Boolean(columnMapping.date && columnMapping.amount);
    }, [columnMapping]);

    /**
     * Get mapped column name for a system field
     */
    const getMappedColumn = (field: SystemField): string | undefined => {
        return columnMapping[field];
    };

    /**
     * Handle field mapping change
     */
    const handleFieldChange = (field: SystemField, columnName: string | null) => {
        const newMapping: ColumnMapping = {
            ...columnMapping,
        };

        if (columnName === null || columnName === "") {
            delete newMapping[field];
        } else {
            newMapping[field] = columnName;
        }

        onMappingChange(newMapping);
    };

    /**
     * Get column index for highlighting in preview
     */
    const getColumnIndex = (columnName: string): number => {
        const column = availableColumns.find((col) => col.value === columnName);
        return column?.index ?? -1;
    };

    /**
     * Check if a column is mapped to any field
     */
    const isColumnMapped = (columnName: string): boolean => {
        return Object.values(columnMapping).includes(columnName);
    };

    /**
     * Get preview rows to display (max 5)
     */
    const displayPreviewRows = useMemo(() => {
        return previewRows.slice(0, 5);
    }, [previewRows]);

    /**
     * Get preview headers (all available columns in order)
     */
    const previewHeaders = useMemo(() => {
        return [...availableColumns].sort((a, b) => a.index - b.index);
    }, [availableColumns]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">Mapear Colunas</h3>
                <p className="text-sm text-muted-foreground">
                    Indique quais colunas do CSV correspondem a cada campo do sistema.
                    Campos obrigatórios estão marcados com asterisco (*).
                </p>
            </div>

            {/* Auto-detect button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RiInformationLine className="size-4" />
                    <span>
                        Total de {totalRows} transação{totalRows !== 1 ? "ões" : ""} no arquivo
                    </span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onAutoDetect}
                    disabled={isAutoDetecting}
                >
                    {isAutoDetecting ? (
                        <>
                            <Spinner className="mr-2 size-4" />
                            Detectando...
                        </>
                    ) : (
                        <>
                            <RiMagicLine className="mr-2 size-4" />
                            Detecção Automática
                        </>
                    )}
                </Button>
            </div>

            {/* Error alert */}
            {error && (
                <Alert variant="destructive">
                    <RiErrorWarningLine className="size-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Mapping form */}
            <div className="space-y-4 rounded-lg border bg-card p-6">
                <h4 className="text-sm font-medium">Mapeamento de Campos</h4>
                <div className="grid gap-4 sm:grid-cols-3">
                    {SYSTEM_FIELDS.map((field) => (
                        <div key={field.key} className="space-y-2">
                            <Label htmlFor={`field-${field.key}`} className="flex items-center gap-1">
                                {field.label}
                                {field.required && <span className="text-destructive">*</span>}
                            </Label>
                            <Select
                                value={getMappedColumn(field.key) || ""}
                                onValueChange={(value) => handleFieldChange(field.key, value || null)}
                            >
                                <SelectTrigger
                                    id={`field-${field.key}`}
                                    className={cn(
                                        field.required &&
                                        !getMappedColumn(field.key) &&
                                        "border-destructive"
                                    )}
                                >
                                    <SelectValue placeholder="Selecione uma coluna..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">
                                        <span className="text-muted-foreground">
                                            Nenhuma coluna
                                        </span>
                                    </SelectItem>
                                    {availableColumns.map((column) => (
                                        <SelectItem
                                            key={column.value}
                                            value={column.value}
                                            disabled={
                                                isColumnMapped(column.value) &&
                                                getMappedColumn(field.key) !== column.value
                                            }
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span>{column.label}</span>
                                                {isColumnMapped(column.value) &&
                                                    getMappedColumn(field.key) === column.value && (
                                                        <RiCheckLine className="size-3 text-success" />
                                                    )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{field.description}</p>
                        </div>
                    ))}
                </div>

                {/* Mapping status */}
                {!isMappingComplete && (
                    <Alert>
                        <RiInformationLine className="size-4" />
                        <AlertDescription>
                            Preencha os campos obrigatórios (Data e Valor) para continuar.
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {/* Data preview */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium">Visualização dos Dados</h4>
                <p className="text-sm text-muted-foreground">
                    Primeiras 5 linhas do arquivo. Colunas mapeadas aparecem destacadas.
                </p>

                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {previewHeaders.map((column) => {
                                    const isMapped = isColumnMapped(column.value);
                                    return (
                                        <TableHead
                                            key={column.value}
                                            className={cn(
                                                "whitespace-nowrap",
                                                isMapped && "bg-primary/10 font-semibold"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                {column.label}
                                                {isMapped && (
                                                    <RiCheckLine className="size-3 text-primary" />
                                                )}
                                            </div>
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayPreviewRows.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={previewHeaders.length}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        Nenhum dado disponível para visualização
                                    </TableCell>
                                </TableRow>
                            ) : (
                                displayPreviewRows.map((row, rowIndex) => (
                                    <TableRow key={rowIndex}>
                                        {previewHeaders.map((column) => {
                                            const isMapped = isColumnMapped(column.value);
                                            const cellValue = row[column.value] || "";
                                            return (
                                                <TableCell
                                                    key={column.value}
                                                    className={cn(
                                                        "max-w-[200px] truncate",
                                                        isMapped && "bg-primary/5 font-medium"
                                                    )}
                                                    title={cellValue}
                                                >
                                                    {cellValue}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {displayPreviewRows.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Mostrando {displayPreviewRows.length} de {totalRows} linhas
                    </p>
                )}
            </div>
        </div>
    );
}
