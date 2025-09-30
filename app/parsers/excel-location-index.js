/**
 * Enhanced Philippine Location Index using Excel data
 * Provides comprehensive location matching from official data
 */

const fs = require('fs');
const path = require('path');

class ExcelLocationIndex {
  constructor() {
    this.data = null;
    this.initialized = false;

    // Normalized indexes for fast lookups
    this.regionIndex = new Map();
    this.provinceIndex = new Map();
    this.cityIndex = new Map();
    this.barangayIndex = new Map();

    // Alias mappings for common abbreviations
    this.cityAliases = new Map();
    this.provinceAliases = new Map();

    this.initialize();
  }

  initialize() {
    try {
      // Load Excel-converted JSON data
      const dataPath = path.join(__dirname, '../data/philippines-locations-excel.json');
      this.data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

      // Build normalized indexes
      this.buildIndexes();
      this.buildAliases();

      this.initialized = true;

      console.log(`Excel Location Index initialized:`);
      console.log(`- ${this.data.stats.totalRegions} regions`);
      console.log(`- ${this.data.stats.totalProvinces} provinces`);
      console.log(`- ${this.data.stats.totalCities} cities`);
      console.log(`- ${this.data.stats.totalBarangays} barangays`);
    } catch (error) {
      console.error('Failed to initialize Excel Location Index:', error);
      this.initialized = false;
    }
  }

  buildIndexes() {
    // Index regions
    Object.keys(this.data.regions).forEach(region => {
      const normalized = this.normalize(region);
      this.regionIndex.set(normalized, this.data.regions[region]);
    });

    // Index provinces
    Object.keys(this.data.provinces).forEach(province => {
      const normalized = this.normalize(province);
      this.provinceIndex.set(normalized, this.data.provinces[province]);
    });

    // Index cities
    Object.keys(this.data.cities).forEach(city => {
      const normalized = this.normalize(city);
      if (!this.cityIndex.has(normalized)) {
        this.cityIndex.set(normalized, []);
      }
      this.cityIndex.get(normalized).push(this.data.cities[city]);
    });

    // Index barangays
    Object.keys(this.data.barangays).forEach(barangayKey => {
      const barangay = this.data.barangays[barangayKey];
      const normalized = this.normalize(barangay.name);
      if (!this.barangayIndex.has(normalized)) {
        this.barangayIndex.set(normalized, []);
      }
      this.barangayIndex.get(normalized).push(barangay);
    });
  }

  buildAliases() {
    // Common city aliases and abbreviations
    const cityAliases = {
      'qc': 'QUEZON CITY',
      'quezon': 'QUEZON CITY',
      'bgc': 'TAGUIG',
      'bgc taguig': 'TAGUIG',
      'bonifacio global city': 'TAGUIG',
      'gensan': 'GENERAL SANTOS',
      'gen san': 'GENERAL SANTOS',
      'cdo': 'CAGAYAN DE ORO',
      'cdeo': 'CAGAYAN DE ORO',
      'dvo': 'DAVAO CITY',
      'ceb': 'CEBU CITY',
      'sjdm': 'SAN JOSE DEL MONTE',
      'valenzuela city': 'VALENZUELA',
      'makati city': 'MAKATI',
      'manila city': 'MANILA',
      'pasig city': 'PASIG',
      'taguig city': 'TAGUIG',
      'mandaluyong city': 'MANDALUYONG',
      'san juan city': 'SAN JUAN',
      'marikina city': 'MARIKINA',
      'muntinlupa city': 'MUNTINLUPA',
      'paranaque city': 'PARAÑAQUE',
      'las pinas city': 'LAS PIÑAS',
      'caloocan city': 'CALOOCAN',
      'malabon city': 'MALABON',
      'navotas city': 'NAVOTAS',
      'pasay city': 'PASAY'
    };

    Object.entries(cityAliases).forEach(([alias, actual]) => {
      this.cityAliases.set(this.normalize(alias), this.normalize(actual));
    });

    // Province aliases
    const provinceAliases = {
      'metro manila': 'NCR',
      'ncr': 'NCR',
      'national capital region': 'NCR',
      'mm': 'NCR'
    };

    Object.entries(provinceAliases).forEach(([alias, actual]) => {
      this.provinceAliases.set(this.normalize(alias), this.normalize(actual));
    });
  }

  normalize(text) {
    if (!text) return '';
    return text
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Find location in text using Excel data
   */
  findLocation(text) {
    if (!this.initialized) return null;

    const normalizedText = this.normalize(text);
    const result = {
      region: null,
      province: null,
      city: null,
      barangay: null,
      confidence: 0
    };

    // Try to find barangay (most specific)
    const barangayMatch = this.findBarangay(normalizedText);
    if (barangayMatch) {
      result.barangay = barangayMatch.name;
      result.city = barangayMatch.city;
      result.province = barangayMatch.province;
      result.region = barangayMatch.region;
      result.confidence = 0.9;
      return result;
    }

    // Try to find city
    const cityMatch = this.findCity(normalizedText);
    if (cityMatch) {
      result.city = cityMatch.name;
      result.province = cityMatch.province;
      result.region = cityMatch.region;
      result.confidence = 0.8;
      return result;
    }

    // Try to find province
    const provinceMatch = this.findProvince(normalizedText);
    if (provinceMatch) {
      result.province = provinceMatch.name;
      result.region = provinceMatch.region;
      result.confidence = 0.7;
      return result;
    }

    // Try to find region
    const regionMatch = this.findRegion(normalizedText);
    if (regionMatch) {
      result.region = regionMatch.name;
      result.confidence = 0.6;
      return result;
    }

    return null;
  }

  findBarangay(text) {
    // Look for barangay patterns
    const patterns = [
      /BRGY\.?\s+([A-Z0-9\s]+)/,
      /BARANGAY\s+([A-Z0-9\s]+)/,
      /BRG\.?\s+([A-Z0-9\s]+)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const barangayName = this.normalize(match[1]);
        const candidates = this.barangayIndex.get(barangayName);
        if (candidates && candidates.length > 0) {
          // If multiple matches, try to disambiguate using city context
          if (candidates.length === 1) {
            return candidates[0];
          }
          // Look for city name in the text to disambiguate
          for (const candidate of candidates) {
            const cityNorm = this.normalize(candidate.city);
            if (text.includes(cityNorm)) {
              return candidate;
            }
          }
          // Return first match if no disambiguation possible
          return candidates[0];
        }
      }
    }
    return null;
  }

  findCity(text) {
    // First check aliases
    for (const [alias, actual] of this.cityAliases) {
      if (text.includes(alias)) {
        const candidates = this.cityIndex.get(actual);
        if (candidates && candidates.length > 0) {
          return candidates[0];
        }
      }
    }

    // Then check direct matches
    for (const [cityName, candidates] of this.cityIndex) {
      if (text.includes(cityName)) {
        // If multiple cities with same name, try to disambiguate with province
        if (candidates.length === 1) {
          return candidates[0];
        }
        // Look for province context
        for (const candidate of candidates) {
          const provinceNorm = this.normalize(candidate.province);
          if (text.includes(provinceNorm)) {
            return candidate;
          }
        }
        return candidates[0];
      }
    }
    return null;
  }

  findProvince(text) {
    // Check aliases first
    for (const [alias, actual] of this.provinceAliases) {
      if (text.includes(alias)) {
        return this.provinceIndex.get(actual);
      }
    }

    // Direct province lookup
    for (const [provinceName, province] of this.provinceIndex) {
      if (text.includes(provinceName)) {
        return province;
      }
    }
    return null;
  }

  findRegion(text) {
    for (const [regionName, region] of this.regionIndex) {
      if (text.includes(regionName)) {
        return region;
      }
    }
    return null;
  }

  /**
   * Validate if a location exists in the database
   */
  validateLocation(location) {
    if (!this.initialized) return false;

    // Check if city exists
    if (location.city) {
      const cityNorm = this.normalize(location.city);
      const cities = this.cityIndex.get(cityNorm);
      if (!cities || cities.length === 0) {
        return false;
      }

      // If province is specified, validate the combination
      if (location.province) {
        const provinceNorm = this.normalize(location.province);
        const validCity = cities.find(c =>
          this.normalize(c.province) === provinceNorm
        );
        if (!validCity) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get all cities in a province
   */
  getCitiesInProvince(provinceName) {
    const provinceNorm = this.normalize(provinceName);
    const province = this.provinceIndex.get(provinceNorm);
    if (!province) return [];
    return province.cities || [];
  }

  /**
   * Get all barangays in a city
   */
  getBarangaysInCity(cityName) {
    const cityNorm = this.normalize(cityName);
    const cities = this.cityIndex.get(cityNorm);
    if (!cities || cities.length === 0) return [];
    return cities[0].barangays || [];
  }
}

// Singleton instance
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new ExcelLocationIndex();
  }
  return instance;
}

module.exports = {
  ExcelLocationIndex,
  getInstance
};