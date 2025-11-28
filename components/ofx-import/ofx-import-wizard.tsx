"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@remixicon/react";
import * as React from "react";

export interface OFXImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}

export type WizardStep = "upload" | "mapping" | "review" | "confirm";

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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-4">
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Importar OFX - {accountName}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {currentStep.description}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Passo {currentStepIndex + 1} de {STEPS.length}
            </div>
          </DialogTitle>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              {STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-1",
                    index <= currentStepIndex ? "text-foreground" : "text-muted-foreground"
                  )}
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
                  />
                  <span className="hidden sm:inline">{step.title}</span>
                </div>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Step Content */}
        <div className="flex-1 overflow-hidden">
          <React.Suspense fallback={<div className="p-8 text-center">Carregando...</div>}>
            <currentStep.component
              accountId={accountId}
              accountName={accountName}
              wizardData={wizardData}
              onDataChange={(data: any) => handleStepDataChange(currentStep.id, data)}
            />
          </React.Suspense>
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={!canGoPrevious}
            className="flex items-center gap-2"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Anterior
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>

            {currentStepIndex < STEPS.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={!canGoNext}
                className="flex items-center gap-2"
              >
                Próximo
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  // Handle final import
                  console.log("Final import data:", wizardData);
                  handleClose();
                }}
                className="flex items-center gap-2"
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