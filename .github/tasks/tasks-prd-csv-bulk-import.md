# Task List: CSV Bulk Transaction Import Feature

Based on PRD: `prd-csv-bulk-import.md`

## Relevant Files

**New Files to Create:**

- `lib/csv/types.ts` - TypeScript types for CSV parsing and column mapping
- `lib/csv/parser.ts` - CSV parsing logic using papaparse (delimiter detection, header extraction)
- `lib/csv/mapper.ts` - Column mapping logic and data transformation to ImportTransaction format
- `lib/csv/__tests__/parser.test.ts` - Unit tests for CSV parser
- `lib/csv/__tests__/mapper.test.ts` - Unit tests for CSV mapper
- `components/lancamentos/csv-import/types.ts` - CSV-specific UI types extending OFX ImportTransaction
- `components/lancamentos/csv-import/csv-import-dialog.tsx` - Main wizard dialog (4-step flow)
- `components/lancamentos/csv-import/csv-upload-step.tsx` - Step 1: File upload + account selection
- `components/lancamentos/csv-import/csv-column-mapping-step.tsx` - Step 2: Map CSV columns to fields (NEW - doesn't exist in OFX)
- `components/lancamentos/csv-import/csv-review-step.tsx` - Step 3: Wrapper component using shared review UI
- `components/lancamentos/csv-import/csv-confirm-step.tsx` - Step 4: Wrapper component using shared confirm UI

**Existing Files to Modify:**

- `app/(dashboard)/lancamentos/actions.ts` - Add CSV import server actions
- `components/lancamentos/page/lancamentos-page.tsx` - Add CSV import button/dialog trigger
- `package.json` - Add papaparse dependency

**Existing Files to Reuse (No Changes Needed):**

- `lib/ofx/duplicate-detector.ts` - ✅ Reuse `detectDuplicatesForBatch()` as-is
- `lib/ofx/category-suggester.ts` - ✅ Reuse `suggestCategoriesForBatch()` as-is
- `components/contas/ofx-import/review-step.tsx` - ✅ Adapt for CSV (pass different data)
- `components/contas/ofx-import/confirm-step.tsx` - ✅ Reuse as-is
- `components/contas/ofx-import/types.ts` - ✅ Extend ImportTransaction type

### Notes

- **Critical**: This feature EXTENDS the existing OFX import infrastructure. DO NOT duplicate code from `lib/ofx/duplicate-detector.ts` or `lib/ofx/category-suggester.ts`.
- The main difference from OFX import is the addition of a column mapping step and account selection.
- CSV parsing happens client-side for instant preview; server validates before import.
- Test with sample file: `/Users/dionizioferreira/Downloads/fatur-dez-25.csv` (semicolon delimiter, Brazilian date/currency format).
- Follow existing patterns from `app/(dashboard)/contas/[contaId]/extrato/actions.ts` for transaction insertion logic.

## Tasks

- [x] 1.0 Setup Dependencies and CSV Parsing Infrastructure

  - [x] 1.1 Install `papaparse` package: `pnpm add papaparse`
  - [x] 1.2 Install TypeScript types: `pnpm add -D @types/papaparse`
  - [x] 1.3 Create directory structure: `lib/csv/` with empty files (types.ts, parser.ts, mapper.ts)
  - [x] 1.4 Create directory structure: `components/lancamentos/csv-import/` with empty component files
  - [x] 1.5 Create `lib/csv/__tests__/` directory for test files
  - [x] 1.6 Verify packages installed correctly by checking package.json and running `pnpm install`

- [ ] 2.0 Implement CSV Parsing and Column Mapping Logic

  - [x] 2.1 Create `lib/csv/types.ts` - Define TypeScript interfaces for CsvRow, CsvColumn, CsvParseResult, ColumnMapping, CsvImportConfig, and CsvParsingError
  - [x] 2.2 Implement `lib/csv/parser.ts` - Create `parseCsvFile()` function that accepts File, detects delimiter (auto or user-selected), extracts headers from first row, parses data rows using papaparse, handles encoding (UTF-8, Latin1), and returns CsvParseResult with error handling
  - [x] 2.3 Add utility function `detectDelimiter()` in parser.ts to auto-detect semicolon, comma, or tab based on first few rows
  - [x] 2.4 Implement `lib/csv/mapper.ts` - Create `mapCsvRowToTransaction()` function that converts CSV row to ImportTransaction format based on user column mapping, parses Brazilian date format (DD/MM/YYYY), parses Brazilian currency format ("R$ 1.234,56" to "1234.56"), determines transaction type from amount sign (negative = Despesa, positive = Receita)
  - [x] 2.5 Add `parseBrazilianCurrency()` utility function to strip "R$ " prefix, convert decimal separator from comma to period, remove thousands separator (period)
  - [x] 2.6 Add `parseBrazilianDate()` utility function to handle DD/MM/YYYY and other common formats (YYYY-MM-DD, DD-MM-YYYY)
  - [x] 2.7 Add `validateColumnMapping()` function to ensure required fields (Date, Amount) are mapped
  - [x] 2.8 Write unit tests in `lib/csv/__tests__/parser.test.ts` - Test delimiter detection, header extraction, error handling for malformed CSV
  - [x] 2.9 Write unit tests in `lib/csv/__tests__/mapper.test.ts` - Test currency parsing, date parsing, transaction type detection, column mapping validation

- [x] 2.0 Implement CSV Parsing and Column Mapping Logic

- [ ] 3.0 Build CSV Import UI Components (Upload & Column Mapping Steps)

  - [ ] 3.1 Create `components/lancamentos/csv-import/types.ts` - Define CsvWizardStep ("upload" | "mapping" | "review" | "confirm"), CsvImportFormState, CsvColumnOption, extend ImportTransaction from OFX types
  - [ ] 3.2 Implement `components/lancamentos/csv-import/csv-upload-step.tsx` - Create file upload UI with drag-and-drop zone (using shadcn/ui Input file type), account type selector (Bank Account / Credit Card radio group), account dropdown filtered by type, delimiter selector dropdown (Auto-detect, Semicolon, Comma, Tab), file validation (max 5MB, .csv extension only), display file info after selection (name, size, row count preview), loading state during parsing with spinner, error display for invalid files
  - [ ] 3.3 Implement `components/lancamentos/csv-import/csv-column-mapping-step.tsx` - Display detected CSV headers from parsed file, provide dropdowns to map columns to system fields (Date, Amount/Valor, Description/Descrição), mark required fields with asterisk (Date and Amount mandatory), show data preview (first 5 rows) with mapped columns highlighted, validate mapping before allowing Next button (disable if Date or Amount not mapped), display total row count from CSV, add "Auto-detect" button that tries to match headers based on common patterns (data/date → Date, valor/value/amount → Amount, descrição/description/memo → Description)
  - [ ] 3.4 Style components to match existing Opensheets design - Use shadcn/ui components (Dialog, Select, Input, Button, Label, Alert), consistent spacing and typography, Portuguese labels throughout, responsive design with proper mobile breakpoints

- [ ] 4.0 Integrate with Existing OFX Infrastructure (Review & Confirm Steps)

  - [ ] 4.1 Create `components/lancamentos/csv-import/csv-review-step.tsx` - Wrapper component that imports and uses `ReviewStep` from `components/contas/ofx-import/review-step.tsx`, pass CSV transactions as ImportTransaction[], reuse all existing features (inline editing, category selector, duplicate warnings, bulk actions, select/deselect all), ensure proper data format conversion from CSV to ImportTransaction interface
  - [ ] 4.2 Create `components/lancamentos/csv-import/csv-confirm-step.tsx` - Wrapper component that imports and uses `ConfirmStep` from `components/contas/ofx-import/confirm-step.tsx`, pass summary data (selected count, total amount, date range), display account name (bank or credit card) being imported to, reuse progress bar and error display
  - [ ] 4.3 Verify ImportTransaction type compatibility between CSV and OFX formats - Ensure all required fields are mapped correctly, handle optional fields (categoriaId, pagadorId), set appropriate defaults (isSettled, paymentMethod)

- [ ] 5.0 Create CSV Import Server Actions

  - [ ] 5.1 Add `parseCsvFileAction()` server action to `app/(dashboard)/lancamentos/actions.ts` - Add "use server" directive, validate user authentication with `getUser()`, accept CSV file content as string, delimiter preference, call CSV parser, return parsed data (headers, rows, detected format) or error message, handle parsing errors with try/catch and user-friendly messages
  - [ ] 5.2 Add `detectCsvDuplicatesAction()` server action - Accept userId, accountId (contaId or cartaoId), array of CSV transactions, verify account ownership, import and call `detectDuplicatesForBatch()` from `lib/ofx/duplicate-detector.ts`, return Map of transaction temporary IDs to duplicate matches, handle errors gracefully
  - [ ] 5.3 Add `suggestCsvCategoriesAction()` server action - Accept userId, array of CSV transactions, import and call `suggestCategoriesForBatch()` from `lib/ofx/category-suggester.ts`, return Map of transaction IDs to category suggestions with confidence levels, cache results in action response
  - [ ] 5.4 Implement `importCsvTransactionsAction()` server action - Create Zod schema for validation (accountId, accountType, transactions array, columnMapping), verify user authentication and account ownership, check rate limiting (reuse OFX rate limit: 60 imports/30 min), transform CSV data to lancamentos insert format (map fields: name, amount, purchaseDate, period, transactionType, paymentMethod, condition, contaId or cartaoId), use database transaction with `db.transaction()`, batch insert with `db.insert(lancamentos).values()`, set isSettled to true, add import note with timestamp: "Importado de CSV em {date}", revalidate with `revalidateForEntity("lancamentos")`, return success result with imported count and skipped duplicates count
  - [ ] 5.5 Add proper error handling with `handleActionError()` utility from existing codebase
  - [ ] 5.6 Add validation to prevent duplicate imports (check for existing transactions with same note pattern)

- [ ] 6.0 Integrate CSV Import into Transactions Page UI

  - [ ] 6.1 Create `components/lancamentos/csv-import/csv-import-dialog.tsx` - Build main wizard dialog with Dialog component (max-w-5xl for wide layout), implement 4-step navigation (Upload → Column Mapping → Review → Confirm) with step progress indicator, manage form state for all steps (current step, transactions, mapping, selected account), handle step validation before proceeding (upload: file selected, mapping: required fields mapped, review: at least one transaction selected), add Cancel button that resets state and closes dialog, connect to server actions for parsing, duplicate detection, category suggestion, and import
  - [ ] 6.2 Update `components/lancamentos/page/lancamentos-page.tsx` - Import CsvImportDialog component, add state for dialog open/close, add "Importar CSV" button to page actions/toolbar (use RiFileUploadLine icon), pass required props to dialog (categorias, pagadores, contas, cartoes options, selectedPeriod), handle import success callback (refresh page data, show toast notification)
  - [ ] 6.3 Add CSV import button to appropriate location - Place in actions dropdown menu or toolbar alongside other bulk actions (Mass Add, Bulk Edit, etc.), ensure button is only visible when user has at least one active account or card, style as secondary action to differentiate from primary create button
  - [ ] 6.4 Add loading state to button while import is processing
  - [ ] 6.5 Show success toast notification after import with count of imported transactions - Format: "X transações importadas com sucesso" + optional duplicate skip message
  - [ ] 6.6 Handle errors with toast notifications - Display user-friendly error messages for common failures (invalid file, parsing errors, duplicate detection failures, import errors)

- [ ] 7.0 Testing and Validation
  - [ ] 7.1 Test complete CSV import flow with sample file `/Users/dionizioferreira/Downloads/fatur-dez-25.csv` - Upload file, verify delimiter detection (semicolon), verify date parsing (DD/MM/YYYY), verify currency parsing ("R$ 1.234,56"), complete column mapping, review parsed transactions, check category suggestions work, verify duplicate detection (import same file twice), complete import, verify transactions in database with correct data
  - [ ] 7.2 Test error scenarios - Invalid CSV file (not CSV format), file too large (>5MB), malformed data (invalid dates, non-numeric amounts), empty file, missing required columns, network/database errors, verify user-friendly error messages displayed
  - [ ] 7.3 Test with different CSV formats - Comma delimiter, tab delimiter, different date formats (YYYY-MM-DD, DD-MM-YYYY), different amount formats (no currency symbol, different decimal separators), CSV with/without headers
  - [ ] 7.4 Test account type selection - Import to bank account, import to credit card, verify correct contaId/cartaoId assignment, verify paymentMethod set correctly based on account type
  - [ ] 7.5 Test duplicate detection accuracy - Import same file twice, verify duplicates flagged correctly, test with slightly different amounts/dates, confirm user can override flags and import anyway
  - [ ] 7.6 Test category suggestion accuracy - Verify suggestions match historical patterns, check confidence levels (high/medium/low), test with transactions that have no history (no suggestion)
  - [ ] 7.7 Test edge cases - Single transaction CSV, very large file (500+ rows), special characters in descriptions (accents, symbols), future-dated transactions, negative amounts (income), empty description fields
  - [ ] 7.8 Verify accessibility - Keyboard navigation through wizard steps, screen reader compatibility (proper ARIA labels), focus management between steps, error announcements
  - [ ] 7.9 Test mobile responsiveness - Dialog width adjusts for mobile, tables scroll horizontally, buttons have proper touch targets, dropdowns work on mobile
  - [ ] 7.10 Run full test suite with `pnpm test` - Ensure all new tests pass, verify no regressions in existing tests
  - [ ] 7.11 Final code review - Check for console.log statements (remove), verify no TypeScript `any` types, confirm proper error handling throughout, ensure all user-facing text is in Portuguese

## Tutorial

### Task 1.0: CSV Import Infrastructure Setup

The CSV import feature infrastructure has been set up with all necessary dependencies and directory structure:

**Dependencies Installed:**

- `papaparse` (v5.5.3) - CSV parsing library that handles various delimiters and formats
- `@types/papaparse` (v5.5.2) - TypeScript type definitions for papaparse

**Directory Structure Created:**

- `lib/csv/` - Contains CSV parsing and mapping logic

  - `types.ts` - Type definitions for CSV import
  - `parser.ts` - CSV file parsing functions
  - `mapper.ts` - Data transformation and column mapping logic
  - `__tests__/` - Unit tests directory

- `components/lancamentos/csv-import/` - UI components for CSV import wizard
  - `types.ts` - Component-specific type definitions
  - `csv-import-dialog.tsx` - Main wizard dialog (4-step flow)
  - `csv-upload-step.tsx` - File upload and account selection step
  - `csv-column-mapping-step.tsx` - Column mapping step (unique to CSV, not in OFX)
  - `csv-review-step.tsx` - Transaction review wrapper
  - `csv-confirm-step.tsx` - Import confirmation wrapper

**What's Next:**
The infrastructure is ready for implementation. Next tasks will add the actual parsing logic, UI components, and server actions to enable CSV file imports for transactions.
