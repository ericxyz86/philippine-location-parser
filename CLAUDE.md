# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Codebase Overview

Philippine Location Parser - A dual-mode location extraction system for Philippine addresses. The system has two operational modes: v4 (rule-based, offline) and v5 (LLM-first, requires OpenAI API).

## Essential Commands

### Development
```bash
cd app                  # All commands run from app/ directory
npm start               # Run v5 server (default, LLM-first, port 3002)
npm run start:v4        # Run v4 server (rule-based, offline)
npm run dev             # v5 with auto-reload
npm run dev:v4          # v4 with auto-reload
npm run start:llm       # Alias for npm start
```

### Testing
```bash
npm test                # Run v4 core tests
npm run test:regression # Run edge case tests
npm run test:all        # Run all test suites
node tests/test-regression.js  # Run specific regression test
```

### Server Management
```bash
lsof -ti:3002 | xargs kill -9  # Kill existing server on port 3002
curl http://localhost:3002/api/health  # Check server status (if endpoint exists)
```

## Architecture

### Project Structure
```
location-parser/
├── app/                    # Main application (all work happens here)
│   ├── server-v4.js       # Rule-based server
│   ├── server-v5.js       # LLM-first server (default)
│   ├── index.html         # Web interface
│   ├── app-v4.js          # Frontend JavaScript
│   ├── parsers/           # Location parsing modules
│   ├── utils/             # Helper utilities
│   ├── data/              # Location databases
│   └── tests/             # Test suites
├── package.json           # Root package (minimal)
└── app/package.json       # App dependencies
```

### Dual-Mode System
- **V4**: Rule-based parser using `hierarchical-parser-v2.js` with offline database lookup
- **V5** (Default): LLM-first extraction using `utils/llm-extractor.js` with GPT-4o-mini

### Key Components

**Frontend Flow**: `index.html` → `app-v4.js` → API calls to server (port 3002)

**V4 Processing Pipeline**:
1. `server-v4.js` receives request
2. `parsers/hierarchical-parser-v2.js` extracts locations via rule-based patterns
3. `parsers/location-normalizer.js` formats output (Metro Manila conversion, proper case)
4. Returns normalized location hierarchy

**V5 Processing Pipeline** (default):
1. `server-v5.js` receives request
2. `utils/llm-extractor.js` sends text directly to GPT-4o-mini for location extraction
3. LLM returns structured location data (region, province, city, barangay)
4. `parsers/location-normalizer.js` formats output
5. Returns location with confidence scores and caching

**Multi-Sheet Support**:
- `utils/sheet-detector.js` detects sheets in Excel/Google Sheets
- `utils/sheet-parser.js` extracts data from CSV/Excel files
- Dynamic sheet selection UI in frontend
- Excel files: Full sheet name detection via XLSX library
- Google Sheets: URL-based sheet detection

### Utility Modules
- `utils/llm-extractor.js` - OpenAI GPT-4o-mini integration for v5
- `utils/cache-manager.js` - LRU cache for parsed results
- `utils/batch-processor.js` - Handles large-scale batch processing
- `utils/context-detector.js` - Pre-processing and context analysis
- `utils/false-positive-filter.js` - Filters out non-location matches
- `utils/psgc-api.js` - Philippine Standard Geographic Code API integration

### Location Normalization Rules (location-normalizer.js)
- NCR districts → "Metro Manila"
- "CITY OF X" → "X City"
- POBLACION variants → "Poblacion"
- ALL CAPS → Proper Case
- Empty fields → "None"

## API Endpoints

Both v4 and v5 servers expose:
- `POST /api/parse-text` - Single text parsing
- `POST /api/batch-parse` - Multiple texts with batch processing
- `POST /api/process-sheet` - CSV/Excel file processing
- `POST /api/process-google-sheet` - Google Sheets URL integration
- File upload endpoints for Excel/CSV files

## Important Context

- **Working Directory**: All development work happens in `app/` directory - always `cd app` first
- **Default Mode**: System defaults to v5 (LLM-first) as of current version
- **V5 requires** `.env` file with `OPENAI_API_KEY` in app/ directory
- **V4 advantages**: Offline operation, no API costs, consistent performance
- **V5 advantages**: Better accuracy on ambiguous text, handles Filipino/English mixed patterns
- The normalizer (`location-normalizer.js`) ensures consistent output format
- **September 2024 Refactoring**: Codebase reorganized into app/ folder structure
- **Multi-Sheet Support**: Full support for Excel/CSV/Google Sheets with multiple tabs
- **Caching**: V5 includes result caching to reduce API calls and improve performance

## V4 Parser Patterns (location-parser-v4.js)

**Pattern Recognition**:
- Filipino patterns: "taga", "dito sa", "nasa", "wala sa", "galing sa"
- Bisaya/Cebuano: "naa", "nia", "gikan sa"
- Hashtag extraction: `#AlterBacolod` → Bacolod
- AF slang: "sarado AF malolos" → Malolos
- Abbreviations: QC, BGC, Gensan via LOCATION_ALIASES map

**Parser Configuration**:
- `minMatchScore: 30` - Minimum fuzzy match threshold
- `minStringLength: 4` - Minimum location string length
- Hierarchical fallback: Returns most specific level available

## Testing

**Test Suites** (in `app/tests/`):
- `test-v4.js` - V4 parser unit tests
- `test-regression.js` - Edge case regression tests
- `test-real-dataset.js` - Real social media data validation
- `test-performance.js` - Performance benchmarks
- `test-false-positives.js` - False positive detection

**Critical Edge Cases**:
- Bacolod hashtag detection (#AlterBacolod)
- Caraga region mapping
- NCR district normalization (districts → Metro Manila)
- City prefix handling ("CITY OF" → "X City")
- Abbreviation resolution (QC→Quezon City, BGC→Taguig)

## Common Issues

1. **Port conflicts**: Kill process on 3002 before starting: `lsof -ti:3002 | xargs kill -9`
2. **Working directory**: Must run commands from `app/` directory, not root
3. **Missing .env**: V5 requires OPENAI_API_KEY in `app/.env`
4. **Import path errors**: All parsers use relative paths (./data/, ./utils/, ./parsers/)
5. **Database not found**: Ensure `app/data/` folder exists with location databases

## Quick Task Reference

### Add New Location Alias
Edit `LOCATION_ALIASES` map in `app/parsers/location-parser-v4.js`

### Adjust V4 Match Sensitivity
Modify `config.minMatchScore` in `app/parsers/location-parser-v4.js` (current: 30)

### Change Normalization Rules
Edit functions in `app/parsers/location-normalizer.js` (toProperCase, normalizeProvince, etc.)

### Add Test Case
Add to test arrays in `app/tests/test-regression.js` or create new test file

### Switch Between V4/V5
```bash
cd app
npm run start:v4    # Rule-based, offline, no API needed
npm start           # LLM-first (requires OPENAI_API_KEY in .env)
```

### Configure OpenAI API
Create `app/.env` file:
```
OPENAI_API_KEY=sk-...
PORT=3002
```

## Performance Notes

- **V4**: ~10-50ms per parse, offline operation
- **V5**: ~500-2000ms per parse (LLM latency), with caching for repeated queries
- **V5 accuracy**: Higher on ambiguous/mixed-language text
- **V4 accuracy**: 80.6% extraction rate on social media posts (see IMPROVEMENTS.md)