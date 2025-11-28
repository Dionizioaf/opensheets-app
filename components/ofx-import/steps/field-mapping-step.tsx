"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface FieldMappingStepProps {
  accountId: string;
  accountName: string;
  wizardData: Record<string, any>;
  onDataChange: (data: any) => void;
}

export function FieldMappingStep({
  accountId,
  accountName,
  wizardData,
  onDataChange,
}: FieldMappingStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Mapeamento de Campos</h3>
        <p className="text-sm text-muted-foreground">
          Configure como os campos do arquivo OFX serão mapeados para as transações.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mapeamento Automático</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Os campos serão mapeados automaticamente baseado nos padrões comuns de arquivos OFX.
            Esta etapa será implementada na próxima tarefa.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}