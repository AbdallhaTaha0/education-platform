/** Prepare and optionally bootstrap a throwaway platform admin without
 * exposing its credentials in process arguments or output. The credentials
 * live only in the ignored root .env and are consumed by the live harness.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const envPath = resolve(root, '.env');
execFileSync('git', ['check-ignore', '--quiet', '.env'], { cwd: root, stdio: 'ignore' });

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

const current = parseEnv(envPath);
const suffix = randomBytes(8).toString('hex');
const identifier = current.get('VERIFY_ADMIN_IDENTIFIER') || `fayq-m5-${suffix}@example.test`;
const password = current.get('VERIFY_ADMIN_PASSWORD') || randomBytes(24).toString('base64url');
const name = current.get('VERIFY_ADMIN_NAME') || 'FAYQ M5 Verification Admin';
const phone = current.get('VERIFY_ADMIN_PHONE') || `+201${randomInt(100000000, 999999999)}`;

setEnvValues(envPath, {
  VERIFY_ADMIN_IDENTIFIER: identifier,
  VERIFY_ADMIN_PASSWORD: password,
  VERIFY_ADMIN_NAME: name,
  VERIFY_ADMIN_PHONE: phone,
});

if (process.argv.includes('--bootstrap')) {
  const result = spawnSync(
    'docker',
    [
      'compose', '--env-file', '.env', '-p', 'education-platform-rs256',
      '-f', 'docker/compose.dev.yml', 'run', '--rm', '--no-deps',
      '-e', 'BOOTSTRAP_ADMIN_NAME', '-e', 'BOOTSTRAP_ADMIN_EMAIL',
      '-e', 'BOOTSTRAP_ADMIN_PHONE', '-e', 'BOOTSTRAP_ADMIN_PASSWORD',
      'server', 'node', 'dist/bootstrap.js',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PGDATA_NAME: 'education-platform-rs256_pgdata',
        REDISDATA_NAME: 'education-platform-rs256_redisdata',
        NGINX_PORT: '8082',
        ALLOWED_ORIGINS: 'http://localhost:8082',
        BOOTSTRAP_ADMIN_NAME: name,
        BOOTSTRAP_ADMIN_EMAIL: identifier,
        BOOTSTRAP_ADMIN_PHONE: phone,
        BOOTSTRAP_ADMIN_PASSWORD: password,
      },
    },
  );
  if (result.status !== 0) throw new Error(`Admin bootstrap failed with exit ${result.status ?? 'unknown'}`);
  process.stdout.write('verificationAdminBootstrapped=true project=education-platform-rs256\n');
} else {
  process.stdout.write(
    `verificationAdminPrepared=true identifierLength=${identifier.length} passwordLength=${password.length} phoneLength=${phone.length}\n`,
  );
}
