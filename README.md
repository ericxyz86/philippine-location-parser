# Context-Aware Location Parser for Google Sheets

A Google Apps Script that intelligently parses user comments to determine their actual location using the Philippine Standard Geographic Code (PSGC) API v2. The script features context-aware NLP to distinguish between the user's location and other locations mentioned in their comments.

## Features

### Context-Aware Location Detection
- **User Location Patterns**: Identifies statements like "I'm from Manila", "Here in Davao", "Taga-Makati ako"
- **Other Location Filtering**: Distinguishes between user's location and places they mention (visited, compared to, etc.)
- **Confidence Scoring**: Rates detection confidence from 0-100% based on pattern strength
- **Filipino Language Support**: Recognizes Filipino phrases like "taga", "galing", "dito sa"

### PSGC API Integration
- Searches across all administrative levels (Barangay, City/Municipality, Province, Region)
- Handles location name variations and common abbreviations
- Returns detailed location data with administrative level classification

### Google Sheets Integration
- Custom functions: `PARSE_LOCATION()` and `PARSE_LOCATION_DETAILED()`
- Batch processing for multiple comments
- Interactive testing dialog
- Custom menu for easy access

## Installation

1. Open your Google Sheets document
2. Go to **Extensions > Apps Script**
3. Delete any existing code in the editor
4. Copy and paste the contents of `LocationParser.gs`
5. Create a new HTML file named `TestDialog.html`
6. Copy and paste the contents of `TestDialog.html`
7. Save the project (File > Save)
8. Reload your Google Sheets document

## Usage

### Custom Functions

#### Location Hierarchy Extraction
```
=PARSE_LOCATION(A2)
```
Returns a row with 4 columns: Region, Province, City/Municipality, Barangay

#### Detailed Location Analysis
```
=PARSE_LOCATION_DETAILED(A2)
```
Returns a row with 7 columns:
- Region
- Province
- City/Municipality
- Barangay
- Confidence score (0-1)
- Other mentioned locations
- Matched location name

#### Individual Component Functions
```
=GET_REGION(A2)      // Returns just the Region
=GET_PROVINCE(A2)    // Returns just the Province
=GET_CITY(A2)        // Returns just the City/Municipality
=GET_BARANGAY(A2)    // Returns just the Barangay
```

### Menu Functions

After installation, a **"Location Parser"** menu appears with options:
- **Parse Selected Comments**: Process multiple comments at once
- **Setup Headers**: Create formatted headers for results
- **Test Parser**: Open interactive testing dialog

### Batch Processing

1. Select the column containing comments
2. Click **Location Parser > Parse Selected Comments**
3. Results appear in columns to the right

## How It Works

### Context Analysis Pipeline

1. **Pattern Matching**: Searches for user location indicators
   - Direct statements: "I am from", "I live in"
   - Implicit patterns: "Here in", "Our barangay"
   - Professional context: "I work in", "Stationed at"

2. **Other Location Detection**: Identifies non-user locations
   - Travel mentions: "visited", "went to"
   - Comparisons: "unlike", "compared to"
   - Past locations: "moved from", "left"

3. **Confidence Calculation**: Scores based on pattern strength
   - 95%: "I am from [location]"
   - 90%: "Here in [location]"
   - 75%: "Work in [location]"
   - 50%: Inferred locations

4. **PSGC Validation**: Verifies location exists in Philippine database
   - Searches all administrative levels
   - Handles name variations
   - Returns best match with metadata

## Example Output

The parser returns complete location hierarchy:

```
Comment: "I'm from Quezon City but I visited Cebu last week"
Output:
  → Region: National Capital Region
  → Province: Metro Manila
  → City: Quezon City
  → Barangay: (empty if not specified)
  → Confidence: 95%
  → Other Mentions: Cebu

Comment: "Here in Barangay Poblacion, Makati"
Output:
  → Region: National Capital Region
  → Province: Metro Manila
  → City: Makati City
  → Barangay: Poblacion
  → Confidence: 90%

Comment: "Taga-Davao City ako"
Output:
  → Region: Davao Region
  → Province: Davao del Sur
  → City: Davao City
  → Barangay: (empty)
  → Confidence: 88%
```

## API Reference

### Main Functions

#### `parseUserLocation(comment)`
- **Input**: String comment
- **Output**: Object with location data and confidence
- **Description**: Core parsing function with full context analysis

#### `PARSE_LOCATION(comment)`
- **Input**: Cell reference or string
- **Output**: Location name string
- **Description**: Simple custom function for spreadsheet formulas

#### `PARSE_LOCATION_DETAILED(comment)`
- **Input**: Cell reference or string
- **Output**: Array [location, level, confidence, others]
- **Description**: Detailed custom function with metadata

### Configuration

The script uses the PSGC Cloud API v2:
- Base URL: `https://psgc.cloud/api/v2`
- No authentication required
- Rate limiting: Handled automatically

## Limitations

- Currently optimized for Philippine locations only
- API rate limits may affect large batch processing
- Internet connection required for PSGC API calls
- Maximum confidence for inferred locations is 50%

## Error Handling

The script includes comprehensive error handling:
- Invalid input validation
- API connection failures
- Rate limiting responses
- Graceful fallbacks for unrecognized locations

## License

This script is provided as-is for educational and commercial use.