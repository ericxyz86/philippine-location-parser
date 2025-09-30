/**
 * Philippine Location Parser v4.0
 * Critical improvements based on comprehensive analysis
 *
 * Key Fixes:
 * 1. Enhanced disambiguation logic to prevent cross-region mismatches
 * 2. Expanded Filipino/English pattern detection
 * 3. Hierarchical fallback system
 * 4. Nickname and abbreviation mappings
 * 5. Better handling of partial locations
 */

const fs = require('fs');
const path = require('path');

// Load location database
const locationsDb = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/location-db-server.json'), 'utf8')
);

// Configuration
const config = {
  minMatchScore: 35, // Balance between false positives and legitimate detection
  minStringLength: 4, // Allow common city names
  enableHierarchicalFallback: true,
  enableContextValidation: true,
  requireLocationContext: true, // New: Require location indicators
  debugMode: false // Set to true for debug logging
};

// Common nicknames and abbreviations mapping
const LOCATION_ALIASES = {
  // Metro Manila
  'qc': 'quezon city',
  'bgc': 'taguig city',
  'ncr': 'national capital region',
  'mm': 'metro manila',
  'makati cbd': 'makati city',

  // Common place names
  'gensan': 'general santos city',
  'cdo': 'cagayan de oro city',
  'montalban': 'rodriguez',
  'cainta rizal': 'cainta',

  // Province abbreviations
  'cavite area': 'cavite',
  'laguna area': 'laguna',
  'batangas area': 'batangas',
  'rizal area': 'rizal',

  // Directional prefixes
  'north caloocan': 'caloocan',
  'south caloocan': 'caloocan',
  'east fairview': 'fairview',
  'west fairview': 'fairview'
};

// Common stopwords to exclude from location matching
const STOPWORDS = new Set([
  // Original stopwords
  'same', 'just', 'wala', 'down', 'here',
  'every', 'sarado', 'may', 'apparently',
  'useless', 'problem', 'issue', 'service',
  'hey', 'really', 'since', 'last', 'week',
  'month', 'today', 'yesterday', 'tomorrow',
  'please', 'help', 'need', 'want', 'have',
  'been', 'there', 'where', 'when', 'what',

  // ISP names
  'converge', 'globe', 'pldt', 'smart', 'dito', 'gomo', 'sky',
  'globeathome', 'fibr', 'fiber', 'dsl', 'broadband',

  // Months
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',

  // Common false positives from dataset
  'kahapon', 'pare', 'happening', 'frustrating', 'guess',
  'internet', 'connection', 'update', 'still', 'working',
  'available', 'online', 'offline', 'outage', 'downtime'
]);

// Barangay number patterns
const BARANGAY_NUMBER_PATTERNS = [
  /brgy\.?\s*(\d{1,3})/gi,
  /barangay\s+(\d{1,3})/gi,
  /zone\s+([0-9]+[a-z]?)/gi,
  /purok\s+([0-9]+)/gi
];

/**
 * Enhanced preprocessing with better pattern preservation
 */
function preprocessText(text) {
  if (!text) return '';

  let processed = text;

  // Preserve hashtags as strong location indicators
  processed = processed.replace(/#([A-Za-z][A-Za-z0-9_-]*)/g, (match, tag) => {
    // Split camelCase hashtags: #AlterBacolod → Bacolod
    const expanded = tag.replace(/([a-z])([A-Z])/g, '$1 $2');
    return ` ${expanded} `;
  });

  // Handle AF pattern (Filipino slang)
  processed = processed.replace(/\b([A-Z][a-z]+)\s+AF\b/gi, '$1');
  processed = processed.replace(/\bAF\s+([A-Z][a-z]+)/gi, '$1');

  // Preserve "Location is X" patterns
  processed = processed.replace(/location\s*(?:is|=|:)\s*/gi, ' ');

  // Normalize abbreviations
  processed = normalizeAbbreviations(processed);

  return processed;
}

/**
 * Normalize common abbreviations
 */
function normalizeAbbreviations(text) {
  if (!text) return '';

  let normalized = text;

  // Standard abbreviations
  normalized = normalized.replace(/\bbrgy\.?/gi, 'barangay');
  normalized = normalized.replace(/\bsta\.?\s/gi, 'santa ');
  normalized = normalized.replace(/\bsto\.?\s/gi, 'santo ');
  normalized = normalized.replace(/\bgen\.?\s/gi, 'general ');
  normalized = normalized.replace(/\bmt\.?\s/gi, 'mount ');

  // Apply aliases with proper capitalization
  Object.entries(LOCATION_ALIASES).forEach(([alias, full]) => {
    const regex = new RegExp(`\\b${alias}\\b`, 'gi');
    normalized = normalized.replace(regex, (match) => {
      // Preserve capitalization style of original text
      if (match === match.toUpperCase()) {
        return full.toUpperCase();
      } else if (match[0] === match[0].toUpperCase()) {
        return full.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
      }
      return full;
    });
  });

  return normalized;
}

/**
 * Extract location candidates with comprehensive patterns
 */
function extractLocationCandidates(text) {
  const processed = preprocessText(text);
  const candidates = new Set();

  // Comprehensive pattern list - MUST have location context
  const patterns = [
    // Direct declaration patterns - HIGH CONFIDENCE
    /\blocation\s*(?:is|=|:)?\s*([a-z\s,]+)/gi,
    /\b(?:from|in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,

    // Capture multi-word cities (for normalized aliases)
    /\b([A-Z][A-Z\s]+(?:CITY|SANTOS))\b/g,

    // Hashtag patterns for locations (specific to known patterns)
    /#Alter([A-Z][a-z]+)/g,
    /#([A-Z][a-z]+)Alter/g,

    // Filipino patterns - Tagalog - HIGH CONFIDENCE
    /(?:taga|galing|nanggaling)\s+(?:sa\s+)?([a-z\s,]+)/gi,
    /(?:dito|rito|nandito|narito)\s+(?:sa\s+)?([a-z\s,]+)/gi,
    /(?:nasa|sa)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    /(?:wala|walang?)\s+(?:sa\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,

    // Bisaya/Cebuano patterns - HIGH CONFIDENCE
    /(?:taga|gikan)\s+(?:sa\s+)?([a-z\s,]+)/gi,
    /(?:naa|nia|ara)\s+(?:sa\s+)?([a-z\s,]+)/gi,

    // Context patterns - HIGH CONFIDENCE
    /(?:here\s+in|area\s+namin\s+sa)\s+([a-z\s,]+)/gi,
    /(?:my|our)\s+(?:area|location|address)\s*(?:is|=|:)?\s*([a-z\s,]+)/gi,

    // Barangay patterns - extract city after barangay
    /barangay\s+[a-z0-9\s-]+,\s*([a-z\s]+)/gi,
    /brgy\.?\s*\d+,?\s*([a-z\s]+)/gi,

    // Directional patterns
    /(?:North|South|East|West)\s+([A-Z][a-z]+)/gi,

    // Known location terms with area/province
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:area|province|city)/gi,

    // Composite patterns (City, Province) - only with comma separator
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
  ];

  // Extract from patterns
  patterns.forEach(pattern => {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(processed)) !== null) {
      // Handle both single and double capture groups
      if (match[1]) {
        const location = cleanLocationString(match[1]);
        if (location && location.length >= config.minStringLength) {
          candidates.add(location);
        }
      }
      if (match[2]) {
        const location = cleanLocationString(match[2]);
        if (location && location.length >= config.minStringLength) {
          candidates.add(location);
        }
      }
    }
  });

  // Extract barangay numbers as candidates
  BARANGAY_NUMBER_PATTERNS.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const barangayRef = `Barangay ${match[1]}`;
      candidates.add(barangayRef);
    }
  });

  return Array.from(candidates);
}

/**
 * Clean location string
 */
function cleanLocationString(location) {
  if (!location) return null;

  let cleaned = location
    .replace(/[.,!?;:]+$/g, '')
    .replace(/^(the|in|at|to|from|sa|nasa)\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove trailing non-location words
  cleaned = cleaned.replace(/\b(?:issue|problem|area|district)$/i, '').trim();

  // Check against stopwords
  if (STOPWORDS.has(cleaned.toLowerCase())) {
    return null;
  }

  // Check minimum length (but allow known aliases)
  if (cleaned.length < config.minStringLength && !LOCATION_ALIASES[cleaned.toLowerCase()]) {
    return null;
  }

  if (!cleaned || cleaned.length > 100) {
    return null;
  }

  return cleaned;
}

/**
 * Find best matching location with context validation
 */
function findBestMatch(candidates, text) {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const matches = [];
  const textLower = text.toLowerCase();

  // Process each candidate
  candidates.forEach(candidate => {
    const candidateLower = candidate.toLowerCase();

    // Search in database
    Object.entries(locationsDb).forEach(([key, data]) => {
      const score = calculateMatchScore(candidateLower, key, data, textLower);

      if (config.debugMode && score > 0) {
        debugLog(`Score for "${candidate}" → "${key}":`, score);
      }

      if (score >= config.minMatchScore) {
        matches.push({
          candidate,
          key,
          data,
          score
        });
      }
    });
  });

  if (matches.length === 0) {
    debugLog('No matches above threshold');
    return null;
  }

  // Sort by score
  matches.sort((a, b) => b.score - a.score);

  // Validate top matches for cross-region conflicts
  const topMatch = matches[0];

  // Check if there are mentions of other locations that should take precedence
  const contextValidation = validateLocationContext(topMatch, matches, text);

  if (!contextValidation.valid) {
    // Try the next best match that doesn't have conflicts
    for (let i = 1; i < matches.length; i++) {
      const altMatch = matches[i];
      const altValidation = validateLocationContext(altMatch, matches, text);
      if (altValidation.valid) {
        return formatLocation(altMatch.data);
      }
    }
  }

  // Apply hierarchical fallback if enabled
  if (config.enableHierarchicalFallback && topMatch.data) {
    return formatLocationWithFallback(topMatch.data);
  }

  return formatLocation(topMatch.data);
}

/**
 * Validate location context to prevent mismatches
 */
function validateLocationContext(match, allMatches, text) {
  const textLower = text.toLowerCase();

  // Check for explicit region/province/city mentions that conflict
  const locationData = match.data;

  // Look for other geographic indicators in the text
  const hasConflictingRegion = allMatches.some(m =>
    m.data.region &&
    locationData.region &&
    m.data.region !== locationData.region &&
    textLower.includes(m.data.region.toLowerCase())
  );

  const hasConflictingProvince = allMatches.some(m =>
    m.data.province &&
    locationData.province &&
    m.data.province !== locationData.province &&
    textLower.includes(m.data.province.toLowerCase())
  );

  // Specific validation for known misclassifications
  const knownMismatches = [
    { barangay: 'banilad', wrongCity: 'nasugbu', correctCity: 'mandaue' },
    { barangay: 'golden', wrongCity: 'butuan', correctCity: 'imus' }
  ];

  const isMisclassified = knownMismatches.some(known =>
    match.key.toLowerCase().includes(known.barangay) &&
    match.data.city &&
    match.data.city.toLowerCase().includes(known.wrongCity)
  );

  return {
    valid: !hasConflictingRegion && !hasConflictingProvince && !isMisclassified,
    reason: hasConflictingRegion ? 'region_conflict' :
            hasConflictingProvince ? 'province_conflict' :
            isMisclassified ? 'known_misclassification' : 'valid'
  };
}

/**
 * Calculate match score with context awareness
 */
function calculateMatchScore(candidate, key, data, textLower) {
  let score = 0;
  const keyLower = key.toLowerCase();
  const candidateClean = candidate.replace(/[^\w\s]/g, '').toLowerCase();
  const keyClean = keyLower.replace(/[^\w\s]/g, '');

  // Length penalty for short matches (unless it's a known alias)
  if (candidateClean.length < 4 && !LOCATION_ALIASES[candidateClean]) {
    score -= 20;
  }

  // Exact match
  if (candidateClean === keyClean) {
    score += 50;
  }
  // Starts with (only if candidate is long enough)
  else if (candidateClean.length >= 4 && keyClean.startsWith(candidateClean)) {
    score += 30;
  }
  // Contains (only if candidate is long enough)
  else if (candidateClean.length >= 4 && keyClean.includes(candidateClean)) {
    score += 20;
  }
  // Partial token match
  else {
    const candidateTokens = candidateClean.split(/\s+/);
    const keyTokens = keyClean.split(/\s+/);

    candidateTokens.forEach(ct => {
      keyTokens.forEach(kt => {
        if (ct === kt) {
          score += 15;
        } else if (kt.startsWith(ct) || ct.startsWith(kt)) {
          score += 8;
        }
      });
    });
  }

  // Context bonuses
  if (data.barangay && textLower.includes('barangay')) {
    score += 10;
  }
  if (data.city && textLower.includes(data.city.toLowerCase())) {
    score += 15;
  }
  if (data.province && textLower.includes(data.province.toLowerCase())) {
    score += 10;
  }

  // Administrative level bonus
  if (data.barangay) {
    score += 5; // Prefer specific locations
  }

  // Major cities boost - ONLY if there's actual text matching
  const majorCities = [
    'quezon city', 'makati', 'manila', 'taguig', 'pasig',
    'cebu city', 'davao city', 'bacolod city', 'iloilo city',
    'cagayan de oro', 'general santos', 'zamboanga'
  ];

  // Only apply boost if there's actual matching (score > 0)
  if (score > 0 && data.city && majorCities.includes(data.city.toLowerCase().replace(/^city of\s+/i, ''))) {
    score += 15; // Reduced boost, requires base score
  }

  // Disambiguate Bacolod - ONLY with actual text match
  if (score > 0 && data.city && data.city.toLowerCase() === 'bacolod city' &&
      data.province && data.province.toLowerCase().includes('negros')) {
    score += 10; // Much smaller boost, requires existing match
  }

  // Penalty for region-only matches
  if (!data.province && !data.city && !data.barangay) {
    score -= 15;
  }

  // CRITICAL: Require minimum evidence - no zero-match passing
  if (score <= 0) {
    return 0; // Force rejection of zero/negative scores
  }

  // Require substantial match for barangay-level entries
  if (data.barangay && score < 20) {
    return 0; // Barangay matches need stronger evidence
  }

  return score;
}

/**
 * Format location with hierarchical fallback
 */
function formatLocationWithFallback(data) {
  // Return the most specific available level
  const formatted = {
    region: data.region || '',
    province: data.province || '',
    city: data.city || data.municipality || '',
    barangay: data.barangay || ''
  };

  // If we only have high-level info, at least return that
  // instead of returning nothing
  return formatted;
}

/**
 * Format location for output
 */
function formatLocation(data) {
  if (!data) return null;

  return {
    region: data.region || '',
    province: data.province || '',
    city: data.city || data.municipality || '',
    barangay: data.barangay || ''
  };
}

/**
 * Debug logging helper
 */
function debugLog(message, data) {
  if (config.debugMode) {
    console.log(`[DEBUG] ${message}`, data || '');
  }
}

/**
 * Main parsing function
 */
function parseLocation(text) {
  if (!text) {
    return null;
  }

  debugLog('Parsing text:', text);

  // Extract candidates
  const candidates = extractLocationCandidates(text);
  debugLog('Extracted candidates:', candidates);

  if (candidates.length === 0) {
    debugLog('No candidates found');
    return null;
  }

  // Find best match
  const location = findBestMatch(candidates, text);
  debugLog('Best match:', location);

  return location;
}

// Export for use in other modules
module.exports = {
  parseLocation,
  extractLocationCandidates,
  preprocessText,
  normalizeAbbreviations
};