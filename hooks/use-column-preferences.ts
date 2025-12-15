import { useState, useEffect, useCallback } from "react";

/**
 * TypeScript types for column visibility and order preferences
 */
export type ColumnPreferences = {
  visibleColumns: string[];
  columnOrder: string[];
};

/**
 * Default column preferences - all columns visible in natural order
 */
const DEFAULT_PREFERENCES: ColumnPreferences = {
  visibleColumns: [
    "select",
    "purchaseDate",
    "name",
    "transactionType",
    "categoria",
    "amount",
    "condition",
    "paymentMethod",
    "pagadorName",
    "contaCartao",
    "actions",
  ],
  columnOrder: [
    "select",
    "purchaseDate",
    "name",
    "transactionType",
    "categoria",
    "amount",
    "condition",
    "paymentMethod",
    "pagadorName",
    "contaCartao",
    "actions",
  ],
};

/**
 * localStorage key for storing column preferences
 */
export const LANCAMENTOS_COLUMN_PREFERENCES_KEY =
  "lancamentos_column_preferences";

/**
 * Reads column preferences from localStorage
 * @returns ColumnPreferences object or null if not found
 */
export function getColumnPreferences(): ColumnPreferences | null {
  try {
    const stored = localStorage.getItem(LANCAMENTOS_COLUMN_PREFERENCES_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ColumnPreferences;
  } catch (error) {
    console.error("Failed to parse column preferences from localStorage:", error);
    return null;
  }
}

/**
 * Writes column preferences to localStorage
 * @param preferences ColumnPreferences object to store
 * @throws Error if localStorage quota exceeded or other write error
 */
export function setColumnPreferences(preferences: ColumnPreferences): void {
  try {
    localStorage.setItem(
      LANCAMENTOS_COLUMN_PREFERENCES_KEY,
      JSON.stringify(preferences)
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "QuotaExceededError") {
        console.error(
          "localStorage quota exceeded. Cannot save column preferences:",
          error
        );
        throw new Error(
          "Não foi possível salvar as preferências de coluna. Espaço de armazenamento cheio."
        );
      }
    }
    console.error("Failed to write column preferences to localStorage:", error);
    throw error;
  }
}

/**
 * Custom hook for managing column visibility and order preferences
 * Reads from and writes to localStorage, with fallback to defaults
 *
 * @returns Object containing:
 *   - preferences: Current ColumnPreferences state
 *   - updatePreferences: Function to update and persist preferences
 *   - resetToDefault: Function to clear localStorage and reset to defaults
 *
 * @example
 * const { preferences, updatePreferences, resetToDefault } = useColumnPreferences();
 *
 * // Update visible columns
 * updatePreferences({
 *   ...preferences,
 *   visibleColumns: ['select', 'name', 'amount']
 * });
 *
 * // Reset to defaults
 * resetToDefault();
 */
export function useColumnPreferences() {
  const [preferences, setPreferences] = useState<ColumnPreferences>(
    DEFAULT_PREFERENCES
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage on mount
  useEffect(() => {
    try {
      const stored = getColumnPreferences();
      if (stored) {
        setPreferences(stored);
      }
      setIsHydrated(true);
    } catch (err) {
      console.error("Error initializing column preferences:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar preferências de coluna"
      );
      setIsHydrated(true);
    }
  }, []);

  /**
   * Update preferences both in state and localStorage
   */
  const updatePreferences = useCallback((newPreferences: ColumnPreferences) => {
    try {
      setColumnPreferences(newPreferences);
      setPreferences(newPreferences);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Erro ao salvar preferências de coluna";
      setError(errorMessage);
      console.error("Failed to update column preferences:", err);
    }
  }, []);

  /**
   * Reset to default preferences and clear localStorage
   */
  const resetToDefault = useCallback(() => {
    try {
      localStorage.removeItem(LANCAMENTOS_COLUMN_PREFERENCES_KEY);
      setPreferences(DEFAULT_PREFERENCES);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Erro ao restaurar preferências padrão";
      setError(errorMessage);
      console.error("Failed to reset to default preferences:", err);
    }
  }, []);

  return {
    preferences,
    updatePreferences,
    resetToDefault,
    isHydrated,
    error,
  };
}
