/**
 * Comprehensive Regression Test Suite for Philippine Location Parser
 * Tests both false positive prevention and legitimate location detection
 */

const regressionTests = [
  // ============ FALSE POSITIVES - MUST RETURN NULL ============
  {
    category: 'ISP/Service',
    text: '@enjoyGLOBE So frustrating. Since September 11, we have no internet connection',
    expected: null,
    reason: 'ISP mention without location'
  },
  {
    category: 'Common Phrase',
    text: 'Same here',
    expected: null,
    reason: 'Generic response'
  },
  {
    category: 'Common Phrase',
    text: 'Same problem',
    expected: null,
    reason: 'Generic complaint'
  },
  {
    category: 'Time Reference',
    text: 'Down from 6am to 10am. What is happening Converge??',
    expected: null,
    reason: 'Time range with ISP'
  },
  {
    category: 'Bisaya Phrase',
    text: 'wala pa gyud nabalik amoa',
    expected: null,
    reason: 'Bisaya phrase without location'
  },
  {
    category: 'Generic Complaint',
    text: 'apparently, down ang @converge_ICT',
    expected: null,
    reason: 'ISP complaint'
  },
  {
    category: 'Generic',
    text: 'Still down. Same problem every weekend',
    expected: null,
    reason: 'Generic complaint'
  },
  {
    category: 'Generic',
    text: 'Just asking about the service',
    expected: null,
    reason: 'Generic question'
  },
  {
    category: 'Generic',
    text: 'Internet connection is terrible',
    expected: null,
    reason: 'Generic complaint'
  },
  {
    category: 'Tagalog Phrase',
    text: 'Kahapon pa',
    expected: null,
    reason: 'Time reference in Tagalog'
  },

  // ============ LEGITIMATE LOCATIONS - SHOULD BE FOUND ============

  // Explicit Barangay + City Format
  {
    category: 'Barangay+City',
    text: 'Brgy. 171, North Caloocan. Hehe.',
    expected: {
      barangay: 'BARANGAY 171',
      city: 'CALOOCAN CITY',
      province: 'NATIONAL CAPITAL REGION - THIRD DISTRICT',
      region: 'NCR'
    },
    reason: 'Standard barangay, city format'
  },
  {
    category: 'Barangay+City',
    text: 'Location: Brgy Navarro Gen Trias.',
    expected: {
      barangay: 'NAVARRO',
      city: 'GENERAL TRIAS CITY',
      province: 'CAVITE',
      region: 'REGION IV-A'
    },
    reason: 'Explicit location declaration'
  },
  {
    category: 'Barangay+City',
    text: 'Krus na Ligas, Quezon City. PHILIPPINES',
    expected: {
      barangay: 'KRUS NA LIGAS',
      city: 'QUEZON CITY',
      province: 'NATIONAL CAPITAL REGION - SECOND DISTRICT',
      region: 'NCR'
    },
    reason: 'Barangay, city with country marker'
  },

  // City + Province Format
  {
    category: 'City+Province',
    text: 'Consolacion, Cebu',
    expected: {
      city: 'CONSOLACION',
      province: 'CEBU',
      region: 'REGION VII'
    },
    reason: 'City, province format'
  },
  {
    category: 'City+Province',
    text: 'rosario montalban rizal',
    expected: {
      barangay: 'ROSARIO',
      city: 'RODRIGUEZ (MONTALBAN)',
      province: 'RIZAL',
      region: 'REGION IV-A'
    },
    reason: 'Barangay city province sequence'
  },

  // Area References
  {
    category: 'Area Reference',
    text: 'Talon-Talon area',
    expected: {
      barangay: 'TALON-TALON',
      city: 'LAS PIÑAS CITY',
      province: 'NATIONAL CAPITAL REGION - FOURTH DISTRICT',
      region: 'NCR'
    },
    reason: 'Barangay with area suffix'
  },
  {
    category: 'Area Reference',
    text: 'QC area',
    expected: {
      city: 'QUEZON CITY',
      province: 'NATIONAL CAPITAL REGION - SECOND DISTRICT',
      region: 'NCR'
    },
    reason: 'City abbreviation with area suffix'
  },
  {
    category: 'Area Reference',
    text: 'sa area namin sa QC',
    expected: {
      city: 'QUEZON CITY',
      province: 'NATIONAL CAPITAL REGION - SECOND DISTRICT',
      region: 'NCR'
    },
    reason: 'Tagalog area reference'
  },

  // Explicit Location Declarations
  {
    category: 'Explicit Location',
    text: 'Location is Taguig',
    expected: {
      city: 'TAGUIG',
      province: 'TAGUIG - PATEROS',
      region: 'NCR'
    },
    reason: 'Explicit location declaration'
  },
  {
    category: 'Explicit Location',
    text: 'Location: Sahud ulan, tanza',
    expected: {
      barangay: 'SAHUD ULAN',
      city: 'TANZA',
      province: 'CAVITE',
      region: 'REGION IV-A'
    },
    reason: 'Location prefix with barangay, city'
  },

  // From/In/At Patterns
  {
    category: 'From Pattern',
    text: 'From Makati City area',
    expected: {
      city: 'CITY OF MAKATI',
      province: 'NATIONAL CAPITAL REGION - FOURTH DISTRICT',
      region: 'NCR'
    },
    reason: 'From pattern with city'
  },
  {
    category: 'Here In Pattern',
    text: 'Here in Quezon City near UP Diliman',
    expected: {
      city: 'QUEZON CITY',
      province: 'NATIONAL CAPITAL REGION - SECOND DISTRICT',
      region: 'NCR'
    },
    reason: 'Here in pattern'
  },
  {
    category: 'Here In Pattern',
    text: 'Here in Cebu City, Lahug area',
    expected: {
      barangay: 'LAHUG',
      city: 'CEBU CITY',
      province: 'CEBU',
      region: 'REGION VII'
    },
    reason: 'Here in with barangay area'
  },

  // Tagalog Patterns
  {
    category: 'Tagalog Pattern',
    text: 'Taga Davao City ako',
    expected: {
      city: 'DAVAO CITY',
      province: 'DAVAO DEL SUR',
      region: 'REGION XI'
    },
    reason: 'Tagalog taga pattern'
  },
  {
    category: 'Tagalog Pattern',
    text: 'Dito sa Cebu City',
    expected: {
      city: 'CEBU CITY',
      province: 'CEBU',
      region: 'REGION VII'
    },
    reason: 'Tagalog dito sa pattern'
  },

  // Ambiguous Cases That Need Context
  {
    category: 'Ambiguous With Context',
    text: 'sarado AF malolos',
    expected: null,  // Should NOT match due to slang context
    reason: 'Slang expression, not location'
  },
  {
    category: 'Ambiguous With Context',
    text: 'Malolos, Bulacan area',
    expected: {
      city: 'MALOLOS CITY',
      province: 'BULACAN',
      region: 'REGION III'
    },
    reason: 'Proper city, province format'
  },

  // Montalban/Rodriguez Special Case
  {
    category: 'Alternative Names',
    text: 'Montalban Rizal',
    expected: {
      city: 'RODRIGUEZ (MONTALBAN)',
      province: 'RIZAL',
      region: 'REGION IV-A'
    },
    reason: 'Alternative city name'
  },

  // Numeric Barangays
  {
    category: 'Numeric Barangay',
    text: 'Brgy 171 Caloocan City',
    expected: {
      barangay: 'BARANGAY 171',
      city: 'CALOOCAN CITY',
      province: 'NATIONAL CAPITAL REGION - THIRD DISTRICT',
      region: 'NCR'
    },
    reason: 'Numeric barangay'
  },

  // Complex Cases from User Data
  {
    category: 'Complex',
    text: 'Just got mine installed today. Location: Brgy Navarro Gen Trias.',
    expected: {
      barangay: 'NAVARRO',
      city: 'GENERAL TRIAS CITY',
      province: 'CAVITE',
      region: 'REGION IV-A'
    },
    reason: 'Location embedded in longer text'
  },
  {
    category: 'Complex',
    text: 'Globe fibr issue. Naka red LOS blinking light Sahud ulan, tanza.',
    expected: {
      barangay: 'SAHUD ULAN',
      city: 'TANZA',
      province: 'CAVITE',
      region: 'REGION IV-A'
    },
    reason: 'Location at end of complaint'
  },
  {
    category: 'Complex',
    text: 'outage here in Consolacion, Cebu. Its been 4 days now',
    expected: {
      city: 'CONSOLACION',
      province: 'CEBU',
      region: 'REGION VII'
    },
    reason: 'Here in pattern with city, province'
  },

  // Edge Cases
  {
    category: 'Province Only',
    text: 'Walang kwenta walang 5g sa southern cebu',
    expected: {
      province: 'CEBU',
      region: 'REGION VII'
    },
    reason: 'Province reference only'
  },
  {
    category: 'Partial Match',
    text: 'is there an outage in rosario montalban rizal for globe fiber',
    expected: {
      barangay: 'ROSARIO',
      city: 'RODRIGUEZ (MONTALBAN)',
      province: 'RIZAL',
      region: 'REGION IV-A'
    },
    reason: 'Question with location'
  }
];

// Export for use in tests
module.exports = {
  regressionTests,

  // Helper to run tests
  runRegressionTests: function(parseLocationFn) {
    const results = {
      passed: 0,
      failed: 0,
      falsePositives: 0,
      falseNegatives: 0,
      byCategory: {}
    };

    const failures = [];

    regressionTests.forEach((test, index) => {
      const result = parseLocationFn(test.text);
      let passed = false;

      // Initialize category stats
      if (!results.byCategory[test.category]) {
        results.byCategory[test.category] = { total: 0, passed: 0 };
      }
      results.byCategory[test.category].total++;

      if (test.expected === null) {
        // Should NOT find location
        if (result === null) {
          passed = true;
          results.passed++;
          results.byCategory[test.category].passed++;
        } else {
          results.failed++;
          results.falsePositives++;
          failures.push({
            index: index + 1,
            category: test.category,
            text: test.text,
            expected: null,
            got: result,
            type: 'FALSE_POSITIVE'
          });
        }
      } else {
        // Should find location
        if (result !== null) {
          // Check if key fields match
          const matches =
            (!test.expected.barangay || result.barangay === test.expected.barangay) &&
            (!test.expected.city || result.city === test.expected.city) &&
            (!test.expected.province || result.province === test.expected.province);

          if (matches) {
            passed = true;
            results.passed++;
            results.byCategory[test.category].passed++;
          } else {
            results.failed++;
            failures.push({
              index: index + 1,
              category: test.category,
              text: test.text,
              expected: test.expected,
              got: result,
              type: 'WRONG_LOCATION'
            });
          }
        } else {
          results.failed++;
          results.falseNegatives++;
          failures.push({
            index: index + 1,
            category: test.category,
            text: test.text,
            expected: test.expected,
            got: null,
            type: 'FALSE_NEGATIVE'
          });
        }
      }
    });

    results.failures = failures;
    results.total = regressionTests.length;
    results.accuracy = (results.passed / results.total * 100).toFixed(1);

    return results;
  }
};