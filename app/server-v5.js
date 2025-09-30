/**
 * Backend Server for Philippine Location Parser v5
 * LLM-First System: Direct extraction with GPT-4o-mini
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
// Use simplified exports for structure only
const {
  createEmptyLocation,
  normalizeLocationFields,
  hasLocationData
} = require('./parsers/location-parser-v5');

console.log('Using Location Parser v5 with LLM-First extraction');
const LLMExtractor = require('./utils/llm-extractor');
const { formatNormalizedLocation } = require('./parsers/location-normalizer');
const { extractFromCSV } = require('./utils/sheet-parser');
const { preprocessText, getContextAnalysis } = require('./utils/context-detector');
const { processBatch, estimateProcessingTime } = require('./utils/batch-processor');
const { getCacheInstance } = require('./utils/cache-manager');

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize LLM extractor (set OPENAI_API_KEY in environment)
const llmExtractor = new LLMExtractor(process.env.OPENAI_API_KEY);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Initialize cache
const cache = getCacheInstance({
  maxSize: 5000,      // Store up to 5000 results
  ttl: 86400000       // 24 hours TTL
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

/**
 * Format location for output
 */
function formatLocationString(location) {
  // Use the normalizer to format with proper casing and standardization
  return formatNormalizedLocation(location);
}

/**
 * Process text with LLM-first extraction
 */
async function processLLMFirst(text, useLLM = true) {
  // Check cache first
  const cacheKey = cache.generateKey(text, { useLLM });
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    console.log('💾 Cache hit!');
    return { ...cachedResult, cached: true };
  }

  // Early exit for obvious non-locations
  if (!text || text.trim().length < 5) {
    const result = {
      text,
      location: createEmptyLocation(),
      formatted: formatLocationString(null),
      confidence: 95,
      method: 'early_exit',
      reasoning: 'Text too short to contain location'
    };
    cache.set(cacheKey, result);
    return result;
  }

  // Skip processing for @mention-only texts
  const trimmedText = text.trim();
  if (/^@\w+(\s+@\w+)*$/.test(trimmedText)) {
    const result = {
      text,
      location: createEmptyLocation(),
      formatted: formatLocationString(null),
      confidence: 95,
      method: 'early_exit',
      reasoning: 'Only contains @mentions'
    };
    cache.set(cacheKey, result);
    return result;
  }

  // If LLM is disabled, return empty location
  if (!useLLM || !llmExtractor.enabled) {
    return {
      text,
      location: createEmptyLocation(),
      formatted: formatLocationString(null),
      confidence: 0,
      method: 'llm_disabled',
      reasoning: 'LLM extraction is disabled'
    };
  }

  // LLM-First Extraction - Send directly to GPT-4o-mini
  console.log('🤖 LLM-First Extraction with GPT-4o-mini...');
  try {
    const llmResult = await llmExtractor.extractLocation(text);

    // Process the LLM result
    if (llmResult.hasLocation && llmResult.location) {
      // Normalize the location fields
      const normalizedLocation = normalizeLocationFields(llmResult.location);

      const result = {
        text,
        location: normalizedLocation,
        formatted: formatLocationString(normalizedLocation),
        confidence: llmResult.confidence,
        method: llmResult.method || 'llm_extracted',
        reasoning: llmResult.reasoning,
        pass: 'LLM-First'
      };

      // Cache the result
      cache.set(cacheKey, result);
      return result;
    }

    // No location found by LLM
    const result = {
      text,
      location: createEmptyLocation(),
      formatted: formatLocationString(null),
      confidence: llmResult.confidence || 90,
      method: llmResult.method || 'llm_no_location',
      reasoning: llmResult.reasoning || 'No location identified',
      pass: 'LLM-First'
    };

    // Cache the result
    cache.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error('LLM extraction error:', error);

    // Return empty location on error
    const result = {
      text,
      location: createEmptyLocation(),
      formatted: formatLocationString(null),
      confidence: 0,
      method: 'error',
      error: error.message,
      reasoning: 'LLM extraction failed',
      pass: 'Error'
    };

    cache.set(cacheKey, result);
    return result;
  }
}

/**
 * API endpoint to process batch of texts
 */
app.post('/api/batch-parse', async (req, res) => {
  try {
    const { texts, useLLM = true, parallel = true, batchSize = 5, sessionId } = req.body;

    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'Texts array is required' });
    }

    console.log(`\n📊 Processing ${texts.length} texts...`);
    console.log('═'.repeat(50));

    // Estimate processing time
    const estimate = estimateProcessingTime(texts, useLLM);
    console.log(`⏱️ Estimated time: ${estimate.estimatedSeconds}s (${estimate.llmCalls} LLM calls)`);

    // Send initial progress update if sessionId provided
    if (sessionId) {
      sendProgressUpdate(sessionId, {
        type: 'started',
        total: texts.length,
        estimatedTime: estimate.estimatedSeconds
      });
    }

    let results;
    let startTime = Date.now();

    if (parallel && texts.length > 1) {
      // Use parallel batch processing
      console.log(`🚀 Using parallel processing (batch size: ${batchSize})`);

      results = await processBatch(texts, processLLMFirst, {
        batchSize,
        useLLM,
        onProgress: (progress) => {
          // Send real-time progress updates via SSE if sessionId provided
          if (sessionId) {
            const elapsed = Date.now() - startTime;
            const avgTimePerItem = elapsed / progress.current;
            const remainingItems = progress.total - progress.current;
            const estimatedRemaining = Math.round((remainingItems * avgTimePerItem) / 1000);

            sendProgressUpdate(sessionId, {
              type: 'progress',
              current: progress.current,
              total: progress.total,
              percentage: progress.percentage,
              estimatedRemaining,
              currentText: progress.result?.text?.substring(0, 50) + '...',
              hasLocation: progress.result?.location && hasLocationData(progress.result.location)
            });
          }

          if (progress.current % 10 === 0) {
            console.log(`  Progress: ${progress.percentage}% (${progress.current}/${progress.total})`);
          }
        }
      });
    } else {
      // Fallback to sequential processing for single items or if parallel disabled
      console.log(`📝 Using sequential processing`);
      results = [];

      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        console.log(`\n[${i + 1}/${texts.length}] Processing: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

        // Send progress update if sessionId provided
        if (sessionId) {
          const elapsed = Date.now() - startTime;
          const avgTimePerItem = i > 0 ? elapsed / i : 1000;
          const remainingItems = texts.length - i;
          const estimatedRemaining = Math.round((remainingItems * avgTimePerItem) / 1000);

          sendProgressUpdate(sessionId, {
            type: 'progress',
            current: i,
            total: texts.length,
            percentage: Math.round((i / texts.length) * 100),
            estimatedRemaining,
            currentText: text.substring(0, 50) + '...',
            hasLocation: false
          });
        }

        const result = await processLLMFirst(text, useLLM);
        results.push(result);
      }
    }

    // Count successes
    let successCount = 0;
    results.forEach(result => {
      if (hasLocationData(result.location)) {
        successCount++;
      }
    });

    const processingTime = Date.now() - startTime;
    const avgTime = Math.round(processingTime / texts.length);

    console.log('\n═'.repeat(50));
    console.log(`✨ Processing complete: ${successCount}/${texts.length} with locations`);
    console.log(`⏱️ Total time: ${processingTime}ms (avg: ${avgTime}ms/item)`);
    if (parallel) {
      const sequentialEstimate = texts.length * avgTime;
      const speedup = (sequentialEstimate / processingTime).toFixed(1);
      console.log(`🚀 Speedup: ${speedup}x faster than sequential`);
    }

    // Send completion notification if sessionId provided
    if (sessionId) {
      sendProgressUpdate(sessionId, {
        type: 'completed',
        total: texts.length,
        successful: successCount,
        successRate: ((successCount / results.length) * 100).toFixed(1),
        totalTime: processingTime
      });
    }

    res.json({
      success: true,
      processed: results.length,
      successful: successCount,
      successRate: ((successCount / results.length) * 100).toFixed(1),
      llmEnabled: llmExtractor.enabled,
      processingTime,
      averageTime: avgTime,
      parallel,
      results
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
 * API endpoint to test single text
 */
app.post('/api/parse-text', async (req, res) => {
  try {
    const { text, useLLM = true } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await processLLMFirst(text, useLLM);

    res.json({
      success: true,
      ...result
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
 * SSE endpoint for real-time progress updates
 */
app.get('/api/progress-stream/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Store the response object for sending updates
  if (!global.progressStreams) {
    global.progressStreams = {};
  }
  global.progressStreams[sessionId] = res;

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

  // Clean up on client disconnect
  req.on('close', () => {
    delete global.progressStreams[sessionId];
  });
});

/**
 * Send progress update to SSE stream
 */
function sendProgressUpdate(sessionId, data) {
  const stream = global.progressStreams?.[sessionId];
  if (stream && !stream.finished) {
    try {
      stream.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      // Stream might be closed
      delete global.progressStreams[sessionId];
    }
  }
}

/**
 * API endpoint to detect Google Sheets tabs
 */
app.post('/api/detect-google-sheets', async (req, res) => {
  try {
    const { sheetId } = req.body;

    if (!sheetId) {
      return res.status(400).json({ error: 'Sheet ID is required' });
    }

    const sheetDetector = require('./utils/sheet-detector');
    const sheets = await sheetDetector.detectGoogleSheets(sheetId);

    res.json({ sheets });
  } catch (error) {
    console.error('Error detecting sheets:', error);
    res.status(500).json({ error: 'Failed to detect sheets' });
  }
});

/**
 * API endpoint to detect Excel sheets
 */
app.post('/api/detect-excel-sheets', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sheetDetector = require('./utils/sheet-detector');
    const sheets = sheetDetector.detectExcelSheets(req.file.buffer);

    res.json({ sheets });
  } catch (error) {
    console.error('Error detecting Excel sheets:', error);
    res.status(500).json({ error: 'Failed to detect sheets' });
  }
});

/**
 * API endpoint to upload and process Excel file
 */
app.post('/api/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { sheetIndex = 0, columnRange = '' } = req.body;
    const sheetDetector = require('./utils/sheet-detector');
    const sheetParser = require('./utils/sheet-parser');

    // Parse column range
    const range = sheetParser.parseColumnRange(columnRange);

    // Extract data from Excel
    const texts = sheetDetector.extractFromExcel(
      req.file.buffer,
      parseInt(sheetIndex),
      range
    );

    res.json({ texts });
  } catch (error) {
    console.error('Error processing Excel file:', error);
    res.status(500).json({ error: 'Failed to process Excel file' });
  }
});

/**
 * API endpoint to process Google Sheets
 */
app.post('/api/process-google-sheet', async (req, res) => {
  try {
    const { sheetUrl, columnRange, useLLM = true, sessionId = Date.now().toString(), sheetGid } = req.body;

    if (!sheetUrl) {
      return res.status(400).json({ error: 'Sheet URL is required' });
    }

    // Extract sheet ID
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid Google Sheets URL' });
    }

    const sheetId = match[1];

    // Build export URL with optional sheet gid
    let exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    if (sheetGid) {
      exportUrl += `&gid=${sheetGid}`;
    }

    // Fetch the CSV from Google Sheets
    const fetch = require('node-fetch');

    let response;
    try {
      response = await fetch(exportUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LocationParser/1.0)'
        },
        timeout: 30000 // 30 second timeout
      });
    } catch (error) {
      console.error('Fetch error:', error);
      return res.status(500).json({
        error: 'Failed to fetch sheet',
        details: error.message
      });
    }

    if (!response.ok) {
      return res.status(400).json({
        error: 'Failed to fetch sheet. Make sure it is publicly viewable.',
        status: response.status
      });
    }

    const csvText = await response.text();

    // Use the sheet parser to extract data based on column range
    const texts = extractFromCSV(csvText, columnRange || 'B:B');

    if (texts.length === 0) {
      return res.status(400).json({
        error: 'No data found in the specified column range',
        details: `Column range: ${columnRange || 'B (default)'}`
      });
    }

    console.log(`\n📊 Extracted ${texts.length} texts from column range: ${columnRange || 'B (default)'}`);

    // Estimate processing time
    const estimate = estimateProcessingTime(texts, useLLM);
    console.log(`⏱️ Estimated time: ${estimate.estimatedSeconds}s`);

    // Send initial progress update
    sendProgressUpdate(sessionId, {
      type: 'started',
      total: texts.length,
      estimatedTime: estimate.estimatedSeconds
    });

    // Process texts through parallel batch system
    console.log(`\n📊 Processing Google Sheet with ${texts.length} rows...`);
    console.log('═'.repeat(50));

    const startTime = Date.now();

    // Determine optimal batch size based on dataset size
    let batchSize = 10; // Default for medium datasets
    if (texts.length > 200) {
      batchSize = 15; // Larger batch for big datasets
    } else if (texts.length < 50) {
      batchSize = 5; // Smaller batch for small datasets
    }

    // Use parallel processing for better performance
    const results = await processBatch(texts, processLLMFirst, {
      batchSize,
      useLLM,
      onProgress: (progress) => {
        // Send real-time progress updates via SSE
        const elapsed = Date.now() - startTime;
        const avgTimePerItem = elapsed / progress.current;
        const remainingItems = progress.total - progress.current;
        const estimatedRemaining = Math.round((remainingItems * avgTimePerItem) / 1000);

        sendProgressUpdate(sessionId, {
          type: 'progress',
          current: progress.current,
          total: progress.total,
          percentage: progress.percentage,
          estimatedRemaining,
          currentText: progress.result?.text?.substring(0, 50) + '...',
          hasLocation: progress.result?.location && hasLocationData(progress.result.location)
        });

        if (progress.current % 10 === 0 || progress.current === texts.length) {
          console.log(`  Progress: ${progress.percentage}% (${progress.current}/${progress.total})`);
        }
      }
    });

    // Count successes
    let successCount = 0;
    results.forEach(result => {
      if (hasLocationData(result.location)) {
        successCount++;
      }
    });

    const processingTime = Date.now() - startTime;
    const avgTime = Math.round(processingTime / texts.length);

    console.log('\n═'.repeat(50));
    console.log(`✨ Sheet processing complete: ${successCount}/${texts.length} with locations`);
    console.log(`⏱️ Total time: ${processingTime}ms (avg: ${avgTime}ms/item)`);

    // Send completion notification
    sendProgressUpdate(sessionId, {
      type: 'completed',
      total: texts.length,
      successful: successCount,
      successRate: ((successCount / results.length) * 100).toFixed(1),
      totalTime: processingTime
    });

    res.json({
      success: true,
      processed: results.length,
      successful: successCount,
      successRate: ((successCount / results.length) * 100).toFixed(1),
      llmEnabled: llmExtractor.enabled,
      processingTime,
      averageTime: avgTime,
      results
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
 * API endpoint to validate extracted locations
 */
app.post('/api/validate', async (req, res) => {
  try {
    const { text, location } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (!llmExtractor.enabled) {
      return res.status(400).json({
        error: 'LLM validation not available',
        details: 'OpenAI API key not configured'
      });
    }

    const validation = await llmExtractor.validateLocation(text, location);

    res.json({
      success: true,
      validation
    });

  } catch (error) {
    console.error('Error validating:', error);
    res.status(500).json({
      error: 'Failed to validate',
      details: error.message
    });
  }
});

/**
 * API endpoint to get system status
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    version: '5.0',
    parser: 'location-parser-v5',
    features: {
      conservativeExtraction: true,
      llmValidation: llmExtractor.enabled,
      twoPassSystem: true,
      blacklistEnabled: true
    },
    cache: llmExtractor.getCacheStats()
  });
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '5.0',
    llmEnabled: llmExtractor.enabled
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
  console.log(`Philippine Location Parser v5 Server running on port ${PORT}`);
  console.log(`Web interface: http://localhost:${PORT}`);
  console.log(`Features:`);
  console.log(`  - LLM-First extraction system`);
  console.log(`  - GPT-4o-mini: ${llmExtractor.enabled ? 'ENABLED' : 'DISABLED (set OPENAI_API_KEY)'}`);
  console.log(`  - Direct location extraction with cascading inference`);
  console.log(`API endpoints:`);
  console.log(`  - POST /api/batch-parse`);
  console.log(`  - POST /api/parse-text`);
  console.log(`  - POST /api/process-google-sheet`);
  console.log(`  - POST /api/validate`);
  console.log(`  - GET /api/status`);
});