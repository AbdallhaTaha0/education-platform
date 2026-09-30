/** Create a disposable second DRM application through the supported admin API.
 * Shared verify-after-write rules live in drm-tenant-bootstrap.mjs.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { bootstrapTenant, parseEnv } from './drm-tenant-bootstrap.mjs';

const root = resolve(import.meta.dirname, '..', '..');
const platformEnvPath = resolve(root, '.env');
const drmRoot = resolve(root, 'education-drm-service');
const drmEnvPath = resolve(drmRoot, '.env');

execFileSync('git', ['check-ignore', '--quiet', '.env'], { cwd: root, stdio: 'ignore' });
execFileSync('git', ['check-ignore', '--quiet', '.env'], { cwd: drmRoot, stdio: 'ignore' });

const adminToken = parseEnv(drmEnvPath).get('ADMIN_API_TOKEN');
if (!adminToken) throw new Error('Missing ignored ADMIN_API_TOKEN');

const result = await bootstrapTenant({
  platformEnvPath,
  adminToken,
  appName: 'FAYQ M5 disposable isolation tenant',
  idVar: 'VERIFY_ALT_DRM_CLIENT_ID',
  secretVar: 'VERIFY_ALT_DRM_CLIENT_SECRET',
  idPrefix: 'fayq_m5_alt_',
  baseUrl: 'http://127.0.0.1:3000',
});

const after = parseEnv(platformEnvPath);
process.stdout.write(
  `secondTenantConfigured=true created=${result.created} reused=${result.reused} clientIdLength=${(after.get('VERIFY_ALT_DRM_CLIENT_ID') ?? '').length} clientSecretLength=${(after.get('VERIFY_ALT_DRM_CLIENT_SECRET') ?? '').length}\n`,
);
