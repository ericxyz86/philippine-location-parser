# Philippine Location Parser

A sophisticated location extraction system for Philippine addresses with both standard and LLM-enhanced modes.

## Features

- **Filipino/English Support**: Handles both Filipino (Tagalog/Bisaya) and English text
- **Smart Detection**: Hashtag detection, nickname resolution, abbreviation support (QC, BGC, Gensan)
- **Two Modes**: Standard (offline) and LLM-enhanced (requires API key)
- **Google Sheets Integration**: Process location data directly from Google Sheets
- **Multi-Sheet Support**: Full support for Google Sheets and Excel files with multiple tabs/sheets
- **High Accuracy**: 80%+ accuracy on standard mode, higher with LLM validation
- **Proper Formatting**: Automatic normalization to proper case and standardized names

## Quick Start

### Standard Mode (No API Required)

```bash
npm install
npm start
# Visit http://localhost:3002
```

### Advanced LLM Mode (Requires OpenAI API)

```bash
# Create .env file
echo "OPENAI_API_KEY=your_api_key_here" > .env

# Start LLM-enhanced server
npm run start:v5
# Visit http://localhost:3002
```

## Available Scripts

```bash
npm start           # Start standard v4 server (default)
npm run start:v5    # Start LLM-enhanced v5 server
npm run start:llm   # Alias for start:v5
npm run dev         # Development mode with auto-reload
npm run dev:v5      # Development mode for v5
npm test            # Run v4 tests
npm run test:all    # Run all tests including regression
```

## Project Structure

```
app/
├── index.html              # Web interface
├── app-v4.js              # Frontend JavaScript
├── server-v4.js           # Standard server (default)
├── server-v5.js           # LLM-enhanced server
├── parsers/               # Location parsing logic
│   ├── location-parser-v4.js    # Rule-based parser
│   ├── location-parser-v5.js    # Conservative parser for LLM mode
│   └── location-normalizer.js   # Output formatting (proper case, Metro Manila)
├── data/                  # Location databases
│   ├── location-db-server.json  # V4 database (5.5MB)
│   ├── location-database.json   # V5 database (6.9MB)
│   └── sample-data.csv          # Sample test data
├── utils/                 # Utility modules
│   ├── llm-validator.js         # OpenAI integration for V5
│   ├── psgc-api.js              # PSGC hierarchy completion
│   └── sheet-detector.js        # Multi-sheet detection for Excel/Google Sheets
├── tests/                 # Test suites
│   ├── test-v4.js               # Core V4 tests
│   ├── test-regression.js       # Critical edge cases
│   ├── test-normalization.js    # Formatting tests
│   └── [other test files]       # Various validation tests
└── docs/                  # Documentation
    └── API_KEY_SETUP.md         # OpenAI API setup guide
```

## API Endpoints

All servers provide these endpoints:

- `POST /api/parse-text` - Parse text for locations
- `POST /api/batch-parse` - Batch process multiple texts
- `POST /api/process-google-sheet` - Process Google Sheets data
- `GET /api/health` - Health check

### Request Format

```json
{
  "text": "Taga Quezon City ako"
}
```

### Response Format

```json
{
  "text": "Taga Quezon City ako",
  "location": {
    "region": "National Capital Region (NCR)",
    "province": "Metro Manila",
    "city": "Quezon City",
    "barangay": ""
  },
  "formatted": "Region: National Capital Region (NCR), Province: Metro Manila, City: Quezon City"
}
```

## Google Sheets Integration

1. Make your Google Sheet publicly viewable
2. Copy the sheet URL
3. Paste in the web interface
4. Select the sheet/tab if your document has multiple sheets
5. Optionally specify column range (e.g., B2:B100)
6. Click "Process Google Sheet"

The system will:
- Detect all available sheets/tabs in your document
- Allow selection of specific sheet to process
- Extract text from specified columns
- Parse locations with full hierarchy
- Return results as downloadable CSV

### Multi-Sheet Support

The system fully supports:
- **Google Sheets**: Automatically detects all tabs with proper names
- **Excel Files (.xlsx)**: Upload and select from available sheets
- **CSV Files**: Single sheet support (CSV format limitation)

For documents with multiple sheets, a dropdown selector will appear allowing you to choose which sheet to process.

## Configuration

### Environment Variables

Create a `.env` file for v5 mode:

```
OPENAI_API_KEY=your_openai_api_key_here
PORT=3002
```

### Database Selection

- **v4 (Standard)**: Uses `location-db-server.json` (5.5MB)
- **v5 (LLM)**: Uses `location-database.json` (6.9MB) + PSGC API

## Testing

```bash
# Run core tests
npm test

# Run regression tests (edge cases)
npm run test:regression

# Run all tests
npm run test:all
```

## Recent Updates (September 2024)

### Codebase Refactoring
- **Organized Structure**: Files now organized into `parsers/`, `data/`, `utils/`, `tests/`, and `docs/` directories
- **Cleaner Codebase**: Removed 40+ obsolete files including old parser versions (v2, v3), legacy servers, and redundant tests
- **Dual-Mode System**: V4 (default, offline) and V5 (optional, LLM-enhanced) clearly separated
- **Improved Imports**: All modules use proper relative paths
- **Unified Documentation**: Single README with clear instructions for both modes

### Key Improvements in V4

- **Normalized Output**: Proper case, standardized names
- **NCR Districts**: Automatically converted to "Metro Manila"
- **City Names**: Standardized (removes "CITY OF", adds "City" suffix)
- **Barangay Variants**: Unified (POB., POBLACION → Poblacion)
- **Hashtag Detection**: Better support for #AlterBacolod, #MakatiAlter
- **Abbreviation Support**: QC → Quezon City, BGC → Bonifacio Global City

## LLM Mode (v5) Features

- Two-pass validation system
- Conservative extraction + LLM validation
- Confidence scoring
- Reduces false positives
- Better handling of ambiguous cases

## Troubleshooting

### Port Already in Use

```bash
lsof -ti:3002 | xargs kill -9
npm start
```

### Missing Dependencies

```bash
npm install
```

### LLM Mode Not Working

1. Check `.env` file exists with valid OpenAI API key
2. Verify API key has sufficient credits
3. Check console for specific error messages

## Performance

- **Standard Mode**: ~100ms per text
- **LLM Mode**: ~500-1000ms per text (API dependent)
- **Batch Processing**: Optimized for Google Sheets with 100+ rows

## License

ISC

## Migration from Old Structure

If you have an existing installation from before September 2024:

1. **Backup your data**: `cp -r app app-backup`
2. **Pull latest changes**: Files are now organized in folders
3. **Update imports**: All parsers now use relative paths (`../data/`, `../utils/`)
4. **Update scripts**: Use `npm start` for V4 (default) or `npm run start:v5` for LLM mode
5. **Old files removed**: V2, V3 parsers and legacy servers have been deleted

### Files That Moved:
- Parsers → `parsers/` directory
- Databases → `data/` directory
- Utilities → `utils/` directory
- Tests → `tests/` directory
- Documentation → `docs/` directory

## Support

For issues or questions, please check the docs/ folder or create an issue in the repository.