/**
 * OFX Transaction Types from OFX specification
 * Maps to TRNTYPE in OFX files
 */
export type OfxTransactionType =
    | "CREDIT" // Generic credit
    | "DEBIT" // Generic debit
    | "INT" // Interest earned or paid
    | "DIV" // Dividend
    | "FEE" // FI fee
    | "SRVCHG" // Service charge
    | "DEP" // Deposit
    | "ATM" // ATM debit or credit
    | "POS" // Point of sale debit or credit
    | "XFER" // Transfer
    | "CHECK" // Check
    | "PAYMENT" // Electronic payment
    | "CASH" // Cash withdrawal
    | "DIRECTDEP" // Direct deposit
    | "DIRECTDEBIT" // Merchant initiated debit
    | "REPEATPMT" // Repeating payment/standing order
    | "OTHER"; // Other

/**
 * Bank account information from OFX file
 * Corresponds to BANKACCTFROM section
 */
export interface OfxBankAccount {
    bankId: string; // Bank routing number (BANKID)
    branchId?: string; // Transit ID / branch number (BRANCHID) - optional
    accountId: string; // Account number (ACCTID)
    accountType: "CHECKING" | "SAVINGS" | "MONEYMRKT" | "CREDITLINE" | "CD"; // ACCTTYPE
}

/**
 * Raw OFX transaction data structure
 * Parsed from STMTTRN elements in OFX files
 */
export interface OfxTransaction {
    type: OfxTransactionType; // TRNTYPE
    datePosted: Date; // DTPOSTED - transaction posting date
    dateUser?: Date; // DTUSER - optional user-initiated date
    amount: number; // TRNAMT - transaction amount (negative for debits, positive for credits)
    fitId: string; // FITID - unique transaction ID from financial institution
    correctFitId?: string; // CORRECTFITID - optional correction reference
    correctAction?: "REPLACE" | "DELETE"; // CORRECTACTION - optional correction type
    checkNumber?: string; // CHECKNUM - optional check number
    referenceNumber?: string; // REFNUM - optional reference number
    sic?: string; // SIC - optional standard industrial code
    payeeId?: string; // PAYEEID - optional payee identifier
    name?: string; // NAME - optional payee name
    memo?: string; // MEMO - optional transaction description
    currency?: string; // CURRENCY - optional currency code (default USD)
}

/**
 * Complete OFX statement data
 * Contains account info and all transactions
 */
export interface OfxStatement {
    account: OfxBankAccount; // Bank account information
    transactions: OfxTransaction[]; // Array of transactions
    currency: string; // Statement currency (default "BRL" for Brazilian banks)
    startDate: Date; // Statement start date (DTSTART)
    endDate: Date; // Statement end date (DTEND)
}

/**
 * Parsed transaction ready for import
 * This is the intermediate format after OFX parsing but before DB insertion
 */
export interface ParsedOfxTransaction {
    // Original OFX data
    fitId: string; // Unique ID from bank
    rawData: OfxTransaction; // Complete original transaction

    // Mapped fields for lancamento
    nome: string; // Transaction name (from NAME or MEMO)
    valor: string; // Amount as decimal string (e.g., "123.45")
    data_compra: Date; // Transaction date
    tipo_transacao: "Despesa" | "Receita"; // Mapped from OFX type
    forma_pagamento: "Cartão de débito" | "Pix" | "Dinheiro" | "Boleto"; // Default payment method
    condicao: "À vista"; // Always "À vista" for OFX imports
    periodo: string; // Format "YYYY-MM"
    anotacao?: string; // Import metadata + original MEMO
    realizado: true; // Always true for bank imports

    // UI metadata (not persisted to DB)
    categoriaId?: string; // Suggested or selected category
    suggestedCategoryId?: string; // Auto-suggested category
    categoryConfidence?: "high" | "medium" | "low"; // Confidence level
    isDuplicate: boolean; // Duplicate detection flag
    duplicateOf?: string; // Reference to existing lancamento ID
    duplicateSimilarity?: number; // Similarity score (0-100)
    isSelected: boolean; // UI selection state for import
}

/**
 * OFX import configuration
 * Settings for the import process
 */
export interface OfxImportConfig {
    contaId: string; // Target bank account ID
    userId: string; // Current user ID

    // Default values for imported transactions
    defaultCategoriaId?: string; // Fallback category if no suggestion
    defaultPagadorId?: string; // Fallback payer

    // Import behavior
    skipDuplicates: boolean; // Skip detected duplicates
    autoApplyCategories: boolean; // Auto-apply suggested categories

    // Date handling
    timezone?: string; // Timezone for date parsing (default "America/Sao_Paulo")
}

/**
 * Import result summary
 * Returned after successful import
 */
export interface OfxImportResult {
    success: boolean;
    importedCount: number; // Number of transactions imported
    skippedCount: number; // Number of duplicates skipped
    failedCount: number; // Number of failed transactions
    errors?: string[]; // Error messages if any
    importedIds?: string[]; // IDs of created lancamentos
}

/**
 * OFX parsing error
 * Custom error type for OFX-related failures
 */
export interface OfxParsingError {
    code: "INVALID_FILE" | "PARSE_ERROR" | "UNSUPPORTED_VERSION" | "NO_TRANSACTIONS";
    message: string;
    details?: unknown;
}

