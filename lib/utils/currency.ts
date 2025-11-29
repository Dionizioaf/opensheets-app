/**
 * Converts an amount from one currency to another using a given exchange rate.
 * @param amount - The amount to convert
 * @param fromCurrency - The source currency code (e.g., 'USD')
 * @param toCurrency - The target currency code (e.g., 'BRL')
 * @param exchangeRate - The exchange rate (target per source, e.g., 5.0 means 1 USD = 5 BRL)
 * @returns The converted amount
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRate: number
): number {
  if (fromCurrency === toCurrency) return amount;
  if (!exchangeRate || isNaN(exchangeRate) || exchangeRate <= 0) {
    throw new Error("Invalid exchange rate");
  }
  return Math.round((amount * exchangeRate) * 100) / 100;
}

/**
 * Example: getExchangeRate('USD', 'BRL')
 * In production, this should fetch from a reliable API or cache.
 * For now, returns a fixed value for demonstration.
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  // TODO: Integrate with a real exchange rate API (e.g., exchangerate.host, openexchangerates.org)
  if (fromCurrency === toCurrency) return 1;
  // Example: USD to BRL
  if (fromCurrency === 'USD' && toCurrency === 'BRL') return 5.0;
  // Example: EUR to BRL
  if (fromCurrency === 'EUR' && toCurrency === 'BRL') return 6.0;
  // Add more as needed
  throw new Error(`Exchange rate not available for ${fromCurrency} to ${toCurrency}`);
}
/**
 * Utility functions for currency/decimal formatting and parsing
 */

/**
 * Formats a decimal number for database storage (2 decimal places)
 * @param value - The number to format
 * @returns Formatted string with 2 decimal places, or null if input is null
 */
export function formatDecimalForDb(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return (Math.round(value * 100) / 100).toFixed(2);
}

/**
 * Formats a decimal number for database storage (non-nullable version)
 * @param value - The number to format
 * @returns Formatted string with 2 decimal places
 */
export function formatDecimalForDbRequired(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/**
 * Normalizes decimal input by replacing comma with period
 * @param value - Input string
 * @returns Normalized string with period as decimal separator
 */
export function normalizeDecimalInput(value: string): string {
  return value.replace(/\s/g, "").replace(",", ".");
}

/**
 * Formats a limit/balance input for display
 * @param value - The number to format
 * @returns Formatted string or empty string
 */
export function formatLimitInput(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }

  return (Math.round(value * 100) / 100).toFixed(2);
}

/**
 * Formats an initial balance input for display (defaults to "0.00")
 * @param value - The number to format
 * @returns Formatted string with default "0.00"
 */
export function formatInitialBalanceInput(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0.00";
  }

  return (Math.round(value * 100) / 100).toFixed(2);
}
