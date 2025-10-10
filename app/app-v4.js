/**
 * Philippine Location Parser v4 - Web Application
 * Enhanced UI with extraction statistics
 * Multi-Mode System: Location, Sentiment, Category
 */

let currentResults = [];
let csvData = null;
let uploadedExcelFile = null; // Store uploaded Excel file

// Global mode state
let currentMode = 'location'; // 'location' | 'sentiment' | 'category'

// Global state management for concurrent processing
const modeStates = {
    location: {
        isActive: false,
        isProcessing: false,
        sessionId: null,
        results: [],
        statistics: {},
        progress: 0,
        startTime: null,
        endTime: null,
        eventSource: null,
        distributionScope: 'city'
    },
    sentiment: {
        isActive: false,
        isProcessing: false,
        sessionId: null,
        results: [],
        statistics: {},
        progress: 0,
        startTime: null,
        endTime: null,
        eventSource: null,
        distributionScope: 'city'
    },
    category: {
        isActive: false,
        isProcessing: false,
        sessionId: null,
        results: [],
        statistics: {},
        progress: 0,
        startTime: null,
        endTime: null,
        eventSource: null
    }
};

const MODE_LABELS = {
    location: 'Location Extraction',
   sentiment: 'Sentiment Classification',
   category: 'Category Classification'
};

function getModeLabel(mode) {
   return MODE_LABELS[mode] || 'Selected mode';
}

const LOCATION_SCOPE_OPTIONS = ['region', 'province', 'city', 'barangay'];

const LOCATION_SCOPE_LABEL_MAP = {
    region: { singular: 'Region', plural: 'Regions' },
    province: { singular: 'Province', plural: 'Provinces' },
    city: { singular: 'City', plural: 'Cities' },
    barangay: { singular: 'Barangay', plural: 'Barangays' }
};

function getLocationScopeLabel(scope, plural = false) {
    const entry = LOCATION_SCOPE_LABEL_MAP[scope] || LOCATION_SCOPE_LABEL_MAP.city;
    if (plural) {
        return entry.plural || `${entry.singular}s`;
    }
    return entry.singular;
}

// API Key Storage Key
const API_KEY_STORAGE_KEY = 'location_parser_openai_key';

/**
 * Parse category input into sanitized labels and optional hints.
 * Text inside parentheses is treated as descriptive context only.
 */
function parseCategoriesText(rawInput) {
  if (!rawInput) {
    return { categories: [], hints: {} };
  }

  const enumerationPattern = /^\s*\d+\s*(?:\)|\.|[-–—:])\s*/;

  // Determine if there are at least two numbering markers outside parentheses.
  let depthCounter = 0;
  let numberingMatches = 0;
  for (let idx = 0; idx < rawInput.length; idx++) {
    const char = rawInput[idx];
    if (char === '(') {
      depthCounter++;
      continue;
    }
    if (char === ')' && depthCounter > 0) {
      depthCounter--;
      continue;
    }
    if (depthCounter === 0) {
      const maybeMatch = rawInput.slice(idx).match(enumerationPattern);
      if (maybeMatch) {
        numberingMatches++;
        idx += maybeMatch[0].length - 1;
      }
    }
  }

  const allowDigitSplits = numberingMatches >= 2;

  const entries = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < rawInput.length; i++) {
    const char = rawInput[i];
    const nextChar = rawInput[i + 1];

    if (allowDigitSplits && depth === 0) {
      const digitMatch = rawInput.slice(i).match(enumerationPattern);
      if (digitMatch) {
        if (current.trim()) {
          entries.push(current.trim());
        }
        current = '';
        i += digitMatch[0].length - 1;
        continue;
      }
    }

    if (char === '(') {
      depth++;
      current += char;
      continue;
    }

    if (char === ')') {
      if (depth > 0) depth--;
      current += char;
      continue;
    }

    if ((char === ',' || char === '\n' || char === '\r') && depth === 0) {
      if (current.trim()) {
        entries.push(current.trim());
      }
      current = '';

      // Skip the second character in CRLF sequences
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    entries.push(current.trim());
  }

  const categories = [];
  const hints = {};

  entries.forEach(entry => {
    if (!entry) return;

    const contextParts = [];
    let sanitized = entry.replace(/\(([^)]+)\)/g, (_, group) => {
      const hintText = group.replace(/\s+/g, ' ').trim();
      if (hintText) {
        contextParts.push(hintText);
      }
      return '';
    });

    sanitized = sanitized
      .replace(/^[\s]*[-–—•]+\s*/, '') // Leading bullets/dashes
      .replace(/^[\s]*\d+\)\s*/, '') // Leading numbers with closing parenthesis (e.g., "1) ")
      .replace(/^[\s]*\d+\.\s*/, '') // Leading numbers with period (e.g., "1. ")
      .replace(/^[\s]*[IVXLC]+\.\s*/i, '') // Leading roman numerals (e.g., "I. ")
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/:\s*$/, ''); // Remove trailing colon

    if (!sanitized) return;

    if (!categories.includes(sanitized)) {
      categories.push(sanitized);
    }

    const aggregatedContext = contextParts.join('; ');
    if (aggregatedContext) {
      if (hints[sanitized]) {
        if (!hints[sanitized].includes(aggregatedContext)) {
          hints[sanitized] = `${hints[sanitized]}; ${aggregatedContext}`;
        }
      } else {
        hints[sanitized] = aggregatedContext;
      }
    }
  });

  return { categories, hints };
}

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
 * Initialize mode state
 */
function initializeModeState(mode) {
    if (!modeStates[mode]) {
        console.error(`Unknown mode: ${mode}`);
        return;
    }
    
    const defaultState = {
        isActive: false,
        isProcessing: false,
        sessionId: null,
        results: [],
        statistics: {},
        progress: 0,
        startTime: null,
        endTime: null,
        eventSource: null
    };

    if (mode === 'location') {
        defaultState.distributionScope = 'city';
    }

    modeStates[mode] = defaultState;
    
    updateModeUI(mode);
}

/**
 * Get mode-specific state
 */
function getModeState(mode) {
    return modeStates[mode] || null;
}

function getLocationScope() {
    const state = getModeState('location');
    if (state && LOCATION_SCOPE_OPTIONS.includes(state.distributionScope)) {
        return state.distributionScope;
    }
    return 'city';
}

function updateLocationScopeHeading(scope) {
    const labelElement = document.getElementById('locationScopeLabel');
    if (!labelElement) return;
    const pluralLabel = getLocationScopeLabel(scope, true);
    labelElement.textContent = `Top ${pluralLabel}`;
}

/**
 * Update mode state
 */
function setModeState(mode, updates) {
    if (!modeStates[mode]) {
        console.error(`Unknown mode: ${mode}`);
        return;
    }
    
    Object.assign(modeStates[mode], updates);
    updateModeUI(mode);
}

/**
 * Update mode UI based on state
 */
function updateModeUI(mode) {
    const state = modeStates[mode];
    const panel = document.getElementById(`${mode}Panel`);
    const statusBadge = document.getElementById(`${mode}StatusBadge`);
    const clearBtn = document.querySelector(`#${mode}Panel .mode-clear-btn`);
    
    if (!panel || !state) return;

    if (mode === 'location') {
        const scopeSelect = document.getElementById('locationScopeSelect');
        if (scopeSelect && state.distributionScope) {
            scopeSelect.value = state.distributionScope;
        }
        updateLocationScopeHeading(state.distributionScope || 'city');
    }
    
    // Update panel classes
    panel.classList.remove('active', 'processing', 'completed', 'error');
    
    if (state.isProcessing) {
        panel.classList.add('processing');
        statusBadge.textContent = 'Processing';
        statusBadge.className = 'mode-status-badge processing';
    } else if (state.isActive && state.results.length > 0) {
        panel.classList.add('completed');
        statusBadge.textContent = 'Completed';
        statusBadge.className = 'mode-status-badge completed';
        if (clearBtn) clearBtn.style.display = 'block';
    } else if (state.isActive) {
        panel.classList.add('active');
        statusBadge.textContent = 'Active';
        statusBadge.className = 'mode-status-badge active';
    } else {
        statusBadge.textContent = 'Inactive';
        statusBadge.className = 'mode-status-badge';
        if (clearBtn) clearBtn.style.display = 'none';
    }
    
    // Update processing time
    const timeElement = document.getElementById(`${mode}ProcessingTime`);
    if (timeElement) {
        if (state.startTime && state.isProcessing) {
            const elapsed = Date.now() - state.startTime;
            timeElement.textContent = `Time: ${formatTime(elapsed)}`;
        } else if (state.startTime && state.endTime) {
            const total = state.endTime - state.startTime;
            timeElement.textContent = `Total: ${formatTime(total)}`;
        } else {
            timeElement.textContent = '';
        }
    }
}

/**
 * Format time display
 */
function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        return `${seconds}s`;
    }
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
 * Set current mode and update UI
 * @param {string} mode - 'location' | 'sentiment' | 'category'
 */
function setMode(mode) {
    currentMode = mode;

    // Update tab active states
    document.getElementById('locationTab').classList.remove('active');
    document.getElementById('sentimentTab').classList.remove('active');
    document.getElementById('categoryTab').classList.remove('active');

    if (mode === 'location') {
        document.getElementById('locationTab').classList.add('active');
    } else if (mode === 'sentiment') {
        document.getElementById('sentimentTab').classList.add('active');
    } else if (mode === 'category') {
        document.getElementById('categoryTab').classList.add('active');
    }

    // Show/hide conditional fields
    showConditionalFields(mode);

    // Show/hide mode panels based on selected tab
    updateModePanelVisibility(mode);

    // Initialize mode state if not already done
    if (!getModeState(mode)) {
        initializeModeState(mode);
    }

    console.log(`Mode switched to: ${mode}`);
}

/**
 * Update mode panel visibility based on selected tab
 * @param {string} mode - 'location' | 'sentiment' | 'category'
 */
function updateModePanelVisibility(mode) {
    // Get all mode panels
    const locationPanel = document.getElementById('locationPanel');
    const sentimentPanel = document.getElementById('sentimentPanel');
    const categoryPanel = document.getElementById('categoryPanel');
    const container = document.getElementById('modeResultsContainer');

    // Hide all panels first
    if (locationPanel) {
        locationPanel.classList.add('hidden');
        locationPanel.classList.remove('visible');
    }
    if (sentimentPanel) {
        sentimentPanel.classList.add('hidden');
        sentimentPanel.classList.remove('visible');
    }
    if (categoryPanel) {
        categoryPanel.classList.add('hidden');
        categoryPanel.classList.remove('visible');
    }

    // Add single panel class to container
    if (container) {
        container.classList.add('single-panel');
    }

    // Show only the active panel
    let activePanel = null;
    if (mode === 'location') {
        activePanel = locationPanel;
    } else if (mode === 'sentiment') {
        activePanel = sentimentPanel;
    } else if (mode === 'category') {
        activePanel = categoryPanel;
    }

    if (activePanel) {
        activePanel.classList.remove('hidden');
        activePanel.classList.add('visible');
    }
}

/**
 * Show/hide conditional fields based on mode
 * @param {string} mode - 'location' | 'sentiment' | 'category'
 */
function showConditionalFields(mode) {
    const sentimentFields = document.getElementById('sentimentFields');
    const categoryFields = document.getElementById('categoryFields');

    // Hide all conditional fields first
    sentimentFields.classList.remove('active');
    categoryFields.classList.remove('active');

    // Show relevant fields based on mode
    if (mode === 'sentiment') {
        sentimentFields.classList.add('active');
    } else if (mode === 'category') {
        categoryFields.classList.add('active');
    }
    // Location mode has no conditional fields
}

/**
 * Get classification configuration for the provided mode.
 */
function getClassificationConfig(mode = currentMode) {
    if (mode === 'sentiment') {
        return {
            mode: 'sentiment',
            entity: document.getElementById('entityInput').value.trim(),
            sentimentLabels: document.getElementById('sentimentLabels').value
                .split(',')
                .map(label => label.trim())
                .filter(label => label.length > 0),
            description: document.getElementById('sentimentDescription').value.trim()
        };
    } else if (mode === 'category') {
        const { categories, hints } = parseCategoriesText(document.getElementById('categoriesInput').value);
        return {
            mode: 'category',
            categories,
            categoryHints: hints,
            description: document.getElementById('categoryDescription').value.trim()
        };
    } else {
        return {
            mode: 'location'
        };
    }
}

/**
 * Validate classification inputs based on supplied mode.
 */
function validateClassificationInputs(mode = currentMode) {
    if (mode === 'sentiment') {
        const entity = document.getElementById('entityInput').value.trim();
        const sentimentLabels = document.getElementById('sentimentLabels').value.trim();

        if (!entity) {
            return {
                valid: false,
                message: 'Please enter an entity to evaluate (e.g., "PLDT Home")'
            };
        }

        if (!sentimentLabels) {
            return {
                valid: false,
                message: 'Please enter sentiment labels (e.g., "Positive, Neutral, Negative")'
            };
        }

        const labels = sentimentLabels.split(',').map(l => l.trim()).filter(l => l.length > 0);
        if (labels.length < 2) {
            return {
                valid: false,
                message: 'Please provide at least 2 sentiment labels separated by commas'
            };
        }

        return { valid: true };
    } else if (mode === 'category') {
        const categoriesInput = document.getElementById('categoriesInput').value.trim();

        if (!categoriesInput) {
            return {
                valid: false,
                message: 'Please enter categories (e.g., "Billing, Technical Support, Network Issues")'
            };
        }

        const parsed = parseCategoriesText(categoriesInput);

        if (parsed.categories.length < 2) {
            return {
                valid: false,
                message: 'Please provide at least 2 categories'
            };
        }

        return { valid: true };
    }

    // Location mode has no additional validation
    return { valid: true };
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

    // Initialize panel visibility - set default mode to 'location'
    updateModePanelVisibility('location');

    // Ensure optional classification helpers show placeholders, not stale autofill values.
    const categoryDescriptionInput = document.getElementById('categoryDescription');
    const sentimentDescriptionInput = document.getElementById('sentimentDescription');

    // Helper function to aggressively clear a field
    function aggressivelyClearField(field) {
        if (!field) return;

        // Clear immediately
        field.value = '';
        field.defaultValue = '';

        // Clear on focus (in case browser autofills when user focuses)
        field.addEventListener('focus', function() {
            if (this.value && !this.dataset.userEntered) {
                this.value = '';
            }
        }, { once: true });

        // Mark as user-entered when user actually types
        field.addEventListener('input', function() {
            this.dataset.userEntered = 'true';
        });

        // Multiple aggressive timeouts to catch different browser autofill timings
        const clearTimes = [50, 100, 200, 500, 1000, 2000];
        clearTimes.forEach(delay => {
            setTimeout(() => {
                if (!field.dataset.userEntered) {
                    field.value = '';
                }
            }, delay);
        });
    }

    aggressivelyClearField(categoryDescriptionInput);
    aggressivelyClearField(sentimentDescriptionInput);

    const sheetUrlInput = document.getElementById('sheetUrl');
    if (sheetUrlInput) {
        // Detect sheets when URL is entered or pasted
        sheetUrlInput.addEventListener('input', debounce(detectGoogleSheets, 1000));
        sheetUrlInput.addEventListener('paste', () => {
            setTimeout(detectGoogleSheets, 100);
        });
    }

    const locationScopeSelect = document.getElementById('locationScopeSelect');
    if (locationScopeSelect) {
        const initialScope = getLocationScope();
        locationScopeSelect.value = initialScope;
        updateLocationScopeHeading(initialScope);
        locationScopeSelect.addEventListener('change', handleLocationScopeChange);
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
    const mode = currentMode;

    if (!requireApiKey()) {
        return;
    }

    const validation = validateClassificationInputs(mode);
    if (!validation.valid) {
        showError(validation.message);
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

    const config = getClassificationConfig(mode);
    const existingState = getModeState(mode);

    if (existingState && existingState.isProcessing) {
        showError(`${getModeLabel(mode)} is already processing. Please wait for it to finish before starting another run.`);
        return;
    }

    if (existingState && existingState.eventSource) {
        try {
            existingState.eventSource.close();
        } catch (closeError) {
            console.warn(`Failed to close previous EventSource for ${mode}:`, closeError);
        }
    }

    clearModeResults(mode);

    const sessionId = Date.now().toString();

    setModeState(mode, {
        isActive: true,
        isProcessing: true,
        startTime: Date.now(),
        sessionId: sessionId
    });

    showModeStatus(mode, 'Fetching Google Sheet data...', 10);

    let eventSource = null;
    try {
        eventSource = new EventSource(`/api/progress-stream/${sessionId}`);
        setModeState(mode, { eventSource });

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'progress') {
                const progress = data.percentage || 0;
                const message = data.currentText ?
                    `Processing: ${data.currentText}` :
                    'Processing data...';

                updateModeStatus(mode, message, progress, {
                    current: data.current,
                    total: data.total,
                    estimatedRemaining: data.estimatedRemaining
                });
            } else if (data.type === 'completed') {
                updateModeStatus(mode, 'Processing complete!', 100);
                if (eventSource) {
                    eventSource.close();
                    setModeState(mode, { eventSource: null });
                }
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            if (eventSource) {
                eventSource.close();
                setModeState(mode, { eventSource: null });
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
                apiKey: getApiKey(), // Include user's API key
                ...config // Include mode-specific configuration
            })
        });

        if (!apiResponse.ok) {
            throw new Error('Failed to process data');
        }

        const data = await apiResponse.json();

        updateModeStatus(mode, 'Processing complete!', 100);

        setModeState(mode, {
            isProcessing: false,
            endTime: Date.now(),
            results: data.results,
            statistics: data
        });

        updateModeStatus(mode, 'Processing complete!', 100);
        displayModeResults(mode, data.results);
        updateModeStatistics(mode, data);
        generateModeCSV(mode, data.results);
        document.getElementById(`${mode}DownloadSection`).style.display = 'block';

        if (eventSource) {
            eventSource.close();
            setModeState(mode, { eventSource: null });
        }

    } catch (error) {
        showError('Error: ' + error.message);
        console.error(error);

        setModeState(mode, {
            isProcessing: false,
            endTime: Date.now()
        });

        if (eventSource) {
            eventSource.close();
            setModeState(mode, { eventSource: null });
        }
    } finally {
        setModeState(mode, { isProcessing: false });
    }
}

/**
 * Process text input
 */
async function processText() {
    console.log('🔵 processText() called');
    console.log('🔵 Current mode:', currentMode);

    // Check API key first
    console.log('🔵 Checking API key...');
    if (!requireApiKey()) {
        console.log('🔴 API key validation failed');
        return;
    }
    console.log('✅ API key validated');

    // Validate classification inputs based on current mode
    console.log('🔵 Validating classification inputs...');
    const validation = validateClassificationInputs();
    console.log('🔵 Validation result:', validation);
    if (!validation.valid) {
        console.log('🔴 Validation failed:', validation.message);
        showError(validation.message);
        return;
    }
    console.log('✅ Validation passed');

    const textInput = document.getElementById('textInput').value.trim();
    console.log('🔵 Text input length:', textInput.length);

    if (!textInput) {
        console.log('🔴 No text input');
        showError('Please enter some text to process');
        return;
    }

    // Split by lines and filter empty
    const lines = textInput.split('\n').filter(line => line.trim());
    console.log('🔵 Number of lines:', lines.length);
    console.log('🔵 Lines:', lines);

    if (lines.length === 0) {
        console.log('🔴 No valid lines');
        showError('Please enter valid text');
        return;
    }

    // Process with current mode
    console.log('🔵 Calling processTextWithMode with mode:', currentMode);
    await processTextWithMode(currentMode, lines);
    console.log('✅ processTextWithMode completed');
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

        if (currentMode === 'location') {
            // Location extraction mode
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
        } else if (currentMode === 'sentiment' || currentMode === 'category') {
            // Classification modes (sentiment or category)
            const classification = result.classification || 'Not classified';
            const hasClassification = result.classification && !result.classification.startsWith('Error:');
            const classificationClass = hasClassification ? 'location-found' : 'location-none';
            const icon = currentMode === 'sentiment' ? '💬' : '📁';

            item.innerHTML = `
                <div class="result-row">Row ${index + 1}</div>
                <div class="result-text" title="${escapeHtml(result.text)}">${escapeHtml(result.text)}</div>
                <div class="result-location ${classificationClass}">
                    ${icon} ${escapeHtml(classification)}
                </div>
            `;
        }

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

    // Successful results (locations found or classifications completed)
    const successful = data.successful;
    document.getElementById('locationsFound').textContent = successful;

    // Update label based on mode
    const successLabel = document.querySelector('#locationsFound').parentElement.querySelector('.stat-label');
    if (currentMode === 'location') {
        successLabel.textContent = 'With Locations';
    } else if (currentMode === 'sentiment' || currentMode === 'category') {
        successLabel.textContent = 'Classified';
    }

    // Without locations/classifications
    document.getElementById('noLocation').textContent = data.processed - successful;

    // Update "no results" label based on mode
    const noResultLabel = document.querySelector('#noLocation').parentElement.querySelector('.stat-label');
    if (currentMode === 'location') {
        noResultLabel.textContent = 'No Location';
    } else if (currentMode === 'sentiment' || currentMode === 'category') {
        noResultLabel.textContent = 'Not Classified';
    }

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
    document.getElementById('downloadGroup').style.display = 'none';

    // Reset status section to initial state
    const statusSection = document.getElementById('statusSection');
    const statusTitle = document.getElementById('statusTitle');
    const statusIcon = document.getElementById('statusIcon');
    const progressBar = document.getElementById('progressBar');
    const statusMessage = document.getElementById('statusMessage');

    statusSection.classList.remove('active');
    statusTitle.textContent = 'Processing...';
    statusIcon.className = 'spinner status-icon';
    statusIcon.innerHTML = '';
    progressBar.style.width = '0%';
    progressBar.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    statusMessage.textContent = 'Initializing...';

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

    // Generate CSV based on current mode
    if (currentMode === 'sentiment') {
        return generateSentimentCSV(results);
    } else if (currentMode === 'category') {
        return generateCategoryCSV(results);
    } else {
        // Location mode - default to single column format
        return generateSingleColumnCSV(results);
    }
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
 * Generate CSV for sentiment classification results
 */
function generateSentimentCSV(results) {
    const headers = ['Row', 'Text', 'Classification'];
    const rows = [headers];

    results.forEach((result, index) => {
        const classification = result.classification || 'Not classified';

        rows.push([
            index + 1,
            `"${result.text.replace(/"/g, '""')}"`,
            `"${classification.replace(/"/g, '""')}"`
        ]);
    });

    return rows.map(row => row.join(',')).join('\n');
}

/**
 * Generate CSV for category classification results
 */
function generateCategoryCSV(results) {
    const headers = ['Row', 'Text', 'Classification'];
    const rows = [headers];

    results.forEach((result, index) => {
        const classification = result.classification || 'Not classified';

        rows.push([
            index + 1,
            `"${result.text.replace(/"/g, '""')}"`,
            `"${classification.replace(/"/g, '""')}"`
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

    let csvContent;
    let filename;

    if (currentMode === 'sentiment') {
        // Sentiment classification mode
        csvContent = generateSentimentCSV(currentResults);
        filename = `sentiment-classification-results-${Date.now()}.csv`;
    } else if (currentMode === 'category') {
        // Category classification mode
        csvContent = generateCategoryCSV(currentResults);
        filename = `category-classification-results-${Date.now()}.csv`;
    } else {
        // Location mode - check export format
        const formatRadio = document.querySelector('input[name="exportFormat"]:checked');
        const format = formatRadio ? formatRadio.value : 'single';

        if (format === 'multiple') {
            csvContent = generateMultiColumnCSV(currentResults);
        } else {
            csvContent = generateSingleColumnCSV(currentResults);
        }
        filename = `location-extraction-results-${Date.now()}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Show status section and reset to initial state
 */
function showStatus() {
    const statusSection = document.getElementById('statusSection');
    const statusTitle = document.getElementById('statusTitle');
    const statusIcon = document.getElementById('statusIcon');
    const progressBar = document.getElementById('progressBar');
    const statusMessage = document.getElementById('statusMessage');

    // Reset to initial processing state
    statusSection.classList.add('active');
    statusTitle.textContent = 'Processing...';
    statusIcon.className = 'spinner status-icon';
    statusIcon.innerHTML = '';
    progressBar.style.width = '0%';
    progressBar.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    statusMessage.textContent = 'Initializing...';
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
    if (statusSection) {
        statusSection.classList.add('active');
        statusSection.innerHTML = `<div class="error-message">${message}</div>`;
    } else {
        // Fallback: show error as alert if statusSection doesn't exist
        alert(message);
    }
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

/**
 * Show mode-specific status
 */
function showModeStatus(mode, message, progress) {
    const statusSection = document.getElementById(`${mode}StatusSection`);
    const statusTitle = document.getElementById(`${mode}StatusTitle`);
    const statusIcon = document.getElementById(`${mode}StatusIcon`);
    const progressBar = document.getElementById(`${mode}ProgressBar`);
    const statusMessage = document.getElementById(`${mode}StatusMessage`);

    if (!statusSection || !statusTitle || !statusIcon || !progressBar || !statusMessage) {
        console.error(`Status elements not found for mode: ${mode}`);
        return;
    }

    statusSection.classList.add('active');
    statusTitle.textContent = 'Processing...';
    statusIcon.className = 'spinner status-icon';
    progressBar.style.width = progress + '%';
    statusMessage.textContent = message;
}

/**
 * Update mode-specific status
 */
function updateModeStatus(mode, message, progress, details = {}) {
    const statusMessage = document.getElementById(`${mode}StatusMessage`);
    const progressBar = document.getElementById(`${mode}ProgressBar`);
    const statusTitle = document.getElementById(`${mode}StatusTitle`);
    const statusIcon = document.getElementById(`${mode}StatusIcon`);
    
    statusMessage.textContent = message;
    progressBar.style.width = progress + '%';
    progressBar.style.transition = 'width 0.3s ease';
    
    if (details.current && details.total) {
        if (details.estimatedRemaining) {
            statusMessage.innerHTML = `${message}<br><small style="opacity:0.8">Processing ${details.current}/${details.total} items • ~${details.estimatedRemaining}s remaining</small>`;
        } else {
            statusMessage.innerHTML = `${message}<br><small style="opacity:0.8">Processing ${details.current}/${details.total} items</small>`;
        }
    }
    
    if (progress === 100) {
        statusIcon.classList.remove('spinner');
        statusIcon.innerHTML = '✅';
        statusTitle.textContent = 'Complete!';
        progressBar.style.background = '#28a745';
    }
}

/**
 * Display mode-specific results
 */
function displayModeResults(mode, results) {
    const resultsSection = document.getElementById(`${mode}ResultsSection`);
    resultsSection.innerHTML = '';
    resultsSection.classList.add('active');

    results.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'result-item';

        if (mode === 'location') {
            // Location extraction mode
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
        } else if (mode === 'sentiment' || mode === 'category') {
            // Classification modes (sentiment or category)
            const classification = result.classification || 'Not classified';
            const hasClassification = result.classification && !result.classification.startsWith('Error:');
            const classificationClass = hasClassification ? 'location-found' : 'location-none';
            const icon = mode === 'sentiment' ? '💬' : '📁';

            item.innerHTML = `
                <div class="result-row">Row ${index + 1}</div>
                <div class="result-text" title="${escapeHtml(result.text)}">${escapeHtml(result.text)}</div>
                <div class="result-location ${classificationClass}">
                    ${icon} ${escapeHtml(classification)}
                </div>
            `;
        }

        resultsSection.appendChild(item);
    });
}

/**
 * Render category distribution chart (top 5 categories)
 */
function extractLocationDistributionLabel(result, scope = getLocationScope()) {
    if (!result || !result.location) {
        return null;
    }

    const normalized = normalizeLocation(result.location);
    let value = null;

    switch (scope) {
        case 'region':
            value = normalized.region;
            break;
        case 'province':
            value = normalized.province;
            break;
        case 'barangay':
            value = normalized.barangay;
            break;
        case 'city':
        default:
            value = normalized.city;
            break;
    }

    if (!value || value === 'None') return null;
    return value;
}

function extractClassificationLabel(result) {
    if (!result || typeof result.classification !== 'string') {
        return null;
    }
    const trimmed = result.classification.trim();
    if (!trimmed || trimmed.startsWith('Error:')) {
        return null;
    }
    return trimmed;
}

const MODE_DISTRIBUTION_CONFIG = {
    location: {
        containerId: 'locationDistribution',
        summaryId: 'locationMissingInfo',
        emptyMessage: (ctx) => `No ${getLocationScopeLabel(ctx.scope, false).toLowerCase()} data yet`,
        extractLabel: (item, ctx) => extractLocationDistributionLabel(item, ctx.scope),
        formatSummary: (missing, total, ctx) => {
            const singular = getLocationScopeLabel(ctx.scope, false);
            const plural = getLocationScopeLabel(ctx.scope, true);
            if (missing <= 0) {
                return { text: `All rows mapped to a ${singular.toLowerCase()}`, color: '#2e7d32' };
            }
            const percent = Math.round((missing / total) * 100);
            return { text: `${singular} not detected: ${missing} (${percent}%)`, color: '#d32f2f' };
        },
        getContext: () => ({ scope: getLocationScope() })
    },
    sentiment: {
        containerId: 'sentimentDistribution',
        summaryId: 'sentimentUnclassifiedInfo',
        emptyMessage: 'No sentiment data yet',
        extractLabel: extractClassificationLabel,
        formatSummary: (missing, total) => {
            if (missing <= 0) {
                return { text: 'All rows classified', color: '#2e7d32' };
            }
            const percent = Math.round((missing / total) * 100);
            return { text: `Unclassified: ${missing} (${percent}%)`, color: '#d32f2f' };
        }
    },
    category: {
        containerId: 'categoryDistribution',
        summaryId: 'categoryUnclassifiedInfo',
        emptyMessage: 'No category data yet',
        extractLabel: extractClassificationLabel,
        formatSummary: (missing, total) => {
            if (missing <= 0) {
                return { text: 'All rows classified', color: '#2e7d32' };
            }
            const percent = Math.round((missing / total) * 100);
            return { text: `Unclassified: ${missing} (${percent}%)`, color: '#d32f2f' };
        }
    }
};

function renderModeDistribution(mode, results = []) {
    const config = MODE_DISTRIBUTION_CONFIG[mode];
    if (!config) return 0;

    const container = document.getElementById(config.containerId);
    if (!container) return 0;

    const context = config.getContext ? config.getContext() : {};
    const emptyMessage = typeof config.emptyMessage === 'function'
        ? config.emptyMessage(context)
        : (config.emptyMessage || 'No data yet');

    container.innerHTML = '';

    if (!Array.isArray(results) || results.length === 0) {
        container.innerHTML = `<div class="category-distribution-empty">${emptyMessage}</div>`;
        if (mode === 'location') {
            updateLocationScopeHeading(context.scope || getLocationScope());
        }
        return 0;
    }

    const counts = {};
    let totalValid = 0;

    results.forEach(item => {
        const label = config.extractLabel ? config.extractLabel(item, context) : null;
        if (!label) return;
        totalValid++;
        counts[label] = (counts[label] || 0) + 1;
    });

    if (totalValid === 0 || Object.keys(counts).length === 0) {
        container.innerHTML = `<div class="category-distribution-empty">${emptyMessage}</div>`;
        if (mode === 'location') {
            updateLocationScopeHeading(context.scope || getLocationScope());
        }
        return 0;
    }

    const topEntries = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const maxCount = topEntries[0] ? topEntries[0][1] : 0;

    topEntries.forEach(([label, count]) => {
        const percentage = Math.round((count / totalValid) * 100);
        const widthPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const adjustedWidth = Math.min(Math.max(widthPercent, maxCount > 0 ? 8 : 0), 100);
        const safeLabel = escapeHtml(label);

        const row = document.createElement('div');
        row.className = 'category-distribution-row';
        row.innerHTML = `
            <span class="category-distribution-label" title="${safeLabel}">${safeLabel}</span>
            <div class="category-distribution-bar-wrapper">
                <div class="category-distribution-bar" style="width: ${adjustedWidth}%;"></div>
            </div>
            <span class="category-distribution-count">${count}<span>${percentage}%</span></span>
        `;
        container.appendChild(row);
    });

    if (mode === 'location') {
        updateLocationScopeHeading(context.scope || getLocationScope());
    }

    return totalValid;
}

function updateClassificationSummary(mode, missing, total) {
    const config = MODE_DISTRIBUTION_CONFIG[mode];
    if (!config || !config.summaryId) return;

    const summaryElement = document.getElementById(config.summaryId);
    if (!summaryElement) return;

    if (typeof missing !== 'number' || typeof total !== 'number' || total <= 0) {
        summaryElement.textContent = '';
        summaryElement.style.display = 'none';
        return;
    }

    const context = config.getContext ? config.getContext() : {};

    const summaryInfo = config.formatSummary
        ? config.formatSummary(missing, total, context)
        : null;

    if (!summaryInfo || !summaryInfo.text) {
        summaryElement.textContent = '';
        summaryElement.style.display = 'none';
        return;
    }

    summaryElement.textContent = summaryInfo.text;
    summaryElement.style.display = 'block';
    summaryElement.style.color = summaryInfo.color || '#666';
}

function handleLocationScopeChange(event) {
    const scope = event.target.value;
    if (!LOCATION_SCOPE_OPTIONS.includes(scope)) {
        return;
    }

    setModeState('location', { distributionScope: scope });

    const state = getModeState('location');
    const results = state && Array.isArray(state.results) ? state.results : [];
    const validCount = renderModeDistribution('location', results);
    const totalProcessed = state && state.statistics && typeof state.statistics.processed === 'number'
        ? state.statistics.processed
        : (Array.isArray(results) ? results.length : 0);
    const missing = totalProcessed > 0 ? Math.max(totalProcessed - validCount, 0) : null;
    updateClassificationSummary('location', missing, totalProcessed);
}

/**
 * Update mode-specific statistics
 */
function updateModeStatistics(mode, data) {
    const statsPanel = document.getElementById(`${mode}StatsPanel`);
    if (!statsPanel) {
        console.error(`Stats panel not found for mode: ${mode}`);
        return;
    }

    statsPanel.classList.add('active');

    const modeState = getModeState(mode);
    const resultsArray = Array.isArray(data.results)
        ? data.results
        : (modeState && Array.isArray(modeState.results) ? modeState.results : []);

    // Total processed
    document.getElementById(`${mode}TotalProcessed`).textContent = data.processed;

    // Successful results (locations found or classifications completed)
    const successful = data.successful;
    const missingCount = Math.max(data.processed - successful, 0);

    // Use correct element IDs based on mode
    if (mode === 'location') {
        const locatedElement = document.getElementById(`${mode}LocationsFound`);
        if (locatedElement) {
            locatedElement.textContent = successful;
        }
    } else {
        // For sentiment and category, use 'Classified' and 'NotClassified' IDs when present
        const classifiedElement = document.getElementById(`${mode}Classified`);
        if (classifiedElement) {
            classifiedElement.textContent = successful;
        }

        const notClassifiedElement = document.getElementById(`${mode}NotClassified`);
        if (notClassifiedElement) {
            notClassifiedElement.textContent = missingCount;
        }
    }

    // Success rate
    const successRate = data.successRate || '0';
    document.getElementById(`${mode}SuccessRate`).textContent = `${successRate}%`;

    // Style success rate based on value
    const rateElement = document.getElementById(`${mode}SuccessRate`);
    const rate = parseFloat(successRate);
    if (rate >= 70) {
        rateElement.style.color = '#28a745';
    } else if (rate >= 40) {
        rateElement.style.color = '#ffc107';
    } else {
        rateElement.style.color = '#dc3545';
    }

    const validCount = renderModeDistribution(mode, resultsArray);

    if (mode === 'location') {
        const missingCities = Math.max(data.processed - validCount, 0);
        updateClassificationSummary(mode, missingCities, data.processed);
    } else {
        updateClassificationSummary(mode, missingCount, data.processed);
    }
}

/**
 * Generate mode-specific CSV
 */
function generateModeCSV(mode, results) {
    // Store results globally for different format exports
    setModeState(mode, { results });

    // Generate CSV based on current mode
    if (mode === 'sentiment') {
        return generateSentimentCSV(results);
    } else if (mode === 'category') {
        return generateCategoryCSV(results);
    } else {
        // Location mode - check export format
        const formatRadio = document.querySelector(`input[name="${mode}ExportFormat"]:checked`);
        const format = formatRadio ? formatRadio.value : 'single';

        if (format === 'multiple') {
            return generateMultiColumnCSV(results);
        } else {
            return generateSingleColumnCSV(results);
        }
    }
}

/**
 * Download mode-specific CSV
 */
function downloadModeCSV(mode) {
    const state = getModeState(mode);
    if (!state || !state.results || state.results.length === 0) {
        showError(`No ${mode} data to download`);
        return;
    }

    let csvContent;
    let filename;

    if (mode === 'sentiment') {
        // Sentiment classification mode
        csvContent = generateSentimentCSV(state.results);
        filename = `sentiment-classification-results-${Date.now()}.csv`;
    } else if (mode === 'category') {
        // Category classification mode
        csvContent = generateCategoryCSV(state.results);
        filename = `category-classification-results-${Date.now()}.csv`;
    } else {
        // Location mode - check export format
        const formatRadio = document.querySelector(`input[name="${mode}ExportFormat"]:checked`);
        const format = formatRadio ? formatRadio.value : 'single';

        if (format === 'multiple') {
            csvContent = generateMultiColumnCSV(state.results);
        } else {
            csvContent = generateSingleColumnCSV(state.results);
        }
        filename = `location-extraction-results-${Date.now()}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Reset mode statistics counters to their default values
 */
function resetModeStatistics(mode) {
    const elementsToReset = [
        { id: `${mode}TotalProcessed`, value: '0' },
        // Success rate uses inline styles for thresholds; reset to default styling.
        { id: `${mode}SuccessRate`, value: '0%', resetColor: true }
    ];

    if (mode === 'location') {
        elementsToReset.push({ id: 'locationLocationsFound', value: '0' });
    }
    elementsToReset.push({ id: `${mode}Classified`, value: '0' });

    elementsToReset.forEach(({ id, value, resetColor }) => {
        const element = document.getElementById(id);
        if (!element) return;

        element.textContent = value;
        if (resetColor) {
            element.style.color = '';
        }
    });

    if (mode === 'location') {
        renderModeDistribution('location', []);
        updateClassificationSummary('location', null, null);
    } else if (mode === 'sentiment') {
        renderModeDistribution('sentiment', []);
        updateClassificationSummary('sentiment', null, null);
    } else if (mode === 'category') {
        renderModeDistribution('category', []);
        updateClassificationSummary('category', null, null);
    }
}

/**
 * Clear mode-specific results
 */
function clearModeResults(mode) {
    const existingState = getModeState(mode);
    if (existingState && existingState.eventSource) {
        try {
            existingState.eventSource.close();
        } catch (closeError) {
            console.warn(`Failed to close EventSource for ${mode}:`, closeError);
        }
    }

    initializeModeState(mode);

    // Clear UI elements
    const resultsSection = document.getElementById(`${mode}ResultsSection`);
    if (resultsSection) {
        resultsSection.innerHTML = '';
        resultsSection.classList.remove('active');
    }

    const statsPanel = document.getElementById(`${mode}StatsPanel`);
    if (statsPanel) {
        statsPanel.classList.remove('active');
    }
    resetModeStatistics(mode);

    const downloadSection = document.getElementById(`${mode}DownloadSection`);
    if (downloadSection) {
        downloadSection.style.display = 'none';
    }

    // Reset status section to initial state
    const statusSection = document.getElementById(`${mode}StatusSection`);
    if (statusSection) {
        statusSection.classList.remove('active');
    }

    const statusTitle = document.getElementById(`${mode}StatusTitle`);
    if (statusTitle) {
        statusTitle.textContent = 'Ready';
    }

    const statusIcon = document.getElementById(`${mode}StatusIcon`);
    if (statusIcon) {
        statusIcon.className = 'spinner status-icon';
        statusIcon.innerHTML = '';
    }

    const progressBar = document.getElementById(`${mode}ProgressBar`);
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }

    const statusMessage = document.getElementById(`${mode}StatusMessage`);
    if (statusMessage) {
        statusMessage.textContent = 'Ready to process';
    }
}

/**
 * Process text with specific mode
 */
async function processTextWithMode(mode, lines) {
    const existingState = getModeState(mode);

    if (existingState && existingState.isProcessing) {
        showError(`${getModeLabel(mode)} is already processing. Please wait for it to finish before starting another run.`);
        return;
    }

    if (existingState && existingState.eventSource) {
        try {
            existingState.eventSource.close();
        } catch (closeError) {
            console.warn(`Failed to close previous EventSource for ${mode}:`, closeError);
        }
    }

    clearModeResults(mode);

    const sessionId = `${mode}-${Date.now()}`;
    setModeState(mode, {
        isActive: true,
        isProcessing: true,
        startTime: Date.now(),
        sessionId
    });

    const config = getClassificationConfigForMode(mode);
    const state = getModeState(mode);

    showModeStatus(mode, 'Initializing processing...', 5);

    let eventSource = null;
    try {
        eventSource = new EventSource(`/api/progress-stream/${state.sessionId}`);
        setModeState(mode, { eventSource });

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'progress') {
                const progress = data.percentage || 0;
                const message = data.currentText ?
                    `Processing: ${data.currentText}` :
                    'Processing data...';

                updateModeStatus(mode, message, progress, {
                    current: data.current,
                    total: data.total,
                    estimatedRemaining: data.estimatedRemaining
                });
            } else if (data.type === 'completed') {
                updateModeStatus(mode, 'Processing complete!', 100);
                if (eventSource) {
                    eventSource.close();
                    setModeState(mode, { eventSource: null });
                }
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            if (eventSource) {
                eventSource.close();
                setModeState(mode, { eventSource: null });
            }
        };

        // Call the API with mode-specific configuration
        const response = await fetch('/api/batch-parse', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                texts: lines,
                useLLM: true,
                sessionId: state.sessionId,
                apiKey: getApiKey(),
                ...config
            })
        });

        if (!response.ok) {
            throw new Error('Failed to process text');
        }

        const data = await response.json();

        // Update mode state with results
        setModeState(mode, {
            isProcessing: false,
            endTime: Date.now(),
            results: data.results,
            statistics: data
        });

        // Display results for this mode
        displayModeResults(mode, data.results);
        updateModeStatistics(mode, data);

        // Ensure status reflects completion even if SSE didn't fire
        updateModeStatus(mode, 'Processing complete!', 100);

        // Generate CSV for this mode
        generateModeCSV(mode, data.results);

        // Show download button for this mode
        document.getElementById(`${mode}DownloadSection`).style.display = 'block';

    } catch (error) {
        console.error(`Error processing ${mode}:`, error);
        setModeState(mode, {
            isProcessing: false,
            endTime: Date.now()
        });

        updateModeStatus(mode, `Error: ${error.message}`, 0);
        showError(`Error processing ${mode}: ${error.message}`);
    } finally {
        if (eventSource) {
            eventSource.close();
            setModeState(mode, { eventSource: null });
        }
        setModeState(mode, { isProcessing: false });
    }
}

/**
 * Get classification configuration for specific mode
 */
function getClassificationConfigForMode(mode) {
    if (mode === 'sentiment') {
        return {
            mode: 'sentiment',
            entity: document.getElementById('entityInput').value.trim(),
            sentimentLabels: document.getElementById('sentimentLabels').value
                .split(',')
                .map(label => label.trim())
                .filter(label => label.length > 0),
            description: document.getElementById('sentimentDescription').value.trim()
        };
    } else if (mode === 'category') {
        const { categories, hints } = parseCategoriesText(document.getElementById('categoriesInput').value);
        return {
            mode: 'category',
            categories,
            categoryHints: hints,
            description: document.getElementById('categoryDescription').value.trim()
        };
    } else {
        return {
            mode: 'location'
        };
    }
}
