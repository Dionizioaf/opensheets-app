import { renderHook, act } from "@testing-library/react";
import {
    useColumnPreferences,
    getColumnPreferences,
    setColumnPreferences,
    LANCAMENTOS_COLUMN_PREFERENCES_KEY,
    type ColumnPreferences,
} from "../use-column-preferences";

describe("useColumnPreferences", () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        jest.clearAllMocks();
    });

    describe("getColumnPreferences", () => {
        it("returns null when localStorage is empty", () => {
            const result = getColumnPreferences();
            expect(result).toBeNull();
        });

        it("returns parsed preferences from localStorage", () => {
            const testPreferences: ColumnPreferences = {
                visibleColumns: ["select", "name", "amount"],
                columnOrder: ["select", "name", "amount"],
            };

            localStorage.setItem(
                LANCAMENTOS_COLUMN_PREFERENCES_KEY,
                JSON.stringify(testPreferences)
            );

            const result = getColumnPreferences();
            expect(result).toEqual(testPreferences);
        });

        it("returns null and logs error when JSON is invalid", () => {
            const consoleSpy = jest.spyOn(console, "error").mockImplementation();

            localStorage.setItem(LANCAMENTOS_COLUMN_PREFERENCES_KEY, "invalid json");

            const result = getColumnPreferences();
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe("setColumnPreferences", () => {
        it("stores preferences to localStorage", () => {
            const testPreferences: ColumnPreferences = {
                visibleColumns: ["select", "name"],
                columnOrder: ["select", "name"],
            };

            setColumnPreferences(testPreferences);

            const stored = localStorage.getItem(LANCAMENTOS_COLUMN_PREFERENCES_KEY);
            expect(stored).toBe(JSON.stringify(testPreferences));
        });

        it("throws error when quota is exceeded", () => {
            const testPreferences: ColumnPreferences = {
                visibleColumns: ["select", "name"],
                columnOrder: ["select", "name"],
            };

            // Mock localStorage.setItem to throw QuotaExceededError
            const quotaError = new Error("QuotaExceededError");
            quotaError.name = "QuotaExceededError";
            jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw quotaError;
            });

            expect(() => setColumnPreferences(testPreferences)).toThrow();

            jest.spyOn(Storage.prototype, "setItem").mockRestore();
        });
    });

    describe("useColumnPreferences hook", () => {
        it("initializes with default preferences when localStorage is empty", async () => {
            const { result } = renderHook(() => useColumnPreferences());

            // Wait for hydration
            await act(async () => {
                // hydration happens on mount
            });

            expect(result.current.isHydrated).toBe(true);
            expect(result.current.preferences.visibleColumns).toContain("select");
            expect(result.current.preferences.visibleColumns).toContain("categoria");
            expect(result.current.error).toBeNull();
        });

        it("loads preferences from localStorage on mount", async () => {
            const testPreferences: ColumnPreferences = {
                visibleColumns: ["select", "name", "amount"],
                columnOrder: ["select", "name", "amount"],
            };

            localStorage.setItem(
                LANCAMENTOS_COLUMN_PREFERENCES_KEY,
                JSON.stringify(testPreferences)
            );

            const { result } = renderHook(() => useColumnPreferences());

            await act(async () => {
                // wait for hydration
            });

            expect(result.current.preferences).toEqual(testPreferences);
            expect(result.current.isHydrated).toBe(true);
        });

        it("updatePreferences updates state and localStorage", async () => {
            const { result } = renderHook(() => useColumnPreferences());

            await act(async () => {
                // wait for hydration
            });

            const newPreferences: ColumnPreferences = {
                visibleColumns: ["select", "amount"],
                columnOrder: ["select", "amount"],
            };

            await act(async () => {
                result.current.updatePreferences(newPreferences);
            });

            expect(result.current.preferences).toEqual(newPreferences);

            const stored = getColumnPreferences();
            expect(stored).toEqual(newPreferences);
        });

        it("resetToDefault clears localStorage and restores defaults", async () => {
            const testPreferences: ColumnPreferences = {
                visibleColumns: ["select"],
                columnOrder: ["select"],
            };

            localStorage.setItem(
                LANCAMENTOS_COLUMN_PREFERENCES_KEY,
                JSON.stringify(testPreferences)
            );

            const { result } = renderHook(() => useColumnPreferences());

            await act(async () => {
                // wait for hydration
            });

            // Verify initial state matches stored
            expect(result.current.preferences).toEqual(testPreferences);

            // Reset
            await act(async () => {
                result.current.resetToDefault();
            });

            // Verify defaults restored and localStorage cleared
            expect(localStorage.getItem(LANCAMENTOS_COLUMN_PREFERENCES_KEY)).toBeNull();
            expect(result.current.preferences.visibleColumns).toContain("categoria");
        });

        it("sets error when updatePreferences fails", async () => {
            const { result } = renderHook(() => useColumnPreferences());

            await act(async () => {
                // wait for hydration
            });

            // Mock setColumnPreferences to throw
            jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw new Error("Storage error");
            });

            const newPreferences: ColumnPreferences = {
                visibleColumns: ["select"],
                columnOrder: ["select"],
            };

            await act(async () => {
                result.current.updatePreferences(newPreferences);
            });

            expect(result.current.error).toBeTruthy();

            jest.spyOn(Storage.prototype, "setItem").mockRestore();
        });

        it("clears error when updatePreferences succeeds after error", async () => {
            const { result } = renderHook(() => useColumnPreferences());

            await act(async () => {
                // wait for hydration
            });

            // First, cause an error
            jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw new Error("Storage error");
            });

            const newPreferences: ColumnPreferences = {
                visibleColumns: ["select"],
                columnOrder: ["select"],
            };

            await act(async () => {
                result.current.updatePreferences(newPreferences);
            });

            expect(result.current.error).toBeTruthy();

            // Restore normal behavior
            jest.spyOn(Storage.prototype, "setItem").mockRestore();

            // Try again - should succeed and clear error
            await act(async () => {
                result.current.updatePreferences(newPreferences);
            });

            expect(result.current.error).toBeNull();
        });
    });
});
