# Getting Started with Philippine Location Parser & Text Classifier

Welcome! This guide will teach you how to use the Philippine Location Parser & Text Classifier in just a few minutes. Whether you want to extract locations from social media posts, analyze sentiment, or categorize customer feedback, this tutorial will walk you through everything step-by-step.

---

## What Does This App Do?

This app helps you analyze text in three powerful ways:

1. **📍 Location Extraction** - Finds Philippine locations (regions, provinces, cities, barangays) in text
2. **💬 Sentiment Classification** - Determines if text is positive, negative, neutral (or custom labels)
3. **📁 Category Classification** - Organizes text into categories you define

**The best part?**
- ✅ **No installation required** - Just open your browser!
- ✅ **Multilingual support** - Works with English, Filipino (Tagalog/Bisaya), and more
- ✅ **Run all three analyses at once** on different datasets

---

## Who Is This Guide For?

- Researchers analyzing social media data
- Customer service teams categorizing feedback
- Marketing professionals tracking brand sentiment
- Anyone working with text data (any language!)

---

## Table of Contents

1. [Before You Begin](#before-you-begin)
2. [Tutorial 1: Your First Location Extraction](#tutorial-1-your-first-location-extraction)
3. [Tutorial 2: Sentiment Analysis](#tutorial-2-sentiment-analysis)
4. [Tutorial 3: Category Classification](#tutorial-3-category-classification)
5. [Working with Google Sheets](#working-with-google-sheets)
6. [Working with CSV/Excel Files](#working-with-csvexcel-files)
7. [Understanding Your Results](#understanding-your-results)
8. [Exporting Your Data](#exporting-your-data)
9. [Tips & Best Practices](#tips--best-practices)
10. [Frequently Asked Questions](#frequently-asked-questions)

---

## Before You Begin

### What You'll Need

- A modern web browser (Chrome, Firefox, Edge, or Safari)
- An **OpenAI API key** (we'll show you how to get one)
- That's it! No installation required.

### Step 1: Get Your OpenAI API Key

This app uses AI to understand text, so you'll need an OpenAI API key:

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign up or log in to your OpenAI account
3. Click **"Create new secret key"**
4. Give it a name like "Location Parser"
5. **Copy the key** - it starts with `sk-` and looks like: `sk-abc123xyz...`
6. **Save it somewhere safe** - you won't be able to see it again!

💡 **Cost Note:** This app uses GPT-4o-mini, which is very affordable. Processing 1,000 texts typically costs less than $0.50 USD.

### Step 2: Open the App

1. Open your web browser
2. Go to: **https://location-parser.onrender.com**
3. You should see the Philippine Location Parser & Text Classifier interface

### Step 3: Add Your API Key

1. Look for the **red box** at the top that says "OpenAI API Key (REQUIRED)"
2. Paste your API key (the one starting with `sk-`)
3. Click **"Save API Key"**
4. You should see a green message: "✓ API key saved to browser storage"

✅ **You're all set!** Let's start analyzing some text.

---

## Tutorial 1: Your First Location Extraction

Let's extract locations from Filipino social media posts!

### What You'll Learn
- How to input text
- How to run location extraction
- How to read the results

### Step-by-Step

**1. Make sure you're on the Location tab**
   - You should see three tabs at the top: **Location Extraction**, Sentiment Classification, Category Classification
   - The **Location Extraction** tab should be highlighted in blue

**2. Enter some sample text**

In the text box labeled **"Or Enter Text to Parse"**, paste this sample data (mix of English and Filipino):

```
Taga Quezon City ako
Here in Makati area
I'm from Cebu City
Wala sa Manila
Area Rizal
Living in BGC
```

**3. Click "Extract from Text"**
   - The green button on the right
   - You'll see a progress bar appear

**4. Wait for processing**
   - Processing usually takes 2-5 seconds per line
   - Watch the progress bar fill up
   - You'll see status messages like "Processing: Taga Quezon City ako..."

**5. View your results!**

Once complete, you'll see:

- **Statistics Panel** showing:
  - Total Rows: 6
  - With Locations: 6
  - Success Rate: 100%
  - Top Cities chart

- **Results List** showing each text with extracted location:
  ```
  Row 1
  Taga Quezon City ako (Filipino)
  📍 Region: National Capital Region (NCR)
  Province: Metro Manila
  City: Quezon City
  Barangay: None

  Row 2
  Here in Makati area (English)
  📍 Region: National Capital Region (NCR)
  Province: Metro Manila
  City: Makati City
  Barangay: None
  ```

**6. Download your results**
   - Scroll down to see the **"Download Location Results"** button
   - Choose **Single Column** or **Multiple Columns**
   - Click to download a CSV file

🎉 **Congratulations!** You've completed your first location extraction.

### Try These Examples

Now try these different types of text to see how the parser handles various languages and formats:

```
#AlterBacolod
Here in Danao, Cebu (English)
Taga QC ako (Filipino/Tagalog)
BGC area (English abbreviation)
Brgy. Poblacion, Makati City (Mixed)
Naa ko sa Cebu (Bisaya/Cebuano)
From Davao (English)
Area Paranaque (Mixed)
```

💡 **Multilingual Magic:** The app understands:
- **English**: "I'm from Manila"
- **Filipino/Tagalog**: "Taga Quezon City ako"
- **Bisaya/Cebuano**: "Naa ko sa Davao"
- **Mixed**: "Here in Makati area"
- **Abbreviations**: "QC", "BGC", "CDO"
- **Hashtags**: "#AlterCebu"

---

## Tutorial 2: Sentiment Analysis

Now let's analyze how people feel about a brand or topic!

### What You'll Learn
- How to set up sentiment labels
- How to analyze sentiment in text
- How to interpret sentiment results

### Real-World Example: Telecom Feedback

Let's say you want to analyze customer sentiment about "PLDT Home" internet service.

### Step-by-Step

**1. Switch to the Sentiment tab**
   - Click on **"Sentiment Classification"** at the top
   - You'll see new fields appear in a blue box

**2. Configure your sentiment analysis**

Fill in these fields:

- **Classification Description** (optional):
  ```
  Customer feedback about internet service quality
  ```

- **Entity to Evaluate** (required):
  ```
  PLDT Home
  ```

- **Sentiment Labels** (required):
  ```
  Positive, Neutral, Negative
  ```

**3. Enter sample feedback**

In the **"Or Enter Text to Parse"** box, paste:

```
PLDT Home fiber is super fast! Love it!
The connection keeps dropping. Very frustrating.
It's okay, not great but not terrible either.
Best internet I've had in years! Highly recommend PLDT Home.
Customer service is terrible. Been waiting for days.
```

**4. Click "Extract from Text"**
   - The app will analyze each line
   - Progress bar shows real-time updates

**5. View sentiment results**

You'll see:

- **Statistics**:
  - Total Rows: 5
  - Classified: 5
  - Top Sentiments chart (e.g., 40% Positive, 40% Negative, 20% Neutral)

- **Results**:
  ```
  Row 1
  PLDT Home fiber is super fast! Love it!
  💬 Positive

  Row 2
  The connection keeps dropping. Very frustrating.
  💬 Negative
  ```

**6. Download your sentiment data**
   - Click **"Download Sentiment Results"**
   - Opens as CSV with columns: Row, Text, Classification

### Advanced: Custom Sentiment Labels

You can use any labels you want! Try:

```
Very Satisfied, Satisfied, Neutral, Dissatisfied, Very Dissatisfied
```

Or for product reviews:
```
Love it, Like it, It's okay, Don't like it, Hate it
```

---

## Tutorial 3: Category Classification

Let's organize customer complaints into categories!

### What You'll Learn
- How to define categories
- How to classify text automatically
- How to use category hints for better accuracy

### Real-World Example: Customer Support Tickets

Let's categorize telecom customer support requests.

### Step-by-Step

**1. Switch to the Category tab**
   - Click **"Category Classification"** at the top
   - New fields appear in a blue box

**2. Define your categories**

In the **Categories** field, enter:

```
Billing Issue, Technical Support, Network Problem, Account Management, Product Inquiry, Complaint, Feedback
```

**3. Add a description (optional but helpful)**

In **Classification Description**, enter:
```
Customer support tickets for telecom services
```

**4. Enter sample support tickets**

Paste this in the text box:

```
I was charged twice this month. Please refund.
Internet not working since yesterday. Need help ASAP.
How do I upgrade to the fiber plan?
Can't access my online account. Password reset not working.
Why is the speed so slow during peak hours?
Great service! Just wanted to say thank you.
Need to change my billing address.
```

**5. Click "Extract from Text"**
   - Watch the AI categorize each ticket
   - Processing takes about 2-3 seconds per item

**6. Review the categorized results**

You'll see:

- **Statistics**:
  - Total Rows: 7
  - Classified: 7
  - Top Categories chart showing distribution

- **Results**:
  ```
  Row 1
  I was charged twice this month. Please refund.
  📁 Billing Issue

  Row 2
  Internet not working since yesterday. Need help ASAP.
  📁 Technical Support
  ```

**7. Export categorized data**
   - Click **"Download Category Results"**
   - Use the CSV to route tickets to the right department!

### Pro Tip: Adding Category Hints

For better accuracy, you can add descriptions to categories. Instead of just:
```
Billing Issue, Technical Support
```

Use parentheses to add context:
```
Billing Issue (charges, payments, invoices, refunds), Technical Support (connection, speed, equipment, setup)
```

The AI uses these hints but only returns the clean category name!

---

## Working with Google Sheets

Process hundreds or thousands of rows directly from Google Sheets!

### Step-by-Step

**1. Prepare your Google Sheet**

- Create a spreadsheet with your data in column B (or any column)
- Row 1 should be a header like "Text" or "Comments"
- Data starts in row 2
- Make the sheet **publicly viewable** (Share → Anyone with the link can view)

Example:
```
| A  | B                                    |
|----|--------------------------------------|
| 1  | Comments                             |
| 2  | Great service in Makati!             |
| 3  | Slow internet here in Quezon City    |
| 4  | Love the new fiber plan!             |
```

**2. Get the sheet URL**
   - Click **Share** in your Google Sheet
   - Copy the link (looks like: `https://docs.google.com/spreadsheets/d/ABC123.../edit`)

**3. In the app, paste the URL**
   - Find the **"Google Sheets URL"** field
   - Paste your link

**4. Set the column range (optional)**
   - Leave blank to process column B starting at row 2
   - Or specify: `B2:B100` to process rows 2-100 of column B

**5. Choose your mode**
   - Switch to **Location**, **Sentiment**, or **Category** tab
   - Configure any mode-specific settings (entity, labels, categories)

**6. Click "Process Google Sheet"**
   - For large sheets (200+ rows), processing may take several minutes
   - Watch the real-time progress: "Processing 47/200 items..."
   - Estimated time remaining is shown

**7. Download results**
   - Results include row numbers matching your sheet
   - Import the CSV back into Google Sheets or Excel
   - Use VLOOKUP or INDEX-MATCH to add results to your original data

---

## Working with CSV/Excel Files

Upload spreadsheet files directly!

### Step-by-Step

**1. Prepare your file**
   - Save as `.csv`, `.xlsx`, or `.xls`
   - Put your text data in column B (or note which column)
   - First row should be a header

**2. Click "Upload CSV/Excel"**
   - Gray button in the interface
   - Choose your file (max 10MB)

**3. For Excel files with multiple sheets**
   - The app will detect all sheets
   - A dropdown appears - select which sheet to use
   - Click **"Load Selected Sheet"**

**4. Specify column range (optional)**
   - In the **"Column Range"** field
   - Examples: `B2` (column B starting at row 2), `C5:C100` (column C rows 5-100)
   - Leave blank to auto-detect

**5. Process the data**
   - Your text now appears in the text box
   - Choose your mode (Location/Sentiment/Category)
   - Click **"Extract from Text"** or **"Process Google Sheet"**

---

## Understanding Your Results

### Statistics Panel

Every mode shows statistics:

- **Total Rows** - How many items were processed
- **With Locations / Classified** - Success count
- **Success Rate** - Percentage successfully processed
- **Distribution Chart** - Visual breakdown of top results

**What's a good success rate?**
- **Location**: 80%+ is excellent for social media data
- **Sentiment**: 90%+ is typical
- **Category**: 85%+ with clear categories

### Confidence Scores

For locations:
- **90-100%**: Very confident, likely accurate
- **70-89%**: Good confidence, worth verifying
- **50-69%**: Low confidence, manual review recommended
- **Below 50%**: Uncertain, check original text

### Reading Location Results

Example output:
```
Row 5
"Here in Makati area"
📍 Region: National Capital Region (NCR)
Province: Metro Manila
City: Makati City
Barangay: None
```

**What each field means:**
- **Region**: One of the 17 Philippine regions
- **Province**: Province or special region (like Metro Manila)
- **City**: City or Municipality
- **Barangay**: Most specific location unit (often "None" for general mentions)

### Understanding Distribution Charts

The **Top Cities** or **Top Categories** chart shows:
- Bar width = relative frequency
- Percentage = % of total results
- Count = number of occurrences

Use this to:
- See geographic distribution of your audience
- Understand sentiment balance
- Identify most common complaint categories

---

## Exporting Your Data

### CSV Export Options

**Location Mode** offers two formats:

1. **Single Column** - Compact format:
   ```csv
   Row,Text,Location
   1,"Taga QC ako","Region: NCR, Province: Metro Manila, City: Quezon City, Barangay: None"
   ```

2. **Multiple Columns** - Separate fields:
   ```csv
   Row,Text,Region,Province,City,Barangay
   1,"Taga QC ako","National Capital Region (NCR)","Metro Manila","Quezon City","None"
   ```

**Sentiment/Category Modes** export as:
```csv
Row,Text,Classification
1,"Great service!","Positive"
2,"Need help with billing","Billing Issue"
```

### Opening CSV Files

**In Excel:**
1. Open Excel
2. File → Open → Choose your CSV
3. Data should import correctly with UTF-8 encoding

**In Google Sheets:**
1. Open Google Sheets
2. File → Import → Upload
3. Choose your CSV file

### Merging Results with Original Data

If you processed a Google Sheet or CSV:

1. Export results from the app
2. Open both files (original + results) in Excel/Sheets
3. Use VLOOKUP or INDEX-MATCH to merge by row number:
   ```
   =VLOOKUP(A2, Results!A:C, 3, FALSE)
   ```

---

## Tips & Best Practices

### Getting Better Results

**For Location Extraction:**
- ✅ Include context: "here in Cebu City" works better than just "Cebu"
- ✅ Any language works: "taga Maynila" (Tagalog), "from Manila" (English), "naa ko sa Davao" (Bisaya)
- ✅ Mix languages freely: "Here sa Makati area"
- ❌ Avoid: Very short mentions without context

**For Sentiment Analysis:**
- ✅ Be specific with your entity: "PLDT Home" not just "internet"
- ✅ Use 3-5 labels: Too many labels confuse the classifier
- ✅ Make labels distinct: Avoid overlap like "Happy" and "Pleased"

**For Category Classification:**
- ✅ Define clear, non-overlapping categories
- ✅ Add hints in parentheses for ambiguous categories
- ✅ Use 5-10 categories: More than 15 reduces accuracy
- ✅ Test with small sample first, then adjust categories

### Managing Costs

**OpenAI API costs are very low with GPT-4o-mini:**
- ~1,000 texts = $0.30-$0.50 USD
- ~10,000 texts = $3-$5 USD

**To minimize costs:**
- ✅ Process similar data in batches (caching reduces duplicate API calls)
- ✅ Use clear, simple text when possible
- ✅ Don't re-run the same data unnecessarily
- ❌ Avoid: Processing one item at a time repeatedly

**Monitor your usage:**
- Check [https://platform.openai.com/usage](https://platform.openai.com/usage)
- Set spending limits in your OpenAI account

### Running Multiple Analyses

You can run all three modes simultaneously!

**Example workflow:**
1. Start **Location Extraction** on Dataset A
2. While it's running, switch to **Sentiment** tab
3. Configure sentiment settings for Dataset B
4. Start sentiment analysis
5. Both run independently without interfering!

Each mode has its own:
- Progress bar
- Results panel
- Statistics
- Download button

### Best Practices for Large Datasets

**For 1,000+ rows:**
- Use Google Sheets processing (better for large datasets than text input)
- Process during off-peak hours
- Expect 5-15 minutes for 1,000 rows
- Check progress periodically but don't close the browser tab

**For 10,000+ rows:**
- Consider splitting into multiple batches
- Process overnight
- Monitor OpenAI rate limits (you may need to upgrade your plan)

---

## Frequently Asked Questions

### General Questions

**Q: Do I need to install anything besides Node.js?**
A: No, just run `npm install` and you're ready to go.

**Q: Can I use this offline?**
A: No, it requires internet to connect to OpenAI's API.

**Q: Is my data stored anywhere?**
A: No, all processing happens in real-time. Results are only stored in your browser temporarily. Export them to save permanently.

**Q: Can multiple people use the same API key?**
A: Yes, but costs add up. Each person can use their own key to track usage separately.

### API Key Questions

**Q: Where do I get an API key?**
A: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

**Q: How much does it cost?**
A: GPT-4o-mini is very affordable - roughly $0.30-$0.50 per 1,000 texts.

**Q: My API key doesn't work**
A: Make sure:
- It starts with `sk-`
- You have billing set up in your OpenAI account
- Your account has available credits
- You didn't accidentally copy extra spaces

**Q: Can I use a different AI service?**
A: Currently only OpenAI is supported.

### Processing Questions

**Q: How long does processing take?**
A:
- Small batch (10-50 rows): 30 seconds - 2 minutes
- Medium batch (100-500 rows): 3-10 minutes
- Large batch (1,000+ rows): 15-60 minutes

**Q: Can I close the browser while processing?**
A: No, keep the tab open. Processing will stop if you close it.

**Q: What if processing gets stuck?**
A:
1. Check your internet connection
2. Check the browser console for errors (F12)
3. Click "Clear All" and try again
4. Restart the server if needed

**Q: Why are some results showing "None"?**
A: The AI couldn't find that information in the text. For locations, this is common for barangays when only city is mentioned.

### Results Questions

**Q: The location seems wrong. What happened?**
A: Common causes:
- Ambiguous text (multiple places mentioned)
- Typos or non-standard spellings
- Places with same names in different regions
- Check "Other Mentions" for conflicting locations

**Q: Can I re-process failed items?**
A: Yes:
1. Export your results
2. Filter for rows with errors or low confidence
3. Paste those texts back into the app
4. Process again

**Q: How do I combine results with my original spreadsheet?**
A: See the [Merging Results](#merging-results-with-original-data) section above.

### Technical Questions

**Q: Do I need to install anything?**
A: No! Just open your browser and go to https://location-parser.onrender.com

**Q: Can I use this on my phone or tablet?**
A: Yes! The web interface works on any device with a modern browser.

**Q: Is there a desktop version?**
A: The web version works great on desktop. You can bookmark it for quick access.

**Q: What languages are supported?**
A: The app is multilingual and works with:
- English
- Filipino (Tagalog)
- Bisaya/Cebuano
- Other Philippine languages
- Mixed language text

**Q: Does it only work for Philippine locations?**
A: The location extraction is optimized for Philippine locations (regions, provinces, cities, barangays). However, sentiment and category classification work with any text in any language.

---

## Need More Help?

### Additional Resources

- **Technical Manual**: `USER_MANUAL.md` - Detailed technical documentation
- **Setup Guide**: `SETUP_INSTRUCTIONS.md` - Installation and configuration
- **Developer Guide**: `IMPLEMENTATION_GUIDE.md` - For developers and advanced users

### Troubleshooting Steps

1. **Check the browser console** (Press F12, click Console tab)
2. **Refresh the page** (Ctrl+R or Cmd+R)
3. **Try the examples in this guide** to isolate the issue
4. **Clear your browser cache** and reload
5. **Try a different browser** (Chrome usually works best)

### Getting Support

If you're still stuck:

1. Note the exact error message
2. Capture what you were trying to do
3. Take a screenshot of the issue
4. Contact your technical team with:
   - Error message
   - Steps to reproduce
   - Browser type and version
   - Sample data (if applicable)

---

## Quick Reference Card

### Accessing the App
Simply open your browser and go to:
**https://location-parser.onrender.com**

No installation, no setup required!

### Processing Text
1. Enter API key and save
2. Choose a mode (Location/Sentiment/Category)
3. Configure mode settings
4. Paste text or connect data source
5. Click process button
6. Download results

### Mode-Specific Setup

**Location Mode:**
- No configuration needed
- Just enter text and click "Extract from Text"

**Sentiment Mode:**
- Entity: Who/what are you analyzing?
- Labels: Comma-separated sentiment options
- Description: Optional context

**Category Mode:**
- Categories: Comma-separated categories
- Description: Optional context
- Hints: Add in parentheses after category name

### File Uploads
- CSV, XLSX, XLS (max 10MB)
- Column B by default
- Specify range: `B2:B100`

### Google Sheets
- Must be publicly viewable
- Default: Column B from row 2
- Specify range or leave blank

---

**🎉 Congratulations!** You now know how to use the Philippine Location Parser & Text Classifier. Start with small datasets, experiment with the different modes, and you'll be analyzing Filipino text like a pro in no time.

Happy analyzing! 📊
