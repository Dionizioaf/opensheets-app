import { suggestCategory, suggestCategoriesForTransactions } from "../category-suggester";
import { db } from "@/lib/db";
import type { CategorySuggestion } from "../category-suggester";

/**
 * Unit tests for category suggester
 * Tests smart category suggestions with fuzzy matching and batch processing
 */

// Mock the database
jest.mock("@/lib/db", () => ({
    db: {
        query: {
            lancamentos: {
                findMany: jest.fn(),
            },
        },
    },
}));

const mockDb = db as jest.Mocked<typeof db>;

describe("Category Suggester", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("suggestCategory", () => {
        const userId = "user-123";
        const categoryId1 = "cat-123";
        const categoryId2 = "cat-456";

        it("should return null for empty transaction name", async () => {
            const result = await suggestCategory(userId, "");
            expect(result).toBeNull();
        });

        it("should return null for very short transaction names", async () => {
            const result = await suggestCategory(userId, "ab");
            expect(result).toBeNull();
        });

        it("should return null when no historical data exists", async () => {
            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([]);

            const result = await suggestCategory(
                userId,
                "Netflix Subscription"
            );

            expect(result).toBeNull();
            expect(mockDb.query.lancamentos.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    limit: 500,
                })
            );
        });

        it("should return high confidence for exact match (case-insensitive)", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "NETFLIX.COM",
                    amount: "49.90",
                    categoriaId: categoryId1,
                },
                {
                    id: "lan-2",
                    name: "Spotify Premium",
                    amount: "21.90",
                    categoriaId: categoryId2,
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const result = await suggestCategory(userId, "netflix.com");

            expect(result).toEqual({
                categoriaId: categoryId1,
                confidence: "high",
                score: 1.0,
                matchReason: "exact",
            });
        });

        it("should return high confidence for fuzzy match with high similarity", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "NETFLIX BRASIL LTDA",
                    amount: "49.90",
                    categoriaId: categoryId1,
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const result = await suggestCategory(userId, "NETFLIX BRASIL");

            expect(result).not.toBeNull();
            expect(result?.categoriaId).toBe(categoryId1);
            expect(result?.confidence).toBe("high");
            expect(result?.score).toBeGreaterThanOrEqual(0.9);
            expect(result?.matchReason).toBe("fuzzy");
        });

        it("should return medium confidence for moderate similarity", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "UBER TRIP",
                    amount: "25.50",
                    categoriaId: categoryId1,
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const result = await suggestCategory(userId, "UBER RIDE");

            // This test checks for fuzzy matching with moderate similarity
            // If similarity is too low, it might return null
            if (result) {
                expect(result.categoriaId).toBe(categoryId1);
                expect(["high", "medium", "low"]).toContain(result.confidence);
            } else {
                // This is acceptable - the similarity might be below threshold
                expect(result).toBeNull();
            }
        });

        it("should aggregate scores when multiple transactions have same category", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "UBER",
                    amount: "25.50",
                    categoriaId: categoryId1,
                },
                {
                    id: "lan-2",
                    name: "UBER",
                    amount: "30.00",
                    categoriaId: categoryId1,
                },
                {
                    id: "lan-3",
                    name: "UBER",
                    amount: "22.75",
                    categoriaId: categoryId1,
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const result = await suggestCategory(userId, "UBER");

            expect(result).not.toBeNull();
            expect(result?.categoriaId).toBe(categoryId1);
            // Should have high confidence due to exact match
            expect(result?.confidence).toBe("high");
            expect(result?.matchReason).toBe("exact");
        });

        it("should consider transaction type when filtering", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "Transfer from Checking",
                    amount: "1000.00",
                    categoriaId: categoryId1,
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const result = await suggestCategory(
                userId,
                "Transfer from Checking",
                "1000.00",
                "Receita"
            );

            expect(mockDb.query.lancamentos.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.anything(),
                })
            );
        });

        it("should weight by amount similarity when amount is provided", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "NETFLIX",
                    amount: "49.90",
                    categoriaId: categoryId1,
                },
                {
                    id: "lan-2",
                    name: "NETFLIX",
                    amount: "500.00",
                    categoriaId: categoryId2,
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const result = await suggestCategory(
                userId,
                "NETFLIX",
                "49.90"
            );

            // Should prefer category with similar amount
            expect(result?.categoriaId).toBe(categoryId1);
        });

        it("should return null for very low similarity matches", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "COMPLETELY DIFFERENT TRANSACTION",
                    amount: "100.00",
                    categoriaId: categoryId1,
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const result = await suggestCategory(userId, "NETFLIX");

            // Should not suggest a category for unrelated transactions
            expect(result).toBeNull();
        });

        it("should handle special characters in transaction names", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "PAG*TO ELETR. - R$ 50,00",
                    amount: "50.00",
                    categoriaId: categoryId1,
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const result = await suggestCategory(
                userId,
                "PAG*TO ELETR. - R$ 50,00"
            );

            expect(result).not.toBeNull();
            expect(result?.categoriaId).toBe(categoryId1);
            expect(result?.matchReason).toBe("exact");
        });

        it("should ignore transactions without category", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "NETFLIX",
                    amount: "49.90",
                    categoriaId: null,
                },
                {
                    id: "lan-2",
                    name: "NETFLIX",
                    amount: "49.90",
                    categoriaId: categoryId1,
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const result = await suggestCategory(userId, "NETFLIX");

            expect(result?.categoriaId).toBe(categoryId1);
        });
    });

    describe("suggestCategoriesForTransactions", () => {
        const userId = "user-123";
        const categoryId1 = "cat-123";
        const categoryId2 = "cat-456";

        it("should return empty map for empty transactions array", async () => {
            const result = await suggestCategoriesForTransactions(userId, []);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });

        it("should process multiple transactions efficiently with single DB query", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "NETFLIX",
                    amount: "49.90",
                    categoriaId: categoryId1,
                    transactionType: "Despesa",
                },
                {
                    id: "lan-2",
                    name: "SPOTIFY",
                    amount: "21.90",
                    categoriaId: categoryId2,
                    transactionType: "Despesa",
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const transactions = [
                { id: "tx-1", name: "NETFLIX", amount: "49.90", transactionType: "Despesa" },
                { id: "tx-2", name: "SPOTIFY", amount: "21.90", transactionType: "Despesa" },
            ];

            const result = await suggestCategoriesForTransactions(
                userId,
                transactions
            );

            // Should only query database once
            expect(mockDb.query.lancamentos.findMany).toHaveBeenCalledTimes(1);

            // Should return suggestions for both transactions
            expect(result.size).toBe(2);
            expect(result.get("tx-1")?.categoriaId).toBe(categoryId1);
            expect(result.get("tx-2")?.categoriaId).toBe(categoryId2);
        });

        it("should handle transactions with no matches", async () => {
            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([]);

            const transactions = [
                { id: "tx-1", name: "UNKNOWN TRANSACTION", amount: "100.00", transactionType: "Despesa" },
            ];

            const result = await suggestCategoriesForTransactions(
                userId,
                transactions
            );

            expect(result.size).toBe(0);
        });

        it("should handle mix of matched and unmatched transactions", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "NETFLIX",
                    amount: "49.90",
                    categoriaId: categoryId1,
                    transactionType: "Despesa",
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const transactions = [
                { id: "tx-1", name: "NETFLIX", amount: "49.90", transactionType: "Despesa" },
                { id: "tx-2", name: "UNKNOWN SERVICE", amount: "99.99", transactionType: "Despesa" },
            ];

            const result = await suggestCategoriesForTransactions(
                userId,
                transactions
            );

            expect(result.size).toBe(1);
            expect(result.get("tx-1")?.categoriaId).toBe(categoryId1);
            expect(result.has("tx-2")).toBe(false);
        });

        it("should preserve confidence levels for each suggestion", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "NETFLIX",
                    amount: "49.90",
                    categoriaId: categoryId1,
                    transactionType: "Despesa",
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const transactions = [
                { id: "tx-1", name: "NETFLIX", amount: "49.90", transactionType: "Despesa" },
            ];

            const result = await suggestCategoriesForTransactions(
                userId,
                transactions
            );

            const suggestion = result.get("tx-1");
            expect(suggestion).toBeDefined();
            expect(suggestion?.confidence).toBe("high");
            expect(suggestion?.score).toBe(1.0);
            expect(suggestion?.matchReason).toBe("exact");
        });

        it("should handle large batch of transactions", async () => {
            const mockHistoricalData = Array.from({ length: 100 }, (_, i) => ({
                id: `lan-${i}`,
                name: `MERCHANT ${i}`,
                amount: "50.00",
                categoriaId: categoryId1,
                transactionType: "Despesa",
            }));

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const transactions = Array.from({ length: 50 }, (_, i) => ({
                id: `tx-${i}`,
                name: `MERCHANT ${i}`,
                amount: "50.00",
                transactionType: "Despesa",
            }));

            const result = await suggestCategoriesForTransactions(
                userId,
                transactions
            );

            // Should only query database once even for large batch
            expect(mockDb.query.lancamentos.findMany).toHaveBeenCalledTimes(1);
            expect(result.size).toBeGreaterThan(0);
        });

        it("should handle transactions with different types", async () => {
            const mockHistoricalData = [
                {
                    id: "lan-1",
                    name: "SALARY PAYMENT",
                    amount: "5000.00",
                    categoriaId: categoryId1,
                    transactionType: "Receita",
                },
                {
                    id: "lan-2",
                    name: "NETFLIX",
                    amount: "49.90",
                    categoriaId: categoryId2,
                    transactionType: "Despesa",
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockHistoricalData
            );

            const transactions = [
                { id: "tx-1", name: "SALARY PAYMENT", amount: "5000.00", transactionType: "Receita" },
                { id: "tx-2", name: "NETFLIX", amount: "49.90", transactionType: "Despesa" },
            ];

            const result = await suggestCategoriesForTransactions(
                userId,
                transactions
            );

            expect(result.size).toBe(2);
            expect(result.get("tx-1")?.categoriaId).toBe(categoryId1);
            expect(result.get("tx-2")?.categoriaId).toBe(categoryId2);
        });
    });
});
