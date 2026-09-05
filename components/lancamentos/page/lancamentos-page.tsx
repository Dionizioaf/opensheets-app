"use client";

import {
  createMassLancamentosAction,
  deleteLancamentoAction,
  deleteLancamentoBulkAction,
  deleteMultipleLancamentosAction,
  applyLancamentoCategorySuggestionsAction,
  suggestLancamentoCategoriesAction,
  toggleLancamentoSettlementAction,
  updateLancamentoBulkAction,
} from "@/app/(dashboard)/lancamentos/actions";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { calculateTotalizers } from "@/lib/lancamentos/totalizers";
import LancamentosTotalizer from "../totalizer/lancamentos-totalizer";
import { DEFAULT_MODEL } from "@/app/(dashboard)/insights/data";
import { isAiCategorizationEnabledClient } from "@/lib/ai/flags";
import { ImportModelSelector } from "@/components/ai/import-model-selector";

import { AnticipateInstallmentsDialog } from "../dialogs/anticipate-installments-dialog/anticipate-installments-dialog";
import { AnticipationHistoryDialog } from "../dialogs/anticipate-installments-dialog/anticipation-history-dialog";
import { BulkActionDialog, type BulkActionScope } from "../dialogs/bulk-action-dialog";
import { LancamentoDetailsDialog } from "../dialogs/lancamento-details-dialog";
import { LancamentoDialog } from "../dialogs/lancamento-dialog/lancamento-dialog";
import { LancamentosTable } from "../table/lancamentos-table";
import { MassAddDialog, type MassAddFormData } from "../dialogs/mass-add-dialog";
import { CsvImportDialog } from "../csv-import/csv-import-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { RiSparklingLine } from "@remixicon/react";
import type {
  ContaCartaoFilterOption,
  LancamentoFilterOption,
  LancamentoItem,
  SelectOption,
} from "../types";

interface LancamentosPageProps {
  userId: string;
  lancamentos: LancamentoItem[];
  pagadorOptions: SelectOption[];
  splitPagadorOptions: SelectOption[];
  defaultPagadorId: string | null;
  contaOptions: SelectOption[];
  cartaoOptions: SelectOption[];
  categoriaOptions: SelectOption[];
  pagadorFilterOptions: LancamentoFilterOption[];
  categoriaFilterOptions: LancamentoFilterOption[];
  contaCartaoFilterOptions: ContaCartaoFilterOption[];
  selectedPeriod: string;
  estabelecimentos: string[];
  allowCreate?: boolean;
  defaultCartaoId?: string | null;
  defaultPaymentMethod?: string | null;
  lockCartaoSelection?: boolean;
  lockPaymentMethod?: boolean;
}

export function LancamentosPage({
  userId,
  lancamentos,
  pagadorOptions,
  splitPagadorOptions,
  defaultPagadorId,
  contaOptions,
  cartaoOptions,
  categoriaOptions,
  pagadorFilterOptions,
  categoriaFilterOptions,
  contaCartaoFilterOptions,
  selectedPeriod,
  estabelecimentos,
  allowCreate = true,
  defaultCartaoId,
  defaultPaymentMethod,
  lockCartaoSelection,
  lockPaymentMethod,
}: LancamentosPageProps) {
  const [selectedLancamento, setSelectedLancamento] =
    useState<LancamentoItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [lancamentoToCopy, setLancamentoToCopy] =
    useState<LancamentoItem | null>(null);
  const [massAddOpen, setMassAddOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lancamentoToDelete, setLancamentoToDelete] =
    useState<LancamentoItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [settlementLoadingId, setSettlementLoadingId] = useState<string | null>(
    null
  );
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Calculate totalizer data from filtered lancamentos
  const totalizerData = useMemo(
    () => {
      console.log("Calculating totalizers for lancamentos");
      return calculateTotalizers(lancamentos);
    },
    [lancamentos]
  );

  /**
   * Handle CSV import dialog open
   */
  const handleCsvImport = useCallback(() => {
    setCsvImportOpen(true);
  }, []);

  /**
   * Handle CSV import completion
   */
  const handleCsvImportComplete = useCallback((importedCount: number) => {
    toast.success(`${importedCount} transações importadas com sucesso`);
    setCsvImportOpen(false);
    // Page will auto-refresh via revalidation in server action
  }, []);

  // Memoize settlement loading check to prevent table re-renders
  const checkSettlementLoading = useCallback(
    (id: string) => settlementLoadingId === id,
    [settlementLoadingId]
  );

  const [pendingEditData, setPendingEditData] = useState<{
    id: string;
    name: string;
    categoriaId: string | undefined;
    note: string;
    pagadorId: string | undefined;
    contaId: string | undefined;
    cartaoId: string | undefined;
    amount: number;
    dueDate: string | null;
    boletoPaymentDate: string | null;
    lancamento: LancamentoItem;
  } | null>(null);
  const [pendingDeleteData, setPendingDeleteData] =
    useState<LancamentoItem | null>(null);
  const [multipleBulkDeleteOpen, setMultipleBulkDeleteOpen] = useState(false);
  const [pendingMultipleDeleteData, setPendingMultipleDeleteData] = useState<
    LancamentoItem[]
  >([]);
  const [anticipateOpen, setAnticipateOpen] = useState(false);
  const [anticipationHistoryOpen, setAnticipationHistoryOpen] = useState(false);
  const [selectedForAnticipation, setSelectedForAnticipation] =
    useState<LancamentoItem | null>(null);
  const [categorizeOpen, setCategorizeOpen] = useState(false);
  const [categorizeRunning, setCategorizeRunning] = useState(false);
  const [categorizeAppliedCount, setCategorizeAppliedCount] = useState(0);
  const [categorizeSuggestions, setCategorizeSuggestions] = useState<
    Array<{
      id: string;
      name: string;
      currentCategoriaName: string | null;
      suggestedCategoriaName: string | null;
      suggestedCategoriaId: string | null;
      confidence: "high" | "medium" | "low";
    }>
  >([]);
  const [categorizeSelection, setCategorizeSelection] = useState<Set<string>>(
    new Set()
  );
  const [categorizeSelectedOnly, setCategorizeSelectedOnly] = useState(false);
  const [selectedRows, setSelectedRows] = useState<LancamentoItem[]>([]);
  const aiFeatureAvailable = isAiCategorizationEnabledClient();
  const [useAiCategorization, setUseAiCategorization] = useState(
    aiFeatureAvailable
  );
  const [aiModelId, setAiModelId] = useState(DEFAULT_MODEL);
  const router = useRouter();

  useEffect(() => {
    if (!userId) {
      return;
    }

    const storageKey = `lancamentos:categorization:${userId}`;
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        useAi?: boolean;
        modelId?: string;
        selectedOnly?: boolean;
      };
      if (typeof parsed.useAi === "boolean") {
        setUseAiCategorization(parsed.useAi);
      }
      if (typeof parsed.modelId === "string" && parsed.modelId.length > 0) {
        setAiModelId(parsed.modelId);
      }
      if (typeof parsed.selectedOnly === "boolean") {
        setCategorizeSelectedOnly(parsed.selectedOnly);
      }
    } catch (error) {
      console.error("Erro ao carregar preferências de categorização:", error);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const storageKey = `lancamentos:categorization:${userId}`;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        useAi: useAiCategorization,
        modelId: aiModelId,
        selectedOnly: categorizeSelectedOnly,
      })
    );
  }, [aiModelId, categorizeSelectedOnly, useAiCategorization, userId]);

  const handleToggleSettlement = useCallback(async (item: LancamentoItem) => {
    if (item.paymentMethod === "Cartão de crédito") {
      toast.info(
        "Pagamentos com cartão são conciliados automaticamente. Ajuste pelo cartão."
      );
      return;
    }

    const supportedMethods = ["Pix", "Boleto", "Dinheiro", "Cartão de débito"];
    if (!supportedMethods.includes(item.paymentMethod)) {
      return;
    }

    const nextValue = !Boolean(item.isSettled);

    try {
      setSettlementLoadingId(item.id);
      const result = await toggleLancamentoSettlementAction({
        id: item.id,
        value: nextValue,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(result.message);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o pagamento.";
      toast.error(message);
    } finally {
      setSettlementLoadingId(null);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!lancamentoToDelete) {
      return;
    }

    const result = await deleteLancamentoAction({
      id: lancamentoToDelete.id,
    });

    if (!result.success) {
      toast.error(result.error);
      throw new Error(result.error);
    }

    toast.success(result.message);
    setDeleteOpen(false);
  }, [lancamentoToDelete]);

  const handleBulkDelete = useCallback(
    async (scope: BulkActionScope) => {
      if (!pendingDeleteData) {
        return;
      }

      const result = await deleteLancamentoBulkAction({
        id: pendingDeleteData.id,
        scope,
      });

      if (!result.success) {
        toast.error(result.error);
        throw new Error(result.error);
      }

      toast.success(result.message);
      setBulkDeleteOpen(false);
      setPendingDeleteData(null);
    },
    [pendingDeleteData]
  );

  const handleBulkEditRequest = useCallback(
    (data: {
      id: string;
      name: string;
      categoriaId: string | undefined;
      note: string;
      pagadorId: string | undefined;
      contaId: string | undefined;
      cartaoId: string | undefined;
      amount: number;
      dueDate: string | null;
      boletoPaymentDate: string | null;
    }) => {
      if (!selectedLancamento) {
        return;
      }

      setPendingEditData({
        ...data,
        lancamento: selectedLancamento,
      });
      setEditOpen(false);
      setBulkEditOpen(true);
    },
    [selectedLancamento]
  );

  const handleBulkEdit = useCallback(
    async (scope: BulkActionScope) => {
      if (!pendingEditData) {
        return;
      }

      const result = await updateLancamentoBulkAction({
        id: pendingEditData.id,
        scope,
        name: pendingEditData.name,
        categoriaId: pendingEditData.categoriaId,
        note: pendingEditData.note,
        pagadorId: pendingEditData.pagadorId,
        contaId: pendingEditData.contaId,
        cartaoId: pendingEditData.cartaoId,
        amount: pendingEditData.amount,
        dueDate: pendingEditData.dueDate,
        boletoPaymentDate: pendingEditData.boletoPaymentDate,
      });

      if (!result.success) {
        toast.error(result.error);
        throw new Error(result.error);
      }

      toast.success(result.message);
      setBulkEditOpen(false);
      setPendingEditData(null);
    },
    [pendingEditData]
  );

  const handleMassAddSubmit = useCallback(async (data: MassAddFormData) => {
    // Fix enum fields to match expected literal types and ensure amount is number
    const fixedData = {
      ...data,
      fixedFields: {
        ...data.fixedFields,
        transactionType: data.fixedFields.transactionType as
          | "Despesa"
          | "Receita"
          | "Transferência"
          | undefined,
        paymentMethod: data.fixedFields.paymentMethod as
          | "Cartão de crédito"
          | "Pix"
          | "Boleto"
          | "Dinheiro"
          | "Cartão de débito"
          | undefined,
        condition: data.fixedFields.condition as
          | "À vista"
          | "Parcelado"
          | "Recorrente"
          | undefined,
      },
      transactions: data.transactions.map((t) => ({
        ...t,
        amount: typeof t.amount === 'string' ? Number(t.amount) : t.amount,
      })),
    };
    const result = await createMassLancamentosAction(fixedData);

    if (!result.success) {
      toast.error(result.error);
      throw new Error(result.error);
    }

    toast.success(result.message);
  }, []);

  const handleMultipleBulkDelete = useCallback((items: LancamentoItem[]) => {
    setPendingMultipleDeleteData(items);
    setMultipleBulkDeleteOpen(true);
  }, []);

  const confirmMultipleBulkDelete = useCallback(async () => {
    if (pendingMultipleDeleteData.length === 0) {
      return;
    }

    const ids = pendingMultipleDeleteData.map((item) => item.id);
    const result = await deleteMultipleLancamentosAction({ ids });

    if (!result.success) {
      toast.error(result.error);
      throw new Error(result.error);
    }

    toast.success(result.message);
    setMultipleBulkDeleteOpen(false);
    setPendingMultipleDeleteData([]);
  }, [pendingMultipleDeleteData]);

  const handleCreate = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleMassAdd = useCallback(() => {
    setMassAddOpen(true);
  }, []);

  const handleEdit = useCallback((item: LancamentoItem) => {
    setSelectedLancamento(item);
    setEditOpen(true);
  }, []);

  const handleCopy = useCallback((item: LancamentoItem) => {
    setLancamentoToCopy(item);
    setCopyOpen(true);
  }, []);

  const handleConfirmDelete = useCallback((item: LancamentoItem) => {
    if (item.seriesId) {
      setPendingDeleteData(item);
      setBulkDeleteOpen(true);
    } else {
      setLancamentoToDelete(item);
      setDeleteOpen(true);
    }
  }, []);

  const handleViewDetails = useCallback((item: LancamentoItem) => {
    setSelectedLancamento(item);
    setDetailsOpen(true);
  }, []);

  const handleAnticipate = useCallback((item: LancamentoItem) => {
    setSelectedForAnticipation(item);
    setAnticipateOpen(true);
  }, []);

  const handleViewAnticipationHistory = useCallback((item: LancamentoItem) => {
    setSelectedForAnticipation(item);
    setAnticipationHistoryOpen(true);
  }, []);

  const handleOpenCategorization = useCallback(() => {
    setCategorizeOpen(true);
    setCategorizeAppliedCount(0);
    setCategorizeSuggestions([]);
    setCategorizeSelection(new Set());
  }, []);

  const handleRunCategorization = useCallback(async () => {
    const baseItems = categorizeSelectedOnly
      ? selectedRows
      : lancamentos;

    if (baseItems.length === 0) {
      toast.info("Nenhum lançamento para classificar.");
      return;
    }

    if (baseItems.length > 300) {
      toast.error("Limite de 300 lançamentos por classificação.");
      return;
    }

    try {
      setCategorizeRunning(true);
      const result = await suggestLancamentoCategoriesAction({
        ids: baseItems.map((item) => item.id),
        modelId: aiModelId,
        useAi: useAiCategorization,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Erro ao sugerir categorias.");
      }

      setCategorizeAppliedCount(result.data.appliedCount);
      setCategorizeSuggestions(result.data.reviewSuggestions);
      setCategorizeSelection(
        new Set(result.data.reviewSuggestions.map((item) => item.id))
      );

      if (result.data.appliedCount > 0) {
        toast.success(
          `${result.data.appliedCount} lançamentos atualizados automaticamente.`
        );
      }

      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro ao sugerir categorias.";
      toast.error(message);
    } finally {
      setCategorizeRunning(false);
    }
  }, [
    aiModelId,
    categorizeSelectedOnly,
    lancamentos,
    router,
    selectedRows,
    useAiCategorization,
  ]);

  const toggleCategorizeSelection = useCallback((id: string) => {
    setCategorizeSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleApplyCategorization = useCallback(async () => {
    if (categorizeSelection.size === 0) {
      toast.info("Selecione pelo menos uma sugestão.");
      return;
    }

    const selectedSuggestions = categorizeSuggestions
      .filter((item) => categorizeSelection.has(item.id))
      .filter((item) => item.suggestedCategoriaId);

    if (selectedSuggestions.length === 0) {
      toast.info("Nenhuma sugestão válida selecionada.");
      return;
    }

    const result = await applyLancamentoCategorySuggestionsAction({
      suggestions: selectedSuggestions.map((item) => ({
        id: item.id,
        categoriaId: item.suggestedCategoriaId!,
      })),
    });

    if (!result.success || !result.data) {
      toast.error(result.error ?? "Erro ao aplicar sugestões.");
      return;
    }

    toast.success(`${result.data.appliedCount} sugestões aplicadas.`);
    setCategorizeOpen(false);
    setCategorizeSuggestions([]);
    setCategorizeSelection(new Set());
    router.refresh();
  }, [categorizeSelection, categorizeSuggestions, router]);

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <LancamentosTotalizer totalizerData={totalizerData} />
      </div>

      <div className="flex flex-col gap-6">

        <LancamentosTable
          data={lancamentos}
          pagadorFilterOptions={pagadorFilterOptions}
          categoriaFilterOptions={categoriaFilterOptions}
          contaCartaoFilterOptions={contaCartaoFilterOptions}
          onCreate={allowCreate ? handleCreate : undefined}
          onMassAdd={allowCreate ? handleMassAdd : undefined}
          onCsvImport={allowCreate ? handleCsvImport : undefined}
          onRunCategorization={allowCreate ? handleOpenCategorization : undefined}
          onSelectionChange={setSelectedRows}
          onEdit={handleEdit}
          onCopy={handleCopy}
          onConfirmDelete={handleConfirmDelete}
          onBulkDelete={handleMultipleBulkDelete}
          onViewDetails={handleViewDetails}
          onToggleSettlement={handleToggleSettlement}
          onAnticipate={handleAnticipate}
          onViewAnticipationHistory={handleViewAnticipationHistory}
          isSettlementLoading={checkSettlementLoading}
        />
      </div>

      {allowCreate ? (
        <LancamentoDialog
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          pagadorOptions={pagadorOptions}
          splitPagadorOptions={splitPagadorOptions}
          defaultPagadorId={defaultPagadorId}
          contaOptions={contaOptions}
          cartaoOptions={cartaoOptions}
          categoriaOptions={categoriaOptions}
          estabelecimentos={estabelecimentos}
          defaultPeriod={selectedPeriod}
          defaultCartaoId={defaultCartaoId}
          defaultPaymentMethod={defaultPaymentMethod}
          lockCartaoSelection={lockCartaoSelection}
          lockPaymentMethod={lockPaymentMethod}
        />
      ) : null}

      <LancamentoDialog
        mode="create"
        open={copyOpen && !!lancamentoToCopy}
        onOpenChange={(open) => {
          setCopyOpen(open);
          if (!open) {
            setLancamentoToCopy(null);
          }
        }}
        pagadorOptions={pagadorOptions}
        splitPagadorOptions={splitPagadorOptions}
        defaultPagadorId={defaultPagadorId}
        contaOptions={contaOptions}
        cartaoOptions={cartaoOptions}
        categoriaOptions={categoriaOptions}
        estabelecimentos={estabelecimentos}
        lancamento={lancamentoToCopy ?? undefined}
        defaultPeriod={selectedPeriod}
      />

      <LancamentoDialog
        mode="update"
        open={editOpen && !!selectedLancamento}
        onOpenChange={setEditOpen}
        pagadorOptions={pagadorOptions}
        splitPagadorOptions={splitPagadorOptions}
        defaultPagadorId={defaultPagadorId}
        contaOptions={contaOptions}
        cartaoOptions={cartaoOptions}
        categoriaOptions={categoriaOptions}
        estabelecimentos={estabelecimentos}
        lancamento={selectedLancamento ?? undefined}
        defaultPeriod={selectedPeriod}
        onBulkEditRequest={handleBulkEditRequest}
      />

      <LancamentoDetailsDialog
        open={detailsOpen && !!selectedLancamento}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setSelectedLancamento(null);
          }
        }}
        lancamento={detailsOpen ? selectedLancamento : null}
      />

      <ConfirmActionDialog
        open={deleteOpen && !!lancamentoToDelete}
        onOpenChange={setDeleteOpen}
        title={
          lancamentoToDelete
            ? `Remover lançamento "${lancamentoToDelete.name}"?`
            : "Remover lançamento?"
        }
        description="Essa ação é irreversível e removerá o lançamento de forma permanente."
        confirmLabel="Remover"
        pendingLabel="Removendo..."
        confirmVariant="destructive"
        onConfirm={handleDelete}
        disabled={!lancamentoToDelete}
      />

      <BulkActionDialog
        open={bulkDeleteOpen && !!pendingDeleteData}
        onOpenChange={setBulkDeleteOpen}
        actionType="delete"
        seriesType={
          pendingDeleteData?.condition === "Parcelado"
            ? "installment"
            : "recurring"
        }
        currentNumber={pendingDeleteData?.currentInstallment ?? undefined}
        totalCount={
          pendingDeleteData?.installmentCount ??
          pendingDeleteData?.recurrenceCount ??
          undefined
        }
        onConfirm={handleBulkDelete}
      />

      <BulkActionDialog
        open={bulkEditOpen && !!pendingEditData}
        onOpenChange={setBulkEditOpen}
        actionType="edit"
        seriesType={
          pendingEditData?.lancamento.condition === "Parcelado"
            ? "installment"
            : "recurring"
        }
        currentNumber={
          pendingEditData?.lancamento.currentInstallment ?? undefined
        }
        totalCount={
          pendingEditData?.lancamento.installmentCount ??
          pendingEditData?.lancamento.recurrenceCount ??
          undefined
        }
        onConfirm={handleBulkEdit}
      />

      <Dialog open={categorizeOpen} onOpenChange={setCategorizeOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Classificar lançamentos</DialogTitle>
            <DialogDescription>
              Classifica os lançamentos visíveis do período atual. Alta confiança
              é aplicada automaticamente e as demais ficam para revisão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Usar IA para sugerir categorias</p>
                  <p className="text-xs text-muted-foreground">
                    Se desativado, usamos a sugestão baseada no histórico.
                  </p>
                </div>
                <Switch
                  checked={useAiCategorization}
                  onCheckedChange={setUseAiCategorization}
                  disabled={!aiFeatureAvailable}
                />
              </div>

              {useAiCategorization && aiFeatureAvailable ? (
                <ImportModelSelector
                  value={aiModelId}
                  onValueChange={setAiModelId}
                  disabled={categorizeRunning}
                />
              ) : null}

              <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Apenas linhas selecionadas</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedRows.length > 0
                      ? `${selectedRows.length} selecionadas na tabela.`
                      : "Nenhuma linha selecionada."}
                  </p>
                </div>
                <Switch
                  checked={categorizeSelectedOnly}
                  onCheckedChange={setCategorizeSelectedOnly}
                  disabled={selectedRows.length === 0}
                />
              </div>
            </div>

            {(categorizeAppliedCount > 0 || categorizeSuggestions.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">Resumo:</span>
                <span>{categorizeAppliedCount} aplicadas automaticamente</span>
                <span className="text-muted-foreground">|</span>
                <span>{categorizeSuggestions.length} para revisao</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {categorizeAppliedCount > 0
                  ? `${categorizeAppliedCount} atualizados automaticamente.`
                  : "Pronto para analisar os lançamentos."}
              </div>
              <Button
                onClick={handleRunCategorization}
                disabled={
                  categorizeRunning ||
                  (categorizeSelectedOnly && selectedRows.length === 0)
                }
              >
                <RiSparklingLine className="size-4" />
                {categorizeRunning ? "Classificando..." : "Classificar agora"}
              </Button>
            </div>

            {categorizeSuggestions.length > 0 ? (
              <div className="space-y-3">
                <div className="text-sm font-medium">
                  Sugestões para revisar ({categorizeSuggestions.length})
                </div>
                <div className="max-h-[320px] overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              categorizeSelection.size ===
                              categorizeSuggestions.length &&
                              categorizeSuggestions.length > 0
                            }
                            onCheckedChange={(value) => {
                              if (value) {
                                setCategorizeSelection(
                                  new Set(
                                    categorizeSuggestions.map((item) => item.id)
                                  )
                                );
                              } else {
                                setCategorizeSelection(new Set());
                              }
                            }}
                            aria-label="Selecionar todas"
                          />
                        </TableHead>
                        <TableHead>Estabelecimento</TableHead>
                        <TableHead>Atual</TableHead>
                        <TableHead>Sugerida</TableHead>
                        <TableHead>Confiança</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categorizeSuggestions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={categorizeSelection.has(item.id)}
                              onCheckedChange={() =>
                                toggleCategorizeSelection(item.id)
                              }
                              aria-label="Selecionar sugestão"
                            />
                          </TableCell>
                          <TableCell className="text-sm">{item.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.currentCategoriaName ?? "Sem categoria"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.suggestedCategoriaName ?? "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.confidence === "high"
                                ? "Alta"
                                : item.confidence === "medium"
                                  ? "Média"
                                  : "Baixa"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleApplyCategorization}
                    disabled={categorizeSelection.size === 0}
                  >
                    Aplicar selecionadas
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {allowCreate ? (
        <MassAddDialog
          open={massAddOpen}
          onOpenChange={setMassAddOpen}
          onSubmit={handleMassAddSubmit}
          pagadorOptions={pagadorOptions}
          contaOptions={contaOptions}
          cartaoOptions={cartaoOptions}
          categoriaOptions={categoriaOptions}
          estabelecimentos={estabelecimentos}
          selectedPeriod={selectedPeriod}
          defaultPagadorId={defaultPagadorId}
        />
      ) : null}

      {allowCreate ? (
        <CsvImportDialog
          open={csvImportOpen}
          onOpenChange={setCsvImportOpen}
          trigger={null}
          contas={contaOptions.map((c) => ({
            id: c.value,
            nome: c.label,
            tipo: "banco" as const,
          }))}
          cartoes={cartaoOptions.map((c) => ({
            id: c.value,
            nome: c.label,
            tipo: "cartao" as const,
          }))}
          categorias={categoriaOptions.map((c) => {
            // Map SelectOption to Categoria type
            return {
              id: c.value,
              nome: c.label,
              tipo: "despesa" as const, // Default to despesa, actual type doesn't matter for display
              icone: c.icon ?? null,
              createdAt: new Date(),
              userId: "", // Not used in import flow
            };
          })}
          pagadores={pagadorOptions.map((p) => ({
            id: p.value,
            nome: p.label,
          }))}
          onImportComplete={handleCsvImportComplete}
          onCancel={() => setCsvImportOpen(false)}
        />
      ) : null}

      <ConfirmActionDialog
        open={multipleBulkDeleteOpen && pendingMultipleDeleteData.length > 0}
        onOpenChange={setMultipleBulkDeleteOpen}
        title={`Remover ${pendingMultipleDeleteData.length} ${pendingMultipleDeleteData.length === 1 ? "lançamento" : "lançamentos"
          }?`}
        description="Essa ação é irreversível e removerá os lançamentos selecionados de forma permanente."
        confirmLabel="Remover"
        pendingLabel="Removendo..."
        confirmVariant="destructive"
        onConfirm={confirmMultipleBulkDelete}
        disabled={pendingMultipleDeleteData.length === 0}
      />

      {/* Dialogs de Antecipação */}
      {selectedForAnticipation && (
        <AnticipateInstallmentsDialog
          open={anticipateOpen}
          onOpenChange={setAnticipateOpen}
          seriesId={selectedForAnticipation.seriesId!}
          lancamentoName={selectedForAnticipation.name}
          categorias={categoriaOptions.map((c) => ({
            id: c.value,
            name: c.label,
            icon: c.icon ?? null,
          }))}
          pagadores={pagadorOptions.map((p) => ({
            id: p.value,
            name: p.label,
          }))}
          defaultPeriod={selectedPeriod}
        />
      )}

      {selectedForAnticipation && (
        <AnticipationHistoryDialog
          open={anticipationHistoryOpen}
          onOpenChange={setAnticipationHistoryOpen}
          seriesId={selectedForAnticipation.seriesId!}
          lancamentoName={selectedForAnticipation.name}
          onViewLancamento={(lancamentoId) => {
            const lancamento = lancamentos.find((l) => l.id === lancamentoId);
            if (lancamento) {
              setSelectedLancamento(lancamento);
              setDetailsOpen(true);
              setAnticipationHistoryOpen(false);
            }
          }}
        />
      )}
    </>
  );
}
