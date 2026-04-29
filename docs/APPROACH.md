# Approach — Smart Document Processing System

## Cilj

Za Mastery.ba take-home interview task: napraviti production-ready full-stack web aplikaciju koja prima invoice/PO dokumente u 4 formata (PDF, image, CSV, TXT), ekstraktuje strukturirane podatke kroz multimodal LLM, validira ih lokalnim rule engine-om, i daje korisniku review interface za ručnu korekciju i potvrdu — sve scoped per-user, deployovano na javni URL, kod na GitHub-u.

## Ključne arhitekturne odluke

### 1. Next.js 16 App Router umjesto SPA + odvojeni backend
**Zašto:** Firebase App Hosting je optimizovan za Next.js, server actions i API routes pokrivaju sve backend potrebe bez odvojenog Node servera, SSR poboljšava initial load. Single deployment unit, jedan codebase, jedna mental model.

### 2. Gemini 2.0 Flash kao primary LLM
**Zašto multi-model NIJE potrebno:**
- Gemini je **nativno multimodal** — direktno procesira PDF i image bez odvojenog OCR koraka
- Jeftin (~$0.10/M input tokens) i brz (~1-2s per document)
- Strukturiran JSON output preko `responseMimeType: "application/json"`
- Sa Zod validacijom dobijamo runtime garanciju da output odgovara schemi

Razmatrana alternativa Claude Sonnet 4.6: bolji za pure text extraction, ali za multimodal use case Gemini je 5–10× jeftiniji i jednako precizan na sample dokumentima ovog projekta.

### 3. Hybrid extraction strategy (rule-based + LLM)
Svaki tip ide kroz dedicated extractor:

| Tip | Pristup |
|---|---|
| **PDF** | Gemini multimodal (primary). Fallback: `pdf-parse` ekstraktuje text → Gemini text mode. Fallback hvata case kad je PDF text-only ili kad multimodal API faila. |
| **Image** | Gemini multimodal direktno. Native vision je dovoljno dobra za "messy/OCR-like" dokumente iz spec-a — eliminiše kompleksnost odvojenog Tesseract pipeline-a. |
| **CSV** | `papaparse` normalizuje raw text u "row \| row \| row" prezentaciju → Gemini text mode interpretira kao invoice. CSV-ovi nisu uniformni, pa direktan rule-based parsing ne radi. |
| **TXT** | Direktan tekst → Gemini text mode. |

**Centralni JSON schema (`src/lib/validation/schemas.ts` — Zod):**
- Jedan source of truth
- `safeParseExtraction()` štiti od LLM hallucination-a (npr. ako Gemini vrati string umjesto number-a)
- Default vrijednosti su `null`/`[]` da se ne lome runtime checks downstream

### 4. Validation engine je rule-based, ne LLM-based
**Zašto:** Validacija MORA biti deterministična. Ako Gemini extract-a `total: 100` i line items sum-iraju u `120`, pravilo o nesuglasju je čista matematika — ne treba LLM. To znači:
- Brže (mikrosekunde, ne API call)
- Jeftinije (zero cost)
- Auditable — mogu objasniti zašto je nešto označeno
- Testabilno (28 unit testova prolazi)

5 rules iz spec-a su implementirane u `src/lib/validation/rules.ts`:
1. `MISSING_FIELD` — required: supplier, documentNumber, issueDate, total
2. `TOTAL_MISMATCH` — `|sum(lineItems.amount) + tax - total| > 0.02`
3. `INVALID_DATE` / `DATE_ORDER` — parse + dueDate >= issueDate
4. `LINE_ITEM_MISMATCH` — per-line `|qty * unitPrice - amount| > 0.02`
5. `DUPLICATE_DOC_NUMBER` — Firestore query za istog usera

Float tolerance: 0.02 (rounding errors u extracted dokumentima su realnost).

### 5. Per-user scoping kroz Firestore Rules
Sve je pod `users/{userId}/documents/{docId}`. Storage mirror.

```
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
}
```

Server-side u API routes-ima koristim Firebase Admin SDK preko Bearer ID token-a (ne service account direktno na klijentu — to bi bio security risk). Klijent šalje `Authorization: Bearer <idToken>`, server verifikuje preko `adminAuth().verifyIdToken()`.

### 6. API ključevi van repo-a, sa client/server split
- `NEXT_PUBLIC_FIREBASE_*` → safe-by-design Firebase web config (security iz rules-a, ne iz hiding API key-a)
- `GEMINI_API_KEY` → server-only, koristi se SAMO u `src/app/api/extract/route.ts` (i u `src/lib/llm/gemini.ts` koja ima `import "server-only"`)
- `FIREBASE_ADMIN_*` → server-only, isto sa `import "server-only"` na svim admin SDK fajlovima

App Hosting: secret env vars dolaze iz Google Secret Manager (preko `apphosting.yaml`), ne iz repo-a.

### 7. Status workflow je deterministički, ne user-driven
- `uploaded` → automatski na file upload
- Nakon extraction-a: `validated` ako issues.length === 0, inače `needs_review`
- User može override: confirm (→ `validated`) ili reject (→ `rejected`)
- Korekcija polja → re-run validacije → status se osvjeđuje

## Šta nisam radio i zašto

**Background jobs / queue:** Sa Cloud Tasks bismo extract pomjerili off-request. Za interview demo, sync extraction unutar API route-a je dovoljno (Gemini Flash je ~1-2s, max 60s timeout pokriva edge cases). U produkciji za batch upload-e bi bio essential.

**OCR confidence highlights:** Gemini ne vraća bounding boxes. Document AI / Tesseract bi to dali, ali za interview scope nije bitno — preview side-by-side je dovoljan kontekst za review.

**Multi-page PDF split:** Trenutni model: 1 dokumenat = 1 invoice. PDF sa više stranica se procesuje kao jedan dokument (Gemini gleda sve stranice). U produkciji bi PDF sa više fakturira trebao biti split.

**Audit log korekcija:** Svaka korekcija nadpisuje field, history se gubi. Za audit-grade sistem trebao bi `documents/{id}/history/{revisionId}` collection.

## AI tools koje sam koristio

- **Claude Code (Opus 4.7)** za pair programming — scaffolding, refaktor, test generation, file batch creation. Validation business rules, extraction prompt engineering, security model — pisao sam sa razumijevanjem, ne sirovo iz LLM outputa.
- **Gemini 2.0 Flash API** je production runtime dependency, ne dev tool — koristi se za extraction kad korisnik upload-uje dokument.

## Improvements koje bih dodao sa više vremena

1. **Extraction eval set** — automated test sa svim sample dokumentima u `mastery_task/resources/`, mjeri accuracy po polju (precision/recall na supplier, total, etc.)
2. **Background job queue** — Cloud Tasks ili Inngest za extract, sa retry logic i dead-letter queue
3. **Audit log** — svaka korekcija pravi history entry u subcollection-u
4. **Multi-page handling** — detect multiple invoices u jednom PDF-u, split na više dokumenata
5. **Rate limiting** — `/api/extract` treba biti rate-limited per-user (npr. 10 req/min)
6. **CSV/Excel export** validiranih dokumenata za ERP integraciju
7. **Webhook notification** kad dokument pređe u needs_review (Slack, email)
8. **Optimistic UI** — review form trenutno čeka API response prije UI update-a; mogao bi biti optimistic sa rollback-om
9. **i18n** — trenutno hardkodiran engleski; izdvojiti u resource fajlove
10. **Production monitoring** — Sentry za errors, Cloud Logging structured logs, latency metrics u Cloud Monitoring
