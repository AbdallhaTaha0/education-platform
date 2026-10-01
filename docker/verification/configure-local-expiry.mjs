/** Bounded playback-token TTL drill configuration (TEST-ONLY).
 *
 * Never touches code or production minimums; only the ignored DRM development
 * environment file. Development-only guard: `--set` requires the explicit
 * `--dev` flag AND refuses when the file carries production markers
 * (NODE_ENV=production or CLEAR_KEY_ENABLED=false). The previous value is
 * recorded to a state file so `--restore` reliably reinstates it, even when a
 * stage failed in between. Output is statuses and lengths only.
 *
 * Usage:
 *   node configure-local-expiry.mjs --set --dev --state <path>      # TTL=10s
 *   node configure-local-expiry.mjs --restore --state <path>        # put back
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NAME = 'PLAYBACK_TOKEN_TTL';
const DRILL_SECONDS = 10;

const root = resolve(import.meta.dirname, '..', '..');
const drmRoot = resolve(root, 'education-drm-service');
const drmEnv = resolve(drmRoot, '.env');

execFileSync('git', ['check-ignore', '--quiet', '.env'], { cwd: drmRoot, stdio: 'ignore' });

function readEnv(path) {
  const values = new Map();
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index > 0) values.set(line.slice(0, index).trim(), line.slice(index + 1));
  }
  return values;
}

function setEnvValue(path, name, value) {
  const text = readFileSync(path, 'utf8');
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  const updated = pattern.test(text)
    ? text.replace(pattern, line)
    : `${text.replace(/\s*$/, '')}${newline}${line}${newline}`;
  writeFileSync(path, updated, { encoding: 'utf8', mode: 0o600 });
}

function statePath() {
  const flag = process.argv.find((a) => a.startsWith('--state='));
  const positional = process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--state');
  const path = flag ? flag.slice('--state='.length) : positional;
  if (!path) throw new Error('a --state <path> file is required');
  return resolve(path);
}

const mode = process.argv.includes('--set')
  ? 'set'
  : process.argv.includes('--restore')
    ? 'restore'
    : null;
if (!mode) throw new Error('pass --set or --restore');

if (mode === 'set') {
  if (!process.argv.includes('--dev'))
    throw new Error('refusing: --dev flag is required for TTL changes');
  const current = readEnv(drmEnv);
  if (current.get('NODE_ENV') === 'production')
    throw new Error('refusing: production environment marker');
  if (current.get('CLEAR_KEY_ENABLED') === 'false')
    throw new Error('refusing: production DRM marker');
  const previous = current.get(NAME) ?? '';
  if (!/^\d+$/.test(previous)) throw new Error('refusing: current TTL is not a plain integer');
  writeFileSync(statePath(), JSON.stringify({ previous }), { encoding: 'utf8', mode: 0o600 });
  setEnvValue(drmEnv, NAME, String(DRILL_SECONDS));
  process.stdout.write(
    `expiry drill set: previousLength=${previous.length} ttlSeconds=${DRILL_SECONDS}\n`,
  );
} else {
  const saved = JSON.parse(readFileSync(statePath(), 'utf8'));
  if (!saved || !/^\d+$/.test(saved.previous ?? ''))
    throw new Error('refusing: state file has no valid previous TTL');
  setEnvValue(drmEnv, NAME, saved.previous);
  process.stdout.write(`expiry drill restored: ttlLength=${saved.previous.length}\n`);
}
