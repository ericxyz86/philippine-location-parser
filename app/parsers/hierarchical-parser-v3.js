/**
 * Hierarchical Philippine Location Parser V3
 * Enhanced with Excel data integration for comprehensive location matching
 */

const { getLocationIndex } = require('./hierarchical-location-index');
const { getInstance: getExcelIndex } = require('./excel-location-index');

// Configuration
const config = {
  minConfidence: 0.3,
  requireLocationContext: false,
  debugMode: false,
  useExcelData: true // Enable Excel data matching
};

// Location context indicators
const STRONG_LOCATION_INDICATORS = [
  /\b(?:location|address)\s*(?:is|=|:)\s*/i,
  /\bhere\s+in\b/i,
  /\b(?:from|at)\s+/i,
  /\b(?:taga|dito|rito|nasa|sa)\s+/i,
  /,\s*PHILIPPINES\s*$/i
];

const WEAK_LOCATION_INDICATORS = [
  /\b(?:in|near|around)\s+/i,
  /\s+area\b/i,
  /\b(?:my|our|aming)\s+(?:area|location|place)\s+/i,
  /sa\s+area\s+namin\s+sa/i
];

// ISPs and services that should NOT be locations
const SERVICE_NAMES = new Set([
  'globe', 'smart', 'pldt', 'converge', 'dito', 'sky', 'gomo',
  'fibr', 'fiber', 'dsl', 'broadband', 'wifi', 'internet',
  'globeathome', 'skyfiber', 'smartbro', 'los', 'red'
]);

// Common non-location words
const STOPWORDS = new Set([
  // Time references
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'today', 'yesterday', 'tomorrow', 'kahapon', 'bukas', 'ngayon',
  '6am', '10am', '11',

  // Common words
  'same', 'just', 'wala', 'down', 'here', 'there',
  'every', 'sarado', 'may', 'apparently', 'pare',
  'so', 'since', 'after', 'before', 'during', 'about',
  'issue', 'problem', 'happening', 'trending', 'alter'
]);

/**
 * Calculate confidence score for location extraction
 */
function calculateConfidence(text, hasExplicitLocation) {
  let confidence = 0.5; // Base confidence

  // Boost for explicit location formats
  if (/\bLocation:\s*/i.test(text)) {
    confidence = Math.max(confidence, 0.8);
  }

  // Strong location indicators
  for (const pattern of STRONG_LOCATION_INDICATORS) {
    if (pattern.test(text)) {
      confidence += 0.2;
      break;
    }
  }

  // Weak location indicators
  for (const pattern of WEAK_LOCATION_INDICATORS) {
    if (pattern.test(text)) {
      confidence += 0.1;
      break;
    }
  }

  // Clear barangay pattern
  if (/\b(?:brgy?\.?|barangay)\s+\d+/i.test(text)) {
    confidence += 0.3;
  }

  // Specific location patterns
  if (/\b(?:city|province|municipality)\b/i.test(text)) {
    confidence += 0.2;
  }

  // Reduce confidence for negative indicators
  if (/\b(?:wala|walang|no|none|hindi|not)\b/i.test(text)) {
    confidence -= 0.3;
  }

  // Service/ISP mentions reduce confidence
  const lowerText = text.toLowerCase();
  for (const service of SERVICE_NAMES) {
    if (lowerText.includes(service)) {
      confidence -= 0.2;
    }
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Check if text contains service/ISP names
 */
function containsServiceName(text) {
  const lowerText = text.toLowerCase();
  for (const service of SERVICE_NAMES) {
    if (lowerText.includes(service)) {
      return true;
    }
  }
  return false;
}

/**
 * Main parser function
 */
function parseLocation(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const locationIndex = getLocationIndex();
  const excelIndex = getExcelIndex();

  // First, try Excel data matching (most comprehensive)
  if (config.useExcelData && excelIndex.initialized) {
    const excelMatch = excelIndex.findLocation(text);
    if (excelMatch && excelMatch.confidence >= 0.7) {
      if (config.debugMode) {
        console.log('Excel match found:', excelMatch);
      }
      return {
        region: excelMatch.region,
        province: excelMatch.province,
        city: excelMatch.city,
        barangay: excelMatch.barangay,
        confidence: excelMatch.confidence,
        source: 'excel'
      };
    }
  }

  // Fallback to original hierarchical parser
  const normalizedText = text.replace(/[^\w\s,.-]/g, ' ').trim();
  const hasExplicitLocation = STRONG_LOCATION_INDICATORS.some(pattern =>
    pattern.test(normalizedText)
  );

  // Check for service names early
  if (containsServiceName(normalizedText) && !hasExplicitLocation) {
    if (config.debugMode) {
      console.log('Service name detected without explicit location context');
    }
    return null;
  }

  // Try to extract location using patterns
  const location = extractLocationFromPatterns(normalizedText, locationIndex);

  if (!location) {
    // Try Excel data with lower confidence threshold
    if (config.useExcelData && excelIndex.initialized) {
      const excelMatch = excelIndex.findLocation(text);
      if (excelMatch && excelMatch.confidence >= 0.5) {
        const confidence = calculateConfidence(text, hasExplicitLocation);
        if (confidence >= config.minConfidence) {
          return {
            ...excelMatch,
            confidence: confidence,
            source: 'excel-fallback'
          };
        }
      }
    }
    return null;
  }

  // Calculate final confidence
  const confidence = calculateConfidence(text, hasExplicitLocation);

  // Validate with Excel data if available
  if (config.useExcelData && excelIndex.initialized) {
    const isValid = excelIndex.validateLocation(location);
    if (!isValid && confidence < 0.6) {
      if (config.debugMode) {
        console.log('Location failed Excel validation:', location);
      }
      return null;
    }
  }

  if (confidence < config.minConfidence) {
    if (config.debugMode) {
      console.log(`Confidence ${confidence} below threshold ${config.minConfidence}`);
    }
    return null;
  }

  return {
    ...location,
    confidence: confidence,
    source: 'pattern'
  };
}

/**
 * Extract location using pattern matching
 */
function extractLocationFromPatterns(text, locationIndex) {
  // Try barangay patterns first (most specific)
  const barangayPatterns = [
    /\b(?:brgy?\.?|barangay)\s+(\d+)[,\s]+(?:north|south|east|west)?\s*([a-z\s]+?)(?:\s+(?:city|area))?\b/i,
    /\b(?:brgy?\.?|barangay)\s+([a-z0-9\s]+?)[,\s]+([a-z\s]+?)(?:\s+(?:city|area))?\b/i,
    /\b(?:brgy?\.?|barangay)\s+(\S+)/i
  ];

  for (const pattern of barangayPatterns) {
    const match = text.match(pattern);
    if (match) {
      const barangayName = match[1].trim();
      const cityName = match[2] ? match[2].trim() : null;

      if (cityName) {
        // Try Excel index first for better matching
        const excelIndex = getExcelIndex();
        if (excelIndex.initialized) {
          const normalized = `${barangayName} ${cityName}`;
          const result = excelIndex.findLocation(normalized);
          if (result) return result;
        }

        // Fallback to original index
        const barangayResult = locationIndex.findBarangay(barangayName);
        if (barangayResult) return barangayResult;
      }

      const barangayResult = locationIndex.findBarangay(barangayName);
      if (barangayResult) return barangayResult;
    }
  }

  // Try city patterns
  const cityPatterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:City|city)\b/,
    /\b(?:taga|from|sa|in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/i,
    /\bLocation\s*(?:is|:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
  ];

  for (const pattern of cityPatterns) {
    const match = text.match(pattern);
    if (match) {
      const cityName = match[1].trim();

      // Skip if it's a stopword
      if (STOPWORDS.has(cityName.toLowerCase())) continue;

      const cityResult = locationIndex.findCity(cityName);
      if (cityResult) return cityResult;
    }
  }

  // Try province patterns
  const provincePatterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Province|province)\b/,
    /\b(?:province\s+of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/i
  ];

  for (const pattern of provincePatterns) {
    const match = text.match(pattern);
    if (match) {
      const provinceName = match[1].trim();
      const provinceResult = locationIndex.findProvince(provinceName);
      if (provinceResult) return provinceResult;
    }
  }

  return null;
}

module.exports = {
  parseLocation,
  calculateConfidence,
  config
};