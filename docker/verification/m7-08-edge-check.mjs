import assert from 'node:assert/strict';
const base = 'http://edge:8080';
async function get(path, init) {
  return fetch(base + path, { ...init, signal: AbortSignal.timeout(5000) });
}
for (const path of [
  '/',
  '/#/courses',
  '/edge-health',
  '/api/health/live',
  '/api/health/ready',
  '/.well-known/jwks.json',
]) {
  assert.equal((await get(path)).status, 200, path);
  console.log(`PASS ${path}`);
}
const csrf = await get('/api/auth/csrf', {
  headers: { Origin: 'https://m7-fixture.example.test' },
});
assert.equal(csrf.status, 200);
const cookie = csrf.headers.get('set-cookie');
assert(cookie.includes('Secure'));
assert(cookie.includes('SameSite=Lax'));
assert.equal(csrf.headers.get('x-content-type-options'), 'nosniff');
console.log('PASS production Secure CSRF cookie and headers through edge');
const forbidden = await get('/api/admin/catalog/summary');
assert.equal(forbidden.status, 401);
console.log('PASS anonymous admin refusal through edge');
// Bounded local smoke, not a 10,000-user qualification.
const latencies = [];
let failures = 0;
await Promise.all(
  Array.from({ length: 20 }, async () => {
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      const r = await get('/api/catalog/courses');
      if (r.status !== 200) failures++;
      await r.arrayBuffer();
      latencies.push(performance.now() - start);
    }
  }),
);
latencies.sort((a, b) => a - b);
assert.equal(failures, 0);
console.log(
  JSON.stringify({
    scope: 'local catalog smoke only',
    concurrency: 20,
    requests: 200,
    failures,
    p95Ms: Math.round(latencies[Math.ceil(latencies.length * 0.95) - 1]),
  }),
);
