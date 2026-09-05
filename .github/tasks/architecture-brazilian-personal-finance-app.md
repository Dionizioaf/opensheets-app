# Architecture Document: Brazilian Personal Finance App

## 1. Purpose

This document defines a recommended technical architecture for a new Brazilian personal finance application based on the product requirements described in the PRD. The goal is to provide a concrete implementation direction for a greenfield project, while preserving room for phased delivery.

This is not a migration plan from the current repository. It is a proposed architecture for a new project in a new folder.

## 2. Architecture Goals

1. Support a complete personal finance workflow for Brazilian users.
2. Keep the product deployable in self-hosted environments.
3. Make financial data reliable, auditable, and easy to evolve.
4. Support imports, reports, projections, and AI workflows without coupling everything into one runtime path.
5. Keep the first version simple enough to ship, while allowing growth into a more capable platform.

## 3. Chosen Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod

### Backend API

- NestJS
- TypeScript
- REST API for core product flows
- Background job orchestration via BullMQ

### Data Layer

- PostgreSQL
- Prisma ORM
- Redis for queues, caching, and transient workloads

### File and Document Storage

- S3-compatible object storage
- Recommended local/self-hosted option: MinIO

### Authentication

- Auth.js or a custom session-based auth service implemented in the backend
- OAuth optional
- Email-based login and password login supported

### AI Layer

- Vercel AI SDK or a provider-agnostic LLM integration layer
- OpenAI-compatible API support
- Structured prompt orchestration in backend services

### Infra and Deployment

- Docker and Docker Compose for local and self-hosted deployment
- Reverse proxy with Nginx or Traefik
- Optional cloud deployment on Fly.io, Railway, Render, or a VPS/Kubernetes environment

## 4. Why This Stack

### Why Next.js for the Frontend

1. It supports a modern React application with strong routing, form handling, and hybrid rendering.
2. It works well for dashboard-heavy products and authenticated application experiences.
3. It has strong ecosystem support for UI, charts, forms, and AI-enhanced interfaces.

### Why NestJS for the Backend

1. This app has enough domain complexity to justify a dedicated backend.
2. Imports, projections, notifications, AI orchestration, and financial calculations benefit from explicit service boundaries.
3. NestJS provides strong modularity, DI, validation, testability, and operational clarity.

### Why PostgreSQL

1. The app relies on strongly related financial records.
2. SQL is a good fit for historical reporting, ledger-style relationships, and period-based aggregation.
3. PostgreSQL handles transactional integrity better than lighter document-oriented options for this domain.

### Why Redis and BullMQ

1. CSV and OFX imports should not block request-response flows unnecessarily.
2. AI jobs, email notifications, report generation, and reconciliation tasks are natural background workloads.
3. Queue-backed processing improves reliability and observability.

### Why S3-Compatible Storage

1. Imported files, generated exports, and temporary artifacts need durable storage.
2. S3-compatible storage works well across self-hosted and cloud deployments.

## 5. High-Level Architecture

```text
Browser
  |
  v
Next.js Web App
  |
  v
NestJS API
  |\
  | \__ Redis + BullMQ Workers
  |
  \____ PostgreSQL
  \
   \___ S3-compatible Storage
    \
     \__ AI Providers / Email Providers / OAuth Providers
```

## 6. Architectural Style

The recommended style is a modular monorepo with separate applications and shared packages.

### Suggested Workspace Layout

```text
finance-app/
  apps/
    web/
    api/
    worker/
  packages/
    ui/
    types/
    config/
    sdk/
    prompts/
  infra/
    docker/
    compose/
    nginx/
  docs/
```

### Why This Structure

1. It keeps the frontend, API, and worker concerns separate.
2. It allows shared types and utilities without collapsing everything into one codebase layer.
3. It makes future mobile apps or admin tools easier to add.

## 7. Core Domain Modules

The backend should be organized by domain rather than technical layer alone.

### Recommended Backend Modules

- Auth
- Users
- Accounts
- Cards
- Invoices
- Transactions
- Transfers
- Categories
- Payers
- Budgets
- Goals
- Debts
- Cash Flow Projection
- Reports
- Calendar
- Imports
- Exports
- Notifications
- Notes
- AI Insights
- AI Assistant
- Audit

### Recommended Frontend Feature Areas

- Authentication
- Dashboard
- Transactions
- Accounts
- Cards and invoices
- Budgets
- Goals and emergency fund
- Debts
- Reports
- Calendar
- Payers
- Notes
- Insights and assistant
- Settings

## 8. Data Architecture

### Core Principles

1. Financial writes must be explicit and traceable.
2. Money calculations must avoid floating-point errors.
3. Derived analytics must be recomputable from source records.
4. Related financial events must preserve their relationships.
5. User isolation must be enforced at the data layer and service layer.

### Monetary Storage Strategy

Use integer cents for most transactional calculations and persistence.

Alternative:

Use PostgreSQL `numeric(14,2)` if the team prefers exact decimal storage and maintains strict consistency in calculations.

Recommendation:

Use integer cents in application-facing domains where possible, and only format to BRL at the presentation layer.

### Key Entities

- User
- Session
- Account
- AccountBalanceSnapshot
- Card
- Invoice
- Transaction
- TransactionSeries
- TransferLink
- Category
- Budget
- Goal
- Debt
- DebtRenegotiation
- Payer
- PayerShare
- Note
- Task
- ImportSession
- ImportedFile
- Insight
- AIConversation
- Notification
- AuditEvent

### Data Relationships That Matter

1. Transfers must create two financial sides linked by a shared identifier.
2. Installments must retain parent-child relationships.
3. Recurring transactions must retain a series reference.
4. Invoice items must remain attributable to card transactions.
5. Imported transactions should retain import session lineage.
6. Debt renegotiation should preserve historical states instead of overwriting past conditions.

## 9. API Design

### Style Recommendation

Use REST for core product APIs in the initial version.

Reasons:

1. Simpler for admin and product teams to inspect and debug.
2. Easier to secure and document early.
3. Works well with modular backend services and background jobs.

### API Areas

- `/auth`
- `/users`
- `/dashboard`
- `/accounts`
- `/cards`
- `/invoices`
- `/transactions`
- `/transfers`
- `/categories`
- `/budgets`
- `/goals`
- `/debts`
- `/payers`
- `/reports`
- `/calendar`
- `/imports`
- `/exports`
- `/notifications`
- `/notes`
- `/insights`
- `/assistant`

### Response Standards

1. All write endpoints should return structured success and error payloads.
2. Validation errors should be field-aware.
3. Long-running jobs should return job identifiers and progress endpoints or websocket events.

## 10. Background Processing

The following workloads should be handled by workers instead of the main API path when they exceed lightweight execution:

- OFX import parsing and review preparation
- CSV parsing and duplicate detection for large files
- Excel to CSV conversion when done server-side
- Export generation for PDF and large spreadsheets
- Email notifications
- Monthly insight generation
- AI scenario generation
- Scheduled reminders
- Periodic health indicator refreshes

### Worker Responsibilities

1. Pick jobs from BullMQ queues.
2. Update progress state.
3. Persist audit metadata.
4. Retry transient failures safely.
5. Avoid duplicate job effects through idempotency keys.

## 11. Frontend Architecture

### Rendering Strategy

1. Use server rendering for route shells, authenticated layout, and SEO-relevant marketing pages if they exist.
2. Use client-heavy interactivity for dashboard filters, transaction tables, import wizards, assistant chat, and report exploration.

### State Strategy

1. Use TanStack Query for server state.
2. Use local component state for ephemeral UI state.
3. Use form state with React Hook Form and Zod validation.
4. Use a lightweight client store only for cross-cutting UI concerns such as privacy mode or global assistant drawer state.

### Frontend Design Principles

1. Portuguese-first interface.
2. Mobile and desktop parity for core financial actions.
3. Fast switching between monthly periods.
4. Financial values always formatted in BRL.
5. Strong visual distinction between income, expense, due, paid, overdue, and projected risk states.

## 12. AI Architecture

### AI Role in the Product

AI is an assistive layer, not the source of truth.

The AI layer should:

- explain trends
- classify likely categories with confidence
- generate summaries and action plans
- answer user questions about financial patterns
- simulate possible corrective scenarios

The AI layer should not:

- silently alter financial records
- invent unsupported calculations
- act as a hidden decision engine

### AI Service Design

Use a dedicated backend AI module with the following responsibilities:

1. Prompt building from structured user data.
2. Redaction and safety controls.
3. Model routing by task type.
4. Output validation against expected schemas.
5. Persistence of saved insights and optional conversation history.

### AI Interaction Flow

1. User requests an insight or asks a question.
2. Backend gathers normalized financial context.
3. Prompt builder constructs a constrained task-specific prompt.
4. LLM returns structured and narrative output.
5. Backend validates the output.
6. UI renders both the explanation and the evidence or assumptions.

## 13. Security and Privacy

### Security Requirements

1. All user data must be isolated per account owner.
2. Secrets must never be committed to source control.
3. Sensitive actions must require authenticated sessions.
4. Audit events should be captured for important financial writes.
5. Upload processing must validate file type and size.
6. Rate limiting should protect auth, import, and AI endpoints.

### Privacy Requirements

1. Privacy mode should mask monetary values in the frontend.
2. AI prompts should use only the minimum data required for the task.
3. Stored AI interactions should be configurable when privacy expectations are stricter.
4. Exported files should have bounded retention when persisted server-side.

## 14. Observability and Reliability

### Recommended Observability Stack

- Structured application logs
- Error tracking via Sentry or equivalent
- Metrics via Prometheus-compatible tooling or platform-native metrics
- Health endpoints for API, worker, database, and storage

### Reliability Requirements

1. Background jobs must be retryable.
2. Import jobs must be idempotent.
3. Critical financial writes should be transactional.
4. Failed external provider calls should degrade gracefully.

## 15. Deployment Model

### Minimum Self-Hosted Deployment

- `web` container
- `api` container
- `worker` container
- `postgres` container
- `redis` container
- `minio` container
- `nginx` or `traefik` container

### Environments

- Local development
- Staging
- Production

### Environment Variable Groups

- Database
- Redis
- Auth
- Email
- Storage
- AI providers
- App URLs and CORS

## 16. Phased Delivery Architecture

### Phase 1

Implement the web app, API, PostgreSQL, and authentication with no worker dependency beyond optional email.

### Phase 2

Add Redis, workers, imports, exports, and notification jobs.

### Phase 3

Add projections, debt engine, seasonal planning logic, and more advanced reporting.

### Phase 4

Add AI assistant, saved insights, and scenario generation.

## 17. Main Tradeoffs

### Tradeoff 1: Dedicated Backend vs Fullstack Frontend-Only App

Decision:

Use a dedicated API backend.

Reason:

The domain has enough complexity in jobs, auditability, imports, and AI orchestration that a separate backend is the cleaner long-term choice.

### Tradeoff 2: REST vs GraphQL

Decision:

Use REST first.

Reason:

The initial product benefits more from simpler operational clarity than from GraphQL flexibility.

### Tradeoff 3: Monolith vs Microservices

Decision:

Use a modular monolith with workers.

Reason:

This product needs strong domain separation, but not microservice overhead at the beginning.

### Tradeoff 4: AI in Request Path vs Job-Based Processing

Decision:

Use direct request-response only for short assistant interactions and lightweight suggestions. Use jobs for heavy insight generation and document processing.

Reason:

This keeps the UI responsive and the system more resilient.

## 18. Recommended First Build Order

1. Authentication and user model
2. Accounts and transactions
3. Categories and monthly dashboard
4. Cards, invoices, and installments
5. Budgets and reports
6. CSV and OFX imports
7. Goals and emergency fund
8. Debts and cash flow projection
9. Notifications and reminders
10. AI insights and assistant

## 19. Open Architecture Questions

1. Should the first release support only web, or should the architecture prepare for a future mobile client from day one?
2. Should AI conversation history be stored by default or disabled unless explicitly enabled?
3. Should exports be generated on-demand only or also stored temporarily for reuse?
4. Should audit events be append-only in a dedicated table from the first release?
5. Should email be mandatory for user accounts or optional in self-hosted private deployments?

## 20. Final Recommendation

Build the new app as a modular monorepo with a Next.js frontend, a NestJS backend, PostgreSQL as the system of record, Redis plus BullMQ for background workloads, and S3-compatible storage for files and exports.

This architecture is strong enough for a serious personal finance platform, but still pragmatic enough for phased delivery. It matches the product's real complexity: financial traceability, import workflows, reporting, projections, and a useful AI layer. It also keeps the product viable for Brazilian self-hosted users who want control over their data.
