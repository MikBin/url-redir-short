const http = require('http');
const https = require('https');

// Configuration
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000/api/analytics/v1/collect';
const CONCURRENCY = 10;
const TOTAL_REQUESTS = 100;

async function sendRequest(id) {
  const payload = JSON.stringify({
    path: `/load-test-${id % 10}`, // Reuse paths to test aggregation
    destination: 'https://example.com',
    timestamp: new Date().toISOString(),
    status: 200,
    user_agent: 'LoadTest/1.0',
    device_type: 'desktop',
    country: 'US'
  });

  const lib = TARGET_URL.startsWith('https') ? https : http;
  const url = new URL(TARGET_URL);

  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data });
        } else {
          reject(new Error(`Status: ${res.statusCode}, Body: ${data}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log(`Starting load test against ${TARGET_URL}`);
  console.log(`Concurrency: ${CONCURRENCY}, Total Requests: ${TOTAL_REQUESTS}`);

  const start = Date.now();
  let completed = 0;
  let success = 0;
  let failed = 0;

  const queue = Array.from({ length: TOTAL_REQUESTS }, (_, i) => i);
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      try {
        await sendRequest(id);
        success++;
      } catch (e) {
        // console.error(`Request ${id} failed:`, e.message);
        failed++;
      }
      completed++;
      if (completed % 10 === 0) {
        process.stdout.write(`\rProgress: ${completed}/${TOTAL_REQUESTS}`);
      }
    }
  });

  await Promise.all(workers);
  const duration = (Date.now() - start) / 1000;

  console.log('\n\nTest Complete');
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`RPS: ${(TOTAL_REQUESTS / duration).toFixed(2)}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
}

run();
