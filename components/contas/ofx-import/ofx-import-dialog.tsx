"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiCloseLine } from "@remixicon/react";
import { toast } from "sonner";
import { parseOfxFile } from "@/lib/ofx/parser";
import { mapOfxTransactionsToLancamentos } from "@/lib/ofx/mapper";
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
  onImportComplete,
  onCancel,
}: OfxImportDialogProps) {
  // Dialog state
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>("upload");

  // Upload step state
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parsingError, setParsingError] = useState<string | null>(null);

  // Transactions state
  const [transactions, setTransactions] = useState<ImportTransaction[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(true);

  // Import step state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);

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

        // Parse OFX file
        const statement = parseOfxFile(fileContent);

        if (!statement.transactions || statement.transactions.length === 0) {
          throw new Error("Nenhuma transação encontrada no arquivo OFX");
        }

        // Map to lancamento format
        const parsedTransactions = mapOfxTransactionsToLancamentos(
          statement.transactions,
          contaId
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
        toast.success(`${importTransactions.length} transações carregadas`);
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
    [contaId, defaultCategoriaId]
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

      // TODO: Call server action to import transactions
      // For now, simulate progress
      for (let i = 0; i <= 100; i += 10) {
        setImportProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      toast.success(
        `${selectedTransactions.length} transações importadas com sucesso`
      );
      onImportComplete?.(selectedTransactions.length);
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
  }, [transactions, onImportComplete]);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-hidden p-0"
        showCloseButton={false}
      >
        {/* Header with Progress Indicator */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Importar arquivo OFX</DialogTitle>
              <DialogDescription>
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
          <div className="flex items-center gap-2 mt-4">
            {WIZARD_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <Badge
                    variant={
                      index < currentStepIndex
                        ? "default"
                        : index === currentStepIndex
                          ? "default"
                          : "outline"
                    }
                    className="shrink-0"
                  >
                    {index + 1}
                  </Badge>
                  <div className="flex-1 min-w-0">
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
                    className={`h-[2px] w-full mx-2 ${
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
        <div className="px-6 py-6 overflow-y-auto flex-1">
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
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === "upload" || isParsingFile}
            >
              Voltar
            </Button>

            <Button
              onClick={handleNext}
              disabled={
                currentStep === "upload" ||
                isParsingFile ||
                (currentStep === "review" && selectedCount === 0)
              }
            >
              {currentStep === "review" ? "Continuar" : "Próximo"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
