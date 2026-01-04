"use client";

import { ConfirmStep } from "@/components/contas/ofx-import/confirm-step";
import type { CsvConfirmStepProps } from "./types";

/**
 * CSV Confirm Step
 * 
 * Step 4: Wrapper for shared confirm component from OFX import.
 * Adds CSV-specific context (account name and type) while reusing
 * all OFX confirmation functionality (summary display, progress bar,
 * transaction list, error handling).
 */
export function CsvConfirmStep({
    summary,
    transactions,
    accountName,
    accountType,
    isImporting,
    importProgress,
    error,
    onConfirm,
    onGoBack,
}: CsvConfirmStepProps) {
    return (
        <div className="space-y-6">
            {/* Account context header */}
            <div className="space-y-2">
                <h3 className="text-lg font-medium">Confirmar Importação</h3>
                <p className="text-sm text-muted-foreground">
                    Importando para: <span className="font-medium text-foreground">{accountName}</span>
                    {" "}({accountType === "bank" ? "Conta Bancária" : "Cartão de Crédito"})
                </p>
            </div>

            {/* Reuse OFX ConfirmStep component */}
            <ConfirmStep
                summary={summary}
                transactions={transactions}
                isImporting={isImporting}
                importProgress={importProgress}
                error={error}
                onConfirm={onConfirm}
                onGoBack={onGoBack}
            />
        </div>
    );
}
