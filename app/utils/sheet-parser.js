/**
 * Google Sheets Parser with Column Range Support
 */

/**
 * Parse column range notation (e.g., B2, B2:B100, B:B)
 */
function parseColumnRange(range) {
  // Default to B2 (column B starting from row 2, skipping header)
  if (!range || range.trim() === '') {
    return { column: 1, startRow: 2, endRow: null }; // Default to column B, starting at row 2
  }

  // Remove spaces
  range = range.trim().toUpperCase();

  // Match patterns like B, B2, B:B, B2:B100
  const simpleColumnMatch = range.match(/^([A-Z]+)$/);
  const singleCellMatch = range.match(/^([A-Z]+)(\d+)$/);
  const columnRangeMatch = range.match(/^([A-Z]+):([A-Z]+)$/);
  const cellRangeMatch = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);

  let column = 1; // Default to B (index 1)
  let startRow = 2; // Default to row 2 (skip header)
  let endRow = null;

  if (simpleColumnMatch) {
    // Just a column letter like "B" - start from row 2
    column = columnLetterToIndex(simpleColumnMatch[1]);
    startRow = 2; // Skip header
  } else if (singleCellMatch) {
    // Single cell like "B2"
    column = columnLetterToIndex(singleCellMatch[1]);
    startRow = parseInt(singleCellMatch[2]);
    endRow = startRow;
  } else if (columnRangeMatch) {
    // Column range like "B:B" - start from row 2
    column = columnLetterToIndex(columnRangeMatch[1]);
    startRow = 2; // Skip header
  } else if (cellRangeMatch) {
    // Cell range like "B2:B100"
    column = columnLetterToIndex(cellRangeMatch[1]);
    startRow = parseInt(cellRangeMatch[2]);
    endRow = parseInt(cellRangeMatch[4]);
  }

  return { column, startRow, endRow };
}

/**
 * Convert column letter to index (A=0, B=1, C=2, etc.)
 */
function columnLetterToIndex(letter) {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return index - 1; // Convert to 0-based index
}

/**
 * Extract data from CSV based on column range
 */
function extractFromCSV(csvText, columnRange) {
  const range = parseColumnRange(columnRange);
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);

  const results = [];

  lines.forEach((line, index) => {
    // Row numbering starts at 1 (row 1 is usually the header)
    const actualRowNumber = index + 1;

    // Skip rows before the start row
    if (range.startRow && actualRowNumber < range.startRow) return;

    // Skip rows after the end row (if specified)
    if (range.endRow && actualRowNumber > range.endRow) return;

    // Parse CSV line (handle quoted fields)
    const fields = parseCSVLine(line);

    // Get the specified column
    if (fields.length > range.column) {
      const cellValue = fields[range.column];
      if (cellValue && cellValue.trim() && cellValue !== 'None') {
        results.push(cellValue.trim());
      }
    }
  });

  return results;
}

/**
 * Parse a single CSV line handling quotes
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && nextChar === '"') {
      // Escaped quote
      current += '"';
      i++; // Skip next character
    } else if (char === '"') {
      // Toggle quotes
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);

  return result.map(field => {
    // Remove surrounding quotes if present
    if (field.startsWith('"') && field.endsWith('"')) {
      return field.slice(1, -1);
    }
    return field;
  });
}

module.exports = {
  parseColumnRange,
  extractFromCSV,
  parseCSVLine
};