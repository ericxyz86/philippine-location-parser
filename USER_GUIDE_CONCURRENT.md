# User Guide: Concurrent Processing Feature

## Overview

The Philippine Location Parser now supports **concurrent processing** - you can run location extraction, sentiment classification, and category classification simultaneously without waiting for one to finish before starting another.

## Key Benefits

- 🚀 **Save Time**: Process multiple data types at once
- 🔄 **Better Workflow**: Start new analyses while others are running
- 📊 **Independent Results**: Each mode maintains its own results and statistics
- 💾 **Separate Downloads**: Download results for each mode independently

## How to Use Concurrent Processing

### Step 1: Prepare Your Data

1. Enter your text data in the input area (one item per line)
2. Or upload a CSV/Excel file with your data
3. Configure your OpenAI API key (required for processing)

### Step 2: Configure Each Mode

#### Location Extraction
- No additional configuration needed
- Ready to process Philippine locations

#### Sentiment Classification
1. Click the "Sentiment Classification" tab
2. Enter the **Entity** (e.g., "PLDT Home", "Globe Telecom")
3. Enter **Sentiment Labels** (e.g., "Positive, Neutral, Negative")
4. Optional: Add a description for context

#### Category Classification
1. Click the "Category Classification" tab
2. Enter **Categories** (e.g., "Billing Issue, Technical Support, Network Problem")
3. Optional: Add a description for context

### Step 3: Start Processing

1. Configure your first mode (e.g., Location)
2. Click "Extract from Text" or "Process Google Sheet"
3. **Immediately switch to another tab** while it's processing
4. Configure the second mode (e.g., Sentiment)
5. Click "Extract from Text" with the same or different data
6. Continue for the third mode if needed

### Step 4: Monitor Progress

- Each tab shows its own progress bar and status
- Processing time is displayed for each active mode
- Status badges show: "Processing", "Completed", "Active", or "Inactive"

### Step 5: Review and Download Results

1. Click each tab to review its specific results
2. Use the "Download Results" button in each tab
3. Results are downloaded as mode-specific CSV files:
   - `location-extraction-results-[timestamp].csv`
   - `sentiment-classification-results-[timestamp].csv`
   - `category-classification-results-[timestamp].csv`

## Visual Indicators

### Status Badges
- 🟡 **Processing**: Currently analyzing data
- 🟢 **Completed**: Finished successfully
- 🔵 **Active**: Ready to process or has results
- ⚪ **Inactive**: Not yet used

### Progress Bars
- Each mode has its own progress bar
- Shows real-time progress updates
- Displays estimated remaining time

### Processing Time
- Shows elapsed time during processing
- Displays total time when completed

## Tips for Best Experience

### Data Management
- **Same Data**: Use the same text input across all modes for comprehensive analysis
- **Different Data**: Use different datasets for each mode if needed
- **Large Datasets**: Consider processing in smaller batches for better performance

### Performance Tips
- **API Limits**: Be mindful of your OpenAI API rate limits
- **Browser Resources**: Don't run more than 3-4 concurrent sessions
- **Network**: Stable internet connection is recommended for concurrent processing

### Workflow Recommendations
1. **Start with Location**: Usually the fastest, gives you immediate feedback
2. **Add Sentiment**: While location is running, configure sentiment
3. **Finish with Category**: Often takes the most time due to complex categorization

## Troubleshooting

### Common Issues

**"Processing seems stuck"**
- Check your internet connection
- Verify API key is valid
- Try refreshing the page (results are preserved)

**"Error occurred in one mode"**
- Other modes continue processing independently
- Check the error message in the affected tab
- Fix the configuration and retry that specific mode

**"Results not showing"**
- Make sure processing completed (check status badge)
- Try switching to another tab and back
- Results are stored independently per mode

### Getting Help

1. Check the browser console for error messages
2. Verify your API key has sufficient credits
3. Ensure the server is running (for local installations)
4. Contact support with specific error details

## Technical Details

### Session Management
- Each processing session gets a unique ID
- Sessions are tracked independently
- No interference between different modes

### Data Storage
- Results are stored in browser memory
- Each mode maintains separate result sets
- Clear individual modes without affecting others

### API Usage
- Each mode makes separate API calls
- Concurrent processing may increase API usage
- Monitor your OpenAI API consumption

## Example Use Cases

### Customer Feedback Analysis
1. **Location**: Identify where customers are located
2. **Sentiment**: Gauge customer satisfaction
3. **Category**: Classify complaint types

### Social Media Monitoring
1. **Location**: Track geographic mentions
2. **Sentiment**: Measure public opinion
3. **Category**: Organize content by topic

### Survey Data Processing
1. **Location**: Analyze geographic distribution
2. **Sentiment**: Understand respondent feelings
3. **Category**: Group responses by theme

## Keyboard Shortcuts

- **Tab**: Switch between modes
- **Ctrl+Enter**: Start processing (when in input field)
- **Esc**: Cancel current processing (if supported)

## Future Enhancements

Planned improvements to concurrent processing:
- Drag-and-drop reordering of tabs
- Batch processing across multiple modes
- Combined result views
- Advanced filtering and search across modes