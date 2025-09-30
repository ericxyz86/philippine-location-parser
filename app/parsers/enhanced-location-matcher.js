/**
 * Enhanced Location Matcher with False Positive Prevention
 * Implements word boundary checking and context validation
 */

const { getInstance: getExcelIndex } = require('./excel-location-index');
const {
  isFalsePositive,
  hasLocationContext,
  extractWordWithBoundaries,
  validateLocationCandidate,
  preprocessTextForParsing
} = require('../utils/false-positive-filter');

const EXPLICIT_LOCATION_PATTERNS = [
  /\blocation\s*[:=]\s*[a-z]/i,
  /\baddress\s*[:=]\s*[a-z]/i,
  /\b(?:based|living|staying|working)\s+in\b/i,
  /\bhere\s+in\b/i,
  /\btaga\s+[a-z]/i
];

const IMPLICIT_LOCATION_PATTERNS = [
  /\b(?:dito|rito)\s+sa\s+[a-z]/i,
  /\b(?:around|near)\s+[a-z]/i,
  /\b(?:area|place)\s+(?:ng|of)\s+[a-z]/i,
  /\b(?:nasa|nandito|narito)\s+[a-z]/i,
  /\b(?:living|staying|working|based)\s+in\s+[a-z]/i
];

const LOCATION_INDICATOR_WORDS = [
  'area', 'place', 'living', 'based', 'staying', 'work', 'working',
  'dito', 'rito', 'nasa', 'location', 'address', 'near', 'around',
  'taga', 'sa', 'based in', 'here in'
];

const NEGATIVE_CONTEXT_PATTERNS = [
  /\bwalang?\s+(?:internet|signal|connection)/i,
  /\bno\s+(?:internet|connection|signal)/i,
  /\b(?:wala|walang|hindi)\s+location/i,
  /\b(?:issue|problem)\s+(?:dito|rito)/i
];

const HASHTAG_PREFIXES = [
  'alter',
  'globe',
  'globeat',
  'globeone',
  'globehome',
  'globedown',
  'globefiber',
  'gfiber',
  'gowith',
  'goforward'
];

class EnhancedLocationMatcher {
  constructor() {
    this.excelIndex = getExcelIndex();

    // Location aliases for common abbreviations
    this.locationAliases = {
      'qc': 'quezon city',
      'bgc': 'taguig',
      'gensan': 'general santos',
      'cdo': 'cagayan de oro',
      'dt': 'downtown',
      'mnl': 'manila',
      'mkt': 'makati'
    };
  }

  /**
   * Find location with word boundary enforcement
   */
  findLocationWithBoundaries(text, originalText = null) {
    if (!text || !this.excelIndex.initialized) {
      return null;
    }

    // Use original text for context checking if provided
    const contextText = originalText || text;

    const hashtagMatch = this.findHashtagLocation(contextText);
    if (hashtagMatch) {
      return hashtagMatch;
    }

    // Pre-process to remove false positive triggers
    const processedText = preprocessTextForParsing(text);
    const expandedText = this.expandAliases(processedText);
    const normalizedText = this.normalizeForMatching(expandedText);

    // First, check for Filipino patterns
    const filipinoMatch = this.findFilipinoPatterns(normalizedText, contextText);
    if (filipinoMatch) {
      return filipinoMatch;
    }

    // Check for comma-separated locations
    const commaMatch = this.findCommaSeparatedLocation(normalizedText, contextText);
    if (commaMatch) {
      return commaMatch;
    }

    // Result object
    const result = {
      region: null,
      province: null,
      city: null,
      barangay: null,
      confidence: 0,
      validationDetails: []
    };

    // Try barangay (most specific) with validation
    const barangayMatch = this.findBarangayWithValidation(normalizedText, contextText);
    if (barangayMatch && barangayMatch.confidence >= 0.7) {
      return barangayMatch;
    }

    // Try city with validation
    const cityMatch = this.findCityWithValidation(normalizedText, contextText);
    if (cityMatch && cityMatch.confidence >= 0.6) {
      return cityMatch;
    }

    // Try province with validation
    const provinceMatch = this.findProvinceWithValidation(normalizedText, contextText);
    if (provinceMatch && provinceMatch.confidence >= 0.5) {
      return provinceMatch;
    }

    // No valid location found
    return null;
  }

  /**
   * Find barangay with validation
   */
  findBarangayWithValidation(text, originalText) {
    // Special handling for numeric barangays with city
    const numericPattern = /\b(?:brgy\.?|barangay|brg\.?)\s+(\d+[a-z]?)\s*,?\s*([a-z]+(?:\s+[a-z]+)*)/i;
    const numericMatch = text.match(numericPattern);

    if (numericMatch && numericMatch[2]) {
      const barangayNum = numericMatch[1];
      let cityName = numericMatch[2].trim();
      console.log(`Numeric barangay matched: "Brgy. ${barangayNum}" in "${cityName}"`);

      // Handle directional prefixes
      if (cityName.toLowerCase().includes('north caloocan')) {
        cityName = 'caloocan';
      } else if (cityName.toLowerCase().includes('south caloocan')) {
        cityName = 'caloocan';
      } else if (cityName.toLowerCase().startsWith('north ')) {
        cityName = cityName.substring(6);
      } else if (cityName.toLowerCase().startsWith('south ')) {
        cityName = cityName.substring(6);
      }

      // Find the city first
      const cityData = this.findInDatabase(cityName, 'city');
      if (cityData) {
        return {
          ...cityData,
          barangay: `Barangay ${barangayNum}`,
          confidence: 0.8,
          validationDetails: ['Numeric barangay with city']
        };
      }

      // Even if city not found, return what we matched
      return {
        region: 'None',
        province: 'None',
        city: cityName.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' '),
        barangay: `Barangay ${barangayNum}`,
        confidence: 0.6,
        validationDetails: ['Numeric barangay pattern']
      };
    }

    const patterns = [
      /\b(?:brgy\.?|barangay|brg\.?)\s+([a-z0-9\s]+?)(?:\b|,|\s+(?:north|south|east|west))/i,
      /\b(?:brgy\.?|barangay|brg\.?)\s+(\d+[a-z]?)\b/i,  // Support numeric barangays like "171A"
      /\b(?:brgy\.?|barangay|brg\.?)\s+(\d+)\b/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const barangayName = match[1].trim();

        // Validate it's not a false positive
        const validation = validateLocationCandidate(barangayName, originalText);
        if (!validation.isValid) {
          continue;
        }

        // Look up in Excel index
        const candidates = this.excelIndex.barangayIndex.get(
          this.excelIndex.normalize(barangayName)
        );

        if (candidates && candidates.length > 0) {
          // Calculate confidence based on context
          const confidence = this.calculateConfidence(originalText, 'barangay', true, {
            ambiguous: candidates.length > 1
          });

          if (candidates.length === 1) {
            return {
              ...candidates[0],
              confidence,
              validationDetails: ['Word boundary validated', 'Context validated']
            };
          }

          // Try to disambiguate with city
          for (const candidate of candidates) {
            if (this.hasWordBoundaryMatch(text, candidate.city)) {
              return {
                ...candidate,
                confidence: Math.min(confidence + 0.1, 1.0),
                validationDetails: ['Disambiguated by city context']
              };
            }
          }

          // Return best match
          return {
            ...candidates[0],
            confidence: Math.max(confidence - 0.1, 0.2),
            validationDetails: ['Multiple matches, selected first']
          };
        }
      }
    }

    return null;
  }

  /**
   * Find city with validation
   */
  findCityWithValidation(text, originalText) {
    // Check all cities with word boundary enforcement
    for (const [cityName, candidates] of this.excelIndex.cityIndex) {
      // Skip single/two letter cities to avoid false matches
      if (cityName.length <= 2) continue;

      // Check for word boundary match
      if (!this.hasWordBoundaryMatch(text, cityName)) {
        continue;
      }

      // Validate it's not a false positive
      const validation = validateLocationCandidate(cityName, originalText);
      if (!validation.isValid) {
        continue;
      }

      // Calculate confidence
      const confidence = this.calculateConfidence(originalText, 'city', true, {
        ambiguous: candidates.length > 1
      });

      if (candidates.length === 1) {
        return {
          ...candidates[0],
          confidence,
          validationDetails: ['Word boundary validated', validation.reason]
        };
      }

      // Disambiguate with province
      for (const candidate of candidates) {
        if (this.hasWordBoundaryMatch(text, candidate.province)) {
          return {
            ...candidate,
            confidence: Math.min(confidence + 0.1, 1.0),
            validationDetails: ['Disambiguated by province']
          };
        }
      }

      return {
        ...candidates[0],
        confidence: Math.max(confidence - 0.1, 0.2),
        validationDetails: ['Multiple matches possible']
      };
    }

    return null;
  }

  /**
   * Find province with validation
   */
  findProvinceWithValidation(text, originalText) {
    for (const [provinceName, province] of this.excelIndex.provinceIndex) {
      // Skip very short province names
      if (provinceName.length <= 3) continue;

      // Check word boundary match
      if (!this.hasWordBoundaryMatch(text, provinceName)) {
        continue;
      }

      // Validate
      const validation = validateLocationCandidate(provinceName, originalText);
      if (!validation.isValid) {
        continue;
      }

      const confidence = this.calculateConfidence(originalText, 'province', true);

      // Allow province-only results
      return {
        region: province.region || null,
        province: province.name || provinceName,
        city: 'None',  // Don't require city
        barangay: 'None',
        confidence,
        validationDetails: ['Province-level match', 'Word boundary validated']
      };
    }

    return null;
  }

  /**
   * Check if text contains word with proper boundaries
   */
  hasWordBoundaryMatch(text, word) {
    if (!word || word.length === 0) return false;

    // Normalize both for comparison
    const normalizedWord = this.excelIndex.normalize(word);
    const normalizedText = this.excelIndex.normalize(text);

    // Create word boundary pattern
    // Account for Filipino text patterns where words might be connected
    const patterns = [
      new RegExp(`\\b${this.escapeRegex(normalizedWord)}\\b`),
      new RegExp(`^${this.escapeRegex(normalizedWord)}\\b`),
      new RegExp(`\\b${this.escapeRegex(normalizedWord)}$`),
      new RegExp(`\\b${this.escapeRegex(normalizedWord)}\\s*,`),
      new RegExp(`,\\s*${this.escapeRegex(normalizedWord)}\\b`)
    ];

    return patterns.some(pattern => pattern.test(normalizedText));
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(text, locationType, hasValidContext = false, options = {}) {
    let score = 35;

    const typeBoosts = {
      barangay: 25,
      city: 20,
      province: 15,
      region: 10
    };
    score += typeBoosts[locationType] || 0;

    if (hasValidContext) {
      score += 15;
    }

    if (hasExplicitLocationDeclaration(text)) {
      score += 25;
    }

    if (hasImplicitLocationPattern(text)) {
      score += 15;
    }

    if (hasStrongLocationIndicators(text)) {
      score += 10;
    }

    if (options.hashtag) {
      score += 20;
    }

    if (options.ambiguous) {
      score -= 10;
    }

    if (options.partial) {
      score -= 5;
    }

    if (NEGATIVE_CONTEXT_PATTERNS.some(pattern => pattern.test(text))) {
      score -= 25;
    }

    score = Math.max(20, Math.min(95, score));

    return score / 100;
  }

  /**
   * Normalize text for matching
   */
  normalizeForMatching(text) {
    return text
      .replace(/[^\w\s,.\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Expand location aliases
   */
  expandAliases(text) {
    let expanded = text;
    for (const [alias, full] of Object.entries(this.locationAliases)) {
      const regex = new RegExp(`\\b${alias}\\b`, 'gi');
      expanded = expanded.replace(regex, full);
    }
    return expanded;
  }

  /**
   * Find Filipino location patterns
   */
  findFilipinoPatterns(text, originalText) {
    const patterns = [
      { regex: /\btaga\s+([a-z]+(?:\s+[a-z]+)*)/i, type: 'taga' },
      { regex: /\bdito\s+sa\s+([a-z]+(?:\s+[a-z]+)*)/i, type: 'dito_sa' },
      { regex: /\bnasa\s+([a-z]+(?:\s+[a-z]+)*)/i, type: 'nasa' },
      { regex: /\b([a-z]+(?:\s+city)?)\s+area\b/i, type: 'area' },
      { regex: /\baround\s+([a-z]+(?:\s+[a-z]+)*)\s+area\b/i, type: 'around_area' },
      { regex: /\b(?:around|near)\s+([a-z]+(?:\s+[a-z]+)*)/i, type: 'around_near' },
      { regex: /\bumuwi\s+ng\s+([a-z]+(?:\s+[a-z]+)*)/i, type: 'umuwi_ng' },
      { regex: /\barea\s+namin\s+sa\s+([a-z]+(?:\s+[a-z]+)*)/i, type: 'area_namin_sa' },
      { regex: /\bsa\s+lugar\s+(?:ko|namin)\s+sa\s+([a-z]+(?:\s+[a-z]+)*)/i, type: 'sa_lugar' },
      { regex: /\bhere\s+in\s+([a-z]+(?:\s+[a-z]+)*)/i, type: 'here_in' },
      { regex: /\bdown\s+here\s+in\s+([a-z]+(?:\s+[a-z]+)*)/i, type: 'down_here_in' },
      { regex: /\b(?:living|staying|working|based)\s+in\s+([a-z]+(?:\s+[a-z]+)*)/i, type: 'living_in' }
    ];

    for (const { regex, type } of patterns) {
      const match = text.match(regex);
      if (match && match[1]) {
        const locationName = match[1].trim();
        console.log(`Filipino pattern matched: "${type}" extracted "${locationName}"`);

        // Skip validation for Filipino patterns - the pattern itself provides context
        // Just check it's not too short
        if (locationName.length < 3) continue;

        // Try to find in database
        const cityMatch = this.findInDatabase(locationName, 'city');
        console.log(`City lookup for "${locationName}": ${cityMatch ? 'Found' : 'Not found'}`);
        if (cityMatch) {
          // Filipino patterns get high confidence boost
          const confidence = this.calculateConfidence(originalText, 'city', true) + 0.4;
          return {
            ...cityMatch,
            confidence: Math.min(confidence, 1.0),
            validationDetails: [`Filipino pattern: ${type}`]
          };
        }

        const provinceMatch = this.findInDatabase(locationName, 'province');
        if (provinceMatch) {
          // Filipino patterns get high confidence boost
          const confidence = this.calculateConfidence(originalText, 'province', true) + 0.4;
          return {
            region: provinceMatch.region || null,
            province: provinceMatch.name || locationName,
            city: 'None',
            barangay: 'None',
            confidence: Math.min(confidence, 1.0),
            validationDetails: [`Filipino pattern: ${type}`, 'Province-level match']
          };
        }
      }
    }

    return null;
  }

  /**
   * Find comma-separated locations
   */
  findCommaSeparatedLocation(text, originalText) {
    const pattern = /\b([a-z]+)\s*,\s*([a-z]+)(?:\s+city)?\b/i;
    const match = text.match(pattern);

    if (match) {
      const place1 = match[1].trim();
      const place2 = match[2].trim();

      // Check if both are valid location candidates
      const validation1 = validateLocationCandidate(place1, originalText);
      const validation2 = validateLocationCandidate(place2, originalText);

      if (validation1.isValid || validation2.isValid) {
        // Try to find combination in database
        const combinedSearch = this.findCombinedLocation(place1, place2);
        if (combinedSearch) {
          const confidence = this.calculateConfidence(originalText, 'city', true) + 0.1;
          return {
            ...combinedSearch,
            confidence: Math.min(confidence, 1.0),
            validationDetails: ['Comma-separated location']
          };
        }
      }
    }

    return null;
  }

  /**
   * Find locations mentioned via hashtags
   */
  findHashtagLocation(originalText) {
    if (!originalText) return null;

    const hashtags = originalText.match(/#[\p{L}0-9_]+/giu);
    if (!hashtags || hashtags.length === 0) {
      return null;
    }

    for (const tag of hashtags) {
      const candidates = extractCandidatesFromHashtag(tag);
      for (const candidate of candidates) {
        if (!candidate || candidate.length < 3) continue;

        const cityMatch = this.findInDatabase(candidate, 'city');
        if (cityMatch) {
          const confidence = Math.min(
            this.calculateConfidence(originalText, 'city', true, { hashtag: true }) + 0.1,
            0.95
          );
          return {
            ...cityMatch,
            confidence,
            validationDetails: ['Hashtag location']
          };
        }

        const provinceMatch = this.findInDatabase(candidate, 'province');
        if (provinceMatch) {
          const confidence = Math.min(
            this.calculateConfidence(originalText, 'province', true, { hashtag: true }) + 0.05,
            0.9
          );
          return {
            region: provinceMatch.region || null,
            province: provinceMatch.name || candidate,
            city: 'None',
            barangay: 'None',
            confidence,
            validationDetails: ['Hashtag location', 'Province-level match']
          };
        }
      }
    }

    return null;
  }

  /**
   * Find location in database by type
   */
  findInDatabase(name, type) {
    if (!this.excelIndex || !this.excelIndex.initialized) {
      console.error('Excel index not initialized');
      return null;
    }

    // Normalize and handle variations
    let normalized = this.excelIndex.normalize(name);

    // Remove "city" suffix for matching
    const withoutCity = normalized.replace(/\s+city$/i, '');

    // Handle special cases - expanded mappings
    const specialCases = {
      // Metro Manila cities
      'metro manila': 'manila',
      'quezon': 'quezon city',
      'qc': 'quezon city',
      'makati': 'makati city',
      'taguig': 'taguig city',
      'bgc': 'taguig city',
      'pasig': 'pasig city',
      'pateros': 'pateros',
      'mandaluyong': 'mandaluyong city',
      'san juan': 'san juan city',
      'marikina': 'marikina city',
      'caloocan': 'caloocan city',
      'north caloocan': 'caloocan city',
      'south caloocan': 'caloocan city',
      'malabon': 'malabon city',
      'navotas': 'navotas city',
      'valenzuela': 'valenzuela city',
      'las pinas': 'las piñas city',
      'las piñas': 'las piñas city',
      'paranaque': 'parañaque city',
      'parañaque': 'parañaque city',
      'muntinlupa': 'muntinlupa city',

      // Cavite cities
      'bacoor': 'bacoor city',
      'imus': 'imus city',
      'dasmarinas': 'dasmariñas city',
      'dasmariñas': 'dasmariñas city',
      'gen trias': 'general trias city',
      'general trias': 'general trias city',
      'trece martires': 'trece martires city',
      'tagaytay': 'tagaytay city',

      // Major cities outside NCR
      'general santos': 'general santos city',
      'gensan': 'general santos city',
      'davao': 'davao city',
      'cebu': 'cebu city',
      'lapu lapu': 'lapu-lapu city',
      'lapu-lapu': 'lapu-lapu city',
      'mandaue': 'mandaue city',
      'talisay': 'talisay city',
      'consolacion': 'consolacion',
      'cagayan de oro': 'cagayan de oro city',
      'cdo': 'cagayan de oro city',
      'zamboanga': 'zamboanga city',
      'bacolod': 'bacolod city',
      'iloilo': 'iloilo city',
      'angeles': 'angeles city',
      'san fernando': 'city of san fernando',
      'malolos': 'malolos city',
      'antipolo': 'antipolo city',
      'montalban': 'rodriguez',

      // Provinces
      'bulacan': 'bulacan',
      'cavite': 'cavite',
      'laguna': 'laguna',
      'batangas': 'batangas',
      'rizal': 'rizal',
      'pampanga': 'pampanga',
      'zambales': 'zambales',
      'bataan': 'bataan',
      'nueva ecija': 'nueva ecija',
      'tarlac': 'tarlac',
      'cebu': 'cebu',
      'bohol': 'bohol',
      'negros oriental': 'negros oriental',
      'negros occidental': 'negros occidental'
    };

    if (specialCases[normalized]) {
      normalized = specialCases[normalized];
    }

    if (type === 'city') {
      // Try exact match first
      let cities = this.excelIndex.cityIndex.get(normalized);
      if (cities && cities.length > 0) {
        return cities[0];
      }

      // Try without "city" suffix
      cities = this.excelIndex.cityIndex.get(withoutCity);
      if (cities && cities.length > 0) {
        return cities[0];
      }

      // Try with "city" added
      cities = this.excelIndex.cityIndex.get(normalized + ' city');
      if (cities && cities.length > 0) {
        return cities[0];
      }

      // Try partial match (more conservative)
      for (const [cityName, cityList] of this.excelIndex.cityIndex) {
        // Only match if one contains the other completely
        if ((cityName.length > 3 && normalized.length > 3) &&
            (cityName === normalized ||
             cityName === withoutCity ||
             cityName.startsWith(normalized + ' ') ||
             normalized.startsWith(cityName + ' '))) {
          if (cityList && cityList.length > 0) {
            return cityList[0];
          }
        }
      }
    } else if (type === 'province') {
      // First try exact match
      const province = this.excelIndex.provinceIndex.get(normalized);
      if (province) {
        return province;
      }

      // Try partial match (conservative)
      for (const [provinceName, provinceData] of this.excelIndex.provinceIndex) {
        if (provinceName.length > 3 && normalized.length > 3 &&
            (provinceName === normalized ||
             provinceName.startsWith(normalized) ||
             normalized.startsWith(provinceName))) {
          return provinceData;
        }
      }
    }

    return null;
  }

  /**
   * Find combined location (e.g., "Consolacion, Cebu")
   */
  findCombinedLocation(place1, place2) {
    // Try place1 as barangay/city, place2 as city/province
    const norm1 = this.excelIndex.normalize(place1);
    const norm2 = this.excelIndex.normalize(place2);

    // Check if place1 is a barangay in place2 (city)
    const barangays = this.excelIndex.barangayIndex.get(norm1);
    if (barangays) {
      for (const barangay of barangays) {
        if (this.excelIndex.normalize(barangay.city) === norm2) {
          return barangay;
        }
      }
    }

    // Check if place1 is a city in place2 (province)
    const cities = this.excelIndex.cityIndex.get(norm1);
    if (cities) {
      for (const city of cities) {
        if (this.excelIndex.normalize(city.province) === norm2) {
          return city;
        }
      }
    }

    return null;
  }
}

// Export singleton instance
let instance = null;

function getEnhancedMatcher() {
  if (!instance) {
    instance = new EnhancedLocationMatcher();
  }
  return instance;
}

function hasExplicitLocationDeclaration(text = '') {
  return EXPLICIT_LOCATION_PATTERNS.some(pattern => pattern.test(text));
}

function hasImplicitLocationPattern(text = '') {
  return IMPLICIT_LOCATION_PATTERNS.some(pattern => pattern.test(text));
}

function hasStrongLocationIndicators(text = '') {
  if (!text) return false;
  const lower = text.toLowerCase();
  return LOCATION_INDICATOR_WORDS.some(word => lower.includes(word));
}

function extractCandidatesFromHashtag(hashtag) {
  if (!hashtag) return [];
  const raw = hashtag.replace(/^#+/, '');
  if (!raw) return [];

  const spaced = raw.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  const lower = spaced.toLowerCase();
  const candidates = new Set();

  const cleanBase = lower.replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (cleanBase) {
    candidates.add(cleanBase);
  }

  HASHTAG_PREFIXES.forEach(prefix => {
      if (lower.startsWith(prefix) && lower.length > prefix.length + 2) {
        const trimmed = lower.slice(prefix.length).replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
      if (trimmed) {
        candidates.add(trimmed);
      }
    }
  });

  const tokens = cleanBase.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    candidates.add(tokens.slice(-2).join(' '));
  }
  if (tokens.length >= 1) {
    candidates.add(tokens[tokens.length - 1]);
  }

  return Array.from(candidates).filter(Boolean);
}

module.exports = {
  EnhancedLocationMatcher,
  getEnhancedMatcher
};