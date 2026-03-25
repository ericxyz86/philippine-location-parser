# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Codebase Overview

Philippine Location Parser & Text Classifier — a multi-mode text processing tool supporting location extraction, sentiment classification, and category classification. Uses GPT-4.1-mini with batched parallel processing for high-throughput classification.

**Live at:** https://location-parser.aiailabs.net (behind Cloudflare Access)
**Hosted on:** Coolify (Hetzner CAX31) via Nixpacks build
**Coolify UUID:** `rcc44cw884owgk00ooo4k4c0`

## Essential Commands

### Development
```bash
cd app                  # All commands run from app/ directory
npm start               # Run v5 server (default, LLM-first, port 3002)
npm run start:v4        # Run v4 server (rule-based, offline)
npm run dev             # v5 with auto-reload
npm run dev:v4          # v4 with auto-reload
```

### Testing
```bash
npm test                # Run v4 core tests
npm run test:regression # Run edge case tests
npm run test:all        # Run all test suites
```

### Deployment
```bash
git push                # Coolify auto-deploys from GitHub (Nixpacks)
# Manual redeploy: Coolify dashboard → location-parser → Redeploy
# Build pack: Nixpacks (not Dockerfile)
# Install cmd: cd app && npm install
# Start cmd: cd app && npm start
```

## Architecture

### Project Structure
```
philippine-location-parser/
├── Dockerfile              # Available but Coolify uses Nixpacks
├── app/                    # Main application
│   ├── server-v5.js        # LLM-first server (default, port 3002)
│   ├── server-v4.js        # Rule-based server (legacy)
│   ├── index.html          # Web interface
│   ├── app-v4.js           # Frontend JavaScript (chunked requests)
│   ├── parsers/            # Location parsing modules
│   ├── utils/              # Classifiers & helpers
│   │   ├── llm-extractor.js        # GPT-4.1-mini location extraction
│   │   ├── llm-validator.js        # GPT-4.1-mini validation
│   │   ├── sentiment-classifier.js # Batched sentiment (5 workers × 30/call)
│   │   ├── category-classifier.js  # Batched category (5 workers × 30/call)
│   │   ├── batch-processor.js      # Sliding-window parallel processor
│   │   ├── cache-manager.js        # LRU cache
│   │   ├── sheet-parser.js         # CSV/Excel extraction
│   │   └── sheet-detector.js       # Multi-sheet detection
│   ├── data/               # Location databases
│   └── tests/              # Test suites
└── app/package.json        # Dependencies (openai, express, xlsx, etc.)
```

### Three Processing Modes

1. **Location** — Extracts Philippine location hierarchy (region/province/city/barangay) per item via GPT-4.1-mini. Per-item processing with concurrency 15.

2. **Sentiment** — Classifies text sentiment toward a specified entity. **Batched**: 30 texts per API call, 5 concurrent workers. 499 items ≈ 17 API calls instead of 499.

3. **Category** — Classifies text into user-defined categories with optional hints. **Batched**: same as sentiment (30/call, 5 workers).

### Input Methods (all modes)
- **Paste text** — textarea → frontend chunks (50/request) → `/api/batch-parse`
- **CSV upload** — parsed client-side → textarea → same flow
- **Excel upload** — server extracts → textarea → same flow  
- **Google Sheets** — server fetches CSV export → processes server-side via `classifyAll()`

### Key Design Decisions

**Batched Classification (Sentiment/Category):**
- Pattern borrowed from [chewy-byd](https://github.com/ericxyz86/chewy-byd) dashboard
- `classifyAll()` method splits texts into batches of 30, processes with 5 concurrent workers
- Each API call classifies 30 texts at once (returns JSON array of labels)
- ~15-30x faster than per-item classification

**Proxy Timeout Prevention:**
- Chunked Transfer-Encoding with keep-alive whitespace every 10s
- `X-Accel-Buffering: no` header to disable nginx/Caddy buffering
- Frontend uses `response.text()` + `JSON.parse(rawText.trim())` to handle whitespace padding

**429 Rate Limit Handling:**
- Exponential backoff: 5s × attempt for rate limits, 1s × attempt for other errors
- Max 2 retries per batch

## API Endpoints

- `POST /api/batch-parse` — Multi-mode batch processing (location/sentiment/category)
- `POST /api/parse-text` — Single text parsing
- `POST /api/process-google-sheet` — Google Sheets URL integration
- `POST /api/upload-excel` — Excel file upload + extraction
- `POST /api/detect-excel-sheets` — Excel multi-sheet detection
- `POST /api/classify-sentiment` — Single sentiment classification
- `POST /api/classify-category` — Single category classification
- `GET /api/progress-stream/:sessionId` — SSE progress updates
- `GET /api/status` — Server health check

## Environment Variables

```env
OPENAI_API_KEY=sk-...   # Optional server-side fallback (users provide their own)
PORT=3002               # Server port
NODE_ENV=production     # Production mode
```

Note: Users provide their own OpenAI API key in the browser UI. The server-side key is a fallback only.

## Performance Characteristics

| Mode | Method | 499 items | API calls |
|------|--------|-----------|-----------|
| Sentiment | Batched (30/call, 5 workers) | ~10-15s | ~17 |
| Category | Batched (30/call, 5 workers) | ~10-15s | ~17 |
| Location | Per-item (concurrency 15) | ~30-45s | ~499 |

## Common Issues

1. **Proxy timeout** — Fixed with chunked transfer encoding + keep-alive. If it recurs, reduce BATCH_SIZE or CONCURRENCY in classifier files.
2. **429 rate limits** — Users on OpenAI free tier may hit RPM limits. Backoff is automatic but processing slows. Upgrade API tier.
3. **Port conflicts** — `lsof -ti:3002 | xargs kill -9`
4. **Coolify not deploying** — Auto-deploy may not trigger. Manual redeploy via Coolify dashboard.
5. **Build pack** — Uses Nixpacks (not Dockerfile). Install/start commands configured in Coolify.

## Location Normalization Rules

- NCR districts → "Metro Manila"
- "CITY OF X" → "X City"  
- POBLACION variants → "Poblacion"
- ALL CAPS → Proper Case
- Empty fields → "None"

## V4 Parser (Legacy)

Rule-based offline parser in `parsers/hierarchical-parser-v2.js`:
- Filipino patterns: "taga", "dito sa", "nasa"
- Bisaya/Cebuano: "naa", "nia", "gikan sa"  
- Hashtag extraction: `#AlterBacolod` → Bacolod
- Abbreviations: QC, BGC, Gensan via LOCATION_ALIASES
- ~80.6% extraction rate, ~10-50ms per parse
