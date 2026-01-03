# PRD: Transactions Screen - Column Visibility & Totalizer

## Introduction/Overview

This PRD covers two interconnected enhancements to the transactions screen in Opensheets:

1. **Customizable Column Display:** Allow users to dynamically show/hide columns (including the transaction category) and reorder them via drag-and-drop, with preferences persisted in browser localStorage.
2. **Filter Totalizer:** Display a real-time summary widget at the top of the transactions table showing Total Income, Total Expenses, and Net Total, respecting all active filters.

These features enhance user control over data visibility and provide immediate financial insights for the current filtered view.

---

## Goals

1. **Increase data accessibility:** Users can focus on transaction data most relevant to their workflow by customizing visible columns.
2. **Provide quick financial insights:** Display summarized totals for the current filtered view without requiring manual calculations.
3. **Improve UX with persistence:** Remember user column preferences across sessions using browser localStorage.
4. **Enhance visual control:** Allow drag-and-drop column reordering for personalized table layout.

---

## User Stories

- **US1:** As a user, I want to show/hide the category column (and other columns) so that I can see only the data I care about.
- **US2:** As a user, I want my column visibility preferences to be remembered across browser sessions so that I don't have to reconfigure them each time I visit.
- **US3:** As a user, I want to reorder columns by dragging them so that I can arrange the table layout to match my preferences.
- **US4:** As a user, I want to see a summary of income, expenses, and net total for my current filtered transactions so that I can quickly understand the financial impact of my filtered view.
- **US5:** As a user, I want the totalizer to respect all active filters (date, account, category, payer, etc.) so that the summary accurately reflects what I'm viewing.
- **US6:** As a user in privacy mode, I want the totalizer to hide numeric values (like amounts) so that my financial data remains protected in shared environments.

---

## Functional Requirements

### Column Visibility & Reordering

1. **Display all columns by default.** The transactions table must show all available columns on first visit. Available columns include:

   - Date
   - Description/Account
   - Category
   - Payer/Recipient
   - Payment Method
   - Condition (Pending/Settled)
   - Amount
   - Additional columns as they exist in the current implementation

2. **Provide a column selector control.** Add a "Columns" button/icon (e.g., settings icon with column representation) to the transactions table header that opens a menu/dialog allowing users to:

   - Toggle visibility of each column via checkbox
   - See all available columns with current visibility state

3. **Support drag-and-drop column reordering.** Users must be able to:

   - Click and drag column headers to reorder them
   - Drop columns in desired positions
   - See visual feedback during drag operations (highlight drop zone)

4. **Persist column preferences to localStorage.** Store the following data structure in browser localStorage under a key like `lancamentos_column_preferences`:

   - Array of column identifiers in user's preferred order
   - Array of visible (checked) column identifiers
   - Structure should survive browser restart and clearing of session storage

5. **Load column preferences on page load.** On mount of the LancamentosTable component:

   - Retrieve preferences from localStorage
   - Apply saved column order and visibility
   - If no preferences exist, use default (all columns visible in natural order)

6. **Scope:** Preferences are device/browser-specific; do NOT sync to the database.

### Category Column Display

7. **Show transaction category in the table.** Add a "Category" column that displays:

   - Category name if assigned to the transaction
   - Empty cell or placeholder (e.g., "—") if no category is assigned
   - Optionally styled with a badge or color if design guidance specifies

8. **Category should be included in the column selector.** Users can hide/show the category column via the column selector menu.

### Totalizer Widget

9. **Create a totalizer widget positioned above the transactions table.** The widget must:

   - Display prominently at the top of the table (above filters, or in a dedicated row)
   - Show three separate values: Total Income, Total Expenses, Net Total
   - Format all currency values according to app settings (e.g., "R$ 1.234,56")

10. **Calculate totals based on current filters.** The totalizer must:

    - Respect all active filters (date range, accounts, categories, payers, payment methods, etc.)
    - Sum only transactions matching the current filter criteria
    - Categorize transactions as income (positive amount) or expenses (negative amount)
    - Update in real-time if filters change

11. **Apply privacy mode to the totalizer.** When privacy mode is enabled:

    - Hide numeric values in the totalizer (replace with "•••" or similar)
    - Keep labels visible (e.g., "Total Income: •••")
    - Respect the existing privacy mode implementation in the app

12. **Styling and layout.** The totalizer should:
    - Use existing card/widget styling from the app (e.g., `widget-card`, `Card` components)
    - Display totals in a clear, readable layout (side-by-side or stacked)
    - Be visually distinct from the transactions table
    - Integrate with the existing Tailwind CSS theme

---

## Non-Goals (Out of Scope)

- **Server-side persistence:** Do NOT sync column preferences to the database or user profile.
- **Export column preferences:** Users cannot export/import settings; preferences are local only.
- **Column grouping:** Grouping related columns is not included.
- **Advanced filtering UI:** The totalizer does not add new filters; it only summarizes existing ones.
- **Mobile-specific layout:** Drag-and-drop reordering may be limited on mobile (acceptable fallback to show/hide only).
- **Historical totalizers:** Displaying totals per time period within the view is out of scope.

---

## Design Considerations

### Current Components to Leverage

- **LancamentosTable:** [components/lancamentos/table/lancamentos-table.tsx](components/lancamentos/table/lancamentos-table.tsx) — Main table component using TanStack React Table.
- **Existing UI library:** shadcn/ui components (`Button`, `Card`, `Checkbox`, `DropdownMenu`, etc.) should be used for consistency.
- **Filters component:** [components/lancamentos/table/lancamentos-filters.tsx](components/lancamentos/table/lancamentos-filters.tsx) — Understand current filter integration.
- **Privacy mode:** Leverage existing privacy mode provider/hooks (e.g., `PrivacyProvider`) to conditionally hide totals.
- **MoneyValues component:** [components/money-values.tsx](components/money-values.tsx) — Use for consistent currency formatting.

### UI Mockup Notes

- **Column Selector:** A dropdown menu button in the table header (top-right or alongside existing controls) with a checklist of columns.
- **Drag Handle:** Small grab icon (≡ or ⋮⋮) next to or within column headers to indicate reorderability.
- **Totalizer:** A card widget at the top of the table with three sections showing Income, Expenses, and Net Total. Consider a layout like:
  ```
  Total Income: R$ 5.000,00 | Total Expenses: R$ 2.000,00 | Net Total: R$ 3.000,00
  ```

---

## Technical Considerations

### Storage Implementation

- **Key:** `lancamentos_column_preferences`
- **Format:** JSON object with structure:
  ```json
  {
    "visibleColumns": [
      "date",
      "description",
      "category",
      "payer",
      "paymentMethod",
      "amount"
    ],
    "columnOrder": [
      "date",
      "description",
      "category",
      "payer",
      "paymentMethod",
      "amount"
    ]
  }
  ```
- **Hook or utility:** Create a `useColumnPreferences()` hook in `hooks/` to handle read/write operations.

### Calculating Totals

- **Logic location:** Create a utility function in `lib/lancamentos/` (e.g., `lib/lancamentos/totalizers.ts`) to calculate income, expenses, and net total.
- **Input:** Already-filtered `LancamentoItem[]` array from the page props.
- **Output:** Object with `{ totalIncome: string, totalExpenses: string, netTotal: string }` (as decimal strings to maintain precision).
- **Currency handling:** Convert numeric totals to proper currency strings (e.g., "R$ 1.234,56") using existing utilities like `formatCurrency()`.

### Component Structure

- **New component:** `components/lancamentos/totalizer/lancamentos-totalizer.tsx` — Display the totalizer widget.
- **Column selector component:** `components/lancamentos/table/column-selector.tsx` — Dropdown menu for column visibility/reordering.
- **Enhanced table columns:** Modify `buildColumns()` function in `lancamentos-table.tsx` to include a new "Category" column definition.

### React Table Integration

- **TanStack React Table** already supports `ColumnDef` customization. Add category column as a new `ColumnDef`.
- **Reordering:** Implement via `react-dnd` or similar drag-and-drop library, or use TanStack Table's column pinning/visibility APIs combined with custom reordering logic.
- **Visibility state:** Store column visibility in local state synchronized with localStorage.

### Privacy Mode Integration

- Assume a `usePrivacyMode()` hook exists. Use it in the totalizer component to conditionally render values.

### No Database Changes Required

- The feature is purely client-side; no new database fields, tables, or migrations are needed.

---

## Success Metrics

1. **User adoption:** At least 50% of active users interact with the column selector within 30 days of release.
2. **Performance:** Column preference operations (read/write to localStorage) complete in < 50ms.
3. **Data accuracy:** Totalizer values match manual sum of filtered transactions 100% of the time.
4. **User satisfaction:** Positive feedback in-app surveys regarding column customization and totalizer usefulness.
5. **Privacy compliance:** Zero reports of financial data leakage when privacy mode is enabled on the totalizer.

---

## Open Questions

1. **Drag-and-drop library:** Should we use `react-dnd`, `dnd-kit`, or implement custom reordering with React Table's built-in APIs?
   NO
2. **Totalizer persistence:** Should users be able to collapse/expand the totalizer, with that preference also saved to localStorage?
   YES
3. **Mobile behavior:** Should drag-and-drop column reordering be disabled on mobile, with only show/hide available?
   YES
4. **Column reset:** Should there be a "Reset to Default" button to restore all columns and their default order?
   YES
5. **Multi-currency:** If the app supports transactions in multiple currencies, how should the totalizer handle mixed-currency sums?
   Only 1 currency is supported currently.

---

## Implementation Notes for Developer

- Start with localStorage hook and utility functions to avoid blocking UI development.
- Build the totalizer component independently and test with mock data before integrating with real filters.
- Incrementally add columns to the selector to ensure the reordering mechanism works smoothly.
- Test localStorage persistence across browser sessions and private/incognito windows.
- Verify totalizer accuracy by comparing with manual transaction sums in various filter combinations.
- Ensure privacy mode is applied consistently to all numeric values in the totalizer.
