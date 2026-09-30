/** Configure the ignored DRM development environment for the bounded expiry drill. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const drmRoot = resolve(root, 'education-drm-service');
const drmEnv = resolve(drmRoot, '.env');

execFileSync('git', ['check-ignore', '--quiet', '.env'], { cwd: drmRoot, stdio: 'ignore' });

const text = readFileSync(drmEnv, 'utf8');
const newline = text.includes('\r\n') ? '\r\n' : '\n';
const line = 'PLAYBACK_TOKEN_TTL=10';
const updated = /^PLAYBACK_TOKEN_TTL=.*$/m.test(text)
  ? text.replace(/^PLAYBACK_TOKEN_TTL=.*$/m, line)
  : `${text.replace(/\s*$/, '')}${newline}${line}${newline}`;
writeFileSync(drmEnv, updated, { encoding: 'utf8', mode: 0o600 });

process.stdout.write('configured=true playbackTokenTtlSeconds=10 environment=development\n');
