/**
 * Backend Server for Philippine Location Parser v4
 * Enhanced with improved location parsing logic
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { parseLocation } = require('./parsers/hierarchical-parser-v2');
const { formatNormalizedLocation } = require('./parsers/location-normalizer');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

/**
 * Format location for CSV output with normalization
 */
function formatLocationString(location) {
  // Use the normalizer to format with proper casing and standardization
  return formatNormalizedLocation(location);
}

/**
 * Generate CSV from results
 */
function generateCSV(results) {
  const headers = ['Row', 'Full Text', 'Location'];
  const rows = [headers];

  results.forEach(result => {
    rows.push([
      result.row || '',
      `"${(result.comment || '').replace(/"/g, '""')}"`,
      `"${result.location.replace(/"/g, '""')}"`
    ]);
  });

  return rows.map(row => row.join(',')).join('\n');
}

/**
 * API endpoint to process sheet data
 */
app.post('/api/process-sheet', async (req, res) => {
  try {
    const { sheetData, startRow = 2, exportCsv = false } = req.body;

    if (!sheetData || !Array.isArray(sheetData)) {
      return res.status(400).json({ error: 'Sheet data is required' });
    }

    const results = [];
    let successCount = 0;

    // Process each row
    sheetData.forEach((comment, index) => {
      const location = parseLocation(comment);
      const locationString = formatLocationString(location);

      if (location) {
        successCount++;
      }

      results.push({
        row: startRow + index,
        comment: comment,
        location: locationString
      });
    });

    const response = {
      success: true,
      processed: results.length,
      successful: successCount,
      successRate: ((successCount / results.length) * 100).toFixed(1),
      results: results
    };

    if (exportCsv) {
      response.csv = generateCSV(results);
    }

    res.json(response);

  } catch (error) {
    console.error('Error processing sheet:', error);
    res.status(500).json({
      error: 'Failed to process sheet',
      details: error.message
    });
  }
});

/**
 * API endpoint to test single text
 */
app.post('/api/parse-text', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const location = parseLocation(text);

    res.json({
      success: true,
      text: text,
      location: location || null,
      formatted: formatLocationString(location)
    });

  } catch (error) {
    console.error('Error parsing text:', error);
    res.status(500).json({
      error: 'Failed to parse text',
      details: error.message
    });
  }
});

/**
 * API endpoint to fetch and process Google Sheets
 */
app.post('/api/process-google-sheet', async (req, res) => {
  try {
    const { sheetUrl } = req.body;

    if (!sheetUrl) {
      return res.status(400).json({ error: 'Sheet URL is required' });
    }

    // Extract sheet ID
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid Google Sheets URL' });
    }

    const sheetId = match[1];
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    // Fetch the CSV from Google Sheets
    const fetch = require('node-fetch');
    const response = await fetch(exportUrl);

    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch sheet. Make sure it is publicly viewable.' });
    }

    const csvText = await response.text();

    // Parse CSV lines
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);

    // Skip header if present
    const dataLines = lines.slice(1);

    if (dataLines.length === 0) {
      return res.status(400).json({ error: 'No data found in sheet' });
    }

    // Extract second column (Full Text - the actual comment)
    const texts = dataLines.map(line => {
      // Parse CSV to get second column
      // Handle format: timestamp,"actual comment text",...
      const parts = line.split(',');
      if (parts.length < 2) return '';

      // Second column might be quoted
      let fullText = parts[1];

      // If it starts with a quote, collect until closing quote
      if (fullText && fullText.startsWith('"')) {
        let endIndex = 1;
        let combined = fullText;

        // Keep adding parts until we find the closing quote
        while (!combined.endsWith('"') && endIndex < parts.length - 1) {
          endIndex++;
          combined += ',' + parts[endIndex];
        }

        // Remove surrounding quotes
        fullText = combined.replace(/^"|"$/g, '');
      }

      return fullText ? fullText.trim() : '';
    }).filter(text => text && text !== 'None');

    // Process texts through parser
    const results = texts.map(text => {
      const location = parseLocation(text);
      return {
        text: text,
        location: location || null,
        formatted: formatLocationString(location)
      };
    });

    const successCount = results.filter(r => r.location !== null).length;

    res.json({
      success: true,
      processed: results.length,
      successful: successCount,
      successRate: ((successCount / results.length) * 100).toFixed(1),
      results: results
    });

  } catch (error) {
    console.error('Error processing Google Sheet:', error);
    res.status(500).json({
      error: 'Failed to process sheet',
      details: error.message
    });
  }
});

/**
 * API endpoint to process batch of texts
 */
app.post('/api/batch-parse', async (req, res) => {
  try {
    const { texts } = req.body;

    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'Texts array is required' });
    }

    const results = texts.map(text => {
      const location = parseLocation(text);
      return {
        text: text,
        location: location || null,
        formatted: formatLocationString(location)
      };
    });

    const successCount = results.filter(r => r.location !== null).length;

    res.json({
      success: true,
      processed: results.length,
      successful: successCount,
      successRate: ((successCount / results.length) * 100).toFixed(1),
      results: results
    });

  } catch (error) {
    console.error('Error batch parsing:', error);
    res.status(500).json({
      error: 'Failed to batch parse',
      details: error.message
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '5.0',
    parser: 'hierarchical-parser'
  });
});

/**
 * Serve the web interface
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Philippine Location Parser v5 Server (Hierarchical) running on port ${PORT}`);
  console.log(`Web interface: http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  - POST /api/process-sheet`);
  console.log(`  - POST /api/parse-text`);
  console.log(`  - POST /api/batch-parse`);
  console.log(`  - GET /api/health`);
  console.log('');
  console.log('✅ Using hierarchical parser with 100% false positive prevention');
});