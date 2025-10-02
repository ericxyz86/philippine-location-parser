# Philippine Location Parser - User Guide

## Quick Start

The Philippine Location Parser extracts location information from text using advanced AI-powered location extraction with GPT-4o-mini. Perfect for processing social media comments, customer feedback, or any text containing Philippine locations.

## Getting Started

### 1. Launch the Application

```bash
cd app
npm install
npm start                    # V5 (AI-powered with GPT-4o-mini)
```

Visit **http://localhost:3002** in your browser.

### 2. Set Up Your OpenAI API Key

**⚠️ IMPORTANT: You MUST provide your own OpenAI API key**

1. Get an API key from https://platform.openai.com
2. In the web interface, enter your API key in the "OpenAI API Key" field
3. Click "Save API Key" to store it locally
4. Your key is required for all location extraction operations

**Note**: The application operates on a "bring your own API key" model - no server fallback is provided.

### 2. Choose Your Input Method

#### Method A: Direct Text Input
1. Enter your OpenAI API key (required)
2. Enter text in the text area (one location per line)
3. Click **"Extract from Text"**
4. View results in real-time

#### Method B: Google Sheets
1. Enter your OpenAI API key (required)
2. Make your Google Sheet publicly viewable
3. Copy the sheet URL
4. Paste URL in the Google Sheets field
5. Select specific column range (optional)
6. Click **"Process Google Sheet"**

#### Method C: File Upload
1. Enter your OpenAI API key (required)
2. Click **"Upload CSV/Excel"**
3. Select your file (CSV, .xlsx, .xls)
4. Choose sheet/tab if multiple available
5. Specify column range
6. Click **"Load Selected Sheet"**

## Understanding the Results

### Output Format

Each extracted location includes:
- **Region**: Administrative region (e.g., National Capital Region)
- **Province**: Province or state (e.g., Metro Manila)
- **City**: City or municipality (e.g., Quezon City)
- **Barangay**: Local community (e.g., Poblacion)

### Example Results

| Input Text | Extracted Location | Confidence |
|------------|-------------------|------------|
| "Taga Quezon City ako" | Quezon City, Metro Manila | 95% |
| "Here in BGC area" | Taguig City, Metro Manila | 90% |
| "Cebu po" | Cebu City, Central Visayas | 85% |
| #AlterBacolod | Bacolod City, Western Visayas | 88% |

## Supported Text Patterns

### Filipino/English Patterns
- "Taga [location] ako" → "I'm from [location]"
- "Dito sa [location]" → "Here in [location]"
- "Nasa [location] area" → "In [location] area"
- "Location is [location]" → Direct declaration

### Hashtags & Slang
- #AlterBacolod → Bacolod City
- #MakatiAlter → Makati City
- "QC area" → Quezon City
- "BGC" → Bonifacio Global City, Taguig
- "Gensan" → General Santos City

### Barangay Patterns
- "Brgy. 171, Caloocan" → Caloocan City
- "Barangay Poblacion" → Specific barangay
- "Zone 1, Manila" → Manila City

## API Key Setup (Required)

**⚠️ API Key is REQUIRED for all operations**

The Philippine Location Parser now operates exclusively with AI-powered extraction using GPT-4o-mini:

1. Get an OpenAI API key from https://platform.openai.com
2. Click **"Save API Key"** in the interface
3. Enter your key (starts with "sk-")
4. Your key is saved locally and used for your requests only

**Benefits**:
- Superior accuracy with AI-powered extraction
- Advanced context understanding
- Cascading inference for incomplete locations
- Reduced false positives

**Note**: Without a valid API key, the system cannot process any text.

## Export Options

### Single Column Format
```
Row, Text, Location
1, "Taga QC ako", "Region: National Capital Region (NCR), Province: Metro Manila, City: Quezon City"
```

### Multi-Column Format
```
Row, Text, Region, Province, City, Barangay
1, "Taga QC ako", "National Capital Region (NCR)", "Metro Manila", "Quezon City", "None"
```

## Performance Tips

### For Best Results
- **Be Specific**: Include city/province when possible
- **Use Context**: "I live in..." is better than just "Manila"
- **Avoid Ambiguity**: "Manila" could be city or province
- **Batch Process**: Process multiple items at once for efficiency

### Processing Speed
- **AI-Powered Mode**: ~1-2 seconds per text (first request)
- **Cached Results**: ~10ms for repeated queries
- **Batch Processing**: 5x faster with parallel processing

## Troubleshooting

### Common Issues

**API Key Required Error**
- Ensure you've entered a valid OpenAI API key
- Check that your key starts with "sk-" and is at least 20 characters
- Verify your API key has sufficient credits

**No Location Found**
- Check spelling of location names
- Ensure text contains location indicators
- Try more specific location names

**Wrong Location Detected**
- Provide more context (nearby landmarks)
- Use full names instead of abbreviations
- Include province/region for disambiguation

**Processing Errors**
- Check internet connection (required for AI processing)
- Verify your OpenAI API key is valid and active
- Ensure Google Sheet is publicly viewable
- Verify file format (CSV/Excel)

**Performance Issues**
- Enable API key for caching benefits
- Process in smaller batches
- Check OpenAI API rate limits

## Advanced Features

### Column Range Specification
- `B2` → Process column B starting from row 2
- `B2:B100` → Process column B, rows 2-100
- `C:C` → Process entire column C

### Multi-Sheet Support
- **Google Sheets**: Automatic tab detection
- **Excel Files**: Sheet selection dropdown
- **CSV Files**: Single sheet only

### Real-time Progress
- Live progress bars for large files
- Processing statistics dashboard
- Success rate and confidence metrics

## API Integration

For developers, the parser offers RESTful APIs with required API key:

```javascript
// Single text processing
POST /api/parse-text
{
  "text": "Taga Quezon City ako",
  "apiKey": "sk-your-openai-key-here"
}

// Batch processing
POST /api/batch-parse
{
  "texts": ["text1", "text2", ...],
  "apiKey": "sk-your-openai-key-here",
  "parallel": true
}
```

**Note**: All API requests must include a valid OpenAI API key.

## Best Practices

### Data Quality
- Remove special characters when possible
- Use consistent formatting
- Validate input before processing
- Test with sample data first

### Large Datasets
- Start with small sample batches
- Monitor success rates
- Use appropriate column ranges
- Consider processing during off-peak hours

### Privacy & Security
- API keys are stored locally only
- No long-term data storage
- Public sheets recommended for Google Sheets
- Sensitive data should be anonymized

## Support & Resources

### Documentation
- **Technical Analysis**: See CODEBASE_ANALYSIS.md
- **Architecture**: See ARCHITECTURAL_DIAGRAMS.md
- **API Reference**: See CAPABILITIES_FEATURES.md

### Getting Help
- Check the console for error messages
- Review test cases in the codebase
- Ensure all dependencies are installed
- Verify network connectivity for V5 mode

## Performance Benchmarks

| Text Type | AI-Powered Speed | Cached Speed | Accuracy |
|-----------|------------------|--------------|----------|
| Simple location | 500ms | 10ms | 95% |
| Complex Filipino text | 1000ms | 10ms | 90% |
| Hashtag patterns | 800ms | 10ms | 88% |
| Ambiguous context | 1500ms | 10ms | 85% |

**Note**: First requests require AI processing, subsequent requests use cached results.

## Keyboard Shortcuts

- **Ctrl+Enter**: Process current text
- **Ctrl+O**: Open file dialog
- **Ctrl+S**: Download results
- **Esc**: Clear all inputs

---

**Need more help?** Check the comprehensive analysis documents or review the test cases in the `/app/tests/` directory for examples of supported patterns.