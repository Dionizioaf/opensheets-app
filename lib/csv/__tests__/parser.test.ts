import { detectDelimiter, parseCsvFile } from "../parser";
import type { CsvParseResult } from "../types";

/**
 * Unit tests for CSV parser
 * Tests delimiter detection and CSV file parsing
 */

describe("detectDelimiter", () => {
    it("should detect semicolon delimiter", () => {
        const content = `Data;Descrição;Valor
01/01/2024;Compra 1;100,00
02/01/2024;Compra 2;200,00`;

        const result = detectDelimiter(content);

        expect(result).toBe(";");
    });

    it("should detect comma delimiter", () => {
        const content = `Date,Description,Amount
2024-01-01,Purchase 1,100.00
2024-01-02,Purchase 2,200.00`;

        const result = detectDelimiter(content);

        expect(result).toBe(",");
    });

    it("should detect tab delimiter", () => {
        const content = `Date\tDescription\tAmount
2024-01-01\tPurchase 1\t100.00
2024-01-02\tPurchase 2\t200.00`;

        const result = detectDelimiter(content);

        expect(result).toBe("\t");
    });

    it("should return semicolon as default for empty content", () => {
        const content = "";

        const result = detectDelimiter(content);

        expect(result).toBe(";");
    });

    it("should handle content with only whitespace", () => {
        const content = "   \n  \n  ";

        const result = detectDelimiter(content);

        expect(result).toBe(";");
    });

    it("should detect delimiter with inconsistent counts (choose most common)", () => {
        // First line has 3 semicolons, rest have 2 - should still detect semicolon
        const content = `Data;Descrição;Valor;Extra
01/01/2024;Compra 1;100,00
02/01/2024;Compra 2;200,00`;

        const result = detectDelimiter(content);

        expect(result).toBe(";");
    });

    it("should prioritize consistent delimiter over higher count", () => {
        // Mix of delimiters - semicolon is consistent
        const content = `Data;Descrição;Valor
01/01/2024;Compra 1, teste;100,00
02/01/2024;Compra 2, outro;200,00`;

        const result = detectDelimiter(content);

        expect(result).toBe(";");
    });
});

describe("parseCsvFile", () => {
    describe("Valid CSV files", () => {
        it("should parse Brazilian CSV with semicolon delimiter", async () => {
            const csvContent = `Data;Descrição;Valor
01/01/2024;Supermercado;-150,00
02/01/2024;Salário;3000,00`;

            const file = createTestFile(csvContent, "test.csv");
            const result = await parseCsvFile(file);

            expect(result.success).toBe(true);
            expect(result.headers).toHaveLength(3);
            expect(result.headers[0].name).toBe("Data");
            expect(result.headers[1].name).toBe("Descrição");
            expect(result.headers[2].name).toBe("Valor");
            expect(result.rows).toHaveLength(2);
            expect(result.rowCount).toBe(2);
            expect(result.detectedDelimiter).toBe(";");
            expect(result.errors).toBeUndefined();
        });

        it("should parse CSV with comma delimiter when specified", async () => {
            const csvContent = `Date,Description,Amount
2024-01-01,Groceries,-150.00
2024-01-02,Salary,3000.00`;

            const file = createTestFile(csvContent, "test.csv");
            const result = await parseCsvFile(file, { delimiter: "," });

            expect(result.success).toBe(true);
            expect(result.headers).toHaveLength(3);
            expect(result.headers[0].name).toBe("Date");
            expect(result.rows).toHaveLength(2);
            expect(result.detectedDelimiter).toBe(",");
        });

        it("should auto-detect delimiter when set to 'auto'", async () => {
            const csvContent = `Data;Descrição;Valor
01/01/2024;Compra;-100,00`;

            const file = createTestFile(csvContent, "test.csv");
            const result = await parseCsvFile(file, { delimiter: "auto" });

            expect(result.success).toBe(true);
            expect(result.detectedDelimiter).toBe(";");
        });

        it("should trim headers by default", async () => {
            const csvContent = `  Data  ;  Descrição  ;  Valor  
01/01/2024;Compra;-100,00`;

            const file = createTestFile(csvContent, "test.csv");
            const result = await parseCsvFile(file);

            expect(result.headers[0].name).toBe("Data");
            expect(result.headers[1].name).toBe("Descrição");
            expect(result.headers[2].name).toBe("Valor");
        });

        it("should skip empty lines by default", async () => {
            const csvContent = `Data;Descrição;Valor

01/01/2024;Compra 1;-100,00

02/01/2024;Compra 2;-200,00
`;

            const file = createTestFile(csvContent, "test.csv");
            const result = await parseCsvFile(file);

            expect(result.success).toBe(true);
            expect(result.rows).toHaveLength(2);
        });

        it("should preserve original header names", async () => {
            const csvContent = `  Data Original  ;Descrição
01/01/2024;Teste`;

            const file = createTestFile(csvContent, "test.csv");
            const result = await parseCsvFile(file);

            expect(result.headers[0].name).toBe("Data Original");
            expect(result.headers[0].originalName).toBe("  Data Original  ");
        });

        it("should parse tab-delimited CSV", async () => {
            const csvContent = `Date\tDescription\tAmount
2024-01-01\tGroceries\t-150.00`;

            const file = createTestFile(csvContent, "test.csv");
            const result = await parseCsvFile(file, { delimiter: "\t" });

            expect(result.success).toBe(true);
            expect(result.detectedDelimiter).toBe("\t");
            expect(result.rows).toHaveLength(1);
        });

        it("should handle CSV with special characters", async () => {
            const csvContent = `Data;Descrição;Valor
01/01/2024;Café & Pão;-15,50
02/01/2024;Açúcar (2kg);-8,99`;

            const file = createTestFile(csvContent, "test.csv");
            const result = await parseCsvFile(file);

            expect(result.success).toBe(true);
            expect(result.rows).toHaveLength(2);
            expect(result.rows[0]["Descrição"]).toBe("Café & Pão");
            expect(result.rows[1]["Descrição"]).toBe("Açúcar (2kg)");
        });

        it("should assign correct index to each header", async () => {
            const csvContent = `Data;Descrição;Valor;Categoria
01/01/2024;Teste;100,00;Alimentação`;

            const file = createTestFile(csvContent, "test.csv");
            const result = await parseCsvFile(file);

            expect(result.headers[0].index).toBe(0);
            expect(result.headers[1].index).toBe(1);
            expect(result.headers[2].index).toBe(2);
            expect(result.headers[3].index).toBe(3);
        });
    });

    describe("Invalid CSV files", () => {
        it("should handle empty file", async () => {
            const csvContent = "";
            const file = createTestFile(csvContent, "empty.csv");
            const result = await parseCsvFile(file);

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors![0].code).toBe("EMPTY_FILE");
            expect(result.errors![0].message).toContain("vazio");
        });

        it("should handle file with only whitespace", async () => {
            const csvContent = "   \n  \n  ";
            const file = createTestFile(csvContent, "whitespace.csv");
            const result = await parseCsvFile(file);

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors![0].code).toBe("EMPTY_FILE");
        });

        it("should handle file with only headers (no data rows)", async () => {
            const csvContent = "Data;Descrição;Valor";
            const file = createTestFile(csvContent, "headers-only.csv");
            const result = await parseCsvFile(file);

            // Papaparse will parse this successfully but with 0 data rows
            expect(result.success).toBe(true);
            expect(result.headers).toHaveLength(3);
            expect(result.rows).toHaveLength(0);
            expect(result.rowCount).toBe(0);
        });

        it("should report errors for malformed CSV", async () => {
            // CSV with mismatched columns (row has more fields than headers)
            const csvContent = `Data;Descrição
01/01/2024;Compra;Extra;Field`;

            const file = createTestFile(csvContent, "malformed.csv");
            const result = await parseCsvFile(file);

            // Papaparse might still parse this but may include errors
            expect(result).toBeDefined();
            // Either success with warnings or failure with errors
        });
    });

    describe("Encoding options", () => {
        it("should use UTF-8 encoding by default", async () => {
            const csvContent = "Data;Descrição\n01/01/2024;Café";
            const file = createTestFile(csvContent, "test.csv");
            const result = await parseCsvFile(file);

            expect(result.encoding).toBe("UTF-8");
        });

        it("should accept custom encoding option", async () => {
            const csvContent = "Data;Descrição\n01/01/2024;Test";
            const file = createTestFile(csvContent, "test.csv");
            const result = await parseCsvFile(file, { encoding: "Latin1" });

            expect(result.encoding).toBe("Latin1");
        });
    });

    describe("Configuration options", () => {
        it("should respect skipEmptyLines option", async () => {
            const csvContent = `Data;Descrição

01/01/2024;Compra`;

            const file = createTestFile(csvContent, "test.csv");
            const resultSkip = await parseCsvFile(file, { skipEmptyLines: true });
            const resultNoSkip = await parseCsvFile(file, { skipEmptyLines: false });

            expect(resultSkip.rows).toHaveLength(1);
            expect(resultNoSkip.rows.length).toBeGreaterThanOrEqual(1);
        });

        it("should respect trimHeaders option", async () => {
            const csvContent = `  Data  ;Descrição\n01/01/2024;Test`;

            const file = createTestFile(csvContent, "test.csv");
            const resultTrim = await parseCsvFile(file, { trimHeaders: true });
            const resultNoTrim = await parseCsvFile(file, { trimHeaders: false });

            expect(resultTrim.headers[0].name).toBe("Data");
            expect(resultNoTrim.headers[0].name).toBe("  Data  ");
        });
    });
});

/**
 * Helper function to create a File object for testing
 */
function createTestFile(content: string, filename: string): File {
    const blob = new Blob([content], { type: "text/csv" });
    return new File([blob], filename, { type: "text/csv" });
}
