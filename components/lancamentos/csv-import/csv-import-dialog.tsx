"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RiCloseLine } from "react-icons/ri";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { CsvUploadStep } from "./csv-upload-step";
import { CsvColumnMappingStep } from "./csv-column-mapping-step";
import { CsvReviewStep } from "./csv-review-step";
import { CsvConfirmStep } from "./csv-confirm-step";
import type {
    CsvTransactionWithUiState,
    CsvColumnMapping,
    CsvParseResult,
} from "./types";
import type { Categoria } from "@/db/schema";
import { parseCsvFileAction } from "@/app/(dashboard)/lancamentos/actions";
import { detectCsvDuplicatesAction } from "@/app/(dashboard)/lancamentos/actions";
import { suggestCsvCategoriesAction } from "@/app/(dashboard)/lancamentos/actions";
import { importCsvTransactionsAction } from "@/app/(dashboard)/lancamentos/actions";

/**
 * Wizard step type
 */
type WizardStep = "upload" | "mapping" | "review" | "confirm";

/**
 * Wizard steps configuration
 */
const WIZARD_STEPS: Array<{ id: WizardStep; title: string; description: string }> = [
    { id: "upload", title: "Upload", description: "Selecione o arquivo CSV" },
    { id: "mapping", title: "Mapeamento", description: "Mapeie as colunas do CSV" },
    { id: "review", title: "Revisar", description: "Revise e edite as transações" },
    { id: "confirm", title: "Confirmar", description: "Confirme a importação" },
];

/**
 * Account data for dropdown
 */
export interface AccountOption {
    id: string;
    nome: string;
    tipo: "banco" | "cartao";
}

/**
 * Props for CsvImportDialog
 */
export interface CsvImportDialogProps {
    /** Optional trigger element */
    trigger?: React.ReactNode;
    /** Controlled open state (optional) */
    open?: boolean;
    /** Callback when open state changes (optional) */
    onOpenChange?: (open: boolean) => void;
    /** List of bank accounts */
    contas: AccountOption[];
    /** List of credit cards */
    cartoes: AccountOption[];
    /** List of categories for mapping */
    categorias: Categoria[];
    /** List of payers for transaction data */
    pagadores: Array<{ id: string; nome: string }>;
    /** Callback when import completes successfully */
    onImportComplete?: (importedCount: number) => void;
    /** Callback when dialog is cancelled */
    onCancel?: () => void;
}

/**
 * CSV Import Dialog Component
 *
 * Main orchestrator for CSV import wizard with 4 steps:
 * 1. Upload: Select and parse CSV file
 * 2. Mapping: Map CSV columns to transaction fields
 * 3. Review: Review, edit, and select transactions
 * 4. Confirm: View summary and confirm import
 */
export function CsvImportDialog({
    trigger,
    open: controlledOpen,
    onOpenChange,
    contas,
    cartoes,
    categorias,
    pagadores,
    onImportComplete,
    onCancel,
}: CsvImportDialogProps) {
    // Dialog state - use controlled or uncontrolled
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = onOpenChange || setInternalOpen;
    const [mounted, setMounted] = useState(false);
    const [currentStep, setCurrentStep] = useState<WizardStep>("upload");

    // Upload step state
    const [isParsingFile, setIsParsingFile] = useState(false);
    const [parsingError, setParsingError] = useState<string | null>(null);
    const [csvData, setCsvData] = useState<CsvParseResult | null>(null);

    // Mapping step state
    const [columnMapping, setColumnMapping] = useState<CsvColumnMapping | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<AccountOption | null>(null);

    // Review step state
    const [transactions, setTransactions] = useState<CsvTransactionWithUiState[]>([]);
    const [showDuplicates, setShowDuplicates] = useState(true);
    const [isDetectingDuplicates, setIsDetectingDuplicates] = useState(false);

    // Confirm/Import step state
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importError, setImportError] = useState<string | null>(null);

    // Prevent hydration issues
    useEffect(() => {
        setMounted(true);
    }, []);

    /**
     * Get current step index for progress indicator
     */
    const currentStepIndex = useMemo(() => {
        return WIZARD_STEPS.findIndex((s) => s.id === currentStep);
    }, [currentStep]);

    /**
     * Handle CSV file upload and parsing
     */
    const handleFileSelected = useCallback(
        async (file: File, delimiter: "," | ";") => {
            setIsParsingFile(true);
            setParsingError(null);

            try {
                // Read file content
                const fileContent = await file.text();

                // Call server action to parse CSV
                const result = await parseCsvFileAction(fileContent, delimiter);

                if (!result.success || !result.data) {
                    throw new Error(result.error || "Erro ao analisar arquivo CSV");
                }

                // Store parsed data
                setCsvData(result.data);

                // Automatically advance to mapping step
                setCurrentStep("mapping");
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : "Erro ao processar arquivo CSV";
                setParsingError(errorMessage);
                toast.error(errorMessage);
            } finally {
                setIsParsingFile(false);
            }
        },
        []
    );

    /**
     * Handle column mapping completion
     */
    const handleMappingComplete = useCallback(
        async (mapping: CsvColumnMapping, account: AccountOption, mappedTransactions: CsvTransactionWithUiState[]) => {
            setColumnMapping(mapping);
            setSelectedAccount(account);
            setTransactions(mappedTransactions);

            // Automatically detect duplicates and suggest categories
            setIsDetectingDuplicates(true);
            try {
                // Detect duplicates
                const duplicateResult = await detectCsvDuplicatesAction(
                    mappedTransactions,
                    account.id,
                    account.tipo
                );

                if (duplicateResult.success && duplicateResult.data) {
                    // Mark duplicates in transaction state
                    const updatedTransactions = mappedTransactions.map((t) => ({
                        ...t,
                        isDuplicate: duplicateResult.data?.has(t.id) ?? false,
                    }));

                    // Suggest categories for non-duplicate transactions
                    const nonDuplicates = updatedTransactions.filter((t) => !t.isDuplicate);
                    if (nonDuplicates.length > 0) {
                        const categoryResult = await suggestCsvCategoriesAction(nonDuplicates);

                        if (categoryResult.success && categoryResult.data) {
                            // Apply suggested categories
                            const transactionsWithCategories = updatedTransactions.map((t) => {
                                const suggestion = categoryResult.data?.get(t.id);
                                if (suggestion && suggestion.categoriaId) {
                                    return {
                                        ...t,
                                        categoriaId: suggestion.categoriaId,
                                    };
                                }
                                return t;
                            });

                            setTransactions(transactionsWithCategories);
                        } else {
                            setTransactions(updatedTransactions);
                        }
                    } else {
                        setTransactions(updatedTransactions);
                    }
                } else {
                    // No duplicate detection, just suggest categories
                    const categoryResult = await suggestCsvCategoriesAction(mappedTransactions);

                    if (categoryResult.success && categoryResult.data) {
                        const transactionsWithCategories = mappedTransactions.map((t) => {
                            const suggestion = categoryResult.data?.get(t.id);
                            if (suggestion && suggestion.categoriaId) {
                                return {
                                    ...t,
                                    categoriaId: suggestion.categoriaId,
                                };
                            }
                            return t;
                        });

                        setTransactions(transactionsWithCategories);
                    }
                }

                // Move to review step
                setCurrentStep("review");
            } catch (error) {
                console.error("Erro ao detectar duplicatas ou sugerir categorias:", error);
                toast.error("Erro ao processar transações");
            } finally {
                setIsDetectingDuplicates(false);
            }
        },
        []
    );

    /**
     * Handle transaction update (edit in review step)
     */
    const handleTransactionUpdate = useCallback(
        (id: string, updates: Partial<CsvTransactionWithUiState>) => {
            setTransactions((prev) =>
                prev.map((t) =>
                    t.id === id
                        ? {
                            ...t,
                            ...updates,
                            isEdited: true, // Mark as edited
                        }
                        : t
                )
            );
        },
        []
    );

    /**
     * Toggle transaction selection
     */
    const handleToggleSelection = useCallback((id: string) => {
        setTransactions((prev) =>
            prev.map((t) => (t.id === id ? { ...t, isSelected: !t.isSelected } : t))
        );
    }, []);

    /**
     * Toggle all transactions selection
     */
    const handleToggleAll = useCallback((checked: boolean) => {
        setTransactions((prev) =>
            prev.map((t) =>
                t.isDuplicate ? t : { ...t, isSelected: checked }
            )
        );
    }, []);

    /**
     * Bulk set category for selected transactions
     */
    const handleBulkCategorySet = useCallback((categoriaId: string | undefined) => {
        setTransactions((prev) =>
            prev.map((t) =>
                t.isSelected && !t.isDuplicate
                    ? { ...t, categoriaId, isEdited: true }
                    : t
            )
        );
    }, []);

    /**
     * Calculate summary for confirm step
     */
    const summary = useMemo(() => {
        const selected = transactions.filter((t) => t.isSelected && !t.isDuplicate);

        if (selected.length === 0) {
            return {
                selectedCount: 0,
                totalValue: 0,
                dateRange: null as { start: string; end: string } | null,
                categoryBreakdown: [] as Array<{ categoria: string; count: number }>,
                typeBreakdown: { receita: 0, despesa: 0 },
            };
        }

        // Total value
        const totalValue = selected.reduce(
            (sum, t) => sum + parseFloat(t.valor),
            0
        );

        // Date range
        const dates = selected.map((t) => new Date(t.data_compra));
        const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

        // Category breakdown
        const categoryMap = new Map<string, number>();
        selected.forEach((t) => {
            const catId = t.categoriaId || "sem-categoria";
            categoryMap.set(catId, (categoryMap.get(catId) || 0) + 1);
        });

        const categoryBreakdown = Array.from(categoryMap.entries()).map(
            ([catId, count]) => {
                const categoria = categorias.find((c) => c.id === catId);
                return {
                    categoria: categoria?.nome || "Sem categoria",
                    count,
                };
            }
        );

        // Type breakdown
        const typeBreakdown = selected.reduce(
            (acc, t) => {
                if (t.tipo_transacao === "receita") {
                    acc.receita += 1;
                } else {
                    acc.despesa += 1;
                }
                return acc;
            },
            { receita: 0, despesa: 0 }
        );

        return {
            selectedCount: selected.length,
            totalValue,
            dateRange: {
                start: minDate.toLocaleDateString("pt-BR"),
                end: maxDate.toLocaleDateString("pt-BR"),
            },
            categoryBreakdown,
            typeBreakdown,
        };
    }, [transactions, categorias]);

    /**
     * Navigate to next step
     */
    const handleNext = useCallback(() => {
        if (currentStep === "upload" && csvData) {
            setCurrentStep("mapping");
        } else if (currentStep === "mapping" && columnMapping && selectedAccount) {
            setCurrentStep("review");
        } else if (currentStep === "review" && selectedCount > 0) {
            setCurrentStep("confirm");
        }
    }, [currentStep, csvData, columnMapping, selectedAccount]);

    /**
     * Navigate to previous step
     */
    const handleBack = useCallback(() => {
        if (currentStep === "mapping") {
            setCurrentStep("upload");
        } else if (currentStep === "review") {
            setCurrentStep("mapping");
        } else if (currentStep === "confirm") {
            setCurrentStep("review");
        }
    }, [currentStep]);

    /**
     * Handle import confirmation
     */
    const handleConfirm = useCallback(async () => {
        if (!selectedAccount) {
            toast.error("Nenhuma conta selecionada");
            return;
        }

        setIsImporting(true);
        setImportProgress(0);
        setImportError(null);

        try {
            // Filter selected non-duplicate transactions
            const transactionsToImport = transactions
                .filter((t) => t.isSelected && !t.isDuplicate)
                .map((t) => ({
                    nome: t.nome,
                    valor: t.valor,
                    data_compra: t.data_compra,
                    tipo_transacao: t.tipo_transacao,
                    forma_pagamento: t.forma_pagamento,
                    condicao: "À vista" as const,
                    periodo: t.periodo,
                    anotacao: t.anotacao,
                    // Only include categoriaId if it's a valid string
                    ...(t.categoriaId && { categoriaId: t.categoriaId }),
                }));

            // Simulate progress during import
            const progressInterval = setInterval(() => {
                setImportProgress((prev) => Math.min(prev + 10, 90));
            }, 100);

            // Call server action to import transactions
            const result = await importCsvTransactionsAction(
                selectedAccount.id,
                selectedAccount.tipo,
                transactionsToImport
            );

            clearInterval(progressInterval);
            setImportProgress(100);

            if (!result.success) {
                throw new Error(result.error);
            }

            toast.success(result.message || "Transações importadas com sucesso");
            onImportComplete?.(result.data?.importedCount ?? 0);

            // Small delay to show 100% progress before closing
            await new Promise((resolve) => setTimeout(resolve, 500));
            handleClose();
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Erro ao importar transações";
            setImportError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsImporting(false);
            setImportProgress(0);
        }
    }, [transactions, selectedAccount, onImportComplete]);

    /**
     * Close dialog and reset state
     */
    const handleClose = useCallback(() => {
        if (isImporting) return;

        setOpen(false);
        // Reset state after animation
        setTimeout(() => {
            setCurrentStep("upload");
            setCsvData(null);
            setColumnMapping(null);
            setSelectedAccount(null);
            setTransactions([]);
            setParsingError(null);
            setImportError(null);
            setShowDuplicates(true);
        }, 300);

        onCancel?.();
    }, [isImporting, onCancel]);

    /**
     * Get selected count for review step
     */
    const selectedCount = useMemo(() => {
        return transactions.filter((t) => t.isSelected && !t.isDuplicate).length;
    }, [transactions]);

    /**
     * Get duplicate count
     */
    const duplicateCount = useMemo(() => {
        return transactions.filter((t) => t.isDuplicate).length;
    }, [transactions]);

    // Prevent hydration issues by only rendering on client
    if (!mounted) {
        return trigger || null;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent
                className="w-full max-w-[95vw] sm:max-w-5xl lg:max-w-8xl h-[95vh] sm:h-[90vh] flex flex-col overflow-hidden p-0"
                showCloseButton={false}
            >
                {/* Header with Progress Indicator */}
                <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b shrink-0">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <DialogTitle className="text-base sm:text-lg truncate">
                                Importar arquivo CSV
                            </DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm truncate">
                                Importe transações de arquivos CSV para o Opensheets
                            </DialogDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClose}
                            disabled={isImporting}
                            className="shrink-0"
                        >
                            <RiCloseLine className="w-5 h-5" />
                            <span className="sr-only">Fechar</span>
                        </Button>
                    </div>

                    {/* Step Progress Indicator */}
                    <div className="flex items-center gap-1 sm:gap-2 mt-4 overflow-x-auto pb-2">
                        {WIZARD_STEPS.map((step, index) => (
                            <div key={step.id} className="flex items-center flex-1 min-w-[80px] sm:min-w-0">
                                <div className="flex items-center gap-1 sm:gap-2 flex-1">
                                    <Badge
                                        variant={
                                            index < currentStepIndex
                                                ? "default"
                                                : index === currentStepIndex
                                                    ? "default"
                                                    : "outline"
                                        }
                                        className="shrink-0 text-xs"
                                    >
                                        {index + 1}
                                    </Badge>
                                    <div className="flex-1 min-w-0 hidden sm:block">
                                        <p
                                            className={`text-xs font-medium truncate ${
                                                index <= currentStepIndex
                                                    ? "text-foreground"
                                                    : "text-muted-foreground"
                                            }`}
                                        >
                                            {step.title}
                                        </p>
                                    </div>
                                </div>
                                {index < WIZARD_STEPS.length - 1 && (
                                    <div
                                        className={`h-[2px] w-8 sm:w-full mx-1 sm:mx-2 ${
                                            index < currentStepIndex
                                                ? "bg-primary"
                                                : "bg-muted"
                                        }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </DialogHeader>

                {/* Step Content */}
                <div className="px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto min-h-0 flex-1">
                    {currentStep === "upload" && (
                        <CsvUploadStep
                            onFileSelected={handleFileSelected}
                            isLoading={isParsingFile}
                            error={parsingError}
                        />
                    )}

                    {currentStep === "mapping" && csvData && (
                        <CsvColumnMappingStep
                            csvData={csvData}
                            contas={contas}
                            cartoes={cartoes}
                            categorias={categorias}
                            pagadores={pagadores}
                            onMappingComplete={handleMappingComplete}
                            onBack={handleBack}
                        />
                    )}

                    {currentStep === "review" && (
                        <CsvReviewStep
                            transactions={transactions}
                            categorias={categorias}
                            selectedCount={selectedCount}
                            duplicateCount={duplicateCount}
                            onTransactionUpdate={handleTransactionUpdate}
                            onToggleSelection={handleToggleSelection}
                            onToggleAll={handleToggleAll}
                            onBulkCategorySet={handleBulkCategorySet}
                            showDuplicates={showDuplicates}
                            onToggleDuplicates={setShowDuplicates}
                            isDetectingDuplicates={isDetectingDuplicates}
                        />
                    )}

                    {currentStep === "confirm" && (
                        <CsvConfirmStep
                            summary={summary}
                            transactions={transactions}
                            isImporting={isImporting}
                            importProgress={importProgress}
                            error={importError}
                            onConfirm={handleConfirm}
                            onGoBack={handleBack}
                        />
                    )}
                </div>

                {/* Footer with Navigation (only for upload, mapping, and review steps) */}
                {currentStep !== "confirm" && (
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-t flex items-center justify-between gap-2 shrink-0">
                        <Button
                            variant="outline"
                            onClick={handleBack}
                            disabled={
                                currentStep === "upload" ||
                                isParsingFile ||
                                isDetectingDuplicates
                            }
                            className="min-w-[80px] text-sm"
                        >
                            Voltar
                        </Button>

                        <Button
                            onClick={handleNext}
                            disabled={
                                (currentStep === "upload" && !csvData) ||
                                isParsingFile ||
                                (currentStep === "mapping" && (!columnMapping || !selectedAccount)) ||
                                isDetectingDuplicates ||
                                (currentStep === "review" && selectedCount === 0)
                            }
                            className="min-w-[100px] text-sm"
                        >
                            {currentStep === "review" ? "Continuar" : "Próximo"}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}