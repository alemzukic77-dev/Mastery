# Mastery — Smart Document Processing System

Full-stack web aplikacija koja prima poslovne dokumente (invoices i purchase orders) u formatima PDF, image, CSV i TXT, ekstraktuje strukturirane podatke pomoću Gemini multimodal LLM-a, validira ih kroz pravila (detekcija pogrešnih totala, missing fields, duplikata, neispravnih kalkulacija), i daje korisniku review interface za ručnu korekciju i potvrdu.

Built za Mastery.ba take-home interview task.

---

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **shadcn/ui** (Radix primitives) + **Lucide** icons
- **Firebase** Auth (email/password) + Firestore + Storage + App Hosting
- **Google Gemini 2.0 Flash** za multimodal document extraction
- **Zod** za runtime validation, **React Hook Form** za forme
- **Vitest** za unit testove
- **Docker** za containerized lokalni dev (bonus)

---

## Setup

### 1. Cloniraj repo i instaliraj dependencies
```bash
git clone https://github.com/alemzukic77-dev/Mastery.git
cd Mastery
npm install
```

### 2. Konfiguriši environment
```bash
cp .env.example .env.local
```

Otvori `.env.local` i popuni:

- **`NEXT_PUBLIC_FIREBASE_*`** — iz Firebase Console → Project Settings → Your apps → Web app config
- **`FIREBASE_ADMIN_*`** — iz Firebase Console → Project Settings → Service Accounts → Generate new private key. Iz JSON fajla uzmi `client_email` i `private_key` (zadrži escape-ovane `\n` ako kopiraš jednoliniju verziju).
- **`GEMINI_API_KEY`** — iz [aistudio.google.com](https://aistudio.google.com/apikey)

### 3. Pokreni dev server
```bash
npm run dev
```
Otvori [http://localhost:3000](http://localhost:3000).

### 4. (Opcionalno) Deploy Firestore/Storage rules
```bash
npx firebase-tools deploy --only firestore:rules,storage --project mastery-3afd9
```

---

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run start` — pokreni production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript provjera bez emit
- `npm run test` — Vitest unit testovi

---

## Approach

### Ekstrakcija
Hybrid: rule-based parsing + LLM. Svaki tip dokumenta ide kroz svoju extractor funkciju (`src/lib/extractors/`), a finalna structured ekstrakcija se radi preko Gemini-a sa strict JSON schema response-om.

- **PDF** → Gemini multimodal (PDF as inline data) sa fallback na `pdf-parse` + Gemini text mode.
- **Image (PNG/JPG)** → Gemini multimodal (vision) — eliminiše potrebu za odvojenim OCR-om.
- **CSV** → `papaparse` + Gemini normalize step (jer CSV-ovi nisu uniformni po izgledu).
- **TXT** → Gemini text mode direktno na sadržaj.

Sve LLM pozive radimo **server-side** kroz `/api/extract` route — API ključ nikad ne ide u browser.

### Validacija
`src/lib/validation/rules.ts` izvršava 5 provjera iz spec-a:

1. **`TOTAL_MISMATCH`** — `sum(lineItems.amount) + tax ≠ total` (error)
2. **`MISSING_FIELD`** — required polja: supplier, documentNumber, issueDate, total (error per field)
3. **`INVALID_DATE`** — datumi ne parsuju, ili `dueDate < issueDate` (error)
4. **`LINE_ITEM_MISMATCH`** — `quantity × unitPrice ≠ amount` (warning per line)
5. **`DUPLICATE_DOC_NUMBER`** — postoji već dokument sa istim brojem za istog user-a (warning)

Status workflow:
- `uploaded` (just-after-upload) → automatska ekstrakcija
- `needs_review` (ima issues) → user manually corrects
- `validated` (sve čisto, ili user confirms) → final
- `rejected` (user discards)

### Multi-user scoping
Sve je scoped pod `users/{userId}/documents/{docId}` u Firestore-u i `users/{userId}/documents/{docId}/{fileName}` u Storage-u. Firestore i Storage rules garantuju da user-i ne mogu vidjeti tuđe dokumente.

---

## AI Tools Used

- **Claude Code** (Opus 4.7) — pair programming, scaffolding, refaktor, test generation
- **Gemini 2.0 Flash API** — runtime document extraction (production usage, ne dev tool)

Validation logic, business rules, security rules, i UI/UX decisions su pisane svjesno — ne kopirane sirovo iz LLM outputa.

---

## Deployed App

🌐 **Live URL**: [https://mastery--mastery-3afd9.us-east4.hosted.app](https://mastery--mastery-3afd9.us-east4.hosted.app)

Repo: [github.com/alemzukic77-dev/Mastery](https://github.com/alemzukic77-dev/Mastery)

---

## Project Structure

```
Mastery/
├── apphosting.yaml              ← Firebase App Hosting config
├── firebase.json                ← Firestore + Storage rules deploy
├── firestore.rules              ← per-user document scoping
├── storage.rules                ← per-user file scoping + size/type limits
├── firestore.indexes.json
├── mastery_task/                ← original task spec + sample resources
└── src/
    ├── app/                     ← Next.js App Router routes
    │   ├── (auth)/              ← login, signup
    │   ├── (app)/               ← protected: dashboard, upload, documents
    │   └── api/                 ← server-only: extract, document CRUD
    ├── components/
    │   ├── ui/                  ← shadcn primitives
    │   ├── auth/, documents/, dashboard/
    ├── lib/
    │   ├── firebase/            ← client + admin SDKs
    │   ├── extractors/          ← per-format extraction
    │   ├── llm/                 ← Gemini wrapper + prompts
    │   ├── validation/          ← Zod schemas + rule engine
    │   ├── types.ts
    │   └── utils.ts
    └── hooks/                   ← React hooks
```

---

## Improvements I Would Make (sa više vremena)

- **Strožiji extraction eval set** — pokrenuti automatske testove sa svim sample dokumentima i mjeriti accuracy po polju
- **Background job queue** za batch upload — trenutno extraction blokira upload request, sa Cloud Tasks bi se odvojilo
- **Audit log** — svaka korekcija od strane usera bi trebala kreirati history entry da se može vratiti
- **Multi-page PDF handling** — trenutno jedan dokumenat = jedan invoice; PDF sa više stranica trebao bi biti split na više dokumenata
- **OCR confidence highlights** — Gemini vraća text bez bounding boxa; sa Document AI ili Tesseract mogli bismo highlightovati sumnjiva polja u preview-u
- **Webhook / email notification** kada dokument pređe u `needs_review`
- **CSV/Excel export** validiranih dokumenata za ERP integraciju
- **Role-based access** — admin koji vidi sve user-e (za enterprise scenario)
- **i18n** — trenutno hardkodiran engleski/bosanski miks; izdvojiti u resource fajlove

---

## License

Privatno za Mastery.ba interview proces.
