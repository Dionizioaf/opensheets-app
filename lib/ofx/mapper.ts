import type {
    OfxTransaction,
    ParsedOfxTransaction,
    OfxTransactionType,
} from "./types";

/**
 * Map OFX transaction to lancamento format
 * Converts OFX transaction data to the structure expected by the lancamentos table
 * 
 * @param ofxTrn - Raw OFX transaction
 * @returns Parsed transaction ready for import
 */
export function mapOfxToLancamento(
    ofxTrn: OfxTransaction
): ParsedOfxTransaction {
    // Determine transaction type (Despesa or Receita)
    const tipo_transacao = mapOfxTypeToTransactionType(ofxTrn.type, ofxTrn.amount);

    // Convert amount to absolute decimal string
    const valor = Math.abs(ofxTrn.amount).toFixed(2);

    // Format period as YYYY-MM
    const periodo = formatPeriod(ofxTrn.datePosted);

    // Generate transaction name from available fields
    const nome = sanitizeOfxDescription(
        ofxTrn.name || ofxTrn.memo || "Transação importada"
    );

    // Create import note
    const anotacao = generateImportNote(ofxTrn);

    // Determine default payment method based on transaction type
    const forma_pagamento = mapOfxTypeToPaymentMethod(ofxTrn.type);

    return {
        // Original OFX data
        fitId: ofxTrn.fitId,
        rawData: ofxTrn,

        // Mapped lancamento fields
        nome,
        valor,
        data_compra: ofxTrn.datePosted,
        tipo_transacao,
        forma_pagamento,
        condicao: "À vista",
        periodo,
        anotacao,
        realizado: true,

        // UI metadata (defaults)
        isDuplicate: false,
        isSelected: true, // Selected by default for import
    };
}

/**
 * Map OFX transaction type to Despesa/Receita
 * Considers both the type and amount sign
 */
function mapOfxTypeToTransactionType(
    type: OfxTransactionType,
    amount: number
): "Despesa" | "Receita" {
    // Amount-based logic (more reliable)
    // Negative amounts are typically debits (Despesa)
    // Positive amounts are typically credits (Receita)
    if (amount < 0) {
        return "Despesa";
    }
    if (amount > 0) {
        return "Receita";
    }

    // Fallback to type-based mapping
    const receiptTypes: OfxTransactionType[] = [
        "CREDIT",
        "DEP",
        "DIRECTDEP",
        "INT",
        "DIV",
    ];

    return receiptTypes.includes(type) ? "Receita" : "Despesa";
}

/**
 * Map OFX transaction type to payment method
 * Returns appropriate forma_pagamento based on transaction characteristics
 */
function mapOfxTypeToPaymentMethod(
    type: OfxTransactionType
): "Cartão de débito" | "Pix" | "Dinheiro" | "Boleto" {
    switch (type) {
        case "ATM":
        case "CASH":
            return "Dinheiro";

        case "POS":
        case "DEBIT":
            return "Cartão de débito";

        case "PAYMENT":
        case "DIRECTDEBIT":
        case "XFER":
            return "Pix"; // Modern Brazilian transfers are typically Pix

        case "CHECK":
            return "Boleto"; // Map checks to boleto as closest equivalent

        default:
            return "Cartão de débito"; // Safe default for bank account transactions
    }
}

/**
 * Format date to period string (YYYY-MM)
 */
function formatPeriod(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

/**
 * Sanitize OFX description/memo field
 * Cleans up the description for display in lancamentos
 * 
 * @param description - Raw description from OFX
 * @returns Cleaned description (max 255 chars)
 */
export function sanitizeOfxDescription(description: string): string {
    if (!description) {
        return "Transação importada";
    }

    // Remove extra whitespace and normalize
    let cleaned = description
        .trim()
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .replace(/\n+/g, " ") // Replace newlines with space
        .replace(/\t+/g, " "); // Replace tabs with space

    // Remove common bank prefixes/suffixes that add noise
    cleaned = cleaned
        .replace(/^(COMPRA|PAGAMENTO|TRANSFERENCIA|SAQUE)\s+/i, "")
        .replace(/\s+(ITAU|BANCO)\s*$/i, "");

    // Truncate to max length (255 chars for nome field)
    const maxLength = 255;
    if (cleaned.length > maxLength) {
        cleaned = cleaned.substring(0, maxLength - 3) + "...";
    }

    return cleaned;
}

/**
 * Generate standardized import note
 * Creates a note field with import metadata
 * 
 * @param ofxTrn - OFX transaction
 * @returns Note text with timestamp and OFX metadata
 */
export function generateImportNote(ofxTrn: OfxTransaction): string {
    const timestamp = new Date().toISOString();
    const parts = [
        `Importado via OFX em ${new Date().toLocaleDateString("pt-BR")}`,
        `FITID: ${ofxTrn.fitId}`,
    ];

    // Add original memo if different from name
    if (ofxTrn.memo && ofxTrn.memo !== ofxTrn.name) {
        parts.push(`Descrição original: ${ofxTrn.memo}`);
    }

    // Add check number if available
    if (ofxTrn.checkNumber) {
        parts.push(`Cheque: ${ofxTrn.checkNumber}`);
    }

    // Add reference number if available
    if (ofxTrn.referenceNumber) {
        parts.push(`Ref: ${ofxTrn.referenceNumber}`);
    }

    return parts.join(" | ");
}

/**
 * Batch map multiple OFX transactions
 * Convenience function to map an array of transactions
 * 
 * @param transactions - Array of OFX transactions
 * @returns Array of parsed transactions
 */
export function mapOfxTransactionsToLancamentos(
    transactions: OfxTransaction[]
): ParsedOfxTransaction[] {
    return transactions.map((trn) => mapOfxToLancamento(trn));
}
