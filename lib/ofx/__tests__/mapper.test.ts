import {
    mapOfxToLancamento,
    sanitizeOfxDescription,
    generateImportNote,
    mapOfxTransactionsToLancamentos
} from "../mapper";
import type { OfxTransaction } from "../types";

/**
 * Unit tests for OFX mapper
 * Tests mapping of OFX transactions to lancamento schema
 * 
 * Note: Run these tests with your test framework (Jest, Vitest, etc.)
 * Example: npm test or pnpm test
 */

describe("mapOfxToLancamento", () => {
    describe("Transaction type mapping", () => {
        it("should map negative amount to Despesa", () => {
            const ofxTrn = createSampleTransaction({ amount: -100.50 });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.tipo_transacao).toBe("Despesa");
        });

        it("should map positive amount to Receita", () => {
            const ofxTrn = createSampleTransaction({ amount: 1500.00 });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.tipo_transacao).toBe("Receita");
        });

        it("should map DEBIT type to Despesa", () => {
            const ofxTrn = createSampleTransaction({ type: "DEBIT", amount: -50.00 });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.tipo_transacao).toBe("Despesa");
        });

        it("should map CREDIT type to Receita", () => {
            const ofxTrn = createSampleTransaction({ type: "CREDIT", amount: 100.00 });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.tipo_transacao).toBe("Receita");
        });
    });

    describe("Amount conversion", () => {
        it("should convert negative amount to absolute decimal string", () => {
            const ofxTrn = createSampleTransaction({ amount: -123.45 });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.valor).toBe("123.45");
        });

        it("should convert positive amount to decimal string", () => {
            const ofxTrn = createSampleTransaction({ amount: 1500.00 });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.valor).toBe("1500.00");
        });

        it("should format decimal with 2 places", () => {
            const ofxTrn = createSampleTransaction({ amount: 99.9 });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.valor).toBe("99.90");
        });
    });

    describe("Date and period formatting", () => {
        it("should convert date correctly", () => {
            const date = new Date(2023, 11, 15); // December 15, 2023
            const ofxTrn = createSampleTransaction({ datePosted: date });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.data_compra).toEqual(date);
        });

        it("should format period as YYYY-MM", () => {
            const date = new Date(2023, 11, 15); // December 15, 2023
            const ofxTrn = createSampleTransaction({ datePosted: date });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.periodo).toBe("2023-12");
        });

        it("should pad month with zero", () => {
            const date = new Date(2023, 0, 15); // January 15, 2023
            const ofxTrn = createSampleTransaction({ datePosted: date });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.periodo).toBe("2023-01");
        });
    });

    describe("Payment method mapping", () => {
        it("should map ATM to Dinheiro", () => {
            const ofxTrn = createSampleTransaction({ type: "ATM" });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.forma_pagamento).toBe("Dinheiro");
        });

        it("should map POS to Cartão de débito", () => {
            const ofxTrn = createSampleTransaction({ type: "POS" });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.forma_pagamento).toBe("Cartão de débito");
        });

        it("should map PAYMENT to Pix", () => {
            const ofxTrn = createSampleTransaction({ type: "PAYMENT" });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.forma_pagamento).toBe("Pix");
        });

        it("should default to Cartão de débito", () => {
            const ofxTrn = createSampleTransaction({ type: "OTHER" });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.forma_pagamento).toBe("Cartão de débito");
        });
    });

    describe("Transaction name handling", () => {
        it("should use NAME field if available", () => {
            const ofxTrn = createSampleTransaction({ name: "FARMACIA XYZ" });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.nome).toBe("FARMACIA XYZ");
        });

        it("should use MEMO if NAME not available", () => {
            const ofxTrn = createSampleTransaction({
                name: undefined,
                memo: "COMPRA NO MERCADO"
            });

            const result = mapOfxToLancamento(ofxTrn);

            // COMPRA prefix is removed by sanitizeOfxDescription
            expect(result.nome).toBe("NO MERCADO");
        });

        it("should use default if both NAME and MEMO missing", () => {
            const ofxTrn = createSampleTransaction({
                name: undefined,
                memo: undefined
            });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.nome).toBe("Transação importada");
        });
    });

    describe("Fixed fields", () => {
        it("should set condicao to À vista", () => {
            const ofxTrn = createSampleTransaction({});

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.condicao).toBe("À vista");
        });

        it("should set realizado to true", () => {
            const ofxTrn = createSampleTransaction({});

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.realizado).toBe(true);
        });

        it("should set isSelected to true by default", () => {
            const ofxTrn = createSampleTransaction({});

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.isSelected).toBe(true);
        });

        it("should set isDuplicate to false by default", () => {
            const ofxTrn = createSampleTransaction({});

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.isDuplicate).toBe(false);
        });
    });

    describe("Import metadata", () => {
        it("should preserve FITID", () => {
            const ofxTrn = createSampleTransaction({ fitId: "TXN123456" });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.fitId).toBe("TXN123456");
        });

        it("should preserve raw data", () => {
            const ofxTrn = createSampleTransaction({});

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.rawData).toEqual(ofxTrn);
        });

        it("should create import note", () => {
            const ofxTrn = createSampleTransaction({ fitId: "TXN123" });

            const result = mapOfxToLancamento(ofxTrn);

            expect(result.anotacao).toContain("Importado via OFX");
            expect(result.anotacao).toContain("FITID: TXN123");
        });
    });
});

describe("sanitizeOfxDescription", () => {
    it("should remove extra spaces", () => {
        const result = sanitizeOfxDescription("MERCADO    EXTRA    SPACES");

        expect(result).toBe("MERCADO EXTRA SPACES");
    });

    it("should remove newlines", () => {
        const result = sanitizeOfxDescription("MERCADO\nTESTE\nLINE");

        expect(result).toBe("MERCADO TESTE LINE");
    });

    it("should remove tabs", () => {
        const result = sanitizeOfxDescription("MERCADO\t\tTESTE\t\tTAB");

        expect(result).toBe("MERCADO TESTE TAB");
    });

    it("should trim whitespace", () => {
        const result = sanitizeOfxDescription("  MERCADO TESTE  ");

        expect(result).toBe("MERCADO TESTE");
    });

    it("should remove common bank prefixes", () => {
        const result = sanitizeOfxDescription("COMPRA FARMACIA XYZ");

        expect(result).toBe("FARMACIA XYZ");
    });

    it("should truncate long descriptions", () => {
        const longText = "A".repeat(300);

        const result = sanitizeOfxDescription(longText);

        expect(result.length).toBeLessThanOrEqual(255);
        expect(result).toContain("...");
    });

    it("should handle empty string", () => {
        const result = sanitizeOfxDescription("");

        expect(result).toBe("Transação importada");
    });

    it("should handle undefined", () => {
        const result = sanitizeOfxDescription(undefined as any);

        expect(result).toBe("Transação importada");
    });
});

describe("generateImportNote", () => {
    it("should include import date", () => {
        const ofxTrn = createSampleTransaction({});

        const result = generateImportNote(ofxTrn);

        expect(result).toContain("Importado via OFX");
    });

    it("should include FITID", () => {
        const ofxTrn = createSampleTransaction({ fitId: "TXN123456" });

        const result = generateImportNote(ofxTrn);

        expect(result).toContain("FITID: TXN123456");
    });

    it("should include original memo if different from name", () => {
        const ofxTrn = createSampleTransaction({
            name: "FARMACIA",
            memo: "COMPRA MEDICAMENTOS"
        });

        const result = generateImportNote(ofxTrn);

        expect(result).toContain("Descrição original: COMPRA MEDICAMENTOS");
    });

    it("should not duplicate memo if same as name", () => {
        const ofxTrn = createSampleTransaction({
            name: "FARMACIA",
            memo: "FARMACIA"
        });

        const result = generateImportNote(ofxTrn);

        // Should only appear once (not include memo since it matches name)
        expect(result).toContain("FITID:");
        expect(result).not.toContain("Descrição original:");
    });

    it("should include check number if available", () => {
        const ofxTrn = createSampleTransaction({ checkNumber: "12345" });

        const result = generateImportNote(ofxTrn);

        expect(result).toContain("Cheque: 12345");
    });

    it("should include reference number if available", () => {
        const ofxTrn = createSampleTransaction({ referenceNumber: "REF789" });

        const result = generateImportNote(ofxTrn);

        expect(result).toContain("Ref: REF789");
    });
});

describe("mapOfxTransactionsToLancamentos", () => {
    it("should map array of transactions", () => {
        const transactions = [
            createSampleTransaction({ fitId: "TXN1" }),
            createSampleTransaction({ fitId: "TXN2" }),
            createSampleTransaction({ fitId: "TXN3" }),
        ];

        const result = mapOfxTransactionsToLancamentos(transactions);

        expect(result).toHaveLength(3);
        expect(result[0].fitId).toBe("TXN1");
        expect(result[1].fitId).toBe("TXN2");
        expect(result[2].fitId).toBe("TXN3");
    });

    it("should handle empty array", () => {
        const result = mapOfxTransactionsToLancamentos([]);

        expect(result).toHaveLength(0);
    });
});

/**
 * Helper function to create sample OFX transaction for testing
 */
function createSampleTransaction(overrides: Partial<OfxTransaction> = {}): OfxTransaction {
    return {
        type: "DEBIT",
        datePosted: new Date(2023, 11, 15),
        amount: -100.00,
        fitId: "TXN123456",
        name: "MERCADO ABC",
        memo: "COMPRA DEBITO",
        ...overrides,
    };
}
