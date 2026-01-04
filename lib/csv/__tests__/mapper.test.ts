import {
    parseBrazilianCurrency,
    parseBrazilianDate,
    validateColumnMapping,
    mapCsvRowToTransaction,
} from "../mapper";
import type { ColumnMapping, CsvRow } from "../types";

/**
 * Unit tests for CSV mapper
 * Tests currency parsing, date parsing, validation, and data transformation
 */

describe("parseBrazilianCurrency", () => {
    describe("Brazilian format (1.234,56)", () => {
        it("should parse Brazilian format with R$ prefix", () => {
            const result = parseBrazilianCurrency("R$ 1.234,56");

            expect(result).toBe("1234.56");
        });

        it("should parse Brazilian format without prefix", () => {
            const result = parseBrazilianCurrency("1.234,56");

            expect(result).toBe("1234.56");
        });

        it("should parse value with comma decimal only", () => {
            const result = parseBrazilianCurrency("1234,56");

            expect(result).toBe("1234.56");
        });

        it("should parse negative Brazilian format", () => {
            const result = parseBrazilianCurrency("-1.234,56");

            expect(result).toBe("-1234.56");
        });

        it("should parse negative with parentheses", () => {
            const result = parseBrazilianCurrency("(1.234,56)");

            expect(result).toBe("-1234.56");
        });

        it("should parse value with R$ and negative sign", () => {
            const result = parseBrazilianCurrency("R$ -123,45");

            expect(result).toBe("-123.45");
        });

        it("should handle large values", () => {
            const result = parseBrazilianCurrency("R$ 1.234.567,89");

            expect(result).toBe("1234567.89");
        });
    });

    describe("International format (1,234.56)", () => {
        it("should parse international format", () => {
            const result = parseBrazilianCurrency("1,234.56");

            expect(result).toBe("1234.56");
        });

        it("should parse value with period decimal only", () => {
            const result = parseBrazilianCurrency("1234.56");

            expect(result).toBe("1234.56");
        });

        it("should parse negative international format", () => {
            const result = parseBrazilianCurrency("-1,234.56");

            expect(result).toBe("-1234.56");
        });

        it("should handle large international values", () => {
            const result = parseBrazilianCurrency("1,234,567.89");

            expect(result).toBe("1234567.89");
        });
    });

    describe("Edge cases", () => {
        it("should parse integer value without decimals", () => {
            const result = parseBrazilianCurrency("1234");

            expect(result).toBe("1234.00");
        });

        it("should handle extra whitespace", () => {
            const result = parseBrazilianCurrency("  R$  1.234,56  ");

            expect(result).toBe("1234.56");
        });

        it("should parse zero value", () => {
            const result = parseBrazilianCurrency("0,00");

            expect(result).toBe("0.00");
        });

        it("should parse small decimal values", () => {
            const result = parseBrazilianCurrency("0,01");

            expect(result).toBe("0.01");
        });

        it("should handle value with only thousands separator", () => {
            const result = parseBrazilianCurrency("1.234");

            // When only period exists, it's treated as decimal separator (1.234)
            expect(result).toBe("1.23");
        });
    });

    describe("Invalid inputs", () => {
        it("should return null for empty string", () => {
            const result = parseBrazilianCurrency("");

            expect(result).toBeNull();
        });

        it("should return null for non-numeric string", () => {
            const result = parseBrazilianCurrency("abc");

            expect(result).toBeNull();
        });

        it("should return null for null input", () => {
            const result = parseBrazilianCurrency(null as any);

            expect(result).toBeNull();
        });

        it("should return null for undefined input", () => {
            const result = parseBrazilianCurrency(undefined as any);

            expect(result).toBeNull();
        });

        it("should return null for only currency symbol", () => {
            const result = parseBrazilianCurrency("R$");

            expect(result).toBeNull();
        });
    });

    describe("Decimal precision", () => {
        it("should always return 2 decimal places", () => {
            const result = parseBrazilianCurrency("100");

            expect(result).toBe("100.00");
        });

        it("should round to 2 decimal places", () => {
            const result = parseBrazilianCurrency("100.999");

            // toFixed rounds, not truncates (0.999 rounds to 1.00)
            expect(result).toBe("101.00");
        });
    });
});

describe("parseBrazilianDate", () => {
    describe("DD/MM/YYYY format (Brazilian)", () => {
        it("should parse DD/MM/YYYY format", () => {
            const result = parseBrazilianDate("15/12/2023");

            expect(result).toBeInstanceOf(Date);
            expect(result?.getDate()).toBe(15);
            expect(result?.getMonth()).toBe(11); // December = 11
            expect(result?.getFullYear()).toBe(2023);
        });

        it("should parse DD-MM-YYYY format", () => {
            const result = parseBrazilianDate("25-06-2024");

            expect(result).toBeInstanceOf(Date);
            expect(result?.getDate()).toBe(25);
            expect(result?.getMonth()).toBe(5); // June = 5
            expect(result?.getFullYear()).toBe(2024);
        });

        it("should parse single digit day and month", () => {
            const result = parseBrazilianDate("1/3/2024");

            expect(result).toBeInstanceOf(Date);
            expect(result?.getDate()).toBe(1);
            expect(result?.getMonth()).toBe(2); // March = 2
            expect(result?.getFullYear()).toBe(2024);
        });

        it("should handle leading zeros", () => {
            const result = parseBrazilianDate("01/01/2024");

            expect(result).toBeInstanceOf(Date);
            expect(result?.getDate()).toBe(1);
            expect(result?.getMonth()).toBe(0); // January = 0
            expect(result?.getFullYear()).toBe(2024);
        });
    });

    describe("YYYY-MM-DD format (ISO)", () => {
        it("should parse YYYY-MM-DD format", () => {
            const result = parseBrazilianDate("2023-12-15");

            expect(result).toBeInstanceOf(Date);
            expect(result?.getDate()).toBe(15);
            expect(result?.getMonth()).toBe(11);
            expect(result?.getFullYear()).toBe(2023);
        });

        it("should parse YYYY/MM/DD format", () => {
            const result = parseBrazilianDate("2024/06/25");

            expect(result).toBeInstanceOf(Date);
            expect(result?.getDate()).toBe(25);
            expect(result?.getMonth()).toBe(5);
            expect(result?.getFullYear()).toBe(2024);
        });
    });

    describe("Date validation", () => {
        it("should reject invalid day", () => {
            const result = parseBrazilianDate("32/01/2024");

            expect(result).toBeNull();
        });

        it("should reject invalid month", () => {
            const result = parseBrazilianDate("15/13/2024");

            expect(result).toBeNull();
        });

        it("should reject February 30th", () => {
            const result = parseBrazilianDate("30/02/2024");

            expect(result).toBeNull();
        });

        it("should accept leap year date", () => {
            const result = parseBrazilianDate("29/02/2024");

            expect(result).toBeInstanceOf(Date);
            expect(result?.getDate()).toBe(29);
            expect(result?.getMonth()).toBe(1); // February
        });

        it("should reject February 29th on non-leap year", () => {
            const result = parseBrazilianDate("29/02/2023");

            expect(result).toBeNull();
        });
    });

    describe("Invalid inputs", () => {
        it("should return null for empty string", () => {
            const result = parseBrazilianDate("");

            expect(result).toBeNull();
        });

        it("should return null for invalid format", () => {
            const result = parseBrazilianDate("12-2024-15");

            expect(result).toBeNull();
        });

        it("should return null for null input", () => {
            const result = parseBrazilianDate(null as any);

            expect(result).toBeNull();
        });

        it("should return null for undefined input", () => {
            const result = parseBrazilianDate(undefined as any);

            expect(result).toBeNull();
        });

        it("should return null for non-date string", () => {
            const result = parseBrazilianDate("not a date");

            expect(result).toBeNull();
        });

        it("should handle extra whitespace", () => {
            const result = parseBrazilianDate("  15/12/2023  ");

            expect(result).toBeInstanceOf(Date);
            expect(result?.getDate()).toBe(15);
        });
    });
});

describe("validateColumnMapping", () => {
    describe("Valid mappings", () => {
        it("should validate mapping with all required fields", () => {
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
                description: "Descrição",
            };

            const result = validateColumnMapping(mapping);

            expect(result.isValid).toBe(true);
            expect(result.missingFields).toHaveLength(0);
            expect(result.errorMessage).toBeUndefined();
        });

        it("should validate mapping without optional description", () => {
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result = validateColumnMapping(mapping);

            expect(result.isValid).toBe(true);
            expect(result.missingFields).toHaveLength(0);
        });
    });

    describe("Invalid mappings", () => {
        it("should reject mapping without date", () => {
            const mapping: ColumnMapping = {
                amount: "Valor",
                description: "Descrição",
            };

            const result = validateColumnMapping(mapping);

            expect(result.isValid).toBe(false);
            expect(result.missingFields).toContain("date");
            expect(result.errorMessage).toContain("Data");
        });

        it("should reject mapping without amount", () => {
            const mapping: ColumnMapping = {
                date: "Data",
                description: "Descrição",
            };

            const result = validateColumnMapping(mapping);

            expect(result.isValid).toBe(false);
            expect(result.missingFields).toContain("amount");
            expect(result.errorMessage).toContain("Valor");
        });

        it("should reject mapping without date and amount", () => {
            const mapping: ColumnMapping = {
                description: "Descrição",
            };

            const result = validateColumnMapping(mapping);

            expect(result.isValid).toBe(false);
            expect(result.missingFields).toContain("date");
            expect(result.missingFields).toContain("amount");
            expect(result.errorMessage).toContain("Data");
            expect(result.errorMessage).toContain("Valor");
        });

        it("should reject empty mapping", () => {
            const mapping: ColumnMapping = {};

            const result = validateColumnMapping(mapping);

            expect(result.isValid).toBe(false);
            expect(result.missingFields).toHaveLength(2);
        });
    });

    describe("Error messages", () => {
        it("should provide Portuguese error message", () => {
            const mapping: ColumnMapping = {};

            const result = validateColumnMapping(mapping);

            expect(result.errorMessage).toContain("obrigatórios");
            expect(result.errorMessage).toContain("mapeados");
        });
    });
});

describe("mapCsvRowToTransaction", () => {
    describe("Valid transactions", () => {
        it("should map expense transaction (negative amount)", () => {
            const row: CsvRow = {
                Data: "15/12/2023",
                Descrição: "Supermercado",
                Valor: "R$ -150,00",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
                description: "Descrição",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result).not.toBeNull();
            expect(result?.transactionType).toBe("Despesa");
            expect(result?.amount).toBe("150.00"); // Absolute value
            expect(result?.name).toBe("Supermercado");
            expect(result?.purchaseDate).toBeInstanceOf(Date);
            expect(result?.period).toBe("2023-12");
        });

        it("should map income transaction (positive amount)", () => {
            const row: CsvRow = {
                Data: "01/01/2024",
                Valor: "3000,00",
                Descrição: "Salário",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
                description: "Descrição",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result).not.toBeNull();
            expect(result?.transactionType).toBe("Receita");
            expect(result?.amount).toBe("3000.00");
            expect(result?.name).toBe("Salário");
        });

        it("should generate period from date", () => {
            const row: CsvRow = {
                Data: "25/06/2024",
                Valor: "-100,00",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result?.period).toBe("2024-06");
        });

        it("should set default values", () => {
            const row: CsvRow = {
                Data: "15/12/2023",
                Valor: "-100,00",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result?.paymentMethod).toBe("Débito");
            expect(result?.condition).toBe("à vista");
            expect(result?.isSettled).toBe(true);
            expect(result?.isSelected).toBe(true);
            expect(result?.isEdited).toBe(false);
            expect(result?.hasError).toBe(false);
            expect(result?.isDuplicate).toBe(false);
        });

        it("should use default description when not provided", () => {
            const row: CsvRow = {
                Data: "15/12/2023",
                Valor: "-100,00",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result?.name).toBe("Transação importada");
        });

        it("should store raw data and row index", () => {
            const row: CsvRow = {
                Data: "15/12/2023",
                Valor: "-100,00",
                Extra: "Some value",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result = mapCsvRowToTransaction(row, mapping, 5);

            expect(result?.csvRowIndex).toBe(5);
            expect(result?.rawData).toEqual(row);
        });

        it("should generate unique ID for each transaction", () => {
            const row: CsvRow = {
                Data: "15/12/2023",
                Valor: "-100,00",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result1 = mapCsvRowToTransaction(row, mapping, 0);
            const result2 = mapCsvRowToTransaction(row, mapping, 1);

            expect(result1?.id).toBeDefined();
            expect(result2?.id).toBeDefined();
            expect(result1?.id).not.toBe(result2?.id);
        });

        it("should handle international date format", () => {
            const row: CsvRow = {
                Date: "2024-01-15",
                Amount: "-100.00",
            };
            const mapping: ColumnMapping = {
                date: "Date",
                amount: "Amount",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result).not.toBeNull();
            expect(result?.purchaseDate?.getDate()).toBe(15);
            expect(result?.purchaseDate?.getMonth()).toBe(0); // January
        });
    });

    describe("Invalid transactions", () => {
        it("should return null for invalid date", () => {
            const row: CsvRow = {
                Data: "invalid date",
                Valor: "-100,00",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result).toBeNull();
        });

        it("should return null for invalid amount", () => {
            const row: CsvRow = {
                Data: "15/12/2023",
                Valor: "not a number",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result).toBeNull();
        });

        it("should return null for missing date field", () => {
            const row: CsvRow = {
                Valor: "-100,00",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result).toBeNull();
        });

        it("should return null for missing amount field", () => {
            const row: CsvRow = {
                Data: "15/12/2023",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result).toBeNull();
        });

        it("should return null for invalid mapping", () => {
            const row: CsvRow = {
                Data: "15/12/2023",
                Valor: "-100,00",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                // Missing required 'amount' field
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result).toBeNull();
        });
    });

    describe("Amount handling", () => {
        it("should convert negative amount to absolute value", () => {
            const row: CsvRow = {
                Data: "15/12/2023",
                Valor: "-1.234,56",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result?.amount).toBe("1234.56");
            expect(result?.transactionType).toBe("Despesa");
        });

        it("should keep positive amount as-is", () => {
            const row: CsvRow = {
                Data: "15/12/2023",
                Valor: "1.234,56",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result?.amount).toBe("1234.56");
            expect(result?.transactionType).toBe("Receita");
        });

        it("should handle zero amount", () => {
            const row: CsvRow = {
                Data: "15/12/2023",
                Valor: "0,00",
            };
            const mapping: ColumnMapping = {
                date: "Data",
                amount: "Valor",
            };

            const result = mapCsvRowToTransaction(row, mapping, 0);

            expect(result?.amount).toBe("0.00");
            expect(result?.transactionType).toBe("Receita"); // Zero is not negative
        });
    });
});
