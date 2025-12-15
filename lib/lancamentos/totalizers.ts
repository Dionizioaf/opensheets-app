import type { LancamentoItem } from "@/components/lancamentos/types";

/**
 * Calculated totalizer data for income, expenses, and net total
 */
export type TotalizerData = {
    /** Total income amount from all "Receita" transactions */
    totalIncome: number;
    /** Total expenses amount from all "Despesa" transactions */
    totalExpenses: number;
    /** Net total (income - expenses), can be negative */
    netTotal: number;
};

/**
 * Calculates income, expense, and net totals from a list of transactions
 *
 * Separates transactions by type (Receita/Despesa/Transferência) and sums amounts.
 * Ensures all amounts are treated as positive for display.
 *
 * @param lancamentos - Array of transaction items to calculate totals for
 * @returns TotalizerData with totalIncome, totalExpenses, and netTotal
 *
 * @example
 * const data = calculateTotalizers(filteredTransactions);
 * console.log(data);
 * // { totalIncome: 5000, totalExpenses: 2000, netTotal: 3000 }
 */
export function calculateTotalizers(
    lancamentos: LancamentoItem[]
): TotalizerData {
    let totalIncome = 0;
    let totalExpenses = 0;

    // Iterate through transactions and sum based on type
    lancamentos.forEach((lancamento) => {
        const amount = Math.abs(lancamento.amount);

        switch (lancamento.transactionType) {
            case "Receita":
                totalIncome += amount;
                break;
            case "Despesa":
                totalExpenses += amount;
                break;
            // Transferência is not included in either income or expense
            // It's an internal movement between accounts
            case "Transferência":
            default:
                // Do nothing for transfers or unknown types
                break;
        }
    });

    return {
        totalIncome,
        totalExpenses,
        netTotal: totalIncome - totalExpenses,
    };
}
