import {
    detectDuplicates,
    checkTransactionForDuplicates,
} from "../duplicate-detector";
import { db } from "@/lib/db";
import type { DuplicateMatch } from "../duplicate-detector";

/**
 * Unit tests for duplicate detector
 * Tests various edge cases including FITID matching, date tolerance, amount matching, and description similarity
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

describe("Duplicate Detector", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("detectDuplicates", () => {
        const userId = "user-123";
        const contaId = "conta-123";
        const transactionDate = new Date("2024-01-15");

        it("should return empty array for very short transaction names", async () => {
            const result = await detectDuplicates(
                userId,
                contaId,
                "ab",
                "100.00",
                transactionDate
            );

            expect(result).toEqual([]);
        });

        it("should return empty array when no existing transactions match", async () => {
            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate
            );

            expect(result).toEqual([]);
        });

        it("should detect FITID match as highest priority", async () => {
            const fitId = "UNIQUE123456";
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX SUBSCRIPTION",
                amount: "49.90",
                purchaseDate: new Date("2024-01-14"),
                note: `Imported via OFX. FITID: ${fitId}`,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX SUBSCRIPTION",
                "49.90",
                transactionDate,
                fitId
            );

            expect(result).toHaveLength(1);
            expect(result[0].matchReason).toBe("fitid");
            expect(result[0].similarity).toBe(1.0);
            expect(result[0].lancamentoId).toBe("lan-1");
        });

        it("should detect exact match (same date, amount, and name)", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX",
                amount: "49.90",
                purchaseDate: transactionDate,
                note: null,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate
            );

            expect(result).toHaveLength(1);
            expect(result[0].matchReason).toBe("exact");
            expect(result[0].similarity).toBe(1.0);
            expect(result[0].lancamentoId).toBe("lan-1");
        });

        it("should detect similar match with high similarity (>80%)", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX BRASIL LTDA",
                amount: "49.90",
                purchaseDate: new Date("2024-01-14"), // 1 day before
                note: null,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX BRASIL",
                "49.90",
                transactionDate
            );

            expect(result).toHaveLength(1);
            expect(result[0].matchReason).toBe("similar");
            expect(result[0].similarity).toBeGreaterThanOrEqual(0.8);
            expect(result[0].lancamentoId).toBe("lan-1");
        });

        it("should detect likely match with medium similarity (>60%)", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "UBER RIDE SAO PAULO",
                amount: "25.50",
                purchaseDate: new Date("2024-01-16"), // 1 day after
                note: null,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "UBER RIDE RIO",
                "25.50",
                transactionDate
            );

            // Should find a match with fuzzy similarity
            expect(result.length).toBeGreaterThan(0);
            if (result.length > 0) {
                expect(["similar", "likely"]).toContain(result[0].matchReason);
                expect(result[0].similarity).toBeGreaterThan(0);
            }
        });

        it("should not match transactions outside date tolerance (±3 days)", async () => {
            // The database query already filters by date range, so it would return empty array
            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate
            );

            // Should not match because date is outside tolerance
            expect(result).toEqual([]);
        });

        it("should match transactions within date tolerance (±3 days)", async () => {
            const mockExistingTransactions = [
                {
                    id: "lan-1",
                    name: "NETFLIX",
                    amount: "49.90",
                    purchaseDate: new Date("2024-01-12"), // 3 days before
                    note: null,
                },
                {
                    id: "lan-2",
                    name: "NETFLIX",
                    amount: "49.90",
                    purchaseDate: new Date("2024-01-18"), // 3 days after
                    note: null,
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockExistingTransactions
            );

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate
            );

            expect(result).toHaveLength(2);
        });

        it("should not match transactions with different amounts", async () => {
            // The database query filters by amount using eq(lancamentos.amount, transactionAmount)
            // so transactions with different amounts would not be returned
            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate
            );

            // Should not match due to different amount (filtered by DB query)
            expect(result).toEqual([]);
        });

        it("should not match transactions with very low similarity", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "COMPLETELY DIFFERENT MERCHANT",
                amount: "49.90",
                purchaseDate: transactionDate,
                note: null,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate
            );

            // Should not match due to very different description
            expect(result).toEqual([]);
        });

        it("should handle multiple potential duplicates and sort by match quality", async () => {
            const fitId = "FIT123";
            const mockExistingTransactions = [
                {
                    id: "lan-1",
                    name: "NETFLIX",
                    amount: "49.90",
                    purchaseDate: new Date("2024-01-14"),
                    note: `FITID: ${fitId}`,
                },
                {
                    id: "lan-2",
                    name: "NETFLIX",
                    amount: "49.90",
                    purchaseDate: transactionDate,
                    note: null,
                },
                {
                    id: "lan-3",
                    name: "NETFLIX BRASIL",
                    amount: "49.90",
                    purchaseDate: new Date("2024-01-16"),
                    note: null,
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockExistingTransactions
            );

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate,
                fitId
            );

            expect(result.length).toBeGreaterThan(0);
            // FITID match should be first
            expect(result[0].matchReason).toBe("fitid");
            expect(result[0].lancamentoId).toBe("lan-1");
        });

        it("should handle special characters in transaction names", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "PAG*TO ELETR. - R$ 50,00",
                amount: "50.00",
                purchaseDate: transactionDate,
                note: null,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "PAG*TO ELETR. - R$ 50,00",
                "50.00",
                transactionDate
            );

            expect(result).toHaveLength(1);
            expect(result[0].matchReason).toBe("exact");
        });

        it("should include existing transaction details in match result", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX",
                amount: "49.90",
                purchaseDate: transactionDate,
                note: "Monthly subscription",
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate
            );

            expect(result).toHaveLength(1);
            expect(result[0].existingTransaction.nome).toBe("NETFLIX");
            expect(result[0].existingTransaction.valor).toBe("49.90");
            expect(result[0].existingTransaction.purchaseDate).toEqual(transactionDate);
            expect(result[0].existingTransaction.anotacao).toBe("Monthly subscription");
        });

        it("should handle case-insensitive FITID matching", async () => {
            const fitId = "fit123";
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX",
                amount: "49.90",
                purchaseDate: transactionDate,
                note: "FITID: FIT123", // Different case
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate,
                fitId
            );

            expect(result).toHaveLength(1);
            expect(result[0].matchReason).toBe("fitid");
        });

        it("should query with correct date range calculation", async () => {
            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([]);

            await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate
            );

            // Verify that the query was called with date range
            expect(mockDb.query.lancamentos.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.anything(),
                    limit: 100,
                })
            );
        });
    });

    describe("checkTransactionForDuplicates", () => {
        const userId = "user-123";
        const contaId = "conta-123";
        const transactionDate = new Date("2024-01-15");

        it("should return null when no duplicates found", async () => {
            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([]);

            const result = await checkTransactionForDuplicates(
                userId,
                contaId,
                {
                    nome: "NETFLIX",
                    valor: "49.90",
                    purchaseDate: transactionDate,
                }
            );

            expect(result).toBeNull();
        });

        it("should return the best duplicate match", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX",
                amount: "49.90",
                purchaseDate: transactionDate,
                note: null,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await checkTransactionForDuplicates(
                userId,
                contaId,
                {
                    nome: "NETFLIX",
                    valor: "49.90",
                    purchaseDate: transactionDate,
                }
            );

            expect(result).not.toBeNull();
            expect(result?.isDuplicate).toBe(true);
            expect(result?.bestMatch?.matchReason).toBe("exact");
            expect(result?.bestMatch?.lancamentoId).toBe("lan-1");
        });

        it("should accept optional FITID parameter", async () => {
            const fitId = "FIT123";
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX",
                amount: "49.90",
                purchaseDate: transactionDate,
                note: `FITID: ${fitId}`,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await checkTransactionForDuplicates(
                userId,
                contaId,
                {
                    nome: "NETFLIX",
                    valor: "49.90",
                    purchaseDate: transactionDate,
                    fitId,
                }
            );

            expect(result).not.toBeNull();
            expect(result?.bestMatch?.matchReason).toBe("fitid");
        });

        it("should return highest priority match when multiple duplicates exist", async () => {
            const fitId = "FIT123";
            const mockExistingTransactions = [
                {
                    id: "lan-1",
                    name: "NETFLIX SIMILAR",
                    amount: "49.90",
                    purchaseDate: new Date("2024-01-16"),
                    note: null,
                },
                {
                    id: "lan-2",
                    name: "NETFLIX",
                    amount: "49.90",
                    purchaseDate: transactionDate,
                    note: `FITID: ${fitId}`,
                },
            ];

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce(
                mockExistingTransactions
            );

            const result = await checkTransactionForDuplicates(
                userId,
                contaId,
                {
                    nome: "NETFLIX",
                    valor: "49.90",
                    purchaseDate: transactionDate,
                    fitId,
                }
            );

            // Should return FITID match as highest priority
            expect(result?.bestMatch?.matchReason).toBe("fitid");
            expect(result?.bestMatch?.lancamentoId).toBe("lan-2");
        });

        it("should handle edge case with same date but different times", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX",
                amount: "49.90",
                purchaseDate: new Date("2024-01-15T10:30:00Z"),
                note: null,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await checkTransactionForDuplicates(
                userId,
                contaId,
                {
                    nome: "NETFLIX",
                    valor: "49.90",
                    purchaseDate: new Date("2024-01-15T14:45:00Z"), // Same day, different time
                }
            );

            expect(result).not.toBeNull();
            expect(result?.bestMatch?.matchReason).toBe("exact");
        });

        it("should include similarity score in result", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX BRASIL",
                amount: "49.90",
                purchaseDate: new Date("2024-01-14"),
                note: null,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await checkTransactionForDuplicates(
                userId,
                contaId,
                {
                    nome: "NETFLIX",
                    valor: "49.90",
                    purchaseDate: transactionDate,
                }
            );

            expect(result).not.toBeNull();
            expect(result?.bestMatch?.similarity).toBeGreaterThan(0);
            expect(result?.bestMatch?.similarity).toBeLessThanOrEqual(1);
        });
    });

    describe("Edge Cases", () => {
        const userId = "user-123";
        const contaId = "conta-123";
        const transactionDate = new Date("2024-01-15");

        it("should handle null note field gracefully", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX",
                amount: "49.90",
                purchaseDate: transactionDate,
                note: null,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate
            );

            // Should match as exact match even without FITID
            expect(result).toHaveLength(1);
            expect(result[0].matchReason).toBe("exact");
        });

        it("should handle empty note field", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX",
                amount: "49.90",
                purchaseDate: transactionDate,
                note: "",
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate,
                "FIT123"
            );

            expect(result).toHaveLength(1);
            expect(result[0].matchReason).toBe("exact");
        });

        it("should handle whitespace-only transaction names", async () => {
            const result = await detectDuplicates(
                userId,
                contaId,
                "   ",
                "49.90",
                transactionDate
            );

            expect(result).toEqual([]);
        });

        it("should handle very long transaction names", async () => {
            const longName = "A".repeat(500);
            const mockExistingTransaction = {
                id: "lan-1",
                name: longName,
                amount: "49.90",
                purchaseDate: transactionDate,
                note: null,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                longName,
                "49.90",
                transactionDate
            );

            expect(result).toHaveLength(1);
            expect(result[0].matchReason).toBe("exact");
        });

        it("should handle decimal amounts with different string formats", async () => {
            // The database query uses eq() which does string comparison
            // So "49.90" !== "49.90000", and the query would return no results
            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90000", // Extra zeros
                transactionDate
            );

            // Should not match due to string comparison difference
            expect(result).toEqual([]);
        });

        it("should handle boundary date (exactly 3 days before)", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX",
                amount: "49.90",
                purchaseDate: new Date("2024-01-12"), // Exactly 3 days before
                note: null,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate
            );

            expect(result).toHaveLength(1);
        });

        it("should handle boundary date (exactly 3 days after)", async () => {
            const mockExistingTransaction = {
                id: "lan-1",
                name: "NETFLIX",
                amount: "49.90",
                purchaseDate: new Date("2024-01-18"), // Exactly 3 days after
                note: null,
            };

            mockDb.query.lancamentos.findMany.mockResolvedValueOnce([
                mockExistingTransaction,
            ]);

            const result = await detectDuplicates(
                userId,
                contaId,
                "NETFLIX",
                "49.90",
                transactionDate
            );

            expect(result).toHaveLength(1);
        });
    });
});
