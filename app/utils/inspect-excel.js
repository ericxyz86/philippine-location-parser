/**
 * Inspect Excel file structure
 */

const XLSX = require('xlsx');
const path = require('path');

// Read the Excel file
const workbook = XLSX.readFile(path.join(__dirname, '../docs/philippines_locations_table.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON to see structure
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Sheet name:', sheetName);
console.log('Total rows:', data.length);

// Show first 5 rows to understand structure
console.log('\nFirst 5 rows:');
data.slice(0, 5).forEach((row, index) => {
  console.log(`\nRow ${index + 1}:`);
  console.log(JSON.stringify(row, null, 2));
});

// Show all column names
if (data.length > 0) {
  console.log('\nColumn names:');
  Object.keys(data[0]).forEach(key => {
    console.log(`- ${key}`);
  });
}