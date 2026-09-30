/** Create (or reuse) the dedicated main DRM verification application.
 * Shared verify-after-write rules live in drm-tenant-bootstrap.mjs.
 * No application-deletion API exists, so created applications are retained;
 * see the M5 closure report for the cleanup limitation.
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
  appName: 'FAYQ M5 disposable verification application',
  idVar: 'DRM_CLIENT_ID',
  secretVar: 'DRM_CLIENT_SECRET',
  idPrefix: 'fayq_m5_main_',
  baseUrl: 'http://127.0.0.1:3000',
  extraValues: { DRM_BASE_URL: 'http://host.docker.internal:3000' },
});

const after = parseEnv(platformEnvPath);
process.stdout.write(
  `mainTenantConfigured=true created=${result.created} reused=${result.reused} clientIdLength=${(after.get('DRM_CLIENT_ID') ?? '').length} clientSecretLength=${(after.get('DRM_CLIENT_SECRET') ?? '').length}\n`,
);
