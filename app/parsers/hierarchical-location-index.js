/**
 * Hierarchical Philippine Location Index
 * Uses official 2019 Philippine administrative divisions database
 * Provides O(1) lookups with proper parent-child validation
 */

const fs = require('fs');
const path = require('path');

class PhilippineLocationIndex {
  constructor() {
    // Load the official hierarchical database
    const dataPath = path.join(__dirname, '../docs/philippine_provinces_cities_municipalities_and_barangays_2019v2.json');
    this.data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // Initialize indexes
    this.barangayIndex = {};      // normalized barangay -> [{full location info}]
    this.cityIndex = {};          // normalized city -> {full location info}
    this.provinceIndex = {};      // normalized province -> {region info}
    this.ambiguousBarangays = new Set();  // barangays appearing in multiple cities
    this.ambiguousCities = new Set();     // cities appearing in multiple provinces

    // Build the indexes
    this.buildIndexes();

    console.log(`Location index built: ${Object.keys(this.barangayIndex).length} barangays, ${Object.keys(this.cityIndex).length} cities`);
  }

  /**
   * Normalize text for fuzzy matching
   */
  normalizeKey(text) {
    if (!text) return '';

    return text
      .toLowerCase()
      .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical notes
      .replace(/^brgy\.?\s*/i, '')   // Remove barangay prefixes
      .replace(/^barangay\s*/i, '')
      .replace(/\s+city$/i, '')      // Remove city suffix for matching
      .replace(/[^a-z0-9\s]/g, ' ')  // Replace special chars with space
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .trim();
  }

  /**
   * Build all indexes for fast lookup
   */
  buildIndexes() {
    // Iterate through regions
    for (const [regionCode, regionData] of Object.entries(this.data)) {
      const regionName = regionData.region_name;

      // Iterate through provinces
      for (const [provinceName, provinceData] of Object.entries(regionData.province_list)) {
        const provinceKey = this.normalizeKey(provinceName);

        // Add to province index
        this.provinceIndex[provinceKey] = {
          province: provinceName,
          region: regionName,
          regionCode: regionCode,
          cities: []
        };

        // Iterate through cities/municipalities
        for (const [cityName, cityData] of Object.entries(provinceData.municipality_list)) {
          const cityKey = this.normalizeKey(cityName);

          // Track cities in province
          this.provinceIndex[provinceKey].cities.push(cityName);

          // Add to city index
          if (!this.cityIndex[cityKey]) {
            this.cityIndex[cityKey] = [];
          }

          const cityInfo = {
            city: cityName,
            province: provinceName,
            region: regionName,
            regionCode: regionCode,
            barangays: cityData.barangay_list
          };

          this.cityIndex[cityKey].push(cityInfo);

          // Track ambiguous cities
          if (this.cityIndex[cityKey].length > 1) {
            this.ambiguousCities.add(cityKey);
          }

          // Iterate through barangays
          cityData.barangay_list.forEach(barangayName => {
            const barangayKey = this.normalizeKey(barangayName);

            // Add to barangay index
            if (!this.barangayIndex[barangayKey]) {
              this.barangayIndex[barangayKey] = [];
            }

            this.barangayIndex[barangayKey].push({
              barangay: barangayName,
              city: cityName,
              province: provinceName,
              region: regionName,
              regionCode: regionCode
            });

            // Track ambiguous barangays
            if (this.barangayIndex[barangayKey].length > 1) {
              this.ambiguousBarangays.add(barangayKey);
            }
          });
        }
      }
    }

    // Add special handling for common city variations
    this.addCityAliases();
  }

  /**
   * Add common city name variations
   */
  addCityAliases() {
    // Create aliases for various city name formats
    const cityAliases = [];

    // Handle "CITY OF" format -> "CITY" format
    for (const [cityKey, cityInfo] of Object.entries(this.cityIndex)) {
      if (Array.isArray(cityInfo) && cityInfo.length > 0) {
        const city = cityInfo[0].city;

        // "CITY OF MAKATI" -> "makati city"
        if (city.startsWith('CITY OF ')) {
          const baseName = city.replace('CITY OF ', '');
          const aliasKey = this.normalizeKey(baseName + ' CITY');
          cityAliases.push({ alias: aliasKey, target: cityKey });

          // Also add just the base name
          const baseKey = this.normalizeKey(baseName);
          cityAliases.push({ alias: baseKey, target: cityKey });
        }

        // "QUEZON CITY" -> "quezon" (already correct format)
        if (city.endsWith(' CITY')) {
          const baseName = city.replace(' CITY', '');
          const baseKey = this.normalizeKey(baseName);
          cityAliases.push({ alias: baseKey, target: cityKey });
        }

        // "TAGUIG" -> "taguig city"
        if (!city.includes('CITY') && !city.startsWith('CITY OF')) {
          const withCityKey = this.normalizeKey(city + ' CITY');
          cityAliases.push({ alias: withCityKey, target: cityKey });
        }
      }
    }

    // Apply all aliases
    cityAliases.forEach(({ alias, target }) => {
      if (!this.cityIndex[alias]) {
        this.cityIndex[alias] = this.cityIndex[target];
      }
    });

    // Add common abbreviations and nicknames
    const commonAliases = {
      'qc': 'quezon city',
      'bgc': 'taguig',
      'fort bonifacio': 'taguig',
      'gensan': 'general santos',
      'cdo': 'cagayan de oro',
      'makati city': 'city of makati', // Direct mapping
      'taguig city': 'taguig',          // Direct mapping
      'gen trias': 'general trias',
      'general trias': 'general trias city',
      'montalban': 'rodriguez montalban',
      'rodriguez': 'rodriguez montalban',
      'north caloocan': 'caloocan city',
      'south caloocan': 'caloocan city',
      'caloocan': 'caloocan city',
      'las pinas': 'las pinas city',
      'san juan': 'san juan city',
      'pasay': 'pasay city',
      'pasig': 'pasig city',
      'marikina': 'marikina city',
      'muntinlupa': 'muntinlupa city',
      'paranaque': 'paranaque city',
      'valenzuela': 'valenzuela city',
      'malabon': 'malabon city',
      'navotas': 'navotas city',
      'mandaluyong': 'mandaluyong city',
      'davao': 'davao city',
      'cebu': 'cebu city',
      'zamboanga': 'zamboanga city',
      'bacolod': 'bacolod city',
      'iloilo': 'iloilo city',
      'cagayan de oro': 'cagayan de oro city',
      'general santos': 'general santos city'
    };

    for (const [alias, canonical] of Object.entries(commonAliases)) {
      const canonicalKey = this.normalizeKey(canonical);
      if (this.cityIndex[canonicalKey]) {
        this.cityIndex[alias] = this.cityIndex[canonicalKey];
      }
    }
  }

  /**
   * Check if a barangay is ambiguous (exists in multiple cities)
   */
  isAmbiguousBarangay(barangayName) {
    const key = this.normalizeKey(barangayName);
    return this.ambiguousBarangays.has(key);
  }

  /**
   * Check if a city is ambiguous (exists in multiple provinces)
   */
  isAmbiguousCity(cityName) {
    const key = this.normalizeKey(cityName);
    return this.ambiguousCities.has(key);
  }

  /**
   * Find barangay with optional city/province context
   */
  findBarangay(barangayName, cityContext = null, provinceContext = null) {
    const barangayKey = this.normalizeKey(barangayName);
    const matches = this.barangayIndex[barangayKey];

    if (!matches || matches.length === 0) {
      return null;
    }

    // If only one match and it's not ambiguous, return it
    if (matches.length === 1) {
      return matches[0];
    }

    // Multiple matches - need context
    if (cityContext) {
      const cityKey = this.normalizeKey(cityContext);
      const match = matches.find(m =>
        this.normalizeKey(m.city) === cityKey ||
        this.normalizeKey(m.city).includes(cityKey) ||
        cityKey.includes(this.normalizeKey(m.city))
      );
      if (match) return match;
    }

    if (provinceContext) {
      const provinceKey = this.normalizeKey(provinceContext);
      const match = matches.find(m =>
        this.normalizeKey(m.province) === provinceKey ||
        this.normalizeKey(m.province).includes(provinceKey)
      );
      if (match) return match;
    }

    // No context provided for ambiguous barangay
    return null;
  }

  /**
   * Find city with optional province context
   */
  findCity(cityName, provinceContext = null) {
    const cityKey = this.normalizeKey(cityName);

    // Try exact match first
    let matches = this.cityIndex[cityKey];

    // If no match, try adding "CITY" suffix
    if (!matches && !cityName.toLowerCase().includes('city')) {
      const withCityKey = this.normalizeKey(cityName + ' City');
      matches = this.cityIndex[withCityKey];
    }

    // Also try removing "City" if it's there
    if (!matches && cityName.toLowerCase().includes('city')) {
      const withoutCityKey = this.normalizeKey(cityName.replace(/\s+city$/i, ''));
      matches = this.cityIndex[withoutCityKey];
    }

    if (!matches || matches.length === 0) {
      return null;
    }

    // If only one match, return it
    if (matches.length === 1) {
      return matches[0];
    }

    // Multiple matches - need province context
    if (provinceContext) {
      const provinceKey = this.normalizeKey(provinceContext);
      const match = matches.find(m =>
        this.normalizeKey(m.province) === provinceKey ||
        this.normalizeKey(m.province).includes(provinceKey)
      );
      if (match) return match;
    }

    // For ambiguous cities, prefer major ones
    // Bacolod City in Negros Occidental is more likely than Bacolod in Lanao del Norte
    const priorityCities = {
      'bacolod': 'NEGROS OCCIDENTAL',
      'san juan': 'NATIONAL CAPITAL REGION',
      'taguig': 'TAGUIG - PATEROS',
      'makati': 'NATIONAL CAPITAL REGION',
      'quezon': 'NATIONAL CAPITAL REGION'
    };

    if (priorityCities[cityKey]) {
      const match = matches.find(m =>
        m.province.includes(priorityCities[cityKey])
      );
      if (match) return match;
    }

    // Default to first match if no better option
    return matches[0];
  }

  /**
   * Find province
   */
  findProvince(provinceName) {
    const provinceKey = this.normalizeKey(provinceName);
    return this.provinceIndex[provinceKey] || null;
  }

  /**
   * Validate if a location hierarchy is consistent
   */
  validateHierarchy(barangay, city, province) {
    // Check if barangay exists in the specified city
    if (barangay && city) {
      const barangayKey = this.normalizeKey(barangay);
      const cityKey = this.normalizeKey(city);
      const matches = this.barangayIndex[barangayKey];

      if (!matches) return false;

      const valid = matches.some(m =>
        this.normalizeKey(m.city) === cityKey
      );

      if (!valid) return false;
    }

    // Check if city exists in the specified province
    if (city && province) {
      const cityKey = this.normalizeKey(city);
      const provinceKey = this.normalizeKey(province);
      const matches = this.cityIndex[cityKey];

      if (!matches) return false;

      const valid = matches.some(m =>
        this.normalizeKey(m.province) === provinceKey
      );

      if (!valid) return false;
    }

    return true;
  }

  /**
   * Get statistics about the index
   */
  getStats() {
    return {
      totalBarangays: Object.keys(this.barangayIndex).length,
      ambiguousBarangays: this.ambiguousBarangays.size,
      totalCities: Object.keys(this.cityIndex).length,
      ambiguousCities: this.ambiguousCities.size,
      totalProvinces: Object.keys(this.provinceIndex).length
    };
  }
}

// Singleton instance
let instance = null;

function getLocationIndex() {
  if (!instance) {
    instance = new PhilippineLocationIndex();
  }
  return instance;
}

module.exports = {
  PhilippineLocationIndex,
  getLocationIndex
};