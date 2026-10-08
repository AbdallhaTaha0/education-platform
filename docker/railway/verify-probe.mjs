// Runs inside the disposable backend container. No credentials/bodies printed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = 'http://gateway:8080';
for (const path of ['/api/health/live','/api/health/ready','/.well-known/jwks.json']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('content-type'), /json/);
  console.log(`PASS ${path}`);
}
const auth = await fetch(base + '/api/learning/dashboard');
assert.equal(auth.status, 401);
assert.match(auth.headers.get('content-type'), /json/);
const csrf = await fetch(base + '/api/auth/csrf', { headers: { Origin: 'https://students.example.test' } });
assert.equal(csrf.status, 200);
assert.match(csrf.headers.get('set-cookie'), /Secure/);
assert.match(csrf.headers.get('set-cookie'), /SameSite=Lax/i);
assert.match(csrf.headers.get('set-cookie'), /Path=\//);
const jwks = await (await fetch(base + '/.well-known/jwks.json')).json();
assert.equal(jwks.keys.length, 1);
for (const key of ['d','p','q','dp','dq','qi']) assert.equal(jwks.keys[0][key], undefined);
for (const path of ['/ar','/en']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /FAYQ/);
  const backendHtml = readFileSync('/srv/server/public-render/index.html','utf8');
  for (const match of backendHtml.matchAll(/\/assets\/[^"'\s]+/g)) assert.ok(html.includes(match[0]), 'SSR must reference matching client assets');
}
assert.equal((await fetch(base + '/api/seo/ar')).status, 404);
assert.equal((await fetch(base + '/api/does-not-exist')).status, 404);
console.log('PASS production-mode gateway, auth denial, Secure CSRF, public JWKS, bilingual SSR and internal route protection');
