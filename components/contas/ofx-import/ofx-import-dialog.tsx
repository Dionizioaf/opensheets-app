"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiCloseLine } from "@remixicon/react";
import { toast } from "sonner";
import { parseOfxFile } from "@/lib/ofx/parser";
import { mapOfxTransactionsToLancamentos } from "@/lib/ofx/mapper";
import {
    importOfxTransactionsAction,
    detectOfxDuplicatesAction,
    suggestAiCategoriesForOfxAction,
    suggestCategoriesForOfxAction,
} from "@/app/(dashboard)/contas/[contaId]/extrato/actions";
import { DEFAULT_MODEL } from "@/app/(dashboard)/insights/data";
import { isAiCategorizationEnabledClient } from "@/lib/ai/flags";
import { UploadStep } from "./upload-step";
import { ReviewStep } from "./review-step";
import { ConfirmStep } from "./confirm-step";
import type {
    WizardStep,
    ImportTransaction,
    ImportSummary,
    OfxImportDialogProps,
} from "./types";

const WIZARD_STEPS: Array<{ id: WizardStep; title: string; description: string }> = [
    {
        id: "upload",
        title: "Upload",
        description: "Selecione o arquivo OFX",
    },
    {
        id: "review",
        title: "Revisar",
        description: "Revise e edite as transações",
    },
    {
        id: "confirm",
        title: "Confirmar",
        description: "Confirme a importação",
    },
];

export function OfxImportDialog({
    contaId,
    categorias,
    pagadores,
    defaultCategoriaId,
    defaultPagadorId,
    trigger,
    onImportComplete,
    onCancel,
    onImportStateChange,
}: OfxImportDialogProps) {
    // Client-side only rendering to avoid hydration issues
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Dialog state
    const [open, setOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState<WizardStep>("upload");

    // Upload step state
    const [isParsingFile, setIsParsingFile] = useState(false);
    const [parsingError, setParsingError] = useState<string | null>(null);

    // Transactions state
    const [transactions, setTransactions] = useState<ImportTransaction[]>([]);
    const [showDuplicates, setShowDuplicates] = useState(true);
    const [isDetectingDuplicates, setIsDetectingDuplicates] = useState(false);
    const [isSuggestingCategories, setIsSuggestingCategories] = useState(false);

    const aiFeatureAvailable = isAiCategorizationEnabledClient();
    const [useAiCategorization, setUseAiCategorization] = useState(
        aiFeatureAvailable
    );
    const [aiModelId, setAiModelId] = useState(DEFAULT_MODEL);

    // Import step state
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importError, setImportError] = useState<string | null>(null);

    /**
     * Notify parent component of import state changes
     */
    useEffect(() => {
        onImportStateChange?.(isImporting);
    }, [isImporting, onImportStateChange]);

    /**
     * Get current step index
     */
    const currentStepIndex = useMemo(() => {
        return WIZARD_STEPS.findIndex((step) => step.id === currentStep);
    }, [currentStep]);

    /**
     * Calculate summary statistics
     */
    const summary: ImportSummary = useMemo(() => {
        const selected = transactions.filter((t) => t.isSelected && !t.isDuplicate);
        const duplicates = transactions.filter((t) => t.isDuplicate);

        // Calculate totals
        let despesasCount = 0;
        let receitasCount = 0;
        let despesasAmount = 0;
        let receitasAmount = 0;
        let totalAmount = 0;

        selected.forEach((t) => {
            const amount = parseFloat(t.valor);
            if (t.tipo_transacao === "Despesa") {
                despesasCount++;
                despesasAmount += amount;
            } else {
                receitasCount++;
                receitasAmount += amount;
            }
            totalAmount += amount;
        });

        // Calculate date range
        let dateRange: { start: Date; end: Date } | null = null;
        if (selected.length > 0) {
            const dates = selected.map((t) => t.data_compra);
            dateRange = {
                start: new Date(Math.min(...dates.map((d) => d.getTime()))),
                end: new Date(Math.max(...dates.map((d) => d.getTime()))),
            };
        }

        // Calculate category breakdown
        const categoryMap = new Map<
            string,
            { name: string; count: number; amount: number }
        >();
        selected.forEach((t) => {
            if (t.categoriaId) {
                const existing = categoryMap.get(t.categoriaId);
                const amount = parseFloat(t.valor);
                if (existing) {
                    existing.count++;
                    existing.amount += amount;
                } else {
                    const category = categorias.find((c) => c.id === t.categoriaId);
                    categoryMap.set(t.categoriaId, {
                        name: category?.nome || "Sem categoria",
                        count: 1,
                        amount,
                    });
                }
            }
        });

        const categoryBreakdown = Array.from(categoryMap.entries())
            .map(([categoriaId, data]) => ({
                categoriaId,
                categoryName: data.name,
                count: data.count,
                amount: data.amount.toFixed(2),
            }))
            .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

        return {
            selectedCount: selected.length,
            totalCount: transactions.length,
            duplicatesSkipped: duplicates.length,
            newTransactions: selected.length,
            totalAmount: totalAmount.toFixed(2),
            dateRange,
            categoryBreakdown,
            typeBreakdown: {
                despesas: {
                    count: despesasCount,
                    amount: despesasAmount.toFixed(2),
                },
                receitas: {
                    count: receitasCount,
                    amount: receitasAmount.toFixed(2),
                },
            },
        };
    }, [transactions, categorias]);

    /**
     * Handle file upload and parsing
     */
    const handleFileSelected = useCallback(
        async (file: File) => {
            setIsParsingFile(true);
            setParsingError(null);

            try {
                // Read file content
                const fileContent = await file.text();

                // Parse OFX file (await the promise)
                const statement = await parseOfxFile(fileContent);

                if (!statement.transactions || statement.transactions.length === 0) {
                    throw new Error("Nenhuma transação encontrada no arquivo OFX");
                }

                // Map to lancamento format
                const parsedTransactions = mapOfxTransactionsToLancamentos(
                    statement.transactions
                );

                // Convert to ImportTransaction format with UI state
                const importTransactions: ImportTransaction[] = parsedTransactions.map(
                    (t, index) => ({
                        ...t,
                        id: `import-${index}`,
                        isSelected: true,
                        isEdited: false,
                        hasError: false,
                        isDuplicate: false,
                        categoriaId: defaultCategoriaId,
                    })
                );

                setTransactions(importTransactions);
                setCurrentStep("review");

                // Detect duplicates in background
                setIsDetectingDuplicates(true);

                const duplicateResult = await detectOfxDuplicatesAction(
                    contaId,
                    importTransactions.map((t) => ({
                        id: t.id,
                        name: t.nome,
                        amount: t.valor,
                        data_compra: t.data_compra,
                        fitId: t.fitId,
                    }))
                );

                let updatedTransactions = importTransactions;

                // Mark transactions as duplicates based on detection results
                if (duplicateResult.success && duplicateResult.data) {
                    const duplicatesMap = duplicateResult.data;
                    updatedTransactions = importTransactions.map((t) => {
                        const matches = duplicatesMap.get(t.id);
                        if (matches && matches.length > 0) {
                            return {
                                ...t,
                                isDuplicate: true,
                                isSelected: false, // Deselect duplicates by default
                                duplicateOf: matches[0].lancamentoId,
                                duplicateSimilarity: matches[0].similarity * 100,
                                duplicateDetails: {
                                    existingLancamentoId: matches[0].lancamentoId,
                                    existingTransactionName: matches[0].existingTransaction.nome,
                                    existingTransactionDate: matches[0].existingTransaction.purchaseDate,
                                    existingTransactionAmount: matches[0].existingTransaction.valor,
                                    matchReason: matches[0].matchReason as "fitid" | "date-amount-description" | "date-amount",
                                    similarityScore: matches[0].similarity * 100,
                                },
                            };
                        }
                        return t;
                    });
                }

                const shouldUseAi = aiFeatureAvailable && useAiCategorization;
                const nonDuplicateTransactions = updatedTransactions.filter(
                    (t) => !t.isDuplicate
                );

                let remainingForAi = nonDuplicateTransactions;

                if (nonDuplicateTransactions.length > 0) {
                    try {
                        const fuzzyResult = await suggestCategoriesForOfxAction(
                            contaId,
                            nonDuplicateTransactions.map((t) => ({
                                id: t.id,
                                nome: t.nome,
                                valor: t.valor,
                                tipo_transacao: t.tipo_transacao,
                            }))
                        );

                        if (fuzzyResult.success && fuzzyResult.data) {
                            updatedTransactions = updatedTransactions.map((t) => {
                                const suggestion = fuzzyResult.data?.get(t.id);
                                if (suggestion?.categoriaId) {
                                    return {
                                        ...t,
                                        categoriaId: suggestion.categoriaId,
                                        suggestedCategoriaId: suggestion.categoriaId,
                                        categoryConfidence: suggestion.confidence,
                                    };
                                }
                                return t;
                            });

                            const fuzzySuggestedIds = new Set(
                                Array.from(fuzzyResult.data.entries())
                                    .filter(([, suggestion]) => suggestion?.categoriaId)
                                    .map(([id]) => id)
                            );

                            remainingForAi = nonDuplicateTransactions.filter(
                                (t) => !fuzzySuggestedIds.has(t.id)
                            );
                        }
                    } catch (error) {
                        console.error("Erro ao sugerir categorias:", error);
                    }
                }

                if (shouldUseAi && remainingForAi.length > 0) {
                    setIsSuggestingCategories(true);
                    try {
                        const aiResult = await suggestAiCategoriesForOfxAction(
                            contaId,
                            remainingForAi.map((t) => ({
                                id: t.id,
                                nome: t.nome,
                                valor: t.valor,
                                tipo_transacao: t.tipo_transacao,
                                categoriaId: t.categoriaId ?? null,
                            })),
                            aiModelId
                        );

                        if (aiResult.success && aiResult.data) {
                            updatedTransactions = updatedTransactions.map((t) => {
                                const suggestion = aiResult.data?.[t.id];
                                if (
                                    suggestion?.categoriaId &&
                                    suggestion.confidence === "high"
                                ) {
                                    return {
                                        ...t,
                                        categoriaId: suggestion.categoriaId,
                                        suggestedCategoriaId: suggestion.categoriaId,
                                        categoryConfidence: suggestion.confidence,
                                        isEdited: true,
                                    };
                                }

                                return t;
                            });
                        } else {
                            throw new Error(aiResult.error);
                        }
                    } catch (error) {
                        console.error("Erro ao sugerir categorias com IA:", error);
                    } finally {
                        setIsSuggestingCategories(false);
                    }
                }

                // Update state with new array
                setTransactions(updatedTransactions);

                setIsDetectingDuplicates(false);

                // Show summary message
                const duplicateCount = importTransactions.filter((t) =>
                    duplicateResult.success && ((duplicateResult.data?.get(t.id)?.length ?? 0) > 0)
                ).length;
                if (duplicateCount > 0) {
                    toast.success(
                        `${importTransactions.length} transações carregadas (${duplicateCount} duplicadas detectadas)`
                    );
                } else {
                    toast.success(`${importTransactions.length} transações carregadas`);
                }
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : "Erro ao processar arquivo OFX";
                setParsingError(errorMessage);
                toast.error(errorMessage);
            } finally {
                setIsParsingFile(false);
            }
        },
        [aiFeatureAvailable, aiModelId, contaId, defaultCategoriaId, useAiCategorization]
    );

    /**
     * Update transaction
     */
    const handleTransactionUpdate = useCallback(
        (id: string, updates: Partial<ImportTransaction>) => {
            setTransactions((prev) =>
                prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
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
     * Toggle all selections
     */
    const handleToggleAll = useCallback((selected: boolean) => {
        setTransactions((prev) =>
            prev.map((t) => (t.isDuplicate ? t : { ...t, isSelected: selected }))
        );
    }, []);

    /**
     * Bulk set category
     */
    const handleBulkCategorySet = useCallback(
        (ids: string[], categoriaId: string) => {
            setTransactions((prev) =>
                prev.map((t) =>
                    ids.includes(t.id)
                        ? { ...t, categoriaId, isEdited: true }
                        : t
                )
            );
        },
        []
    );

    /**
     * Navigate to next step
     */
    const handleNext = useCallback(() => {
        if (currentStep === "upload") {
            // Validation happens in upload step
            return;
        }

        if (currentStep === "review") {
            const selectedCount = transactions.filter(
                (t) => t.isSelected && !t.isDuplicate
            ).length;

            if (selectedCount === 0) {
                toast.error("Selecione pelo menos uma transação para importar");
                return;
            }

            setCurrentStep("confirm");
        }
    }, [currentStep, transactions]);

    /**
     * Navigate to previous step
     */
    const handleBack = useCallback(() => {
        if (currentStep === "confirm") {
            setCurrentStep("review");
        } else if (currentStep === "review") {
            setCurrentStep("upload");
        }
    }, [currentStep]);

    /**
     * Handle import confirmation
     */
    const handleConfirm = useCallback(async () => {
        setIsImporting(true);
        setImportError(null);
        setImportProgress(0);

        try {
            const selectedTransactions = transactions.filter(
                (t) => t.isSelected && !t.isDuplicate
            );

            if (selectedTransactions.length === 0) {
                toast.error("Nenhuma transação selecionada para importar");
                return;
            }

            // Transform transactions to the format expected by the action
            const transactionsToImport = selectedTransactions.map((t) => ({
                nome: t.nome,
                valor: t.valor,
                data_compra: t.data_compra,
                tipo_transacao: t.tipo_transacao,
                forma_pagamento: t.forma_pagamento,
                condicao: "À vista",
                periodo: t.periodo,
                anotacao: t.anotacao,
                fitId: t.fitId,
                // Only include categoriaId if it's a valid string
                ...(t.categoriaId && { categoriaId: t.categoriaId }),
            }));

            // Simulate progress during import
            const progressInterval = setInterval(() => {
                setImportProgress((prev) => Math.min(prev + 10, 90));
            }, 100);

            // Call server action to import transactions
            const result = await importOfxTransactionsAction(
                contaId,
                transactionsToImport,
                {} // Empty defaults object since we're not using them
            );

            clearInterval(progressInterval);
            setImportProgress(100);

            if (!result.success) {
                throw new Error(result.error);
            }

            toast.success(result.message);
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
    }, [transactions, contaId, onImportComplete]);

    /**
     * Close dialog and reset state
     */
    const handleClose = useCallback(() => {
        if (isImporting) return;

        setOpen(false);
        // Reset state after animation
        setTimeout(() => {
            setCurrentStep("upload");
            setTransactions([]);
            setParsingError(null);
            setImportError(null);
            setShowDuplicates(true);
            setIsSuggestingCategories(false);
            setUseAiCategorization(aiFeatureAvailable);
            setAiModelId(DEFAULT_MODEL);
        }, 300);

        onCancel?.();
    }, [aiFeatureAvailable, isImporting, onCancel]);

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
                            <DialogTitle className="text-base sm:text-lg truncate">Importar arquivo OFX</DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm truncate">
                                Importe transações do seu banco para o Opensheets
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
                                            className={`text-xs font-medium truncate ${index <= currentStepIndex
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
                                        className={`h-[2px] w-8 sm:w-full mx-1 sm:mx-2 ${index < currentStepIndex
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
                        <UploadStep
                            onFileSelected={handleFileSelected}
                            isLoading={isParsingFile}
                            error={parsingError}
                        />
                    )}

                    {currentStep === "review" && (
                        <ReviewStep
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
                            isSuggestingCategories={isSuggestingCategories}
                            aiFeatureAvailable={aiFeatureAvailable}
                            aiEnabled={useAiCategorization}
                            onToggleAi={setUseAiCategorization}
                            aiModelId={aiModelId}
                            onAiModelChange={setAiModelId}
                        />
                    )}

                    {currentStep === "confirm" && (
                        <ConfirmStep
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

                {/* Footer with Navigation (only for upload and review steps) */}
                {currentStep !== "confirm" && (
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-t flex items-center justify-between gap-2 shrink-0">
                        <Button
                            variant="outline"
                            onClick={handleBack}
                            disabled={
                                currentStep === "upload" ||
                                isParsingFile ||
                                isSuggestingCategories
                            }
                            className="min-w-[80px] text-sm"
                        >
                            Voltar
                        </Button>

                        <Button
                            onClick={handleNext}
                            disabled={
                                currentStep === "upload" ||
                                isParsingFile ||
                                isSuggestingCategories ||
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
