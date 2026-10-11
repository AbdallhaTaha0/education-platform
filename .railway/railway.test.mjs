import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRailwayContext } from 'railway/iac';

const source = readFileSync(new URL('./railway.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace("'railway/iac'", JSON.stringify(import.meta.resolve('railway/iac')));
const { default: configure } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const names = ['PLATFORM_RUNTIME_IMAGE','PLATFORM_MIGRATE_IMAGE','PLATFORM_GATEWAY_IMAGE','PLATFORM_POSTGRES_IMAGE','PLATFORM_REDIS_IMAGE'];
for (const name of names) process.env[name] = `ghcr.io/example/${name.toLowerCase()}@sha256:${'a'.repeat(64)}`;

test('reject unknown environment and unpinned release image', () => {
  assert.throws(() => configure(createRailwayContext({ environment: 'dev', projectName: 'fayq' })));
  const original = process.env.PLATFORM_RUNTIME_IMAGE;
  process.env.PLATFORM_RUNTIME_IMAGE = 'ghcr.io/example/server:latest';
  assert.throws(() => configure(createRailwayContext({ environment: 'testing', projectName: 'fayq' })));
  process.env.PLATFORM_RUNTIME_IMAGE = original;
});
test('no-DRM graph has platform services only and no execution socket', () => {
  const graph = configure(createRailwayContext({ environment: 'testing', projectName: 'fayq' }));
  assert.equal(graph.resources.length, 5);
  const json = JSON.stringify(graph);
  for (const name of ['platform-postgres','platform-redis','platform-backend','platform-migrate','platform-gateway']) assert.ok(json.includes(name));
  for (const name of ['drm-postgres','drm-valkey','drm-api','drm-worker','drm-migrate','DRM_BASE_URL','WIDEVINE']) assert.ok(!json.includes(name));
  assert.ok(json.includes('npx prisma migrate deploy'));
  assert.ok(!json.includes('docker.sock'));
  assert.ok(!json.includes('npm run test'));
  assert.ok(!json.includes('migrate.js'));
});
