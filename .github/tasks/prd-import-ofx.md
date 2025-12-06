# Product Requirements Document: OFX Import Feature

## Introduction/Overview

The OFX Import feature enables users to import bank transactions from OFX (Open Financial Exchange) files directly into Opensheets. This feature eliminates manual data entry by automatically parsing OFX files from Brazilian banks (initially Itaú) and intelligently mapping transactions to existing categories and accounts. Users will be able to review, edit, and selectively import transactions before they are saved to the database.

**Problem Solved:** Manual transaction entry is time-consuming and error-prone. Users often download bank statements in OFX format but must manually recreate each transaction in the system.

**Goal:** Provide a seamless, wizard-based import process that reduces data entry time by 90%+ while maintaining data accuracy through intelligent mapping and duplicate detection.

## Goals

1. Enable users to import OFX files (both 1.x SGML and 2.x XML formats) from the account statement page
2. Automatically map OFX transaction data to existing categories based on historical patterns
3. Detect and flag potential duplicate transactions to prevent data duplication
4. Allow users to review and selectively import transactions with full editing capabilities
5. Maintain data integrity by validating all imported transactions before saving
6. Provide clear feedback about import success/failure with detailed error handling

## User Stories

1. **As a user**, I want to import my bank statement OFX file so that I don't have to manually enter each transaction.

2. **As a user**, I want the system to automatically suggest categories for imported transactions based on my previous categorization patterns so that I can quickly approve the import.

3. **As a user**, I want to see which transactions might be duplicates before importing so that I don't accidentally create duplicate records.

4. **As a user**, I want to review all imported transactions and edit their details (name, category) before saving so that I can ensure data accuracy.

5. **As a user**, I want to set default values for mandatory fields that aren't in the OFX file so that all imported transactions are complete.

6. **As a user**, I want to selectively import only the transactions I need so that I have full control over what gets saved to my database.

## Functional Requirements

### FR1: Import Button Location

- Each account card in `/contas/{contaId}/extrato` must have an "Importar OFX" button
- The button should be visually accessible next to other account actions (edit, transfer, remove)
- Button should only be enabled for active accounts

### FR2: OFX File Upload & Parsing

- System must accept OFX files in both 1.x (SGML) and 2.x (XML) formats
- System must parse the following OFX fields:
  - `TRNTYPE` (transaction type: DEBIT/CREDIT)
  - `DTPOSTED` (posted date)
  - `TRNAMT` (transaction amount)
  - `FITID` (unique transaction identifier)
  - `MEMO` (transaction description)
  - `BANKACCTFROM.ACCTID` (account identifier)
- System must validate OFX structure and show detailed errors for malformed files
- System must attempt to fix common format issues automatically (missing closing tags, encoding issues)

### FR3: Wizard-Based Import Flow

The import process must follow these steps:

**Step 1: Upload File**

- File picker component with drag-and-drop support
- File validation (size limit: 5MB, format validation)
- Parse file and show summary (date range, transaction count)

**Step 2: Configure Defaults**

- Allow user to set default values for:
  - Transaction type (Despesa/Receita) - auto-detect from TRNTYPE
  - Payment method (always "Débito" for bank accounts)
  - Pagador (default to authenticated user's default pagador)
  - Category (optional default for all transactions)
- Show preview of how defaults will be applied

**Step 3: Map & Review Transactions**

- Display table with all transactions from OFX
- For each transaction show:
  - Checkbox (checked by default, unchecked for suspected duplicates)
  - Date (`DTPOSTED`)
  - Description (`MEMO`)
  - Amount (`TRNAMT`)
  - Suggested category (with confidence indicator)
  - Warning icon if potential duplicate detected
- Allow inline editing of:
  - Transaction name/description
  - Category selection
- Bulk actions:
  - Select/deselect all
  - Bulk category assignment for selected transactions
- Show duplicate detection warnings with explanation

**Step 4: Confirm & Import**

- Summary of transactions to be imported
- Count of selected vs. total transactions
- Option to go back and adjust
- Import button with progress indicator

### FR4: Intelligent Category Mapping

- System must analyze past transactions (`lancamentos` table) to suggest categories
- Matching algorithm:
  1. Exact match on transaction description (case-insensitive)
  2. Fuzzy match on description (similarity > 70%)
  3. Consider transaction amount patterns for same establishment
- Display confidence level: High (>90%), Medium (70-90%), Low (<70%)
- If no match found, leave category empty for user to select

### FR5: Duplicate Detection

- Detect potential duplicates using:
  - Same date + same amount + similar description (>80% similarity)
  - Same `FITID` if previously imported
- Flag suspected duplicates with:
  - Checkbox unchecked by default
  - Warning badge with "Possível duplicata" message
  - Link to view existing transaction
- Allow user to override and import anyway

### FR6: Default Values Configuration

- Mandatory fields that may be missing from OFX:
  - `categoriaId` - allow user to set default or leave blank
  - `pagadorId` - default to authenticated user's primary pagador
  - `transactionType` - auto-derive from `TRNTYPE` (DEBIT = Despesa, CREDIT = Receita)
  - `paymentMethod` - always "Débito" for bank account imports
  - `condition` - always "à vista" for bank imports
  - `period` - derive from transaction date (YYYY-MM)
- Allow per-transaction override during review step

### FR7: Transaction Import & Persistence

- Create new `lancamentos` records for selected transactions
- Map OFX fields to database schema:
  ```
  OFX MEMO → lancamentos.name
  OFX DTPOSTED → lancamentos.purchaseDate + lancamentos.period
  OFX TRNAMT → lancamentos.amount (absolute value)
  OFX TRNTYPE → lancamentos.transactionType (DEBIT=Despesa, CREDIT=Receita)
  User selection → lancamentos.categoriaId
  User default → lancamentos.pagadorId
  Account ID → lancamentos.contaId
  "Débito" → lancamentos.paymentMethod
  "à vista" → lancamentos.condition
  ```
- Add note to each imported transaction: `"Importado de OFX em {import_date}"`
- Mark all imported transactions as `isSettled = true` (already occurred)
- Use database transaction to ensure all-or-nothing import
- Revalidate account page after successful import

### FR8: Error Handling & User Feedback

- Show clear error messages for:
  - Invalid OFX file format
  - Parsing errors with line/column information
  - Network/database errors during import
  - Validation failures
- Provide recovery options:
  - Download error log
  - Retry import
  - Edit problematic transactions
- Success confirmation:
  - Toast notification with count of imported transactions
  - Automatically close wizard
  - Refresh account statement to show new transactions

### FR9: Import History Tracking

- Add standardized note to each imported transaction
- Note format: `"Importado de OFX em {DD/MM/YYYY às HH:mm}"`
- This allows users to:
  - Filter imported transactions
  - Identify which transactions came from imports
  - Track when data was imported

## Non-Goals (Out of Scope)

1. **Scheduled/Automatic Imports**: This version does not include automatic polling or scheduled imports from banks
2. **Direct Bank Integration**: No direct API connection to banks; only file-based imports
3. **AI-Powered Category Suggestions**: Version 1.0 uses rule-based matching; AI suggestions are planned for v2.0
4. **Credit Card OFX Imports**: Initial release focuses on bank accounts (checking/savings); credit cards will be added later
5. **Multi-Account Import**: Cannot import OFX files for multiple accounts simultaneously; must be done one at a time
6. **OFX Export**: This PRD covers import only; export functionality is out of scope
7. **Transaction Reconciliation**: Advanced reconciliation features (matching pending vs. settled) are not included
8. **Edit After Import**: Once imported, transactions follow standard edit workflow; no special "undo import" feature

## Design Considerations

### UI/UX Requirements

**Modal/Dialog Structure:**

- Use shadcn/ui Dialog component with max-width of 1200px for review step
- Wizard should be non-dismissible (requires explicit cancel action)
- Progress indicator showing current step (1/4, 2/4, etc.)

**Import Button:**

- Location: Account statement page (`/contas/{contaId}/extrato`)
- Style: Secondary button with download icon
- Label: "Importar OFX"
- Position: Next to edit button in account actions area

**Transaction Table (Review Step):**

- Use shadcn/ui Table component
- Columns: Checkbox, Date, Description, Amount, Category (editable), Duplicate Warning
- Sortable by date and amount
- Fixed header with sticky positioning
- Max height: 60vh with scroll

**Category Selector:**

- Use shadcn/ui Combobox for searchable category selection
- Show confidence indicator next to suggested categories:
  - High: Green checkmark
  - Medium: Yellow circle
  - Low: Gray circle
- Allow "None" selection (empty category)

**Duplicate Warning:**

- Use Alert component with warning variant
- Show comparison: "Similar to: [Transaction Name] on [Date] with [Amount]"
- Link to view existing transaction (opens in new tab)

### Accessibility

- Full keyboard navigation support
- ARIA labels for all interactive elements
- Focus management when wizard opens/closes
- Screen reader announcements for important state changes

## Technical Considerations

### Dependencies

- **OFX Parser**: Use `node-ofx-parser` npm package for parsing OFX files

  - Install: `pnpm add node-ofx-parser`
  - Handles both OFX 1.x and 2.x formats
  - TypeScript support available

- **Fuzzy Matching**: Use `fuzzysort` for description similarity matching
  - Install: `pnpm add fuzzysort`
  - Fast and accurate string matching
  - No configuration needed

### File Structure

```
app/(dashboard)/contas/[contaId]/extrato/
  └── actions.ts                    # Server actions for OFX import

lib/ofx/
  ├── parser.ts                     # OFX parsing logic
  ├── mapper.ts                     # OFX → lancamento mapping
  ├── duplicate-detector.ts         # Duplicate detection logic
  └── category-suggester.ts         # Category suggestion algorithm

components/contas/
  └── ofx-import/
      ├── ofx-import-dialog.tsx     # Main wizard component
      ├── upload-step.tsx           # File upload step
      ├── defaults-step.tsx         # Configure defaults step
      ├── review-step.tsx           # Map & review step
      └── confirm-step.tsx          # Confirmation step
```

### Server Actions

Create new server action in `app/(dashboard)/contas/[contaId]/extrato/actions.ts`:

- `parseOfxFileAction(file: File)` - Parse OFX and return transactions
- `importOfxTransactionsAction(accountId, transactions, defaults)` - Import transactions to DB

### Database Schema

No changes required to existing schema. Use existing `lancamentos` table with these conventions:

- `note` field includes import timestamp
- `isSettled` always `true` for imported transactions
- `contaId` links to the account being imported to

### Performance

- Stream large OFX files instead of loading entire file into memory
- Batch database inserts (use Drizzle's batch insert)
- Limit OFX file size to 5MB (approximately 10,000 transactions)
- Use pagination in review step if >200 transactions

### Security

- Validate file type on server-side (not just client-side)
- Sanitize all OFX data before displaying (prevent XSS)
- Use authenticated user's ID for all database operations
- Rate limit import actions (max 10 imports per hour per user)

## Success Metrics

1. **Adoption Rate**: 60%+ of users with active accounts try the OFX import feature within 30 days of release
2. **Import Success Rate**: 95%+ of import attempts complete successfully without errors
3. **Time Savings**: Average time to add 50 transactions reduced from 15 minutes (manual) to 2 minutes (import)
4. **Category Accuracy**: 70%+ of auto-suggested categories are accepted without modification
5. **Duplicate Prevention**: <2% of imported transactions are actual duplicates that slip through detection
6. **User Satisfaction**: Feature receives >4.0/5.0 rating in user feedback surveys

## Open Questions

1. **Q: Should we support QFX (Quicken) format in addition to OFX?**
   A: Defer to v2.0 - focus on OFX for MVP

2. **Q: How should we handle transactions with future dates in the OFX file?**
   A: Import them as scheduled/pending transactions (`isSettled = false`)

3. **Q: What if the OFX account ID doesn't match any existing `conta` in the system?**
   A: Allow user to manually select which account to import to; don't auto-create accounts

4. **Q: Should we store the original OFX file for audit purposes?**
   A: No for v1.0 - only store the import timestamp in transaction notes

5. **Q: How do we handle currency conversions for international transactions in OFX?**
   A: Out of scope for v1.0 - assume all transactions are in BRL

6. **Q: Should users be able to edit the default values (pagador, payment method) per transaction during review?**
   A: Yes - allow inline editing of all fields except date and amount during review step

7. **Q: What happens if a user abandons the wizard mid-import?**
   A: No data is saved until final confirmation step; safe to abandon at any point

## Implementation Notes

### Phase 1: Foundation (Week 1)

- Set up OFX parser and test with provided Itaú file
- Create data mapping functions (OFX → lancamento schema)
- Build basic duplicate detection algorithm

### Phase 2: UI Components (Week 1-2)

- Implement wizard dialog shell with step navigation
- Create upload step with file validation
- Build transaction review table with inline editing

### Phase 3: Smart Features (Week 2)

- Implement category suggestion algorithm
- Add duplicate detection with visual warnings
- Create bulk edit actions

### Phase 4: Integration & Polish (Week 3)

- Connect UI to server actions
- Add loading states and error handling
- Implement success feedback and page refresh
- Write comprehensive tests

### Testing Strategy

- Unit tests for parser, mapper, and duplicate detector
- Integration tests for complete import flow
- Test with real OFX files from multiple banks (Itaú, Bradesco, Banco do Brasil)
- Test edge cases: empty files, malformed data, very large files
- Accessibility audit with screen reader testing

---

**Document Version:** 1.0  
**Last Updated:** December 6, 2025  
**Author:** Senior Solutions Architect  
**Status:** Ready for Implementation
