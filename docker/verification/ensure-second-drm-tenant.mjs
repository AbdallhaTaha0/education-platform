/** Create a disposable second DRM application through the supported admin API.
 * Credentials are generated once, stored only in the ignored platform .env,
 * and never emitted. A duplicate response is accepted on a later safe rerun.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const platformEnvPath = resolve(root, '.env');
const drmRoot = resolve(root, 'education-drm-service');
const drmEnvPath = resolve(drmRoot, '.env');

execFileSync('git', ['check-ignore', '--quiet', '.env'], { cwd: root, stdio: 'ignore' });
execFileSync('git', ['check-ignore', '--quiet', '.env'], { cwd: drmRoot, stdio: 'ignore' });

function parseEnv(path) {
  const values = new Map();
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index > 0) values.set(line.slice(0, index).trim(), line.slice(index + 1));
  }
  return values;
}

function setEnvValues(path, values) {
  let text = readFileSync(path, 'utf8');
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  for (const [name, value] of Object.entries(values)) {
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    if (pattern.test(text)) text = text.replace(pattern, line);
    else text = `${text.replace(/\s*$/, '')}${newline}${line}${newline}`;
  }
  writeFileSync(path, text, { encoding: 'utf8', mode: 0o600 });
}

const platformEnv = parseEnv(platformEnvPath);
const drmEnv = parseEnv(drmEnvPath);
const existingId = platformEnv.get('VERIFY_ALT_DRM_CLIENT_ID');
const existingSecret = platformEnv.get('VERIFY_ALT_DRM_CLIENT_SECRET');
const clientId = existingId || `fayq_m5_alt_${randomBytes(10).toString('hex')}`;
const clientSecret = existingSecret || randomBytes(40).toString('base64url');
const adminToken = drmEnv.get('ADMIN_API_TOKEN');
if (!adminToken) throw new Error('Missing ignored ADMIN_API_TOKEN');

setEnvValues(platformEnvPath, {
  VERIFY_ALT_DRM_CLIENT_ID: clientId,
  VERIFY_ALT_DRM_CLIENT_SECRET: clientSecret,
});

const response = await fetch('http://127.0.0.1:3000/v1/applications', {
  method: 'POST',
  headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    name: 'FAYQ M5 disposable isolation tenant',
    client_id: clientId,
    client_secret: clientSecret,
    drm_provider: 'CLEAR_KEY',
  }),
});

if (response.status !== 201 && response.status !== 409) {
  throw new Error(`Second tenant bootstrap failed with status ${response.status}`);
}
process.stdout.write(
  `secondTenantConfigured=true status=${response.status} clientIdLength=${clientId.length} clientSecretLength=${clientSecret.length}\n`,
);
