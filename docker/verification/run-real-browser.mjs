/** Test-only Docker browser closure. Preserves data and restores the API TTL. */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { runIsoFlow, mediaGenArgs, scratchReadArgs, scratchWriteArgs } from './run-live-lifecycle.mjs';

const root = resolve(import.meta.dirname, '../..');
const stageImage = 'edu-platform-browser:0.5.0-m5-verify';
const nodeImage = 'edu-platform-server:0.5.0-m5-rs256verify';
const docker = process.env.DOCKER_EXE || 'docker';
function run(args, opts = {}) {
  return spawnSync(docker, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...opts });
}
function env(path) {
  return Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1)];
  }));
}
const compose = ['compose', '--env-file', 'education-drm-service/.env', '-p', 'education-drm-service',
  '-f', 'education-drm-service/docker/docker-compose.yml', '-f', 'docker/verification/compose.drm-verify.yml'];
function reload(ttl) {
  const childEnv = { ...process.env };
  delete childEnv.PLAYBACK_TOKEN_TTL;
  if (ttl) childEnv.PLAYBACK_TOKEN_TTL = ttl;
  const r = run([...compose, 'up', '-d', '--no-deps', 'api'], { env: childEnv });
  if (r.status !== 0) throw new Error('API reload failed');
}
const tag = randomBytes(6).toString('hex');
const seconds = process.env.BROWSER_VIDEO_SECONDS || '120';
if (!['1', '120'].includes(seconds)) throw new Error('Unsupported test media duration');
const evidence = join(root, 'docker/browser/evidence', `real-${tag}`);
mkdirSync(evidence, { recursive: true });
let code = 1;
let altered = false;
try {
  const guard = spawnSync(process.execPath, ['docker/verification/rs256-project.mjs', 'check'], { cwd: root, env: process.env, encoding: 'utf8' });
  if (guard.status !== 0) throw new Error('Disposable project guard refused');
  const resolver = run(['run', '--rm', nodeImage, 'getent', 'hosts', 'host.docker.internal']);
  const ip = resolver.stdout?.trim().split(/\s+/)[0];
  if (resolver.status !== 0 || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) throw new Error('Host gateway unresolved');
  altered = true;
  reload('60');
  const outcome = await runIsoFlow({
    spawn: run, tag, root, tmpdir: tmpdir(), stageImage, stageWorkdir: '/srv/browser', isoWaits: 240,
    evidencePath: join(evidence, 'checks.log'),
    stageCommand: ['node', 'm5-real-learning.mjs'],
    extraMounts: ['-v', `${root}/docker/browser/m5-real-learning.mjs:/srv/browser/m5-real-learning.mjs:ro`, '-v', `${evidence}:/evidence`],
    generateMedia: (scratch, name) => mediaGenArgs(scratch, name).map(a => a.replaceAll('duration=1', `duration=${seconds}`)),
    envValues: { ...env(join(root, 'education-drm-service/.env')), ...env(join(root, '.env')),
      MEDIA_PATH: `/scratch/m5-live-${tag}.mp4`, ISO_FILE: '/scratch/iso.json', ISO_DONE_FILE: '/scratch/iso-done.json',
      EVIDENCE_DIR: '/evidence', RESOLVER_IP: ip },
    readScratch: async path => {
      const [vol, ...parts] = path.split('/').filter(Boolean);
      const r = run(scratchReadArgs(vol, parts.join('/')));
      return r.status === 0 ? r.stdout : null;
    },
    writeScratch: async (path, content) => {
      const [vol, ...parts] = path.split('/').filter(Boolean);
      const r = run(scratchWriteArgs(vol, parts.join('/')), { input: content });
      if (r.status !== 0) throw new Error('Fixture marker write failed');
    },
  });
  code = outcome.exitCode;
} catch (err) {
  process.stderr.write(`browser runner failed: ${err.message}\n`);
} finally {
  if (altered) {
    try { reload(); process.stdout.write('API TTL restored from ignored configuration\n'); }
    catch { code = 1; process.stderr.write('API TTL restoration FAILED\n'); }
  }
}
process.stdout.write(`browser runner exit=${code}\n`);
process.exitCode = code;
