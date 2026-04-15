
/**
 * Verification script for overview aggregation logic.
 * Mocks the Supabase client response and verifies the transformation logic.
 */

function processResponse(data) {
  const clicksByLink = {};

  if (data) {
    for (const row of data) {
      if (row.link_id) {
        clicksByLink[row.link_id] = row.total_clicks || 0;
      }
    }
  }
  return clicksByLink;
}

// Test cases
const testCases = [
  {
    name: "Standard response",
    input: [
      { link_id: "link-1", total_clicks: 100 },
      { link_id: "link-2", total_clicks: 50 },
      { link_id: "link-3", total_clicks: 0 }
    ],
    expected: { "link-1": 100, "link-2": 50, "link-3": 0 }
  },
  {
    name: "Empty response",
    input: [],
    expected: {}
  },
  {
    name: "Null response",
    input: null,
    expected: {}
  },
  {
    name: "Response with missing link_id",
    input: [
      { link_id: "link-1", total_clicks: 100 },
      { total_clicks: 50 }
    ],
    expected: { "link-1": 100 }
  },
  {
    name: "Response with null total_clicks",
    input: [
      { link_id: "link-1", total_clicks: null }
    ],
    expected: { "link-1": 0 }
  }
];

let allPassed = true;
for (const tc of testCases) {
  const actual = processResponse(tc.input);
  const passed = JSON.stringify(actual) === JSON.stringify(tc.expected);
  console.log(`${passed ? '✅' : '❌'} ${tc.name}`);
  if (!passed) {
    console.log(`   Expected: ${JSON.stringify(tc.expected)}`);
    console.log(`   Actual:   ${JSON.stringify(actual)}`);
    allPassed = false;
  }
}

if (allPassed) {
  console.log("\nAll verification tests passed!");
  process.exit(0);
} else {
  console.log("\nSome verification tests failed!");
  process.exit(1);
}
