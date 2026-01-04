# CSV to ImportTransaction Type Compatibility Verification

## Task 4.3: Type Compatibility Analysis

This document verifies that CSV data is properly mapped to the `ImportTransaction` interface and database schema.

## Required Fields Mapping

### Database Schema Required Fields (`lancamentos` table)

| DB Field          | Type             | CSV Mapper Field  | Status | Notes                                                 |
| ----------------- | ---------------- | ----------------- | ------ | ----------------------------------------------------- |
| `nome`            | text NOT NULL    | `name`            | ✅     | Set from description column or "Transação importada"  |
| `valor`           | numeric NOT NULL | `amount`          | ✅     | Parsed via `parseBrazilianCurrency()`, absolute value |
| `data_compra`     | date NOT NULL    | `purchaseDate`    | ✅     | Parsed via `parseBrazilianDate()`                     |
| `tipo_transacao`  | text NOT NULL    | `transactionType` | ✅     | "Despesa" or "Receita" based on amount sign           |
| `forma_pagamento` | text NOT NULL    | `paymentMethod`   | ✅     | Default "Débito", updated based on account type       |
| `condicao`        | text NOT NULL    | `condition`       | ✅     | Default "à vista"                                     |
| `periodo`         | text NOT NULL    | `period`          | ✅     | Generated as "YYYY-MM" from purchaseDate              |
| `user_id`         | text NOT NULL    | `userId`          | ✅     | Set to empty string, populated during server action   |

### Optional Database Fields

| DB Field              | Type     | CSV Mapper Field     | Status | Notes                                             |
| --------------------- | -------- | -------------------- | ------ | ------------------------------------------------- |
| `anotacao`            | text     | `note`               | ✅     | Set to null                                       |
| `qtde_parcela`        | smallint | `installmentCount`   | ✅     | Set to null (CSV imports are single transactions) |
| `parcela_atual`       | smallint | `currentInstallment` | ✅     | Set to null                                       |
| `qtde_recorrencia`    | integer  | `recurrenceCount`    | ✅     | Set to null                                       |
| `data_vencimento`     | date     | `dueDate`            | ✅     | Set to null                                       |
| `dt_pagamento_boleto` | date     | `boletoPaymentDate`  | ✅     | Set to null                                       |
| `realizado`           | boolean  | `isSettled`          | ✅     | Set to true (CSV imports are settled)             |
| `dividido`            | boolean  | `isDivided`          | ✅     | Set to false                                      |
| `antecipado`          | boolean  | `isAnticipated`      | ✅     | Set to false                                      |
| `antecipacao_id`      | uuid     | `anticipationId`     | ✅     | Set to null                                       |
| `cartao_id`           | uuid     | `cartaoId`           | ✅     | Set to undefined, populated during server action  |
| `conta_id`            | uuid     | `contaId`            | ✅     | Set to undefined, populated during server action  |
| `categoria_id`        | uuid     | `categoriaId`        | ✅     | Set to undefined, can be set in review step       |
| `pagador_id`          | uuid     | `pagadorId`          | ✅     | Set to undefined, can be set in review step       |
| `series_id`           | uuid     | `seriesId`           | ✅     | Set to null                                       |
| `transfer_id`         | uuid     | `transferId`         | ✅     | Set to null                                       |

## ImportTransaction Interface Fields

### ParsedOfxTransaction Base Fields (Inherited)

| Field             | CSV Mapper        | Status | Notes                              |
| ----------------- | ----------------- | ------ | ---------------------------------- |
| `nome`            | `name`            | ✅     | Mapped from description or default |
| `valor`           | `amount`          | ✅     | Brazilian currency format parsed   |
| `data_compra`     | `purchaseDate`    | ✅     | Brazilian date format parsed       |
| `tipo_transacao`  | `transactionType` | ✅     | Auto-determined from amount sign   |
| `forma_pagamento` | `paymentMethod`   | ✅     | Default "Débito"                   |
| `condicao`        | `condition`       | ✅     | Default "à vista"                  |
| `periodo`         | `period`          | ✅     | Auto-generated "YYYY-MM"           |
| `realizado`       | `isSettled`       | ✅     | Always true for CSV                |
| `categoriaId`     | `categoriaId`     | ✅     | Optional, set in review step       |
| `isDuplicate`     | `isDuplicate`     | ✅     | Set to false initially             |
| `isSelected`      | `isSelected`      | ✅     | Set to true by default             |

### CSV-Specific Fields (from CsvImportTransaction)

| Field         | CSV Mapper    | Status | Notes                        |
| ------------- | ------------- | ------ | ---------------------------- |
| `id`          | `id`          | ✅     | Generated via `randomUUID()` |
| `csvRowIndex` | `csvRowIndex` | ✅     | Tracked for error reporting  |
| `rawData`     | `rawData`     | ✅     | Stores original CSV row      |

### UI State Fields

| Field          | CSV Mapper   | Status | Notes             |
| -------------- | ------------ | ------ | ----------------- |
| `isSelected`   | `isSelected` | ✅     | Default true      |
| `isEdited`     | `isEdited`   | ✅     | Default false     |
| `hasError`     | `hasError`   | ✅     | Default false     |
| `errorMessage` | Not set      | ✅     | Will be undefined |

## Field Transformation Details

### 1. Currency Parsing (`parseBrazilianCurrency`)

- **Input**: "R$ 1.234,56", "(1.234,56)", "-123,45"
- **Output**: "1234.56" (absolute value, 2 decimal places)
- **Handles**: Brazilian format (period=thousands, comma=decimal)
- **Handles**: Negative values (prefix `-` or parentheses)
- **Validation**: Returns null for invalid formats

### 2. Date Parsing (`parseBrazilianDate`)

- **Input**: "31/12/2024", "31-12-2024", "2024-12-31"
- **Output**: Date object
- **Formats**: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
- **Validation**: Checks actual date validity (no Feb 30, etc.)

### 3. Transaction Type Determination

```typescript
const amountNum = parseFloat(amount);
const transactionType = amountNum < 0 ? "Despesa" : "Receita";
```

- Negative amounts → "Despesa" (expense)
- Positive amounts → "Receita" (income)
- Amount stored as absolute value

### 4. Period Generation

```typescript
const year = purchaseDate.getFullYear();
const month = String(purchaseDate.getMonth() + 1).padStart(2, "0");
const period = `${year}-${month}`;
```

- Format: "YYYY-MM"
- Example: "2024-12"

## Default Values Strategy

### Server Action Responsibilities

The following fields are intentionally left empty in the mapper and will be populated by the server action during import:

1. **Account Assignment**: `contaId` or `cartaoId` based on user's account type selection
2. **Payment Method**: Updated from default "Débito" based on account type:
   - Bank account → "Débito"
   - Credit card → "Cartão de crédito"
3. **User ID**: Set from session (`userId`)

### Review Step Responsibilities

These fields can be set by the user during the review step:

1. **Category**: `categoriaId` via category selector
2. **Payer**: `pagadorId` via payer selector (if implemented)

## Compatibility Verification Results

### ✅ All Required Fields Covered

- Every NOT NULL database field has a mapping or default value
- All ParsedOfxTransaction fields are properly set
- All ImportTransaction UI fields are initialized

### ✅ Type Safety

- Currency strings use decimal format ("123.45")
- Dates are proper Date objects
- Enums match database constraints ("Despesa"|"Receita")
- UUIDs use proper UUID format

### ✅ Validation

- Required fields (date, amount) validated before creating transaction
- Invalid data returns null (transaction rejected)
- Error handling in place for parsing failures

### ✅ OFX Infrastructure Compatibility

The CSV mapper produces transactions that are **fully compatible** with:

- `ReviewStep` component (expects ImportTransaction[])
- `ConfirmStep` component (expects ImportTransaction[])
- Duplicate detection logic (same interface)
- Category suggestion logic (same interface)
- Import server actions (same interface)

## Field Mapping Differences: CSV vs OFX

| Field             | CSV              | OFX                   | Notes                         |
| ----------------- | ---------------- | --------------------- | ----------------------------- |
| `fitId`           | ❌ Not available | ✅ From bank          | CSV has `csvRowIndex` instead |
| `rawData`         | CsvRow object    | OfxTransaction object | Different structure           |
| `anotacao`/`note` | null             | Import metadata       | CSV has no memo field         |
| `forma_pagamento` | "Débito" default | Bank-specific         | Updated based on account      |

## Conclusion

**Status: ✅ VERIFIED - Full Compatibility**

The CSV mapper (`lib/csv/mapper.ts`) correctly transforms CSV data into the `ImportTransaction` interface with:

1. ✅ All required database fields mapped or defaulted
2. ✅ All optional fields properly initialized
3. ✅ Proper data type conversions (currency, dates)
4. ✅ Full compatibility with OFX import infrastructure
5. ✅ Proper defaults for CSV-specific behavior (isSettled: true)
6. ✅ Account and user context set during server action (not mapper)

**No changes required** - the type mapping is complete and correct.
