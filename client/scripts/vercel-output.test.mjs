import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuration, emit } from './vercel-output.mjs';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('reject unsafe destinations and cross-origin API settings', () => {
  for (const origin of [undefined, '', 'http://api.example.com', 'https://user:secret@api.example.com', 'https://api.example.com/path', 'https://api.example.com?q=1', 'https://api.example.com#x', 'https://localhost', 'https://api.example.com:3000']) {
    assert.throws(() => configuration({ RAILWAY_GATEWAY_ORIGIN: origin }));
  }
  assert.throws(() => configuration({ RAILWAY_GATEWAY_ORIGIN: 'https://api.example.com', VITE_API_BASE: 'https://api.example.com' }));
});
test('output preserves static assets and removes root index so filesystem cannot bypass SSR', () => {
  const root = mkdtempSync(join(tmpdir(), 'vercel-output-'));
  try {
    mkdirSync(join(root, 'dist/assets'), { recursive: true });
    writeFileSync(join(root, 'dist/index.html'), '<script src="/assets/app-hash.js"></script>');
    writeFileSync(join(root, 'dist/assets/app-hash.js'), '/* synthetic bundle */');
    emit(root, { RAILWAY_GATEWAY_ORIGIN: 'https://gateway.example.com' });
    assert.equal(existsSync(join(root, '.vercel/output/static/index.html')), false);
    assert.equal(readFileSync(join(root, '.vercel/output/static/assets/app-hash.js'), 'utf8'), '/* synthetic bundle */');
    assert.throws(() => emit(root, { RAILWAY_GATEWAY_ORIGIN: 'http://unsafe.example.com' }));
    assert.equal(existsSync(join(root, '.vercel/output/config.json')), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('API has no-store, static assets precede SSR, unknown pages keep origin status', () => {
  const { routes } = configuration({ RAILWAY_GATEWAY_ORIGIN: 'https://gateway.example.com' });
  assert.equal(routes[0].dest, 'https://gateway.example.com/api/$1');
  assert.equal(routes[0].headers['Cache-Control'], 'private, no-store');
  assert.equal(routes[1].dest, 'https://gateway.example.com/.well-known/jwks.json');
  assert.equal(routes.at(-2).handle, 'filesystem');
  assert.equal(routes.at(-1).dest, 'https://gateway.example.com/$1');
  assert.equal(routes.some(route => route.dest === '/index.html'), false);
});
