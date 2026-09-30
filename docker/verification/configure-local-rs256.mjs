/**
 * Configure the ignored local environment files for the M5 RS256/JWKS drill.
 *
 * The private key is generated and written in-process and is never emitted.
 * Output is deliberately limited to public identifiers plus presence/length
 * metadata. Both target files must already be ignored by Git.
 */
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const platformEnv = resolve(root, '.env');
const drmRoot = resolve(root, 'education-drm-service');
const drmEnv = resolve(drmRoot, '.env');

function assertIgnored(cwd, relativePath) {
  execFileSync('git', ['check-ignore', '--quiet', relativePath], { cwd, stdio: 'ignore' });
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

assertIgnored(root, '.env');
assertIgnored(drmRoot, '.env');

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const privateKeyB64 = Buffer.from(privatePem, 'utf8').toString('base64');

const issuer = 'http://localhost:8082';
const audience = 'fayq-drm-local';
const keyId = 'fayq-local-20260930';

setEnvValues(platformEnv, {
  DRM_ASSERTION_ISSUER: issuer,
  DRM_ASSERTION_AUDIENCE: audience,
  DRM_ASSERTION_PRIVATE_KEY_B64: privateKeyB64,
  DRM_ASSERTION_KEY_ID: keyId,
  DRM_ASSERTION_MAX_LIFETIME_SEC: '120',
  // Browser-facing DRM origin as seen from in-Docker Chromium (string
  // resolution only; the platform never fetches it server-side).
  DRM_PUBLIC_BASE_URL: 'http://host.docker.internal:3000',
});

setEnvValues(drmEnv, {
  JWT_ISSUER: issuer,
  JWT_AUDIENCE: audience,
  JWT_JWKS_URL: 'http://host.docker.internal:8082/api/.well-known/jwks.json',
  PLAYBACK_ASSERTION_REQUIRED: 'true',
});

process.stdout.write(
  `configured=true algorithm=RS256 modulusBits=2048 kidLength=${keyId.length} privateKeyB64Length=${privateKeyB64.length}\n`,
);
