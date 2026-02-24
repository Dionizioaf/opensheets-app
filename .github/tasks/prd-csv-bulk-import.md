# Product Requirements Document: CSV Bulk Transaction Import

## Introduction/Overview

This feature enables users to import multiple transactions from CSV files into either bank accounts or credit cards. Currently, the application supports OFX file imports only for bank accounts. This enhancement extends bulk import capabilities to the transactions screen with CSV format support, providing a more flexible way to import transaction data from various sources (bank statements, credit card bills, exported spreadsheets, etc.).

**Problem:** Users who don't have OFX files or need to import credit card transactions currently must manually enter each transaction individually, which is time-consuming and error-prone.

**Goal:** Provide a user-friendly CSV import workflow accessible from the transactions screen that works for both bank accounts and credit cards, with intelligent column mapping, data validation, duplicate detection, and preview capabilities.

## Goals

1. Enable users to bulk import transactions from CSV files to any bank account or credit card
2. Support flexible CSV formats by allowing user-configurable column mapping
3. Prevent duplicate transactions using intelligent detection (same or better than current OFX logic)
4. Provide data validation with preview and error correction before final import
5. Maintain the same quality standards as the existing OFX import feature
6. Support multiple date and number formats to accommodate various CSV sources

## User Stories

1. **As a user**, I want to import my credit card bill from a CSV file so that I can quickly populate my transactions without manual entry.

2. **As a user**, I want to map CSV columns to transaction fields so that I can import data from different banks or credit card companies that use different column headers.

3. **As a user**, I want to see a preview of all transactions before importing so that I can verify the data is correctly parsed and fix any errors.

4. **As a user**, I want the system to detect and highlight duplicate transactions so that I can avoid importing the same transaction twice.

5. **As a user**, I want to see clear error messages when data is invalid (wrong date format, non-numeric amounts) so that I can correct issues before importing.

6. **As a user**, I want to track import progress so that I know the system is working when importing large CSV files.

## Functional Requirements

### FR1: CSV Upload Interface

1.1. Add "Import CSV" option to the existing actions menu/dropdown on the transactions screen

1.2. Clicking "Import CSV" opens a modal dialog with file upload functionality

1.3. Modal must include account selection:

- Account type selector (Bank Account / Credit Card)
- Account dropdown (filtered by selected type)

1.4. File input accepts `.csv` files only

1.5. Delimiter selection dropdown with options: Comma (,), Semicolon (;), Tab

### FR2: CSV Parsing & Column Mapping

2.1. Parse CSV file assuming first row contains headers

2.2. Display column mapping interface after successful file parsing:

- Show all detected CSV column headers
- Provide dropdowns to map to system fields: Date, Amount (Valor), Description (Descrição)
- Mark required fields (Date and Amount are mandatory)
- Description is optional but recommended

2.3. Validate that required fields are mapped before proceeding

2.4. Display total row count from CSV file

### FR3: Data Validation & Format Detection

3.1. **Date Format Detection:**

- Auto-detect date format from common patterns: DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY
- Validate all date values match detected format
- Flag rows with invalid dates

3.2. **Amount Format Detection:**

- Auto-detect decimal separator (comma or period)
- Auto-detect negative/positive indicators (-, parentheses, signs)
- Automatically classify: negative values = expenses, positive values = income
- Flag rows with non-numeric or unparseable amounts

3.3. **Data Validation Rules:**

- Date must be a valid date
- Amount must be a valid number
- Description can be empty but should not exceed character limits

### FR4: Preview with Error Handling

4.1. Display full preview table showing all rows from CSV with columns:

- Checkbox (for selection/deselection)
- Status icon (OK, Error, Warning for duplicates)
- Date (parsed and formatted)
- Description
- Amount (formatted as currency)
- Error message (if applicable)

4.2. Errors should be highlighted with red/warning styling

4.3. For rows with errors:

- Display specific error message (e.g., "Invalid date format", "Amount must be numeric")
- Allow inline editing to fix values
- Re-validate after user edits

4.4. Summary section showing:

- Total rows: X
- Valid rows: Y
- Rows with errors: Z
- Duplicates detected: W

### FR5: Duplicate Detection

5.1. Implement duplicate detection using the same logic as OFX import:

- Match 1: Same date + same description + same amount
- Match 2: Same date + same amount (description may differ)

5.2. Mark detected duplicates in preview table with warning icon/badge

5.3. Duplicates should be **pre-checked but highlighted** so users can:

- Keep checkbox checked to import anyway
- Uncheck to skip duplicate
- See which existing transaction it matches (show in tooltip or expandable row)

5.4. Provide "Uncheck All Duplicates" bulk action button

### FR6: Import Execution

6.1. Disable import button if any errors exist (not including duplicates)

6.2. On import confirmation:

- Show progress bar/indicator
- Display current count: "Importing X of Y transactions"
- Process only checked rows

6.3. Use existing transaction creation logic from OFX import:

- Insert transactions via Drizzle ORM
- Associate with selected account (bank or credit card)
- Apply transaction type based on amount sign
- Set current period based on transaction date

6.4. Handle category matching:

- If CSV has category column mapped, attempt to match existing categories
- Only match exact existing categories (case-insensitive)
- If no match found, leave category null (user assigns later)

6.5. Transaction creation should follow same validation as manual entry

### FR7: Post-Import Feedback

7.1. Display success modal with summary:

- Total imported: X transactions
- Skipped (unchecked): Y transactions
- Failed: Z transactions (if any)

7.2. If failures occurred, show list of failed rows with reasons

7.3. Provide action buttons:

- "View Transactions" (navigate to transactions list filtered to import period)
- "Close" (dismiss modal and refresh transactions table)

7.4. Revalidate transactions entity cache after successful import

### FR8: Error Handling & Edge Cases

8.1. Handle empty CSV files: Show error message "CSV file is empty"

8.2. Handle missing required columns: Show error "Required columns not mapped: [list]"

8.3. Handle large files (>1000 rows): Show warning and confirm before parsing

8.4. Handle file reading errors: Show user-friendly error message

8.5. Handle network/database errors during import: Rollback transaction and show error

## Non-Goals (Out of Scope)

1. **Automatic category assignment** - The system will not use AI or rules to automatically assign categories from descriptions (can be future enhancement)

2. **Payee/Payer (Pagador) import** - CSV import will not handle payee fields; users must assign manually

3. **Saved column mapping templates** - Users will map columns each time they import; no saved templates/presets

4. **Multi-account import** - Each import session targets one account only; users cannot split transactions across accounts in single import

5. **CSV export** - This PRD covers import only; export functionality is separate

6. **Recurring transaction detection** - No automatic detection of recurring patterns during import

7. **CSV editing/cleaning tools** - The system validates and highlights errors but doesn't provide advanced CSV editing capabilities

8. **Support for non-CSV formats** - Only CSV files supported; no Excel, JSON, or other formats

## Design Considerations

### UI/UX Guidelines

- Follow existing modal patterns from the application (see OFX import modal for reference)
- Use shadcn/ui components: Dialog, Table, Select, Button, Badge, Progress
- Maintain Portuguese interface language (all labels, messages in PT-BR)
- Use existing type badges and status indicators for consistency
- Error states should use red color scheme, warnings use yellow/amber, success use green

### Component Structure

**Reuse from OFX Import:**

```
lib/ofx/
  duplicate-detector.ts          // ✅ Reuse as-is
  category-suggester.ts          // ✅ Reuse as-is

components/contas/ofx-import/
  review-step.tsx                // ✅ Adapt for CSV (same UI, different data source)
  confirm-step.tsx               // ✅ Reuse as-is
  types.ts                       // ✅ Extend with CSV-specific types
```

**New for CSV Import:**

```
lib/csv/
  parser.ts                      // 🆕 CSV parsing with papaparse
  mapper.ts                      // 🆕 Column mapping logic
  types.ts                       // 🆕 CSV-specific types

components/lancamentos/csv-import/
  csv-import-dialog.tsx          // 🆕 Main wizard (similar to ofx-import-dialog.tsx)
  csv-upload-step.tsx            // 🆕 File upload + account selection
  csv-column-mapping-step.tsx    // 🆕 Map CSV columns to fields
  csv-review-step.tsx            // 🆕 Wrapper for shared review-step.tsx
  csv-confirm-step.tsx           // 🆕 Wrapper for shared confirm-step.tsx

app/(dashboard)/lancamentos/
  actions.ts                     // 🆕 Add CSV import actions (calls shared lib/ofx/* utils)
```

### Accessibility

- Ensure keyboard navigation works throughout the multi-step flow
- Provide ARIA labels for all interactive elements
- Error messages should be announced to screen readers
- Focus management between modal steps

## Technical Considerations

### Reuse Existing OFX Import Infrastructure

**Critical: This feature extends the existing OFX import rather than duplicating it.**

The following components from the OFX import feature (`done-prd-import-ofx.md`) should be **reused as-is**:

1. **Duplicate Detection** (`lib/ofx/duplicate-detector.ts`):

   - `detectDuplicates()` function - Works with any transaction data
   - `detectDuplicatesForBatch()` for efficient batch processing
   - Uses FITID matching, exact matching, and fuzzy similarity (>80%)
   - No changes needed - works for both OFX and CSV imports

2. **Category Suggester** (`lib/ofx/category-suggester.ts`):

   - `suggestCategory()` function - Transaction name-based suggestions
   - `suggestCategoriesForBatch()` for batch processing
   - Fuzzy matching with confidence levels (high/medium/low)
   - No changes needed - works for both OFX and CSV imports

3. **UI Components to Adapt** (from `components/contas/ofx-import/`):

   - **Review Step** (`review-step.tsx`): Reuse the transaction review table with inline editing, category selector, duplicate warnings, and bulk actions
   - **Confirm Step** (`confirm-step.tsx`): Reuse the confirmation screen with summary and transaction list
   - **Dialog Pattern** (`ofx-import-dialog.tsx`): Follow the same multi-step wizard pattern

4. **Server Action Patterns** (`app/(dashboard)/contas/[contaId]/extrato/actions.ts`):
   - Transaction creation logic (mapping to lancamentos schema)
   - Batch insert with database transactions
   - Rate limiting pattern (60 imports/30 min)
   - Revalidation with `revalidateForEntity("lancamentos")`

### New Components for CSV Import

Create in `lib/csv/`:

1. **CSV Parser** (`lib/csv/parser.ts`):

   - Use `papaparse` library for CSV parsing
   - Detect delimiter (comma, semicolon, tab)
   - Extract header row and data rows
   - Return structured data for column mapping

2. **Column Mapper** (`lib/csv/mapper.ts`):
   - Allow user to map CSV columns to transaction fields
   - Store mapping configuration temporarily
   - Validate required fields (Date, Amount)
   - Transform CSV rows to ImportTransaction format

Create in `components/lancamentos/csv-import/`:

1. **CSV Upload Step** (new - different from OFX file upload)
2. **Column Mapping Step** (new - doesn't exist in OFX)
3. **Account Selection** (new - OFX has hardcoded account, CSV needs selector)
4. **Review Step** (adapt from OFX review-step.tsx)
5. **Confirm Step** (reuse from OFX confirm-step.tsx)

### Backend (Server Actions)

Create in `app/(dashboard)/lancamentos/actions.ts`:

- `parseCsvFileAction()` - Parse CSV and extract columns/rows
- `importCsvTransactionsAction()` - Main import action that:
  - Calls `detectDuplicatesForBatch()` from lib/ofx/duplicate-detector.ts
  - Calls `suggestCategoriesForBatch()` from lib/ofx/category-suggester.ts
  - Uses same transaction insertion logic as OFX import
  - Reuses rate limiting from OFX import

### Dependencies

- Install `papaparse`: `pnpm add papaparse @types/papaparse`
- Reuse existing: `fuzzysort` (already installed for OFX)

### Data Processing

- CSV parsing on client side for instant preview
- Send parsed and mapped data to server (same as OFX)
- Server validates and uses existing duplicate/category detection
- Use same date/amount parsing utilities as OFX import

### CSV Format Detection

Based on sample file analysis:

```csv
data;lançamento;;valor
03/12/2025;Elson Marcos Alves Pad;;R$ 120,33
```

- Delimiter: Semicolon (;)
- Date format: DD/MM/YYYY (Brazilian standard)
- Amount format: "R$ 1.234,56" (Brazilian currency format with R$ prefix)
- Currency: Decimal separator is comma, thousands separator is period

Parser must:

- Strip "R$ " prefix from amounts
- Convert "1.234,56" to "1234.56" (database decimal format)
- Parse DD/MM/YYYY dates to Date objects
- Handle empty columns (extra semicolons)

### Performance

- For files >500 rows, batch process (100 at a time) - same as OFX
- Reuse existing progress tracking pattern from OFX
- Debounce inline editing - same as OFX review step

### Security

- Same file size limit as OFX (5MB)
- Same rate limiting as OFX (60 imports/30 min)
- Same authentication/ownership checks as OFX
- CSRF protection via Next.js server actions (same as OFX)

## Success Metrics

1. **Adoption Rate:** 30% of active users use CSV import within first month of release

2. **Import Success Rate:** >95% of import attempts complete successfully without errors

3. **Time Savings:** Average time to import 50 transactions reduces from 15 minutes (manual) to <2 minutes (CSV import)

4. **Duplicate Prevention:** <5% of imported transactions are duplicates (measured by user deletion of imported transactions within 24 hours)

5. **Error Recovery:** 80% of previews with errors are successfully corrected by users before import

6. **User Satisfaction:** Positive feedback from user testing or support tickets

## Open Questions

1. **Should we support importing transactions to multiple accounts in a future iteration?** (e.g., CSV has account column that maps to different accounts)

2. **Do we need to log/audit CSV imports?** Should we keep a record of which file was imported, when, and by whom for troubleshooting purposes?

3. **Should we provide a sample CSV template download** to help users format their files correctly?

4. **Maximum row limit:** What's a reasonable limit for CSV rows? Current thinking is 1000 rows with warning, hard limit at 5000?

5. **Undo functionality:** Should users be able to "undo" an import batch (delete all transactions from specific import)?

6. **Should we validate that imported transactions don't overlap with existing installment plans** to avoid confusion?

7. **For credit card imports, should we offer to automatically create a fatura (invoice)** or just import individual transactions?

## Implementation Notes for Developers

### Critical: Extend, Don't Duplicate

**DO NOT recreate existing OFX import functionality.** This feature is an extension, not a replacement.

### Step-by-Step Implementation Guide

1. **Phase 1: Setup CSV Parsing** (Independent of OFX)

   - Install `papaparse` dependency
   - Create `lib/csv/parser.ts` for CSV file handling
   - Support delimiter detection (;, comma, tab)
   - Parse sample file: `/Users/dionizioferreira/Downloads/fatur-dez-25.csv`

2. **Phase 2: Column Mapping** (New functionality)

   - Create `lib/csv/mapper.ts` for column-to-field mapping
   - Build UI: `csv-column-mapping-step.tsx`
   - Allow user to map: Date, Amount, Description columns

3. **Phase 3: Integrate with Existing OFX Infrastructure**

   - **Import directly from `lib/ofx/duplicate-detector.ts`**:
     ```typescript
     import { detectDuplicatesForBatch } from "@/lib/ofx/duplicate-detector";
     ```
   - **Import directly from `lib/ofx/category-suggester.ts`**:
     ```typescript
     import { suggestCategoriesForBatch } from "@/lib/ofx/category-suggester";
     ```
   - **Adapt review-step.tsx** (don't copy - use shared component or extend)
   - **Reuse confirm-step.tsx** as-is

4. **Phase 4: Server Actions**

   - Add to `app/(dashboard)/lancamentos/actions.ts`
   - Copy transaction insertion logic from `app/(dashboard)/contas/[contaId]/extrato/actions.ts`
   - Use same Zod schemas and validation patterns
   - Call existing duplicate/category detection functions

5. **Phase 5: UI Integration**
   - Add import button to `components/lancamentos/page/lancamentos-page.tsx`
   - Follow same dropdown pattern as OFX ("Importar CSV" option)
   - Pass required props: categorias, pagadores, contas, cartoes

### Key Files to Reference

- **OFX Import PRD**: `.github/tasks/done-prd-import-ofx.md` (complete reference)
- **Duplicate Detection**: `lib/ofx/duplicate-detector.ts` (lines 1-454)
- **Category Suggestion**: `lib/ofx/category-suggester.ts` (lines 1-362)
- **Review UI**: `components/contas/ofx-import/review-step.tsx` (lines 1-519)
- **Import Logic**: `app/(dashboard)/contas/[contaId]/extrato/actions.ts` (lines 600-700)

### Sample CSV Format (from fatur-dez-25.csv)

```csv
data;lançamento;;valor
03/12/2025;Elson Marcos Alves Pad;;R$ 120,33
04/12/2025;Oishiiipasteis;;R$ 38,50
```

- Delimiter: Semicolon (;)
- Date: DD/MM/YYYY
- Amount: "R$ 1.234,56" (needs parsing to "1234.56")
- Empty columns present (double semicolons)

### Revalidation

- Use `revalidateForEntity("lancamentos")` after import (same as OFX)
- Located in: `lib/actions/revalidate.ts`

### Testing

- Test with sample file: `/Users/dionizioferreira/Downloads/fatur-dez-25.csv`
- Verify duplicate detection works (import same file twice)
- Verify category suggestions work (if historical data exists)
- Test both bank account and credit card imports

---

**Document Version:** 1.0  
**Created:** January 3, 2026  
**Author:** AI Solutions Architect  
**Status:** Ready for Implementation
