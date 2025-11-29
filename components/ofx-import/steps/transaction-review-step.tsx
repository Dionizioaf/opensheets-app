"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils/ui";
import { formatDate } from "@/lib/utils/date";
import { findBatchTransactionDuplicates, type DuplicateDetectionResult } from "@/lib/ofx-parser/duplicate-detection";
import { RiAlertLine, RiCheckLine, RiErrorWarningLine, RiMagicLine } from "@remixicon/react";
import * as React from "react";
import { ErrorGuidanceAlert } from "@/components/ofx-import/error-guidance-alert";

// Helper function to format date as dd/MM/yyyy
export const formatDateDisplay = (dateString: string): string => {
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
};

export interface TransactionReviewStepProps {
  accountId: string;
  accountName: string;
  userId: string;
  wizardData: Record<string, any>;
  onDataChange: (data: any) => void;
}

// Mock transaction data for development (will be replaced with actual OFX parsing)
const MOCK_TRANSACTIONS = [
  {
    id: "tx-1",
    date: "2024-01-15",
    amount: -25.50,
    description: "UBER TRIP",
    payee: "UBER",
    type: "debit" as const,
    categoryId: null,
    categoryName: null,
    isDuplicate: false,
    validationStatus: "valid" as const,
    aiSuggestions: [
      { categoryId: "cat-transport", categoryName: "Transporte", confidence: 0.95 },
      { categoryId: "cat-outros", categoryName: "Outros", confidence: 0.05 },
    ],
  },
  {
    id: "tx-2",
    date: "2024-01-16",
    amount: -45.90,
    description: "FARMACIA DROGASIL",
    payee: "DROGASIL",
    type: "debit" as const,
    categoryId: null,
    categoryName: null,
    isDuplicate: true,
    validationStatus: "warning" as const,
    aiSuggestions: [
      { categoryId: "cat-saude", categoryName: "Saúde", confidence: 0.90 },
      { categoryId: "cat-outros", categoryName: "Outros", confidence: 0.10 },
    ],
  },
  {
    id: "tx-3",
    date: "2024-01-17",
    amount: 1500.00,
    description: "SALARIO EMPRESA",
    payee: "EMPRESA XYZ",
    type: "credit" as const,
    categoryId: null,
    categoryName: null,
    isDuplicate: false,
    validationStatus: "valid" as const,
    aiSuggestions: [
      { categoryId: "cat-salario", categoryName: "Salário", confidence: 0.98 },
      { categoryId: "cat-renda", categoryName: "Renda Extra", confidence: 0.02 },
    ],
  },
];

// Mock categories (will be fetched from database)
const MOCK_CATEGORIES = [
  { id: "cat-transport", name: "Transporte", type: "despesa" },
  { id: "cat-saude", name: "Saúde", type: "despesa" },
  { id: "cat-alimentacao", name: "Alimentação", type: "despesa" },
  { id: "cat-lazer", name: "Lazer", type: "despesa" },
  { id: "cat-salario", name: "Salário", type: "receita" },
  { id: "cat-renda", name: "Renda Extra", type: "receita" },
  { id: "cat-outros", name: "Outros", type: "despesa" },
];

type TransactionStatus = "valid" | "warning" | "error";

export interface TransactionItem {
  id: string;
  date: string;
  amount: number;
  description: string;
  payee?: string;
  type: "debit" | "credit";
  categoryId: string | null;
  categoryName: string | null;
  isDuplicate: boolean;
  validationStatus: "valid" | "warning" | "error";
  duplicateAction?: "skip" | "import" | "update";
  aiSuggestions: Array<{
    categoryId: string;
    categoryName: string;
    confidence: number;
  }>;
  duplicateInfo?: {
    matches: Array<{
      existingTransactionId: string;
      existingDate: string;
      existingAmount: number;
      existingDescription: string;
      similarity: number;
      matchReasons: string[];
    }>;
    bestMatch?: {
      existingTransactionId: string;
      existingDate: string;
      existingAmount: number;
      existingDescription: string;
      similarity: number;
      matchReasons: string[];
    };
  };
}

export function TransactionReviewStep({
  accountId,
  accountName,
  userId,
  wizardData,
  onDataChange,
}: TransactionReviewStepProps) {
  const [transactions, setTransactions] = React.useState<TransactionItem[]>(MOCK_TRANSACTIONS);
  const [selectedTransactions, setSelectedTransactions] = React.useState<Set<string>>(new Set());
  const [isDetectingDuplicates, setIsDetectingDuplicates] = React.useState(false);
  const [aiWarnings, setAiWarnings] = React.useState<string[]>([]);

  // Refs to prevent infinite loops
  const hasDetectedDuplicates = React.useRef(false);
  const hasRunAiCategorization = React.useRef(false);

  // Check for backend parsing error from upload step
  const backendError = wizardData.upload?.backendError;
  const uploadWarnings: string[] = wizardData.upload?.warnings || [];

  // Load transactions from wizard data or use mock data
  React.useEffect(() => {
    const existingTransactions = wizardData.review?.transactions;
    if (existingTransactions) {
      setTransactions(existingTransactions);
      // Reset processing flags when new transactions are loaded
      hasDetectedDuplicates.current = false;
      hasRunAiCategorization.current = false;
    } else if (wizardData.upload?.transactions) {
      setTransactions(wizardData.upload.transactions);
      // Reset processing flags when new transactions are loaded
      hasDetectedDuplicates.current = false;
      hasRunAiCategorization.current = false;
    }
  }, [wizardData.review?.transactions, wizardData.upload?.transactions]);

  // Perform duplicate detection when transactions are loaded (only once)
  React.useEffect(() => {
    const performDuplicateDetection = async () => {
      if (transactions.length === 0 || isDetectingDuplicates || hasDetectedDuplicates.current) return;

      setIsDetectingDuplicates(true);
      hasDetectedDuplicates.current = true;
      try {
        // Convert transactions to the format expected by the API
        const transactionsForDetection = transactions.map(tx => ({
          date: tx.date,
          amount: tx.amount,
          description: tx.description,
          payee: tx.payee,
        }));

        // Call the duplicate detection API
        const response = await fetch("/api/ofx/duplicate-detection", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactions: transactionsForDetection,
            accountId,
          }),
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to detect duplicates");
        }

        // Update transactions with duplicate information
        setTransactions(prev =>
          prev.map((tx, index) => {
            const duplicateResult = result.data[index];
            return {
              ...tx,
              isDuplicate: duplicateResult.isDuplicate,
              duplicateInfo: {
                matches: duplicateResult.matches,
                bestMatch: duplicateResult.bestMatch,
              },
              duplicateAction: duplicateResult.isDuplicate ? "skip" : undefined, // Default to skip for duplicates
              validationStatus: duplicateResult.isDuplicate ? "warning" as const : tx.validationStatus,
            };
          })
        );
      } catch (error) {
        console.error("Error detecting duplicates:", error);
        // Fallback to no duplicates if detection fails
        setTransactions(prev =>
          prev.map(tx => ({
            ...tx,
            isDuplicate: false,
            duplicateInfo: undefined,
          }))
        );
      } finally {
        setIsDetectingDuplicates(false);
      }
    };

    performDuplicateDetection();
  }, [transactions.length, accountId, isDetectingDuplicates]);

  // Fetch AI categorizations when transactions are loaded (only once)
  React.useEffect(() => {
    const runAiCategorization = async () => {
      if (transactions.length === 0 || hasRunAiCategorization.current) return;
      hasRunAiCategorization.current = true;
      try {
        const response = await fetch("/api/ofx/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactions: transactions.map(tx => ({ description: tx.description, amount: tx.amount, date: tx.date })),
          }),
        });
        if (!response.ok) return;
        const result = await response.json();
        if (result.success && Array.isArray(result.categorizations)) {
          // Merge suggestions into transactions
          setTransactions(prev => prev.map((tx, idx) => {
            const entry = result.categorizations.find((c: any) => c.transactionIndex === idx);
            return entry
              ? { ...tx, aiSuggestions: entry.suggestions || [] }
              : tx;
          }));
          setAiWarnings(result.warnings || []);
        }
      } catch (e) {
        // Silent fail; users can categorize manually
      }
    };
    runAiCategorization();
  }, [transactions.length]);

  // Save transactions to wizard data
  React.useEffect(() => {
    onDataChange({ transactions });
  }, [transactions, onDataChange]);

  const handleCategoryChange = React.useCallback((transactionId: string, categoryId: string) => {
    setTransactions(prev =>
      prev.map(tx =>
        tx.id === transactionId
          ? {
              ...tx,
              categoryId,
              categoryName: MOCK_CATEGORIES.find(cat => cat.id === categoryId)?.name || null,
            }
          : tx
      )
    );
  }, []);

  const handleSelectTransaction = React.useCallback((transactionId: string, selected: boolean) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(transactionId);
      } else {
        newSet.delete(transactionId);
      }
      return newSet;
    });
  }, []);

  const handleDuplicateResolution = React.useCallback((transactionId: string, action: "skip" | "import" | "update") => {
    setTransactions(prev =>
      prev.map(tx =>
        tx.id === transactionId
          ? {
              ...tx,
              duplicateAction: action,
              validationStatus: action === "skip" ? "error" as const : tx.validationStatus,
            }
          : tx
      )
    );
  }, []);

  const handleBulkDuplicateResolution = React.useCallback((action: "skip" | "import" | "update") => {
    const duplicateTransactions = transactions.filter(tx => tx.isDuplicate);
    setTransactions(prev =>
      prev.map(tx =>
        duplicateTransactions.some(dt => dt.id === tx.id)
          ? {
              ...tx,
              duplicateAction: action,
              validationStatus: action === "skip" ? "error" as const : tx.validationStatus,
            }
          : tx
      )
    );
  }, [transactions]);

  const handleSelectAll = React.useCallback((selected: boolean) => {
    if (selected) {
      setSelectedTransactions(new Set(transactions.map(tx => tx.id)));
    } else {
      setSelectedTransactions(new Set());
    }
  }, [transactions]);

  const getStatusIcon = React.useCallback((status: TransactionStatus) => {
    switch (status) {
      case "valid":
        return <RiCheckLine className="h-4 w-4 text-green-600" />;
      case "warning":
        return <RiAlertLine className="h-4 w-4 text-orange-600" />;
      case "error":
        return <RiErrorWarningLine className="h-4 w-4 text-red-600" />;
    }
  }, []);

  const getStatusBadge = React.useCallback((status: TransactionStatus, isDuplicate: boolean) => {
    if (isDuplicate) {
      return <Badge variant="destructive">Duplicata</Badge>;
    }

    switch (status) {
      case "valid":
        return <Badge variant="secondary">Válido</Badge>;
      case "warning":
        return <Badge variant="outline">Aviso</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
    }
  }, []);

  const validTransactions = transactions.filter(tx =>
    tx.validationStatus === "valid" &&
    !tx.isDuplicate ||
    (tx.isDuplicate && tx.duplicateAction === "import")
  );
  const warningTransactions = transactions.filter(tx =>
    tx.validationStatus === "warning" ||
    (tx.isDuplicate && !tx.duplicateAction)
  );
  const errorTransactions = transactions.filter(tx =>
    tx.validationStatus === "error" ||
    (tx.isDuplicate && tx.duplicateAction === "skip")
  );
  const duplicateTransactions = transactions.filter(tx => tx.isDuplicate);

  return (
    <div className="space-y-6">
      {/* Show backend error if present */}
      {backendError && (
        <div className="flex items-start gap-2 p-3 border border-destructive/50 rounded-lg bg-destructive/5 text-sm text-destructive" role="alert" aria-live="polite">
          <RiErrorWarningLine className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium">Erro ao processar arquivo OFX</p>
            <p>{backendError}</p>
          </div>
        </div>
      )}
      {!backendError && aiWarnings.length > 0 && (
        <div className="flex items-start gap-2 p-3 border border-orange-300 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-sm text-orange-700 dark:text-orange-300" role="alert" aria-live="polite">
          <RiAlertLine className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium">Avisos de categorização com IA</p>
            {aiWarnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        </div>
      )}
      {!backendError && uploadWarnings.length > 0 && (
        <div className="flex items-start gap-2 p-3 border border-orange-300 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-sm text-orange-700 dark:text-orange-300" role="alert" aria-live="polite">
          <RiAlertLine className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium">Avisos do arquivo OFX</p>
            {uploadWarnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        </div>
      )}

      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Revisão das Transações</h3>
        <p className="text-sm text-muted-foreground">
          Verifique e ajuste as transações antes da importação para a conta <strong>{accountName}</strong>.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RiCheckLine className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-600">{validTransactions.length}</div>
                <div className="text-sm text-muted-foreground">Válidas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RiAlertLine className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold text-orange-600">{warningTransactions.length}</div>
                <div className="text-sm text-muted-foreground">Avisos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RiErrorWarningLine className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-red-600">{errorTransactions.length}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RiMagicLine className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {transactions.filter(tx => tx.aiSuggestions && tx.aiSuggestions.length > 0).length}
                </div>
                <div className="text-sm text-muted-foreground">Com IA</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RiErrorWarningLine className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-red-600">{duplicateTransactions.length}</div>
                <div className="text-sm text-muted-foreground">Duplicatas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Transações Encontradas ({transactions.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" aria-label="Aplicar sugestões de categoria da IA para todas as transações">
              Aplicar IA a Todas
            </Button>
            {transactions.some(tx => tx.isDuplicate) && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Duplicatas:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkDuplicateResolution("skip")}
                  aria-label="Pular todas as transações duplicadas"
                >
                  Pular Todas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkDuplicateResolution("import")}
                  aria-label="Importar todas as transações duplicadas"
                >
                  Importar Todas
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" aria-label="Corrigir transações marcadas como duplicatas">
              Corrigir Duplicatas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table aria-label={`Tabela de transações para revisão - ${transactions.length} transações encontradas`}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedTransactions.size === transactions.length}
                      onCheckedChange={handleSelectAll}
                      aria-label={selectedTransactions.size === transactions.length ? "Desmarcar todas as transações" : "Selecionar todas as transações"}
                    />
                  </TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duplicatas</TableHead>
                  <TableHead className="w-12">IA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedTransactions.has(transaction.id)}
                        onCheckedChange={(checked) =>
                          handleSelectTransaction(transaction.id, checked as boolean)
                        }
                        aria-label={`Selecionar transação ${transaction.description}`}
                      />
                    </TableCell>
                    <TableCell>
                      <time dateTime={transaction.date} aria-label={`Data da transação: ${formatDateDisplay(transaction.date)}`}>
                        {formatDateDisplay(transaction.date)}
                      </time>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{transaction.description}</div>
                        {transaction.payee && transaction.payee !== transaction.description && (
                          <div className="text-sm text-muted-foreground">{transaction.payee}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "font-medium",
                          transaction.amount >= 0 ? "text-green-600" : "text-red-600"
                        )}
                        aria-label={`Valor: R$ ${Math.abs(transaction.amount).toFixed(2)} ${transaction.amount >= 0 ? 'crédito' : 'débito'}`}
                      >
                        R$ {Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={transaction.categoryId || ""}
                        onValueChange={(value) => handleCategoryChange(transaction.id, value)}
                      >
                        <SelectTrigger className="w-48" aria-label={`Selecionar categoria para transação ${transaction.description}`}>
                          <SelectValue placeholder="Selecionar categoria...">
                            {transaction.categoryName && (
                              <Badge variant="outline" className="mr-2">
                                {transaction.categoryName}
                              </Badge>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {transaction.aiSuggestions && transaction.aiSuggestions.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                Sugestões da IA
                              </div>
                              {transaction.aiSuggestions.map((suggestion) => (
                                <SelectItem
                                  key={suggestion.categoryId}
                                  value={suggestion.categoryId}
                                  aria-label={`Categoria sugerida: ${suggestion.categoryName} com ${Math.round(suggestion.confidence * 100)}% de confiança`}
                                >
                                  <div className="flex items-center gap-2">
                                    <RiMagicLine className="h-3 w-3 text-blue-600" aria-hidden="true" />
                                    <span>{suggestion.categoryName}</span>
                                    <Badge variant="secondary" className="ml-auto text-xs">
                                      {Math.round(suggestion.confidence * 100)}%
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                              <div className="border-t my-1" />
                            </>
                          )}
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            Todas as Categorias
                          </div>
                          {MOCK_CATEGORIES.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(transaction.validationStatus)}
                        {getStatusBadge(transaction.validationStatus, transaction.isDuplicate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {transaction.isDuplicate && transaction.duplicateInfo?.bestMatch ? (
                        <div className="space-y-2">
                          <div className="text-xs text-red-600 font-medium">
                            {Math.round(transaction.duplicateInfo.bestMatch.similarity * 100)}% similar
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {transaction.duplicateInfo.bestMatch.existingDescription}
                          </div>
                          <Select
                            value={transaction.duplicateAction || ""}
                            onValueChange={(value: "skip" | "import" | "update") =>
                              handleDuplicateResolution(transaction.id, value)
                            }
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue placeholder="Ação..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="skip">Pular</SelectItem>
                              <SelectItem value="import">Importar</SelectItem>
                              <SelectItem value="update">Atualizar</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {transaction.aiSuggestions && transaction.aiSuggestions.length > 0 && (
                        <RiMagicLine
                          className="h-4 w-4 text-blue-600"
                          aria-label={`${transaction.aiSuggestions.length} sugestão(ões) de categoria disponível(is) da IA`}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedTransactions.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedTransactions.size} transação(ões) selecionada(s)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Aplicar Categoria
                </Button>
                <Button variant="outline" size="sm">
                  Marcar como Válidas
                </Button>
                <Button variant="outline" size="sm">
                  Excluir Selecionadas
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TransactionReviewStep;