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

- [ ] 1.0 Setup Dependencies and CSV Parsing Infrastructure

- [ ] 2.0 Implement CSV Parsing and Column Mapping Logic

- [ ] 3.0 Build CSV Import UI Components (Upload & Column Mapping Steps)

- [ ] 4.0 Integrate with Existing OFX Infrastructure (Review & Confirm Steps)

- [ ] 5.0 Create CSV Import Server Actions

- [ ] 6.0 Integrate CSV Import into Transactions Page UI

- [ ] 7.0 Testing and Validation
