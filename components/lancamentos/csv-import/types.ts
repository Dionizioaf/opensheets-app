/**
 * CSV Import UI Types
 * 
 * Type definitions for CSV import wizard components and state management.
 * Extends OFX import types with CSV-specific functionality.
 */

import type {
    ImportTransaction,
    CategoryOption,
    PagadorOption,
    ImportSummary,
    TransactionActions,
    WizardNavigation,
} from "@/components/contas/ofx-import/types";
import type {
    CsvColumn,
    CsvRow,
    ColumnMapping,
    CsvDelimiter,
    CsvParseResult,
} from "@/lib/csv/types";

/**
 * CSV Wizard step identifiers
 * Includes column mapping step not present in OFX import
 */
export type CsvWizardStep = "upload" | "mapping" | "review" | "confirm";

/**
 * Account type for CSV import
 * User selects which type of account to import to
 */
export type AccountType = "bank" | "credit-card";

/**
 * Column option for mapping dropdowns
 * Represents a CSV column that can be mapped to a system field
 */
export interface CsvColumnOption {
    value: string; // Column name from CSV
    label: string; // Display label (cleaned column name)
    index: number; // Column position in CSV
}

/**
 * Account option for account selection dropdown
 */
export interface AccountOption {
    id: string;
    nome: string;
    tipo: AccountType;
    icone?: string;
    saldo?: string;
}

/**
 * CSV Import wizard form state
 * Manages the entire CSV import flow state across all steps
 */
export interface CsvImportFormState {
    // Current step
    currentStep: CsvWizardStep;

    // Upload step state
    uploadedFile: File | null;
    uploadedFileName: string | null;
    uploadedFileSize: number | null;
    accountType: AccountType | null; // Bank account or credit card
    selectedAccountId: string | null; // Selected account ID
    selectedDelimiter: CsvDelimiter | "auto"; // User-selected or auto-detected delimiter
    isParsingFile: boolean;
    parsingError: string | null;
    parseResult: CsvParseResult | null;

    // Mapping step state
    columnMapping: ColumnMapping;
    availableColumns: CsvColumnOption[];
    previewRows: CsvRow[]; // First 5 rows for preview
    mappingError: string | null;
    isAutoDetecting: boolean; // Loading state for auto-detect

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
    importedCount?: number;

    // Filter and view options
    showDuplicates: boolean; // Show/hide duplicates
    filterByCategory?: string; // Filter transactions by category
    sortBy: "date" | "amount" | "name"; // Sort order
    sortDirection: "asc" | "desc";
}

/**
 * Props for the main CSV import dialog
 */
export interface CsvImportDialogProps {
    // Data options
    categorias: CategoryOption[];
    pagadores: PagadorOption[];
    contas: AccountOption[]; // Bank accounts
    cartoes: AccountOption[]; // Credit cards

    // Optional defaults
    defaultCategoriaId?: string;
    defaultPagadorId?: string;
    defaultAccountType?: AccountType;

    // Trigger and callbacks
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onImportComplete?: (importedCount: number) => void;
    onCancel?: () => void;
    onImportStateChange?: (isImporting: boolean) => void;
}

/**
 * Props for CSV upload step component
 */
export interface CsvUploadStepProps {
    // State
    uploadedFile: File | null;
    accountType: AccountType | null;
    selectedAccountId: string | null;
    selectedDelimiter: CsvDelimiter | "auto";
    isLoading: boolean;
    error: string | null;

    // Data
    bankAccounts: AccountOption[];
    creditCards: AccountOption[];

    // Actions
    onFileSelect: (file: File) => void;
    onAccountTypeChange: (type: AccountType) => void;
    onAccountSelect: (accountId: string) => void;
    onDelimiterChange: (delimiter: CsvDelimiter | "auto") => void;
    onParseComplete: (result: CsvParseResult) => void;
    onError: (error: string) => void;
}

/**
 * Props for CSV column mapping step component
 */
export interface CsvColumnMappingStepProps {
    // State
    columnMapping: ColumnMapping;
    availableColumns: CsvColumnOption[];
    previewRows: CsvRow[];
    totalRows: number;
    isAutoDetecting: boolean;
    error: string | null;

    // Actions
    onMappingChange: (mapping: ColumnMapping) => void;
    onAutoDetect: () => void;
    onValidate: () => boolean;
}

/**
 * Props for CSV review step component
 * Extends OFX review with CSV-specific data
 */
export interface CsvReviewStepProps {
    transactions: ImportTransaction[];
    categorias: CategoryOption[];
    selectedCount: number;
    duplicateCount: number;
    accountName: string; // Display name of selected account
    accountType: AccountType;
    onTransactionUpdate: (id: string, updates: Partial<ImportTransaction>) => void;
    onToggleSelection: (id: string) => void;
    onToggleAll: (selected: boolean) => void;
    onBulkCategorySet: (ids: string[], categoriaId: string) => void;
    showDuplicates: boolean;
    onToggleDuplicates: (show: boolean) => void;
}

/**
 * Props for CSV confirm step component
 * Reuses OFX confirm with CSV context
 */
export interface CsvConfirmStepProps {
    summary: ImportSummary;
    accountName: string; // Display name of selected account
    accountType: AccountType;
    isImporting: boolean;
    importProgress: number;
    error: string | null;
    onConfirm: () => void;
    onGoBack: () => void;
}

/**
 * CSV wizard navigation extended with mapping step
 */
export interface CsvWizardNavigation extends Omit<WizardNavigation, "currentStepIndex" | "goToStep"> {
    currentStepIndex: number; // 0-3 (upload, mapping, review, confirm)
    goToStep: (step: CsvWizardStep) => void;
}

/**
 * File validation configuration
 */
export interface CsvFileValidationConfig {
    maxSizeBytes: number; // Default: 5MB
    allowedExtensions: string[]; // Default: ['.csv']
    allowedMimeTypes: string[]; // Default: ['text/csv', 'application/csv']
}

/**
 * File validation result
 */
export interface CsvFileValidationResult {
    isValid: boolean;
    error?: string;
    errorCode?: "FILE_TOO_LARGE" | "INVALID_EXTENSION" | "INVALID_MIME_TYPE" | "FILE_EMPTY";
    file?: {
        name: string;
        size: number;
        sizeFormatted: string; // e.g., "2.5 MB"
    };
}

/**
 * Auto-detect mapping result
 * Result of attempting to automatically map CSV columns to system fields
 */
export interface AutoDetectResult {
    mapping: ColumnMapping;
    confidence: "high" | "medium" | "low";
    suggestions: Array<{
        field: keyof ColumnMapping;
        columnName: string;
        confidence: number; // 0-100
        reason: string; // Why this column was suggested
    }>;
}
