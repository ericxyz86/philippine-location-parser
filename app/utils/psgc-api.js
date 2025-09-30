/**
 * PSGC API Integration Module
 * Fetches complete hierarchical location data from Philippine Standard Geographic Code API
 */

const fetch = require('node-fetch');

const REGION_OVERRIDES = new Map([
  ['national capital region (ncr)', 'NCR'],
  ['national capital region', 'NCR'],
  ['ncr', 'NCR'],
  ['cordillera administrative region (car)', 'Cordillera Administrative Region (CAR)'],
  ['ilocos region', 'Ilocos Region'],
  ['cagayan valley', 'Cagayan Valley'],
  ['central luzon', 'Central Luzon'],
  ['calabarzon', 'CALABARZON'],
  ['mimaropa', 'MIMAROPA'],
  ['bicol region', 'Bicol Region'],
  ['western visayas', 'Western Visayas'],
  ['central visayas', 'Central Visayas'],
  ['eastern visayas', 'Eastern Visayas'],
  ['zamboanga peninsula', 'Zamboanga Peninsula'],
  ['northern mindanao', 'Northern Mindanao'],
  ['davao region', 'Davao Region'],
  ['soccsksargen', 'SOCCSKSARGEN'],
  ['caraga', 'Caraga'],
  ['bangsamoro autonomous region in muslim mindanao (barmm)', 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)'],
  ['autonomous region in muslim mindanao (armm)', 'Autonomous Region in Muslim Mindanao (ARMM)']
]);

const PROVINCE_OVERRIDES = new Map([
  ['metro manila', 'Metro Manila'],
  ['national capital region - manila', 'Metro Manila'],
  ['national capital region - second district', 'Metro Manila']
]);

const ACRONYM_FIXES = new Map([
  ['Ncr', 'NCR'],
  ['Car', 'CAR'],
  ['Barmm', 'BARMM'],
  ['Armm', 'ARMM'],
  ['Soccsksargen', 'SOCCSKSARGEN'],
  ['Mimaropa', 'MIMAROPA'],
  ['Calabarzon', 'Calabarzon']
]);

const CITY_SUFFIX_EXCEPTIONS = new Set([
  'Taguig', 'Quezon', 'Makati', 'Pasig', 'Davao', 'Cebu', 'Iloilo', 'Bacolod',
  'Bacoor', 'Mandaue',
  'Caloocan', 'Malabon', 'Navotas', 'Valenzuela', 'Mandaluyong', 'Marikina',
  'Muntinlupa', 'Parañaque', 'Paranaque', 'San Juan', 'Pasay'
]);

const ROMAN_NUMERAL_REGEX = /\b(?:i|v|x|l|c|d|m)+(?:-(?:i|v|x|l|c|d|m)+)?\b/gi;

class PSGCApi {
  constructor() {
    this.baseUrl = 'https://psgc.cloud/api/';
    this.cache = new Map();
    this.cacheTimeout = 3600000; // 1 hour cache
  }

  /**
   * Search for a location and get complete hierarchical data
   */
  async searchLocation(query, type = null) {
    if (!query) return null;

    const cacheKey = `search_${query}_${type}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Search endpoint
      let url = `${this.baseUrl}search?q=${encodeURIComponent(query)}`;
      if (type) {
        url += `&type=${type}`;
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (!response.ok) {
        console.error(`PSGC API error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (data && data.length > 0) {
        // Get the first match and fetch complete details
        const match = data[0];
        const details = await this.getLocationDetails(match.code);
        this.setCache(cacheKey, details);
        return details;
      }

      return null;
    } catch (error) {
      console.error('PSGC API search error:', error);
      return null;
    }
  }

  /**
   * Get complete location details including hierarchy
   */
  async getLocationDetails(code) {
    if (!code) return null;

    const cacheKey = `details_${code}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}locations/${code}`, {
        headers: {
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (!response.ok) {
        console.error(`PSGC API details error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      // Format the response with complete hierarchy
      const formatted = this.formatLocationData(data);
      this.setCache(cacheKey, formatted);

      return formatted;
    } catch (error) {
      console.error('PSGC API details error:', error);
      return null;
    }
  }

  /**
   * Complete partial location data by searching PSGC
   */
  async completeLocation(partialLocation) {
    // Priority: Search by most specific first
    let result = null;

    // If we have a barangay, search for it
    if (partialLocation.barangay && partialLocation.city) {
      result = await this.searchLocation(
        `${partialLocation.barangay} ${partialLocation.city}`,
        'barangay'
      );
    }

    // If no barangay result or no barangay, try city
    if (!result && partialLocation.city) {
      result = await this.searchLocation(partialLocation.city, 'city');

      // For special cases like Metro Manila cities
      if (!result) {
        result = await this.searchLocation(partialLocation.city, 'municipality');
      }
    }

    // If still no result, try province
    if (!result && partialLocation.province) {
      result = await this.searchLocation(partialLocation.province, 'province');
    }

    return result;
  }

  /**
   * Format PSGC data to our standard format
   */
  formatLocationData(data) {
    if (!data) return null;

    const location = {
      region: data.region_name || '',
      regionCode: data.region_code || '',
      province: data.province_name || '',
      provinceCode: data.province_code || '',
      city: data.city_name || data.municipality_name || '',
      cityCode: data.city_code || data.municipality_code || '',
      barangay: data.barangay_name || '',
      barangayCode: data.barangay_code || '',
      type: data.type || '',
      fullLocation: ''
    };

    // Build full location string
    const parts = [];
    if (location.barangay) parts.push(location.barangay);
    if (location.city) parts.push(location.city);
    if (location.province && location.province !== location.city) {
      parts.push(location.province);
    }
    if (location.region) parts.push(location.region);

    location.fullLocation = parts.join(', ');

    // Handle special cases for Metro Manila
    if (location.city && this.isMetroManilaCity(location.city)) {
      location.province = 'Metro Manila';
      location.region = 'National Capital Region (NCR)';
      location.regionCode = '13';
    }

    return location;
  }

  /**
   * Check if city is in Metro Manila
   */
  isMetroManilaCity(city) {
    const metroManilaCities = [
      'manila', 'quezon city', 'makati', 'taguig', 'pasig', 'pasay',
      'parañaque', 'las piñas', 'muntinlupa', 'marikina', 'caloocan',
      'malabon', 'navotas', 'valenzuela', 'san juan', 'mandaluyong',
      'pateros'
    ];

    const normalized = city.toLowerCase().trim();
    return metroManilaCities.some(mmCity =>
      normalized.includes(mmCity) || mmCity.includes(normalized)
    );
  }

  /**
   * Cache management
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Alternative: Use local database if PSGC API is unavailable
class LocalPSGC {
  constructor() {
    this.locations = require('../data/location-database.json');
    this.barangayIndex = new Map();
    this.cityIndex = new Map();
    this.provinceIndex = new Map();
    this.regionIndex = new Map();
    this.buildIndexes();
  }

  buildIndexes() {
    for (const entry of Object.values(this.locations)) {
      const standardized = this.standardizeEntry(entry);

      if (standardized.barangay !== 'None') {
        this.addIndexEntry(
          this.barangayIndex,
          this.normalizeKey(standardized.barangay),
          standardized
        );
      }

      if (standardized.city !== 'None') {
        this.addIndexEntry(
          this.cityIndex,
          this.normalizeKey(standardized.city),
          {
            region: standardized.region,
            province: standardized.province,
            city: standardized.city,
            barangay: 'None'
          }
        );
      }

      if (standardized.province !== 'None') {
        this.addIndexEntry(
          this.provinceIndex,
          this.normalizeKey(standardized.province),
          {
            region: standardized.region,
            province: standardized.province,
            city: 'None',
            barangay: 'None'
          }
        );
      }

      if (standardized.region !== 'None') {
        this.addIndexEntry(
          this.regionIndex,
          this.normalizeKey(standardized.region),
          {
            region: standardized.region,
            province: 'None',
            city: 'None',
            barangay: 'None'
          }
        );
      }
    }
  }

  addIndexEntry(map, key, value) {
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, []);
    }

    const bucket = map.get(key);
    const duplicate = bucket.some(candidate =>
      candidate.region === value.region &&
      candidate.province === value.province &&
      candidate.city === value.city &&
      candidate.barangay === value.barangay
    );

    if (!duplicate) {
      bucket.push(value);
    }
  }

  completeLocationLocal(partialLocation) {
    const normalizedInput = this.normalizePartial(partialLocation);

    if (!normalizedInput) {
      return this.createEmptyLocation();
    }

    const barangayKey = this.normalizeKey(normalizedInput.barangay);
    if (barangayKey) {
      const barangayMatch = this.findBestMatch(
        this.barangayIndex.get(barangayKey),
        normalizedInput
      );

      if (barangayMatch) {
        return this.enrichWithFullLocation(barangayMatch);
      }
    }

    const cityKey = this.normalizeKey(normalizedInput.city);
    if (cityKey) {
      const cityMatch = this.findBestMatch(
        this.cityIndex.get(cityKey),
        normalizedInput
      );

      if (cityMatch) {
        const merged = {
          ...cityMatch,
          barangay: normalizedInput.barangay !== 'None'
            ? normalizedInput.barangay
            : 'None'
        };

        return this.enrichWithFullLocation(merged);
      }
    }

    const provinceKey = this.normalizeKey(normalizedInput.province);
    if (provinceKey) {
      const provinceMatch = this.findBestMatch(
        this.provinceIndex.get(provinceKey),
        normalizedInput
      );

      if (provinceMatch) {
        const merged = {
          ...provinceMatch,
          city: 'None',
          barangay: 'None'
        };

        return this.enrichWithFullLocation(merged);
      }
    }

    const regionKey = this.normalizeKey(normalizedInput.region);
    if (regionKey) {
      const regionMatch = this.findBestMatch(
        this.regionIndex.get(regionKey),
        normalizedInput
      );

      if (regionMatch) {
        const merged = {
          ...regionMatch,
          province: 'None',
          city: 'None',
          barangay: 'None'
        };

        return this.enrichWithFullLocation(merged);
      }
    }

    return this.enrichWithFullLocation(normalizedInput);
  }

  normalizePartial(location = {}) {
    const standardized = this.standardizeEntry(location);

    const hasData = Object.values(standardized).some(value => value !== 'None');
    return hasData ? standardized : null;
  }

  standardizeEntry(entry = {}) {
    return {
      region: this.formatComponent(entry.region, 'region'),
      province: this.formatComponent(entry.province, 'province'),
      city: this.formatCityComponent(entry.city),
      barangay: this.formatComponent(entry.barangay, 'barangay')
    };
  }

  normalizeKey(value) {
    if (!value || typeof value !== 'string') {
      return '';
    }

    const cleaned = value.trim();
    if (!cleaned || cleaned.toLowerCase() === 'none') {
      return '';
    }

    return cleaned
      .toLowerCase()
      .replace(/municipality of\s+/g, '')
      .replace(/city of\s+/g, '')
      .replace(/\s+city$/gi, '')
      .replace(/\bbrgy\.?\b/g, 'barangay')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  formatComponent(value, type) {
    if (!value || typeof value !== 'string') {
      return 'None';
    }

    const cleaned = value.trim();
    if (!cleaned || cleaned.toLowerCase() === 'none') {
      return 'None';
    }

    const lower = cleaned.toLowerCase();

    if (type === 'region' && REGION_OVERRIDES.has(lower)) {
      return REGION_OVERRIDES.get(lower);
    }

    if (type === 'province' && PROVINCE_OVERRIDES.has(lower)) {
      return PROVINCE_OVERRIDES.get(lower);
    }

    let result = this.toTitleCase(cleaned);
    result = this.restoreAcronyms(result);

    if (type === 'barangay' && result.toLowerCase().startsWith('barangay ')) {
      result = result.replace(/^Barangay\s+/i, '');
    }

    return result;
  }

  formatCityComponent(value) {
    if (!value || typeof value !== 'string') {
      return 'None';
    }

    let cleaned = value.trim();
    if (!cleaned || cleaned.toLowerCase() === 'none') {
      return 'None';
    }

    cleaned = cleaned
      .replace(/^city of\s+/i, '')
      .replace(/^municipality of\s+/i, '')
      .replace(/\s+city$/i, '')
      .replace(/city$/i, '')
      .trim();

    let result = this.toTitleCase(cleaned);
    result = this.restoreAcronyms(result);

    const baseKey = result.replace(/\s+City$/i, '').trim();
    if (CITY_SUFFIX_EXCEPTIONS.has(baseKey)) {
      result = `${baseKey} City`;
    }

    return result;
  }

  toTitleCase(value) {
    return value
      .toLowerCase()
      .split(/([\s-/])/)
      .map(segment => {
        if (segment.trim() === '') {
          return segment;
        }
        return segment.charAt(0).toUpperCase() + segment.slice(1);
      })
      .join('');
  }

  restoreAcronyms(value) {
    let result = value;

    for (const [needle, replacement] of ACRONYM_FIXES.entries()) {
      const pattern = new RegExp(`\\b${needle}\\b`, 'g');
      result = result.replace(pattern, replacement);
    }

    result = result.replace(ROMAN_NUMERAL_REGEX, match => match.toUpperCase());
    result = result.replace(/(\d)([a-z])/g, (_, digit, letter) => `${digit}${letter.toUpperCase()}`);

    return result;
  }

  findBestMatch(candidates, input) {
    if (!candidates || candidates.length === 0) {
      return null;
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    let best = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      let score = 0;

      if (input.barangay !== 'None' && candidate.barangay !== 'None' &&
          this.normalizeKey(candidate.barangay) === this.normalizeKey(input.barangay)) {
        score += 100;
      }

      if (input.city !== 'None' && candidate.city !== 'None' &&
          this.normalizeKey(candidate.city) === this.normalizeKey(input.city)) {
        score += 60;
      }

      if (input.province !== 'None' && candidate.province !== 'None' &&
          this.normalizeKey(candidate.province) === this.normalizeKey(input.province)) {
        score += 40;
      }

      if (input.region !== 'None' && candidate.region !== 'None' &&
          this.normalizeKey(candidate.region) === this.normalizeKey(input.region)) {
        score += 20;
      }

      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return best;
  }

  enrichWithFullLocation(location) {
    if (!location) {
      return this.createEmptyLocation();
    }

    const enriched = {
      region: location.region || 'None',
      province: location.province || 'None',
      city: location.city || 'None',
      barangay: location.barangay || 'None'
    };

    enriched.fullLocation = this.buildFullLocation(enriched);
    return enriched;
  }

  createEmptyLocation() {
    return {
      region: 'None',
      province: 'None',
      city: 'None',
      barangay: 'None',
      fullLocation: 'None'
    };
  }

  buildFullLocation(location) {
    const parts = [];
    if (location.barangay && location.barangay !== 'None') parts.push(location.barangay);
    if (location.city && location.city !== 'None') parts.push(location.city);
    if (location.province && location.province !== 'None' && location.province !== location.city) {
      parts.push(location.province);
    }
    if (location.region && location.region !== 'None') parts.push(location.region);

    return parts.join(', ') || 'None';
  }
}

// Export both implementations
module.exports = {
  PSGCApi,
  LocalPSGC
};