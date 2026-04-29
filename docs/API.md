# API Documentation

Sve API rute zahtjevaju Firebase Auth ID token kao Bearer u `Authorization` header-u. Klijent dobija token preko `user.getIdToken()` iz Firebase Auth SDK-a.

```
Authorization: Bearer <Firebase ID token>
```

Server verifikuje token preko `firebase-admin` SDK-a i izvuče `uid` koji se koristi za scoping.

## Rate limiting

`POST /api/extract` je rate-limited per-user preko sliding-window counter-a u Firestore-u: **30 req / minut**, **60 req / sat**, **150 req / dan**. Pri prekoračenju vraća se `429 Too Many Requests` sa `Retry-After` header-om u sekundama.

---

## `POST /api/documents`

Kreira novi Firestore dokument za upload. Vraća `id` (Firestore doc id) i `storagePath` (gdje klijent treba da uploaduje fajl preko Firebase Storage SDK-a). Dokument je inicijalno u stanju `uploaded` sa svim extracted poljima `null` — popune se nakon `/api/extract` poziva.

### Request

```json
{
  "fileName": "invoice.pdf",
  "contentType": "application/pdf",
  "size": 102400
}
```

### Response 200

```json
{
  "id": "abc123",
  "storagePath": "users/{uid}/documents/abc123/invoice.pdf"
}
```

### Errors

| Status | Body | Razlog |
|---|---|---|
| 401 | `{ error: "Missing token" \| "Invalid token" }` | Auth |
| 400 | `{ error: "fileName is required" }` | Body validation |

### Side effects

Atomic batch write: kreira `users/{uid}/documents/{id}` Firestore doc + increment-uje `users/{uid}/aggregates/summary` counter za `uploaded` status.

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
  "issuesCount": 0,
  "extractedCount": 1,
  "siblingIds": ["abc123", "def456"]
}
```

`extractedCount` > 1 + `siblingIds` polje znači da je file sadržao više dokumenata; svaki je dobio svoj Firestore record sa zajedničkom `originalFile` referencijom i međusobnim `siblingIds`.

### Errors

| Status | Body | Razlog |
|---|---|---|
| 401 | `{ error: "Missing Authorization Bearer token" }` | Header missing |
| 401 | `{ error: "Invalid auth token" }` | Token verification failed |
| 429 | `{ error, window, retryAfterSec }` | Rate limit prekoračen — vraća se sa `Retry-After` header-om |
| 400 | `{ error: "documentId is required" }` | Missing body field |
| 400 | `{ error: "Document is missing original file reference" }` | Firestore doc has no storagePath |
| 404 | `{ error: "Document not found" }` | No doc at users/{uid}/documents/{id} |
| 413 | `{ error: "Fajl prevelik..." }` | File > 10 MB |
| 422 | `{ error: <extraction error> }` | LLM returned invalid output ili PDF/image neprocesibilan. Doc se patch-uje na `needs_review` sa `EXTRACTION_FAILED` issue. |
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

## `POST /api/aggregates/recompute`

Recomputes the per-user dashboard aggregates (`totalCount`, `byStatus`, `openIssuesCount`, `validatedTotalsByCurrency`) by scanning the user's full documents collection. Used as audit recovery if increment-based deltas drift (e.g. browser crashed mid-extraction).

### Response 200

```json
{
  "ok": true,
  "stats": {
    "totalCount": 12,
    "byStatus": { "uploaded": 0, "needs_review": 3, "validated": 8, "rejected": 1 },
    "openIssuesCount": 5,
    "validatedTotalsByCurrency": {
      "USD": { "amount": 4250.00, "count": 6 },
      "EUR": { "amount": 800.00, "count": 2 }
    }
  }
}
```

### Errors
- 401 — auth issues
- 500 — internal

### Side effects

Overwrites `users/{uid}/aggregates/summary` document with the recomputed values (full replace, not merge).

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
  documentIndex?: number        // 0-based when file has multiple docs
  siblingIds?: string[]         // IDs of all docs from the same originalFile
  createdAt: Timestamp
  updatedAt: Timestamp
  validatedAt?: Timestamp
}
```

### `users/{uid}/aggregates/summary`

```ts
{
  totalCount: number
  byStatus: { uploaded: number, needs_review: number, validated: number, rejected: number }
  openIssuesCount: number
  validatedTotalsByCurrency: Record<string, { amount: number, count: number }>
  updatedAt: Timestamp
}
```

Updated on every document write via `FieldValue.increment()` deltas, kept consistent server-side. Recomputable via `POST /api/aggregates/recompute` if needed.

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
| `COMPUTED_TOTAL` | warning | Total bio null pa je auto-izračunat iz subtotal + tax |
| `MIXED_CURRENCIES` | warning | Line item ima različitu valutu od dokumenta |
