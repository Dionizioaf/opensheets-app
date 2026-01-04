/**
 * CSV Mapper
 * 
 * Functions for mapping CSV columns to transaction fields and data transformation.
 */

import type { ImportTransaction } from "@/components/contas/ofx-import/types";
import type {
    CsvRow,
    ColumnMapping,
    ColumnMappingValidation,
    CsvImportTransaction,
    SystemField,
} from "./types";
import { randomUUID } from "crypto";

/**
 * Parse Brazilian currency format to decimal string
 * Handles formats: "R$ 1.234,56", "1.234,56", "1234,56", "1234.56"
 * 
 * @param value - Currency string to parse
 * @returns Decimal string (e.g., "1234.56") or null if invalid
 */
export function parseBrazilianCurrency(value: string): string | null {
    if (!value || typeof value !== "string") {
        return null;
    }

    // Remove whitespace and R$ prefix
    let cleaned = value.trim().replace(/^R\$\s*/, "");

    // Remove any remaining whitespace
    cleaned = cleaned.replace(/\s/g, "");

    // Handle negative values (can be "-123,45" or "(123,45)")
    const isNegative = cleaned.startsWith("-") || (cleaned.startsWith("(") && cleaned.endsWith(")"));
    cleaned = cleaned.replace(/^-/, "").replace(/^\(/, "").replace(/\)$/, "");

    // Determine decimal separator based on format
    // Brazilian format: 1.234,56 (period for thousands, comma for decimal)
    // International format: 1,234.56 (comma for thousands, period for decimal)
    
    const lastComma = cleaned.lastIndexOf(",");
    const lastPeriod = cleaned.lastIndexOf(".");
    
    let decimalValue: string;
    
    if (lastComma > lastPeriod) {
        // Brazilian format: 1.234,56 or just 1234,56
        // Remove thousand separators (periods) and convert decimal comma to period
        decimalValue = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (lastPeriod > lastComma) {
        // International format: 1,234.56 or just 1234.56
        // Remove thousand separators (commas)
        decimalValue = cleaned.replace(/,/g, "");
    } else {
        // No decimal separator, just remove any remaining separators
        decimalValue = cleaned.replace(/[.,]/g, "");
    }

    // Validate numeric value
    const numericValue = parseFloat(decimalValue);
    if (isNaN(numericValue)) {
        return null;
    }

    // Apply negative sign if needed
    const finalValue = isNegative ? -Math.abs(numericValue) : numericValue;

    // Return as decimal string with 2 decimal places
    return finalValue.toFixed(2);
}

/**
 * Parse Brazilian date format to Date object
 * Supports: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD
 * 
 * @param value - Date string to parse
 * @returns Date object or null if invalid
 */
export function parseBrazilianDate(value: string): Date | null {
    if (!value || typeof value !== "string") {
        return null;
    }

    const cleaned = value.trim();

    // Try DD/MM/YYYY or DD-MM-YYYY format (Brazilian standard)
    const ddmmyyyyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10);
        const year = parseInt(ddmmyyyyMatch[3], 10);
        
        const date = new Date(year, month - 1, day);
        
        // Validate date
        if (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        ) {
            return date;
        }
    }

    // Try YYYY-MM-DD or YYYY/MM/DD format (ISO standard)
    const yyyymmddMatch = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (yyyymmddMatch) {
        const year = parseInt(yyyymmddMatch[1], 10);
        const month = parseInt(yyyymmddMatch[2], 10);
        const day = parseInt(yyyymmddMatch[3], 10);
        
        const date = new Date(year, month - 1, day);
        
        // Validate date
        if (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        ) {
            return date;
        }
    }

    return null;
}

/**
 * Validate column mapping
 * Ensures required fields (Date, Amount) are mapped
 * 
 * @param mapping - Column mapping to validate
 * @returns Validation result with error message if invalid
 */
export function validateColumnMapping(mapping: ColumnMapping): ColumnMappingValidation {
    const missingFields: SystemField[] = [];

    if (!mapping.date) {
        missingFields.push("date");
    }

    if (!mapping.amount) {
        missingFields.push("amount");
    }

    const isValid = missingFields.length === 0;

    return {
        isValid,
        missingFields,
        errorMessage: isValid
            ? undefined
            : `Campos obrigatórios não mapeados: ${missingFields
                  .map((field) => {
                      switch (field) {
                          case "date":
                              return "Data";
                          case "amount":
                              return "Valor";
                          default:
                              return field;
                      }
                  })
                  .join(", ")}`,
    };
}

/**
 * Map CSV row to ImportTransaction format
 * Converts CSV data to transaction object based on user column mapping
 * 
 * @param row - CSV row data
 * @param mapping - Column mapping configuration
 * @param rowIndex - Row index for reference
 * @returns ImportTransaction or null if mapping fails
 */
export function mapCsvRowToTransaction(
    row: CsvRow,
    mapping: ColumnMapping,
    rowIndex: number
): CsvImportTransaction | null {
    // Validate mapping first
    const validation = validateColumnMapping(mapping);
    if (!validation.isValid) {
        return null;
    }

    // Extract and parse date
    const dateValue = mapping.date ? row[mapping.date] : null;
    const purchaseDate = dateValue ? parseBrazilianDate(dateValue) : null;

    if (!purchaseDate) {
        return null; // Invalid date
    }

    // Extract and parse amount
    const amountValue = mapping.amount ? row[mapping.amount] : null;
    const amount = amountValue ? parseBrazilianCurrency(amountValue) : null;

    if (!amount) {
        return null; // Invalid amount
    }

    // Extract description (optional)
    const description = mapping.description ? row[mapping.description]?.trim() : "";

    // Determine transaction type based on amount sign
    const amountNum = parseFloat(amount);
    const transactionType = amountNum < 0 ? "Despesa" : "Receita";

    // Use absolute value for amount
    const absoluteAmount = Math.abs(amountNum).toFixed(2);

    // Generate period from date (YYYY-MM)
    const year = purchaseDate.getFullYear();
    const month = String(purchaseDate.getMonth() + 1).padStart(2, "0");
    const period = `${year}-${month}`;

    // Create ImportTransaction object
    const transaction: CsvImportTransaction = {
        id: randomUUID(), // Temporary ID for UI
        csvRowIndex: rowIndex,
        rawData: row,
        
        // Transaction fields
        name: description || "Transação importada",
        amount: absoluteAmount,
        purchaseDate,
        period,
        transactionType,
        paymentMethod: "Débito", // Default, will be set based on account type
        condition: "à vista",
        
        // Optional fields (set later in review step)
        categoriaId: undefined,
        pagadorId: undefined,
        
        // Import metadata
        isSettled: true, // CSV imports are already settled
        contaId: undefined, // Set during import based on selected account
        cartaoId: undefined,
        
        // UI state
        isSelected: true, // Selected by default
        isEdited: false,
        hasError: false,
        isDuplicate: false,
        
        // Fields required by ImportTransaction but not used for CSV
        userId: "", // Will be set during import
        installmentCount: null,
        currentInstallment: null,
        recurrenceCount: null,
        dueDate: null,
        boletoPaymentDate: null,
        isDivided: false,
        isAnticipated: false,
        anticipationId: null,
        seriesId: null,
        transferId: null,
        note: null,
    };

    return transaction;
}
