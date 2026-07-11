/**
 * k6 smoke load test — run against a local or staging API.
 *
 * Install: https://k6.io/docs/get-started/installation/
 * Run:     k6 run scripts/load/smoke.js
 * Custom:  k6 run -e BASE_URL=https://api.example.com scripts/load/smoke.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
}

export default function () {
  const health = http.get(`${BASE_URL}/api/health`)
  check(health, {
    'health status 200': (r) => r.status === 200,
    'health body ok': (r) => r.json('status') === 'ok',
  })

  const pins = http.get(`${BASE_URL}/api/locations?city=manila&limit=100`)
  check(pins, {
    'pins status 200': (r) => r.status === 200,
    'pins is array': (r) => Array.isArray(r.json()),
  })

  const leaderboard = http.get(`${BASE_URL}/api/leaderboard?city=manila&limit=25`)
  check(leaderboard, {
    'leaderboard status 200': (r) => r.status === 200,
  })

  sleep(1)
}
