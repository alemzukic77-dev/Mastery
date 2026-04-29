# Deployment Guide — Firebase App Hosting

Ovaj guide vodi te kroz deploy Mastery aplikacije na Firebase App Hosting.

## Šta je već deployovano

✅ **Firestore rules** (`firestore.rules`) — per-user document scoping
✅ **Firestore indexes** (`firestore.indexes.json`) — composite indexes za status + createdAt queries
✅ **Code na GitHubu**: https://github.com/alemzukic77-dev/Mastery

## Šta još treba

- ⏳ Enable Firebase Storage u console-u
- ⏳ Deploy Storage rules
- ⏳ Setup Google Secret Manager za API ključeve
- ⏳ Kreirati App Hosting backend (povezuje GitHub repo)
- ⏳ First deploy

---

## Korak 1 — Enable Firebase Storage

1. Otvori: https://console.firebase.google.com/project/mastery-3afd9/storage
2. Klikni **"Get Started"**
3. Izaberi production mode (rules ćemo override-ovati u sljedećem koraku) ili test mode (ne preporučuje se za produkciju)
4. Izaberi region (preporuka: `europe-west1` ili `us-central1`)

Onda iz terminala:
```bash
firebase deploy --only storage --project mastery-3afd9
```

Ovo deploy-uje `storage.rules` koji ograničava pristup na `users/{uid}/documents/...` i max 20MB upload + dozvoljen samo PDF/image/csv/text content type.

---

## Korak 2 — Setup Google Secret Manager

App Hosting čita secrets iz Google Secret Manager-a. `apphosting.yaml` referencira ove secrete:

| Secret name | Vrijednost | Source |
|---|---|---|
| `FIREBASE_API_KEY` | Firebase web API key | Project Settings → Your apps → Web app config |
| `FIREBASE_APP_ID` | Firebase web app ID | isto |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Service account email | Project Settings → Service Accounts → Generate new private key (iz JSON-a) |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Service account private key (multiline string) | Iz istog JSON-a |
| `GEMINI_API_KEY` | Gemini API key | https://aistudio.google.com/apikey |

### Setup preko CLI

Najbrže kroz Firebase CLI:

```bash
# Per secret, jedan po jedan
firebase apphosting:secrets:set FIREBASE_API_KEY --project mastery-3afd9
firebase apphosting:secrets:set FIREBASE_APP_ID --project mastery-3afd9
firebase apphosting:secrets:set FIREBASE_ADMIN_CLIENT_EMAIL --project mastery-3afd9
firebase apphosting:secrets:set FIREBASE_ADMIN_PRIVATE_KEY --project mastery-3afd9
firebase apphosting:secrets:set GEMINI_API_KEY --project mastery-3afd9
```

CLI će tražiti secret value (paste) za svaki. Za `FIREBASE_ADMIN_PRIVATE_KEY`, kopiraj cijelu vrijednost iz service account JSON-a (uključujući `-----BEGIN PRIVATE KEY-----` i `-----END PRIVATE KEY-----` linije, sa `\n` literalom za nove linije).

CLI će automatski grantovati App Hosting service account-u pristup do tih secret-a.

---

## Korak 3 — Kreirati App Hosting Backend

App Hosting backend povezuje GitHub repo sa Firebase deployment infrastrukturom.

### Preko Firebase Console (preporuka — UI flow zahtjeva GitHub OAuth):

1. Otvori: https://console.firebase.google.com/project/mastery-3afd9/apphosting
2. Klikni **"Get started"** ili **"Create backend"**
3. Region: izaberi (preporuka: `europe-west1` ili `us-central1` — isti kao Storage)
4. Connect GitHub repository:
   - Authorize Firebase GitHub App ako prvi put
   - Repo: `alemzukic77-dev/Mastery`
   - Branch: `main`
   - Live deploy: **enable** (auto-deploy on push)
   - Root directory: `/` (default)
5. Backend ID: `mastery` (ili po želji)
6. **Create**

Firebase će:
- Provjeriti `apphosting.yaml` 
- Provjeriti da svi referencirani secret-i postoje u Secret Manager-u
- Pokrenuti prvi build + deploy
- Generisati live URL: `https://mastery--mastery-3afd9.<region>.hosted.app` (ili sličnog formata)

### Praćenje deploy-a

```bash
firebase apphosting:rollouts:list mastery --project mastery-3afd9
```

Ili u Firebase Console → App Hosting → Backend → Rollouts.

---

## Korak 4 — Verifikacija

1. Otvori live URL u browseru
2. Klikni "Get started" → kreiraj novi account (signup)
3. Auto-redirect na /dashboard
4. Klikni "Upload" → drag-drop neki sample dokument iz `mastery_task/resources/`
5. Sačekaj extraction (~2-5s)
6. Klikni "Review" → vidi extracted polja + validation issues
7. Editaj polje → Save → potvrdi da se status updateuje
8. Confirm → status `validated`, redirect na dashboard
9. Otvori DevTools → Sources → search "GEMINI" — **NE** smije biti pronađen u browser bundle-u
10. Otvori DevTools → Application → Storage → Cookies — vidi Firebase auth state

---

## Auto-deploy on push

Kad backend bude konfigurisan sa "Live deploy: enable" na main branch-u, svaki `git push origin main` će automatski triggerovati novi build + rollout. Status u Firebase Console → Rollouts.

---

## Troubleshooting

### Build fails na "Cannot find module '@/...'"
- Provjeri da je `tsconfig.json` paths postavljeno (`"@/*": ["./src/*"]`) — već jeste

### Build fails na env vars
- Provjeri da svi secret-i iz `apphosting.yaml` postoje u Secret Manager-u
- Provjeri spelling — `apphosting.yaml` referencira `FIREBASE_API_KEY` (bez `NEXT_PUBLIC_`), a runtime će ih izložiti pod `NEXT_PUBLIC_FIREBASE_API_KEY`

### Storage upload 403
- Provjeri da je Storage Rules deploy-ovan (`firebase deploy --only storage`)
- Provjeri da je `storage.rules` allow-uje `request.resource.size < 20MB` i da contentType matcha pattern

### Extraction fails sa 401
- Provjeri da je client šalje Bearer token (`user.getIdToken()`)
- Provjeri da je service account email/private key correct u secret-ima
- Logs u Firebase Console → App Hosting → Backend → Logs

### Gemini API errors
- Provjeri da je `GEMINI_API_KEY` validan na https://aistudio.google.com/apikey
- Provjeri rate limits — Gemini Flash ima 15 RPM free tier limit
