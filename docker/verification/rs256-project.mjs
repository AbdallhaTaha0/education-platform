/** Isolated M5 verification wrapper: project `education-platform-rs256`.
 *
 * Setup, build, startup and cleanup (repository root, PowerShell) — no manual
 * session variables needed, the wrapper exports the exact configuration:
 *   node docker/verification/rs256-project.mjs check      # resolve + guard only
 *   node docker/verification/rs256-project.mjs build     # guard, then build images
 *   node docker/verification/rs256-project.mjs up        # guard, then up -d --wait
 *   node docker/verification/rs256-project.mjs down      # guard, then down -v
 *   node docker/verification/rs256-project.mjs --selftest
 *
 * `build` rebuilds server, migrate and client from the current checkout under
 * the distinct :0.5.0-m5-rs256verify tags (never by `up`, so tags cannot drift
 * silently, and development :0.4.0-m4 tags are never overwritten).
 * Environment-file handling: the ignored root `.env` is REQUIRED (Compose
 * fails closed without AUTH_JWT_SECRET) and is passed only as
 * `--env-file .env`. This script verifies `.env` exists and is git-ignored
 * before doing anything, and NEVER reads, prints, or interpolates its values.
 * Only service/project/volume names, image tags, ports and exit codes appear
 * in output. The owner approved http://localhost:8082 for local browser/CORS
 * verification on 2026-09-30; this is not a production origin.
 *
 * Public JWKS path through Nginx: /api/.well-known/jwks.json
 * (Nginx proxies only /api/* to the server with the prefix stripped, so the
 * server route /.well-known/jwks.json is reached as /api/.well-known/jwks.
 * json; the bare root path serves the SPA fallback and is NOT the JWKS.)
 * With no assertion key configured the server correctly answers
 * 404 {"code":"not_found","message":"JWKS is not configured."}.
 *
 * Guarded cleanup: `down` re-resolves the Compose volume mapping and runs
 * `down -v` ONLY when the guard passes (exact disposable volumes, no
 * development overlap). Never run plain `down -v` against this project
 * without the wrapper, and never against development projects.
 *
 * This script creates no credentials, bootstraps no users, touches no DRM
 * service and never prunes volumes.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const DEV_COMPOSE = resolve(root, 'docker', 'compose.dev.yml');
const OVERRIDE = resolve(root, 'docker', 'verification', 'compose.rs256.yml');

const SPEC = {
  project: 'education-platform-rs256',
  pgdata: 'education-platform-rs256_pgdata',
  redisdata: 'education-platform-rs256_redisdata',
  port: '8082',
  origin: 'http://localhost:8082',
  images: {
    server: 'edu-platform-server:0.5.0-m5-rs256verify',
    migrate: 'edu-platform-migrate:0.5.0-m5-rs256verify',
    client: 'edu-platform-client:0.5.0-m5-rs256verify',
  },
};

// Every development volume that must never appear in a disposable project.
const FORBIDDEN_VOLUMES = new Set([
  'docker_pgdata',
  'docker_redisdata',
  'education-platform_pgdata',
  'education-platform_redisdata',
  'education-drm-service_pgdata',
]);

function baseEnv() {
  return {
    ...process.env,
    PGDATA_NAME: SPEC.pgdata,
    REDISDATA_NAME: SPEC.redisdata,
    NGINX_PORT: SPEC.port,
    ALLOWED_ORIGINS: SPEC.origin,
  };
}

function composeArgs(...rest) {
  return [
    'compose',
    '--env-file',
    '.env',
    '-p',
    SPEC.project,
    '-f',
    DEV_COMPOSE,
    '-f',
    OVERRIDE,
    ...rest,
  ];
}

/** Exact build invocation: same project, files and environment as check/up. */
function buildArgs() {
  return composeArgs('build', 'server', 'migrate', 'client');
}

/** Resolve top-level volumes, service mounts, images and project from Compose. */
function resolvedConfig() {
  const out = execFileSync('docker', composeArgs('config', '--format', 'json'), {
    cwd: root,
    env: baseEnv(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const cfg = JSON.parse(out);
  const volumes = {};
  for (const [key, def] of Object.entries(cfg.volumes ?? {})) {
    volumes[key] = { name: def?.name ?? null, external: def?.external === true };
  }
  const mounts = {};
  for (const [svc, def] of Object.entries(cfg.services ?? {})) {
    mounts[svc] = (def?.volumes ?? []).map((m) =>
      typeof m === 'string'
        ? { type: 'short', source: m, target: null }
        : { type: m?.type ?? null, source: m?.source ?? null, target: m?.target ?? null },
    );
  }
  const images = {};
  for (const [svc, def] of Object.entries(cfg.services ?? {})) {
    if (svc in SPEC.images) images[svc] = def?.image ?? null;
  }
  return { volumes, mounts, images, project: cfg.name ?? null };
}

/**
 * Fail-closed guard over top-level volumes AND service mounts. Returns
 * { ok, reasons[] }; reasons name only volumes, keys, services, mount types,
 * images and ports — never configuration values or secrets.
 */
export function evaluateGuard(cfg) {
  const reasons = [];
  const norm = {};
  for (const [key, def] of Object.entries(cfg.volumes ?? {})) {
    norm[key] =
      typeof def === 'string'
        ? { name: def, external: false }
        : { name: def?.name ?? null, external: def?.external === true };
  }
  const names = Object.values(norm).map((v) => v.name);
  if (names.length === 0) reasons.push('no volumes resolved');
  for (const want of [SPEC.pgdata, SPEC.redisdata]) {
    if (!names.includes(want)) reasons.push(`missing expected volume ${want}`);
  }
  if (SPEC.pgdata === SPEC.redisdata) reasons.push('pgdata and redisdata are identical');
  for (const [key, v] of Object.entries(norm)) {
    if (v.external) reasons.push(`external volume bypasses isolation: ${key}`);
    if (FORBIDDEN_VOLUMES.has(v.name)) reasons.push(`development volume overlap: ${v.name}`);
    if (v.name === null || v.name === '') reasons.push(`volume ${key} resolved with no name`);
  }
  // Service mounts must reference exactly the expected disposable volumes.
  // Anything else (bind, tmpfs, undefined key, remapped key) is refused.
  const allowed = new Set([SPEC.pgdata, SPEC.redisdata]);
  for (const [svc, list] of Object.entries(cfg.mounts ?? {})) {
    for (const m of list ?? []) {
      if (m?.type !== 'volume') {
        reasons.push(`service ${svc} has unexpected ${m?.type ?? 'untyped'} mount`);
        continue;
      }
      const resolved = norm[m.source]?.name ?? null;
      if (!(m.source in norm)) reasons.push(`service ${svc} mounts undefined volume ${m.source}`);
      else if (!allowed.has(resolved))
        reasons.push(`service ${svc} mounts unexpected volume ${resolved}`);
    }
  }
  for (const [svc, want] of Object.entries(SPEC.images)) {
    const got = cfg.images?.[svc] ?? null;
    if (got !== want) reasons.push(`service ${svc} image is not the verification tag`);
  }
  if (cfg.project !== undefined && cfg.project !== null && cfg.project !== SPEC.project) {
    reasons.push(`unexpected project name ${cfg.project}`);
  }
  return { ok: reasons.length === 0, reasons };
}

function guardOrThrow() {
  let cfg;
  try {
    cfg = resolvedConfig();
  } catch (err) {
    throw new Error(
      `volume guard: Compose config could not be resolved (${err.message ?? 'unknown error'})`,
    );
  }
  const { ok, reasons } = evaluateGuard(cfg);
  const shown = Object.values(cfg.volumes ?? {})
    .map((v) => (typeof v === 'string' ? v : (v?.name ?? '?')))
    .sort()
    .join(',');
  process.stdout.write(`guard volumes=${shown} project=${cfg.project ?? 'n/a'}\n`);
  if (!ok) throw new Error(`volume guard REFUSED: ${reasons.join('; ')}`);
}

function runDocker(...args) {
  const result = spawnSync('docker', args, { cwd: root, env: baseEnv(), encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0)
    throw new Error(`docker ${args[2] ?? args[0]} exited ${result.status ?? 'unknown'}`);
}

/** Rejection/acceptance checks on synthetic configs. No Docker, no resources. */
function selftest() {
  const good = {
    project: SPEC.project,
    volumes: { pgdata: SPEC.pgdata, redisdata: SPEC.redisdata },
    mounts: {
      postgres: [{ type: 'volume', source: 'pgdata', target: '/var/lib/postgresql/data' }],
      redis: [{ type: 'volume', source: 'redisdata', target: '/data' }],
      server: [],
      migrate: [],
      client: [],
      nginx: [],
    },
    images: { ...SPEC.images },
  };
  const cases = [
    ['accept isolated configuration', good, true],
    [
      'reject development pgdata',
      { ...good, volumes: { ...good.volumes, pgdata: 'docker_pgdata' } },
      false,
    ],
    [
      'reject development redisdata',
      { ...good, volumes: { ...good.volumes, redisdata: 'docker_redisdata' } },
      false,
    ],
    [
      'reject legacy orphan pgdata',
      { ...good, volumes: { ...good.volumes, pgdata: 'education-platform_pgdata' } },
      false,
    ],
    [
      'reject legacy orphan redisdata',
      { ...good, volumes: { ...good.volumes, redisdata: 'education-platform_redisdata' } },
      false,
    ],
    [
      'reject DRM pgdata',
      { ...good, volumes: { ...good.volumes, pgdata: 'education-drm-service_pgdata' } },
      false,
    ],
    ['reject missing redis mapping', { ...good, volumes: { pgdata: SPEC.pgdata } }, false],
    ['reject empty volume set', { ...good, volumes: {} }, false],
    ['reject unnamed volume', { ...good, volumes: { pgdata: SPEC.pgdata, redisdata: '' } }, false],
    [
      'reject wrong server tag',
      { ...good, images: { ...good.images, server: 'edu-platform-server:0.4.0-m4' } },
      false,
    ],
    [
      'reject external volume flag',
      { ...good, volumes: { ...good.volumes, pgdata: { name: SPEC.pgdata, external: true } } },
      false,
    ],
    [
      'reject remapped key to dev volume',
      {
        ...good,
        volumes: { ...good.volumes, pgdata: 'docker_pgdata' },
        mounts: {
          ...good.mounts,
          postgres: [{ type: 'volume', source: 'pgdata', target: '/var/lib/postgresql/data' }],
        },
      },
      false,
    ],
    [
      'reject mount with undefined key',
      {
        ...good,
        mounts: { ...good.mounts, server: [{ type: 'volume', source: 'stray', target: '/data' }] },
      },
      false,
    ],
    [
      'reject bind mount on server',
      {
        ...good,
        mounts: {
          ...good.mounts,
          server: [{ type: 'bind', source: '/srv/data', target: '/data' }],
        },
      },
      false,
    ],
    [
      'reject tmpfs mount on redis',
      {
        ...good,
        mounts: {
          ...good.mounts,
          redis: [...good.mounts.redis, { type: 'tmpfs', source: null, target: '/tmp' }],
        },
      },
      false,
    ],
    [
      'reject short-syntax mount',
      {
        ...good,
        mounts: {
          ...good.mounts,
          server: [{ type: 'short', source: 'pgdata:/data', target: null }],
        },
      },
      false,
    ],
  ];
  let failed = 0;
  const check = (label, got, want) => {
    const pass = got === want;
    if (!pass) failed += 1;
    process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${label}\n`);
  };
  for (const [label, cfg, want] of cases) {
    const { ok } = evaluateGuard(cfg);
    check(
      `${label} (guard=${ok ? 'accept' : 'refuse'}, want=${want ? 'accept' : 'refuse'})`,
      ok,
      want,
    );
  }
  // Build-command configuration: same project, files, services; no caller env.
  const args = buildArgs();
  check('build uses the verification project', args.includes(SPEC.project), true);
  check(
    'build pins both compose files',
    args.includes(DEV_COMPOSE) && args.includes(OVERRIDE),
    true,
  );
  check(
    'build targets server+ migrate+client only',
    JSON.stringify(args.slice(-4)) === JSON.stringify(['build', 'server', 'migrate', 'client']),
    true,
  );
  const saved = {
    PGDATA_NAME: process.env.PGDATA_NAME,
    REDISDATA_NAME: process.env.REDISDATA_NAME,
    NGINX_PORT: process.env.NGINX_PORT,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  };
  process.env.PGDATA_NAME = 'docker_pgdata';
  process.env.REDISDATA_NAME = 'docker_redisdata';
  process.env.NGINX_PORT = '8080';
  process.env.ALLOWED_ORIGINS = 'http://localhost:8080';
  const env = baseEnv();
  check(
    'wrapper env overrides caller session values',
    env.PGDATA_NAME === SPEC.pgdata &&
      env.REDISDATA_NAME === SPEC.redisdata &&
      env.NGINX_PORT === SPEC.port &&
      env.ALLOWED_ORIGINS === SPEC.origin,
    true,
  );
  for (const key of Object.keys(saved)) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  if (failed > 0) throw new Error(`selftest ${failed} case(s) failed`);
  process.stdout.write(`selftest pass\n`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) {
    selftest();
    return;
  }
  // .env must exist and stay ignored; its values are never read here.
  if (!existsSync(resolve(root, '.env')))
    throw new Error('root .env is required (ignored local configuration)');
  execFileSync('git', ['check-ignore', '--quiet', '.env'], { cwd: root, stdio: 'ignore' });
  const cmd = argv[0] ?? 'check';
  guardOrThrow();
  if (cmd === 'check') {
    process.stdout.write(`check ok project=${SPEC.project} port=${SPEC.port}\n`);
  } else if (cmd === 'build') {
    runDocker(...buildArgs());
  } else if (cmd === 'up') {
    runDocker(...composeArgs('up', '-d', '--wait'));
  } else if (cmd === 'down') {
    runDocker(...composeArgs('down', '-v'));
  } else {
    throw new Error(`unknown command ${cmd} (want check|build|up|down)`);
  }
}

try {
  main();
} catch (err) {
  process.stderr.write(`rs256-project: ${err.message ?? 'failed'}\n`);
  process.exit(1);
}
