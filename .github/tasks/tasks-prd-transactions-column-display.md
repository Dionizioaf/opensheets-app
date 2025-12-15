# Task List: Transactions Screen - Column Visibility & Totalizer

## Relevant Files

### Existing Files to Modify

- `components/lancamentos/table/lancamentos-table.tsx` - Main table component using TanStack React Table, will add category column and column visibility/reordering
- `components/lancamentos/types.ts` - Add category icon field to LancamentoItem type
- `components/lancamentos/page/lancamentos-page.tsx` - Main orchestrator, will integrate totalizer widget
- `lib/lancamentos/page-helpers.ts` - May need utility functions for totalizer calculations
- `app/(dashboard)/lancamentos/data.ts` - Ensure category data is fetched with transactions

### New Files Created

- ✅ `hooks/use-column-preferences.ts` - Custom hook for reading/writing column preferences to localStorage
- ✅ `hooks/__tests__/use-column-preferences.test.ts` - Unit tests for localStorage hook
- ✅ `lib/lancamentos/totalizers.ts` - Utility functions to calculate totals from filtered transactions
- ✅ `lib/lancamentos/__tests__/totalizers.test.ts` - Tests for totalizer calculation logic
- ✅ `components/lancamentos/totalizer/lancamentos-totalizer.tsx` - Totalizer widget displaying income/expenses/net total

### New Files to Create

- `components/lancamentos/table/column-selector.tsx` - Dropdown menu for column visibility control
- `components/lancamentos/totalizer/__tests__/lancamentos-totalizer.test.tsx` - Tests for totalizer component
- `components/lancamentos/table/__tests__/column-selector.test.tsx` - Tests for column selector

### Reference Files (for patterns)

- `components/privacy-provider.tsx` - Privacy mode implementation with `usePrivacyMode()` hook
- `components/money-values.tsx` - Currency formatting with privacy mode support
- `hooks/use-mobile.ts` - Pattern for custom hooks
- `components/lancamentos/table/lancamentos-filters.tsx` - Filter component pattern

### Notes

- Unit tests should be placed in `__tests__/` directories alongside the code
- Use `npx jest` to run all tests, `npx jest [path]` for specific files
- Privacy mode hook already exists: `usePrivacyMode()` from `components/privacy-provider.tsx`
- MoneyValues component already handles privacy mode and currency formatting
- TanStack React Table v8 is already in use with column visibility APIs

---

## Tasks

- [x] 1.0 **LocalStorage Hook for Column Preferences**

  - [x] 1.1 Create `hooks/use-column-preferences.ts` file
  - [x] 1.2 Define TypeScript types: `ColumnPreferences` with `visibleColumns: string[]` and `columnOrder: string[]`
  - [x] 1.3 Define localStorage key constant: `LANCAMENTOS_COLUMN_PREFERENCES_KEY = "lancamentos_column_preferences"`
  - [x] 1.4 Implement `getColumnPreferences()` function to read from localStorage, parse JSON, and return typed object or null
  - [x] 1.5 Implement `setColumnPreferences()` function to stringify and write to localStorage with error handling
  - [x] 1.6 Create `useColumnPreferences()` hook using `useState` and `useEffect`
  - [x] 1.7 Initialize state from localStorage on mount, falling back to default values
  - [x] 1.8 Provide `updatePreferences()` function that updates both state and localStorage
  - [x] 1.9 Add try-catch error handling for localStorage quota exceeded scenarios
  - [x] 1.10 Export hook and types from the file

- [x] 2.0 **Totalizer Calculation Utilities**

  - [x] 2.1 Create `lib/lancamentos/totalizers.ts` file
  - [x] 2.2 Define TypeScript type: `TotalizerData` with `totalIncome: number`, `totalExpenses: number`, `netTotal: number`
  - [x] 2.3 Implement `calculateTotalizers(lancamentos: LancamentoItem[]): TotalizerData` function
  - [x] 2.4 Filter lancamentos to separate "Receita" (income) and "Despesa" (expense) by `transactionType`
  - [x] 2.5 Calculate `totalIncome` by summing all income amounts (use `Math.abs()` to ensure positive)
  - [x] 2.6 Calculate `totalExpenses` by summing all expense amounts (use `Math.abs()` to ensure positive)
  - [x] 2.7 Calculate `netTotal` as `totalIncome - totalExpenses` (can be negative)
  - [x] 2.8 Return object with all three calculated values as numbers
  - [x] 2.9 Add JSDoc comments explaining the function and return values
  - [x] 2.10 Export function from the file

- [x] 3.0 **Totalizer Widget Component**

  - [x] 3.1 Create `components/lancamentos/totalizer/` directory
  - [x] 3.2 Create `components/lancamentos/totalizer/lancamentos-totalizer.tsx` file with `"use client"` directive
  - [x] 3.3 Define component props: `totalizerData: TotalizerData`, `isCollapsed?: boolean`, `onToggleCollapse?: () => void`
  - [x] 3.4 Import `usePrivacyMode()` hook from `@/components/privacy-provider`
  - [x] 3.5 Import `MoneyValues` component from `@/components/money-values` for consistent currency formatting
  - [x] 3.6 Import `Card`, `CardContent`, `CardHeader` from shadcn/ui
  - [x] 3.7 Create layout with three sections: Total Income (green), Total Expenses (red), Net Total (blue if positive, red if negative)
  - [x] 3.8 Use `MoneyValues` component for each value (privacy mode handled automatically)
  - [x] 3.9 Add collapse/expand button in header using `RiArrowUpSLine` / `RiArrowDownSLine` icons
  - [x] 3.10 Conditionally render CardContent based on `isCollapsed` prop
  - [x] 3.11 Apply responsive layout: side-by-side on desktop (flex-row), stacked on mobile (flex-col)
  - [x] 3.12 Use Tailwind classes for visual distinction: border colors matching income/expense/net
  - [x] 3.13 Add labels "Receitas", "Despesas", "Saldo" in Portuguese
  - [x] 3.14 Export component as default

- [x] 4.0 **Category Column Addition**

  - [x] 4.1 Open `components/lancamentos/table/lancamentos-table.tsx`
  - [x] 4.2 Verify `LancamentoItem` type includes `categoriaName`, `categoriaIcon` fields (already exists from types.ts)
  - [x] 4.3 In `buildColumns()` function, add new column definition after "Estabelecimento" column
  - [x] 4.4 Set `accessorKey: "categoriaName"` and `header: "Categoria"` and `id: "categoria"`
  - [x] 4.5 Implement cell renderer that checks if `categoriaName` exists
  - [x] 4.6 If category exists, display icon (using `getIconComponent()`) + name in a Badge
  - [x] 4.7 If no category, display "—" placeholder
  - [x] 4.8 Make column hideable by setting `enableHiding: true`
  - [x] 4.9 Add `meta` property with `label: "Categoria"` for display in column selector
  - [x] 4.10 Test category display with transactions that have and don't have categories

- [ ] 5.0 **Column Selector Component**

  - [x] 5.1 Create `components/lancamentos/table/column-selector.tsx` file with `"use client"` directive
  - [x] 5.2 Define props: `table: Table<LancamentoItem>` (from TanStack React Table), `onReset: () => void`
  - [x] 5.3 Import `Button`, `DropdownMenu`, `Checkbox` from shadcn/ui
  - [x] 5.4 Import `RiSettings4Line`, `RiRefreshLine` icons from Remix Icon
  - [x] 5.5 Create DropdownMenu with trigger button showing settings icon and "Colunas" label
  - [x] 5.6 Use `table.getAllColumns()` to get column list, filter out non-hideable columns (select, actions)
  - [x] 5.7 Map each column to a DropdownMenuItem with Checkbox showing visibility state
  - [x] 5.8 Use `column.getIsVisible()` to get current state and `column.toggleVisibility()` to toggle
  - [x] 5.9 Display column label using `column.columnDef.meta?.label` or fallback to `column.id`
  - [x] 5.10 Add separator then "Restaurar padrão" menu item at bottom that calls `onReset()`
  - [x] 5.11 Style menu to be scrollable if many columns (max-h-96)
  - [x] 5.12 Export component as default

- [ ] 6.0 **Column Visibility & Reordering Integration**

  - [ ] 6.1 Open `components/lancamentos/table/lancamentos-table.tsx`
  - [ ] 6.2 Import `useColumnPreferences` hook from `@/hooks/use-column-preferences`
  - [ ] 6.3 In `LancamentosTable` component, call hook to get preferences state and update function
  - [ ] 6.4 Define default column order array with all column IDs in natural order
  - [ ] 6.5 Define default visible columns array with all columns (except internal ones)
  - [ ] 6.6 Add `columnVisibility` state to table using TanStack Table's `onColumnVisibilityChange`
  - [ ] 6.7 Initialize `columnVisibility` from preferences on mount using `useEffect`
  - [ ] 6.8 Sync visibility changes back to localStorage via preferences hook
  - [ ] 6.9 Add `columnOrder` state to table using TanStack Table's `onColumnOrderChange`
  - [ ] 6.10 Initialize `columnOrder` from preferences on mount
  - [ ] 6.11 Sync order changes back to localStorage
  - [ ] 6.12 Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` for drag-and-drop
  - [ ] 6.13 Wrap table headers with `DndContext` from dnd-kit
  - [ ] 6.14 Make each `TableHead` draggable using `useSortable` hook (only on desktop via media query or `useMobile()` hook)
  - [ ] 6.15 Handle `onDragEnd` event to update column order state
  - [ ] 6.16 Show drag handle icon in column headers on hover (desktop only)
  - [ ] 6.17 Implement `resetToDefault()` function that clears localStorage and resets to default visibility/order
  - [ ] 6.18 Pass table instance and reset function to `ColumnSelector` component

- [ ] 7.0 **Page Integration & Layout**

  - [ ] 7.1 Open `components/lancamentos/page/lancamentos-page.tsx`
  - [ ] 7.2 Import `LancamentosTotalizer` component
  - [ ] 7.3 Import `calculateTotalizers` function from `@/lib/lancamentos/totalizers`
  - [ ] 7.4 Add `useState` for totalizer collapse state: `const [isTotalizerCollapsed, setIsTotalizerCollapsed] = useState(false)`
  - [ ] 7.5 Add `useEffect` to load collapse preference from localStorage key `lancamentos_totalizer_collapsed`
  - [ ] 7.6 Create toggle handler that updates state and saves to localStorage
  - [ ] 7.7 Calculate totalizer data using `useMemo(() => calculateTotalizers(lancamentos), [lancamentos])`
  - [ ] 7.8 Add `<LancamentosTotalizer>` component above `<LancamentosTable>` in JSX
  - [ ] 7.9 Pass `totalizerData`, `isCollapsed`, and `onToggleCollapse` props
  - [ ] 7.10 Wrap totalizer and table in proper spacing (gap-4 or gap-6)
  - [ ] 7.11 Ensure totalizer respects the filtered `lancamentos` array passed as props
  - [ ] 7.12 Test that totalizer updates when filters change
  - [ ] 7.13 Verify layout works on mobile (totalizer stacks vertically)

- [ ] 8.0 **Testing & Quality Assurance**
  - [ ] 8.1 Create `hooks/__tests__/use-column-preferences.test.ts`
  - [ ] 8.2 Write tests for localStorage read/write operations
  - [ ] 8.3 Test default values when localStorage is empty
  - [ ] 8.4 Test quota exceeded error handling
  - [ ] 8.5 Create `lib/lancamentos/__tests__/totalizers.test.ts`
  - [ ] 8.6 Test `calculateTotalizers()` with various transaction types (income, expense, transfer)
  - [ ] 8.7 Test calculation with empty array, single transaction, mixed transactions
  - [ ] 8.8 Test that amounts are correctly summed and net total is accurate
  - [ ] 8.9 Create `components/lancamentos/totalizer/__tests__/lancamentos-totalizer.test.tsx`
  - [ ] 8.10 Test component renders with mock data
  - [ ] 8.11 Test privacy mode hides values correctly
  - [ ] 8.12 Test collapse/expand functionality
  - [ ] 8.13 Create `components/lancamentos/table/__tests__/column-selector.test.tsx`
  - [ ] 8.14 Test column visibility toggling
  - [ ] 8.15 Test reset to default functionality
  - [ ] 8.16 Run full integration test with real transaction data
  - [ ] 8.17 Verify category column displays correctly
  - [ ] 8.18 Test drag-and-drop column reordering on desktop
  - [ ] 8.19 Verify preferences persist across page reloads
  - [ ] 8.20 Test responsive behavior (mobile shows column selector but no drag-and-drop)
  - [ ] 8.21 Run `pnpm test` to ensure all tests pass
  - [ ] 8.22 Run `pnpm build` to verify production build succeeds
  - [ ] 8.23 Manual QA: test in different browsers (Chrome, Firefox, Safari)
  - [ ] 8.24 Manual QA: test localStorage in private/incognito mode

---

## Implementation Notes

### Recommended Development Order

1. Start with **Task 1.0** (localStorage hook) - foundation for persistence
2. Implement **Task 2.0** (totalizer utilities) - pure logic, easy to test
3. Build **Task 3.0** (totalizer widget) - can test independently with mock data
4. Add **Task 4.0** (category column) - straightforward table column addition
5. Create **Task 5.0** (column selector) - UI component for visibility
6. Integrate **Task 6.0** (visibility & reordering) - most complex, build incrementally
7. Wire up **Task 7.0** (page integration) - bring it all together
8. Complete **Task 8.0** (testing) - validate everything works

### Key Technical Decisions

- **Drag-and-drop library**: Using `@dnd-kit` (modern, accessible, performant)
- **Column order persistence**: Stored as array of column IDs in order
- **Privacy mode**: Handled automatically by `MoneyValues` component
- **Mobile behavior**: Column selector works, drag-and-drop disabled (per PRD)
- **Reset functionality**: Clears localStorage and restores default state
- **Totalizer collapse**: Separate localStorage key for user preference

### Testing Strategy

- **Unit tests**: All utility functions and hooks
- **Component tests**: UI components with React Testing Library
- **Integration tests**: Full page flow with user interactions
- **Manual QA**: Cross-browser and responsive testing

### Performance Considerations

- Use `useMemo` for totalizer calculations to avoid re-computing on every render
- Debounce localStorage writes if performance issues arise
- Virtual scrolling not needed for columns (reasonable count)
- Test with large transaction datasets (1000+ rows) to verify table performance

---

## Acceptance Criteria Checklist

- [ ] All columns visible by default on first visit
- [ ] Column selector shows all available columns with checkboxes
- [ ] Columns can be toggled visible/hidden via column selector
- [ ] Column preferences persist in localStorage across sessions
- [ ] Column order can be changed via drag-and-drop (desktop only)
- [ ] "Reset to Default" button restores original state
- [ ] Category column displays category name and icon
- [ ] Category column shows "—" placeholder when no category
- [ ] Totalizer displays Total Income, Total Expenses, Net Total
- [ ] Totalizer respects all active filters on the page
- [ ] Totalizer shows correct calculations (verified manually)
- [ ] Totalizer hides values when privacy mode is enabled
- [ ] Totalizer can be collapsed/expanded with preference saved
- [ ] Mobile version shows column selector (no drag-and-drop)
- [ ] Mobile version shows totalizer stacked vertically
- [ ] No console errors or warnings
- [ ] Production build succeeds without errors
- [ ] All automated tests pass
