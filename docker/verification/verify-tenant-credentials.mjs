/** Verify the two existing real verification applications authenticate.
 * Creates nothing: only the non-mutating probe (POST /v1/media with an empty
 * body, valid authentication answers 400). Output is labels plus statuses.
 */
import { resolve } from 'node:path';
import { parseEnv, probeApplication } from './drm-tenant-bootstrap.mjs';

const root = resolve(import.meta.dirname, '..', '..');
const env = parseEnv(resolve(root, '.env'));
const baseUrl = 'http://127.0.0.1:3000';

const pairs = [
  ['main', env.get('DRM_CLIENT_ID'), env.get('DRM_CLIENT_SECRET')],
  ['second', env.get('VERIFY_ALT_DRM_CLIENT_ID'), env.get('VERIFY_ALT_DRM_CLIENT_SECRET')],
];

let failed = 0;
for (const [label, id, secret] of pairs) {
  if (!id || !secret) {
    process.stdout.write(`FAIL ${label}: credentials missing\n`);
    failed += 1;
    continue;
  }
  const probe = await probeApplication(baseUrl, id, secret);
  const pass = probe.ok === true;
  if (!pass) failed += 1;
  process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${label}: status=${probe.status ?? 'network-error'}\n`);
}
if (failed > 0) { process.stderr.write(`tenant credential verification: ${failed} failure(s)\n`); process.exit(1); }
process.stdout.write('tenant credential verification: both applications authenticate\n');
