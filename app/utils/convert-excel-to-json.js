/**
 * Convert Philippines locations Excel file to JSON format
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read the Excel file
const workbook = XLSX.readFile(path.join(__dirname, '../docs/philippines_locations_table.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON
const data = XLSX.utils.sheet_to_json(worksheet);

// Process and structure the data
const locations = {
  regions: {},
  provinces: {},
  cities: {},
  barangays: {},
  // Add lookup indexes
  cityToProvince: {},
  provinceToRegion: {},
  barangayToCity: {}
};

// Track unique values
const uniqueRegions = new Set();
const uniqueProvinces = new Set();
const uniqueCities = new Set();

data.forEach(row => {
  // Clean and normalize data
  const region = row.Region ? row.Region.trim() : null;
  const province = row.Province ? row.Province.trim() : null;
  const city = row.City ? row.City.trim() : null;
  const barangay = row.Barangay ? row.Barangay.trim() : null;

  // Build hierarchical structure
  if (region) {
    uniqueRegions.add(region);
    if (!locations.regions[region]) {
      locations.regions[region] = {
        name: region,
        provinces: new Set()
      };
    }
  }

  if (province) {
    uniqueProvinces.add(province);
    if (!locations.provinces[province]) {
      locations.provinces[province] = {
        name: province,
        region: region,
        cities: new Set()
      };
    }
    if (region) {
      locations.regions[region].provinces.add(province);
      locations.provinceToRegion[province] = region;
    }
  }

  if (city) {
    uniqueCities.add(city);
    if (!locations.cities[city]) {
      locations.cities[city] = {
        name: city,
        province: province,
        region: region,
        barangays: new Set()
      };
    }
    if (province) {
      locations.provinces[province].cities.add(city);
      locations.cityToProvince[city] = province;
    }
  }

  if (barangay && city) {
    const barangayKey = `${barangay}|${city}`;
    if (!locations.barangays[barangayKey]) {
      locations.barangays[barangayKey] = {
        name: barangay,
        city: city,
        province: province,
        region: region
      };
    }
    locations.cities[city].barangays.add(barangay);
    locations.barangayToCity[barangayKey] = city;
  }
});

// Convert Sets to Arrays for JSON serialization
Object.keys(locations.regions).forEach(key => {
  locations.regions[key].provinces = Array.from(locations.regions[key].provinces);
});

Object.keys(locations.provinces).forEach(key => {
  locations.provinces[key].cities = Array.from(locations.provinces[key].cities);
});

Object.keys(locations.cities).forEach(key => {
  locations.cities[key].barangays = Array.from(locations.cities[key].barangays);
});

// Add statistics
const stats = {
  totalRegions: uniqueRegions.size,
  totalProvinces: uniqueProvinces.size,
  totalCities: uniqueCities.size,
  totalBarangays: Object.keys(locations.barangays).length,
  totalRows: data.length
};

console.log('Statistics:');
console.log(`- Regions: ${stats.totalRegions}`);
console.log(`- Provinces: ${stats.totalProvinces}`);
console.log(`- Cities/Municipalities: ${stats.totalCities}`);
console.log(`- Barangays: ${stats.totalBarangays}`);
console.log(`- Total rows: ${stats.totalRows}`);

// Save to JSON file
const output = {
  ...locations,
  stats,
  generated: new Date().toISOString()
};

const outputPath = path.join(__dirname, '../data/philippines-locations-excel.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`\nData saved to: ${outputPath}`);

module.exports = output;