# Task List: OFX Import Feature Implementation

Based on PRD: `prd-import-ofx.md`

## Relevant Files

- `lib/ofx/parser.ts` - OFX file parsing logic (handles both SGML 1.x and XML 2.x formats) [Created]
- `lib/ofx/types.ts` - TypeScript types for OFX data structures [Created]
- `lib/ofx/mapper.ts` - Maps OFX transactions to lancamento schema [Created]
- `lib/ofx/duplicate-detector.ts` - Detects potential duplicate transactions [Created]
- `lib/ofx/category-suggester.ts` - Suggests categories based on historical data [Created]
- `components/contas/ofx-import/ofx-import-dialog.tsx` - Main wizard dialog component [Created]
- `components/contas/ofx-import/upload-step.tsx` - File upload step UI [Created]
- `components/contas/ofx-import/review-step.tsx` - Transaction review and mapping step UI [Created]
- `components/contas/ofx-import/confirm-step.tsx` - Final confirmation step UI [Created]
- `components/contas/ofx-import/types.ts` - TypeScript types for import flow [Created]
- `package.json` - Added node-ofx-parser and fuzzysort dependencies [Modified]
- `app/(dashboard)/contas/[contaId]/extrato/actions.ts` - Server actions for OFX import (to be created)
- `app/(dashboard)/contas/[contaId]/extrato/page.tsx` - Add import button to statement page (to be modified)
- `components/contas/account-statement-card.tsx` - Update to include import action (to be modified)

### Notes

- Follow existing patterns from `components/lancamentos/dialogs/` for dialog structure
- Use shadcn/ui components consistently (Dialog, Table, Button, etc.)
- Server actions should follow the pattern in `app/(dashboard)/lancamentos/actions.ts`
- Reuse existing constants from `lib/lancamentos/constants.ts`
- All currency values use decimal strings internally (e.g., "123.45")
- Date handling uses `parseLocalDateString` from `lib/utils/date`
- Period format is always "YYYY-MM"

## Tasks

- [x] 1.0 Setup Dependencies and Base Infrastructure

  - [x] 1.1 Install `node-ofx-parser` package: `pnpm add node-ofx-parser`
  - [x] 1.2 Install `fuzzysort` package for fuzzy string matching: `pnpm add fuzzysort`
  - [x] 1.3 Install type definitions if needed: `pnpm add -D @types/node-ofx-parser`
  - [x] 1.4 Create directory structure: `lib/ofx/` with empty files for parser, mapper, duplicate-detector, category-suggester, and types
  - [x] 1.5 Create directory structure: `components/contas/ofx-import/` with empty component files
  - [x] 1.6 Verify packages are installed correctly by checking `package.json` and running `pnpm install`

- [ ] 2.0 Implement OFX Parsing and Data Mapping

  - [ ] 2.1 Create `lib/ofx/types.ts` - Define TypeScript interfaces for OFX transaction data, parsed transaction, and import configuration
  - [ ] 2.2 Implement `lib/ofx/parser.ts` - Create `parseOfxFile()` function that accepts File/string, uses node-ofx-parser, handles both SGML and XML formats, extracts BANKACCTFROM data, and returns array of parsed transactions with error handling
  - [ ] 2.3 Implement `lib/ofx/mapper.ts` - Create `mapOfxToLancamento()` function that converts OFX transaction to lancamento schema, maps TRNTYPE to Despesa/Receita, converts TRNAMT to absolute decimal string, formats DTPOSTED to Date object and period string, and sets default payment method to "Débito"
  - [ ] 2.4 Add utility function `sanitizeOfxDescription()` in mapper to clean up MEMO field by removing extra spaces, truncating if too long (max 255 chars), and handling special characters
  - [ ] 2.5 Add `generateImportNote()` helper that creates standardized note text with current timestamp
  - [ ] 2.6 Write unit tests for parser with sample OFX data (test with provided Itaú file structure)
  - [ ] 2.7 Write unit tests for mapper to verify correct field transformations

- [ ] 3.0 Build Import Dialog UI Components

  - [ ] 3.1 Create `components/contas/ofx-import/types.ts` - Define types for wizard steps, form state, parsed transaction with UI metadata (selected, isDuplicate, suggestedCategory), and step navigation
  - [ ] 3.2 Implement `components/contas/ofx-import/upload-step.tsx` - Create file upload UI with drag-and-drop zone using shadcn/ui Input (file type), display file validation messages (5MB limit, .ofx extension), show file info (name, size) after selection, and loading state during parsing
  - [ ] 3.3 Implement `components/contas/ofx-import/review-step.tsx` - Create transaction review table with shadcn/ui Table, add columns: checkbox, date, description (editable Input), amount (read-only), category (editable Combobox), duplicate warning icon, implement select/deselect all checkbox, add inline editing for transaction name and category, show duplicate warning badges with tooltip, display confidence indicators for suggested categories, and include bulk actions section
  - [ ] 3.4 Implement `components/contas/ofx-import/confirm-step.tsx` - Display import summary (selected count, total count, date range), show scrollable list of transactions to be imported, add "Go Back" and "Confirm Import" buttons, and display loading state during import
  - [ ] 3.5 Create `components/contas/ofx-import/ofx-import-dialog.tsx` - Build main wizard dialog with Dialog component, implement step navigation (Upload → Review → Confirm), manage form state for all transactions, handle step validation before proceeding, add progress indicator showing current step, implement Cancel button that resets state, and connect to server actions
  - [ ] 3.6 Add file upload validation logic - Check file size (max 5MB), verify file extension (.ofx), validate MIME type on client-side, and show user-friendly error messages
  - [ ] 3.7 Style components to match existing Opensheets design - Use consistent spacing, colors, and typography from shadcn/ui theme

- [ ] 4.0 Implement Smart Features (Category Suggestion & Duplicate Detection)

  - [ ] 4.1 Create `lib/ofx/category-suggester.ts` - Implement `suggestCategory()` function that queries lancamentos table for similar transaction names, uses fuzzysort for fuzzy matching (threshold >70%), considers transaction amount patterns, returns category ID with confidence score (high >90%, medium 70-90%, low <70%), and handles case when no match found
  - [ ] 4.2 Add `suggestCategoriesForTransactions()` batch function that processes multiple transactions efficiently with single DB query for historical data and returns Map of transaction FITID to suggested category
  - [ ] 4.3 Implement `lib/ofx/duplicate-detector.ts` - Create `detectDuplicates()` function that queries existing lancamentos for same account, checks for same date + same amount + similar description (>80% similarity using fuzzysort), checks for same FITID in transaction notes, returns array of potential duplicate IDs with match reason, and handles date range (±3 days consideration)
  - [ ] 4.4 Add `checkTransactionForDuplicates()` that returns duplicate info for single transaction including existing transaction details and similarity score
  - [ ] 4.5 Optimize duplicate detection query to use database indexes on contaId, purchaseDate, and amount fields
  - [ ] 4.6 Write tests for category suggester with mock lancamentos data
  - [ ] 4.7 Write tests for duplicate detector with various edge cases (same date, different amounts, similar descriptions)

- [ ] 5.0 Create Server Actions and Database Integration

  - [ ] 5.1 Create `app/(dashboard)/contas/[contaId]/extrato/actions.ts` if it doesn't exist, or add to existing actions file
  - [ ] 5.2 Implement `parseOfxFileAction()` server action - Add "use server" directive, validate user authentication with `getUserId()`, accept File input from client, call OFX parser, handle parsing errors with try/catch, return parsed transactions array or error message, and validate file on server-side (size, type)
  - [ ] 5.3 Implement `suggestCategoriesForOfxAction()` server action - Accept account ID and array of transactions, verify user owns the account, call category suggester for each transaction, return suggestions map, and handle errors gracefully
  - [ ] 5.4 Implement `detectOfxDuplicatesAction()` server action - Accept account ID and transactions array, verify account ownership, call duplicate detector, return duplicate flags for each transaction, and cache results in action response
  - [ ] 5.5 Implement `importOfxTransactionsAction()` server action - Add Zod schema validation for import payload (accountId, transactions array, defaults), verify user authentication, validate account ownership, transform OFX data to lancamentos insert format, use database transaction with `db.transaction()`, batch insert with `db.insert(lancamentos).values()`, set isSettled to true for all imports, add import timestamp to note field, revalidate with `revalidateForEntity("lancamentos")`, return success/error result with imported count, and handle partial failures
  - [ ] 5.6 Add proper error handling with `handleActionError()` utility from existing codebase
  - [ ] 5.7 Implement rate limiting check (max 10 imports per hour per user) - Store import attempts in memory or simple cache
  - [ ] 5.8 Add validation to prevent importing duplicate FITIDs (check notes field for existing imports)

- [ ] 6.0 Integrate Import Button into Account Statement Page

  - [ ] 6.1 Update `app/(dashboard)/contas/[contaId]/extrato/page.tsx` - Import OfxImportDialog component and pass required props (accountId, categoriaOptions, pagadorOptions, selectedPeriod)
  - [ ] 6.2 Update `components/contas/account-statement-card.tsx` - Add "Importar OFX" button to actions prop alongside edit button, use RiDownloadLine or RiFileUploadLine icon from remixicon, style as secondary button to differentiate from primary actions, and pass button as trigger to OfxImportDialog
  - [ ] 6.3 Create import button component if needed or add inline to AccountStatementCard actions section
  - [ ] 6.4 Ensure button is only visible for active accounts (check status prop)
  - [ ] 6.5 Test navigation flow: click import button → dialog opens → complete wizard → dialog closes → transactions appear in table
  - [ ] 6.6 Add loading state to button while import is processing
  - [ ] 6.7 Show success toast notification after successful import with count of imported transactions

- [ ] 7.0 Testing and Polish
  - [ ] 7.1 Test complete import flow with provided Itaú OFX file - Upload file, verify parsing, check category suggestions, review duplicate detection, complete import, and verify transactions in database
  - [ ] 7.2 Test error scenarios - Invalid OFX file, file too large, malformed data, network errors, database errors, and verify user-friendly error messages
  - [ ] 7.3 Test duplicate detection accuracy - Import same file twice, verify duplicates are flagged, test with slightly different amounts/dates, and confirm user can override flags
  - [ ] 7.4 Test category suggestion accuracy - Verify suggestions match historical patterns, check confidence levels are accurate, and test with transactions that have no history
  - [ ] 7.5 Test edge cases - Empty OFX file, single transaction, very large file (>1000 transactions), special characters in descriptions, and future-dated transactions
  - [ ] 7.6 Verify accessibility - Keyboard navigation through wizard, screen reader compatibility, focus management, and ARIA labels on interactive elements
  - [ ] 7.7 Performance testing - Measure parse time for large files, test UI responsiveness during import, verify database batch insert performance, and optimize if needed
  - [ ] 7.8 Add loading skeletons for async operations in dialog
  - [ ] 7.9 Verify mobile responsiveness of dialog and table components
  - [ ] 7.10 Final code review - Check for console errors, verify all TypeScript types are correct, ensure error boundaries are in place, confirm revalidation works correctly, and verify no memory leaks in dialog state
  - [ ] 7.11 Update documentation if needed - Add comments to complex functions and document any assumptions or limitations

## Tutorial: OFX Import Feature

### Setup Complete (Task 1.0)

The infrastructure for the OFX import feature has been set up:

1. **Packages Installed:**

   - `node-ofx-parser` (v0.5.1) - For parsing OFX files
   - `fuzzysort` (v3.1.0) - For fuzzy string matching in category suggestions

2. **Directory Structure Created:**

   - `lib/ofx/` - Contains all OFX-related business logic

     - `types.ts` - Type definitions
     - `parser.ts` - OFX file parsing
     - `mapper.ts` - Data transformation
     - `duplicate-detector.ts` - Duplicate detection
     - `category-suggester.ts` - Smart category suggestions

   - `components/contas/ofx-import/` - Contains UI components
     - `types.ts` - Component type definitions
     - `ofx-import-dialog.tsx` - Main wizard dialog
     - `upload-step.tsx` - File upload interface
     - `review-step.tsx` - Transaction review table
     - `confirm-step.tsx` - Final confirmation screen

3. **Next Steps:**
   - Implement OFX parsing logic (Task 2.0)
   - Build UI components (Task 3.0)
   - Add smart features (Task 4.0)
   - Create server actions (Task 5.0)
   - Integrate with account pages (Task 6.0)
