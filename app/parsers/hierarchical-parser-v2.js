/**
 * Hierarchical Philippine Location Parser V2
 * Enhanced with better pattern recognition and confidence scoring
 */

const { getLocationIndex } = require('./hierarchical-location-index');

// Configuration
const config = {
  minConfidence: 0.3,
  requireLocationContext: false, // Changed: More flexible
  debugMode: false
};

// Location context indicators - EXPANDED
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
  '6am', '10am', '11', // Numeric times

  // Common words that trigger false matches
  'same', 'just', 'wala', 'down', 'here', 'there',
  'every', 'sarado', 'may', 'apparently', 'pare',
  'problem', 'issue', 'service', 'happening', 'frustrating',
  'installed', 'light', 'blinking', 'outage'
]);

// Slang indicators that suggest NOT a location
const SLANG_PATTERNS = [
  /\bAF\b/i,  // "sarado AF malolos"
  /\bhehe\b/i,
  /\bhaha/i,
  /\blol\b/i
];

class HierarchicalLocationParserV2 {
  constructor() {
    this.index = getLocationIndex();
  }

  /**
   * Main parsing function
   */
  parseLocation(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    // Calculate context confidence
    const confidence = this.calculateConfidence(text);
    this.debugLog('Confidence:', confidence);

    // Extract location candidates
    const candidates = this.extractCandidates(text);
    this.debugLog('Candidates:', candidates);

    if (candidates.length === 0) {
      return null;
    }

    // Find best match using hierarchical validation
    const location = this.findBestMatch(candidates, text, confidence);

    return location;
  }

  /**
   * Calculate confidence score for text having location
   */
  calculateConfidence(text) {
    let confidence = 0;

    // Check for strong indicators
    for (const pattern of STRONG_LOCATION_INDICATORS) {
      if (pattern.test(text)) {
        confidence += 0.4;
        break;
      }
    }

    // Check for weak indicators
    for (const pattern of WEAK_LOCATION_INDICATORS) {
      if (pattern.test(text)) {
        confidence += 0.2;
      }
    }

    // Explicit patterns get high confidence
    if (/\bLocation:\s*/i.test(text)) {
      confidence = Math.max(confidence, 0.8);
    }

    // Barangay patterns
    if (/\b(?:brgy|barangay)\.?\s+\w+\s*,\s*\w+/i.test(text)) {
      confidence = Math.max(confidence, 0.7);
    }

    // Area suffix
    if (/\b\w+\s+area\b/i.test(text)) {
      confidence = Math.max(confidence, 0.5);
    }

    // Philippines marker
    if (/PHILIPPINES/i.test(text)) {
      confidence = Math.max(confidence, 0.6);
    }

    // Reduce confidence for slang
    for (const pattern of SLANG_PATTERNS) {
      if (pattern.test(text)) {
        confidence *= 0.3;
        break;
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract potential location candidates from text
   */
  extractCandidates(text) {
    const candidates = [];
    const processed = this.preprocessText(text);

    // Pattern 1: Explicit location declaration
    const locationPattern = /\blocation\s*(?:is|=|:)\s*([^.,]+)/gi;
    let match;
    while ((match = locationPattern.exec(text)) !== null) {
      this.parseCandidateString(candidates, match[1]);
    }

    // Pattern 2: Barangay + City combinations (IMPROVED)
    const barangayPatterns = [
      // "Brgy. 171, North Caloocan"
      /\b(?:brgy|barangay)\.?\s+(\d+)\s*,\s*([^.]+?)(?:\.|$)/gi,
      // "Brgy Navarro Gen Trias"
      /\b(?:brgy|barangay)\.?\s+([A-Za-z][A-Za-z\s]*?)\s+([A-Za-z][A-Za-z\s]+?)(?:\.|,|$)/gi,
      // "Brgy. Name, City"
      /\b(?:brgy|barangay)\.?\s+([A-Za-z][A-Za-z\s]*?)\s*,\s*([^.]+?)(?:\.|$)/gi
    ];

    barangayPatterns.forEach(pattern => {
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
          const barangayName = match[1].match(/^\d+$/) ? `Barangay ${match[1]}` : match[1];
          candidates.push({
            type: 'barangay',
            name: barangayName,
            context: match[2] ? match[2].trim() : null
          });
        }
        if (match[2]) {
          const cityName = this.cleanCityName(match[2]);
          candidates.push({
            type: 'city',
            name: cityName
          });
        }
      }
    });

    // Pattern 3: Comma-separated locations (City, Province)
    const commaPattern = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s*,\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g;
    while ((match = commaPattern.exec(text)) !== null) {
      // Skip if it's a barangay pattern (already handled)
      if (!/^(?:brgy|barangay)/i.test(match[1])) {
        candidates.push({
          type: 'location',
          name: match[1].trim()
        });
        candidates.push({
          type: 'location',
          name: match[2].trim()
        });
      }
    }

    // Pattern 4: Area references (NEW)
    const areaPattern = /\b([A-Za-z][\w\s-]+?)\s+area\b/gi;
    while ((match = areaPattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (!this.isStopword(name)) {
        candidates.push({
          type: 'area',
          name: name
        });
      }
    }

    // Pattern 5: After location indicators
    const contextPatterns = [
      /\b(?:from|in|at)\s+([A-Z][a-zA-Z\s]+?)(?:\.|,|area|$)/g,
      /\b(?:taga|nasa|sa)\s+([a-zA-Z\s]+?)(?:\.|,|area|$)/gi,
      /\b(?:dito|rito)\s+(?:sa\s+)?([a-zA-Z\s]+?)(?:\.|,|area|$)/gi,
      /\b(?:here\s+in)\s+([a-zA-Z\s]+?)(?:\.|,|area|$)/gi,
      /sa\s+area\s+namin\s+sa\s+([a-zA-Z\s]+?)(?:\.|,|$)/gi
    ];

    contextPatterns.forEach(pattern => {
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(processed)) !== null) {
        candidates.push({
          type: 'location',
          name: match[1].trim()
        });
      }
    });

    // Pattern 6: Space-separated location sequences
    // "rosario montalban rizal" -> barangay city province
    const sequencePattern = /\b([a-z]+)\s+([a-z]+)\s+([a-z]+)\b/gi;
    while ((match = sequencePattern.exec(text.toLowerCase())) !== null) {
      // Check if this could be a location sequence
      const words = [match[1], match[2], match[3]];
      if (words.every(w => !this.isStopword(w) && !SERVICE_NAMES.has(w))) {
        candidates.push({
          type: 'sequence',
          parts: words
        });
      }
    }

    // Pattern 7: Philippines marker
    if (/PHILIPPINES/i.test(text)) {
      // Extract what comes before PHILIPPINES
      const beforePhilippines = text.match(/([^,]+?)\s*,?\s*PHILIPPINES/i);
      if (beforePhilippines) {
        this.parseCandidateString(candidates, beforePhilippines[1]);
      }
    }

    return candidates;
  }

  /**
   * Parse a candidate string into structured candidates
   */
  parseCandidateString(candidates, str) {
    if (!str) return;

    const parts = str.split(/[,\s]+/).filter(p => p.length > 2);
    parts.forEach(part => {
      if (!this.isStopword(part)) {
        candidates.push({
          type: 'location',
          name: part
        });
      }
    });
  }

  /**
   * Clean and normalize city name
   */
  cleanCityName(cityName) {
    if (!cityName) return '';

    let cleaned = cityName.trim();

    // Remove slang/noise
    cleaned = cleaned.replace(/\b(hehe|haha|lol)\b/gi, '').trim();

    // Handle directional prefixes
    cleaned = cleaned.replace(/^(North|South|East|West)\s+/i, '');

    // Expand common abbreviations
    const abbreviations = {
      'gen trias': 'General Trias',
      'qc': 'Quezon City',
      'bgc': 'Taguig',
      'montalban': 'Rodriguez'
    };

    const lower = cleaned.toLowerCase();
    if (abbreviations[lower]) {
      return abbreviations[lower];
    }

    return cleaned;
  }

  /**
   * Check if word is a stopword
   */
  isStopword(word) {
    if (!word) return true;
    const lower = word.toLowerCase();
    return STOPWORDS.has(lower) || SERVICE_NAMES.has(lower) || /^\d+$/.test(word);
  }

  /**
   * Preprocess text for better pattern matching
   */
  preprocessText(text) {
    let processed = text;

    // Handle hashtags
    processed = processed.replace(/#([A-Za-z][A-Za-z0-9]*)/g, (match, tag) => {
      return ' ' + tag.replace(/([a-z])([A-Z])/g, '$1 $2');
    });

    // Normalize common abbreviations
    processed = processed.replace(/\bQC\b/gi, 'Quezon City');
    processed = processed.replace(/\bBGC\b/gi, 'Taguig');
    processed = processed.replace(/\bGensan\b/gi, 'General Santos');
    processed = processed.replace(/\bCDO\b/gi, 'Cagayan de Oro');
    processed = processed.replace(/\bGen\s+Trias\b/gi, 'General Trias');

    return processed;
  }

  /**
   * Find best match using hierarchical validation
   */
  findBestMatch(candidates, fullText, confidence) {
    const textLower = fullText.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    // Process different candidate types
    for (const candidate of candidates) {
      let locationMatch = null;
      let score = 0;

      if (candidate.type === 'barangay') {
        // Handle barangay with context
        const barangayMatch = this.index.findBarangay(
          candidate.name,
          candidate.context
        );

        if (barangayMatch) {
          locationMatch = barangayMatch;
          score = 0.8; // High score for barangay+city
        }
      } else if (candidate.type === 'area') {
        // Try to match as barangay or city
        const barangayMatch = this.index.findBarangay(candidate.name);
        const cityMatch = this.index.findCity(candidate.name);

        if (barangayMatch && barangayMatch.length === 1) {
          locationMatch = barangayMatch[0];
          score = 0.6;
        } else if (cityMatch) {
          locationMatch = {
            region: cityMatch.region,
            province: cityMatch.province,
            city: cityMatch.city,
            barangay: ''
          };
          score = 0.7;
        }
      } else if (candidate.type === 'sequence') {
        // Try to match as barangay-city-province
        const [first, second, third] = candidate.parts;

        // Check if it's a valid hierarchy
        const barangayMatch = this.index.findBarangay(first, second);
        if (barangayMatch) {
          locationMatch = barangayMatch;
          score = 0.7;
        }
      } else {
        // Generic location candidate
        const name = candidate.name;

        // Try as barangay
        const barangayMatch = this.index.findBarangay(name);
        if (barangayMatch && !this.index.isAmbiguousBarangay(name)) {
          locationMatch = barangayMatch;
          score = 0.5;
        }

        // Try as city
        const cityMatch = this.index.findCity(name);
        if (cityMatch) {
          locationMatch = {
            region: cityMatch.region,
            province: cityMatch.province,
            city: cityMatch.city,
            barangay: ''
          };
          score = 0.6;
        }

        // Try as province
        const provinceMatch = this.index.findProvince(name);
        if (provinceMatch) {
          locationMatch = {
            region: provinceMatch.region,
            province: provinceMatch.province,
            city: '',
            barangay: ''
          };
          score = 0.4;
        }
      }

      // Apply confidence boost
      if (locationMatch) {
        score *= (1 + confidence);

        if (score > bestScore) {
          bestScore = score;
          bestMatch = locationMatch;
        }
      }
    }

    // Apply minimum confidence threshold
    if (bestScore < config.minConfidence) {
      return null;
    }

    return bestMatch;
  }

  /**
   * Debug logging
   */
  debugLog(message, data) {
    if (config.debugMode) {
      console.log(`[HIERARCHICAL-V2] ${message}`, data || '');
    }
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled) {
    config.debugMode = enabled;
  }
}

// Export
module.exports = {
  HierarchicalLocationParserV2,
  parseLocation: (text) => {
    const parser = new HierarchicalLocationParserV2();
    return parser.parseLocation(text);
  }
};