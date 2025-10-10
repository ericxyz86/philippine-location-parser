# Task List: Multi-Mode Classification System

**PRD Reference:** `0001-prd-multi-mode-classification.md`
**Feature:** Add Sentiment and Category classification modes to Location Parser
**Branch:** `feature/multi-mode-classification`

---

## Relevant Files

### New Files to Create
- `app/utils/sentiment-classifier.js` - Sentiment classification module with LLM prompt building and strict validation
- `app/utils/category-classifier.js` - Category classification module with LLM prompt building and strict validation
- `app/tests/test-sentiment-classifier.js` - Unit tests for sentiment classification
- `app/tests/test-category-classifier.js` - Unit tests for category classification

### Files to Modify
- `app/index.html` - Add tab-based UI navigation and conditional classification input fields
- `app/app-v4.js` - Add mode state management, conditional field visibility, and classification API integration
- `app/server-v5.js` - Add new classification endpoints and mode routing logic
- `app/utils/llm-extractor.js` - Reference for understanding existing LLM integration pattern
- `app/utils/cache-manager.js` - May need to extend cache key generation for classification modes
- `CLAUDE.md` - Update documentation with new classification features and API endpoints

### Reference Files (Read-Only)
- `app/parsers/location-parser-v5.js` - Understand existing location extraction structure
- `app/utils/batch-processor.js` - Reuse for classification batch processing
- `app/parsers/location-normalizer.js` - Reference for result formatting patterns

### Notes
- Tests should be placed in `app/tests/` directory following existing pattern
- Use `node app/tests/test-sentiment-classifier.js` to run specific tests
- Follow existing code patterns from `llm-extractor.js` for consistency
- Reuse existing batch processing, caching, and SSE infrastructure

---

## Tasks

- [ ] 1.0 Create Feature Branch and Project Setup
  - [ ] 1.1 Create new git branch `feature/multi-mode-classification` from main
  - [ ] 1.2 Verify current working directory is clean (commit or stash any uncommitted changes)
  - [ ] 1.3 Add untracked files to git: `git add tasks/ AGENTS.md ai-dev-tasks/`
  - [ ] 1.4 Create initial commit with PRD and task list: "feat: add PRD and task list for multi-mode classification"
  - [ ] 1.5 Push feature branch to remote: `git push -u origin feature/multi-mode-classification`

- [x] 2.0 Implement Backend Classification Modules
  - [x] 2.1 Create `app/utils/sentiment-classifier.js` with class structure following `llm-extractor.js` pattern
  - [x] 2.2 Implement `buildSentimentPrompt(text, entity, sentimentLabels, description)` method with strict JSON response format
  - [x] 2.3 Implement `classifySentiment(text, entity, sentimentLabels, description)` method with OpenAI API integration
  - [x] 2.4 Implement `validateSentimentClassification(llmResponse, allowedLabels)` with case-insensitive exact matching
  - [x] 2.5 Add retry logic (max 2 retries) for invalid LLM responses in sentiment classifier
  - [x] 2.6 Add caching support using text + entity + labels as cache key
  - [x] 2.7 Create `app/utils/category-classifier.js` with class structure following sentiment classifier pattern
  - [x] 2.8 Implement `buildCategoryPrompt(text, categories, description)` method with strict JSON response format
  - [x] 2.9 Implement `classifyCategory(text, categories, description)` method with OpenAI API integration
  - [x] 2.10 Implement `validateCategoryClassification(llmResponse, allowedCategories)` with case-insensitive exact matching
  - [x] 2.11 Add retry logic (max 2 retries) for invalid LLM responses in category classifier
  - [x] 2.12 Add caching support using text + categories as cache key
  - [x] 2.13 Export both classifiers as module.exports for server integration

- [x] 3.0 Add Backend API Endpoints and Routing
  - [x] 3.1 In `app/server-v5.js`, import SentimentClassifier and CategoryClassifier modules
  - [x] 3.2 Create `POST /api/classify-sentiment` endpoint accepting `{ text, entity, sentimentLabels[], description, apiKey }`
  - [x] 3.3 Add API key validation for sentiment endpoint (check format and presence)
  - [x] 3.4 Add input validation for sentiment endpoint (check required fields: entity, sentimentLabels)
  - [x] 3.5 Implement sentiment classification logic with user-provided API key
  - [x] 3.6 Return sentiment response: `{ success: true, text, classification, confidence, method }`
  - [x] 3.7 Add error handling for sentiment endpoint with user-friendly error messages
  - [x] 3.8 Create `POST /api/classify-category` endpoint accepting `{ text, categories[], description, apiKey }`
  - [x] 3.9 Add API key validation for category endpoint
  - [x] 3.10 Add input validation for category endpoint (check required field: categories)
  - [x] 3.11 Implement category classification logic with user-provided API key
  - [x] 3.12 Return category response: `{ success: true, text, classification, confidence, method }`
  - [x] 3.13 Add error handling for category endpoint with user-friendly error messages
  - [x] 3.14 Modify `POST /api/batch-parse` to accept `mode` parameter ("location" | "sentiment" | "category")
  - [x] 3.15 Add mode-specific routing logic in batch-parse endpoint (if sentiment: use SentimentClassifier, if category: use CategoryClassifier)
  - [x] 3.16 Pass mode-specific parameters (entity, sentimentLabels, categories, description) to classifiers
  - [x] 3.17 Modify `POST /api/process-google-sheet` to accept mode parameter and mode-specific fields
  - [x] 3.18 Update `/api/status` endpoint to include classification features in response

- [ ] 4.0 Build Frontend Tab Navigation and UI Components
  - [ ] 4.1 In `app/index.html`, update page title to "Philippine Location Parser & Text Classifier"
  - [ ] 4.2 Update header subtitle to "Extract locations & classify text with AI"
  - [ ] 4.3 Add tab navigation HTML structure with three tabs: Location, Sentiment, Category
  - [ ] 4.4 Style tabs using existing gradient styles (active tab highlighted with underline/color change)
  - [ ] 4.5 Create conditional fields section for Sentiment mode with:
      - Description input field (label: "Classification Description")
      - Entity input field (label: "Entity to Evaluate")
      - Sentiment Labels textarea (label: "Sentiment Labels (comma-separated)")
  - [ ] 4.6 Create conditional fields section for Category mode with:
      - Description input field (label: "Classification Description")
      - Categories textarea (label: "Categories (comma-separated)")
  - [ ] 4.7 Add CSS styles for conditional fields (hidden by default with `display: none`)
  - [ ] 4.8 Add CSS classes for tab states (.tab-active, .tab-inactive)
  - [ ] 4.9 Add help text for sentiment/category fields explaining comma-separated format
  - [ ] 4.10 Ensure responsive design for tabs (collapse to dropdown on mobile if needed)

- [ ] 5.0 Integrate Frontend with Classification APIs
  - [ ] 5.1 In `app/app-v4.js`, add global state variable: `let currentMode = 'location'`
  - [ ] 5.2 Create `setMode(mode)` function to handle tab switching and update currentMode
  - [ ] 5.3 Create `showConditionalFields(mode)` function to show/hide sentiment/category fields based on mode
  - [ ] 5.4 Add event listeners to tab elements calling `setMode()` on click
  - [ ] 5.5 Create `getClassificationConfig()` function to extract mode-specific fields (entity, labels, categories, description)
  - [ ] 5.6 Create `validateClassificationInputs(mode)` function to check required fields per mode
  - [ ] 5.7 Modify `processText()` function to check currentMode and call appropriate API endpoint
  - [ ] 5.8 Create `callSentimentAPI(text, config)` function to call `/api/classify-sentiment`
  - [ ] 5.9 Create `callCategoryAPI(text, config)` function to call `/api/classify-category`
  - [ ] 5.10 Update `displayResults()` function to handle classification results format (show "Classification: X")
  - [ ] 5.11 Modify `processSheet()` to include mode parameter and classification config in request
  - [ ] 5.12 Modify `handleFileUpload()` to include mode parameter in batch processing
  - [ ] 5.13 Update statistics panel to show classification-specific metrics
  - [ ] 5.14 Add validation error messages for missing sentiment/category fields

- [ ] 6.0 Implement Batch Processing for All Modes
  - [ ] 6.1 In `app/server-v5.js`, update batch-parse endpoint to handle mode parameter
  - [ ] 6.2 Create `processSentimentBatch(texts, config, llmExtractor)` helper function
  - [ ] 6.3 Create `processCategoryBatch(texts, config, llmExtractor)` helper function
  - [ ] 6.4 Modify batch processing loop to call appropriate classifier based on mode
  - [ ] 6.5 Ensure same entity/sentimentLabels applied to entire batch for sentiment mode
  - [ ] 6.6 Ensure same categories applied to entire batch for category mode
  - [ ] 6.7 Update progress messages to include mode-specific text ("Classifying sentiment...", "Categorizing...")
  - [ ] 6.8 Update SSE progress updates to include classification results
  - [ ] 6.9 Test Google Sheets processing with sentiment mode (200+ rows)
  - [ ] 6.10 Test CSV upload with category mode
  - [ ] 6.11 Test Excel upload with sentiment mode and sheet selection

- [ ] 7.0 Add CSV Export for Classification Results
  - [ ] 7.1 In `app/app-v4.js`, modify `downloadCSV()` function to check currentMode
  - [ ] 7.2 Create `generateLocationCSV(results)` function for existing format: "Text | Region | Province | City | Barangay"
  - [ ] 7.3 Create `generateSentimentCSV(results, config)` function for format: "Text | Classification Result"
  - [ ] 7.4 Create `generateCategoryCSV(results, config)` function for format: "Text | Classification Result"
  - [ ] 7.5 Add description field as first row comment (optional) in classification CSV exports
  - [ ] 7.6 Update CSV filename logic to include mode: `sentiment-classification-results-{timestamp}.csv`
  - [ ] 7.7 Update CSV filename logic for category: `category-classification-results-{timestamp}.csv`
  - [ ] 7.8 Keep existing location filename: `location-extraction-results-{timestamp}.csv`
  - [ ] 7.9 Test CSV download for all three modes with sample data
  - [ ] 7.10 Verify CSV format compatibility with Excel and Google Sheets

- [ ] 8.0 Testing and Validation
  - [ ] 8.1 Create `app/tests/test-sentiment-classifier.js` with test cases for prompt building
  - [ ] 8.2 Add test case: valid sentiment classification with "Positive, Neutral, Negative"
  - [ ] 8.3 Add test case: invalid LLM response triggers retry (mock LLM returning "Very Positive")
  - [ ] 8.4 Add test case: case-insensitive validation ("positive" matches "Positive")
  - [ ] 8.5 Add test case: multi-entity sentiment classification
  - [ ] 8.6 Create `app/tests/test-category-classifier.js` with test cases for category classification
  - [ ] 8.7 Add test case: valid category classification with 5+ categories
  - [ ] 8.8 Add test case: invalid LLM response triggers retry
  - [ ] 8.9 Add test case: case-insensitive validation for categories
  - [ ] 8.10 Run manual integration test: Sentiment mode with Google Sheets (100 rows)
  - [ ] 8.11 Run manual integration test: Category mode with CSV upload (50 rows)
  - [ ] 8.12 Run manual integration test: Location mode still works (regression test)
  - [ ] 8.13 Test tab switching without losing API key or other shared field values
  - [ ] 8.14 Test validation: missing entity shows error in Sentiment mode
  - [ ] 8.15 Test validation: missing categories shows error in Category mode
  - [ ] 8.16 Test CSV export for all three modes and verify format
  - [ ] 8.17 Test with invalid API key to ensure proper error handling
  - [ ] 8.18 Test batch processing with 500+ rows to verify performance (should complete in <15 minutes)

- [ ] 9.0 Documentation and Deployment
  - [ ] 9.1 Update `CLAUDE.md` - Add section on Multi-Mode Classification System
  - [ ] 9.2 Document new API endpoints in CLAUDE.md: `/api/classify-sentiment`, `/api/classify-category`
  - [ ] 9.3 Document mode parameter for batch-parse and process-google-sheet endpoints
  - [ ] 9.4 Add usage examples for sentiment classification in CLAUDE.md
  - [ ] 9.5 Add usage examples for category classification in CLAUDE.md
  - [ ] 9.6 Update "Quick Task Reference" section with classification commands
  - [ ] 9.7 Add troubleshooting section for common classification errors
  - [ ] 9.8 Create user-facing README update explaining new modes (optional)
  - [ ] 9.9 Run final smoke test on all three modes with different data sources
  - [ ] 9.10 Commit all changes with descriptive commit message: "feat: implement multi-mode classification (sentiment & category)"
  - [ ] 9.11 Push feature branch to remote
  - [ ] 9.12 Create pull request with PRD link and testing notes
  - [ ] 9.13 Merge feature branch to main after review and approval

---

## Implementation Notes

### Key Patterns to Follow
- **LLM Integration**: Follow `app/utils/llm-extractor.js` pattern for OpenAI API calls
- **Validation**: Use case-insensitive exact matching with retry logic (max 2 retries)
- **Caching**: Extend existing cache-manager.js with classification-specific cache keys
- **Batch Processing**: Reuse existing `processBatch()` from batch-processor.js
- **SSE Updates**: Follow existing progress tracking pattern in server-v5.js

### Testing Strategy
1. **Unit Tests**: Test prompt building and validation logic in isolation
2. **Integration Tests**: Test API endpoints with real OpenAI calls (use small datasets)
3. **Regression Tests**: Ensure location extraction still works after changes
4. **Performance Tests**: Verify batch processing handles 500+ rows efficiently

### Common Pitfalls to Avoid
- **Don't break existing location extraction**: Ensure mode routing preserves original functionality
- **Validate inputs thoroughly**: Check for empty arrays, missing fields before LLM calls
- **Handle API errors gracefully**: Invalid API keys should show user-friendly messages
- **Cache key uniqueness**: Ensure classification cache keys don't collide with location cache
- **Tab state persistence**: Don't lose API key or other shared fields when switching tabs

### Deployment Checklist
- [ ] All tests passing
- [ ] No console errors in browser
- [ ] Location mode still works (regression check)
- [ ] Sentiment mode classifies correctly with custom labels
- [ ] Category mode classifies correctly with 10+ categories
- [ ] CSV exports in correct format for all modes
- [ ] Documentation updated
- [ ] Feature branch merged to main

---

**Task list generation complete!** Ready for implementation.
