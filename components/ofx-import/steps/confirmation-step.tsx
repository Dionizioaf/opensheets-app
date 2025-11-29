"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/ui";
import { formatDateDisplay } from "./transaction-review-step";
import { RiAlertLine, RiCheckLine, RiErrorWarningLine, RiFileTextLine, RiBankLine, RiCalendarLine, RiMoneyDollarCircleLine } from "@remixicon/react";
import * as React from "react";

export interface ConfirmationStepProps {
  accountId: string;
  accountName: string;
  wizardData: Record<string, any>;
  onDataChange: (data: any) => void;
}

interface TransactionSummary {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  duplicates: number;
  withCategories: number;
  aiSuggestions: number;
}

interface CategorySummary {
  [categoryName: string]: {
    count: number;
    totalAmount: number;
  };
}

export function ConfirmationStep({
  accountId,
  accountName,
  wizardData,
  onDataChange,
}: ConfirmationStepProps) {
  // Calculate summary statistics from wizard data
  const summary = React.useMemo((): TransactionSummary => {
    const transactions = wizardData.review?.transactions || [];
    const valid = transactions.filter((tx: any) => tx.validationStatus === "valid" && !tx.isDuplicate).length;
    const warnings = transactions.filter((tx: any) => tx.validationStatus === "warning" || tx.isDuplicate).length;
    const errors = transactions.filter((tx: any) => tx.validationStatus === "error").length;
    const duplicates = transactions.filter((tx: any) => tx.isDuplicate).length;
    const withCategories = transactions.filter((tx: any) => tx.categoryId).length;
    const aiSuggestions = transactions.filter((tx: any) => tx.aiSuggestions?.length > 0).length;

    return {
      total: transactions.length,
      valid,
      warnings,
      errors,
      duplicates,
      withCategories,
      aiSuggestions,
    };
  }, [wizardData.review]);

  // Calculate category distribution
  const categorySummary = React.useMemo((): CategorySummary => {
    const transactions = wizardData.review?.transactions || [];
    const summary: CategorySummary = {};

    transactions.forEach((tx: any) => {
      if (tx.categoryName) {
        if (!summary[tx.categoryName]) {
          summary[tx.categoryName] = { count: 0, totalAmount: 0 };
        }
        summary[tx.categoryName].count += 1;
        summary[tx.categoryName].totalAmount += tx.amount;
      }
    });

    return summary;
  }, [wizardData.review]);

  // Calculate total amounts
  const totalAmounts = React.useMemo(() => {
    const transactions = wizardData.review?.transactions || [];
    const credits = transactions
      .filter((tx: any) => tx.type === "credit")
      .reduce((sum: number, tx: any) => sum + tx.amount, 0);
    const debits = transactions
      .filter((tx: any) => tx.type === "debit")
      .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);

    return { credits, debits, net: credits - debits };
  }, [wizardData.review]);

  const fileInfo = wizardData.upload?.file;
  const mappings = wizardData.mapping?.mappings || {};

  const hasIssues = summary.warnings > 0 || summary.errors > 0;
  const canImport = summary.valid > 0 && summary.withCategories === summary.total;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Confirmação da Importação</h3>
        <p className="text-sm text-muted-foreground">
          Revise o resumo final antes de importar as transações para <strong>{accountName}</strong>.
        </p>
      </div>

      {/* Import Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RiFileTextLine className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RiCheckLine className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-600">{summary.valid}</div>
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
                <div className="text-2xl font-bold text-orange-600">{summary.warnings}</div>
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
                <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* File and Account Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiBankLine className="h-5 w-5" />
              Conta de Destino
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Nome:</span>
              <span className="font-medium">{accountName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">ID:</span>
              <span className="font-mono text-sm">{accountId}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiFileTextLine className="h-5 w-5" />
              Arquivo OFX
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Nome:</span>
              <span className="font-medium truncate">{fileInfo?.name || "Não informado"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tamanho:</span>
              <span className="font-medium">
                {fileInfo?.size ? `${(fileInfo.size / 1024).toFixed(1)} KB` : "Não informado"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Última modificação:</span>
              <span className="font-medium">
                {fileInfo?.lastModified ? formatDateDisplay(new Date(fileInfo.lastModified).toISOString().split('T')[0]) : "Não informado"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RiMoneyDollarCircleLine className="h-5 w-5" />
            Resumo Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                R$ {totalAmounts.credits.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Receitas</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <div className="text-lg font-bold text-red-600 dark:text-red-400">
                R$ {totalAmounts.debits.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Despesas</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                R$ {totalAmounts.net.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Saldo Líquido</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Distribution */}
      {Object.keys(categorySummary).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(categorySummary)
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([categoryName, data]) => (
                  <div key={categoryName} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{data.count}</Badge>
                      <span className="font-medium">{categoryName}</span>
                    </div>
                    <span className={cn(
                      "font-medium",
                      data.totalAmount >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      R$ {Math.abs(data.totalAmount).toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Issues and Warnings */}
      {hasIssues && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <RiAlertLine className="h-5 w-5" />
              Avisos e Problemas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.duplicates > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <RiAlertLine className="h-4 w-4 text-orange-600" />
                <span>{summary.duplicates} transação(ões) marcada(s) como duplicata(s)</span>
              </div>
            )}
            {summary.errors > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <RiErrorWarningLine className="h-4 w-4 text-red-600" />
                <span>{summary.errors} transação(ões) com erro(s) de validação</span>
              </div>
            )}
            {summary.withCategories < summary.total && (
              <div className="flex items-center gap-2 text-sm">
                <RiAlertLine className="h-4 w-4 text-orange-600" />
                <span>{summary.total - summary.withCategories} transação(ões) sem categoria definida</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {canImport ? (
                  <RiCheckLine className="h-5 w-5 text-green-600" />
                ) : (
                  <RiAlertLine className="h-5 w-5 text-orange-600" />
                )}
                <span className="font-medium">
                  {canImport ? "Pronto para importar" : "Revisar antes de importar"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {canImport
                  ? `${summary.valid} transação(ões) válida(s) será(ão) importada(s)`
                  : "Corrija os problemas identificados antes de prosseguir"
                }
              </p>
            </div>
            <div className="text-right space-y-1">
              <div className="text-sm text-muted-foreground">Transações processadas</div>
              <div className="text-lg font-bold">{summary.total}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final Actions */}
      <div className="flex items-center justify-center gap-4 pt-4">
        <Button variant="outline" size="lg">
          Revisar Novamente
        </Button>
        <Button
          size="lg"
          disabled={!canImport}
          className="min-w-48"
        >
          Confirmar Importação
        </Button>
      </div>
    </div>
  );
}