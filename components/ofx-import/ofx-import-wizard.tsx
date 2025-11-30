"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
export interface WizardStepData {
  id: WizardStep;
  title: string;
  description: string;
  component: React.ComponentType<any>;
}

const STEPS: WizardStepData[] = [
  {
    id: "upload",
    title: "Upload do Arquivo",
    description: "Selecione o arquivo OFX para importar",
    component: React.lazy(() => import("./steps/file-upload-step")),
  },
  {
    id: "mapping",
    title: "Mapeamento de Campos",
    description: "Configure como os campos serão importados",
    component: React.lazy(() => import("./steps/field-mapping-step")),
  },
  {
    id: "review",
    title: "Revisão das Transações",
    description: "Verifique e ajuste as transações antes da importação",
    component: React.lazy(() => import("./steps/transaction-review-step")),
  },
  {
    id: "confirm",
    title: "Confirmação",
    description: "Confirme a importação das transações",
    component: React.lazy(() => import("./steps/confirmation-step")),
  },
];

export function OFXImportWizard({
  open,
  onOpenChange,
  accountId,
  accountName,
  userId,
}: OFXImportWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [wizardData, setWizardData] = React.useState<Record<string, any>>({});

  const currentStep = STEPS[currentStepIndex];
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleNext = React.useCallback(() => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  }, [currentStepIndex]);

  const handlePrevious = React.useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);

  const handleStepDataChange = React.useCallback((stepId: string, data: any) => {
    setWizardData(prev => ({
      ...prev,
      [stepId]: data,
    }));
  }, []);

  const handleClose = React.useCallback(() => {
    onOpenChange(false);
    // Reset wizard state when closed
    setCurrentStepIndex(0);
    setWizardData({});
  }, [onOpenChange]);

  const canGoNext = React.useMemo(() => {
    const stepData = wizardData[currentStep.id];
    // Add validation logic here based on step requirements
    return true; // For now, allow navigation
  }, [wizardData, currentStep.id]);

  const canGoPrevious = currentStepIndex > 0;

  // Memoize the onDataChange function to prevent infinite loops
  const stepDataChangeHandler = React.useCallback((data: any) => {
    handleStepDataChange(currentStep.id, data);
  }, [currentStep.id, handleStepDataChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      aria-labelledby="ofx-import-title"
      aria-describedby="ofx-import-description"
    >
      <DialogContent
        className="max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        aria-labelledby="ofx-import-title"
        aria-describedby="ofx-import-description"
      >
        <DialogHeader className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <DialogTitle id="ofx-import-title">
              {accountName ? `Importar OFX - ${accountName}` : 'Importar OFX'}
            </DialogTitle>
            <div className="text-sm text-muted-foreground" aria-live="polite">
              Passo {currentStepIndex + 1} de {STEPS.length}
            </div>
          </div>
          <DialogDescription id="ofx-import-description">
            {currentStep.description || 'Importação de arquivo OFX'}
          </DialogDescription>
          {/* Progress Bar */}
          <div className="space-y-2 mt-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso do assistente: ${Math.round(progress)}% completo`}>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              {STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-1",
                    index <= currentStepIndex ? "text-foreground" : "text-muted-foreground"
                  )}
                  aria-current={index === currentStepIndex ? "step" : undefined}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      index < currentStepIndex
                        ? "bg-primary"
                        : index === currentStepIndex
                        ? "bg-primary animate-pulse"
                        : "bg-muted"
                    )}
                    aria-hidden="true"
                  ></div>
                  <span className="hidden sm:inline">{step.title}</span>
                </div>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Step Content with vertical and horizontal scroll */}
        <div className="flex-1 overflow-y-auto overflow-x-auto max-h-[60vh]" role="main" aria-label={`Conteúdo do passo: ${currentStep.title}`}>
          <React.Suspense
            fallback={
              <div className="p-8 text-center" aria-live="polite">
                <div className="sr-only">Carregando conteúdo do passo...</div>
                <div className="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
              </div>
            }
          >
            <currentStep.component
              accountId={accountId}
              accountName={accountName}
              userId={userId}
              wizardData={wizardData}
              onDataChange={stepDataChangeHandler}
            />
          </React.Suspense>
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between pt-4 border-t" role="navigation" aria-label="Navegação do assistente">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={!canGoPrevious}
            className="flex items-center gap-2"
            aria-label={canGoPrevious ? `Voltar para o passo anterior: ${STEPS[currentStepIndex - 1]?.title}` : "Botão voltar desabilitado - você está no primeiro passo"}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Anterior
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              aria-label="Cancelar importação e fechar assistente"
            >
              Cancelar
            </Button>

            {currentStepIndex < STEPS.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={!canGoNext}
                className="flex items-center gap-2"
                aria-label={
                  canGoNext
                    ? `Avançar para o próximo passo: ${STEPS[currentStepIndex + 1]?.title}`
                    : "Botão próximo desabilitado - complete os campos obrigatórios primeiro"
                }
              >
                Próximo
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  // Handle final import
                  console.log("Final import data:", wizardData);
                  handleClose();
                }}
                className="flex items-center gap-2"
                aria-label="Confirmar e executar a importação das transações"
              >
                Importar Transações
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}