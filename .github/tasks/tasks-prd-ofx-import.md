## Relevant Files

- `app/(dashboard)/contas/page.tsx` - Main accounts page where the Import OFX button will be added to account cards.
- `app/(dashboard)/contas/actions.ts` - Server actions for account-related operations (may need updates for import).
- `components/contas/contas-page.tsx` - Component for rendering account cards.
- `lib/ofx-parser/` - New directory for OFX parsing utilities.
- `lib/ofx-parser/actions.ts` - Server actions for OFX upload, parsing, and import.
- `lib/ofx-parser/schemas.ts` - Zod schemas for OFX data validation.
- `lib/ofx-parser/categorization.ts` - AI-powered categorization logic.
- `lib/schemas/ofx.ts` - Zod schemas for OFX file structure.
- `components/ofx-import/` - New directory for OFX import wizard components.
- `components/ofx-import/ofx-import-wizard.tsx` - Main wizard component.
- `components/ofx-import/steps/` - Subdirectory for individual wizard steps.
- `db/schema.ts` - May need updates if new fields are required for imports.
- `lib/utils/currency.ts` - Utility for currency conversion (extend for exchange rates).
- `lib/utils/ai.ts` - Utility for AI categorization (reuse from insights).

### Notes

- Unit tests should be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [ ] 1.0 Set up OFX parsing infrastructure
  - [x] 1.1 Research and select an OFX parsing library (e.g., ofx-js, node-ofx-parser) compatible with the project
  - [x] 1.2 Install the selected OFX library using pnpm
  - [x] 1.3 Create Zod schemas in `lib/schemas/ofx.ts` for OFX file structure and transaction data validation
  - [x] 1.4 Implement basic OFX file parsing function in `lib/ofx-parser/parser.ts` that extracts transactions
  - [x] 1.5 Add file type validation to ensure only .ofx files are accepted
  - [x] 1.6 Test parsing with sample OFX files to ensure data extraction works correctly
- [x] 2.0 Implement AI categorization system
  - [x] 2.1 Create `lib/utils/ai-categorization.ts` utility reusing the existing AI integration from insights
  - [x] 2.2 Define a Zod schema for AI categorization responses (category suggestions with confidence scores)
  - [x] 2.3 Create a system prompt for transaction categorization based on description and historical data
  - [x] 2.4 Implement the categorization function using generateObject with multiple provider support
  - [x] 2.5 Add fallback logic to historical matching when AI fails or is disabled
  - [x] 2.6 Create a function to combine AI suggestions with historical matches for better accuracy
  - [x] 2.7 Add user preference handling for enabling/disabling AI categorization

### Tutorial: Using the AI Categorization System

The AI categorization system automatically suggests categories for transactions during OFX import. Here's how it works:

1. **Basic Usage**: Call `categorizeTransaction()` with transaction details:

   ```typescript
   import { categorizeTransaction } from "@/lib/utils/ai-categorization";

   const result = await categorizeTransaction(
     "UBER TRIP", // transaction name
     25.5, // amount
     availableCategories, // array of category objects
     "gpt-4", // AI model ID
     userId // optional user ID for historical matching
   );
   ```

2. **Response Structure**: Returns a `CombinedCategorization` object with:

   - `primarySuggestion`: Best category match with confidence score
   - `alternativeSuggestions`: Up to 4 additional suggestions
   - `historicalMatch`: Historical transaction data if available

3. **Provider Support**: Supports multiple AI providers:

   - OpenAI: `"gpt-4"`, `"gpt-3.5-turbo"`
   - Anthropic: `"claude-3-sonnet-20240229"`
   - Google: `"gemini-1.5-pro"`
   - OpenRouter: `"anthropic/claude-3.5-sonnet"`

4. **Fallback Logic**: If AI fails, automatically falls back to:

   - Historical transaction matching (last 6 months)
   - Default category ("Outros") as last resort

5. **Testing**: Run the test file to verify functionality:

   ```bash
   npx tsx lib/utils/test-ai-categorization.ts
   ```

6. **Environment Variables**: Ensure AI provider API keys are set:
   - `OPENAI_API_KEY` for OpenAI models
   - `ANTHROPIC_API_KEY` for Claude models
   - `GOOGLE_GENERATIVE_AI_API_KEY` for Gemini
   - `OPENROUTER_API_KEY` for OpenRouter models

- [ ] 3.0 Build OFX import wizard UI
  - [x] 3.1 Create the main wizard modal component in `components/ofx-import/ofx-import-wizard.tsx` using shadcn/ui Dialog

### Tutorial: Using the OFX Import Wizard

The OFX import wizard provides a step-by-step interface for importing bank transactions. Here's how to use it:

1. **Opening the Wizard**: The wizard is triggered from the accounts page by clicking the "Import OFX" button on any account card.

2. **Wizard Structure**: The wizard consists of 4 steps:

   - **Upload**: File selection with drag-and-drop support
   - **Mapping**: Field configuration (to be implemented)
   - **Review**: Transaction editing and duplicate detection (to be implemented)
   - **Confirm**: Final import confirmation (to be implemented)

3. **Navigation**: Use "Anterior" and "Próximo" buttons to navigate between steps. The progress bar shows current progress.

4. **File Upload Features**:

   - Drag and drop support for OFX files
   - Click to browse files manually
   - File type validation (.ofx only)
   - File size limit (10MB)
   - Visual feedback for selected files

5. **Responsive Design**: The wizard adapts to different screen sizes with proper mobile support.

6. **Accessibility**: Includes proper ARIA labels, keyboard navigation, and screen reader support.

7. **Integration**: Pass `accountId` and `accountName` props to associate transactions with the correct account.

```tsx
import { OFXImportWizard } from "@/components/ofx-import/ofx-import-wizard";

// Usage in accounts page
<OFXImportWizard
  open={wizardOpen}
  onOpenChange={setWizardOpen}
  accountId={selectedAccount.id}
  accountName={selectedAccount.name}
/>;
```

- [x] 3.2 Implement step navigation logic with progress indicators
- [x] 3.3 Create file upload step component with drag-and-drop support and file validation
- [x] 3.4 Build field mapping step showing auto-suggested mappings with edit capabilities

### Tutorial: Using the Field Mapping Step

The field mapping step allows users to configure how OFX file fields are mapped to application fields. Here's how it works:

1. **Auto-Suggested Mappings**: The system automatically suggests mappings based on common OFX standards:

   - OFX `date` → Application `purchaseDate`
   - OFX `amount` → Application `amount`
   - OFX `description`/`payee` → Application `name`
   - OFX `type` → Application `transactionType`
   - OFX `id` → Application `note`

2. **Interactive Editing**: Click "Editar" to modify mappings:

   - Select different application fields for each OFX field
   - Choose "Não mapear" to skip unwanted OFX fields
   - Visual arrows show the mapping relationships

3. **Field Validation**: The interface shows:

   - **Required fields** marked with badges
   - **Mapping summary** with statistics:
     - Total mapped fields
     - Required fields properly mapped
     - Optional fields mapped
     - Missing required mappings

4. **Dual View**: The interface displays both:

   - **OFX Fields** (left): Shows available fields from the uploaded file
   - **Application Fields** (right): Shows target fields with mapping sources

5. **Smart Defaults**: Mappings are pre-configured for typical OFX files but can be customized for specific bank formats.

```typescript
// Example mapping configuration
const mappings = {
  date: "purchaseDate", // OFX date → purchase date
  amount: "amount", // OFX amount → transaction amount
  description: "name", // OFX description → transaction name
  payee: "name", // OFX payee → transaction name (combined)
  type: "transactionType", // OFX type → receita/despesa
  id: "note", // OFX ID → additional notes
};
```

6. **Validation Logic**: The step prevents progression if required application fields are not mapped from at least one OFX field.

### Tutorial: Using the Transaction Review Step

The transaction review step provides an editable table for reviewing and adjusting parsed OFX transactions before import. Here's how it works:

1. **Transaction Overview**: The step displays all parsed transactions in a comprehensive table with:

   - **Summary Cards**: Shows counts for valid, warning, and error transactions, plus AI usage statistics
   - **Editable Table**: Columns for date, description, amount, category, status, and AI indicators

2. **AI-Powered Categorization**:

   - **Magic Wand Icons** (✨) indicate transactions with AI suggestions
   - **Category Dropdown**: Shows AI suggestions first with confidence percentages (e.g., "Transporte - 95%")
   - **Manual Override**: Users can select different categories or keep AI suggestions

3. **Duplicate Detection**:

   - **"Duplicata" Badge**: Red badges mark potential duplicate transactions
   - **Warning Status**: Orange alerts for transactions needing attention
   - **Validation Icons**: Green checkmarks for valid, orange warnings for issues, red errors for problems

4. **Interactive Editing**:

   - **Bulk Selection**: Checkboxes for selecting multiple transactions
   - **Bulk Actions**: Apply categories, mark as valid, or delete multiple transactions at once
   - **Inline Editing**: Click category dropdowns to change assignments instantly

5. **Transaction Details**:

   - **Payee Information**: Shows both description and payee when available
   - **Amount Formatting**: Proper currency display with color coding (green for credits, red for debits)
   - **Date Display**: Formatted as dd/MM/yyyy for Brazilian locale

6. **Validation Summary**: Before proceeding, the step ensures:
   - All transactions have assigned categories
   - No critical validation errors remain
   - Duplicate handling preferences are set

```typescript
// Example transaction data structure
interface TransactionItem {
  id: string;
  date: string; // "2024-01-15"
  amount: number; // -25.50 (negative for debits)
  description: string; // "UBER TRIP"
  payee?: string; // "UBER"
  type: "debit" | "credit";
  categoryId: string | null;
  categoryName: string | null;
  isDuplicate: boolean;
  validationStatus: "valid" | "warning" | "error";
  aiSuggestions: Array<{
    categoryId: string;
    categoryName: string;
    confidence: number; // 0.95
  }>;
}
```

7. **Progress Tracking**: The step prevents advancement until all critical issues are resolved, ensuring data quality before import.

### Tutorial: Using the Confirmation Step

The confirmation step provides a comprehensive final review before importing transactions into the system. Here's how it works:

1. **Import Summary Dashboard**: The step displays key statistics in an overview:

   - **Total Transactions**: Complete count of parsed transactions
   - **Valid Transactions**: Number ready for import (green checkmark)
   - **Warnings**: Transactions with issues needing attention (orange alert)
   - **Errors**: Transactions with critical problems (red warning)

2. **Account and File Information**:

   - **Destination Account**: Shows selected account name and ID
   - **OFX File Details**: File name, size, and last modification date
   - **Field Mappings**: Summary of how OFX fields were mapped to application fields

3. **Financial Overview**:

   - **Revenue Summary**: Total credit amounts (green)
   - **Expense Summary**: Total debit amounts (red)
   - **Net Balance**: Calculated difference between credits and debits

4. **Category Distribution**:

   - **Category Breakdown**: Shows how many transactions per category
   - **Amount Totals**: Sum amounts for each category with color coding
   - **Sorted by Frequency**: Most used categories appear first

5. **Issue Detection and Warnings**:

   - **Duplicate Alerts**: Highlights transactions marked as duplicates
   - **Validation Errors**: Lists transactions with critical validation issues
   - **Missing Categories**: Warns about transactions without category assignments

6. **Import Readiness Check**:

   - **Status Indicator**: Green checkmark when ready, orange warning when issues exist
   - **Import Button**: Enabled only when all validations pass
   - **Review Option**: "Revisar Novamente" button to return to previous steps

7. **Final Actions**:
   - **Confirm Import**: Large primary button to execute the import
   - **Cancel/Review**: Options to go back and make changes
   - **Progress Feedback**: Clear messaging about what will be imported

```typescript
// Example confirmation data structure
interface ConfirmationData {
  summary: {
    total: number;
    valid: number;
    warnings: number;
    errors: number;
    duplicates: number;
    withCategories: number;
  };
  financials: {
    credits: number;
    debits: number;
    net: number;
  };
  categories: Record<
    string,
    {
      count: number;
      totalAmount: number;
    }
  >;
  canImport: boolean; // true when all validations pass
}
```

8. **Validation Logic**: The step prevents import if:

   - Any transactions have validation errors
   - Transactions lack category assignments
   - Critical mapping issues exist

9. **User Experience**: The interface provides clear visual feedback and prevents accidental imports of problematic data, ensuring data quality and user confidence in the import process.

### Tutorial: Using Duplicate Detection and Handling

The duplicate detection system automatically identifies potential duplicate transactions during OFX import and provides user-friendly options for resolution. Here's how it works:

1. **Automatic Detection**: When transactions are loaded in the review step, the system automatically:

   - Queries existing transactions from the last 90 days
   - Compares date, amount, and description similarity
   - Uses fuzzy string matching for flexible description comparison
   - Flags transactions with similarity scores above 70%

2. **Visual Indicators**:

   - **"Duplicata" Badge**: Red badges mark potential duplicate transactions
   - **Similarity Score**: Shows percentage match (e.g., "95% similar")
   - **Existing Transaction**: Displays the matching transaction description
   - **Warning Status**: Orange validation status for duplicates requiring attention

3. **Resolution Options**: For each duplicate transaction, users can choose:

   - **Pular (Skip)**: Don't import this transaction (default for high-confidence duplicates)
   - **Importar (Import)**: Import as a new transaction despite the duplicate
   - **Atualizar (Update)**: Update the existing transaction with new information

4. **Bulk Operations**: For multiple duplicates, use bulk actions:

   - **"Pular Todas"**: Skip all duplicate transactions
   - **"Importar Todas"**: Import all duplicate transactions as new
   - Individual resolution takes precedence over bulk actions

5. **Duplicate Detection Algorithm**:

   - **Date Matching**: Exact date matches get highest weight
   - **Amount Matching**: Exact amount matches are strongly considered
   - **Description Similarity**: Uses Levenshtein distance for fuzzy matching
   - **Combined Scoring**: Multi-factor algorithm prevents false positives

6. **Validation Integration**: Duplicate transactions are marked with "warning" status and default to "skip" action, preventing accidental duplicate imports while allowing user override.

```typescript
// Example duplicate detection result
interface DuplicateDetectionResult {
  isDuplicate: boolean;
  matches: Array<{
    existingTransactionId: string;
    similarity: number; // 0.95 = 95% match
    matchReasons: string[]; // ["exact_date", "exact_amount", "similar_description"]
  }>;
  bestMatch?: {
    existingTransactionId: string;
    similarity: number;
    matchReasons: string[];
  };
}
```

7. **API Integration**: Duplicate detection runs server-side via `/api/ofx/duplicate-detection` endpoint, ensuring secure database access and proper user authentication.

8. **Fallback Behavior**: If duplicate detection fails, transactions are marked as non-duplicates to prevent blocking the import process.

- [x] 4.0 Add import functionality to accounts page
  - [x] 4.1 Locate the account cards component in `components/contas/` and identify where to add the button
  - [x] 4.2 Add "Import OFX" button to each account card using shadcn/ui Button component
  - [x] 4.3 Implement button click handler to open the wizard modal with selected account context
  - [x] 4.4 Pass account ID to the wizard for transaction association
  - [x] 4.5 Update account page layout if needed to accommodate the new button
- [x] 5.0 Implement duplicate detection and handling
  - [x] 5.1 Create duplicate detection function comparing date, amount, and description with existing transactions
  - [x] 5.2 Implement similarity scoring for fuzzy matching of transaction descriptions
  - [x] 5.3 Add database query to find potential duplicates for the selected account
  - [x] 5.4 Create UI components for displaying duplicate warnings in the review step
  - [x] 5.5 Implement user options: skip, update existing, or import as new
  - [x] 5.6 Add validation to prevent accidental duplicate imports
- [x] 6.0 Integrate with database and validation
  - [x] 6.1 Create server action in `lib/ofx-parser/actions.ts` for handling the complete import process
  - [x] 6.2 Add robust validation logic to ensure all data is valid before import (required fields, categories, duplicates, permissions)
  - [x] 6.3 Implement currency conversion logic in `lib/utils/currency.ts` for exchange rate handling
  - [x] 6.4 Implement transaction insertion using Drizzle ORM with proper relations to accounts and categories
  - [x] 6.5 Add revalidation calls for "lancamentos" entity after successful import
  - [x] 6.6 Ensure all database operations are wrapped in transactions for consistency
- [ ] 7.0 Add error handling and edge cases
   - [x] 7.1 Implement file size validation (max 10MB) and transaction count limit (999)
  - [x] 7.2 Add error handling for invalid OFX files with user-friendly messages
   - [x] 7.3 Handle incomplete OFX data by skipping invalid transactions or using defaults
  - [ ] 7.4 Implement graceful handling of AI categorization failures with manual fallback
  - [ ] 7.5 Add timeout handling for long-running AI requests
  - [ ] 7.6 Create comprehensive error messages and user guidance for each failure scenario
- [ ] 8.0 Testing and validation
  - [ ] 8.1 Write unit tests for OFX parsing functions in `lib/ofx-parser/parser.test.ts`
  - [ ] 8.2 Write unit tests for AI categorization utility in `lib/utils/ai-categorization.test.ts`
  - [ ] 8.3 Write integration tests for the complete import flow in `app/(dashboard)/contas/actions.test.ts`
  - [ ] 8.4 Create end-to-end tests for the wizard UI components
  - [ ] 8.5 Test with real OFX files from different banks to ensure compatibility
  - [ ] 8.6 Validate duplicate detection accuracy and edge cases
  - [ ] 8.7 Test AI categorization with various transaction types and languages
