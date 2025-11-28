# PRD: OFX Bank File Import Feature

## 1. Introduction/Overview

This feature allows users to upload OFX (Open Financial Exchange) bank statement files to automatically import transactions into the Opensheets personal finance app. The goal is to streamline the process of adding large volumes of transaction data, reducing manual entry time and errors. Users can access this feature via a new option in the "/contas" (accounts) page, specifically on the bank account cards. The feature includes a step-by-step wizard to guide users through uploading, mapping, reviewing, and confirming imports, with built-in duplicate detection and category suggestions.

## 2. Goals

- Enable faster import of bank transactions compared to manual entry, especially for monthly statements with many records.
- Ensure imported transaction values exactly match the OFX file data to maintain accuracy.
- Provide an intuitive wizard interface that integrates seamlessly with the existing app design.
- Prevent duplicate transactions by detecting and handling existing records.
- Suggest categories based on historical data to reduce user effort.
- Use AI-powered categorization for improved accuracy and automation.

## 3. User Stories

- As an individual user managing personal finances, I want to upload an OFX file from my bank so that I can quickly import a month's worth of transactions without entering them one by one.
- As a personal finance user, I want the system to auto-suggest categories for imported transactions based on my existing records so that I can review and adjust them easily during the import process.
- As a user importing bank data, I want to be warned about potential duplicates and have options to skip, update existing transactions, or import as new so that I avoid data inconsistencies.
- As a user, I want the import wizard to maintain the app's style and feel familiar so that I can use it confidently.

## 4. Functional Requirements

1. The system must display an "Import OFX" button on each bank account card in the "/contas" page.
2. The system must allow users to upload a single OFX file via a file input in the wizard.
3. The system must parse the OFX file and extract transaction data (date, amount, description, etc.).
4. The system must auto-suggest mappings for OFX fields to app fields (e.g., date, amount, description), allowing users to confirm or change them.
5. The system must attempt to guess categories for transactions based on existing app records (e.g., matching descriptions to past transactions).
6. The system must use AI-powered categorization to suggest categories for transactions not matched by historical data, using the app's existing AI integration (e.g., @ai-sdk providers like OpenAI, Anthropic, or Google).
7. The system must allow users to review and edit suggested categories and other fields during the wizard.
8. The system must detect potential duplicate transactions by comparing key fields (e.g., date, amount, description) with existing records.
9. The system must display warnings for duplicates, offering options to skip, update the existing transaction, or import as new.
10. The system must validate that imported values exactly match the OFX file data.
11. The system must save imported transactions to the selected bank account in the database.
12. The system must revalidate the dashboard or transaction list after successful import.
13. The system must handle errors gracefully (e.g., invalid file format) and display user-friendly messages.

## 5. Non-Goals (Out of Scope)

- Support for file formats other than OFX (e.g., CSV, PDF).
- Bulk import of multiple files in a single session.
- Integration with live bank APIs for automatic downloads.
- Export functionality for transactions.

## 6. Design Considerations

- The wizard should use a modal or step-by-step interface consistent with the app's shadcn/ui components and Tailwind CSS styling.
- Progress indicators should be included for each step (upload, mapping, review, confirm).
- Error messages and warnings should use the app's standard alert components.
- The interface should be responsive and accessible, matching the overall app design.

## 7. Technical Considerations

- Use a library like `ofx-js` or similar for parsing OFX files (install via pnpm if needed).
- Implement the feature using Next.js server actions for file upload and processing.
- Validate file uploads on the server side for security and size limits.
- Store transactions using Drizzle ORM, ensuring relations to accounts, categories, etc.
- Use Zod for validating parsed data before insertion.
- Handle file parsing on the server to avoid client-side limitations.
- Ensure the feature integrates with existing auth (Better Auth) and revalidation patterns.
- For AI categorization: Use the app's existing AI integration (@ai-sdk with providers like OpenAI, Anthropic, Google). Create a categorization function similar to the insights generation, using generateObject with a schema for category suggestions based on transaction descriptions and historical data.

## 8. Success Metrics

- 95% of valid OFX files are parsed successfully without errors.
- Users can import a full month's transactions (typically 50-200 records) in under 5 minutes.
- Duplicate detection accuracy: 90% of actual duplicates are flagged.
- AI categorization accuracy: 80% of transactions are correctly categorized without manual intervention.
- User satisfaction: Positive feedback on ease of use in post-import surveys or reduced manual entry time.

## 9. Open Questions

- What is the maximum file size allowed for OFX uploads (e.g., 10MB)? 10MB
- How should currency mismatches be handled if the OFX file uses a different currency than the account? Ask for extrange rate and convert to real
- Should there be a limit on the number of transactions per import (e.g., 1000)? 999
- How to handle OFX files with incomplete data (e.g., missing descriptions)?
- What specific fields from OFX should be mapped (e.g., MEMO, NAME for description)?
- Which AI model/provider should be used for categorization (default to the same as insights)? you need to use the actual AI feature of the project that support many providers
- How to handle AI categorization failures (e.g., fallback to manual selection)? yes
- Should AI categorization be optional or always enabled? optional
  </content>
  <parameter name="filePath">/Users/dionizioferreira/Documents/Coding/github/opensheets-app/.github/tasks/prd-ofx-import.md
