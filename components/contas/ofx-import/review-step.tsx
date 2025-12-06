"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CategoryIcon } from "@/components/categorias/category-icon";
import {
  RiAlertLine,
  RiCheckLine,
  RiInformationLine,
  RiEyeLine,
  RiEyeOffLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils/ui";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ImportTransaction, CategoryOption } from "./types";

interface ReviewStepProps {
  transactions: ImportTransaction[];
  categorias: CategoryOption[];
  selectedCount: number;
  duplicateCount: number;
  onTransactionUpdate: (id: string, updates: Partial<ImportTransaction>) => void;
  onToggleSelection: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
  onBulkCategorySet: (ids: string[], categoriaId: string) => void;
  showDuplicates: boolean;
  onToggleDuplicates: (show: boolean) => void;
}

export function ReviewStep({
  transactions,
  categorias,
  selectedCount,
  duplicateCount,
  onTransactionUpdate,
  onToggleSelection,
  onToggleAll,
  onBulkCategorySet,
  showDuplicates,
  onToggleDuplicates,
}: ReviewStepProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkCategoryMode, setBulkCategoryMode] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());

  // Filter transactions based on showDuplicates
  const visibleTransactions = useMemo(() => {
    if (showDuplicates) {
      return transactions;
    }
    return transactions.filter((t) => !t.isDuplicate);
  }, [transactions, showDuplicates]);

  // Check if all visible transactions are selected
  const allSelected = useMemo(() => {
    const selectableTransactions = visibleTransactions.filter((t) => !t.isDuplicate);
    return selectableTransactions.length > 0 && selectableTransactions.every((t) => t.isSelected);
  }, [visibleTransactions]);

  /**
   * Handle select all checkbox
   */
  const handleSelectAll = useCallback(() => {
    onToggleAll(!allSelected);
  }, [allSelected, onToggleAll]);

  /**
   * Handle transaction name edit
   */
  const handleNameEdit = useCallback(
    (id: string, nome: string) => {
      onTransactionUpdate(id, { nome, isEdited: true });
      setEditingId(null);
    },
    [onTransactionUpdate]
  );

  /**
   * Handle category change
   */
  const handleCategoryChange = useCallback(
    (id: string, categoriaId: string) => {
      onTransactionUpdate(id, { categoriaId, isEdited: true });
    },
    [onTransactionUpdate]
  );

  /**
   * Toggle bulk category mode
   */
  const toggleBulkMode = useCallback(() => {
    setBulkCategoryMode(!bulkCategoryMode);
    setSelectedForBulk(new Set());
  }, [bulkCategoryMode]);

  /**
   * Toggle transaction for bulk action
   */
  const toggleBulkSelection = useCallback((id: string) => {
    setSelectedForBulk((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /**
   * Apply bulk category
   */
  const handleBulkCategoryApply = useCallback(
    (categoriaId: string) => {
      if (selectedForBulk.size > 0) {
        onBulkCategorySet(Array.from(selectedForBulk), categoriaId);
        setSelectedForBulk(new Set());
        setBulkCategoryMode(false);
      }
    },
    [selectedForBulk, onBulkCategorySet]
  );

  /**
   * Get category by ID
   */
  const getCategoryById = useCallback(
    (id?: string) => {
      if (!id) return null;
      return categorias.find((c) => c.id === id);
    },
    [categorias]
  );

  /**
   * Get confidence badge color
   */
  const getConfidenceBadgeVariant = (
    confidence?: "high" | "medium" | "low"
  ): "default" | "secondary" | "outline" => {
    switch (confidence) {
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  /**
   * Format currency
   */
  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Revisar transações</h3>
        <p className="text-sm text-muted-foreground">
          Revise e edite as transações antes de importar. Você pode alterar nomes e categorias.
        </p>
      </div>

      {/* Summary and Actions */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-muted/50">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-sm font-medium">{selectedCount} selecionadas</p>
            <p className="text-xs text-muted-foreground">
              de {visibleTransactions.length} transações
            </p>
          </div>
          
          {duplicateCount > 0 && (
            <div className="flex items-center gap-2">
              <RiAlertLine className="w-4 h-4 text-warning" />
              <div>
                <p className="text-sm font-medium text-warning">
                  {duplicateCount} duplicadas
                </p>
                <p className="text-xs text-muted-foreground">
                  Serão ignoradas na importação
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {duplicateCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleDuplicates(!showDuplicates)}
            >
              {showDuplicates ? (
                <>
                  <RiEyeOffLine className="w-4 h-4 mr-2" />
                  Ocultar duplicadas
                </>
              ) : (
                <>
                  <RiEyeLine className="w-4 h-4 mr-2" />
                  Mostrar duplicadas
                </>
              )}
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={toggleBulkMode}
          >
            {bulkCategoryMode ? "Cancelar edição em massa" : "Editar categorias em massa"}
          </Button>
        </div>
      </div>

      {/* Bulk Category Selection */}
      {bulkCategoryMode && (
        <div className="flex items-center gap-4 p-4 rounded-lg border bg-primary/5">
          <p className="text-sm font-medium">
            {selectedForBulk.size} transações selecionadas
          </p>
          
          <Select
            onValueChange={handleBulkCategoryApply}
            disabled={selectedForBulk.size === 0}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Selecionar categoria" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="flex items-center gap-2">
                    <CategoryIcon name={cat.icone} className="size-4" />
                    <span>{cat.nome}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Transactions Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                {!bulkCategoryMode && (
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Selecionar todas"
                  />
                )}
              </TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhuma transação para exibir
                </TableCell>
              </TableRow>
            ) : (
              visibleTransactions.map((transaction) => {
                const category = getCategoryById(transaction.categoriaId);
                const suggestedCategory = getCategoryById(transaction.suggestedCategoriaId);
                const isEditing = editingId === transaction.id;

                return (
                  <TableRow
                    key={transaction.id}
                    className={cn(
                      transaction.isDuplicate && "bg-destructive/5 opacity-60",
                      transaction.isEdited && "bg-accent/50"
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell>
                      {bulkCategoryMode ? (
                        <Checkbox
                          checked={selectedForBulk.has(transaction.id)}
                          onCheckedChange={() => toggleBulkSelection(transaction.id)}
                          disabled={transaction.isDuplicate}
                        />
                      ) : (
                        <Checkbox
                          checked={transaction.isSelected}
                          onCheckedChange={() => onToggleSelection(transaction.id)}
                          disabled={transaction.isDuplicate}
                        />
                      )}
                    </TableCell>

                    {/* Date */}
                    <TableCell className="text-sm">
                      {format(transaction.data_compra, "dd/MM/yy", { locale: ptBR })}
                    </TableCell>

                    {/* Description (editable) */}
                    <TableCell>
                      {isEditing ? (
                        <Input
                          defaultValue={transaction.nome}
                          onBlur={(e) => handleNameEdit(transaction.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleNameEdit(transaction.id, e.currentTarget.value);
                            }
                            if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                          autoFocus
                          className="h-8"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingId(transaction.id)}
                          className="text-sm hover:underline text-left"
                          disabled={transaction.isDuplicate}
                        >
                          {transaction.nome}
                        </button>
                      )}
                    </TableCell>

                    {/* Amount */}
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          transaction.tipo_transacao === "Despesa"
                            ? "text-destructive"
                            : "text-green-600"
                        )}
                      >
                        {transaction.tipo_transacao === "Despesa" && "-"}
                        {formatCurrency(transaction.valor)}
                      </span>
                    </TableCell>

                    {/* Category (editable) */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={transaction.categoriaId}
                          onValueChange={(value) =>
                            handleCategoryChange(transaction.id, value)
                          }
                          disabled={transaction.isDuplicate}
                        >
                          <SelectTrigger className="h-8 w-[200px]">
                            <SelectValue placeholder="Sem categoria">
                              {category && (
                                <span className="flex items-center gap-2">
                                  <CategoryIcon name={category.icone} className="size-4" />
                                  <span>{category.nome}</span>
                                </span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {categorias.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <span className="flex items-center gap-2">
                                  <CategoryIcon name={cat.icone} className="size-4" />
                                  <span>{cat.nome}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Suggestion indicator */}
                        {suggestedCategory && transaction.categoriaId === transaction.suggestedCategoriaId && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant={getConfidenceBadgeVariant(
                                    transaction.categoryConfidence
                                  )}
                                  className="gap-1"
                                >
                                  <RiCheckLine className="w-3 h-3" />
                                  <span className="text-xs">
                                    {transaction.categoryConfidence === "high"
                                      ? "Alta"
                                      : transaction.categoryConfidence === "medium"
                                      ? "Média"
                                      : "Baixa"}
                                  </span>
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  Categoria sugerida automaticamente com confiança{" "}
                                  {transaction.categoryConfidence}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>

                    {/* Duplicate indicator */}
                    <TableCell>
                      {transaction.isDuplicate && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <RiAlertLine className="w-5 h-5 text-warning" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1 text-xs">
                                <p className="font-medium">Possível duplicata</p>
                                {transaction.duplicateDetails && (
                                  <>
                                    <p>
                                      Transação similar:{" "}
                                      {transaction.duplicateDetails.existingTransactionName}
                                    </p>
                                    <p>
                                      Similaridade:{" "}
                                      {transaction.duplicateDetails.similarityScore}%
                                    </p>
                                  </>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <RiInformationLine className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          Transações marcadas como duplicadas não serão importadas. Clique na descrição para
          editar o nome da transação.
        </p>
      </div>
    </div>
  );
}
