# ADR 0003 — Hybrid Per-Format Extraction Pipeline

- **Status**: Accepted
- **Date**: 2026-04-29
- **Decision owner**: Alem Zukic

## Context

Spec traži uniform user experience: bilo koji od 4 formata (PDF, image, CSV, TXT) treba završiti sa istim `ExtractedData` shape-om. Ali svaki format ima svoje karakteristike:

- **PDF**: može biti text-based (selectable text) ili scanned (samo bitmap). Multimodal LLM hendla oboje, ali plain text je jeftiniji i brži.
- **Image**: nema text layer-a; mora vision/OCR.
- **CSV**: već strukturiran, ali kolone variraju ("Total" vs "Iznos" vs "Amount Due" vs "Sum"). Trebamo normalizaciju.
- **TXT**: free-form, najteže za parsiranje pravilima — LLM je natural fit.

Pitanje je: jedan-LLM-poziv za sve formate, ili per-format pipeline?

## Razmotreni pristupi

### A. Single multimodal call za sve

Pošalji raw bytes Gemini-ju nezavisno od formata. Gemini razumije PDF, image, text natively.

**Plus**: minimum koda, jedan code path.
**Minus**: skuplje (PDF kao bytes je više input tokena nego ekstraktovan tekst), ne iskorišćava strukturu CSV-a, fallback ako multimodal call padne nije trivijalan.

### B. Per-format pipeline sa LLM kao final stepom

Svaki format ima svoj prep step (parse PDF text, parse CSV rows, decode TXT), pa onda LLM normalizuje to u `ExtractedData`. Image i scanned PDF idu na multimodal call.

**Plus**: jeftinije (manje tokena), brže (text mode latency < multimodal), jasniji failure mode (ako PDF parse padne, znaš zašto).
**Minus**: 4 code path-a, više surface area za bug-ove.

### C. Pure rule-based parsing

Regex/heuristic za sve formate, bez LLM-a.

**Plus**: deterministic, jeftino, brzo.
**Minus**: nemoguće za TXT i scanned PDF, krhko za invoice variations (svaki supplier ima drugačiji layout). Eliminisano kao opcija.

## Odluka

Idem sa **opcijom B (hybrid per-format)** sa LLM-om kao finalnim normalization step-om.

```
src/lib/extractors/
├── index.ts       — dispatch po MIME type/extension
├── pdf.ts         — multimodal call sa fallback na pdf-parse + text mode
├── image.ts       — multimodal call (vision)
├── csv.ts         — papaparse → text → text mode
├── txt.ts         — direktan text → text mode
```

### Za svaki format

- **PDF** (`pdf.ts:16`):
  1. Try multimodal sa `inlineData` (PDF kao bytes). 95% case.
  2. Catch greške (Gemini rejection, oversized, malformed PDF) → fallback: `pdf-parse` izvuče text, pošalje text mode poziv.
  3. Oba puta vraćaju isti `ExtractorResult`.
- **Image**: multimodal call, jednostavan path. Ne treba fallback jer image bez vision-a ne može.
- **CSV** (`csv.ts:20`): `papaparse` → pipe-delimited text representation → text-mode LLM poziv. CSV-ovi nisu uniformni po kolonama (`Net Total` vs `Iznos bez PDV-a`), pa LLM normalizuje. Direktno mapiranje header → field nije robusno.
- **TXT**: text mode LLM poziv direktno na contents.

### Schema enforcement

Svaki extractor vraća `extractor.documents: ExtractedData[]` (može biti više dokumenata u jednom file-u — multi-invoice PDF). LLM response prolazi kroz `safeParseExtractions()` (`src/lib/validation/schemas.ts:57`) sa graceful skip:
- Ako Gemini vrati 5 dokumenata i 1 ne prolazi schema → ostala 4 se persist-uju, jedan se loguje.
- Ako svi pad(n)u → throw, API ruta hvata i postavlja status `needs_review` sa `EXTRACTION_FAILED`.

## Posljedice

- **Test surface je manji**: validation logiku testira `rules.test.ts`, schema parsing `schemas.test.ts`. Per-format extractor se može mock-ovati u API ruta testovima.
- **Failure isolation**: ako se update Gemini SDK-a, image extractor padne, PDF i dalje rade.
- **Cost optimizacija**: text-mode pozivi (TXT, CSV, PDF fallback) koštaju ~5× manje od multimodal poziva. Za demo gdje user uploaduje uglavnom CSV-ove ili text-based PDF-ove, to znači jeftinije.
- **Sibling docs i multi-doc**: jedan PDF može sadržavati N invoice-a; extractor returns array; API ruta kreira sibling docs sa `siblingIds` reference (`src/app/api/extract/route.ts:144`). Ovo je netrivijalan feature koji per-format pipeline omogućava prirodno.

## Šta bih promijenio za production

1. **Confidence scoring**: trenutno LLM ne vraća confidence per polju. Switch na model koji vraća (npr. structured outputs sa probability) i highlight low-confidence polja u review UI-u.
2. **OCR bounding boxes**: Document AI ili Tesseract sa Hocr → highlightuj sumnjive regione na originalu u preview-u. Zahtijeva drugi OCR pipeline.
3. **Caching identičnih file hash-eva**: ako user upload-a isti PDF dvaput, ne treba re-extraction. Mitigation: SHA-256 hash kao Firestore key.
4. **Async pipeline**: extractor → message queue → worker → Firestore update. Trenutno blokira HTTP request, što ograničava na 60s i daje lošiji UX.
