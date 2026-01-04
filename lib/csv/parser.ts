/**
 * CSV Parser
 * 
 * Functions for parsing CSV files and detecting delimiters.
 */

import Papa from "papaparse";
import type {
    CsvParseResult,
    CsvDelimiter,
    CsvImportConfig,
    CsvColumn,
    CsvRow,
    CsvParsingError,
} from "./types";

/**
 * Detect delimiter from CSV file content
 * Analyzes first few rows to determine most likely delimiter
 * 
 * @param content - First few lines of CSV file
 * @returns Detected delimiter or semicolon as default
 */
export function detectDelimiter(content: string): CsvDelimiter {
    // Get first 5 lines for analysis
    const lines = content.split("\n").slice(0, 5).filter(line => line.trim());

    if (lines.length === 0) {
        return ";"; // Default to semicolon (Brazilian standard)
    }

    // Count occurrences of each delimiter
    const delimiters: CsvDelimiter[] = [";", ",", "\t"];
    const counts = delimiters.map(delimiter => {
        // Count delimiter in each line and get average
        const lineCounts = lines.map(line => (line.match(new RegExp(`\\${delimiter}`, "g")) || []).length);
        const avgCount = lineCounts.reduce((a, b) => a + b, 0) / lineCounts.length;
        // Check consistency (all lines should have similar count)
        const isConsistent = lineCounts.every(count => Math.abs(count - avgCount) <= 1);

        return {
            delimiter,
            avgCount,
            isConsistent,
        };
    });

    // Sort by average count (descending) and consistency
    counts.sort((a, b) => {
        if (a.isConsistent && !b.isConsistent) return -1;
        if (!a.isConsistent && b.isConsistent) return 1;
        return b.avgCount - a.avgCount;
    });

    // Return most likely delimiter
    return counts[0].avgCount > 0 ? counts[0].delimiter : ";";
}

/**
 * Parse CSV file and extract structured data
 * 
 * @param file - CSV file to parse
 * @param config - Optional parsing configuration
 * @returns Promise resolving to CsvParseResult
 */
export async function parseCsvFile(
    file: File,
    config?: Partial<CsvImportConfig>
): Promise<CsvParseResult> {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const content = event.target?.result as string;

            if (!content || content.trim().length === 0) {
                resolve({
                    success: false,
                    headers: [],
                    rows: [],
                    rowCount: 0,
                    detectedDelimiter: ";",
                    encoding: "UTF-8",
                    errors: [
                        {
                            type: "FieldMismatch",
                            code: "EMPTY_FILE",
                            message: "O arquivo CSV está vazio",
                        },
                    ],
                });
                return;
            }

            // Detect delimiter if not provided or set to auto
            const delimiter =
                config?.delimiter === "auto" || !config?.delimiter
                    ? detectDelimiter(content)
                    : config.delimiter;

            // Parse with papaparse
            Papa.parse(content, {
                delimiter,
                header: true,
                skipEmptyLines: config?.skipEmptyLines ?? true,
                complete: (results) => {
                    // Get original headers before any transformation
                    const firstLine = content.split("\n")[0];
                    const originalHeaders = firstLine.split(delimiter);

                    // Determine if headers should be trimmed (default: true)
                    const shouldTrim = config?.trimHeaders !== false;

                    // Extract headers with both trimmed and original names
                    const headers: CsvColumn[] = results.meta.fields?.map((field, index) => ({
                        index,
                        name: shouldTrim ? field.trim() : field,
                        originalName: originalHeaders[index] || field,
                    })) || [];

                    // Convert data to CsvRow format
                    const rows: CsvRow[] = results.data as CsvRow[];

                    // Map papaparse errors to our error type
                    const errors: CsvParsingError[] = results.errors.map((error) => ({
                        type: error.type as CsvParsingError["type"],
                        code: error.code,
                        message: error.message,
                        row: error.row,
                    }));

                    const parseResult: CsvParseResult = {
                        success: errors.length === 0,
                        headers,
                        rows,
                        rowCount: rows.length,
                        detectedDelimiter: delimiter,
                        encoding: config?.encoding || "UTF-8",
                        errors: errors.length > 0 ? errors : undefined,
                    };

                    resolve(parseResult);
                },
                error: (error) => {
                    resolve({
                        success: false,
                        headers: [],
                        rows: [],
                        rowCount: 0,
                        detectedDelimiter: delimiter,
                        encoding: config?.encoding || "UTF-8",
                        errors: [
                            {
                                type: "Delimiter",
                                code: "PARSE_ERROR",
                                message: `Erro ao processar arquivo CSV: ${error.message}`,
                            },
                        ],
                    });
                },
            });
        };

        reader.onerror = () => {
            resolve({
                success: false,
                headers: [],
                rows: [],
                rowCount: 0,
                detectedDelimiter: ";",
                encoding: "UTF-8",
                errors: [
                    {
                        type: "Delimiter",
                        code: "FILE_READ_ERROR",
                        message: "Erro ao ler o arquivo CSV",
                    },
                ],
            });
        };

        // Read file with specified encoding
        reader.readAsText(file, config?.encoding || "UTF-8");
    });
}

/**
 * Parse CSV string content (server-safe version)
 * 
 * @param content - CSV file content as string
 * @param config - Optional parsing configuration
 * @returns CsvParseResult
 */
export function parseCsvString(
    content: string,
    config?: Partial<CsvImportConfig>
): CsvParseResult {
    if (!content || content.trim().length === 0) {
        return {
            success: false,
            headers: [],
            rows: [],
            rowCount: 0,
            detectedDelimiter: ";",
            encoding: "UTF-8",
            errors: [
                {
                    type: "FieldMismatch",
                    code: "EMPTY_FILE",
                    message: "O arquivo CSV está vazio",
                },
            ],
        };
    }

    // Detect delimiter if not provided or set to auto
    const delimiter =
        config?.delimiter === "auto" || !config?.delimiter
            ? detectDelimiter(content)
            : config.delimiter;

    // Parse with papaparse (synchronous)
    const results = Papa.parse(content, {
        delimiter,
        header: true,
        skipEmptyLines: config?.skipEmptyLines ?? true,
    });

    // Get original headers before any transformation
    const firstLine = content.split("\n")[0];
    const originalHeaders = firstLine.split(delimiter);

    // Determine if headers should be trimmed (default: true)
    const shouldTrim = config?.trimHeaders !== false;

    // Extract headers with both trimmed and original names
    const headers: CsvColumn[] = results.meta.fields?.map((field, index) => ({
        index,
        name: shouldTrim ? field.trim() : field,
        originalName: originalHeaders[index] || field,
    })) || [];

    // Convert data to CsvRow format
    const rows: CsvRow[] = results.data as CsvRow[];

    // Map papaparse errors to our error type
    const errors: CsvParsingError[] = results.errors.map((error) => ({
        type: error.type as CsvParsingError["type"],
        code: error.code,
        message: error.message,
        row: error.row,
    }));

    return {
        success: errors.length === 0,
        headers,
        rows,
        rowCount: rows.length,
        detectedDelimiter: delimiter,
        encoding: config?.encoding || "UTF-8",
        errors: errors.length > 0 ? errors : undefined,
    };
}
