"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RiErrorWarningLine, RiAlertLine, RiInformationLine, RiArrowDownSLine } from "@remixicon/react";
import * as React from "react";
import { ErrorCode, getErrorMessage } from "@/lib/ofx-parser/error-messages";

export interface ErrorGuidanceAlertProps {
  errorCode?: ErrorCode;
  errorMessage?: string;
  className?: string;
  onRetry?: () => void;
}

/**
 * Display comprehensive error with user guidance
 * Can show structured errors from ErrorCode or custom error messages
 */
export function ErrorGuidanceAlert({
  errorCode,
  errorMessage,
  className,
  onRetry,
}: ErrorGuidanceAlertProps) {
  const [isGuidanceOpen, setIsGuidanceOpen] = React.useState(false);

  // Get structured error if errorCode is provided
  const structuredError = errorCode ? getErrorMessage(errorCode) : null;

  // Determine which error to display
  const displayError = structuredError || {
    title: "Erro",
    description: errorMessage || "Ocorreu um erro inesperado.",
    guidance: [
      "Tente novamente em alguns instantes",
      "Verifique sua conexão com a internet",
      "Entre em contato com o suporte se o problema persistir"
    ],
    severity: "error" as const,
    recoverable: true,
  };

  // Icon based on severity
  const Icon = React.useMemo(() => {
    switch (displayError.severity) {
      case "error":
        return RiErrorWarningLine;
      case "warning":
        return RiAlertLine;
      case "info":
        return RiInformationLine;
      default:
        return RiAlertLine;
    }
  }, [displayError.severity]);

  // Variant based on severity
  const variant = React.useMemo(() => {
    switch (displayError.severity) {
      case "error":
        return "destructive";
      case "warning":
        return "default";
      case "info":
        return "default";
      default:
        return "default";
    }
  }, [displayError.severity]);

  return (
    <Alert variant={variant} className={className}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        {displayError.title}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">{displayError.description}</p>
        
        {displayError.guidance && displayError.guidance.length > 0 && (
          <Collapsible open={isGuidanceOpen} onOpenChange={setIsGuidanceOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-sm font-medium hover:bg-transparent"
              >
                <span className="flex items-center gap-1">
                  Como resolver?
                  <RiArrowDownSLine
                    className={`h-4 w-4 transition-transform ${
                      isGuidanceOpen ? "rotate-180" : ""
                    }`}
                  />
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {displayError.guidance.map((guide, index) => (
                  <li key={index}>{guide}</li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}

        {onRetry && displayError.recoverable && (
          <div className="flex justify-end">
            <Button
              onClick={onRetry}
              size="sm"
              variant={displayError.severity === "error" ? "default" : "outline"}
            >
              Tentar novamente
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
