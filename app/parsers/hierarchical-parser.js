/**
 * Hierarchical Philippine Location Parser
 * Uses proper administrative hierarchy for accurate location extraction
 * Prevents false positives through context validation
 */

const { getLocationIndex } = require('./hierarchical-location-index');

// Configuration
const config = {
  minConfidence: 0.5,
  requireLocationContext: true,
  debugMode: false
};

// Location context indicators
const LOCATION_INDICATORS = [
  /\b(?:location|address)\s*(?:is|=|:)\s*/i,
  /\b(?:from|in|at|near|around)\s+/i,
  /\b(?:taga|dito|rito|nasa|sa|mula)\s+/i,
  /\b(?:here\s+in|area\s+(?:ko|namin|natin))\s+/i,
  /\b(?:my|our|aming)\s+(?:area|location|place)\s+/i
];

// ISPs and services that should NOT be locations
const SERVICE_NAMES = new Set([
  'globe', 'smart', 'pldt', 'converge', 'dito', 'sky', 'gomo',
  'fibr', 'fiber', 'dsl', 'broadband', 'wifi', 'internet',
  'globeathome', 'skyfiber', 'smartbro'
]);

// Common non-location words
const STOPWORDS = new Set([
  // Time references
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'today', 'yesterday', 'tomorrow', 'kahapon', 'bukas', 'ngayon',

  // Common words that trigger false matches
  'same', 'just', 'wala', 'down', 'here', 'there',
  'every', 'sarado', 'may', 'apparently', 'pare',
  'problem', 'issue', 'service', 'happening', 'frustrating'
]);

class HierarchicalLocationParser {
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

    // Check if text has location context
    if (config.requireLocationContext && !this.hasLocationContext(text)) {
      this.debugLog('No location context found');
      return null;
    }

    // Extract location candidates
    const candidates = this.extractCandidates(text);
    this.debugLog('Candidates:', candidates);

    if (candidates.length === 0) {
      return null;
    }

    // Find best match using hierarchical validation
    const location = this.findBestMatch(candidates, text);

    return location;
  }

  /**
   * Check if text contains location indicators
   */
  hasLocationContext(text) {
    // Special case: explicit location declaration
    if (/\blocation\s*(?:is|=|:)/i.test(text)) {
      return true;
    }

    // Check for other location indicators
    return LOCATION_INDICATORS.some(pattern => pattern.test(text));
  }

  /**
   * Extract potential location candidates from text
   */
  extractCandidates(text) {
    const candidates = new Set();
    const processed = this.preprocessText(text);

    // Pattern 1: Explicit location declaration
    const locationPattern = /\blocation\s*(?:is|=|:)\s*([a-zA-Z\s,]+)/gi;
    let match;
    while ((match = locationPattern.exec(processed)) !== null) {
      this.addCandidate(candidates, match[1]);
    }

    // Pattern 2: After location indicators (from, in, at, etc.)
    const contextPatterns = [
      /\b(?:from|in|at)\s+([A-Z][a-zA-Z\s]+?)(?:\.|,|$)/g,
      /\b(?:taga|nasa|sa)\s+([a-zA-Z\s]+?)(?:\.|,|$)/gi,
      /\b(?:dito|rito)\s+(?:sa\s+)?([a-zA-Z\s]+?)(?:\.|,|$)/gi,
      /\b(?:here\s+in)\s+([a-zA-Z\s]+?)(?:\.|,|$)/gi
    ];

    contextPatterns.forEach(pattern => {
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(processed)) !== null) {
        this.addCandidate(candidates, match[1]);
      }
    });

    // Pattern 3: Barangay patterns - IMPROVED
    const barangayPatterns = [
      /\b(?:brgy|barangay)\.?\s*(\d+)(?:\s*,\s*([a-zA-Z\s]+))?/gi,
      /\b(?:brgy|barangay)\.?\s+([a-zA-Z\s]+?)(?:\s*,\s*([a-zA-Z\s]+))?/gi
    ];

    barangayPatterns.forEach(pattern => {
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {  // Use original text for barangay patterns
        if (match[1]) {
          const barangayName = match[1].match(/^\d+$/) ? `Barangay ${match[1]}` : match[1];
          this.addCandidate(candidates, barangayName);
        }
        if (match[2]) {
          // Clean up the city name
          const cityName = match[2].replace(/\bhehe\b/gi, '').trim();
          if (cityName) {
            // Handle "North Caloocan" -> "Caloocan"
            const cleanCity = cityName.replace(/^(North|South|East|West)\s+/i, '');
            this.addCandidate(candidates, cleanCity);
            if (cleanCity !== cityName) {
              this.addCandidate(candidates, cityName);  // Also add full name
            }
          }
        }
      }
    });

    // Pattern 4: City/Province with "area" or "province"
    const areaPattern = /\b([A-Z][a-zA-Z\s]+?)\s+(?:area|province|city)/gi;
    while ((match = areaPattern.exec(processed)) !== null) {
      this.addCandidate(candidates, match[1]);
      // Also add with "City" suffix if not already there
      if (!match[1].toLowerCase().includes('city')) {
        this.addCandidate(candidates, match[1] + ' City');
      }
    }

    // Pattern 5: Comma-separated locations (City, Province)
    const commaPattern = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s*,\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g;
    while ((match = commaPattern.exec(text)) !== null) {
      this.addCandidate(candidates, match[1]);
      this.addCandidate(candidates, match[2]);

      // Handle "City" suffix variations
      if (match[1].toLowerCase().includes('city') && !match[1].endsWith('City')) {
        this.addCandidate(candidates, match[1].replace(/\bcity\b/i, 'City'));
      }
    }

    // Pattern 6: Standalone city names with "City" suffix
    const cityPattern = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+City)\b/g;
    while ((match = cityPattern.exec(text)) !== null) {
      this.addCandidate(candidates, match[1]);
    }

    return Array.from(candidates);
  }

  /**
   * Add candidate to set after validation
   */
  addCandidate(candidates, text) {
    if (!text) return;

    const cleaned = text.trim();

    // Skip if too short
    if (cleaned.length < 3) return;

    // Skip if it's a service name
    const lower = cleaned.toLowerCase();
    if (SERVICE_NAMES.has(lower)) return;

    // Skip if it's a stopword
    if (STOPWORDS.has(lower)) return;

    // Skip if it's just numbers
    if (/^\d+$/.test(cleaned)) return;

    candidates.add(cleaned);
  }

  /**
   * Preprocess text for better pattern matching
   */
  preprocessText(text) {
    let processed = text;

    // Handle hashtags
    processed = processed.replace(/#([A-Za-z][A-Za-z0-9]*)/g, (match, tag) => {
      // Split camelCase: #AlterBacolod → Bacolod
      if (tag.includes('Alter')) {
        return tag.replace(/Alter/g, ' ');
      }
      return ' ' + tag.replace(/([a-z])([A-Z])/g, '$1 $2');
    });

    // Normalize common abbreviations
    processed = processed.replace(/\bQC\b/gi, 'Quezon City');
    processed = processed.replace(/\bBGC\b/gi, 'Taguig');
    processed = processed.replace(/\bGensan\b/gi, 'General Santos');
    processed = processed.replace(/\bCDO\b/gi, 'Cagayan de Oro');

    return processed;
  }

  /**
   * Find best match using hierarchical validation
   */
  findBestMatch(candidates, fullText) {
    const textLower = fullText.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    // Extract all possible contexts from text
    const contexts = this.extractContexts(candidates, fullText);

    for (const candidate of candidates) {
      // Try to match as barangay
      const barangayMatch = this.index.findBarangay(
        candidate,
        contexts.city,
        contexts.province
      );

      if (barangayMatch) {
        const score = this.scoreMatch(barangayMatch, fullText, 'barangay');
        if (score > bestScore) {
          bestScore = score;
          bestMatch = barangayMatch;
        }
      }

      // Try to match as city
      const cityMatch = this.index.findCity(candidate, contexts.province);
      if (cityMatch) {
        const score = this.scoreMatch(cityMatch, fullText, 'city');
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            region: cityMatch.region,
            province: cityMatch.province,
            city: cityMatch.city,
            barangay: ''
          };
        }
      }

      // Try to match as province
      const provinceMatch = this.index.findProvince(candidate);
      if (provinceMatch) {
        const score = this.scoreMatch(provinceMatch, fullText, 'province');
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            region: provinceMatch.region,
            province: provinceMatch.province,
            city: '',
            barangay: ''
          };
        }
      }
    }

    // Validate the match
    if (bestMatch && !this.validateMatch(bestMatch, fullText)) {
      return null;
    }

    return bestMatch;
  }

  /**
   * Extract context (city, province) from candidates
   */
  extractContexts(candidates, text) {
    const contexts = {
      city: null,
      province: null
    };

    // Look for city mentions
    for (const candidate of candidates) {
      const cityMatch = this.index.findCity(candidate);
      if (cityMatch && cityMatch.length === 1) {
        contexts.city = candidate;
        contexts.province = cityMatch[0].province;
        break;
      }
    }

    // Look for province mentions
    for (const candidate of candidates) {
      const provinceMatch = this.index.findProvince(candidate);
      if (provinceMatch) {
        contexts.province = candidate;
        break;
      }
    }

    return contexts;
  }

  /**
   * Score a match based on context and completeness
   */
  scoreMatch(match, text, type) {
    let score = 0;
    const textLower = text.toLowerCase();

    // Base score by type
    if (type === 'barangay') {
      score += 30;

      // Boost if city is also mentioned
      if (match.city && textLower.includes(match.city.toLowerCase())) {
        score += 40;
      }

      // Boost if province is also mentioned
      if (match.province && textLower.includes(match.province.toLowerCase())) {
        score += 20;
      }

      // Penalize ambiguous barangay without context
      if (this.index.isAmbiguousBarangay(match.barangay)) {
        if (!textLower.includes(match.city.toLowerCase())) {
          score -= 50; // Heavy penalty
        }
      }
    } else if (type === 'city') {
      score += 50;

      // Boost if province is also mentioned
      if (match.province && textLower.includes(match.province.toLowerCase())) {
        score += 30;
      }
    } else if (type === 'province') {
      score += 40;
    }

    // Boost for explicit location declaration
    if (/\blocation\s*(?:is|=|:)/i.test(text)) {
      score += 20;
    }

    return score;
  }

  /**
   * Validate that a match makes sense in context
   */
  validateMatch(match, text) {
    // Don't allow barangay-only matches for ambiguous barangays
    if (match.barangay && !match.city) {
      if (this.index.isAmbiguousBarangay(match.barangay)) {
        this.debugLog('Rejecting ambiguous barangay without city context');
        return false;
      }
    }

    // Don't allow matches that are just common words
    if (match.barangay) {
      const barangayLower = match.barangay.toLowerCase();
      if (STOPWORDS.has(barangayLower)) {
        return false;
      }
    }

    // Require stronger evidence for single-word matches
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 5 && !this.hasLocationContext(text)) {
      this.debugLog('Rejecting due to insufficient context');
      return false;
    }

    return true;
  }

  /**
   * Debug logging
   */
  debugLog(message, data) {
    if (config.debugMode) {
      console.log(`[HIERARCHICAL] ${message}`, data || '');
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
  HierarchicalLocationParser,
  parseLocation: (text) => {
    const parser = new HierarchicalLocationParser();
    return parser.parseLocation(text);
  }
};