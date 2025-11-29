"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RiArrowRightLine, RiCheckLine, RiEditLine } from "@remixicon/react";
import * as React from "react";

export interface FieldMappingStepProps {
  accountId: string;
  accountName: string;
  wizardData: Record<string, any>;
  onDataChange: (data: any) => void;
}

// Available OFX fields
const OFX_FIELDS = [
  { key: "date", label: "Data da Transação", description: "Data quando a transação foi realizada" },
  { key: "amount", label: "Valor", description: "Valor da transação (positivo ou negativo)" },
  { key: "description", label: "Descrição", description: "Descrição ou memo da transação" },
  { key: "payee", label: "Beneficiário", description: "Nome do beneficiário ou pagador" },
  { key: "type", label: "Tipo", description: "Tipo da transação (débito/crédito)" },
  { key: "id", label: "ID da Transação", description: "Identificador único da transação" },
] as const;

// Available application fields
const APP_FIELDS = [
  { key: "name", label: "Nome", description: "Nome/descrição da transação", required: true },
  { key: "amount", label: "Valor", description: "Valor da transação", required: true },
  { key: "purchaseDate", label: "Data da Compra", description: "Data da compra/transação", required: true },
  { key: "transactionType", label: "Tipo de Transação", description: "Receita ou Despesa", required: true },
  { key: "note", label: "Anotação", description: "Anotação adicional", required: false },
  { key: "paymentMethod", label: "Forma de Pagamento", description: "Como foi pago", required: true },
] as const;

// Default mappings
const DEFAULT_MAPPINGS: Record<string, string> = {
  date: "purchaseDate",
  amount: "amount",
  description: "name",
  payee: "name",
  type: "transactionType",
  id: "note",
};

export function FieldMappingStep({
  accountId,
  accountName,
  wizardData,
  onDataChange,
}: FieldMappingStepProps) {
  const [mappings, setMappings] = React.useState<Record<string, string>>(DEFAULT_MAPPINGS);
  const [isEditing, setIsEditing] = React.useState(false);

  // Load mappings from wizard data or use defaults
  React.useEffect(() => {
    const existingMappings = wizardData.mapping?.mappings || DEFAULT_MAPPINGS;
    setMappings(existingMappings);
  }, [wizardData.mapping]);

  // Save mappings to wizard data
  React.useEffect(() => {
    onDataChange({ mappings });
  }, [mappings, onDataChange]);

  const handleMappingChange = React.useCallback((ofxField: string, appField: string) => {
    setMappings(prev => ({
      ...prev,
      [ofxField]: appField,
    }));
  }, []);

  const getMappedFields = React.useCallback((appField: string) => {
    return Object.entries(mappings)
      .filter(([_, mappedTo]) => mappedTo === appField)
      .map(([ofxField]) => ofxField);
  }, [mappings]);

  const getOfxFieldInfo = React.useCallback((key: string) => {
    return OFX_FIELDS.find(field => field.key === key);
  }, []);

  const getAppFieldInfo = React.useCallback((key: string) => {
    return APP_FIELDS.find(field => field.key === key);
  }, []);

  const toggleEditMode = React.useCallback(() => {
    setIsEditing(prev => !prev);
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Mapeamento de Campos</h3>
        <p className="text-sm text-muted-foreground">
          Configure como os campos do arquivo OFX serão mapeados para os campos da aplicação.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Mapeamento Automático</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Campos sugeridos automaticamente baseado em padrões comuns de arquivos OFX.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleEditMode}
            className="flex items-center gap-2"
            aria-label={isEditing ? "Salvar alterações no mapeamento de campos" : "Editar mapeamento de campos"}
            aria-pressed={isEditing}
          >
            {isEditing ? <RiCheckLine className="h-4 w-4" aria-hidden="true" /> : <RiEditLine className="h-4 w-4" aria-hidden="true" />}
            {isEditing ? "Salvar" : "Editar"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mapping visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OFX Fields */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Campos do Arquivo OFX
              </h4>
              {OFX_FIELDS.map((ofxField) => {
                const mappedTo = mappings[ofxField.key];
                const appFieldInfo = mappedTo ? getAppFieldInfo(mappedTo) : null;

                return (
                  <div
                    key={ofxField.key}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                    role="group"
                    aria-labelledby={`ofx-field-${ofxField.key}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div id={`ofx-field-${ofxField.key}`} className="font-medium text-sm">{ofxField.label}</div>
                      <div className="text-xs text-muted-foreground">{ofxField.description}</div>
                    </div>
                    <RiArrowRightLine className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <Select
                          value={mappedTo && mappedTo !== "" ? mappedTo : "none"}
                          onValueChange={(value) => handleMappingChange(ofxField.key, value)}
                        >
                          <SelectTrigger
                            className="h-8"
                            aria-label={`Mapear campo ${ofxField.label} para campo da aplicação`}
                          >
                            <SelectValue placeholder="Selecionar campo..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Não mapear</SelectItem>
                            {APP_FIELDS.map((appField) => (
                              <SelectItem key={appField.key} value={appField.key}>
                                {appField.label} {appField.required ? '(Obrigatório)' : '(Opcional)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div>
                          {appFieldInfo ? (
                            <div className="font-medium text-sm">{appFieldInfo.label}</div>
                          ) : (
                            <div className="text-sm text-muted-foreground italic">Não mapeado</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Application Fields */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Campos da Aplicação
              </h4>
              {APP_FIELDS.map((appField) => {
                const mappedFrom = getMappedFields(appField.key);
                const isRequired = appField.required;

                return (
                  <div
                    key={appField.key}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    role="group"
                    aria-labelledby={`app-field-${appField.key}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div id={`app-field-${appField.key}`} className="font-medium text-sm">{appField.label}</div>
                        {isRequired && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0.5" aria-label="Campo obrigatório">
                            Obrigatório
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{appField.description}</div>
                      {mappedFrom.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1" role="list" aria-label="Campos OFX mapeados">
                          {mappedFrom.map((ofxField) => {
                            const ofxInfo = getOfxFieldInfo(ofxField);
                            return (
                              <Badge key={ofxField} variant="outline" className="text-xs" role="listitem">
                                {ofxInfo?.label}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Mapping summary */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Resumo do Mapeamento</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center" role="region" aria-labelledby="mapped-fields">
                <div id="mapped-fields" className="text-2xl font-bold text-primary">
                  {Object.values(mappings).filter(Boolean).length}
                </div>
                <div className="text-muted-foreground">Campos mapeados</div>
              </div>
              <div className="text-center" role="region" aria-labelledby="required-ok">
                <div id="required-ok" className="text-2xl font-bold text-green-600">
                  {APP_FIELDS.filter(field => field.required && getMappedFields(field.key).length > 0).length}
                </div>
                <div className="text-muted-foreground">Obrigatórios ok</div>
              </div>
              <div className="text-center" role="region" aria-labelledby="optional-mapped">
                <div id="optional-mapped" className="text-2xl font-bold text-orange-600">
                  {APP_FIELDS.filter(field => !field.required && getMappedFields(field.key).length > 0).length}
                </div>
                <div className="text-muted-foreground">Opcionais mapeados</div>
              </div>
              <div className="text-center" role="region" aria-labelledby="missing-required">
                <div id="missing-required" className="text-2xl font-bold text-red-600">
                  {APP_FIELDS.filter(field => field.required && getMappedFields(field.key).length === 0).length}
                </div>
                <div className="text-muted-foreground">Faltando obrigatórios</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FieldMappingStep;