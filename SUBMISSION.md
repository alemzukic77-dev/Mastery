# Submission — Mastery Smart Document Processing

Take-home za **Mastery.ba** — full-stack web aplikacija za extraction, validation i review poslovnih dokumenata (invoice / purchase order) iz PDF / image / CSV / TXT formata.

> Ovaj fajl je cover-sheet: svaki zahtjev iz spec-a → tačna lokacija u repo-u.

---

## ✅ Required deliverables

| Zahtjev | Gdje |
|---|---|
| **GitHub repository** | https://github.com/alemzukic77-dev/Mastery |
| **Live deployed application** | _(URL će biti dodan u [README.md](README.md) nakon Firebase App Hosting deploy-a)_ |
| **README sa setup instrukcijama** | [README.md](README.md) — Tech Stack, Setup (env, install, run), Scripts |
| **Explanation of approach** | [docs/APPROACH.md](docs/APPROACH.md) — arhitekturne odluke + zašto + trade-offs |
| **AI tools used** | [README.md § AI Tools Used](README.md#ai-tools-used) + [docs/APPROACH.md § AI tools koje sam koristio](docs/APPROACH.md#ai-tools-koje-sam-koristio) |
| **Improvements you would make** | [README.md § Improvements I Would Make](README.md#improvements-i-would-make-sa-više-vremena) + [docs/APPROACH.md § Improvements](docs/APPROACH.md#improvements-koje-bih-dodao-sa-više-vremena) |

---

## ⭐ Bonus points

| Bonus | Implementirano? | Gdje |
|---|---|---|
| **OCR support for images** | ✅ | Gemini 2.0 Flash native vision — [src/lib/extractors/image.ts](src/lib/extractors/image.ts). Eliminiše potrebu za odvojenim Tesseract pipeline-om. |
| **Handling messy inputs** | ✅ | Per-format pipeline sa fallback-ima ([docs/adr/0003-extraction-pipeline.md](docs/adr/0003-extraction-pipeline.md)). PDF: multimodal → `pdf-parse` fallback. CSV: `papaparse` → LLM normalizuje heterogene header-e. Schema [src/lib/validation/schemas.ts](src/lib/validation/schemas.ts) gracefully skipuje malformed entries umjesto da padne. |
| **Clean UI/UX** | ✅ | shadcn/ui + Tailwind v4. Side-by-side review ([src/components/documents/DocumentReview.tsx](src/components/documents/DocumentReview.tsx)) sa preview originala + editable form, status badges, issue chips, paginated dashboard sa filterima. |
| **Unit tests** | ✅ | **66 testova** preko 5 fajlova. Pokrivaju validation rules, schema parsing, utility funkcije, **API rute** (auth surface + happy paths). [src/lib/validation/rules.test.ts](src/lib/validation/rules.test.ts) (24), [src/lib/validation/schemas.test.ts](src/lib/validation/schemas.test.ts) (13), [src/lib/utils.test.ts](src/lib/utils.test.ts) (10), [src/app/api/extract/route.test.ts](src/app/api/extract/route.test.ts) (9), [src/app/api/documents/[id]/route.test.ts](src/app/api/documents/[id]/route.test.ts) (10). |
| **Docker setup** | ✅ | Multi-stage [Dockerfile](Dockerfile) (node:20-alpine, non-root user) + [docker-compose.yml](docker-compose.yml) za lokalni dev. |
| **API documentation** | ✅ | [docs/API.md](docs/API.md) — request/response shapes, error codes, data model, validation codes. |

---

## 🛡️ Inženjerska zrelost (extra-mile)

Stvari koje nisu eksplicitno tražene u spec-u ali su urađene jer su dobra praksa:

- **GitHub Actions CI** — [.github/workflows/ci.yml](.github/workflows/ci.yml) automatski pokreće lint + typecheck + test na svaki PR i push na `main`.
- **Architecture Decision Records (ADRs)** — [docs/adr/](docs/adr/) dokumentuje 3 ključne odluke:
  - [0001 — LLM choice (Gemini 2.0 Flash)](docs/adr/0001-llm-choice-gemini.md)
  - [0002 — Firebase full-stack](docs/adr/0002-firebase-stack.md)
  - [0003 — Hybrid extraction pipeline](docs/adr/0003-extraction-pipeline.md)
- **React error boundaries** — [src/app/(app)/error.tsx](<src/app/(app)/error.tsx>) i [src/app/global-error.tsx](src/app/global-error.tsx) za graceful crash handling umjesto white screena.
- **Defense-in-depth security**:
  - Firebase Auth ID token verifikacija na **svakoj** API ruti.
  - Firestore Rules: `allow create: if false` na klijentu — sav write ide kroz server-side Admin SDK.
  - Storage Rules: 20 MB cap + MIME allowlist + per-user path.
  - Rate limiting preko Firestore transakcija (30/min, 60/h, 150/dan po user-u) — [src/lib/ratelimit.ts](src/lib/ratelimit.ts).
- **Aggregates kao server-side counters** preko `FieldValue.increment()` — [src/lib/aggregates.ts](src/lib/aggregates.ts) — ne client-side aggregation koja ne skalira. Plus recompute endpoint za audit recovery.
- **Multi-document handling** — jedan PDF sa više faktura se split-uje na sibling docs sa referencijalnim integritetom ([src/app/api/extract/route.ts:144](src/app/api/extract/route.ts)).
- **Anti-hallucination prompt engineering** — ~2.3 KB system promptа sa worked examples ([src/lib/llm/prompts.ts](src/lib/llm/prompts.ts)) ograničava Gemini da invent-uje vrijednosti.
- **TypeScript strict: true** sa 0 `@ts-ignore` u kodu.
- **Deploy guide** — [docs/DEPLOY.md](docs/DEPLOY.md) detaljan walkthrough za Firebase App Hosting setup.

---

## 🚀 Quick start za reviewera

```bash
git clone https://github.com/alemzukic77-dev/Mastery.git
cd Mastery
npm install
cp .env.example .env.local   # popuni Firebase + Gemini ključeve
npm run dev                  # http://localhost:3000

# Provjeri kvalitet
npm run lint        # ✓ 0 errors
npm run typecheck   # ✓ 0 errors
npm run test        # ✓ 66 tests passing
npm run build       # ✓ 11 routes generated

# Docker
docker compose up
```

---

## 📂 Repo navigacija

```
Mastery/
├── README.md                 ← setup, scripts, tech stack, improvements
├── SUBMISSION.md             ← OVAJ fajl — submission cover sheet
├── Dockerfile                ← multi-stage Docker build
├── docker-compose.yml        ← lokalni dev
├── .github/workflows/ci.yml  ← lint + typecheck + test on PR/push
├── apphosting.yaml           ← Firebase App Hosting config
├── firestore.rules           ← per-user Firestore scoping
├── storage.rules             ← per-user Storage scoping + size/MIME limits
├── firestore.indexes.json    ← composite indexes
├── docs/
│   ├── APPROACH.md           ← arhitekturne odluke
│   ├── API.md                ← API ugovor + data model
│   ├── DEPLOY.md             ← App Hosting deploy walkthrough
│   └── adr/                  ← Architecture Decision Records
└── src/
    ├── app/                  ← Next.js App Router (auth + app + api routes)
    ├── components/           ← UI (shadcn primitives + business components)
    ├── lib/
    │   ├── firebase/         ← client + admin SDKs
    │   ├── extractors/       ← per-format extraction pipeline
    │   ├── llm/              ← Gemini wrapper + anti-hallucination prompts
    │   ├── validation/       ← Zod schemas + rule engine
    │   ├── aggregates.ts     ← server-side counters
    │   └── ratelimit.ts      ← Firestore transaction-based rate limiter
    └── hooks/                ← React hooks (paginated docs, stats)
```

---

## 🧪 Test coverage at a glance

```
Test Files  5 passed (5)
     Tests  66 passed (66)
  Duration  ~400ms
```

| File | Tests | Pokriva |
|---|---|---|
| `rules.test.ts` | 24 | Sve 5 validation pravila iz spec-a + auto-compute total + currency check |
| `schemas.test.ts` | 13 | Zod schema parsing, multi-doc envelopes, malformed input tolerance |
| `utils.test.ts` | 10 | File-kind detection, helpers |
| `extract/route.test.ts` | 9 | Auth (401), rate limit (429), missing input (400), oversize (413), extractor failure → needs_review (422), happy path (200) |
| `documents/[id]/route.test.ts` | 10 | Auth (401), missing doc (404), invalid patch (400), reject/confirm/data variants, DELETE flow |

---

## 🔗 Kontakt

**Alem Zukić** · alem.zukic77@gmail.com · [GitHub](https://github.com/alemzukic77-dev)
