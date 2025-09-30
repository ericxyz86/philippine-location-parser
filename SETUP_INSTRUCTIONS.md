# Setup Instructions for PSGC Location Parser

## Step-by-Step Installation Guide

### 1. Open Google Sheets
- Create a new Google Sheets document or open an existing one
- Go to **Extensions > Apps Script**

### 2. Enable Advanced Settings
In the Apps Script editor:
- Click the **gear icon** (Project Settings) in the left sidebar
- Check **"Show 'appsscript.json' manifest file in editor"**

### 3. Add the Manifest File
- Click on **appsscript.json** in the files list
- Replace its contents with:

```json
{
  "timeZone": "Asia/Manila",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

### 4. Add the Main Script
- Click on **Code.gs** (or create it if not exists)
- Delete all existing code
- Copy and paste the entire contents of **LocationParser.gs**

### 5. Add the HTML Dialog
- Click **File > New > HTML**
- Name it **TestDialog**
- Copy and paste the contents of **TestDialog.html**

### 6. Save and Deploy
- Click **Save project** (💾 icon)
- Name your project "PSGC Location Parser"

### 7. Initial Authorization

#### Method A: Using the Test Function
1. In Apps Script, find the `testParse` function
2. Click **Run** button
3. You'll see "Authorization required"
4. Click **Review permissions**
5. Choose your Google account
6. You'll see a warning "Google hasn't verified this app"
7. Click **Advanced** > **Go to PSGC Location Parser (unsafe)**
8. Review the permissions:
   - View and manage spreadsheets
   - Connect to an external service (for PSGC API)
9. Click **Allow**

#### Method B: From Google Sheets
1. Go back to your Google Sheets
2. **Reload the page** (Important!)
3. You should see **"Location Parser"** in the menu bar
4. Click **Location Parser > Test Parser**
5. If prompted for authorization, follow steps 4-9 from Method A

### 8. Test the Installation

In any cell, type:
```
=PARSE_LOCATION("I'm from Quezon City")
```

Expected output (4 columns):
- National Capital Region
- Metro Manila
- Quezon City
- (empty for barangay)

## Troubleshooting

### "Unknown function" Error
- Make sure you saved the project
- Reload the Google Sheets page
- Wait a few seconds for functions to register

### "Authorization required" Error
- Complete Step 7 authorization process
- Make sure you allowed both permissions

### "Exception: Request failed" Error
This means the script can't reach the PSGC API. Solutions:
1. Check your internet connection
2. The API might be down - try again later
3. Use the simplified version (LocationParser-Simplified.gs) as fallback

### "Access denied" OAuth Error
If Google blocks the authorization:
1. Make sure you're using a regular Google account (not restricted workspace)
2. Try using the simplified version that doesn't need external API access
3. Contact your Google Workspace admin if using a work account

## Using the Functions

### Basic Usage
```excel
=PARSE_LOCATION(A2)
```
Returns: [Region, Province, City, Barangay]

### Individual Components
```excel
=GET_REGION(A2)     // Just the Region
=GET_PROVINCE(A2)   // Just the Province
=GET_CITY(A2)       // Just the City
=GET_BARANGAY(A2)   // Just the Barangay
```

### Detailed Analysis
```excel
=PARSE_LOCATION_DETAILED(A2)
```
Returns 7 columns: Region, Province, City, Barangay, Confidence, Other Mentions, Matched Name

### Batch Processing
1. Select comments in column A
2. Click **Location Parser > Parse Selected Comments**
3. Results appear in columns B-G

## Important Notes

- The PSGC API is free but has rate limits
- First-time use requires authorization for external API access
- The script caches API responses to reduce calls
- If API is unavailable, consider using the simplified version

## Alternative: Simplified Version

If you can't get authorization to work, use **LocationParser-Simplified.gs**:
- No external API calls (no authorization needed)
- Built-in database of 200+ Philippine locations
- Same functions and output format
- Works immediately without any setup

## Support

For issues or questions:
1. Check the browser console for detailed error messages (F12 > Console)
2. Try the simplified version as a fallback
3. Ensure your Google account allows third-party scripts