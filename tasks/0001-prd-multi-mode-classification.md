# Product Requirements Document: Multi-Mode Classification System

## Introduction/Overview

The Philippine Location Parser currently provides location extraction from text using LLM-powered analysis. This PRD introduces two new classification modes: **Sentiment Classification** and **Category Classification**, transforming the application into a unified multi-purpose text classification system.

The enhanced system will allow users to:
1. **Extract User Locations** (existing functionality)
2. **Classify Sentiment** toward specific entities (e.g., determine if comments about "PLDT Home" are Positive, Neutral, or Negative)
3. **Classify Categories** for content organization (e.g., categorize customer complaints into predefined categories)

All three modes will share the same core infrastructure (API key management, Google Sheets integration, batch processing, CSV export) while maintaining mode-specific configuration options.

**Problem Solved:** Users need a flexible text classification tool that can extract locations, analyze sentiment toward brands/entities, and categorize text content using custom taxonomies - all within a single unified interface.

## Goals

1. **Unified Interface**: Create a seamless multi-mode classification system with tab-based mode selection
2. **Flexibility**: Support custom sentiment labels and unlimited category definitions
3. **Strict Accuracy**: Ensure LLM outputs strictly adhere to user-defined classification labels
4. **Batch Processing**: Enable all three modes to process large datasets via Google Sheets, CSV, and Excel
5. **Consistent UX**: Maintain the existing user experience while adding new capabilities
6. **Cost Efficiency**: Reuse the existing OpenAI API key infrastructure and "Bring Your Own Key" model

## User Stories

### Story 1: Sentiment Analysis for Brand Monitoring
**As a** social media manager for a telecom company
**I want to** classify customer comments as Positive, Neutral, or Negative toward "PLDT Home"
**So that** I can monitor brand sentiment and identify areas requiring immediate attention

**Acceptance Criteria:**
- User can select "Sentiment" mode from tab interface
- User can specify the entity being evaluated (e.g., "PLDT Home")
- User can define custom sentiment labels (e.g., "Positive, Neutral, Negative")
- System processes text and returns only the specified sentiment labels
- Results include "Text | Classification Result" format

### Story 2: Customer Support Ticket Categorization
**As a** customer support manager
**I want to** automatically categorize incoming complaints into predefined categories
**So that** I can route tickets to the appropriate team and track issue patterns

**Acceptance Criteria:**
- User can select "Category" mode from tab interface
- User can input multiple categories (comma-separated, unlimited count)
- System classifies text using only the provided categories
- LLM strictly returns one of the user-defined categories
- Invalid LLM responses trigger automatic retry

### Story 3: Batch Processing Social Media Comments
**As a** data analyst
**I want to** process 500 Google Sheets rows with sentiment classification
**So that** I can analyze sentiment trends across a large dataset

**Acceptance Criteria:**
- User can process Google Sheets with sentiment/category modes
- Same entity/categories applied to entire batch
- Real-time progress tracking shows classification results
- CSV export includes "Text | Classification Result" columns
- Statistics panel shows success rates and processing time

### Story 4: Location Extraction (Existing + Enhanced)
**As a** market researcher
**I want to** continue using location extraction alongside new classification modes
**So that** I have all text analysis tools in one platform

**Acceptance Criteria:**
- Existing location extraction functionality remains unchanged
- Location mode is accessible via tab interface
- All shared features (API key, sheets, batch processing) work seamlessly

## Functional Requirements

### FR-1: Tab-Based Mode Selection
- **FR-1.1**: Display three tabs at the top of the interface: "Location", "Sentiment", "Category"
- **FR-1.2**: Only one tab can be active at a time
- **FR-1.3**: Tab selection determines which classification method is used
- **FR-1.4**: Visual indication of active tab (highlight/underline/color change)

### FR-2: Shared Input Fields (All Modes)
- **FR-2.1**: OpenAI API Key input field (required, saved to browser localStorage)
- **FR-2.2**: Google Sheets URL input field (optional)
- **FR-2.3**: Column Range input field (optional, default: B2:B)
- **FR-2.4**: Text Input textarea (optional, for single/multi-line text)
- **FR-2.5**: Four action buttons: "Process Google Sheet", "Extract from Text", "Upload CSV/Excel", "Clear All"

### FR-3: Location Mode (Existing Functionality)
- **FR-3.1**: When "Location" tab is selected, show only shared input fields
- **FR-3.2**: Process text using existing `processLLMFirst()` function
- **FR-3.3**: Extract Region, Province, City, Barangay hierarchy
- **FR-3.4**: Display results in existing format

### FR-4: Sentiment Mode Inputs
- **FR-4.1**: When "Sentiment" tab is selected, display additional fields:
  - Description field (label: "Classification Description", placeholder: "e.g., Classify Sentiment toward PLDT Home")
  - Entity field (label: "Entity to Evaluate", placeholder: "e.g., PLDT Home, Globe, Converge")
  - Sentiment Labels field (label: "Sentiment Labels (comma-separated)", placeholder: "e.g., Positive, Neutral, Negative")
- **FR-4.2**: All sentiment-specific fields are required when Sentiment mode is active
- **FR-4.3**: Entity field accepts multiple entities separated by commas
- **FR-4.4**: Sentiment Labels field accepts unlimited custom labels (comma-separated)
- **FR-4.5**: Description field supports full sentences for context

### FR-5: Category Mode Inputs
- **FR-5.1**: When "Category" tab is selected, display additional fields:
  - Description field (label: "Classification Description", placeholder: "e.g., Classify Complaint Category")
  - Categories field (label: "Categories (comma-separated)", placeholder: "e.g., Network Issues, Billing Problems, Customer Service")
- **FR-5.2**: Categories field accepts unlimited comma-separated values
- **FR-5.3**: No limit on number of categories
- **FR-5.4**: Categories field is required when Category mode is active
- **FR-5.5**: Description field supports full sentences for context

### FR-6: Backend Classification Processing
- **FR-6.1**: Create new API endpoint: `POST /api/classify-sentiment`
  - Request body: `{ text, entity, sentimentLabels[], description, apiKey }`
  - Response: `{ text, classification, confidence, method, reasoning }`
- **FR-6.2**: Create new API endpoint: `POST /api/classify-category`
  - Request body: `{ text, categories[], description, apiKey }`
  - Response: `{ text, classification, confidence, method, reasoning }`
- **FR-6.3**: Modify `POST /api/batch-parse` to accept mode parameter
  - Add `mode` field: "location" | "sentiment" | "category"
  - Route to appropriate classification function based on mode
- **FR-6.4**: Modify `POST /api/process-google-sheet` to accept mode parameter

### FR-7: LLM Sentiment Classification
- **FR-7.1**: Create `app/utils/sentiment-classifier.js` module
- **FR-7.2**: Build LLM prompt including:
  - User-provided description for context
  - Target entity/entities for sentiment evaluation
  - Exact sentiment labels to choose from
  - Instruction: "Return ONLY one of the provided labels"
- **FR-7.3**: Parse LLM response and validate against provided sentiment labels
- **FR-7.4**: If LLM returns label not in provided list:
  - Log validation error
  - Retry request with stricter instructions (max 2 retries)
  - If still invalid, return "Error: Invalid Classification"
- **FR-7.5**: Return only the classification label (not confidence or reasoning in output, only internally)

### FR-8: LLM Category Classification
- **FR-8.1**: Create `app/utils/category-classifier.js` module
- **FR-8.2**: Build LLM prompt including:
  - User-provided description for context
  - Complete list of categories to choose from
  - Instruction: "Return ONLY one of the provided categories"
- **FR-8.3**: Parse LLM response and validate against provided categories
- **FR-8.4**: If LLM returns category not in provided list:
  - Log validation error
  - Retry request with stricter instructions (max 2 retries)
  - If still invalid, return "Error: Invalid Classification"
- **FR-8.5**: Return only the classification label

### FR-9: Batch Processing (All Modes)
- **FR-9.1**: Support batch processing for all three modes via:
  - Google Sheets URL + column range
  - CSV file upload
  - Excel file upload
- **FR-9.2**: For sentiment mode: Apply same entity and sentiment labels to entire batch
- **FR-9.3**: For category mode: Apply same categories to entire batch
- **FR-9.4**: Display real-time progress with mode-specific status messages
- **FR-9.5**: Show statistics: Total Processed, Successful Classifications, Success Rate, Avg. Time

### FR-10: Results Display
- **FR-10.1**: Display results in a scrollable results section
- **FR-10.2**: For Location mode: Show "Region: X, Province: Y, City: Z, Barangay: W"
- **FR-10.3**: For Sentiment mode: Show "Classification: [Sentiment Label]"
- **FR-10.4**: For Category mode: Show "Classification: [Category]"
- **FR-10.5**: Each result item shows:
  - Row number (for batch processing)
  - Original text (truncated if long)
  - Classification result

### FR-11: CSV Export
- **FR-11.1**: Enable CSV download for all classification modes
- **FR-11.2**: Export format for Location mode: "Text | Region | Province | City | Barangay" (existing)
- **FR-11.3**: Export format for Sentiment mode: "Text | Classification Result"
- **FR-11.4**: Export format for Category mode: "Text | Classification Result"
- **FR-11.5**: File naming convention:
  - Location: `location-extraction-results-{timestamp}.csv`
  - Sentiment: `sentiment-classification-results-{timestamp}.csv`
  - Category: `category-classification-results-{timestamp}.csv`

### FR-12: Description Field Usage
- **FR-12.1**: Description field value is included in the LLM prompt for context
- **FR-12.2**: Description is displayed in the UI as metadata/header
- **FR-12.3**: Description is included in CSV export as first row comment (optional)
- **FR-12.4**: Description helps LLM understand the classification task intent

### FR-13: Error Handling & Validation
- **FR-13.1**: Validate that OpenAI API key is provided before processing
- **FR-13.2**: Validate that mode-specific required fields are filled
- **FR-13.3**: Show clear error messages for missing required fields
- **FR-13.4**: Handle LLM API errors gracefully with user-friendly messages
- **FR-13.5**: Implement retry logic for invalid LLM responses (max 2 retries)
- **FR-13.6**: Log all validation failures and retry attempts to console

### FR-14: UI/UX Consistency
- **FR-14.1**: Maintain existing visual design (gradient header, card-based layout)
- **FR-14.2**: Use consistent button styles across all modes
- **FR-14.3**: Keep existing color scheme and animations
- **FR-14.4**: Preserve existing help text and tooltips
- **FR-14.5**: Update page title to reflect multi-mode capability: "Philippine Location Parser & Text Classifier"

## Non-Goals (Out of Scope)

1. **Multi-Entity Batch Processing**: Different entities per row (only single entity/categories per batch)
2. **Auto-Detection of Categories**: System will not suggest or auto-generate categories
3. **Historical Classification Data**: No database storage or historical tracking
4. **Multi-Language Classification**: Only English and Filipino/Tagalog support (existing limitation)
5. **Custom Confidence Thresholds**: No user control over confidence scoring
6. **Classification Training**: No ability to train or fine-tune classification models
7. **Real-Time Streaming**: No live classification of streaming data
8. **Multi-Classification**: Each text receives only ONE classification label (not multiple)
9. **Sentiment Intensity**: No granular sentiment scores (e.g., "Very Positive" vs "Slightly Positive") unless user explicitly defines them
10. **API Authentication Beyond OpenAI**: No support for other LLM providers in this phase

## Design Considerations

### Tab Interface Design
```
┌─────────────────────────────────────────────────┐
│  Philippine Location Parser & Text Classifier   │
│  [Extract locations & classify text with AI]    │
└─────────────────────────────────────────────────┘

┌───────────┬──────────┬──────────┐
│ Location  │ Sentiment│ Category │  ← Tab Navigation
└───────────┴──────────┴──────────┘

┌─────────────────────────────────────────────────┐
│ Shared Fields (always visible):                 │
│ - OpenAI API Key                                 │
│ - Google Sheets URL                              │
│ - Column Range                                   │
│ - Text Input Textarea                            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Conditional Fields (based on active tab):       │
│                                                  │
│ [Sentiment Tab Active]                           │
│ - Classification Description                     │
│ - Entity to Evaluate                             │
│ - Sentiment Labels (comma-separated)             │
│                                                  │
│ [Category Tab Active]                            │
│ - Classification Description                     │
│ - Categories (comma-separated)                   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Action Buttons:                                  │
│ [Process Google Sheet] [Extract from Text]      │
│ [Upload CSV/Excel]     [Clear All]              │
└─────────────────────────────────────────────────┘
```

### Component Reuse
- Use existing gradient styles for tabs
- Reuse existing input field styles for new conditional fields
- Maintain existing button component styles
- Leverage existing statistics panel for all modes
- Reuse progress tracking and SSE implementation

### Responsive Behavior
- Tab navigation should collapse to dropdown on mobile devices
- Conditional fields should stack vertically on narrow screens
- Maintain existing responsive breakpoints

## Technical Considerations

### Architecture Changes

**New Modules:**
- `app/utils/sentiment-classifier.js` - Sentiment classification logic
- `app/utils/category-classifier.js` - Category classification logic
- `app/utils/classification-validator.js` (optional) - Shared validation logic

**Modified Files:**
- `app/index.html` - Add tab UI and conditional fields
- `app/app-v4.js` - Add mode state management and API integration
- `app/server-v5.js` - Add new endpoints and routing logic

### LLM Prompt Strategy

**Sentiment Classification Prompt Template:**
```
You are a sentiment classifier for social media text analysis.

TASK: Classify the sentiment of the text toward the entity "{entity}".

CONTEXT: {description}

STRICT RULES:
1. Return ONLY ONE of these labels: {sentimentLabels}
2. Do not add any other text, explanation, or labels
3. If text doesn't mention the entity, classify the overall sentiment
4. Your response must be exactly one of the provided labels

TEXT TO CLASSIFY: "{text}"

ALLOWED LABELS: {sentimentLabels}

Return your classification as a JSON object:
{
  "classification": "one of the allowed labels",
  "confidence": 0-100
}
```

**Category Classification Prompt Template:**
```
You are a category classifier for text content organization.

TASK: Classify the text into one of the provided categories.

CONTEXT: {description}

STRICT RULES:
1. Return ONLY ONE of these categories: {categories}
2. Do not create new categories or variations
3. Choose the single most relevant category
4. Your response must be exactly one of the provided categories

TEXT TO CLASSIFY: "{text}"

ALLOWED CATEGORIES: {categories}

Return your classification as a JSON object:
{
  "classification": "one of the allowed categories",
  "confidence": 0-100
}
```

### Validation Logic
```javascript
function validateClassification(llmResponse, allowedLabels) {
  const classification = llmResponse.classification.trim();

  // Exact match (case-insensitive)
  const normalizedLabels = allowedLabels.map(l => l.toLowerCase().trim());
  const normalizedResponse = classification.toLowerCase().trim();

  if (normalizedLabels.includes(normalizedResponse)) {
    return { valid: true, classification };
  }

  // Log validation error
  console.error('Invalid classification:', {
    received: classification,
    allowed: allowedLabels
  });

  return { valid: false, classification: null };
}
```

### API Endpoint Structure
```javascript
// POST /api/classify-sentiment
{
  text: string,
  entity: string,
  sentimentLabels: string[],
  description: string,
  apiKey: string
}

// POST /api/classify-category
{
  text: string,
  categories: string[],
  description: string,
  apiKey: string
}

// Modified POST /api/batch-parse
{
  texts: string[],
  mode: 'location' | 'sentiment' | 'category',
  // Mode-specific fields:
  entity?: string,
  sentimentLabels?: string[],
  categories?: string[],
  description?: string,
  apiKey: string
}
```

### Caching Strategy
- Cache classification results using text + mode + entity/categories as key
- Reuse existing `cache-manager.js` module
- Cache TTL: 24 hours (existing setting)
- Cache size: 5000 entries (existing setting)

### Performance Considerations
- Parallel batch processing (existing implementation)
- Optimal batch size: 10 (existing setting)
- Rate limiting: 200ms delay between batches (existing)
- SSE for real-time progress updates (existing)

## Success Metrics

### Quantitative Metrics
1. **Classification Accuracy**: 95%+ of classifications use only provided labels
2. **Retry Rate**: <5% of LLM responses require retry
3. **Processing Speed**: Average 500-2000ms per classification (matching location extraction)
4. **Batch Success Rate**: 98%+ of batch items successfully classified
5. **User Adoption**: 30%+ of sessions use new classification modes within first month

### Qualitative Metrics
1. **User Feedback**: Positive sentiment in user feedback regarding multi-mode functionality
2. **Error Frequency**: Minimal "Invalid Classification" errors in production
3. **UX Consistency**: Users can switch between modes without confusion
4. **Documentation Clarity**: Users understand how to define custom labels/categories

### Operational Metrics
1. **API Cost**: Classification costs remain comparable to location extraction (~$0.0001-0.0002 per text)
2. **Uptime**: 99.9% availability maintained across all modes
3. **Error Rates**: <1% server errors during classification operations

## Open Questions

1. **Should we add preset templates for common classification tasks?**
   - Example: "Telecom Sentiment Analysis" preset with common entities and labels
   - Would reduce user configuration time but adds complexity

2. **Should we support multi-classification (multiple labels per text)?**
   - Could be useful for texts expressing multiple sentiments or belonging to multiple categories
   - Requires rework of output format and validation logic

3. **Should we provide classification confidence scores in the UI?**
   - Currently only showing labels, but confidence could help users assess quality
   - Might clutter simple "Text | Classification" export format

4. **Should we add a "Test Classification" feature?**
   - Allow users to test their entity/labels/categories on sample text before batch processing
   - Would improve user confidence but adds another workflow

5. **Should we implement classification history/logs?**
   - Track previous classification jobs for reuse or analysis
   - Requires database or localStorage implementation

6. **Should we support exporting LLM reasoning for classifications?**
   - Could help users understand why a specific classification was chosen
   - Would require additional export format option

---

## Appendix: User Workflow Examples

### Example 1: Sentiment Analysis Workflow
1. User opens application
2. Clicks "Sentiment" tab
3. Enters OpenAI API key (if not saved)
4. Fills in:
   - Description: "Classify customer sentiment toward PLDT Home"
   - Entity: "PLDT Home"
   - Sentiment Labels: "Positive, Neutral, Negative"
5. Pastes Google Sheets URL with 200 customer comments
6. Clicks "Process Google Sheet"
7. Views real-time progress (50%, 100%, etc.)
8. Reviews results showing each comment's sentiment
9. Downloads CSV with "Text | Classification Result"
10. Uses results for sentiment trend analysis

### Example 2: Category Classification Workflow
1. User opens application
2. Clicks "Category" tab
3. Enters OpenAI API key (if not saved)
4. Fills in:
   - Description: "Categorize customer support tickets"
   - Categories: "Billing, Technical Support, Account Management, Service Request, Complaint"
5. Uploads CSV file with 500 support tickets
6. Clicks "Upload CSV/Excel"
7. Confirms column selection (default: column B)
8. Clicks "Extract from Text" to process
9. Views real-time progress with category distributions
10. Downloads classified results
11. Uses results to route tickets to appropriate teams

### Example 3: Mixed Usage Workflow
1. User processes locations for market research (Location tab)
2. Downloads location results
3. Switches to Sentiment tab
4. Processes same dataset for sentiment analysis
5. Downloads sentiment results
6. Combines both datasets in external tool for geographic sentiment mapping

---

**Document Version:** 1.0
**Created:** 2025-10-09
**Author:** Product Team
**Status:** Ready for Review
