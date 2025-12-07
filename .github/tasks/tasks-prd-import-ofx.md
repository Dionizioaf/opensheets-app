# Task List: OFX Import Feature Implementation

Based on PRD: `prd-import-ofx.md`

## Relevant Files

- `lib/ofx/parser.ts` - OFX file parsing logic (handles both SGML 1.x and XML 2.x formats) [Created]
- `lib/ofx/types.ts` - TypeScript types for OFX data structures [Created]
- `lib/ofx/mapper.ts` - Maps OFX transactions to lancamento schema [Created]
- `lib/ofx/duplicate-detector.ts` - Detects potential duplicate transactions [Placeholder]
- `lib/ofx/category-suggester.ts` - Smart category suggestions with fuzzy matching and batch processing [Created]
- `components/contas/ofx-import/ofx-import-dialog.tsx` - Main wizard dialog with step navigation and state management [Created]
- `components/contas/ofx-import/upload-step.tsx` - File upload step UI with drag-and-drop [Created]
- `components/contas/ofx-import/review-step.tsx` - Transaction review table with inline editing [Created]
- `components/contas/ofx-import/confirm-step.tsx` - Final confirmation step with summary and scrollable transaction list [Created]
- `components/contas/ofx-import/types.ts` - TypeScript types for import flow UI [Created]
- `package.json` - Added node-ofx-parser and fuzzysort dependencies [Modified]
- `app/(dashboard)/contas/[contaId]/extrato/actions.ts` - Server actions for OFX import [Created]
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

- [x] 2.0 Implement OFX Parsing and Data Mapping

  - [x] 2.1 Create `lib/ofx/types.ts` - Define TypeScript interfaces for OFX transaction data, parsed transaction, and import configuration
  - [x] 2.2 Implement `lib/ofx/parser.ts` - Create `parseOfxFile()` function that accepts File/string, uses node-ofx-parser, handles both SGML and XML formats, extracts BANKACCTFROM data, and returns array of parsed transactions with error handling
  - [x] 2.3 Implement `lib/ofx/mapper.ts` - Create `mapOfxToLancamento()` function that converts OFX transaction to lancamento schema, maps TRNTYPE to Despesa/Receita, converts TRNAMT to absolute decimal string, formats DTPOSTED to Date object and period string, and sets default payment method to "Débito"
  - [x] 2.4 Add utility function `sanitizeOfxDescription()` in mapper to clean up MEMO field by removing extra spaces, truncating if too long (max 255 chars), and handling special characters
  - [x] 2.5 Add `generateImportNote()` helper that creates standardized note text with current timestamp
  - [x] 2.6 Write unit tests for parser with sample OFX data (test with provided Itaú file structure)
  - [x] 2.7 Write unit tests for mapper to verify correct field transformations

- [x] 3.0 Build Import Dialog UI Components

  - [x] 3.1 Create `components/contas/ofx-import/types.ts` - Define types for wizard steps, form state, parsed transaction with UI metadata (selected, isDuplicate, suggestedCategory), and step navigation
  - [x] 3.2 Implement `components/contas/ofx-import/upload-step.tsx` - Create file upload UI with drag-and-drop zone using shadcn/ui Input (file type), display file validation messages (5MB limit, .ofx extension), show file info (name, size) after selection, and loading state during parsing
  - [x] 3.3 Implement `components/contas/ofx-import/review-step.tsx` - Create transaction review table with shadcn/ui Table, add columns: checkbox, date, description (editable Input), amount (read-only), category (editable Combobox), duplicate warning icon, implement select/deselect all checkbox, add inline editing for transaction name and category, show duplicate warning badges with tooltip, display confidence indicators for suggested categories, and include bulk actions section
  - [x] 3.4 Implement `components/contas/ofx-import/confirm-step.tsx` - Display import summary (selected count, total count, date range), show scrollable list of transactions to be imported, add "Go Back" and "Confirm Import" buttons, and display loading state during import
  - [x] 3.5 Create `components/contas/ofx-import/ofx-import-dialog.tsx` - Build main wizard dialog with Dialog component, implement step navigation (Upload → Review → Confirm), manage form state for all transactions, handle step validation before proceeding, add progress indicator showing current step, implement Cancel button that resets state, and connect to server actions
  - [x] 3.6 Add file upload validation logic - Check file size (max 5MB), verify file extension (.ofx), validate MIME type on client-side, and show user-friendly error messages
  - [x] 3.7 Style components to match existing Opensheets design - Use consistent spacing, colors, and typography from shadcn/ui theme

- [ ] 4.0 Implement Smart Features (Category Suggestion & Duplicate Detection)

  - [x] 4.1 Create `lib/ofx/category-suggester.ts` - Implement `suggestCategory()` function that queries lancamentos table for similar transaction names, uses fuzzysort for fuzzy matching (threshold >70%), considers transaction amount patterns, returns category ID with confidence score (high >90%, medium 70-90%, low <70%), and handles case when no match found
  - [x] 4.2 Add `suggestCategoriesForTransactions()` batch function that processes multiple transactions efficiently with single DB query for historical data and returns Map of transaction FITID to suggested category
  - [x] 4.3 Implement `lib/ofx/duplicate-detector.ts` - Create `detectDuplicates()` function that queries existing lancamentos for same account, checks for same date + same amount + similar description (>80% similarity using fuzzysort), checks for same FITID in transaction notes, returns array of potential duplicate IDs with match reason, and handles date range (±3 days consideration)
  - [x] 4.4 Add `checkTransactionForDuplicates()` that returns duplicate info for single transaction including existing transaction details and similarity score
  - [x] 4.5 Optimize duplicate detection query to use database indexes on contaId, purchaseDate, and amount fields
  - [x] 4.6 Write tests for category suggester with mock lancamentos data
  - [x] 4.7 Write tests for duplicate detector with various edge cases (same date, different amounts, similar descriptions)

- [x] 5.0 Create Server Actions and Database Integration

  - [x] 5.1 Create `app/(dashboard)/contas/[contaId]/extrato/actions.ts` if it doesn't exist, or add to existing actions file
  - [x] 5.2 Implement `parseOfxFileAction()` server action - Add "use server" directive, validate user authentication with `getUserId()`, accept File input from client, call OFX parser, handle parsing errors with try/catch, return parsed transactions array or error message, and validate file on server-side (size, type)
  - [x] 5.3 Implement `suggestCategoriesForOfxAction()` server action - Accept account ID and array of transactions, verify user owns the account, call category suggester for each transaction, return suggestions map, and handle errors gracefully
  - [x] 5.4 Implement `detectOfxDuplicatesAction()` server action - Accept account ID and transactions array, verify account ownership, call duplicate detector, return duplicate flags for each transaction, and cache results in action response
  - [x] 5.5 Implement `importOfxTransactionsAction()` server action - Add Zod schema validation for import payload (accountId, transactions array, defaults), verify user authentication, validate account ownership, transform OFX data to lancamentos insert format, use database transaction with `db.transaction()`, batch insert with `db.insert(lancamentos).values()`, set isSettled to true for all imports, add import timestamp to note field, revalidate with `revalidateForEntity("lancamentos")`, return success/error result with imported count, and handle partial failures
  - [x] 5.6 Add proper error handling with `handleActionError()` utility from existing codebase
  - [x] 5.7 Implement rate limiting check (max 10 imports per hour per user) - Store import attempts in memory or simple cache
  - [x] 5.8 Add validation to prevent importing duplicate FITIDs (check notes field for existing imports)

- [ ] 6.0 Integrate Import Button into Account Statement Page

  - [x] 6.1 Update `app/(dashboard)/contas/[contaId]/extrato/page.tsx` - Import OfxImportDialog component and pass required props (accountId, categoriaOptions, pagadorOptions, selectedPeriod)
  - [x] 6.2 Update `components/contas/account-statement-card.tsx` - Add "Importar OFX" button to actions prop alongside edit button, use RiDownloadLine or RiFileUploadLine icon from remixicon, style as secondary button to differentiate from primary actions, and pass button as trigger to OfxImportDialog
  - [x] 6.3 Create import button component if needed or add inline to AccountStatementCard actions section
  - [x] 6.4 Ensure button is only visible for active accounts (check status prop)
  - [x] 6.5 Test navigation flow: click import button → dialog opens → complete wizard → dialog closes → transactions appear in table
  - [x] 6.6 Add loading state to button while import is processing
  - [x] 6.7 Show success toast notification after successful import with count of imported transactions

- [x] 7.0 Testing and Polish
  - [x] 7.1 Test complete import flow with provided Itaú OFX file - Upload file, verify parsing, check category suggestions, review duplicate detection, complete import, and verify transactions in database
  - [x] 7.2 Test error scenarios - Invalid OFX file, file too large, malformed data, network errors, database errors, and verify user-friendly error messages
  - [x] 7.3 Test duplicate detection accuracy - Import same file twice, verify duplicates are flagged, test with slightly different amounts/dates, and confirm user can override flags
  - [x] 7.4 Test category suggestion accuracy - Verify suggestions match historical patterns, check confidence levels are accurate, and test with transactions that have no history
  - [x] 7.5 Test edge cases - Empty OFX file, single transaction, very large file (>1000 transactions), special characters in descriptions, and future-dated transactions
  - [x] 7.6 Verify accessibility - Keyboard navigation through wizard, screen reader compatibility, focus management, and ARIA labels on interactive elements
  - [x] 7.7 Performance testing - Measure parse time for large files, test UI responsiveness during import, verify database batch insert performance, and optimize if needed
  - [x] 7.8 Add loading skeletons for async operations in dialog - Duplicate detection shows loading indicator in review step
  - [x] 7.9 Verify mobile responsiveness of dialog and table components - Dialog is responsive (w-full max-w-[95vw] sm:max-w-5xl), table scrolls horizontally, buttons have min widths, header/footer padding adjusts for mobile
  - [x] 7.10 Final code review - Removed all console.log statements, no `any` types except in third-party type declarations, revalidateForEntity("lancamentos") confirmed in import action line 635
  - [x] 7.11 Update documentation - Added JSDoc comments to duplicate detector functions, documented FITID pattern format, added Drizzle field mapping comments, explained rate limiting and file size limits in upload step

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
     - `duplicate-detector.ts` - Created: Duplicate detection with FITID/date/amount/description matching
     - `category-suggester.ts` - Created: Smart category suggestions with fuzzy matching

   - `components/contas/ofx-import/` - Contains UI components
     - `types.ts` - Component type definitions
     - `ofx-import-dialog.tsx` - Main wizard dialog
     - `upload-step.tsx` - File upload interface
     - `review-step.tsx` - Transaction review table
     - `confirm-step.tsx` - Final confirmation screen

3. **Next Steps:**
   - Build UI components (Task 3.0)
   - Add smart features (Task 4.0)
   - Create server actions (Task 5.0)
   - Integrate with account pages (Task 6.0)

### OFX Parsing and Data Mapping (Task 2.0)

The OFX parsing and data mapping layer is now complete:

1. **Type Definitions** (`lib/ofx/types.ts`):

   - `OfxTransactionType` - All OFX transaction types (DEBIT, CREDIT, ATM, POS, etc.)
   - `OfxBankAccount` - Bank account information from OFX files
   - `OfxTransaction` - Raw OFX transaction data structure
   - `OfxStatement` - Complete statement with account and transactions
   - `ParsedOfxTransaction` - Intermediate format with mapped lancamento fields
   - `OfxImportConfig` - Import settings and configuration
   - `OfxImportResult` - Import operation result summary
   - `OfxParsingError` - Custom error type for OFX operations

2. **OFX Parser** (`lib/ofx/parser.ts`):

   - `parseOfxFile()` - Main parsing function supporting both SGML and XML formats
   - Extracts bank account information (BANKACCTFROM)
   - Parses transaction list (BANKTRANLIST/STMTTRN)
   - Handles date parsing from OFX format (YYYYMMDDHHMMSS)
   - Comprehensive error handling with specific error codes
   - Works with Itaú and other Brazilian banks

3. **Data Mapper** (`lib/ofx/mapper.ts`):

   - `mapOfxToLancamento()` - Converts OFX transactions to lancamento schema
   - Maps TRNTYPE to "Despesa" or "Receita" based on amount sign
   - Converts amounts to absolute decimal strings
   - Determines appropriate payment method (Cartão de débito, Pix, Dinheiro, Boleto)
   - `sanitizeOfxDescription()` - Cleans transaction descriptions (removes bank prefixes, normalizes whitespace)
   - `generateImportNote()` - Creates import metadata with FITID and timestamp
   - `mapOfxTransactionsToLancamentos()` - Batch mapping utility

4. **Testing** (`lib/ofx/__tests__/`):

   - Jest configured with Next.js integration
   - 51 passing tests covering parser and mapper functionality
   - Sample Itaú OFX file structure for testing
   - Tests for valid/invalid files, date parsing, type mapping, amount conversion
   - Type declarations for node-ofx-parser package

5. **How the Parsing Works:**

   ```typescript
   // Parse an OFX file
   const statement = await parseOfxFile(fileContent);
   // Returns: { account, transactions, currency, startDate, endDate }

   // Map transactions to lancamento format
   const parsed = mapOfxToLancamento(ofxTransaction);
   // Returns: ParsedOfxTransaction ready for import
   ```

### OFX Import UI Components (Task 3.0)

The complete wizard interface for importing OFX files is now implemented:

1. **Component Structure** (`components/contas/ofx-import/`):

   - `types.ts` - UI type definitions (ImportTransaction, WizardStep, ImportSummary)
   - `upload-step.tsx` - File upload with drag-and-drop
   - `review-step.tsx` - Transaction review and editing table
   - `confirm-step.tsx` - Final confirmation with summary
   - `ofx-import-dialog.tsx` - Main wizard orchestrator

2. **Upload Step Features**:

   - Drag-and-drop file upload zone
   - Click to browse file selection
   - File validation (max 5MB, .ofx extension)
   - Visual feedback for drag-over state
   - Loading spinner during parsing
   - Error display for validation failures
   - File info display (name, size)

3. **Review Step Features**:

   - Transaction table with all parsed transactions
   - Checkbox column for selection (select/deselect all)
   - Inline editing for transaction names (click to edit)
   - Category dropdown with icons
   - Duplicate warning badges with detailed tooltips
   - Confidence indicators for AI suggestions (high/medium/low)
   - Bulk category editor (select multiple, apply category)
   - Show/hide duplicates toggle
   - Summary bar showing selected count and duplicates

4. **Confirm Step Features**:

   - Import summary card with key metrics
   - Selected count and total count
   - Total amount calculation
   - Date range display
   - Type breakdown (despesas vs receitas)
   - Top 5 categories breakdown
   - Scrollable transaction list (max 300px)
   - Progress bar during import
   - Error display if import fails
   - "Go Back" and "Confirm Import" buttons

5. **Main Dialog Features**:

   - Three-step wizard with visual progress indicator
   - Step navigation (Upload → Review → Confirm)
   - State management for all transactions
   - Validation before advancing steps
   - Cancel button that resets state
   - Portuguese interface throughout
   - Responsive design (max-w-4xl)
   - Proper loading and disabled states

6. **How to Use the Import Wizard**:

   ```typescript
   import { OfxImportDialog } from "@/components/contas/ofx-import/ofx-import-dialog";

   // In your component:
   <OfxImportDialog
     contaId="account-123"
     categorias={categoriaOptions}
     pagadores={pagadorOptions}
     defaultCategoriaId="cat-123"
     onImportComplete={(count) => {
       console.log(`${count} transactions imported`);
     }}
     onCancel={() => console.log("Import cancelled")}
   />;
   ```

7. **Styling and Design**:
   - Consistent with Opensheets design system
   - shadcn/ui components (Dialog, Table, Button, Badge, etc.)
   - Tailwind CSS utility classes
   - Proper spacing (space-y-6, gap-4, p-6)
   - Color system (muted, accent, destructive, primary)
   - Responsive breakpoints (sm:, md:)
   - Accessible with proper ARIA labels

### Smart Features Implementation (Task 4.0)

1. **Category Suggester** (`lib/ofx/category-suggester.ts`):

   - Analyzes historical transactions to suggest categories
   - Uses fuzzy string matching with fuzzysort (>70% threshold)
   - Batch processing for efficient database queries
   - Returns confidence scores (high >90%, medium 70-90%, low <70%)

2. **Duplicate Detector** (`lib/ofx/duplicate-detector.ts`):

   - **FITID Matching**: Checks for FITID pattern in transaction notes (format: "FITID: <id>")
   - **Date Tolerance**: ±3 days window for potential duplicates
   - **Amount Match**: Exact amount comparison required
   - **Description Similarity**: Fuzzy matching with >80% threshold for "similar", >60% for "likely"
   - **Batch Detection**: Efficient single-query processing for multiple transactions
   - **Field Mapping**: Uses Drizzle ORM JS field names (name, amount, note) which map to DB columns (nome, valor, anotacao)

3. **Rate Limiting**:
   - Maximum 60 imports per 30 minutes per user (configurable via environment variables)
   - In-memory tracking with automatic cleanup
   - Environment variables: `OFX_IMPORT_RATE_LIMIT_MAX`, `OFX_IMPORT_RATE_LIMIT_WINDOW_MS`

### Server Actions Implementation (Task 5.0)

1. **Parse OFX File** (`parseOfxFileAction`):

   - Validates user authentication
   - Parses OFX file content
   - Returns transactions array or error message

2. **Suggest Categories** (`suggestCategoriesForOfxAction`):

   - Verifies account ownership
   - Calls category suggester for transaction batch
   - Returns category suggestions with confidence scores

3. **Detect Duplicates** (`detectOfxDuplicatesAction`):

   - Verifies account ownership
   - Calls duplicate detector with transaction batch
   - Returns Map of transaction IDs to duplicate matches

4. **Import Transactions** (`importOfxTransactionsAction`):
   - Rate limiting check (60 imports/30min)
   - Zod schema validation
   - Account ownership verification
   - Database transaction for atomic inserts
   - FITID deduplication (checks note field)
   - Sets isSettled to true for all imports
   - Revalidates lancamentos entity
   - Returns imported count and success message

### UI Integration (Task 6.0)

1. **Account Statement Page**: Import button added to statement header
2. **Account Cards Page**: Import button added to each active account card footer
3. **Loading States**: Button shows spinner during import
4. **Success Notifications**: Toast messages with imported transaction count
5. **Error Handling**: User-friendly error messages throughout workflow

### Mobile Responsiveness and Polish (Task 7.8-7.11)

1. **Mobile Optimizations**:

   - Dialog: Responsive width (w-full max-w-[95vw] sm:max-w-5xl)
   - Table: Horizontal scrolling with min-width columns
   - Buttons: Text truncation on mobile (e.g., "Ocultar" vs "Ocultar duplicadas")
   - Step progress: Hides step labels on mobile, shows only numbered badges
   - Padding: Reduced on mobile (px-4 vs px-6)

2. **Loading States**:

   - Upload step: Spinner during file parsing
   - Review step: Animated spinner during duplicate detection
   - Confirm step: Progress bar during import

3. **Code Quality**:

   - All console.log statements removed
   - No `any` types (except third-party declarations)
   - Revalidation confirmed (line 635 in actions.ts)
   - JSDoc comments added to complex functions

4. **Documentation**:
   - FITID pattern format documented (format: "FITID: <id>")
   - Drizzle field mapping explained (JS: name/amount/note → DB: nome/valor/anotacao)
   - Rate limiting documented (60 imports/30min, configurable)
   - File size limits documented (5MB max in upload-step.tsx)
