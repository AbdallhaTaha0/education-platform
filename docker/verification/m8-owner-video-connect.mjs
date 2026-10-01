// Read secrets in-process; write only the ignored, owner-preview connection file.
import fs from 'node:fs';
import { parseEnv, probeApplication } from './drm-tenant-bootstrap.mjs';
const platform = parseEnv('/work/.env'),
  drm = parseEnv('/work/education-drm-service/.env');
const id = platform.get('DRM_CLIENT_ID'),
  secret = platform.get('DRM_CLIENT_SECRET');
if (!id || !secret || !drm.get('ADMIN_API_TOKEN'))
  throw new Error('Required existing credentials missing');
const base = 'http://host.docker.internal:3000';
const response = await fetch(base + '/v1/applications', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${drm.get('ADMIN_API_TOKEN')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'FAYQ retained local owner preview',
    client_id: id,
    client_secret: secret,
    drm_provider: 'CLEAR_KEY',
  }),
});
if (![201, 409].includes(response.status))
  throw new Error(`Application bootstrap status=${response.status}`);
if (!(await probeApplication(base, id, secret)).ok)
  throw new Error('Existing application pair did not authenticate; unchanged');
const connection = { DRM_BASE_URL: base, DRM_PUBLIC_BASE_URL: 'http://localhost:3000' };
for (const key of [
  'DRM_CLIENT_ID',
  'DRM_CLIENT_SECRET',
  'DRM_ASSERTION_ISSUER',
  'DRM_ASSERTION_AUDIENCE',
  'DRM_ASSERTION_KEY_ID',
  'DRM_ASSERTION_PRIVATE_KEY_B64',
  'DRM_ASSERTION_MAX_LIFETIME_SEC',
]) {
  const value = platform.get(key);
  if (!value || /[\r\n]/.test(value)) throw new Error(`Missing/invalid ${key}`);
  connection[key] = value;
}
fs.writeFileSync(
  '/evidence/drm-connection.env.local',
  Object.entries(connection)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n',
  { mode: 0o600 },
);
console.log(
  'CONNECT_OK: existing application authenticated; ignored preview connection written; original environment files unchanged. Local ClearKey only.',
);
