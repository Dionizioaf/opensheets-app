"use client";

import { useMemo, useState, useCallback } from "react";
import { parse } from "date-fns";
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
    RiArrowLeftLine,
    RiArrowRightLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils/ui";
import type { SystemField, ColumnMapping } from "@/lib/csv/types";
import type { CsvParseResult } from "@/lib/csv/types";
import type { AccountOption } from "./csv-import-dialog";
import type { Categoria } from "@/db/schema";

/**
 * Actual props being passed by parent
 */
interface CsvColumnMappingStepActualProps {
    csvData: CsvParseResult;
    contas: AccountOption[];
    cartoes: AccountOption[];
    categorias: Categoria[];
    pagadores: Array<{ id: string; nome: string }>;
    onMappingComplete: (mapping: any, account: AccountOption, mappedTransactions: any[]) => void;
    onBack: () => void;
}

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
    csvData,
    contas,
    cartoes,
    categorias,
    pagadores,
    onMappingComplete,
    onBack,
}: CsvColumnMappingStepActualProps) {
    // Internal state
    const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
    const [isAutoDetecting, setIsAutoDetecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<AccountOption | null>(null);

    // Extract available columns from CSV data
    const availableColumns = useMemo(() => {
        return csvData.headers.map(header => ({
            value: header.name,
            label: header.name,
            index: header.index,
        }));
    }, [csvData.headers]);

    // Preview rows
    const previewRows = useMemo(() => csvData.rows.slice(0, 5), [csvData.rows]);
    const totalRows = csvData.rowCount;
    /**
     * Check if mapping is complete (all required fields mapped)
     */
    const isMappingComplete = useMemo(() => {
        return Boolean(columnMapping?.date && columnMapping?.amount);
    }, [columnMapping]);

    /**
     * Get mapped column name for a system field
     */
    const getMappedColumn = (field: SystemField): string | undefined => {
        return columnMapping?.[field];
    };

    /**
     * Handle field mapping change
     */
    const handleFieldChange = (field: SystemField, columnName: string | null) => {
        const newMapping: ColumnMapping = {
            ...columnMapping,
        };

        if (columnName === null || columnName === "" || columnName === "__none__") {
            delete newMapping[field];
        } else {
            newMapping[field] = columnName;
        }

        setColumnMapping(newMapping);
    };

    /**
     * Auto-detect column mapping
     */
    const handleAutoDetect = useCallback(() => {
        setIsAutoDetecting(true);
        setError(null);

        try {
            const mapping: ColumnMapping = {};

            // Simple auto-detection logic
            csvData.headers.forEach(header => {
                const lowerName = header.name.toLowerCase();

                if (lowerName.includes('data') || lowerName.includes('date')) {
                    mapping.date = header.name;
                } else if (lowerName.includes('valor') || lowerName.includes('value') || lowerName.includes('amount')) {
                    mapping.amount = header.name;
                } else if (lowerName.includes('descri') || lowerName.includes('lancamento') || lowerName.includes('description')) {
                    mapping.description = header.name;
                }
            });

            setColumnMapping(mapping);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao detectar colunas");
        } finally {
            setIsAutoDetecting(false);
        }
    }, [csvData.headers]);

    /**
     * Handle continue to next step
     */
    const handleContinue = useCallback(() => {
        if (!columnMapping.date || !columnMapping.amount) {
            setError("Preencha os campos obrigatórios (Data e Valor)");
            return;
        }

        // Transform CSV rows to transactions using the mapping
        const mappedTransactions = csvData.rows.map((row, index) => {
            const dateValue = row[columnMapping.date!];
            const amountValue = row[columnMapping.amount!];
            const descriptionValue = columnMapping.description ? row[columnMapping.description] : "";

            // Parse date - try common Brazilian formats
            let parsedDate: Date | null = null;
            if (dateValue) {
                // Try DD/MM/YYYY format first
                try {
                    parsedDate = parse(dateValue, "dd/MM/yyyy", new Date());
                    if (isNaN(parsedDate.getTime())) {
                        // Try DD/MM/YY format
                        parsedDate = parse(dateValue, "dd/MM/yy", new Date());
                    }
                } catch {
                    parsedDate = null;
                }
            }

            // Parse amount - remove currency symbols and convert to number
            let parsedAmount = 0;
            let transactionType: "Despesa" | "Receita" = "Despesa";
            if (amountValue) {
                // Remove "R$", spaces, and convert comma to dot
                const cleanAmount = amountValue
                    .replace(/R\$\s*/g, "")
                    .replace(/\./g, "") // Remove thousand separators
                    .replace(/,/g, ".") // Convert decimal separator
                    .trim();

                const numericValue = parseFloat(cleanAmount) || 0;

                // Positive values = Despesa (debit), Negative values = Receita (credit)
                if (numericValue < 0) {
                    transactionType = "Receita";
                    parsedAmount = Math.abs(numericValue);
                } else {
                    transactionType = "Despesa";
                    parsedAmount = numericValue;
                }
            }

            return {
                id: `csv-${index}`,
                data_compra: parsedDate || new Date(),
                valor: parsedAmount,
                nome: descriptionValue || "Sem descrição",
                tipo_transacao: transactionType,
                categoriaId: null,
                isSelected: true,
                isDuplicate: false,
            };
        });

        // Validate account selection
        if (!selectedAccount) {
            setError("Selecione uma conta para continuar");
            return;
        }

        onMappingComplete(columnMapping, selectedAccount, mappedTransactions);
    }, [columnMapping, csvData.rows, selectedAccount, onMappingComplete]);

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
                    onClick={handleAutoDetect}
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

            {/* Account Selection */}
            <div className="space-y-4 rounded-lg border bg-card p-6">
                <h4 className="text-sm font-medium">Selecionar Conta</h4>
                <div className="space-y-2">
                    <Label htmlFor="account-select">
                        Conta de destino <span className="text-destructive">*</span>
                    </Label>
                    <Select
                        value={selectedAccount?.id || "__none__"}
                        onValueChange={(value) => {
                            if (value === "__none__") {
                                setSelectedAccount(null);
                            } else {
                                const account = [...contas, ...cartoes].find(a => a.id === value);
                                if (account) setSelectedAccount(account);
                            }
                        }}
                    >
                        <SelectTrigger
                            id="account-select"
                            className={cn(!selectedAccount && "border-destructive")}
                        >
                            <SelectValue placeholder="Selecione uma conta..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">Selecione uma conta...</SelectItem>
                            {contas.length > 0 && (
                                <>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                        Contas Bancárias
                                    </div>
                                    {contas.map((conta) => (
                                        <SelectItem key={conta.id} value={conta.id}>
                                            {conta.nome}
                                        </SelectItem>
                                    ))}
                                </>
                            )}
                            {cartoes.length > 0 && (
                                <>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                        Cartões de Crédito
                                    </div>
                                    {cartoes.map((cartao) => (
                                        <SelectItem key={cartao.id} value={cartao.id}>
                                            {cartao.nome}
                                        </SelectItem>
                                    ))}
                                </>
                            )}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Selecione a conta bancária ou cartão de crédito onde as transações serão importadas
                    </p>
                </div>
            </div>

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
                                value={getMappedColumn(field.key) || "__none__"}
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
                                    <SelectItem value="__none__">
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

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                >
                    <RiArrowLeftLine className="mr-2 size-4" />
                    Voltar
                </Button>
                <Button
                    type="button"
                    onClick={handleContinue}
                    disabled={!isMappingComplete}
                >
                    Continuar
                    <RiArrowRightLine className="ml-2 size-4" />
                </Button>
            </div>
        </div>
    );
}
