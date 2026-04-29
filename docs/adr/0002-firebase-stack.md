# ADR 0002 — Firebase as Full-Stack Backend (Auth + Firestore + Storage + App Hosting)

- **Status**: Accepted
- **Date**: 2026-04-29
- **Decision owner**: Alem Zukic

## Context

Aplikacija mora obezbijediti:

- **Authentication** sa email/password + Google SSO, sa per-user data isolation.
- **Database** za document metadata, validation issues, status workflow, aggregates.
- **Object storage** za originalne fajlove (PDF/image/CSV/TXT, do 20 MB).
- **Server-side runtime** za Next.js 16 App Router, jer Gemini API key ne smije u browser.
- **Hosting** sa SSR support za Next.js i predictable cold-start ponašanjem.
- **Deploy** za 24h-48h interview window — bez vremena za infrastructure-as-code, custom CI/CD pipelines, ili networking config.

Multi-user support znači da svako pravilo (rule, query, storage path) mora biti scoped pod `userId` — user A ne smije nikad vidjeti dokumente user B.

## Razmotreni kandidati

| Stack | Auth | DB | Storage | Hosting | Setup vrijeme | Per-user scoping |
|---|---|---|---|---|---|---|
| **Firebase** | Auth | Firestore | Cloud Storage | App Hosting (SSR) | ~30 min | Native preko Security Rules |
| Supabase | Auth | Postgres | Storage | Vercel/Fly | ~1h | RLS policies |
| Custom (Next + Postgres + S3) | NextAuth/Lucia | Postgres (Neon/Supabase) | S3/R2 | Vercel | ~3-4h | Manual u svakom query-ju |
| Clerk + Convex | Clerk | Convex | Convex Files | Vercel | ~1h | Convex auth context |
| AWS Amplify | Cognito | DynamoDB/Aurora | S3 | Amplify | ~2-3h | IAM scoping |

## Odluka

Koristim **Firebase ekosistem** za sve backend potrebe:

- **Firebase Auth** za email/password + Google sign-in.
- **Firestore** za document metadata, aggregates, rate-limit counters.
- **Cloud Storage for Firebase** za originalne fajlove.
- **Firebase App Hosting** za Next.js SSR deploy (auto-deploy iz GitHub-a).
- **Admin SDK (`firebase-admin`)** server-side za privileged operacije iz API ruta.

### Ključni razlozi

1. **Najbrži put do funkcionalnog full-stack-a**: jedan `firebase init` daje auth, DB, storage, hosting. Konkurencija traži 3-4 odvojena servisa sa odvojenom konfiguracijom.
2. **Security Rules su deklarativne, ne imperativne**: per-user scoping (`users/{userId}/documents/{docId}`) se garantuje na nivou DB engine-a, ne u app kodu. Ne mogu zaboraviti `WHERE user_id = ?` u nekom query-ju jer Firestore Rules to brane na infrastrukturnom nivou.
   - `firestore.rules:12` — `allow create: if false` — klijent ne smije ništa kreirati direktno; sve ide kroz Admin SDK iz server route-a, što garantuje da aggregates ostanu konzistentni.
   - `storage.rules:10-11` — 20 MB cap + MIME allowlist hardcoded.
3. **App Hosting native za Next.js SSR**: razumije App Router, server actions, streaming. Vercel-equivalent na GCP-u, ali integrisan sa Firebase Auth/Firestore (isti project ID, isti billing).
4. **Real-time subscriptions out-of-the-box**: dashboard live-update kad extraction završi (`onSnapshot` u client komponentama) bez custom WebSocket pipeline-a.
5. **Realna Bosna/Balkan dostupnost**: `us-central1` ili `europe-west1` regiona, niska latencija iz EU.

### Trade-off-ovi koje prihvatam

- **NoSQL (Firestore) ima limitacije za relational queries**: nema joins, kompleksne agregacije se rade preko denormalizacije i `FieldValue.increment()` counters (`src/lib/aggregates.ts`). Za document-extraction domain (uglavnom CRUD per document, dashboard counts po user-u), to je acceptable — ne radimo BI reporting.
- **Vendor lock-in**: Firestore data model + Security Rules ne migriraju trivijalno na Postgres. Mitigation: za ovaj scope projekta, lock-in je razumna cijena za brzinu. Za 10× veći projekat išao bih na Postgres + Drizzle.
- **App Hosting je relativno nov**: launch 2024, manje battle-tested od Vercel-a. Mitigation: za interview demo dovoljno; ako ne radi, fallback je Cloud Run sa Next.js standalone build-om.
- **Cijena nakon free tier-a**: Firestore reads se brzo nakupljaju. Mitigation: aggregates document drži cache-iranje stats-a (1 read za dashboard umjesto N reads).

### Što sam mogao bolje

- **Eksplicitan rate limit u Security Rules** (npr. write-throttle per user) je teško izvodivo u Firestore Rules sintaksi. Završio sam Firestore-transaction-based rate limiter (`src/lib/ratelimit.ts`) — radi, ali troši Firestore writes.
- **Aggregates kao client-side computation** bi bilo lakše implementirati, ali ne skaluje. Server-side `FieldValue.increment()` u API ruti zahtijeva više pažnje (consistency window, recompute fallback) ali je production-pravac.

## Posljedice

- Sav protected pristup ide kroz **dva nezavisna sloja**: Firebase Auth ID token verifikacija u API rutama (`adminAuth().verifyIdToken()`) **plus** Security Rules u DB/Storage. Defense in depth — ako jedan sloj otkaže, drugi i dalje brani.
- **Nikakav direct client write u Firestore za documents**: sve ide kroz Next.js API rute, što omogućava server-side validation, rate limiting, i aggregate updates u istoj transakciji.
- **Deploy procedura je polu-automatska**: rules se push-uju preko `firebase deploy --only firestore:rules,storage`, app build se push-uje na connected GitHub branch, App Hosting auto-deploy-a.
- **Lokalni dev**: Firebase emulator suite je dostupan ali nije korišten — nije bilo vremena. Trade-off: testovi mokuju Admin SDK umjesto da hit-uju emulator.

## Šta bih promijenio za production

1. **Migracija aggregates na Cloud Functions trigger** umjesto inline updates u API ruti (cleaner separation).
2. **Audit log collection** — svaka korekcija od user-a kreira event entry, da se može vratiti.
3. **Firestore security rules sa formalnim test suite-om** (`@firebase/rules-unit-testing`).
4. **Multi-region setup** — sada je single region; production traži EU + US replication za latency i compliance.
