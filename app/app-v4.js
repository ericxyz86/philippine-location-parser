/**
 * Philippine Location Parser v4 - Web Application
 * Enhanced UI with extraction statistics
 */

let currentResults = [];
let csvData = null;
let uploadedExcelFile = null; // Store uploaded Excel file

// API Key Storage Key
const API_KEY_STORAGE_KEY = 'location_parser_openai_key';

/**
 * Load API key from localStorage on page load
 */
function loadApiKey() {
    try {
        const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
        if (savedKey) {
            document.getElementById('apiKeyInput').value = savedKey;
            document.getElementById('apiKeyStatus').style.display = 'block';
            console.log('✓ API key loaded from browser storage');
        }
    } catch (error) {
        console.warn('Could not load API key from storage:', error);
    }
}

/**
 * Save API key to localStorage
 */
function saveApiKey() {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showError('Please enter an API key first');
        return;
    }

    // Validate API key format
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
        showError('Invalid API key format. OpenAI API keys start with "sk-" and are longer than 20 characters.');
        return;
    }

    try {
        localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
        document.getElementById('apiKeyStatus').style.display = 'block';
        showSuccess('✓ API key saved to browser storage');
    } catch (error) {
        showError('Failed to save API key: ' + error.message);
    }
}

/**
 * Clear API key from localStorage and input
 */
function clearApiKey() {
    try {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
        document.getElementById('apiKeyInput').value = '';
        document.getElementById('apiKeyStatus').style.display = 'none';
        showSuccess('✓ API key cleared from browser storage');
    } catch (error) {
        showError('Failed to clear API key: ' + error.message);
    }
}

/**
 * Get API key (from input or localStorage)
 */
function getApiKey() {
    const inputKey = document.getElementById('apiKeyInput').value.trim();
    if (inputKey) return inputKey;

    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    return savedKey || null;
}

/**
 * Validate that user has provided an API key before processing
 */
function requireApiKey() {
    const apiKey = getApiKey();

    if (!apiKey) {
        showError('⚠️ OpenAI API Key Required: Please enter your API key to use location extraction.');
        return false;
    }

    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
        showError('⚠️ Invalid API Key Format: OpenAI keys start with "sk-" and are longer than 20 characters.');
        return false;
    }

    return true;
}

/**
 * Toggle API key visibility (show/hide password)
 */
function toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const eyeIcon = document.getElementById('eyeIcon');

    if (apiKeyInput.type === 'password') {
        // Show password
        apiKeyInput.type = 'text';
        // Change to "eye-off" icon
        eyeIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    } else {
        // Hide password
        apiKeyInput.type = 'password';
        // Change back to "eye" icon
        eyeIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
}

/**
 * Detect sheets when Google Sheets URL is entered
 */
async function detectGoogleSheets() {
    const sheetUrl = document.getElementById('sheetUrl').value;
    if (!sheetUrl) return;

    const sheetSelectorContainer = document.getElementById('sheetSelectorContainer');
    const sheetSelector = document.getElementById('sheetSelector');

    // Extract sheet ID from URL
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
        sheetSelectorContainer.style.display = 'none';
        return;
    }

    const sheetId = match[1];

    try {
        // Call API to detect sheets
        const response = await fetch('/api/detect-google-sheets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sheetId })
        });

        if (response.ok) {
            const { sheets } = await response.json();

            if (sheets && sheets.length > 0) {
                // Clear existing options and add new ones
                sheetSelector.innerHTML = '';

                sheets.forEach((sheet, index) => {
                    const option = document.createElement('option');
                    option.value = sheet.gid || index;
                    option.textContent = `${sheet.name} ${index === 0 ? '(default)' : ''}`;
                    sheetSelector.appendChild(option);
                });

                sheetSelectorContainer.style.display = 'block';
            } else {
                sheetSelectorContainer.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error detecting sheets:', error);
        sheetSelectorContainer.style.display = 'none';
    }
}

// Add event listener for Google Sheets URL input
document.addEventListener('DOMContentLoaded', function() {
    // Load API key on page load
    loadApiKey();

    const sheetUrlInput = document.getElementById('sheetUrl');
    if (sheetUrlInput) {
        // Detect sheets when URL is entered or pasted
        sheetUrlInput.addEventListener('input', debounce(detectGoogleSheets, 1000));
        sheetUrlInput.addEventListener('paste', () => {
            setTimeout(detectGoogleSheets, 100);
        });
    }
});

// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Process Google Sheets data
 */
async function processSheet() {
    // Check API key first
    if (!requireApiKey()) {
        return;
    }

    const sheetUrl = document.getElementById('sheetUrl').value.trim();
    const columnRange = document.getElementById('columnRange').value.trim();

    if (!sheetUrl) {
        showError('Please enter a Google Sheets URL');
        return;
    }

    // Extract sheet ID from URL
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
        showError('Invalid Google Sheets URL format');
        return;
    }

    const sheetId = match[1];
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    // Generate session ID for tracking progress
    const sessionId = Date.now().toString();

    // Show status
    showStatus();
    updateStatus('Fetching Google Sheet data...', 10);

    // Disable button
    document.getElementById('processSheetBtn').disabled = true;

    // Set up SSE connection for real-time progress updates
    let eventSource = null;
    try {
        eventSource = new EventSource(`/api/progress-stream/${sessionId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'progress') {
                const progress = data.percentage || 0;
                const message = data.currentText ?
                    `Processing: ${data.currentText}` :
                    'Processing location data...';

                updateStatus(message, progress, {
                    current: data.current,
                    total: data.total,
                    estimatedRemaining: data.estimatedRemaining
                });
            } else if (data.type === 'completed') {
                updateStatus('Processing complete!', 100);
                if (eventSource) {
                    eventSource.close();
                }
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            if (eventSource) {
                eventSource.close();
            }
        };
    } catch (error) {
        console.warn('SSE not supported or failed, falling back to basic progress');
    }

    try {
        // Get selected sheet if available
        const sheetSelectorContainer = document.getElementById('sheetSelectorContainer');
        const sheetSelector = document.getElementById('sheetSelector');
        let selectedSheet = null;

        if (sheetSelectorContainer.style.display !== 'none' && sheetSelector.value) {
            selectedSheet = sheetSelector.value;
        }

        // Call the server API to process the sheet
        const apiResponse = await fetch('/api/process-google-sheet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sheetUrl: sheetUrl,
                columnRange: columnRange || 'B:B', // Default to column B if not specified
                sessionId: sessionId,
                useLLM: true,
                sheetGid: selectedSheet, // Add selected sheet gid
                apiKey: getApiKey() // Include user's API key
            })
        });

        if (!apiResponse.ok) {
            throw new Error('Failed to process data');
        }

        const data = await apiResponse.json();

        // Update progress
        updateStatus('Processing complete!', 100);

        // Process and display results
        displayResults(data.results);

        // Update statistics
        updateStatistics(data);

        // Generate CSV
        csvData = generateCSVFromResults(data.results);

        // Show download button
        document.getElementById('downloadGroup').style.display = 'block';

        // Close SSE connection if open
        if (eventSource) {
            eventSource.close();
        }

    } catch (error) {
        showError('Error: ' + error.message);
        console.error(error);

        // Close SSE connection on error
        if (eventSource) {
            eventSource.close();
        }
    } finally {
        document.getElementById('processSheetBtn').disabled = false;
    }
}

/**
 * Process text input
 */
async function processText() {
    // Check API key first
    if (!requireApiKey()) {
        return;
    }

    const textInput = document.getElementById('textInput').value.trim();

    if (!textInput) {
        showError('Please enter some text to process');
        return;
    }

    // Split by lines and filter empty
    const lines = textInput.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
        showError('Please enter valid text');
        return;
    }

    // Generate session ID for tracking progress
    const sessionId = Date.now().toString();

    // Show status
    showStatus();
    updateStatus('Initializing processing...', 5);

    // Disable button
    document.getElementById('processBtn').disabled = true;

    // Set up SSE connection for real-time progress updates
    let eventSource = null;
    try {
        eventSource = new EventSource(`/api/progress-stream/${sessionId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'progress') {
                const progress = data.percentage || 0;
                const message = data.currentText ?
                    `Processing: ${data.currentText}` :
                    'Processing location data...';

                updateStatus(message, progress, {
                    current: data.current,
                    total: data.total,
                    estimatedRemaining: data.estimatedRemaining
                });
            } else if (data.type === 'completed') {
                updateStatus('Processing complete!', 100);
                if (eventSource) {
                    eventSource.close();
                }
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            if (eventSource) {
                eventSource.close();
            }
        };

        // Call the API with sessionId for progress tracking
        const response = await fetch('/api/batch-parse', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                texts: lines,
                useLLM: true,
                sessionId: sessionId,  // Include sessionId for progress tracking
                apiKey: getApiKey() // Include user's API key
            })
        });

        if (!response.ok) {
            throw new Error('Failed to process text');
        }

        const data = await response.json();

        // Update progress
        updateStatus('✅ Processing complete!', 100);

        // Process and display results
        displayResults(data.results);

        // Update statistics
        updateStatistics(data);

        // Generate CSV
        csvData = generateCSVFromResults(data.results);

        // Show download button
        document.getElementById('downloadGroup').style.display = 'block';

    } catch (error) {
        showError('Error: ' + error.message);
        console.error(error);
    } finally {
        document.getElementById('processBtn').disabled = false;
        if (eventSource) {
            eventSource.close();
        }
    }
}

/**
 * Display results in the UI
 */
function displayResults(results) {
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.innerHTML = '';
    resultsSection.classList.add('active');

    results.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'result-item';

        const hasLocation = hasLocationData(result.location);
        const locationClass = hasLocation ? 'location-found' : 'location-none';
        const locationDisplay = formatLocationDisplay(result);

        item.innerHTML = `
            <div class="result-row">Row ${index + 1}</div>
            <div class="result-text" title="${escapeHtml(result.text)}">${escapeHtml(result.text)}</div>
            <div class="result-location ${locationClass}">
                📍 ${locationDisplay}
            </div>
        `;

        resultsSection.appendChild(item);
    });

    currentResults = results;
}

/**
 * Update statistics panel
 */
function updateStatistics(data) {
    const statsPanel = document.getElementById('statsPanel');
    statsPanel.classList.add('active');

    // Total processed
    document.getElementById('totalProcessed').textContent = data.processed;

    // With locations
    const locationsFound = data.successful;
    document.getElementById('locationsFound').textContent = locationsFound;

    // Without locations
    document.getElementById('noLocation').textContent = data.processed - locationsFound;

    // Success rate
    const successRate = data.successRate || '0';
    document.getElementById('successRate').textContent = `${successRate}%`;

    // Style success rate based on value
    const rateElement = document.getElementById('successRate');
    const rate = parseFloat(successRate);
    if (rate >= 70) {
        rateElement.style.color = '#28a745';
    } else if (rate >= 40) {
        rateElement.style.color = '#ffc107';
    } else {
        rateElement.style.color = '#dc3545';
    }

    // Average confidence (if available)
    document.getElementById('avgConfidence').textContent = '-';
}

/**
 * Load sample data
 */
/**
 * Handle file upload for CSV and Excel
 */
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsv = fileName.endsWith('.csv');

    // Check file type
    if (!isCsv && !isExcel) {
        showError('Please upload a CSV or Excel file');
        return;
    }

    try {
        // Hide sheet selector and load button for CSV files
        const sheetSelectorContainer = document.getElementById('sheetSelectorContainer');
        const loadSheetBtn = document.getElementById('loadSheetBtn');

        if (isExcel) {
            // Store the Excel file
            uploadedExcelFile = file;

            // For Excel files, detect sheets
            const formData = new FormData();
            formData.append('file', file);

            const detectResponse = await fetch('/api/detect-excel-sheets', {
                method: 'POST',
                body: formData
            });

            if (detectResponse.ok) {
                const { sheets } = await detectResponse.json();

                if (sheets && sheets.length > 1) {
                    // Show sheet selector with options
                    const sheetSelector = document.getElementById('sheetSelector');
                    sheetSelector.innerHTML = '';

                    sheets.forEach((sheetName, index) => {
                        const option = document.createElement('option');
                        option.value = index;
                        option.textContent = `${sheetName} ${index === 0 ? '(default)' : ''}`;
                        sheetSelector.appendChild(option);
                    });

                    sheetSelectorContainer.style.display = 'block';
                    if (loadSheetBtn) loadSheetBtn.style.display = 'inline-block';

                    // Show info message
                    showSuccess(`Excel file loaded. ${sheets.length} sheets detected. Select a sheet and click "Load Selected Sheet" to proceed.`);
                } else {
                    // Single sheet - load automatically
                    sheetSelectorContainer.style.display = 'none';
                    if (loadSheetBtn) loadSheetBtn.style.display = 'none';
                    loadExcelSheet(0);
                }
            }
        } else {
            // Hide sheet selector and load button for CSV
            sheetSelectorContainer.style.display = 'none';
            if (loadSheetBtn) loadSheetBtn.style.display = 'none';
            uploadedExcelFile = null;

            // Original CSV handling
            const columnRange = document.getElementById('columnRange')?.value || '';
            const rangeInfo = parseColumnRangeForUpload(columnRange);

            // Read CSV file
            const text = await readFileAsText(file);
            const texts = parseCSVFile(text, rangeInfo.columnIndex, rangeInfo.startRow);

            if (texts.length === 0) {
                showError('No data found in the specified column');
                return;
            }

            // Put the texts into the text area
            document.getElementById('textInput').value = texts.join('\n');

            // Show success message with column info
            const columnLetter = String.fromCharCode(65 + rangeInfo.columnIndex);
            showSuccess(`Loaded ${texts.length} rows from column ${columnLetter} (starting row ${rangeInfo.startRow}) of ${file.name}`);
        }

    } catch (error) {
        console.error('File upload error:', error);
        showError('Failed to read file. Please ensure it is a valid CSV or Excel file.');
    }

    // Reset file input
    event.target.value = '';
}

/**
 * Load selected Excel sheet
 */
async function loadExcelSheet(sheetIndex = null) {
    if (!uploadedExcelFile) {
        showError('No Excel file uploaded');
        return;
    }

    try {
        // Use provided index or get from selector
        if (sheetIndex === null) {
            sheetIndex = document.getElementById('sheetSelector').value || 0;
        }

        const columnRange = document.getElementById('columnRange')?.value || '';

        const formData = new FormData();
        formData.append('file', uploadedExcelFile);
        formData.append('sheetIndex', sheetIndex);
        formData.append('columnRange', columnRange);

        const uploadResponse = await fetch('/api/upload-excel', {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            throw new Error('Failed to process Excel file');
        }

        const { texts } = await uploadResponse.json();

        if (texts.length === 0) {
            showError('No data found in the specified column');
            return;
        }

        // Put the texts into the text area
        document.getElementById('textInput').value = texts.join('\n');

        // Show success message
        const rangeInfo = parseColumnRangeForUpload(columnRange);
        const columnLetter = String.fromCharCode(65 + rangeInfo.columnIndex);
        const sheetName = document.getElementById('sheetSelector').options[sheetIndex]?.text || 'Sheet';
        showSuccess(`Loaded ${texts.length} rows from column ${columnLetter} of ${sheetName} in ${uploadedExcelFile.name}`);

    } catch (error) {
        console.error('Excel loading error:', error);
        showError('Failed to load Excel sheet. Please ensure it is a valid Excel file.');
    }
}

/**
 * Parse column range for upload (similar to parseColumnRange but for CSV upload)
 */
function parseColumnRangeForUpload(range) {
    // Default to B2 (column B starting from row 2)
    let columnIndex = 1; // B = index 1
    let startRow = 2;     // Start from row 2 (skip header)

    if (range && range.trim()) {
        const upperRange = range.toUpperCase().trim();

        // Match patterns like B, B2, B:B, B2:B100, C, C3, etc.
        const match = upperRange.match(/^([A-Z])(\d*)(?::([A-Z])?(\d*)?)?$/);

        if (match) {
            const columnLetter = match[1];
            const startRowStr = match[2];

            // Convert column letter to index (A=0, B=1, C=2, etc.)
            columnIndex = columnLetter.charCodeAt(0) - 65;

            // If a start row is specified, use it; otherwise default to 2
            if (startRowStr) {
                startRow = parseInt(startRowStr);
            } else {
                startRow = 2; // Default to row 2 if only column is specified
            }
        }
    }

    return {
        columnIndex,
        startRow
    };
}

/**
 * Read file as text
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

/**
 * Parse CSV file and extract texts from specified column
 */
function parseCSVFile(csvText, columnIndex = 1, startRow = 2) {
    const lines = csvText.split(/\r?\n/);
    const texts = [];

    // Start from specified row (adjusting for 0-based index)
    const startIndex = startRow - 1;

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parsing - split by comma, handling quoted values
        const columns = parseCSVLine(line);

        // Get specified column
        if (columns.length > columnIndex && columns[columnIndex]) {
            texts.push(columns[columnIndex]);
        }
    }

    return texts;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    // Add last field
    result.push(current);

    return result;
}

/**
 * Show success message
 */
function showSuccess(message) {
    // Remove any existing messages
    const existingError = document.querySelector('.error-message');
    const existingSuccess = document.querySelector('.success-message');
    if (existingError) existingError.remove();
    if (existingSuccess) existingSuccess.remove();

    // Create and show success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;

    const inputSection = document.querySelector('.input-section');
    inputSection.appendChild(successDiv);

    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 3000);
}

/**
 * Clear all inputs and results
 */
function clearAll() {
    document.getElementById('textInput').value = '';
    document.getElementById('resultsSection').innerHTML = '';
    document.getElementById('resultsSection').classList.remove('active');
    document.getElementById('statsPanel').classList.remove('active');
    document.getElementById('statusSection').classList.remove('active');
    document.getElementById('downloadGroup').style.display = 'none';

    // Clear sheet selector and Excel data
    const sheetSelectorContainer = document.getElementById('sheetSelectorContainer');
    const loadSheetBtn = document.getElementById('loadSheetBtn');
    const sheetUrl = document.getElementById('sheetUrl');
    const columnRange = document.getElementById('columnRange');

    if (sheetSelectorContainer) sheetSelectorContainer.style.display = 'none';
    if (loadSheetBtn) loadSheetBtn.style.display = 'none';
    if (sheetUrl) sheetUrl.value = '';
    if (columnRange) columnRange.value = '';

    currentResults = [];
    csvData = null;
    uploadedExcelFile = null;
}

/**
 * Generate CSV from results
 */
function generateCSVFromResults(results) {
    // Store results globally for different format exports
    currentResults = results;

    // Default to single column format
    return generateSingleColumnCSV(results);
}

/**
 * Clean special characters for CSV export
 */
function cleanForCSV(text) {
    if (!text) return text;

    // Remove or replace special characters
    const replacements = {
        'ñ': 'n', 'Ñ': 'N',
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
        'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U',
        'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ü': 'u',
        'Ä': 'A', 'Ë': 'E', 'Ï': 'I', 'Ö': 'O', 'Ü': 'U',
        '√±': 'n',  // Common encoding issue for ñ
        'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
        'Â': 'A', 'Ê': 'E', 'Î': 'I', 'Ô': 'O', 'Û': 'U'
    };

    let cleaned = text;
    for (const [char, replacement] of Object.entries(replacements)) {
        cleaned = cleaned.replace(new RegExp(char, 'g'), replacement);
    }

    return cleaned;
}

/**
 * Generate single column CSV (combined location)
 */
function generateSingleColumnCSV(results) {
    const headers = ['Row', 'Text', 'Location'];
    const rows = [headers];

    results.forEach((result, index) => {
        const locationString = cleanForCSV(formatLocationDisplay(result));

        rows.push([
            index + 1,
            `"${result.text.replace(/"/g, '""')}"`,
            `"${locationString.replace(/"/g, '""')}"`
        ]);
    });

    return rows.map(row => row.join(',')).join('\n');
}

/**
 * Generate multi-column CSV (separated location fields)
 */
function generateMultiColumnCSV(results) {
    const headers = ['Row', 'Text', 'Region', 'Province', 'City', 'Barangay'];
    const rows = [headers];

    results.forEach((result, index) => {
        const location = normalizeLocation(result.location);

        rows.push([
            index + 1,
            `"${result.text.replace(/"/g, '""')}"`,
            cleanForCSV(location.region),
            cleanForCSV(location.province),
            cleanForCSV(location.city),
            cleanForCSV(location.barangay)
        ]);
    });

    return rows.map(row => row.join(',')).join('\n');
}

/**
 * Download results as CSV
 */
function downloadCSV() {
    if (!currentResults || currentResults.length === 0) {
        showError('No data to download');
        return;
    }

    // Get selected export format
    const formatRadio = document.querySelector('input[name="exportFormat"]:checked');
    const format = formatRadio ? formatRadio.value : 'single';

    // Generate CSV based on selected format
    let csvContent;
    if (format === 'multiple') {
        csvContent = generateMultiColumnCSV(currentResults);
    } else {
        csvContent = generateSingleColumnCSV(currentResults);
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `location_extraction_${Date.now()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Show status section
 */
function showStatus() {
    const statusSection = document.getElementById('statusSection');
    statusSection.classList.add('active');
}

/**
 * Determine if any location field contains data.
 */
function hasLocationData(location) {
    const normalized = normalizeLocation(location);
    return Object.values(normalized).some(value => value !== 'None');
}

function normalizeLocation(location) {
    const defaults = {
        region: 'None',
        province: 'None',
        city: 'None',
        barangay: 'None'
    };

    if (!location || typeof location !== 'object') {
        return { ...defaults };
    }

    return {
        region: normalizeRegion(location.region),
        province: normalizeProvince(location.province),
        city: normalizeCity(location.city),
        barangay: normalizeBarangay(location.barangay)
    };
}

function normalizeProvince(province) {
    if (!province || typeof province !== 'string' || province === 'None' || province === '') {
        return 'None';
    }

    // Convert NCR districts to "Metro Manila"
    if (province.includes('NATIONAL CAPITAL REGION') || province.includes('NCR')) {
        return 'Metro Manila';
    }

    // Convert to proper case
    return toProperCase(province);
}

function normalizeCity(city) {
    if (!city || typeof city !== 'string' || city === 'None' || city === '') {
        return 'None';
    }

    // Remove "CITY OF" prefix
    let normalized = city.replace(/^CITY OF\s+/i, '').replace(/^MUNICIPALITY OF\s+/i, '');

    // Convert to proper case
    normalized = toProperCase(normalized);

    // Add "City" suffix for known Metro Manila cities
    const metroManilaCities = ['makati', 'manila', 'quezon', 'pasig', 'taguig',
        'mandaluyong', 'san juan', 'marikina', 'muntinlupa', 'parañaque',
        'las piñas', 'caloocan', 'malabon', 'navotas', 'valenzuela', 'pasay'];

    const normalizedLower = normalized.toLowerCase();
    if (metroManilaCities.includes(normalizedLower) && !normalized.endsWith(' City')) {
        normalized = normalized + ' City';
    }

    return normalized;
}

function normalizeBarangay(barangay) {
    if (!barangay || typeof barangay !== 'string' || barangay === 'None' || barangay === '') {
        return 'None';
    }

    // Handle Poblacion variants
    if (barangay.includes('POBLACION') || barangay.includes('(POB.)')) {
        return 'Poblacion';
    }

    // Convert to proper case
    return toProperCase(barangay);
}

function normalizeRegion(region) {
    if (!region || typeof region !== 'string' || region === 'None' || region === '') {
        return 'None';
    }

    // Special handling for NCR
    if (region.includes('National Capital Region')) {
        return 'National Capital Region (NCR)';
    }

    // Handle acronym regions
    const acronymRegions = ['CALABARZON', 'MIMAROPA', 'SOCCSKSARGEN', 'BARMM', 'CAR'];
    const regionUpper = region.toUpperCase();

    for (const acronym of acronymRegions) {
        if (regionUpper.includes(acronym)) {
            return acronym;
        }
    }

    // Convert to proper case
    return toProperCase(region);
}

function toProperCase(str) {
    if (!str) return str;

    return str.toLowerCase().split(' ').map((word, index) => {
        // Handle Roman numerals
        if (['ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'].includes(word)) {
            return word.toUpperCase();
        }

        // Keep certain words lowercase (except first word)
        if (index > 0 && ['de', 'del', 'la', 'las', 'los'].includes(word)) {
            return word;
        }

        // Capitalize first letter
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

function sanitizeField(value) {
    if (typeof value !== 'string') {
        return 'None';
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'none') {
        return 'None';
    }

    return trimmed;
}

function formatLocationDisplay(result) {
    if (result && typeof result.formatted === 'string' && result.formatted.trim()) {
        return result.formatted.trim();
    }

    const normalized = normalizeLocation(result ? result.location : null);
    return `Region: ${normalized.region}\nProvince: ${normalized.province}\nCity: ${normalized.city}\nBarangay: ${normalized.barangay}`;
}

/**
 * Update status message and progress
 */
function updateStatus(message, progress, details = {}) {
    const statusMessage = document.getElementById('statusMessage');
    const progressBar = document.getElementById('progressBar');
    const statusTitle = document.getElementById('statusTitle');
    const statusIcon = document.getElementById('statusIcon');

    // Update basic message and progress
    statusMessage.textContent = message;
    progressBar.style.width = progress + '%';

    // Add smooth transition
    progressBar.style.transition = 'width 0.3s ease';

    // Show detailed progress if available
    if (details.current && details.total) {
        const percentage = Math.round((details.current / details.total) * 100);

        // Update message with more details
        if (details.estimatedRemaining) {
            statusMessage.innerHTML = `${message}<br><small style="opacity:0.8">Processing ${details.current}/${details.total} items • ~${details.estimatedRemaining}s remaining</small>`;
        } else {
            statusMessage.innerHTML = `${message}<br><small style="opacity:0.8">Processing ${details.current}/${details.total} items</small>`;
        }

        // Update progress bar style to show it's actively moving
        progressBar.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
    }

    // Handle completion
    if (progress === 100) {
        statusIcon.classList.remove('spinner');
        statusIcon.innerHTML = '✅';
        statusTitle.textContent = 'Complete!';
        progressBar.style.background = '#28a745';
    }
}

/**
 * Show error message
 */
function showError(message) {
    const statusSection = document.getElementById('statusSection');
    statusSection.classList.add('active');
    statusSection.innerHTML = `<div class="error-message">${message}</div>`;
}

/**
 * Show success message
 */
function showSuccess(message) {
    const statusSection = document.getElementById('statusSection');
    statusSection.innerHTML += `<div class="success-message">${message}</div>`;
}

/**
 * Escape HTML for display
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Check if running standalone (without server)
window.addEventListener('DOMContentLoaded', () => {
    // Test API connection
    fetch('/api/health')
        .then(response => response.json())
        .then(data => {
            console.log('API Status:', data);
        })
        .catch(error => {
            console.log('Note: API server not running. Start server-v4.js for full functionality.');
        });
});