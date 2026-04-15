
function establishBaseline(numRows) {
  const data = Array.from({ length: numRows }, (_, i) => ({
    link_id: `link-${i % 100}`,
    click_count: Math.floor(Math.random() * 100)
  }));

  const start = performance.now();

  const clicksByLink = {};
  if (data) {
    for (const row of data) {
      if (row.link_id) {
        clicksByLink[row.link_id] = (clicksByLink[row.link_id] || 0) + (row.click_count || 0)
      }
    }
  }

  const end = performance.now();
  return end - start;
}

const iterations = 100;

console.log('--- Baseline: JS-side Aggregation ---');

let totalTime10k = 0;
for (let i = 0; i < iterations; i++) {
  totalTime10k += establishBaseline(10000);
}
console.log(`Aggregation of 10,000 rows (JS-side): ${(totalTime10k / iterations).toFixed(4)}ms`);

let totalTime100k = 0;
for (let i = 0; i < iterations; i++) {
  totalTime100k += establishBaseline(100000);
}
console.log(`Aggregation of 100,000 rows (JS-side): ${(totalTime100k / iterations).toFixed(4)}ms`);
