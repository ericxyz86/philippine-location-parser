/**
 * Location Data Normalizer
 * Cleans and standardizes location data for consistent output
 */

/**
 * Normalize NCR/Metro Manila province names
 */
function normalizeProvince(province) {
  if (!province || province === 'None') return province;

  // Convert NCR districts to "Metro Manila"
  if (province.includes('NATIONAL CAPITAL REGION') ||
      province.includes('NCR')) {
    return 'Metro Manila';
  }

  // Convert to proper case for other provinces
  return toProperCase(province);
}

/**
 * Normalize city names
 */
function normalizeCity(city) {
  if (!city || city === 'None') return city;

  // Remove "CITY OF" prefix and standardize
  let normalized = city
    .replace(/^CITY OF\s+/i, '')
    .replace(/^MUNICIPALITY OF\s+/i, '');

  // Convert to proper case
  normalized = toProperCase(normalized);

  // Add "City" suffix for known cities (except those that already have it)
  const knownCities = {
    'makati': 'Makati City',
    'manila': 'Manila City',
    'quezon': 'Quezon City',
    'pasig': 'Pasig City',
    'taguig': 'Taguig City',
    'mandaluyong': 'Mandaluyong City',
    'san juan': 'San Juan City',
    'marikina': 'Marikina City',
    'muntinlupa': 'Muntinlupa City',
    'paranaque': 'Paranaque City',
    'las pinas': 'Las Pinas City',
    'caloocan': 'Caloocan City',
    'malabon': 'Malabon City',
    'navotas': 'Navotas City',
    'valenzuela': 'Valenzuela City',
    'pasay': 'Pasay City',
    'davao': 'Davao City',
    'cebu': 'Cebu City',
    'iloilo': 'Iloilo City',
    'bacolod': 'Bacolod City',
    'baguio': 'Baguio City',
    'cagayan de oro': 'Cagayan de Oro City',
    'zamboanga': 'Zamboanga City'
  };

  const normalizedLower = normalized.toLowerCase();

  // Check if it's a known city
  for (const [key, value] of Object.entries(knownCities)) {
    if (normalizedLower === key || normalizedLower === key + ' city') {
      return value;
    }
  }

  // If it already ends with "City", keep it
  if (normalized.endsWith(' City')) {
    return normalized;
  }

  // For other cities, just return the proper case version
  return normalized;
}

/**
 * Normalize barangay names
 */
function normalizeBarangay(barangay) {
  if (!barangay || barangay === 'None') return barangay;

  // Handle special cases
  if (barangay.includes('(POB.)') || barangay.includes('POBLACION')) {
    return 'Poblacion';
  }

  // Convert to proper case
  return toProperCase(barangay);
}

/**
 * Normalize region names
 */
function normalizeRegion(region) {
  if (!region || region === 'None') return region;

  // Special handling for NCR
  if (region.includes('National Capital Region')) {
    return 'National Capital Region (NCR)';
  }

  // Handle CALABARZON, MIMAROPA, etc.
  const acronymRegions = ['CALABARZON', 'MIMAROPA', 'SOCCSKSARGEN', 'BARMM', 'CAR'];
  const regionUpper = region.toUpperCase();

  for (const acronym of acronymRegions) {
    if (regionUpper === acronym) {
      return acronym;
    }
  }

  // Convert to proper case for other regions
  return toProperCase(region);
}

/**
 * Convert string to proper case
 */
function toProperCase(str) {
  if (!str) return str;

  // Handle all caps input
  str = str.toLowerCase();

  // Words that should remain lowercase
  const lowercaseWords = ['de', 'del', 'la', 'las', 'los', 'ng', 'ni', 'sa'];

  // Words that need special casing
  const specialCases = {
    'ii': 'II',
    'iii': 'III',
    'iv': 'IV',
    'v': 'V',
    'vi': 'VI',
    'vii': 'VII',
    'viii': 'VIII',
    'ix': 'IX',
    'x': 'X'
  };

  return str
    .split(/\s+/)
    .map((word, index) => {
      const wordLower = word.toLowerCase();

      // Check for special cases (Roman numerals)
      if (specialCases[wordLower]) {
        return specialCases[wordLower];
      }

      // Keep certain words lowercase (except if first word)
      if (index > 0 && lowercaseWords.includes(wordLower)) {
        return wordLower;
      }

      // Handle hyphenated words
      if (word.includes('-')) {
        return word.split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('-');
      }

      // Standard proper case
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Normalize complete location object
 */
function normalizeLocation(location) {
  if (!location) {
    return {
      region: 'None',
      province: 'None',
      city: 'None',
      barangay: 'None'
    };
  }

  return {
    region: normalizeRegion(location.region),
    province: normalizeProvince(location.province),
    city: normalizeCity(location.city),
    barangay: normalizeBarangay(location.barangay)
  };
}

/**
 * Remove special characters and replace with standard ASCII
 */
function removeSpecialCharacters(text) {
  if (!text || text === 'None') return text;

  // Map of special characters to their replacements
  const replacements = {
    'ñ': 'n',
    'Ñ': 'N',
    'á': 'a',
    'é': 'e',
    'í': 'i',
    'ó': 'o',
    'ú': 'u',
    'Á': 'A',
    'É': 'E',
    'Í': 'I',
    'Ó': 'O',
    'Ú': 'U',
    'ü': 'u',
    'Ü': 'U',
    '√±': 'n',  // Common encoding issue for ñ
    '√°': 'n'
  };

  let result = text;
  for (const [special, replacement] of Object.entries(replacements)) {
    result = result.replace(new RegExp(special, 'g'), replacement);
  }

  return result;
}

/**
 * Check if location has any data
 */
function hasLocationData(location) {
  if (!location) return false;

  return (
    (location.region && location.region !== 'None') ||
    (location.province && location.province !== 'None') ||
    (location.city && location.city !== 'None') ||
    (location.barangay && location.barangay !== 'None')
  );
}

/**
 * Format normalized location as string
 */
function formatNormalizedLocation(location) {
  // If no location data at all, just return "None"
  if (!location || !hasLocationData(location)) {
    return 'None';
  }

  const normalized = normalizeLocation(location);
  const parts = [];

  // Apply special character removal and build output
  if (normalized.region && normalized.region !== 'None') {
    parts.push(`Region: ${removeSpecialCharacters(normalized.region)}`);
  }
  if (normalized.province && normalized.province !== 'None') {
    parts.push(`Province: ${removeSpecialCharacters(normalized.province)}`);
  }
  if (normalized.city && normalized.city !== 'None') {
    parts.push(`City: ${removeSpecialCharacters(normalized.city)}`);
  }
  if (normalized.barangay && normalized.barangay !== 'None') {
    parts.push(`Barangay: ${removeSpecialCharacters(normalized.barangay)}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'None';
}

module.exports = {
  normalizeProvince,
  normalizeCity,
  normalizeBarangay,
  normalizeRegion,
  normalizeLocation,
  formatNormalizedLocation,
  toProperCase
};