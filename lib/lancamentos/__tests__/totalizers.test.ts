import { calculateTotalizers, type TotalizerData } from "../totalizers";
import type { LancamentoItem } from "@/components/lancamentos/types";

describe("calculateTotalizers", () => {
    const createMockLancamento = (
        overrides?: Partial<LancamentoItem>
    ): LancamentoItem => ({
        id: "test-id",
        name: "Test Transaction",
        purchaseDate: "2024-12-14",
        period: "2024-12",
        transactionType: "Despesa",
        amount: 100,
        condition: "Realizado",
        paymentMethod: "Dinheiro",
        pagadorId: null,
        pagadorName: null,
        pagadorAvatar: null,
        pagadorRole: null,
        contaId: null,
        contaName: null,
        contaLogo: null,
        cartaoId: null,
        cartaoName: null,
        cartaoLogo: null,
        categoriaId: null,
        categoriaName: null,
        categoriaType: null,
        categoriaIcon: null,
        installmentCount: null,
        recurrenceCount: null,
        currentInstallment: null,
        dueDate: null,
        boletoPaymentDate: null,
        note: null,
        isSettled: false,
        isDivided: false,
        isAnticipated: false,
        anticipationId: null,
        seriesId: null,
        ...overrides,
    });

    describe("with empty array", () => {
        it("returns all zeros", () => {
            const result = calculateTotalizers([]);

            expect(result).toEqual({
                totalIncome: 0,
                totalExpenses: 0,
                netTotal: 0,
            });
        });
    });

    describe("with single transaction", () => {
        it("calculates totals for single expense", () => {
            const lancamento = createMockLancamento({
                transactionType: "Despesa",
                amount: 150,
            });

            const result = calculateTotalizers([lancamento]);

            expect(result).toEqual({
                totalIncome: 0,
                totalExpenses: 150,
                netTotal: -150,
            });
        });

        it("calculates totals for single income", () => {
            const lancamento = createMockLancamento({
                transactionType: "Receita",
                amount: 500,
            });

            const result = calculateTotalizers([lancamento]);

            expect(result).toEqual({
                totalIncome: 500,
                totalExpenses: 0,
                netTotal: 500,
            });
        });

        it("ignores single transfer", () => {
            const lancamento = createMockLancamento({
                transactionType: "Transferência",
                amount: 1000,
            });

            const result = calculateTotalizers([lancamento]);

            expect(result).toEqual({
                totalIncome: 0,
                totalExpenses: 0,
                netTotal: 0,
            });
        });
    });

    describe("with multiple transactions", () => {
        it("sums multiple expenses correctly", () => {
            const lancamentos = [
                createMockLancamento({ transactionType: "Despesa", amount: 100 }),
                createMockLancamento({ transactionType: "Despesa", amount: 200 }),
                createMockLancamento({ transactionType: "Despesa", amount: 50 }),
            ];

            const result = calculateTotalizers(lancamentos);

            expect(result).toEqual({
                totalIncome: 0,
                totalExpenses: 350,
                netTotal: -350,
            });
        });

        it("sums multiple incomes correctly", () => {
            const lancamentos = [
                createMockLancamento({ transactionType: "Receita", amount: 1000 }),
                createMockLancamento({ transactionType: "Receita", amount: 500 }),
                createMockLancamento({ transactionType: "Receita", amount: 250 }),
            ];

            const result = calculateTotalizers(lancamentos);

            expect(result).toEqual({
                totalIncome: 1750,
                totalExpenses: 0,
                netTotal: 1750,
            });
        });

        it("calculates mixed transactions correctly", () => {
            const lancamentos = [
                createMockLancamento({ transactionType: "Receita", amount: 2000 }),
                createMockLancamento({ transactionType: "Despesa", amount: 500 }),
                createMockLancamento({ transactionType: "Receita", amount: 1000 }),
                createMockLancamento({ transactionType: "Despesa", amount: 300 }),
            ];

            const result = calculateTotalizers(lancamentos);

            expect(result).toEqual({
                totalIncome: 3000,
                totalExpenses: 800,
                netTotal: 2200,
            });
        });

        it("ignores transfers in mixed transactions", () => {
            const lancamentos = [
                createMockLancamento({ transactionType: "Receita", amount: 1000 }),
                createMockLancamento({ transactionType: "Transferência", amount: 500 }),
                createMockLancamento({ transactionType: "Despesa", amount: 200 }),
                createMockLancamento({ transactionType: "Transferência", amount: 300 }),
            ];

            const result = calculateTotalizers(lancamentos);

            expect(result).toEqual({
                totalIncome: 1000,
                totalExpenses: 200,
                netTotal: 800,
            });
        });
    });

    describe("amount handling", () => {
        it("uses absolute value for negative amounts", () => {
            const lancamentos = [
                createMockLancamento({ transactionType: "Despesa", amount: -150 }),
                createMockLancamento({ transactionType: "Receita", amount: -500 }),
            ];

            const result = calculateTotalizers(lancamentos);

            expect(result).toEqual({
                totalIncome: 500,
                totalExpenses: 150,
                netTotal: 350,
            });
        });

        it("handles zero amounts correctly", () => {
            const lancamentos = [
                createMockLancamento({ transactionType: "Despesa", amount: 0 }),
                createMockLancamento({ transactionType: "Receita", amount: 100 }),
            ];

            const result = calculateTotalizers(lancamentos);

            expect(result).toEqual({
                totalIncome: 100,
                totalExpenses: 0,
                netTotal: 100,
            });
        });

        it("handles decimal amounts correctly", () => {
            const lancamentos = [
                createMockLancamento({ transactionType: "Despesa", amount: 99.99 }),
                createMockLancamento({ transactionType: "Receita", amount: 150.5 }),
            ];

            const result = calculateTotalizers(lancamentos);

            expect(result.totalIncome).toBeCloseTo(150.5, 2);
            expect(result.totalExpenses).toBeCloseTo(99.99, 2);
            expect(result.netTotal).toBeCloseTo(50.51, 2);
        });

        it("handles very large amounts", () => {
            const lancamentos = [
                createMockLancamento({
                    transactionType: "Receita",
                    amount: 9999999.99,
                }),
                createMockLancamento({
                    transactionType: "Despesa",
                    amount: 5000000.5,
                }),
            ];

            const result = calculateTotalizers(lancamentos);

            expect(result.totalIncome).toBeCloseTo(9999999.99, 2);
            expect(result.totalExpenses).toBeCloseTo(5000000.5, 2);
            expect(result.netTotal).toBeCloseTo(4999999.49, 2);
        });
    });

    describe("edge cases", () => {
        it("handles unknown transaction types gracefully", () => {
            const lancamentos = [
                createMockLancamento({
                    transactionType: "UnknownType" as any,
                    amount: 100,
                }),
                createMockLancamento({ transactionType: "Receita", amount: 500 }),
            ];

            const result = calculateTotalizers(lancamentos);

            expect(result).toEqual({
                totalIncome: 500,
                totalExpenses: 0,
                netTotal: 500,
            });
        });

        it("calculates net total with more expenses than income", () => {
            const lancamentos = [
                createMockLancamento({ transactionType: "Receita", amount: 1000 }),
                createMockLancamento({ transactionType: "Despesa", amount: 2000 }),
            ];

            const result = calculateTotalizers(lancamentos);

            expect(result).toEqual({
                totalIncome: 1000,
                totalExpenses: 2000,
                netTotal: -1000,
            });
        });

        it("returns correct type", () => {
            const result = calculateTotalizers([]);

            expect(result).toHaveProperty("totalIncome");
            expect(result).toHaveProperty("totalExpenses");
            expect(result).toHaveProperty("netTotal");

            expect(typeof result.totalIncome).toBe("number");
            expect(typeof result.totalExpenses).toBe("number");
            expect(typeof result.netTotal).toBe("number");
        });
    });
});
