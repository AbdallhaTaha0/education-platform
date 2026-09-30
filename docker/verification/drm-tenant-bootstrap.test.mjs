/** Docker-executed tests for drm-tenant-bootstrap.mjs verify-after-write rules.
 *
 * Runs against an in-process isolated HTTP fixture (loopback only) — no real
 * tenant is created. Execute inside Docker:
 *   docker run --rm --network none -v <repo>:/repo -w /repo
 *     edu-platform-server:0.5.0-m5-rs256verify
 *     node docker/verification/drm-tenant-bootstrap.test.mjs
 */
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrapTenant, parseEnv } from './drm-tenant-bootstrap.mjs';

const apps = new Map(); // clientId -> clientSecret (fixture tenant store)

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
  });
}

const fixture = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (req.method === 'POST' && url.pathname === '/v1/applications') {
    const body = JSON.parse(await readBody(req));
    if (apps.has(body.client_id)) { res.writeHead(409, { 'content-type': 'application/json' }); res.end('{}'); return; }
    apps.set(body.client_id, body.client_secret);
    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ clientId: body.client_id }));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/v1/media') {
    const ok = apps.get(req.headers['x-client-id']) === req.headers['x-client-secret'];
    res.writeHead(ok ? 400 : 401, { 'content-type': 'application/json' });
    res.end('{}');
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end('{}');
});

await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${fixture.address().port}`;

const dir = mkdtempSync(join(tmpdir(), 'tenant-test-'));
const envFile = (n) => {
  const p = join(dir, `${n}.env`);
  writeFileSync(p, '# tenant bootstrap test\n', { encoding: 'utf8', mode: 0o600 });
  return p;
};

let failed = 0;
const check = (label, cond) => {
  if (!cond) failed += 1;
  process.stdout.write(`${cond ? 'PASS' : 'FAIL'} ${label}\n`);
};

// 1. Successful creation into an empty file.
const f1 = envFile('create');
const r1 = await bootstrapTenant({
  platformEnvPath: f1, adminToken: 'test-admin', appName: 'fixture app',
  idVar: 'T_ID', secretVar: 'T_SECRET', idPrefix: 'fix_', baseUrl,
});
const snap1 = readFileSync(f1, 'utf8');
check('create returns created=true', r1.created === true && r1.reused === false);
check('create persists id and secret', snap1.includes('T_ID=fix_') && snap1.includes('T_SECRET='));

// 2. Valid reuse preserves credentials (server answers 409, probe answers 400).
const r2 = await bootstrapTenant({
  platformEnvPath: f1, adminToken: 'test-admin', appName: 'fixture app',
  idVar: 'T_ID', secretVar: 'T_SECRET', idPrefix: 'fix_', baseUrl,
});
check('reuse returns reused=true', r2.reused === true && r2.created === false);
check('reuse leaves file byte-identical', readFileSync(f1, 'utf8') === snap1);

// 3. Conflicting application with wrong secret fails safely without overwrite.
const realId = parseEnv(f1).get('T_ID');
const f3 = envFile('conflict');
writeFileSync(f3, `T_ID=${realId}\nT_SECRET=wrong-secret-value\n`, { encoding: 'utf8', mode: 0o600 });
const snap3 = readFileSync(f3, 'utf8');
let conflictErr = '';
try {
  await bootstrapTenant({
    platformEnvPath: f3, adminToken: 'test-admin', appName: 'fixture app',
    idVar: 'T_ID', secretVar: 'T_SECRET', idPrefix: 'fix_', baseUrl,
  });
} catch (e) { conflictErr = e.message ?? ''; }
check('wrong secret fails', conflictErr.includes('do not authenticate'));
check('wrong secret names the variable, not the value', conflictErr.includes('T_ID') && !conflictErr.includes('wrong-secret-value'));
check('wrong secret leaves file unchanged', readFileSync(f3, 'utf8') === snap3);

// 4. Network failure stores nothing.
const f4 = envFile('unreachable');
let netErr = '';
try {
  await bootstrapTenant({
    platformEnvPath: f4, adminToken: 'test-admin', appName: 'fixture app',
    idVar: 'T_ID', secretVar: 'T_SECRET', idPrefix: 'fix_', baseUrl: 'http://127.0.0.1:1',
  });
} catch (e) { netErr = e.message ?? ''; }
check('network failure fails safely', netErr.includes('unchanged') || netErr.includes('unreachable'));
check('network failure stores nothing', !readFileSync(f4, 'utf8').includes('T_ID='));

// 5. Half-present pair fails with recovery guidance.
const f5 = envFile('half');
writeFileSync(f5, 'T_ID=orphan-id\n', { encoding: 'utf8', mode: 0o600 });
let halfErr = '';
try {
  await bootstrapTenant({
    platformEnvPath: f5, adminToken: 'test-admin', appName: 'fixture app',
    idVar: 'T_ID', secretVar: 'T_SECRET', idPrefix: 'fix_', baseUrl,
  });
} catch (e) { halfErr = e.message ?? ''; }
check('half-present pair fails with recovery message', halfErr.includes('half-present') && halfErr.includes('T_SECRET'));

fixture.close();
if (failed > 0) { process.stderr.write(`tenant bootstrap tests: ${failed} failure(s)\n`); process.exit(1); }
process.stdout.write('tenant bootstrap tests: all pass\n');
