# Philippine Location Parser & Text Classifier

A multi-mode text processing tool for Philippine locations, sentiment analysis, and category classification. Uses GPT-4.1-mini with batched parallel processing for high-throughput classification.

**Live:** [location-parser.aiailabs.net](https://location-parser.aiailabs.net)

## Features

### Three Processing Modes

- **Location Extraction** — Extracts Philippine location hierarchy (Region → Province → City → Barangay) from unstructured text using AI-powered extraction with GPT-4.1-mini
- **Sentiment Classification** — Classifies text sentiment toward a specified entity with custom labels (e.g., Positive/Neutral/Negative)
- **Category Classification** — Classifies text into user-defined categories with optional descriptive hints

### Multiple Input Methods

- **Paste text** — Directly paste rows of text
- **CSV upload** — Upload CSV files with column selection
- **Excel upload** — Upload .xlsx/.xls with multi-sheet support
- **Google Sheets** — Paste a public Google Sheets URL with column/sheet selection

### Performance

Batched parallel classification (inspired by [chewy-byd](https://github.com/ericxyz86/chewy-byd)):

| Mode | 500 items | Approach |
|------|-----------|----------|
| Sentiment | ~10-15s | 30 texts/API call, 5 concurrent workers |
| Category | ~10-15s | 30 texts/API call, 5 concurrent workers |
| Location | ~30-45s | Per-item extraction, 15 concurrent |

### Other Features

- Real-time progress tracking via Server-Sent Events (SSE)
- CSV download of results
- In-browser API key storage (bring your own OpenAI key)
- Result caching to reduce duplicate API calls
- Filipino/Tagalog/Bisaya language support for location extraction
- Context-aware NLP ("taga-Makati" vs "visited Makati")

## Quick Start

### Local Development

```bash
cd app
npm install
cp .env.example .env    # Add your OPENAI_API_KEY
npm start               # Runs on http://localhost:3002
```

### Using the App

1. Open the app in your browser
2. Enter your OpenAI API key (stored in browser localStorage)
3. Select a mode (Location / Sentiment / Category)
4. Configure mode settings (entity, labels, categories)
5. Input data via text paste, file upload, or Google Sheets URL
6. Click Process — results appear in real-time
7. Download results as CSV

## Deployment

Deployed on **Coolify** (Hetzner) with Nixpacks build:

```bash
git push origin main    # Auto-deploys to Coolify
```

- **URL:** https://location-parser.aiailabs.net
- **Build:** Nixpacks (Node.js detection)
- **Port:** 3002
- **Auth:** Cloudflare Access (email-based login)

## API

### Batch Processing
```
POST /api/batch-parse
{
  "texts": ["text1", "text2", ...],
  "mode": "sentiment",           // location | sentiment | category
  "apiKey": "sk-...",
  "entity": "PLDT Home",         // sentiment mode
  "sentimentLabels": ["Positive", "Neutral", "Negative"],
  "categories": ["Billing", "Network"],  // category mode
  "categoryHints": { "Billing": "payment and invoice issues" }
}
```

### Google Sheets
```
POST /api/process-google-sheet
{
  "sheetUrl": "https://docs.google.com/spreadsheets/d/...",
  "columnRange": "B:B",
  "mode": "sentiment",
  "apiKey": "sk-...",
  ...mode-specific params
}
```

### Progress Stream
```
GET /api/progress-stream/:sessionId
```

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** Vanilla HTML/JS (single-page)
- **AI:** OpenAI GPT-4.1-mini
- **Hosting:** Coolify on Hetzner (Nixpacks)
- **Auth:** Cloudflare Access
- **Data:** Philippine Standard Geographic Code (PSGC) for location validation

## Cost

Users provide their own OpenAI API key. GPT-4.1-mini is very affordable:
- ~$0.30-0.50 per 1,000 texts (sentiment/category)
- ~$0.50-1.00 per 1,000 texts (location extraction)

## License

MIT
