# GrowEasy — AI-Powered CSV Importer

> **Hosted application:** https://grow-easy-crm-two.vercel.app
> **Backend API:** https://grow-easy-crm.onrender.com ([health check](https://grow-easy-crm.onrender.com/api/health))
> **Position applied for:** Software Developer (Full-Time)

Import CRM leads from **any valid CSV format** — Facebook Lead exports, Google Ads exports, real-estate CRM exports, sales reports, marketing agency CSVs, or hand-made spreadsheets. The system does not assume any column names: an LLM semantically maps whatever columns the file has into the GrowEasy CRM format, and a deterministic validator guarantees the output is always clean.

> ⏳ **Note for reviewers:** the backend runs on Render's free tier and sleeps when idle — the **first** request may take ~50 seconds to wake it up. Every request after that is fast.

---

## Assignment Overview — how the challenge is solved

The challenge is not parsing CSVs — it is mapping **unknown columns** to known CRM fields. This project solves it with two layers:

1. **AI layer** ([`backend/src/prompts/extraction.prompt.ts`](backend/src/prompts/extraction.prompt.ts)) — maps columns by *meaning*, not by name: `"WhatsApp No"` → mobile, `"Agent Remarks"` → `crm_note`, `"ringing"` → `DID_NOT_CONNECT`, `"Eden Park Ph-2 FB"` → `eden_park`. Handles DD/MM vs MM/DD dates, unnamed columns (decided from the values), and mixed languages.
2. **Deterministic validation layer** ([`backend/src/utils/normalize.ts`](backend/src/utils/normalize.ts)) — models are probabilistic, so every AI answer is re-checked in code: enum membership, `new Date()` parseability, phone/country-code splitting, first-email/first-phone rules, line-break escaping, and the skip rule. **A bad model response can never write malformed data into the CRM.**

```
Browser (Next.js)                     Server (Node + Express)                LLM
┌─────────────────┐                  ┌──────────────────────────┐
│ 1. Drag & drop  │                  │  multer (5 MB, .csv only)│
│ 2. Local preview│  POST /api/import│  csv-parse → records     │   batches of 40
│    (no AI yet)  ├─────────────────►│  duplicate detection     ├──────────────►
│ 3. Confirm      │  NDJSON stream   │  batches → retry pool    │     Gemini
│ 4. Live progress│◄─────────────────┤  validate + normalize    │◄──────────────
│    + results    │  meta/batch/done │  quality + skip rules    │
└─────────────────┘                  └──────────────────────────┘
```

---

## Frontend Requirements — implementation

| Step | Requirement | How it is implemented |
|---|---|---|
| **1. Upload CSV** | Drag & drop / file picker | Both — [`Dropzone.tsx`](frontend/components/Dropzone.tsx) with client-side validation (`.csv` only, max 5 MB, empty-file check) |
| **2. Preview** | Parse + show rows in a responsive table; **no AI yet** | CSV parsed locally with PapaParse; virtualized table with sticky headers, horizontal + vertical scrolling. Zero backend calls at this step |
| **3. Confirm Import** | Backend called only after Confirm | The **Confirm import** button is the only trigger for the API call |
| **4. Display Parsed Result** | Show parsed records, skipped records, total imported, total skipped | Results screen with stat tiles (total rows / imported / skipped / duplicates / time), Imported and Skipped tabs — every skipped row carries a human-readable **reason** |

## Backend Requirements — implementation

| # | Requirement | How it is implemented |
|---|---|---|
| **1. Accept CSV Upload** | Any valid CSV, no fixed column names | multer upload; original headers are kept verbatim — nothing is hardcoded |
| **2. Parse CSV** | Convert to records | `csv-parse` — handles BOM, quoted fields, embedded newlines, ragged rows, duplicate/blank headers |
| **3. AI Extraction** | Send records in batches | Batches of 40 rows, 2 batches concurrently, retry with exponential backoff (rate-limit aware). Provider-agnostic: **Gemini** (default), Claude, or OpenAI via one env var |
| **4. Return Structured JSON** | JSON output | NDJSON progress stream (`POST /api/import`) + buffered JSON (`POST /api/import/sync`) |

## CRM Fields

All 15 fields from the assignment are extracted: `created_at`, `name`, `email`, `country_code`, `mobile_without_country_code`, `company`, `city`, `state`, `country`, `lead_owner`, `crm_status`, `crm_note`, `data_source`, `possession_time`, `description`.

## AI Instructions — every rule enforced in code, not just prompted

| # | Assignment rule | Where enforced |
|---|---|---|
| 1 | `crm_status` ∈ GOOD_LEAD_FOLLOW_UP / DID_NOT_CONNECT / BAD_LEAD / SALE_DONE | prompt (semantic mapping: "ringing" → DID_NOT_CONNECT) **+** code (`normalizeEnum` blanks anything else) |
| 2 | `data_source` ∈ 5 allowed values, blank if unsure | prompt **+** code ("Facebook" → blank, original kept in `crm_note`) |
| 3 | `created_at` valid for `new Date()` | prompt (format conversion, DD/MM disambiguation) **+** code (`isParseableDate`, falls back to blank + original in `crm_note`) |
| 4 | `crm_note` for remarks, extra contacts, anything without a field | prompt catch-all rule, pieces joined with `\|` |
| 5 | Multiple emails/mobiles → first wins, rest appended to `crm_note` | prompt **+** deterministic code fallback (`splitExtraEmails` / `splitExtraPhones`) in case the model misses one |
| 6 | Single CSV row per record, line breaks escaped as `\n` | `escapeLineBreaks` applied to every field |
| 7 | Skip records with neither email nor mobile | prompt skip rule **+** hard code check — reported under Skipped with a reason, never silently dropped |

---

## Beyond the assignment

Three extra features built around how GrowEasy works as a product:

- 🔥 **AI lead-quality scoring** — every imported lead gets a **HOT / WARM / COLD** badge with a one-line reason ("Site visit booked, budget confirmed"), mirroring the Quality column in the GrowEasy CRM. Scored inside the *same* AI call as extraction — zero extra API cost.
- 🧹 **Duplicate lead detection** — rows sharing an email or phone (`+91 98765 43210` ≡ `09876543210` ≡ `9876543210`) are caught **before** the AI call: no quota wasted, CRM stays clean, and each duplicate reports which row it collided with.
- 📊 **Import insights** — the results screen shows the quality distribution and CRM-status breakdown at a glance, so a sales manager knows where to start calling.

## Bonus Points — all implemented

- ✅ Drag & drop upload
- ✅ Progress indicators during AI processing (live progress bar, per-batch pipeline, running counts)
- ✅ Streaming — the API streams NDJSON events; results appear batch by batch
- ✅ Retry mechanism for failed AI batches (exponential backoff + jitter; 429-aware: waits out the rate-limit window instead of burning quota)
- ✅ Virtualized table — 50,000-row files scroll smoothly (only visible rows are mounted)
- ✅ Dark mode (system-aware, persisted, no flash on load)
- ✅ Unit tests — 24 Vitest tests for normalization, dedupe, batching, pooling and retry logic
- ✅ Docker setup — Dockerfile for each service + `docker-compose.yml`
- ✅ Deployed — frontend on **Vercel**, backend on **Render**
- ✅ This README

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| AI | Google Gemini (default) — Claude / OpenAI supported via `AI_PROVIDER` env |
| Database | None — stateless by design (assignment marks it optional) |

---

## Setup Instructions

**Prerequisites:** Node.js ≥ 18.17 and a free API key from [Google AI Studio](https://aistudio.google.com/apikey) (or Anthropic / OpenAI).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # then edit .env:
#   AI_PROVIDER=gemini
#   GEMINI_API_KEY=your_key
npm run dev                 # → http://localhost:8080
```

### 2. Frontend (new terminal)

```bash
cd frontend
npm install
cp .env.example .env        # NEXT_PUBLIC_API_URL=http://localhost:8080
npm run dev                 # → http://localhost:3000
```

Open http://localhost:3000 and drop in one of the files from [`samples/`](samples/) — three deliberately different messy CSVs are included.

### Run tests

```bash
cd backend && npm test      # 24 tests
```

### Docker

```bash
GEMINI_API_KEY=your_key docker compose up --build
# frontend → http://localhost:3000, backend → http://localhost:8080
```

---

## API Reference

### `POST /api/import` — streaming (used by the UI)

Multipart form with a `file` field. Responds `200` with `application/x-ndjson`, one event per line:

```jsonc
{"type":"meta","totalRows":120,"totalBatches":3,"batchSize":40}
{"type":"duplicates","skipped":[{"rowIndex":7,"reason":"Duplicate lead — same contact as row 3","raw":{}}]}
{"type":"batch","result":{"batchIndex":0,"imported":[/* CRM records + lead_quality */],"skipped":[],"attempts":1}}
{"type":"done","summary":{"totalRows":120,"imported":110,"skipped":10,"duplicates":1,"batches":3,"failedBatches":0,"durationMs":9421}}
```

### `POST /api/import/sync` — buffered

Same pipeline, single JSON response. Try it against the live deployment:

```bash
curl -F "file=@samples/messy_sales_report.csv" https://grow-easy-crm.onrender.com/api/import/sync
```

### `GET /api/health`

`{ "status": "ok", "provider": "gemini", "uptime": 12.3 }`

**Error responses:** `400` (no/oversized/non-CSV file), `422` (unparseable CSV), `500` (unexpected) — always `{ "error": "human-readable message" }`.

---

## Edge cases handled

Empty files, header-only files, blank rows, duplicate/missing headers, rows wider than the header line, BOM markers, quoted fields with embedded newlines, non-CSV uploads, >5 MB uploads, invalid emails in email columns, phone numbers with country codes/trunk zeros/dashes/spaces, multiple emails/phones bunched in one cell, duplicate leads across different formats, unmappable statuses/sources, unparseable dates, model responses wrapped in markdown fences, model responses that drop rows (re-aligned by row index, missing rows surfaced as skipped), and entire batches failing after retries (reported honestly under Skipped, never swallowed).

## Design decisions

- **Why NDJSON over WebSockets:** an import is one request with progress — a streamed body is the simplest thing that works everywhere (including serverless proxies) with zero extra dependencies.
- **Why no AI SDKs:** three small `fetch` clients keep the install lean and made provider-swapping a one-line env change.
- **Why validation in code and not just the prompt:** prompts aim for high recall; the deterministic validator guarantees precision. The assignment's rules are contracts, and contracts belong in code.
- **Stateless by design:** nothing here needs a database, which keeps hosting free-tier friendly. Persistence would slot in as a repository layer behind `extraction.service.ts`.
