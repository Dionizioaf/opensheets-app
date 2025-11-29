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
        // Preprocess: handle OFX v1 SGML by closing all tags (even multiline)
        const isSgml = /OFXSGML|OFXHEADER/i.test(fileContent);
        const contentStart = fileContent.indexOf("<OFX>");
        const body = contentStart >= 0 ? fileContent.slice(contentStart) : fileContent;
        // Improved SGML to XML: closes all tags, even multiline values
        const sgmlToXml = (s: string) => {
            // Normalize line endings
            let xml = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            // Find all tags and close them if not already closed
            // Handles multiline values
            xml = xml.replace(/<([A-Z0-9_]+)>([\s\S]*?)(?=<[A-Z0-9_]+>|<\/OFX>|$)/g, (match, tag, value) => {
                // If value already contains a closing tag, leave as is
                if (value.includes(`</${tag}>`)) return match;
                return `<${tag}>${value.trim()}</${tag}>`;
            });
            // Ensure closing OFX root if missing (rare)
            if (!/<\/OFX>/i.test(xml)) {
                xml += "</OFX>";
            }
            return xml;
        };

        const contentForParse = isSgml ? sgmlToXml(body) : fileContent;

        // Use ofx-js to parse the OFX/converted XML file
        const rawData = parse(contentForParse);

        // Helper to convert OFX date (e.g., 20250901100000[-03:EST]) to ISO string
        const toIsoFromOfx = (value: any): string | undefined => {
            if (!value || typeof value !== "string") return undefined;
            // Extract leading 14 digits (YYYYMMDDHHmmss)
            const m = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
            if (!m) return undefined;
            const [, Y, M, D, h, mnt, s] = m;
            // Default offset minutes = 0
            let offsetMinutes = 0;
            const tz = value.match(/\[([+-]?)(\d{2})(?::[A-Z]{2,4})?\]/i);
            if (tz) {
                const sign = tz[1] === "-" ? -1 : 1;
                const hh = parseInt(tz[2], 10);
                if (!Number.isNaN(hh)) offsetMinutes = sign * hh * 60;
            }
            const utcMs = Date.UTC(
                parseInt(Y, 10),
                parseInt(M, 10) - 1,
                parseInt(D, 10),
                parseInt(h, 10),
                parseInt(mnt, 10),
                parseInt(s, 10)
            ) - offsetMinutes * 60 * 1000;
            return new Date(utcMs).toISOString();
        };

        // Transform the parsed data to match our schema
        const transformedData = {
            account: rawData.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKACCTFROM ? {
                accountId: rawData.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKACCTFROM.ACCTID,
                accountType: rawData.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKACCTFROM.ACCTTYPE,
                bankId: rawData.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKACCTFROM.BANKID,
                currency: rawData.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.CURDEF,
            } : undefined,
            transactions: rawData.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.STMTTRN?.map((txn: any) => ({
                date: toIsoFromOfx(txn.DTPOSTED) ?? txn.DTPOSTED,
                amount: parseFloat(txn.TRNAMT),
                description: txn.MEMO || txn.NAME,
                payee: txn.NAME,
                type: txn.TRNTYPE?.toLowerCase() === 'debit' ? 'debit' : 'credit',
                id: txn.FITID,
                checkNumber: txn.CHECKNUM,
                refNumber: txn.REFNUM,
            })) || [],
            startDate: toIsoFromOfx(rawData.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.DTSTART),
            endDate: toIsoFromOfx(rawData.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.DTEND),
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