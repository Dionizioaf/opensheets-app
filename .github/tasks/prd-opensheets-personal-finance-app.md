# Product Requirements Document: Brazilian Personal Finance App

## 1. Introduction/Overview

This product is a personal finance management application for Brazilian users who want full control over their money without depending on automatic bank synchronization. The product combines daily transaction management, account and credit card control, budgeting, debt management, financial planning, reports, and AI-assisted analysis in a single Portuguese-language interface.

The app is designed for people who want to organize their financial life, avoid debt escalation, build an emergency fund, and make better decisions over time. The system must support manual registration and assisted import flows, because the core promise is not automation for its own sake, but clarity, ownership, and reliable financial context.

**Problem it solves:** Many personal finance tools either oversimplify the financial life of Brazilian users or depend heavily on bank integrations. That leaves gaps in areas such as installment purchases, boletos, Pix, debt tracking, shared expenses, monthly planning, and contextual financial guidance.

**Goal:** Build a complete personal finance platform for Brazilian users that helps them record, understand, plan, and improve their financial life, with generative AI acting as a practical assistant rather than a gimmick.

## 2. Product Goals

1. Enable users to manage their financial life in one place: accounts, cards, transactions, budgets, debts, and goals.
2. Help users prevent and reduce debt through visibility, alerts, projections, and structured debt management.
3. Support the financial reality of Brazil, including Pix, boletos, installments, recurring payments, and seasonal income or expenses.
4. Provide clear monthly and historical analysis that goes beyond transaction lists.
5. Offer assisted import workflows that reduce manual effort without removing user review.
6. Use generative AI to explain patterns, propose actions, and educate the user based on their real data.
7. Preserve user ownership and privacy through an architecture that can support self-hosted or privately controlled deployments.

## 3. Target Users and Personas

### Persona 1: Organized Individual

**Profile:** Salaried worker who wants better monthly control.

**Needs:** Track income and expenses, manage cards, avoid late payments, understand where money goes.

### Persona 2: Recovering From Debt

**Profile:** User dealing with credit card debt, overdraft, or informal loans.

**Needs:** See total obligations, compare payoff strategies, avoid rolling debt forward, and create a realistic recovery plan.

### Persona 3: Variable-Income Worker

**Profile:** Freelancer, self-employed worker, or commission-based professional.

**Needs:** Separate fixed and variable income, smooth cash flow, budget conservatively, and prepare for weak months.

### Persona 4: Shared Household Context

**Profile:** User who shares some financial context with another person but does not want full account sharing.

**Needs:** Track payer-related expenses, share read-only views when useful, and notify others of relevant transactions.

## 4. Core User Stories

1. **As a user**, I want to register my transactions manually so that I can keep a reliable financial history.
2. **As a user**, I want to import OFX and CSV files so that I reduce repetitive data entry.
3. **As a user**, I want to manage bank accounts, balances, and transfers so that I understand my money distribution.
4. **As a user**, I want to manage credit cards, invoices, and installments so that I can predict upcoming obligations.
5. **As a user**, I want to set monthly budgets and compare planned versus actual spending so that I can improve discipline.
6. **As a user**, I want to create financial goals and an emergency fund target so that I can plan for stability and future needs.
7. **As a user**, I want to track debts and compare payoff strategies so that I can get out of debt efficiently.
8. **As a user**, I want to see my projected balance over upcoming days and weeks so that I avoid overdraft, late fees, and card rollover.
9. **As a user**, I want to view reports and category history so that I can identify trends and behavioral patterns.
10. **As a user**, I want the AI assistant to explain my financial behavior and suggest realistic actions so that I can make better decisions.

## 5. Product Scope

### In Scope

- Authentication and protected dashboard
- Accounts, balances, and transfers
- Credit cards, invoices, and installment tracking
- Transaction management with rich filters and batch operations
- Categories and payer management
- Budgets by month and category
- Notes and tasks for financial context
- Reports and historical analysis
- Assisted import from OFX and CSV/Excel-derived CSV
- Financial goals and emergency fund tracking
- Debt management and renegotiation tracking
- Cash flow projection and risk alerts
- Generative AI insights and financial assistant features

### Out of Scope for Initial Delivery

- Native Open Finance integrations
- Automatic bank synchronization by default
- Investment portfolio management as a primary module
- Tax filing workflows
- Multi-company or business accounting support
- Autonomous AI actions that modify financial records without confirmation

## 6. Functional Requirements

### FR1: Authentication and Account Access

1. The system must support authenticated access via email and OAuth providers.
2. The system must restrict dashboard features to authenticated users only.
3. The system must allow users to update name, email, password, and delete the account.

### FR2: Dashboard and Monthly Overview

4. The system must provide a monthly dashboard centered on a selected financial period in `YYYY-MM` format.
5. The dashboard must summarize balances, invoices, upcoming obligations, recent transactions, category breakdowns, and high-level trends.
6. The dashboard must expose clear alerts for overdue invoices, pending boletos, risky card usage, and projected negative balance.

### FR3: Transaction Management

7. The system must allow users to create income, expense, and transfer transactions.
8. The system must support transaction fields including description, amount, date, payment method, payment condition, account or card, category, payer, notes, due date, and settlement status.
9. The system must support installment purchases, recurring transactions, boletos, payer splits, and future series editing.
10. The system must allow batch creation of transactions with shared default fields.
11. The system must provide rich filters by type, category, payer, account, card, condition, payment method, and text query.

### FR4: Accounts and Transfers

12. The system must allow users to create and manage bank or cash accounts with name, type, initial balance, status, logo, and notes.
13. Each account must expose a statement view showing opening balance, current balance, inflows, outflows, and settled transactions.
14. The system must register transfers as linked double-sided entries rather than silent balance adjustments.

### FR5: OFX and Statement Import

15. The system must support OFX import for eligible accounts.
16. The OFX flow must parse transactions, detect duplicates, suggest categories, optionally use AI assistance, and require review before confirmation.
17. The system must preserve traceability between imported source data and final transaction records when applicable.

### FR6: Credit Cards and Invoices

18. The system must allow users to manage credit cards with brand, limit, closing day, due day, linked account, logo, status, and notes.
19. The system must provide invoice views by period with total amount, payment status, payment date, limit usage, and transaction list.
20. The system must project the effect of current installments on future invoices.

### FR7: Budgets

21. The system must allow users to define monthly budgets by category.
22. The system must compare budgeted and actual values for the selected period.
23. The system must surface categories that are near or above budget limits.

### FR8: Goals and Emergency Fund

24. The system must allow users to create financial goals with title, target amount, target date, priority, and optional linked account.
25. The system must support emergency fund tracking as a first-class goal type.
26. The system must calculate emergency fund progress both in currency and in months of essential expenses.
27. The system must warn when user spending behavior threatens goal contributions or emergency fund stability.

### FR9: Debt Management

28. The system must allow users to register debts such as credit card rollover, overdraft, loans, financing, and informal debts.
29. The system must store debt fields including original amount, current balance, rate, CET when available, installment amount, due date, creditor, and status.
30. The system must compare at least two payoff strategies: snowball and avalanche.
31. The system must simulate interest savings for early payment when the debt structure supports it.
32. The system must support renegotiation tracking, including agreement amount, new schedule, and progress over time.

### FR10: Cash Flow Projection

33. The system must project future balances by account using known inflows and obligations.
34. The projection must consider recurring transactions, future installments, due boletos, expected salary or tagged recurring income, and planned transfers.
35. The system must highlight dates with risk of negative balance or cash pressure.
36. The system must allow users to simulate changes such as delaying payment, reducing spending, or anticipating debt settlement.

### FR11: Categories

37. The system must allow users to create, edit, and delete categories for income and expense.
38. The system must support icons and historical views for category evolution.
39. Categories must be usable in transactions, budgets, reports, imports, and AI analysis.

### FR12: Payers and Shared Context

40. The system must allow users to register payers with name, email, avatar, status, and notes.
41. The system must associate transactions with payers.
42. The system must provide payer analytics including monthly history, payment method usage, card usage, and boleto-related views.
43. The system must support read-only payer sharing by code.
44. The system must support optional automatic email notifications for relevant payer-linked transaction events.

### FR13: Reports and Analytics

45. The system must offer multi-period reports with category evolution, totals, and comparisons.
46. The system must support export to CSV, Excel, and PDF for supported reports.
47. The system must provide a financial calendar view for the selected period.
48. The system must provide health indicators such as savings rate, fixed-expense ratio, card utilization, and emergency fund coverage.

### FR14: Notes and Tasks

49. The system must allow users to create notes and task-like reminders related to their financial life.
50. Notes and tasks must live inside the app context and support practical financial follow-up.

### FR15: CSV and Spreadsheet Import

51. The system must support transaction import from CSV files.
52. The system must support client-side conversion of Excel files to CSV when applicable.
53. The import flow must include upload, column mapping, preview, edit, duplicate detection, category suggestion, and confirmation.
54. The system must validate imported data before insertion and provide clear user feedback for invalid rows.

### FR16: Brazilian Personal Finance Context

55. The system must model Pix-related financial activity as a valid and common payment flow.
56. The system must support boleto due dates, payment status, late handling, and related reminders.
57. The system must support installment purchases as a core behavior, not an edge case.
58. The system must allow users to account for seasonal expenses such as IPVA, IPTU, school costs, annual insurance, and year-end spending.
59. The system must allow users to mark variable income and extraordinary income separately from regular income.

### FR17: Generative AI Assistant

60. The system must provide AI-generated monthly insights based on the user financial data for the selected period.
61. The system must organize AI insights into observed behavior, consumption triggers, practical recommendations, and improvement opportunities.
62. The system must allow users to choose the AI model when the environment supports multiple providers.
63. The system must allow users to save and delete generated insights.
64. The system must provide a conversational AI assistant that answers questions about the user's financial situation in natural language.
65. The assistant must support questions about spending patterns, debt priorities, budget pressure, projected risk, and goal progress.
66. The assistant must generate action plans in plain Portuguese for cases such as leaving credit card debt, building an emergency fund, or reducing overspending.
67. The assistant must explain the basis of each relevant conclusion using user data and explicit calculations when possible.
68. The assistant must clearly indicate when an answer is based on estimate or incomplete data.
69. The assistant must never modify financial records without explicit user confirmation.

### FR18: Financial Education Layer

70. The system must provide contextual explanations for financial concepts such as compound interest, revolving credit, emergency reserve, and CET.
71. These explanations must use the user's own data where possible to make the content practical.
72. The system must adapt explanation depth for users with different levels of financial knowledge when such a preference exists.

### FR19: Notifications and Reminders

73. The system must provide header-level alerts for upcoming or overdue critical items.
74. The system must support reminders for weekly review, monthly closing, invoice due dates, and budget pressure.
75. The system must allow users to silence or configure certain notification classes when the product design defines those settings.

### FR20: Privacy and User Control

76. The system must include a privacy mode to hide money values in the interface.
77. The system must persist privacy mode preference locally.
78. The system must make AI usage transparent and avoid hidden autonomous behavior.

## 7. Non-Goals

1. The first version will not be a full investment management suite.
2. The first version will not execute banking operations or payments.
3. The first version will not rely on mandatory third-party bank integrations.
4. The first version will not offer business accounting, invoicing, payroll, or tax bookkeeping.
5. The first version will not offer AI-driven auto-posting of transactions without user confirmation.
6. The first version will not promise financial outcomes such as guaranteed savings or debt elimination.

## 8. Design Considerations

### UX Principles

- The interface must be in Portuguese.
- Monthly period selection must be central across the product.
- Money visibility must be fast to understand but easy to hide.
- Core workflows must minimize friction while preserving review and correction.
- AI output must feel practical, concrete, and grounded in the displayed numbers.

### Navigation

The main navigation should include at least:

- Dashboard
- Lançamentos
- Contas
- Cartões
- Orçamentos
- Calendário
- Categorias
- Pagadores
- Relatórios
- Anotações
- Insights
- Ajustes

### Experience Expectations

- Mobile and desktop layouts must both be usable for day-to-day financial operations.
- High-frequency actions such as adding transactions, changing month, and reviewing alerts must be easy to access.
- Empty states should educate the user on what data is needed to unlock useful insights.

## 9. Technical Considerations

### Architecture Principles

1. The system should be designed with clear domain boundaries so that transactions, accounts, cards, budgets, debts, goals, reports, and AI features can evolve independently.
2. The architecture should support web-first usage with responsive behavior for mobile and desktop.
3. The system should support secure authentication, protected user data access, and tenant-safe separation of each user's financial records.
4. The system should support a relational data model or an equivalent structure capable of preserving strong financial traceability.
5. The application should allow asynchronous and auditable import workflows for OFX and CSV-based data.
6. The AI layer should be isolated from core financial writes so that AI-generated guidance cannot silently change source records.
7. The architecture should support both direct product usage and future extensibility for notifications, file imports, exports, and analytics.

### Data and Domain Guidance

1. Period-based logic should standardize on a monthly key format such as `YYYY-MM` across filters, reporting, budgeting, and forecasting.
2. Monetary values should use a storage and calculation strategy that avoids precision loss.
3. Financial events that impact multiple entities, such as transfers and installments, should preserve explicit relationships between related records.
4. Import flows should retain enough metadata to support duplicate detection, review, and auditability.
5. Historical analytics should be derived from trusted transactional data, not from AI-generated summaries.
6. Notification and projection logic should be based on explicit due dates, recurrence rules, and invoice rules when those objects exist.

### Suggested Domain Modules

- Authentication and user access
- Dashboard and monthly overview
- Transactions and recurring logic
- Accounts and transfers
- Credit cards and invoices
- Categories
- Payers and sharing
- Budgets
- Goals and emergency fund
- Debts and renegotiation
- Calendar and reports
- Imports and exports
- Notifications and reminders
- AI insights and assistant

### Data Model Areas Likely Needed

- Transactions and transaction series
- Accounts and transfers
- Cards and invoices
- Categories
- Payers and payer shares
- Budgets by category and period
- Goals and emergency fund targets
- Debts and renegotiation history
- Notes and tasks
- Saved insights and AI interactions
- Import sessions and duplicate-detection support

## 10. MVP Recommendation

### Phase 1: Financial Control Foundation

- Authentication
- Monthly dashboard
- Accounts
- Transactions
- Categories
- Cards and invoices
- Budgets
- Basic reports

### Phase 2: Assisted Data Entry and Historical Analysis

- OFX import
- CSV import
- Calendar
- Payers
- Notifications
- Exportable reports

### Phase 3: Financial Planning and Recovery

- Goals
- Emergency fund tracking
- Cash flow projection
- Debt management
- Seasonal planning and variable-income support

### Phase 4: AI Copilot Layer

- Saved monthly insights
- Conversational assistant
- Personalized financial education
- Scenario generation and guided action plans

## 11. Success Metrics

1. Users can complete core onboarding and create their first financial records without support.
2. Users can close a month with accounts, card invoices, and categorized transactions in one environment.
3. Users with debt can register obligations and compare payoff paths clearly.
4. Users can identify projected cash-flow issues before the due date occurs.
5. AI-generated insights are understandable, grounded in user data, and useful enough to be revisited.
6. Import workflows reduce manual transaction entry for supported file types.
7. The app remains useful even for users who do not enable AI features.

## 12. Risks and Constraints

1. AI features can become generic or misleading if they are not tightly grounded in structured financial data.
2. Debt and projection features require careful modeling to avoid misleading financial suggestions.
3. Import workflows are sensitive to real-world data inconsistencies and require strong validation.
4. Self-hosted deployments may have uneven configuration quality for email, AI providers, and file handling.
5. A large scope creates delivery risk unless phased intentionally.

## 13. Open Questions

1. Should goals and debt management be part of the first release or introduced in later phases?
2. Should the conversational AI be available only inside the insights area or globally across the app?
3. What level of configurability should users have for reminders and health indicators?
4. Should seasonal planning have its own module or live as part of goals, budgets, or cash-flow projection?
5. Should payer sharing remain limited to read-only or eventually support controlled collaboration?
6. How much of the AI explanation history should be persisted for auditability and user review?

## 14. Delivery Summary for Developers

This PRD describes a complete personal finance app, not a single isolated feature. The recommended implementation approach is phased. The first implementation should focus on reliable financial operations and monthly visibility. Planning, debt recovery, and AI layers should build on top of a trustworthy financial data foundation.

The most important product principle is this: the app must help users understand and improve their personal financial life in the Brazilian context, with AI used to clarify decisions and reduce friction, never to obscure logic or take uncontrolled actions.
