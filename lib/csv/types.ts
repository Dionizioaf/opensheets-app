/**
 * CSV Import Types
 * 
 * Type definitions for CSV parsing and column mapping functionality.
 */

import type { ImportTransaction } from "@/components/contas/ofx-import/types";

/**
 * CSV delimiter options
 */
export type CsvDelimiter = "," | ";" | "\t";

/**
 * CSV column from header row
 */
export interface CsvColumn {
    index: number;
    name: string;
    originalName: string; // Preserved for display
}

/**
 * Raw CSV row data
 */
export type CsvRow = Record<string, string>;

/**
 * CSV parse result from papaparse
 */
export interface CsvParseResult {
    success: boolean;
    headers: CsvColumn[];
    rows: CsvRow[];
    rowCount: number;
    detectedDelimiter: CsvDelimiter;
    encoding: string;
    errors?: CsvParsingError[];
}

/**
 * Column mapping for transaction fields
 * Maps CSV column names to transaction field names
 */
export interface ColumnMapping {
    date?: string; // CSV column name for date field (required)
    amount?: string; // CSV column name for amount field (required)
    description?: string; // CSV column name for description field (optional)
}

/**
 * System field that CSV columns can be mapped to
 */
export type SystemField = "date" | "amount" | "description";

/**
 * CSV import configuration
 */
export interface CsvImportConfig {
    delimiter: CsvDelimiter | "auto";
    dateFormat?: string; // Expected date format (e.g., "DD/MM/YYYY")
    encoding?: string; // File encoding (default: UTF-8)
    skipEmptyLines?: boolean;
    trimHeaders?: boolean;
}

/**
 * CSV parsing error
 */
export interface CsvParsingError {
    type: "Quotes" | "Delimiter" | "FieldMismatch" | "UndetectableDelimiter";
    code: string;
    message: string;
    row?: number;
}

/**
 * Validation result for column mapping
 */
export interface ColumnMappingValidation {
    isValid: boolean;
    missingFields: SystemField[];
    errorMessage?: string;
}

/**
 * Extended ImportTransaction for CSV with temporary ID
 */
export interface CsvImportTransaction extends ImportTransaction {
    csvRowIndex: number; // Reference to original CSV row
    rawData: CsvRow; // Original CSV data for debugging
}
