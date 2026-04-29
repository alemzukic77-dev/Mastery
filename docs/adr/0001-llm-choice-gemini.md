# ADR 0001 — Choosing Google Gemini 2.0 Flash for Document Extraction

- **Status**: Accepted
- **Date**: 2026-04-29
- **Decision owner**: Alem Zukic

## Context

Aplikacija mora ekstraktovati strukturirane podatke (supplier, document number, dates, line items, totals) iz heterogenih ulaza: PDF (text-based + scanned), images (PNG/JPG/WebP), CSV, i plain-text. Spec traži:

- Multimodal capabilities — vision za scanned PDF i images bez odvojenog OCR pipeline-a.
- Strukturirani output — preferably JSON Schema-aware, da Zod parse ne pada na svaki drugi response.
- Niska latencija po dokumentu — UX zahtjev "upload → preview" ispod ~10 sekundi za tipičan invoice.
- Razumna cijena — interview demo ne smije biti skup za drugi user-a koji ga proba.
- Brzi setup — projekat ima ~24h-48h scope, ne smije se gubiti dan na infrastrukturu.

## Razmotreni kandidati

| Model | Multimodal | JSON mode | Latencija (1-page invoice) | Cijena (1k inputs/d) | Setup |
|---|---|---|---|---|---|
| **Gemini 2.0 Flash** | Native (PDF + image) | `responseMimeType: "application/json"` | ~2-4s | ~$0.10 | API key |
| Claude 3.5 Sonnet | Image (PDF requires text extraction) | Tool use / prefill | ~3-6s | ~$3 | API key |
| GPT-4o | Image (PDF requires text extraction) | `response_format: json_object` | ~3-5s | ~$2.50 | API key |
| AWS Textract + GPT-4 | Native PDF (Textract OCR) | n/a | ~5-8s (2 hop) | ~$1.50 | IAM, dva servisa |
| Tesseract + LLM | Lokalni OCR + bilo koji LLM | n/a | ~10-15s | ~$0.50 | Native deps, image preproc |

## Odluka

Koristim **Gemini 2.0 Flash** preko `@google/generative-ai` SDK-a za sve formate.

### Ključni razlozi

1. **PDF kao inline data**: Gemini prima PDF buffer direktno bez prethodnog OCR-a ni text extraction-a. Druge opcije zahtijevaju ili `pdf-parse` + dodatni LLM call (dvostruka latencija) ili externi servis (Textract). Single-call simplicity je bitan kad imaš 24h za prototype.
2. **Native vision za scan-ovane PDF-ove**: Gemini može da čita scanned invoice slike sa ~95% accuracy bez Tesseract-a. Eliminiše cijelu klasu image preprocessing bug-ova (deskew, threshold, DPI).
3. **`responseMimeType: "application/json"` + `responseSchema`**: Gemini garantuje validan JSON sa schema enforcement-om (response je već schema-shaped, ne free-form text koji parsiraš). Reduciram broj malformed-JSON failure-a.
4. **Cijena**: ~30× jeftinije od Claude/GPT-4 za istu task. Bitno za demo period — recruiter može uploadati 100 dokumenata bez da budžet ode.
5. **Latencija**: 2.0 Flash je optimizovan za high-throughput. P50 ispod 3s za jednostavan invoice — dovoljno brzo da blocking request u API ruti ne timeout-uje (`maxDuration = 60`).

### Trade-off-ovi koje prihvatam

- **Manje "pametan" od Claude 3.5 Sonnet ili GPT-4** za komplikovane edge case-ove (npr. multi-language invoice sa nestandardnim layout-om). Mitigation: ~2.3 KB anti-hallucination system prompta sa worked examples (`src/lib/llm/prompts.ts`).
- **Vendor lock-in na Google**: ako Gemini API mijenja schema convention ili poskupi, treba refaktor. Mitigation: extraction logika je iza thin SDK wrappera (`src/lib/llm/gemini.ts`) — switch na drugi provider je dan rada, ne sedmica.
- **Bez fine-tuninga za tačno ovaj domain**: model je general-purpose, ne fine-tuned na BS/HR invoice format-e. Mitigation: prompt engineering radi 95% posla; dovoljno za interview demo. Production bi razmotrio Gemini fine-tune ili dedicated invoice-extraction service (npr. AWS Textract Queries).

## Posljedice

- API ključ se čuva server-only (`GEMINI_API_KEY` env var, server actions / API routes). Nikad u client bundle.
- Svaki LLM call ide kroz Zod safe-parse na response (`extractedDataSchema.safeParse`) — graceful skip umjesto crash ako Gemini vrati malformed objekat.
- Multi-doc support: Gemini može da vrati array of documents iz jednog PDF-a (multi-invoice file). Iskorišteno u `src/app/api/extract/route.ts:144` za sibling docs.
- Dodatne mjere: rate limiting (30/min, 60/h, 150/dan po user-u) jer Gemini cijena raste linearno.

## Šta bih promijenio za production

1. **Fallback na Claude 3.5 Sonnet** kad confidence score < threshold ili kad Zod parse fail-uje. Cost-precision trade-off na per-request bazi.
2. **Background job queue** (Cloud Tasks) umjesto blocking API ruta — extraction može trajati 30s+ za multi-page PDF, korisnik trenutno gleda spinner.
3. **Eval harness**: skup od ~50 anotiranih invoice-a, mjerimo per-field accuracy i regress-ujemo na svaku promjenu prompta. Trenutno test coverage validira logiku, ne extraction kvalitet.
