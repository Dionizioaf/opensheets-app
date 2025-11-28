"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ConfirmationStepProps {
  accountId: string;
  accountName: string;
  wizardData: Record<string, any>;
  onDataChange: (data: any) => void;
}

export function ConfirmationStep({
  accountId,
  accountName,
  wizardData,
  onDataChange,
}: ConfirmationStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Confirmação da Importação</h3>
        <p className="text-sm text-muted-foreground">
          Revise o resumo antes de confirmar a importação.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo da Importação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            O resumo final com estatísticas e botão de confirmação será implementado na próxima tarefa.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}