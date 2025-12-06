import { parse as parseOfx } from "node-ofx-parser";
import type {
    OfxStatement,
    OfxTransaction,
    OfxBankAccount,
    OfxParsingError,
    OfxTransactionType,
} from "./types";

/**
 * Parse OFX file content and extract statement data
 * Supports both OFX 1.x (SGML) and OFX 2.x (XML) formats
 * 
 * @param fileContent - Raw OFX file content as string
 * @returns Parsed OFX statement with transactions
 * @throws OfxParsingError if parsing fails
 */
export async function parseOfxFile(
    fileContent: string
): Promise<OfxStatement> {
    try {
        // Validate input
        if (!fileContent || typeof fileContent !== "string") {
            throw createParsingError(
                "INVALID_FILE",
                "Conteúdo do arquivo OFX inválido ou vazio"
            );
        }

        // Check if file looks like OFX format
        if (!fileContent.includes("OFX") && !fileContent.includes("ofx")) {
            throw createParsingError(
                "INVALID_FILE",
                "Arquivo não parece ser um formato OFX válido"
            );
        }

        // Parse the OFX content (synchronous in node-ofx-parser)
        const parsedData = parseOfx(fileContent);

        // Validate parsed structure
        if (!parsedData || typeof parsedData !== "object") {
            throw createParsingError(
                "PARSE_ERROR",
                "Falha ao interpretar o arquivo OFX"
            );
        }

        // Extract OFX data (node-ofx-parser returns nested structure)
        const ofxData = parsedData.OFX || parsedData;

        // Extract bank statement transaction list
        const bankMsgsRs = ofxData.BANKMSGSRSV1 || ofxData.CREDITCARDMSGSRSV1;
        if (!bankMsgsRs) {
            throw createParsingError(
                "PARSE_ERROR",
                "Não foi possível encontrar dados de transações bancárias no arquivo"
            );
        }

        const stmtTrnRs = bankMsgsRs.STMTTRNRS || bankMsgsRs.CCSTMTTRNRS;
        if (!stmtTrnRs) {
            throw createParsingError(
                "PARSE_ERROR",
                "Estrutura de extrato bancário não encontrada"
            );
        }

        const stmtRs = stmtTrnRs.STMTRS || stmtTrnRs.CCSTMTRS;
        if (!stmtRs) {
            throw createParsingError(
                "PARSE_ERROR",
                "Dados do extrato não encontrados"
            );
        }

        // Extract account information
        const bankAcctFrom = stmtRs.BANKACCTFROM || stmtRs.CCACCTFROM;
        if (!bankAcctFrom) {
            throw createParsingError(
                "PARSE_ERROR",
                "Informações da conta bancária não encontradas"
            );
        }

        const account: OfxBankAccount = {
            bankId: bankAcctFrom.BANKID || "",
            branchId: bankAcctFrom.BRANCHID,
            accountId: bankAcctFrom.ACCTID || "",
            accountType: bankAcctFrom.ACCTTYPE || "CHECKING",
        };

        // Extract transactions
        const banktranlist = stmtRs.BANKTRANLIST;
        if (!banktranlist) {
            throw createParsingError(
                "NO_TRANSACTIONS",
                "Nenhuma transação encontrada no arquivo OFX"
            );
        }

        interface RawTransaction {
            [key: string]: unknown;
        }

        // Handle STMTTRN - can be undefined (no transactions), single object, or array
        let stmtTrnArray: RawTransaction[] = [];
        if (banktranlist.STMTTRN) {
            stmtTrnArray = Array.isArray(banktranlist.STMTTRN)
                ? banktranlist.STMTTRN as RawTransaction[]
                : [banktranlist.STMTTRN as RawTransaction];
        }

        // Map transactions to our format (filter out invalid entries)
        const transactions: OfxTransaction[] = stmtTrnArray
            .filter((trn: RawTransaction): trn is RawTransaction => trn && typeof trn === "object")
            .map((trn: RawTransaction) => mapRawTransactionToOfx(trn));

        // Extract date range
        const startDate = parseOfxDate(banktranlist.DTSTART);
        const endDate = parseOfxDate(banktranlist.DTEND);

        // Get currency (default to BRL for Brazilian banks)
        const currency = stmtRs.CURDEF || "BRL";

        return {
            account,
            transactions,
            currency,
            startDate,
            endDate,
        };
    } catch (error) {
        // Re-throw OFX parsing errors
        if (isOfxParsingError(error)) {
            throw error;
        }

        // Wrap other errors
        throw createParsingError(
            "PARSE_ERROR",
            `Erro ao processar arquivo OFX: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
            error
        );
    }
}

/**
 * Map raw OFX transaction object to our OfxTransaction type
 */
function mapRawTransactionToOfx(rawTrn: any): OfxTransaction {
    return {
        type: (rawTrn.TRNTYPE || "OTHER") as OfxTransactionType,
        datePosted: parseOfxDate(rawTrn.DTPOSTED),
        dateUser: rawTrn.DTUSER ? parseOfxDate(rawTrn.DTUSER) : undefined,
        amount: parseFloat(rawTrn.TRNAMT || "0"),
        fitId: rawTrn.FITID || "",
        correctFitId: rawTrn.CORRECTFITID,
        correctAction: rawTrn.CORRECTACTION as "REPLACE" | "DELETE" | undefined,
        checkNumber: rawTrn.CHECKNUM,
        referenceNumber: rawTrn.REFNUM,
        sic: rawTrn.SIC,
        payeeId: rawTrn.PAYEEID,
        name: rawTrn.NAME,
        memo: rawTrn.MEMO,
        currency: rawTrn.CURRENCY,
    };
}

/**
 * Parse OFX date format to JavaScript Date
 * OFX dates are in format: YYYYMMDDHHMMSS[.XXX][+/-TZ]
 * Example: 20231215120000 or 20231215120000.000[-3:EST]
 */
function parseOfxDate(dateString: string | undefined): Date {
    if (!dateString) {
        return new Date();
    }

    // Remove timezone and fractional seconds for simplicity
    // OFX format: YYYYMMDDHHMMSS
    const cleanDate = dateString.substring(0, 14);

    const year = parseInt(cleanDate.substring(0, 4), 10);
    const month = parseInt(cleanDate.substring(4, 6), 10) - 1; // JS months are 0-based
    const day = parseInt(cleanDate.substring(6, 8), 10);
    const hour = parseInt(cleanDate.substring(8, 10) || "0", 10);
    const minute = parseInt(cleanDate.substring(10, 12) || "0", 10);
    const second = parseInt(cleanDate.substring(12, 14) || "0", 10);

    return new Date(year, month, day, hour, minute, second);
}

/**
 * Create a standardized OFX parsing error
 */
function createParsingError(
    code: OfxParsingError["code"],
    message: string,
    details?: unknown
): OfxParsingError {
    return {
        code,
        message,
        details,
    };
}

/**
 * Type guard to check if error is an OFX parsing error
 */
function isOfxParsingError(error: unknown): error is OfxParsingError {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        "message" in error
    );
}
