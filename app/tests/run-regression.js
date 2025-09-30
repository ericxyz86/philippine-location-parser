/**
 * Run regression tests against the current parser
 */

const { regressionTests, runRegressionTests } = require('./regression-test-suite');
const { parseLocation } = require('../parsers/hierarchical-parser');

console.log('='.repeat(80));
console.log('REGRESSION TEST SUITE - BASELINE');
console.log('='.repeat(80));
console.log(`Total test cases: ${regressionTests.length}`);
console.log('');

const results = runRegressionTests(parseLocation);

// Summary
console.log('='.repeat(80));
console.log('RESULTS SUMMARY');
console.log('='.repeat(80));
console.log(`Total Tests: ${results.total}`);
console.log(`Passed: ${results.passed} (${results.accuracy}%)`);
console.log(`Failed: ${results.failed}`);
console.log('');
console.log('Error Breakdown:');
console.log(`  False Positives: ${results.falsePositives} (incorrectly found location)`);
console.log(`  False Negatives: ${results.falseNegatives} (missed legitimate location)`);
console.log(`  Wrong Location: ${results.failed - results.falsePositives - results.falseNegatives} (found wrong location)`);

// Category breakdown
console.log('\nBy Category:');
Object.entries(results.byCategory).forEach(([category, stats]) => {
  const pct = (stats.passed / stats.total * 100).toFixed(1);
  console.log(`  ${category}: ${stats.passed}/${stats.total} (${pct}%)`);
});

// Show failures
if (results.failures.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('FAILURES (showing first 10)');
  console.log('='.repeat(80));

  results.failures.slice(0, 10).forEach(f => {
    console.log(`\n${f.index}. [${f.category}] ${f.type}`);
    console.log(`   Text: "${f.text.substring(0, 60)}${f.text.length > 60 ? '...' : ''}"`);
    if (f.expected) {
      console.log(`   Expected: ${f.expected.city || 'N/A'} / ${f.expected.barangay || 'N/A'}`);
    } else {
      console.log(`   Expected: null (no location)`);
    }
    if (f.got) {
      console.log(`   Got: ${f.got.city || 'N/A'} / ${f.got.barangay || 'N/A'}`);
    } else {
      console.log(`   Got: null`);
    }
  });
}

console.log('\n' + '='.repeat(80));
console.log('BASELINE ESTABLISHED');
console.log('Next step: Implement improvements to increase accuracy');
console.log('='.repeat(80));