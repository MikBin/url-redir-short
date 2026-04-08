
// Mocking the behavior of detailed.get.ts with the new RPC logic
const statsResponse = {
  total_clicks: 100,
  unique_visitors: 50,
  time_series: [{ period: '2023-01-01', count: 100 }],
  countries: [{ value: 'US', count: 80 }, { value: 'GB', count: 20 }],
  cities: [{ value: 'New York', count: 50 }],
  devices: [{ value: 'desktop', count: 70 }],
  browsers: [{ value: 'Chrome', count: 90 }],
  operating_systems: [{ value: 'Windows', count: 60 }],
  referrers: [{ value: 'https://google.com', count: 40 }]
};

function verifyResponse(stats) {
  const result = {
    summary: {
      totalClicks: stats.total_clicks || 0,
      uniqueVisitors: stats.unique_visitors || 0
    },
    timeSeries: stats.time_series || [],
    geographic: {
      countries: stats.countries || [],
      cities: stats.cities || []
    },
    devices: stats.devices || [],
    browsers: stats.browsers || [],
    operatingSystems: stats.operating_systems || [],
    referrers: stats.referrers || []
  };

  console.log('Verified Result Structure:');
  console.log(JSON.stringify(result, null, 2));

  // Basic assertions
  if (result.summary.totalClicks !== 100) throw new Error('totalClicks mismatch');
  if (result.summary.uniqueVisitors !== 50) throw new Error('uniqueVisitors mismatch');
  if (result.geographic.countries.length !== 2) throw new Error('countries length mismatch');
  console.log('Verification successful!');
}

verifyResponse(statsResponse);
