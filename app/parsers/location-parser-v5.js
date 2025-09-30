/**
 * Location Parser v5 - Simplified Utilities for LLM-First System
 *
 * This module now serves as a utility layer for the LLM-first extraction.
 * All actual extraction is handled by llm-extractor.js
 */

/**
 * Create empty location object
 */
function createEmptyLocation() {
  return {
    region: 'None',
    province: 'None',
    city: 'None',
    barangay: 'None'
  };
}

/**
 * Normalize location fields
 * Ensures consistent format with "None" for empty fields
 */
function normalizeLocationFields(location) {
  if (!location) {
    return createEmptyLocation();
  }

  return {
    region: location.region || 'None',
    province: location.province || 'None',
    city: location.city || 'None',
    barangay: location.barangay || 'None'
  };
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
 * Format location for display
 * Returns formatted string representation
 */
function formatLocation(location) {
  if (!location || !hasLocationData(location)) {
    return 'No location identified';
  }

  const parts = [];

  if (location.barangay && location.barangay !== 'None') {
    parts.push(`Barangay: ${location.barangay}`);
  }
  if (location.city && location.city !== 'None') {
    parts.push(`City: ${location.city}`);
  }
  if (location.province && location.province !== 'None') {
    parts.push(`Province: ${location.province}`);
  }
  if (location.region && location.region !== 'None') {
    parts.push(`Region: ${location.region}`);
  }

  return parts.join(', ');
}

// Export functions
module.exports = {
  createEmptyLocation,
  normalizeLocationFields,
  hasLocationData,
  formatLocation
};