# Philippine Location Parser – User Manual

## 1. Overview
The Philippine Location Parser turns unstructured text into structured Philippine Standard Geographic Code (PSGC) data. It powers three concurrent analysis modes—location extraction, sentiment classification, and category classification—so you can understand where people are, how they feel, and what they are talking about in a single workflow. This manual explains how to install the application, configure it with your own OpenAI API key, operate every feature in the web interface, and optionally deploy the Google Sheets add-on.

## 2. System Requirements
- **Node.js 18+** and npm (for running the local web server)
- **Modern browser** (Chrome, Edge, Firefox, or Safari) with JavaScript enabled
- **OpenAI API key** with GPT-4o-mini access (bring-your-own-key model)
- Optional: **Google account** with permission to run Apps Script projects if you plan to use the spreadsheet add-on

## 3. Quick Start Checklist
1. Install dependencies  
   ```bash
   npm install
   npm install --prefix app
   ```
2. Launch the v5 (LLM-first) server  
   ```bash
   npm start --prefix app
   ```
3. Open `http://localhost:3002` in your browser.
4. Save your OpenAI API key in the interface.
5. Paste text, link a Google Sheet, or upload a CSV/Excel file, then start processing from the mode you need.

## 4. Application Architecture
- **Front end (`app/index.html`)** delivers the unified workspace for data inputs, processing controls, and results.
- **Backend (`app/server-v5.js`)** exposes REST endpoints for parsing text, processing spreadsheets, uploading Excel files, and streaming progress updates via Server-Sent Events (SSE).
- **Utilities (`app/utils/`)** provide caching, batching, context detection, OpenAI interaction, and PSGC lookup helpers.
- **Modes**  
  - *Location Extraction*: Pulls Region → Province → City/Municipality → Barangay.  
  - *Sentiment Classification*: Scores text against user-supplied sentiment labels.  
  - *Category Classification*: Assigns user-defined categories and optional reasons.  
- **Concurrent mode state** keeps each tab’s session, progress bar, statistics, and CSV export separate so you can run all three analyses simultaneously without overwriting results.

## 5. Running the Web Application
1. **Install dependencies** once per machine: `npm install` (root CLI helpers) and `npm install --prefix app` (server + UI bundle).  
2. **Start the server**: `npm start --prefix app`. The default port is `3002`; override by setting `PORT` in `.env`.  
3. **Visit the UI**: Open `http://localhost:3002`. The home screen contains the API key field, data input controls, and processing tabs.  
4. **Stop the server**: Press `Ctrl+C` in the terminal when finished.

### Hot Reload (Development)
Use `npm run dev --prefix app` to start the nodemon watcher while editing backend code. Restart happens automatically on file changes.

## 6. Configuring Your OpenAI API Key
1. Generate a key from [https://platform.openai.com](https://platform.openai.com).  
2. In the application header, enter the key into the **OpenAI API Key** input (format `sk-...`).  
3. Click **Save API Key**. The key is stored locally in your browser and must remain valid for all three modes.  
4. Update or remove the key anytime via the same control. Without a valid key, processing buttons are disabled.

## 7. Supplying Data
The input panel offers three paths; you can switch between them at any time.

### 7.1 Text Area
- Paste or type one entry per line.  
- Use **Extract from Text** in the desired mode tab to start processing immediately.  
- Ideal for quick checks or small datasets.

### 7.2 Google Sheets
1. Make the sheet viewable for anyone with the link.  
2. Paste the share URL into **Google Sheets URL**.  
3. (Optional) Enter a column range such as `B2:B500`.  
4. Click **Process Google Sheet** from any mode tab.  
5. Progress indicators stream in real time; results automatically include row numbers so you can map findings back to the sheet.

### 7.3 File Uploads (CSV/Excel)
1. Click **Upload CSV/Excel** and choose a `.csv`, `.xlsx`, or `.xls` file (≤10 MB).  
2. Select the worksheet if prompted and specify the column range.  
3. On confirmation, launch processing from the appropriate tab.

## 8. Understanding the Interface
- **Mode Tabs**: Location, Sentiment, and Category tabs operate independently. Starting a run in one tab does not block the others.  
- **Status Badges**: Show `Inactive`, `Active`, `Processing`, or `Completed` per mode.  
- **Progress Bar & Timer**: Update live using SSE progress events.  
- **Statistics Grid**: Displays totals, success rates, average confidence (location), label distributions (sentiment/category), and error counts.  
- **Results Section**: Lists processed rows with structured outputs. Each row includes the original text, extracted data, confidence, and flags (e.g., cached result).  
- **Download Panel**: Choose between single-column or multi-column CSV before exporting.

## 9. Running Concurrent Analyses
1. Start with any mode, e.g., **Location Extraction** → **Extract from Text**.  
2. While the first run is active, switch tabs; configure Sentiment or Category parameters and click **Extract from Text**.  
3. Repeat for the third mode if needed. Each mode receives its own session ID (`mode-timestamp`) and maintains separate progress and outputs.  
4. Use the status badges to monitor completion. A failed mode does not cancel others—review the error banner within the affected tab and retry once resolved.

### Managing Mode-Specific Settings
- **Sentiment Classification**  
  - Provide the entity name (who/what you are evaluating).  
  - List comma-separated labels (e.g., `Positive, Neutral, Negative`).  
  - Optional description adds context for the LLM prompt.  
- **Category Classification**  
  - Enter categories (comma-separated).  
  - Add context or definitions to guide the classifier.  
- Settings persist per mode until cleared.

## 10. Interpreting Results
- **Location Mode**  
  - Columns: Region, Province, City/Municipality, Barangay, Confidence (0–100), Other Mentions, Matched Name.  
  - Confidence derives from pattern strength and LLM certainty; anything below ~60 suggests manual review.  
- **Sentiment Mode**  
  - Output includes predicted label, score/confidence, and optional justification.  
  - Use the stats distribution to gauge overall sentiment balance.  
- **Category Mode**  
  - Each row lists the assigned category (or multiple, if configured), rationale, and confidence.  
  - Exported CSVs include per-category counts for downstream analytics.

## 11. Exporting Data
1. When processing finishes, the **Download Results** button becomes active in that mode.  
2. Choose **Single Column** (concise summary) or **Multiple Columns** (one column per data field).  
3. Exports follow the pattern `location-extraction-results-YYYYMMDD-HHMMSS.csv`, `sentiment-classification-results-...`, or `category-classification-results-...`.  
4. Stored files contain UTF-8 text compatible with spreadsheet tools and BI systems.

## 12. Google Sheets Add-on (Apps Script) Workflow
The repository still ships the legacy Google Apps Script version for spreadsheet-only setups.

1. Follow `SETUP_INSTRUCTIONS.md` to copy `LocationParser.gs` and `TestDialog.html` into an Apps Script project.  
2. Authorize the script when prompted (`spreadsheets` + `external_request`).  
3. Use in-sheet formulas:  
   - `=PARSE_LOCATION(A2)` (Region → Barangay)  
   - `=PARSE_LOCATION_DETAILED(A2)` (adds confidence, other mentions, matched name)  
   - `=GET_REGION(A2)`, `=GET_PROVINCE(A2)`, `=GET_CITY(A2)`, `=GET_BARANGAY(A2)` for individual components.  
4. Access the custom menu (**Location Parser**) to parse selected comments, configure headers, or open the interactive test dialog.  
5. If OAuth authorization is blocked, switch to the simplified offline script (`LocationParser-Simplified.gs`) bundled in the repository.

## 13. Command Reference
- `npm install --prefix app` – Install web app dependencies.  
- `npm run dev --prefix app` – Start nodemon for local development.  
- `npm run test:all --prefix app` – Execute regression, smoke, and MCP checks.  
- `node test-llm-first.js` – Spot-check GPT-powered parsing using sample data.  
- `node test-full-dataset.js` – Run the full dataset validation harness.

## 14. Troubleshooting
| Symptom | Resolution |
|---------|------------|
| **“API key required” banner** | Save a valid key (format `sk-...`). Ensure the key has active billing/quota. |
| **Processing stuck at 0%** | Check network connectivity and verify the server log for rate-limit warnings. Restart the session if the SSE connection dropped. |
| **Large files fail to upload** | Keep uploads ≤10 MB. Split huge CSVs or use Google Sheets processing instead. |
| **Incorrect or missing locations** | Provide more context (city + province) or rerun via the Google Sheets mode for batch verification. Review the `Other Mentions` column for conflicting place names. |
| **Sentiment/category outputs feel off** | Refine labels or add a richer description. Ambiguous or overlapping labels reduce accuracy. |
| **Server crash on start** | Ensure Node.js 18+ is installed and ports 3002/`$PORT` are free. Delete stale `.cache` entries if noted in logs. |
| **OAuth warning in Google Sheets** | Use the advanced authorization flow (`Go to PSGC Location Parser (unsafe)`) or deploy the simplified offline script. |

## 15. Best Practices
- Batch related datasets to maximize caching and reduce token usage.  
- Monitor OpenAI usage in your account dashboard when running large concurrent jobs.  
- Export after each successful run to preserve results before starting a new session.  
- Keep `.env` updated with `OPENAI_API_KEY` and `PORT` if you prefer server-side configuration; never commit secrets.  
- Run `npm run test:all --prefix app` before publishing changes or redeploying the server.

## 16. Getting Help
- Review `TESTING_STRATEGY.md`, `IMPLEMENTATION_GUIDE.md`, and `CONCURRENT_PROCESSING_SUMMARY.md` for deeper technical insight.  
- Check browser dev tools (Console tab) for client-side errors; server logs surface in the terminal running `npm start`.  
- If issues persist, capture the error message, request payload (if applicable), and recent actions before escalating to the engineering team.
