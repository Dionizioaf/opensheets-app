import { parse } from "ofx-js";
import { OfxFileSchema, type OfxFile } from "@/lib/schemas/ofx";

/**
 * Error thrown when OFX parsing fails
 */
export class OfxParseError extends Error {
    constructor(message: string, public originalError?: Error) {
        super(message);
        this.name = "OfxParseError";
    }
}

/**
 * Parses an OFX file content and extracts transaction data
 *
 * @param fileContent - The raw OFX file content as string
 * @param filename - The original filename for validation
 * @returns Validated OFX file data with transactions
 * @throws OfxParseError if parsing or validation fails
 */
export async function parseOfxFile(
    fileContent: string,
    filename?: string
): Promise<OfxFile> {
    // Validate file type if filename is provided
    if (filename && !isOfxFile(filename)) {
        throw new OfxParseError(
            "Invalid file type. Only .ofx files are supported."
        );
    }

    // Validate file size (10MB limit as per PRD)
    const fileSize = getFileSize(fileContent);
    if (fileSize > 10 * 1024 * 1024) {
        throw new OfxParseError(
            "File too large. Maximum size is 10MB."
        );
    }

    try {
        // Use ofx-js to parse the OFX file
        const rawData = parse(fileContent);

        // Transform the parsed data to match our schema
        const transformedData = {
            account: rawData.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKACCTFROM ? {
                accountId: rawData.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKACCTFROM.ACCTID,
                accountType: rawData.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKACCTFROM.ACCTTYPE,
                bankId: rawData.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKACCTFROM.BANKID,
                currency: rawData.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.CURDEF,
            } : undefined,
            transactions: rawData.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.STMTTRN?.map((txn: any) => ({
                date: txn.DTPOSTED,
                amount: parseFloat(txn.TRNAMT),
                description: txn.MEMO || txn.NAME,
                payee: txn.NAME,
                type: txn.TRNTYPE?.toLowerCase() === 'debit' ? 'debit' : 'credit',
                id: txn.FITID,
                checkNumber: txn.CHECKNUM,
                refNumber: txn.REFNUM,
            })) || [],
            startDate: rawData.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.DTSTART,
            endDate: rawData.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.DTEND,
        };

        // Validate the transformed data against our schema
        const validatedData = OfxFileSchema.parse(transformedData);

        return validatedData;
    } catch (error) {
        if (error instanceof Error) {
            throw new OfxParseError(
                `Failed to parse OFX file: ${error.message}`,
                error
            );
        }

        throw new OfxParseError("Failed to parse OFX file: Unknown error");
    }
}

/**
 * Validates if a file has the correct OFX extension
 *
 * @param filename - The filename to check
 * @returns true if the file has .ofx extension
 */
export function isOfxFile(filename: string): boolean {
    return filename.toLowerCase().endsWith('.ofx');
}

/**
 * Gets file size in bytes
 *
 * @param content - The file content
 * @returns Size in bytes
 */
export function getFileSize(content: string): number {
    return Buffer.byteLength(content, 'utf8');
}