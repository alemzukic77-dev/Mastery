# API Documentation

Sve API rute zahtjevaju Firebase Auth ID token kao Bearer u `Authorization` header-u. Klijent dobija token preko `user.getIdToken()` iz Firebase Auth SDK-a.

```
Authorization: Bearer <Firebase ID token>
```

Server verifikuje token preko `firebase-admin` SDK-a i izvuče `uid` koji se koristi za scoping.

---

## `POST /api/extract`

Triggers document extraction for an uploaded file. The file must already exist in Storage at `users/{uid}/documents/{documentId}/{fileName}` and have a Firestore doc with `originalFile.storagePath` set.

### Request

```json
{ "documentId": "abc123" }
```

### Response 200

```json
{
  "ok": true,
  "documentId": "abc123",
  "status": "validated" | "needs_review",
  "issuesCount": 0
}
```

### Errors

| Status | Body | Razlog |
|---|---|---|
| 401 | `{ error: "Missing Authorization Bearer token" }` | Header missing |
| 401 | `{ error: "Invalid auth token" }` | Token verification failed |
| 400 | `{ error: "documentId is required" }` | Missing body field |
| 400 | `{ error: "Document is missing original file reference" }` | Firestore doc has no storagePath |
| 404 | `{ error: "Document not found" }` | No doc at users/{uid}/documents/{id} |
| 422 | `{ error: <extraction error> }` | LLM returned invalid output ili PDF/image neprocesibilan |
| 500 | `{ error: <internal error> }` | Unexpected server error |

### Side effects

Updates Firestore doc with: extracted fields, `rawExtraction` (audit), `validationIssues`, derived `status`, `updatedAt`.

---

## `PATCH /api/documents/[id]`

Save user corrections, confirm validation, or reject document.

### Variants

#### Save data
```json
{
  "data": {
    "type": "invoice",
    "supplier": "Acme Inc",
    "documentNumber": "INV-001",
    "issueDate": "2026-01-10",
    "dueDate": "2026-02-10",
    "currency": "USD",
    "lineItems": [
      { "description": "Widget", "quantity": 2, "unitPrice": 50, "amount": 100 }
    ],
    "subtotal": 100,
    "tax": 10,
    "total": 110
  }
}
```

Response (`200`):
```json
{ "ok": true, "status": "needs_review", "issuesCount": 1 }
```

Triggers re-validation. Status auto-derives from issue list.

#### Confirm
```json
{ "action": "confirm" }
```
Sets `status: "validated"`, `validatedAt: now`.

#### Reject
```json
{ "action": "reject" }
```
Sets `status: "rejected"`.

### Errors

| Status | Body |
|---|---|
| 401 | `{ error: "Missing token" }` ili `{ error: "Invalid token" }` |
| 404 | `{ error: "Not found" }` — dokument ne postoji za usera |
| 400 | `{ error: "Invalid extracted data shape", issues: [...] }` — Zod validation failed |
| 400 | `{ error: "No action or data provided" }` |
| 500 | `{ error: <message> }` |

---

## `DELETE /api/documents/[id]`

Permanently deletes Firestore doc and Storage file.

### Response 200
```json
{ "ok": true }
```

### Errors
- 401 — auth issues
- 404 — dokument ne postoji
- 500 — internal

---

## Data Model

### `users/{uid}/documents/{docId}`

Sve polja extracted iz LLM-a su nullable. Nakon extraction-a:

```ts
{
  type: "invoice" | "purchase_order" | "unknown"
  supplier: string | null
  documentNumber: string | null
  issueDate: string | null      // ISO YYYY-MM-DD
  dueDate: string | null
  currency: string | null       // ISO 4217
  lineItems: Array<{
    description: string,
    quantity: number,
    unitPrice: number,
    amount: number
  }>
  subtotal: number | null
  tax: number | null
  total: number | null
  status: "uploaded" | "needs_review" | "validated" | "rejected"
  validationIssues: Array<{
    field: string,
    severity: "error" | "warning",
    message: string,
    code: ValidationCode
  }>
  originalFile: {
    storagePath: string,
    contentType: string,
    size: number,
    fileName: string,
    downloadUrl: string | null
  }
  rawExtraction: object         // raw LLM output (audit)
  createdAt: Timestamp
  updatedAt: Timestamp
  validatedAt?: Timestamp
}
```

### Validation Codes

| Code | Severity | Description |
|---|---|---|
| `MISSING_FIELD` | error | Required field is null/empty |
| `TOTAL_MISMATCH` | error | `sum(lineItems.amount) + tax ≠ total` |
| `INVALID_DATE` | error | Date string doesn't parse |
| `DATE_ORDER` | error | `dueDate < issueDate` |
| `LINE_ITEM_MISMATCH` | warning | `quantity * unitPrice ≠ amount` |
| `DUPLICATE_DOC_NUMBER` | warning | Same documentNumber exists for user |
| `EXTRACTION_FAILED` | error | LLM extraction threw; user must edit manually |
