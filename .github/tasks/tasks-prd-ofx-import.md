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
  - [ ] 3.2 Implement step navigation logic with progress indicators
  - [ ] 3.3 Create file upload step component with drag-and-drop support and file validation
  - [ ] 3.4 Build field mapping step showing auto-suggested mappings with edit capabilities
  - [ ] 3.5 Develop transaction review step with editable table showing categories, duplicates, and validation
  - [ ] 3.6 Create confirmation step with summary and final import button
  - [ ] 3.7 Add responsive design and accessibility features matching app standards
- [ ] 4.0 Add import functionality to accounts page
  - [ ] 4.1 Locate the account cards component in `components/contas/` and identify where to add the button
  - [ ] 4.2 Add "Import OFX" button to each account card using shadcn/ui Button component
  - [ ] 4.3 Implement button click handler to open the wizard modal with selected account context
  - [ ] 4.4 Pass account ID to the wizard for transaction association
  - [ ] 4.5 Update account page layout if needed to accommodate the new button
- [ ] 5.0 Implement duplicate detection and handling
  - [ ] 5.1 Create duplicate detection function comparing date, amount, and description with existing transactions
  - [ ] 5.2 Implement similarity scoring for fuzzy matching of transaction descriptions
  - [ ] 5.3 Add database query to find potential duplicates for the selected account
  - [ ] 5.4 Create UI components for displaying duplicate warnings in the review step
  - [ ] 5.5 Implement user options: skip, update existing, or import as new
  - [ ] 5.6 Add validation to prevent accidental duplicate imports
- [ ] 6.0 Integrate with database and validation
  - [ ] 6.1 Create server action in `lib/ofx-parser/actions.ts` for handling the complete import process
  - [ ] 6.2 Implement currency conversion logic in `lib/utils/currency.ts` for exchange rate handling
  - [ ] 6.3 Add transaction insertion using Drizzle ORM with proper relations to accounts and categories
  - [ ] 6.4 Implement data validation using Zod schemas before database insertion
  - [ ] 6.5 Add revalidation calls for "lancamentos" entity after successful import
  - [ ] 6.6 Ensure all database operations are wrapped in transactions for consistency
- [ ] 7.0 Add error handling and edge cases
  - [ ] 7.1 Implement file size validation (max 10MB) and transaction count limit (999)
  - [ ] 7.2 Add error handling for invalid OFX files with user-friendly messages
  - [ ] 7.3 Handle incomplete OFX data by skipping invalid transactions or using defaults
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
  - [ ] 8.7 Test AI categorization with various transaction types and languages</content>
        <parameter name="filePath">/Users/dionizioferreira/Documents/Coding/github/opensheets-app/.github/tasks/tasks-prd-ofx-import.md
