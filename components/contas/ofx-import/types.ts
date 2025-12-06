import type { ParsedOfxTransaction } from "@/lib/ofx/types";

/**
 * Wizard step identifiers
 * Defines the three-step import flow
 */
export type WizardStep = "upload" | "review" | "confirm";

/**
 * Step configuration for wizard navigation
 */
export interface StepConfig {
    id: WizardStep;
    title: string;
    description: string;
    order: number;
}

/**
 * UI-enhanced transaction for import review
 * Extends ParsedOfxTransaction with UI-specific state
 */
export interface ImportTransaction extends ParsedOfxTransaction {
    // UI state
    id: string; // Temporary UI ID for React keys
    isSelected: boolean; // User selection for import
    isEdited: boolean; // Whether user has manually edited fields

    // Validation state
    hasError: boolean; // Validation error flag
    errorMessage?: string; // Error message if validation fails

    // Category suggestion state (overrides from ParsedOfxTransaction)
    categoriaId?: string; // Selected category ID
    suggestedCategoriaId?: string; // AI-suggested category ID
    categoryConfidence?: "high" | "medium" | "low"; // Confidence level

    // Duplicate detection state (overrides from ParsedOfxTransaction)
    isDuplicate: boolean; // Duplicate detection flag
    duplicateOf?: string; // ID of existing lancamento
    duplicateSimilarity?: number; // Similarity score (0-100)
    duplicateDetails?: DuplicateDetails; // Additional duplicate info
}

/**
 * Duplicate transaction details
 * Information about the existing transaction that matches
 */
export interface DuplicateDetails {
    existingLancamentoId: string;
    existingTransactionName: string;
    existingTransactionDate: Date;
    existingTransactionAmount: string;
    matchReason: "fitid" | "date-amount-description" | "date-amount";
    similarityScore: number; // 0-100
}

/**
 * Import wizard form state
 * Manages the entire import flow state
 */
export interface ImportFormState {
    // Current step
    currentStep: WizardStep;

    // Upload step state
    uploadedFile: File | null;
    uploadedFileName: string | null;
    uploadedFileSize: number | null;
    isParsingFile: boolean;
    parsingError: string | null;

    // Review step state
    transactions: ImportTransaction[];
    selectedCount: number;
    duplicateCount: number;
    totalAmount: string; // Sum of selected transactions
    dateRange: { start: Date; end: Date } | null;

    // Confirm step state
    isImporting: boolean;
    importProgress: number; // 0-100
    importError: string | null;

    // Account and configuration
    contaId: string;
    defaultCategoriaId?: string;
    defaultPagadorId?: string;

    // Filter and view options
    showDuplicates: boolean; // Show/hide duplicates
    filterByCategory?: string; // Filter transactions by category
    sortBy: "date" | "amount" | "name"; // Sort order
    sortDirection: "asc" | "desc";
}

/**
 * Wizard navigation actions
 */
export interface WizardNavigation {
    canGoBack: boolean;
    canGoNext: boolean;
    currentStepIndex: number;
    totalSteps: number;
    goToStep: (step: WizardStep) => void;
    goBack: () => void;
    goNext: () => void;
    reset: () => void;
}

/**
 * Transaction editing actions
 */
export interface TransactionActions {
    updateTransaction: (id: string, updates: Partial<ImportTransaction>) => void;
    toggleSelection: (id: string) => void;
    toggleAllSelections: (selected: boolean) => void;
    removeTransaction: (id: string) => void;
    setCategory: (id: string, categoriaId: string) => void;
    bulkSetCategory: (ids: string[], categoriaId: string) => void;
    overrideDuplicate: (id: string) => void;
}

/**
 * File upload validation result
 */
export interface FileValidationResult {
    isValid: boolean;
    error?: string;
    errorCode?: "FILE_TOO_LARGE" | "INVALID_EXTENSION" | "INVALID_MIME_TYPE" | "FILE_EMPTY";
}

/**
 * Import summary for confirmation step
 */
export interface ImportSummary {
    selectedCount: number;
    totalCount: number;
    duplicatesSkipped: number;
    newTransactions: number;
    totalAmount: string;
    dateRange: { start: Date; end: Date } | null;
    categoryBreakdown: Array<{
        categoriaId: string;
        categoryName: string;
        count: number;
        amount: string;
    }>;
    typeBreakdown: {
        despesas: { count: number; amount: string };
        receitas: { count: number; amount: string };
    };
}

/**
 * Category option for dropdown selection
 */
export interface CategoryOption {
    id: string;
    nome: string;
    icone?: string;
    cor?: string;
}

/**
 * Pagador option for dropdown selection
 */
export interface PagadorOption {
    id: string;
    nome: string;
    logo?: string;
}

/**
 * Props for the main OFX import dialog
 */
export interface OfxImportDialogProps {
    contaId: string;
    categorias: CategoryOption[];
    pagadores: PagadorOption[];
    defaultCategoriaId?: string;
    defaultPagadorId?: string;
    trigger?: React.ReactNode;
    onImportComplete?: (importedCount: number) => void;
    onCancel?: () => void;
}

/**
 * Props for upload step component
 */
export interface UploadStepProps {
    onFileUpload: (file: File) => void;
    onParsed: (transactions: ImportTransaction[]) => void;
    isLoading: boolean;
    error: string | null;
}

/**
 * Props for review step component
 */
export interface ReviewStepProps {
    transactions: ImportTransaction[];
    categorias: CategoryOption[];
    selectedCount: number;
    duplicateCount: number;
    onTransactionUpdate: (id: string, updates: Partial<ImportTransaction>) => void;
    onToggleSelection: (id: string) => void;
    onToggleAll: (selected: boolean) => void;
    onBulkCategorySet: (ids: string[], categoriaId: string) => void;
    showDuplicates: boolean;
    onToggleDuplicates: (show: boolean) => void;
}

/**
 * Props for confirm step component
 */
export interface ConfirmStepProps {
    summary: ImportSummary;
    transactions: ImportTransaction[];
    isImporting: boolean;
    importProgress: number;
    error: string | null;
    onConfirm: () => void;
    onGoBack: () => void;
}

