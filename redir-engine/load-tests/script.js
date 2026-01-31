import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Configuration
const HOST = __ENV.HOST || 'http://localhost:3002';
const RPS = parseInt(__ENV.RPS || '100');
const VUS = parseInt(__ENV.VUS || '10');
const DURATION = __ENV.DURATION || '30s';
const RULE_COUNT = parseInt(__ENV.RULE_COUNT || '5000');
const EXPECT_404 = __ENV.EXPECT_404 === 'true';

export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-arrival-rate',
      rate: RPS,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: VUS,
      maxVUs: VUS * 2,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'], // 95% of requests must complete below 200ms
    errors: ['rate<0.01'], // <1% errors
  },
};

export default function () {
  // If expecting only 404s (Integrated Smoke Test), force miss scenario
  // Otherwise default 80% hit / 20% miss
  const isHit = EXPECT_404 ? false : Math.random() < 0.8;

  let res;
  let path;

  if (isHit) {
    const id = Math.floor(Math.random() * RULE_COUNT);
    path = `/load-${id}`;
  } else {
    const id = Math.floor(Math.random() * 1000);
    path = `/missing-${id}`;
  }

  // Disable auto-redirect to measure engine response time directly
  res = http.get(`${HOST}${path}`, { redirects: 0 });

  let checkRes;
  if (isHit) {
    // Expect 301, 302, or 307
    checkRes = check(res, {
      'status is 3xx': (r) => r.status >= 300 && r.status < 400,
      'has location header': (r) => r.headers['Location'] !== undefined,
    });
  } else {
    // Expect 404
    checkRes = check(res, {
      'status is 404': (r) => r.status === 404,
    });
  }

  if (!checkRes) {
    errorRate.add(1);
    console.log(`Failed: ${res.status} ${res.url} (Expected Hit: ${isHit})`);
  }
}
