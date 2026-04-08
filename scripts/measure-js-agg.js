
const numRows = 10000;
const data = Array.from({ length: numRows }, (_, i) => ({
  country: ['US', 'GB', 'FR', 'DE', 'JP'][i % 5],
  city: ['New York', 'London', 'Paris', 'Berlin', 'Tokyo'][i % 5],
  device_type: ['desktop', 'mobile', 'tablet'][i % 3],
  browser: ['Chrome', 'Firefox', 'Safari'][i % 3],
  os: ['Windows', 'macOS', 'Linux', 'iOS', 'Android'][i % 5],
  referrer: 'https://google.com',
  timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
  session_id: `session-${i % 1000}`
}));

function aggregateField(data, field) {
  const breakdown = {}
  data.forEach(row => {
    const value = row[field]
    if (value) {
      breakdown[value] = (breakdown[value] || 0) + 1
    }
  })
  return Object.entries(breakdown)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
}

function processTimeSeries(data, groupBy, fromDate, toDate) {
  const buckets = {}
  data.forEach(row => {
    const date = new Date(row.timestamp)
    const key = date.toISOString().substring(0, 10)
    buckets[key] = (buckets[key] || 0) + 1
  })
  return Object.entries(buckets).map(([period, count]) => ({ period, count }))
}

const start = performance.now();
const iterations = 100;
for (let i = 0; i < iterations; i++) {
    const timeSeriesData = processTimeSeries(data, 'day', new Date(), new Date());
    const uniqueSessions = new Set(data.map(r => r.session_id));
    const geoBreakdown = aggregateField(data, 'country');
    const cityBreakdown = aggregateField(data, 'city');
    const deviceBreakdown = aggregateField(data, 'device_type');
    const browserBreakdown = aggregateField(data, 'browser');
    const osBreakdown = aggregateField(data, 'os');
    const referrerBreakdown = aggregateField(data, 'referrer');
}
const end = performance.now();
console.log(`JS aggregation of ${numRows} rows took ${((end - start) / iterations).toFixed(2)}ms per iteration`);
