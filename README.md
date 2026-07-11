# GrowEasy AI-Powered CSV Importer

Import CRM leads from **any** CSV layout — Facebook Lead exports, Google Ads exports, other CRMs, sales reports, hand-made spreadsheets. The system parses the file, previews it, and then uses an LLM to semantically map arbitrary columns into the GrowEasy CRM schema, streaming progress back to the browser batch by batch.

> **Position applied for:** Software Developer (Full-Time)
> **Hosted app:** _add URL after deployment_ · **API:** _add URL after deployment_

---

## How it works

```
Browser (Next.js)                     Server (Node + Express)                LLM
┌─────────────────┐                  ┌──────────────────────────┐
│ 1. Drag & drop  │                  │  multer (5 MB, .csv only)│
│ 2. Local preview│  POST /api/import│  csv-parse → RawRow[]    │   batches of 20
│    (PapaParse,  ├─────────────────►│  chunk → concurrent pool ├──────────────►
│    no AI yet)   │                  │  (3 workers, 3 retries   │  Claude / GPT /
│ 3. Confirm      │  NDJSON stream   │   with backoff + jitter) │  Gemini (temp 0,
│ 4. Live progress│◄─────────────────┤  validate + normalize    │  JSON mode)
│    + results    │  meta/batch/done │  (zod-typed env, enums,  │◄──────────────
└─────────────────┘                  │   phones, dates, skips)  │
                                     └──────────────────────────┘
```

Two layers of correctness:

1. **The prompt** (`backend/src/prompts/extraction.prompt.ts`) does the intelligent work — mapping by *meaning* (`"WhatsApp No"` → mobile, `"Remarks"` → `crm_note`), status vocabulary mapping (`"ringing"` → `DID_NOT_CONNECT`), DD/MM vs MM/DD disambiguation, first-email/first-phone rules with the rest appended to `crm_note`.
2. **A deterministic validator** (`backend/src/utils/normalize.ts`) is the gatekeeper — models are probabilistic, so enum membership, `new Date()` parseability, phone/country-code splitting, line-break escaping, and the "no email + no mobile → skip" rule are all enforced in code. A bad model response can never write malformed data.

## Features

- ✅ Drag & drop **and** file-picker upload (`.csv`, max 5 MB)
- ✅ Client-side preview table before any AI call — sticky headers, horizontal + vertical scroll, responsive
- ✅ **Virtualized tables** — 50,000-row files scroll smoothly (only visible rows are mounted)
- ✅ Confirm step — the backend is only called after explicit confirmation
- ✅ **Batch processing** with a concurrency pool (3 in flight) and **retry with exponential backoff + jitter** (3 retries per batch)
- ✅ **Streaming progress** — the API responds with NDJSON events; the UI shows a live progress bar, per-batch pipeline cells, and running imported/skipped counts
- ✅ Results view: imported records, skipped records **with reasons**, totals, duration, and a **Download CRM CSV** button that exports in exact GrowEasy format
- ✅ Failed batches (after all retries) are reported honestly — their rows appear under Skipped instead of vanishing
- ✅ **Dark mode** (system-aware, persisted, no flash on load)
- ✅ **Unit tests** (Vitest) for normalization, batching, pooling and retry logic
- ✅ **Docker** setup for both services + `docker-compose.yml`
- ✅ Provider-agnostic AI layer: **Anthropic Claude, OpenAI, or Google Gemini** via one env var
- ✅ Strict TypeScript on both ends, zod-validated environment, central error handler, graceful shutdown

## Project structure

```
├── backend/
│   └── src/
│       ├── index.ts                 # server entry, graceful shutdown
│       ├── app.ts                   # express app factory (CORS, routes, errors)
│       ├── config/env.ts            # zod-validated environment
│       ├── routes/import.routes.ts  # multer upload config + routes
│       ├── controllers/             # NDJSON streaming + sync JSON endpoints
│       ├── services/
│       │   ├── csv.service.ts       # header-agnostic CSV parsing
│       │   ├── extraction.service.ts# batching, pool, retries, event emission
│       │   └── ai/provider.ts       # Claude / OpenAI / Gemini clients (fetch, no SDKs)
│       ├── prompts/                 # the extraction prompt (the AI brain)
│       ├── utils/                   # chunk / runPool / withRetry, normalize + __tests__
│       └── types/crm.ts             # CRM schema, enums, stream event types
├── frontend/
│   ├── app/                         # Next.js App Router (layout, page, globals)
│   ├── components/                  # Dropzone, DataTable (virtualized), Stepper,
│   │                                # ImportProgress, ResultsView, ThemeToggle
│   └── lib/                         # typed API client (NDJSON reader), CSV helpers
├── samples/                         # three deliberately different test CSVs
└── docker-compose.yml
```

## Getting started

**Prerequisites:** Node.js ≥ 18.17 and an API key for one of: [Google AI Studio](https://aistudio.google.com/apikey) (free tier — easiest), Anthropic, or OpenAI.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # then edit .env:
#   AI_PROVIDER=gemini      (or anthropic / openai)
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

Open http://localhost:3000 and drop in one of the files from `samples/`.

### Run tests

```bash
cd backend && npm test
```

### Docker

```bash
GEMINI_API_KEY=your_key docker compose up --build
# frontend → http://localhost:3000, backend → http://localhost:8080
```

## API

### `POST /api/import` — streaming (used by the UI)

Multipart form with a `file` field. Responds `200` with `application/x-ndjson`; one JSON event per line:

```jsonc
{"type":"meta","totalRows":120,"totalBatches":6,"batchSize":20}
{"type":"batch","result":{"batchIndex":0,"imported":[/* CRM records */],"skipped":[{"rowIndex":4,"reason":"…","raw":{}}],"attempts":1}}
{"type":"batch_error","batchIndex":3,"error":"…"}        // only if all retries failed
{"type":"done","summary":{"totalRows":120,"imported":112,"skipped":8,"batches":6,"failedBatches":0,"durationMs":9421}}
```

### `POST /api/import/sync` — buffered

Same pipeline, single JSON response `{ summary, imported, skipped }`. Handy for curl:

```bash
curl -F "file=@samples/messy_sales_report.csv" http://localhost:8080/api/import/sync
```

### `GET /api/health`

`{ "status": "ok", "provider": "gemini", "uptime": 12.3 }`

**Error responses:** `400` (no/oversized/non-CSV file), `422` (unparseable CSV), `500` (unexpected) — always `{ "error": "human-readable message" }`.

## CRM extraction rules implemented

| Assignment rule | Where enforced |
|---|---|
| `crm_status` ∈ 4 allowed values | prompt (semantic mapping) **+** `normalizeEnum` |
| `data_source` ∈ 5 allowed values, blank if unsure | prompt **+** `normalizeEnum` (e.g. "Facebook" → blank, original kept in `crm_note`) |
| `created_at` valid for `new Date()` | prompt (format conversion) **+** `isParseableDate` fallback to blank |
| Multiple emails/phones → first wins, rest to `crm_note` | prompt rule 5 |
| Extra info → `crm_note` | prompt rule 8 |
| Single CSV row per record (escape `\n`) | prompt **+** `escapeLineBreaks` on every field |
| No email **and** no mobile → skip | prompt skip rule **+** `finalizeRecord` hard check |

## Deployment

- **Frontend → Vercel:** import the repo, set *Root Directory* = `frontend`, add env `NEXT_PUBLIC_API_URL=https://<your-backend-url>`. Deploy.
- **Backend → Railway / Render:** *Root Directory* = `backend`, build `npm install && npm run build`, start `npm start`. Set `AI_PROVIDER`, the matching API key, and `CORS_ORIGIN=https://<your-vercel-domain>` (or `*` while testing). Both platforms inject `PORT` automatically, which the server respects.
- Redeploy the frontend after the backend URL is final.

## Edge cases handled

Empty files, header-only files, blank rows, duplicate/missing headers, rows wider than the header line, BOM markers, quoted fields with embedded newlines, non-CSV uploads, >5 MB uploads, invalid emails in email columns, phone numbers with country codes/trunk zeros/dashes/spaces, unmappable statuses/sources, unparseable dates, model responses wrapped in markdown fences, model responses that drop rows (re-aligned by `__row` index, missing rows surfaced as skipped), and entire batches failing after retries (reported, not swallowed).

## Notes on design decisions

- **Why NDJSON over SSE/WebSockets:** the import is a single request/response with progress — a streamed body is the simplest thing that works everywhere (including serverless proxies) with zero extra dependencies.
- **Why no SDKs for the AI providers:** three small `fetch` clients keep the install lean, make failure modes explicit, and made provider-swapping a one-line env change.
- **Stateless by design:** the assignment marks a database as optional; nothing here needs one, which keeps hosting free-tier friendly. Adding persistence would be a repository layer behind `extraction.service.ts`.
