"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TransactionReviewStepProps {
  accountId: string;
  accountName: string;
  wizardData: Record<string, any>;
  onDataChange: (data: any) => void;
}

export function TransactionReviewStep({
  accountId,
  accountName,
  wizardData,
  onDataChange,
}: TransactionReviewStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Revisão das Transações</h3>
        <p className="text-sm text-muted-foreground">
          Verifique e ajuste as transações antes da importação.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transações Encontradas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A tabela de transações editável será implementada na próxima tarefa.
            Aqui você poderá revisar categorias, detectar duplicatas e fazer ajustes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}