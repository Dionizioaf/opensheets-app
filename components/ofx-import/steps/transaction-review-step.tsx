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
import { RiAlertLine, RiCheckLine, RiErrorWarningLine, RiMagicLine } from "@remixicon/react";
import * as React from "react";

// Helper function to format date as dd/MM/yyyy
const formatDateDisplay = (dateString: string): string => {
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
};

export interface TransactionReviewStepProps {
  accountId: string;
  accountName: string;
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

interface TransactionItem {
  id: string;
  date: string;
  amount: number;
  description: string;
  payee?: string;
  type: "debit" | "credit";
  categoryId: string | null;
  categoryName: string | null;
  isDuplicate: boolean;
  validationStatus: TransactionStatus;
  aiSuggestions: Array<{
    categoryId: string;
    categoryName: string;
    confidence: number;
  }>;
}

export function TransactionReviewStep({
  accountId,
  accountName,
  wizardData,
  onDataChange,
}: TransactionReviewStepProps) {
  const [transactions, setTransactions] = React.useState<TransactionItem[]>(MOCK_TRANSACTIONS);
  const [selectedTransactions, setSelectedTransactions] = React.useState<Set<string>>(new Set());

  // Load transactions from wizard data or use mock data
  React.useEffect(() => {
    const existingTransactions = wizardData.review?.transactions;
    if (existingTransactions) {
      setTransactions(existingTransactions);
    }
  }, [wizardData.review]);

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

  const validTransactions = transactions.filter(tx => tx.validationStatus === "valid" && !tx.isDuplicate);
  const warningTransactions = transactions.filter(tx => tx.validationStatus === "warning" || tx.isDuplicate);
  const errorTransactions = transactions.filter(tx => tx.validationStatus === "error");

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Revisão das Transações</h3>
        <p className="text-sm text-muted-foreground">
          Verifique e ajuste as transações antes da importação para a conta <strong>{accountName}</strong>.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  {transactions.filter(tx => tx.aiSuggestions.length > 0).length}
                </div>
                <div className="text-sm text-muted-foreground">Com IA</div>
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
            <Button variant="outline" size="sm">
              Aplicar IA a Todas
            </Button>
            <Button variant="outline" size="sm">
              Corrigir Duplicatas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedTransactions.size === transactions.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
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
                    />
                  </TableCell>
                  <TableCell>
                    {formatDateDisplay(transaction.date)}
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
                    >
                      R$ {Math.abs(transaction.amount).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={transaction.categoryId || ""}
                      onValueChange={(value) => handleCategoryChange(transaction.id, value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Selecionar categoria...">
                          {transaction.categoryName && (
                            <Badge variant="outline" className="mr-2">
                              {transaction.categoryName}
                            </Badge>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {transaction.aiSuggestions.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                              Sugestões da IA
                            </div>
                            {transaction.aiSuggestions.map((suggestion) => (
                              <SelectItem key={suggestion.categoryId} value={suggestion.categoryId}>
                                <div className="flex items-center gap-2">
                                  <RiMagicLine className="h-3 w-3 text-blue-600" />
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
                    {transaction.aiSuggestions.length > 0 && (
                      <RiMagicLine className="h-4 w-4 text-blue-600" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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