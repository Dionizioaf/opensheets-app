"use client";

import { ReviewStep } from "@/components/contas/ofx-import/review-step";
import type { CsvReviewStepProps } from "./types";

/**
 * CSV Review Step
 * 
 * Step 3: Wrapper for shared review component from OFX import
 * Reuses all existing features: inline editing, category selector,
 * duplicate warnings, bulk actions, select/deselect all
 */
export function CsvReviewStep({
    transactions,
    categorias,
    selectedCount,
    duplicateCount,
    accountName,
    accountType,
    onTransactionUpdate,
    onToggleSelection,
    onToggleAll,
    onBulkCategorySet,
    showDuplicates,
    onToggleDuplicates,
}: CsvReviewStepProps) {
    return (
        <div className="space-y-6">
            {/* Account info header */}
            <div className="space-y-2">
                <h3 className="text-lg font-medium">Revisar Transações</h3>
                <p className="text-sm text-muted-foreground">
                    Importando para: <span className="font-medium text-foreground">{accountName}</span>
                    {" "}({accountType === "bank" ? "Conta Bancária" : "Cartão de Crédito"})
                </p>
            </div>

            {/* Reuse OFX ReviewStep component */}
            <ReviewStep
                transactions={transactions}
                categorias={categorias}
                selectedCount={selectedCount}
                duplicateCount={duplicateCount}
                onTransactionUpdate={onTransactionUpdate}
                onToggleSelection={onToggleSelection}
                onToggleAll={onToggleAll}
                onBulkCategorySet={onBulkCategorySet}
                showDuplicates={showDuplicates}
                onToggleDuplicates={onToggleDuplicates}
            />
        </div>
    );
}
