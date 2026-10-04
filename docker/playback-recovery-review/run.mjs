#!/usr/bin/env node
/** Disposable playback-recovery verification (task-owned only).
 * Unique names: fayq-playback-recovery-* ; ports 8092/5434/6381 (not 8080).
 * Verifies labels/mounts before every removal; removes only owned resources.
 * Preserves retained preview, DRM/data, other workers, reusable images. No prune.
 */
import { spawnSync, execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  checkContainerIdentity,
  checkContainerMounts,
  checkNetworkMembers,
  checkNoUnexpectedVolumes,
  checkVolumeIdentity,
} from './guards.mjs';

const root = resolve(import.meta.dirname, '../..');
const docker = process.env.DOCKER_EXE || 'docker';
const project = process.env.PLAYBACK_RECOVERY_TEST_PROJECT || 'fayq-playback-recovery-20261004';
const uiProject = process.env.PLAYBACK_RECOVERY_UI_PROJECT || 'fayq-playback-recovery-ui-20261004';
const composeTest = ['compose', '-p', project, '-f', 'docker/playback-recovery-review/compose.test.yml'];
const composeUi = ['compose', '-p', uiProject, '-f', 'docker/playback-recovery-review/compose.ui.yml'];
const evidence = resolve(root, process.env.PLAYBACK_RECOVERY_EVIDENCE || 'docker/browser/evidence/playback-recovery');
if (!evidence.startsWith(join(root, 'docker/browser/evidence') + '\\') && !evidence.startsWith(join(root, 'docker/browser/evidence') + '/')) throw new Error('Evidence must stay inside the ignored browser evidence directory');
mkdirSync(evidence, { recursive: true });

const SERVER_TEST = process.env.PLAYBACK_RECOVERY_SERVER_TEST || 'fayq-playback-recovery-server-test:20261004';
const CLIENT_TEST = process.env.PLAYBACK_RECOVERY_CLIENT_TEST || 'fayq-playback-recovery-client-test:20261004';
const SERVER_IMG = process.env.PLAYBACK_RECOVERY_SERVER_IMAGE || 'fayq-playback-recovery-server:20261004';
const CLIENT_IMG = process.env.PLAYBACK_RECOVERY_UI_IMAGE || 'fayq-playback-recovery-client:20261004';
const MIGRATE_IMG = process.env.PLAYBACK_RECOVERY_MIGRATE_IMAGE || 'fayq-playback-recovery-migrate:20261004';

function sh(args, opts = {}) {
  const r = spawnSync(docker, args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...opts });
  return r;
}

function must(args, label) {
  console.log(`[run] ${label}: docker ${args.join(' ')}`);
  const r = sh(args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${label} failed with exit ${r.status}`);
}

function capture(args) {
  const out = execSync(`${docker} ${args.join(' ')}`, { cwd: root, encoding: 'utf8' });
  return out.trim();
}

function guardPorts() {
  // Never overwrite 8080, 8091 (course-learning-ui), or 8084 (M9 harness).
  for (const port of ['8080', '8091', '8084']) {
    try {
      const out = execSync(`netstat -ano | findstr LISTENING | findstr :${port}`, { encoding: 'utf8' });
      if (out.includes(`:${port}`) && port === '8080') console.log('[guard] localhost:8080 retained preview is running (preserved).');
    } catch { /* no listener is fine except 8080 which should exist */ }
  }
  for (const port of ['8092', '5434', '6381']) {
    try {
      const out = execSync(`netstat -ano | findstr LISTENING | findstr :${port}`, { encoding: 'utf8' });
      if (out.trim()) throw new Error(`Port ${port} is already in use; choose another loopback port.`);
    } catch (e) {
      if (e.message?.startsWith('Port ')) throw e;
    }
  }
}

function ownedCounts(proj) {
  const c = sh(['ps', '-aq', '--filter', `label=com.docker.compose.project=${proj}`], { stdio: 'pipe' });
  const n = sh(['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${proj}`], { stdio: 'pipe' });
  const v = sh(['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${proj}`], { stdio: 'pipe' });
  const count = (r) => {
    if (r.status !== 0) throw new Error(`owned-resource listing failed: ${(r.stderr || '').slice(0, 300)}`);
    return (r.stdout || '').trim().split(/\s+/).filter(Boolean).length;
  };
  return { containers: count(c), networks: count(n), volumes: count(v) };
}

/**
 * Fail-closed ownership guard (owner cleanup rule), driven by the exact
 * `docker compose config` of each disposable project. Before ANY removal,
 * every owned container's image/labels plus every resolved mount
 * (source/destination/type/mode/count per service) is compared against the
 * compose configuration; every volume identity and every network's member
 * list is inspected. Any mismatch or command failure throws and aborts
 * removal for that project. A printed message alone is never an inspection.
 * Pure comparisons live in guards.mjs (unit-tested, incl. negatives).
 */
function composeConfig(composeArgs) {
  const out = capture([...composeArgs, 'config', '--format', 'json']);
  return JSON.parse(out);
}

function expectedServiceMounts(proj, service) {
  return (service?.volumes ?? []).map((v) => ({
    // Compose prepends the project name to named volumes; inspect reports
    // the full name. Binds keep their absolute host source.
    type: v.type,
    source: v.type === 'volume' ? `${proj}_${v.source}` : v.source,
    target: v.target,
    read_only: v.read_only ?? false,
  }));
}

function inspectContainer(id) {
  const parsed = JSON.parse(capture(['inspect', id]));
  const entry = parsed[0];
  if (!entry) throw new Error(`inspect returned nothing for container ${id}`);
  return entry;
}

function listIds(args) {
  return capture(args).split(/\s+/).filter(Boolean);
}

function inspectOwnedProject(proj, config) {
  const services = config?.services ?? {};
  const ids = listIds(['ps', '-aq', '--filter', `label=com.docker.compose.project=${proj}`]);
  const mountedVolumeNames = [];
  for (const id of ids) {
    const entry = inspectContainer(id);
    const labels = entry?.Config?.Labels ?? {};
    const service = labels['com.docker.compose.service'];
    if (labels['com.docker.compose.project'] !== proj || typeof service !== 'string') {
      throw new Error(`ownership refused: container ${id} is not a labeled ${proj} service`);
    }
    // Browser runners are removed explicitly beforehand; any survivor here
    // is not a compose service and fails closed below.
    const configured = services[service];
    if (!configured) throw new Error(`service ${service} on ${id} is not in the ${proj} compose configuration`);
    checkContainerIdentity(id, labels, String(entry?.Config?.Image ?? ''), {
      project: proj,
      service,
      image: configured.image,
    });
    checkContainerMounts(service, entry?.Mounts ?? [], expectedServiceMounts(proj, configured));
    for (const m of entry?.Mounts ?? []) {
      if (m.Type === 'volume') mountedVolumeNames.push(m.Name);
    }
  }
  const expectedNetworks = new Set(
    Object.entries(services).flatMap(([name, svc]) => {
      const nets = svc?.networks ?? {};
      return Object.keys(nets).map((n) => (n === 'default' ? `${proj}_default` : n));
    }),
  );
  const networks = listIds(['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${proj}`]);
  for (const net of networks) {
    const parsed = JSON.parse(capture(['network', 'inspect', net]));
    const info = parsed[0];
    if (!info) throw new Error(`network inspect returned nothing for ${net}`);
    if (!expectedNetworks.has(info.Name)) {
      throw new Error(`network ${info.Name} is outside the ${proj} compose configuration`);
    }
    checkNetworkMembers(info.Name, info, ids, proj);
  }
  const expectedVolumes = new Set(
    Object.entries(services).flatMap(([name, svc]) =>
      (svc?.volumes ?? []).filter((v) => v.type === 'volume').map((v) => `${proj}_${v.source}`),
    ),
  );
  const volumes = [...new Set([
    ...listIds(['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${proj}`]),
    ...mountedVolumeNames,
  ])];
  for (const name of volumes) {
    if (!expectedVolumes.has(name)) {
      throw new Error(`ownership refused: volume ${name} is outside the ${proj} compose configuration`);
    }
    const inspected = JSON.parse(capture(['volume', 'inspect', name]));
    checkVolumeIdentity(name, inspected[0], proj);
  }
  // Anonymous or foreign volumes attached to owned containers are refused
  // here even when they carry no project label.
  checkNoUnexpectedVolumes(mountedVolumeNames, [...expectedVolumes]);
  console.log(`[guard] ${proj}: inspected ${ids.length} containers, ${networks.length} networks, ${volumes.length} volumes — ownership, mounts, identities and members match the disposable configuration`);
  return { containerIds: ids, mountedVolumeNames, labeledVolumes: volumes };
}

/**
 * The browser probe container carries this project's label but is started
 * with `docker run --rm` (not a compose service), so `compose down` cannot
 * remove it. Its exact image plus every bind (source/destination/mode/count)
 * is verified before a scoped `rm -f`. Anything else with this label fails
 * closed via the main inspection.
 */
function removeBrowserRunners(proj, flowScriptHostPath, evidenceHostPath) {
  const ids = listIds(['ps', '-aq', '--filter', `label=com.docker.compose.project=${proj}`]);
  for (const id of ids) {
    const entry = inspectContainer(id);
    const image = String(entry?.Config?.Image ?? entry?.Image ?? '');
    if (image !== 'fayq-m9-browser:0.9.0') continue;
    checkContainerIdentity(id, entry?.Config?.Labels ?? {}, image, {
      project: proj,
      service: 'browser-runner',
      image: 'fayq-m9-browser:0.9.0',
    });
    checkContainerMounts('browser-runner', entry?.Mounts ?? [], [
      { type: 'bind', source: flowScriptHostPath, target: '/srv/browser/playback-recovery-flow.mjs', read_only: true },
      { type: 'bind', source: evidenceHostPath, target: '/evidence', read_only: false },
    ]);
    must(['rm', '-f', id], `cleanup-browser-runner-${id.slice(0, 12)}`);
  }
}

function assertVolumeGone(name) {
  // A failed inspect can mean a daemon/permission error, not absence. Require
  // a successful inventory before treating a resource as removed.
  const names = listIds(['volume', 'ls', '--format', '{{.Name}}']);
  if (names.includes(name)) throw new Error(`volume ${name} still exists after removal`);
}

function cleanupProject(composeArgs, proj, { flowScriptHostPath, evidenceHostPath } = {}) {
  const config = composeConfig(composeArgs);
  if (flowScriptHostPath && evidenceHostPath) removeBrowserRunners(proj, flowScriptHostPath, evidenceHostPath);
  const before = inspectOwnedProject(proj, config);
  must([...composeArgs, 'down', '-v'], `cleanup-${proj}`);
  const after = ownedCounts(proj);
  console.log(`[cleanup] ${proj}: containers=${after.containers} networks=${after.networks} volumes=${after.volumes} (inspected before and after removal)`);
  if (after.containers !== 0 || after.networks !== 0 || after.volumes !== 0) {
    throw new Error(`owned ${proj} resources remain after removal`);
  }
  // Anonymous volumes carry no project label, so prove each volume an owned
  // container mounted is actually gone instead of trusting the label filter.
  for (const name of new Set([...before.mountedVolumeNames, ...before.labeledVolumes])) {
    assertVolumeGone(name);
  }
  console.log(`[cleanup] ${proj}: all ${before.mountedVolumeNames.length} mounted volumes verified absent`);
}

let code = 0;
try {
  guardPorts();
  console.log('[run] Building unique test images (fayq-playback-recovery-*)');
  must(['build', '-f', 'server/Dockerfile', '--target', 'test', '-t', SERVER_TEST, '.'], 'build-server-test');
  must(['build', '-f', 'client/Dockerfile', '--target', 'test', '-t', CLIENT_TEST, '.'], 'build-client-test');
  must(['build', '-f', 'server/Dockerfile', '--target', 'runtime', '-t', SERVER_IMG, '.'], 'build-server');
  must(['build', '-f', 'client/Dockerfile', '--target', 'runtime', '-t', CLIENT_IMG, '.'], 'build-client');
  must(['build', '-f', 'server/Dockerfile', '--target', 'migrate', '-t', MIGRATE_IMG, '.'], 'build-migrate');

  console.log('[run] Starting disposable PG/Redis (5434/6381)');
  must([...composeTest, 'up', '-d', '--wait'], 'infra-up');

  const testEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://playback_test:playback_test_pw_0123456789@127.0.0.1:5434/playback_recovery_test?schema=public',
    REDIS_URL: 'redis://127.0.0.1:6381',
    DRM_BASE_URL: 'http://127.0.0.1:1',
    DRM_CLIENT_ID: 'fixture-client',
    DRM_CLIENT_SECRET: 'fixture-secret-that-is-long-enough-0123456789',
    DRM_ASSERTION_ISSUER: 'https://platform.test.internal',
    DRM_ASSERTION_AUDIENCE: 'edu-drm-fixture',
    DRM_ASSERTION_ALGORITHM: 'HS256',
    DRM_ASSERTION_SIGNING_KEY: 'm5-assertion-secret-that-is-long-enough-0123456789',
    DRM_ASSERTION_MAX_LIFETIME_SEC: '120',
    AUTH_JWT_SECRET: 'playback-recovery-test-secret-012345678901234567890',
    AUTH_ISSUER: 'playback-recovery',
    AUTH_AUDIENCE: 'playback-recovery-browser',
    ALLOWED_ORIGINS: 'http://localhost:8092',
    COOKIE_SECURE: 'false',
    ARGON2_MEMORY_KB: '8192',
    ARGON2_TIME_COST: '2',
    ARGON2_PARALLELISM: '1',
    LOG_LEVEL: 'warn',
  };

  console.log('[run] prisma migrate deploy (disposable DB, via Docker migrate image)');
  must(['run', '--rm', '--label', `com.docker.compose.project=${project}`, '--network', `${project}_default`,
    '-e', `DATABASE_URL=postgresql://playback_test:playback_test_pw_0123456789@postgres:5432/playback_recovery_test`,
    MIGRATE_IMG, 'npx', 'prisma', 'migrate', 'deploy'], 'migrate-deploy');

  console.log('[run] server typecheck (Docker)');
  must(['run', '--rm', '--label', `com.docker.compose.project=${project}`, SERVER_TEST, 'npm', 'run', 'typecheck'], 'server-typecheck');
  console.log('[run] client typecheck (Docker)');
  must(['run', '--rm', '--label', `com.docker.compose.project=${project}`, CLIENT_TEST, 'npm', 'run', 'typecheck'], 'client-typecheck');

  console.log('[run] server unit (Docker, focused + full)');
  must(['run', '--rm', '--label', `com.docker.compose.project=${project}`, '-e', 'NODE_ENV=test', SERVER_TEST, 'npm', 'run', 'test:unit'], 'server-unit');

  console.log('[run] client unit (Docker)');
  must(['run', '--rm', '--label', `com.docker.compose.project=${project}`, CLIENT_TEST, 'npm', 'test', '--', '--run'], 'client-unit');

  console.log('[run] cleanup guard unit tests in Docker (pure logic, incl. negatives)');
  must(['run', '--rm', '--label', `com.docker.compose.project=${project}`, '--network', 'none',
    '--mount', `type=bind,source=${resolve(root, 'docker/playback-recovery-review')},target=/srv/guards,readonly`,
    CLIENT_TEST, 'node', '--test', '/srv/guards/guards.test.mjs'], 'guard-unit-tests');

  // Fixture provides DRM config via test overrides; env must NOT set partial
  // DRM (loadConfig would demand RS256). Only platform auth/DB/Redis here.
  const dockerTestEnv = [
    '-e', 'NODE_ENV=test',
    '-e', 'DATABASE_URL=postgresql://playback_test:playback_test_pw_0123456789@postgres:5432/playback_recovery_test?schema=public',
    '-e', 'REDIS_URL=redis://redis:6379',
    '-e', 'AUTH_JWT_SECRET=playback-recovery-test-secret-012345678901234567890',
    '-e', 'AUTH_ISSUER=playback-recovery',
    '-e', 'AUTH_AUDIENCE=playback-recovery-browser',
    '-e', 'ALLOWED_ORIGINS=http://localhost:8080',
    '-e', 'COOKIE_SECURE=false',
    '-e', 'ARGON2_MEMORY_KB=8192',
    '-e', 'ARGON2_TIME_COST=2',
    '-e', 'ARGON2_PARALLELISM=1',
    '-e', 'LOG_LEVEL=warn',
  ];
  console.log('[run] focused integration: playback-recovery (Docker PG/Redis + labeled fixture)');
  must(['run', '--rm', '--label', `com.docker.compose.project=${project}`, '--network', `${project}_default`,
    ...dockerTestEnv, SERVER_TEST, 'npx', 'vitest', 'run', 'tests/integration/playback-recovery.test.ts'], 'integration-playback-recovery');

  must(['run', '--rm', '--label', `com.docker.compose.project=${project}`, '--network', `${project}_default`,
    ...dockerTestEnv, SERVER_TEST, 'npx', 'vitest', 'run', 'tests/integration/device-release-recovery-regressions.test.ts'], 'integration-real-audit-failures');

  console.log('[run] existing learning-playback regression (no new failures)');
  must(['run', '--rm', '--label', `com.docker.compose.project=${project}`, '--network', `${project}_default`,
    ...dockerTestEnv, SERVER_TEST, 'npx', 'vitest', 'run', 'tests/integration/learning-playback.test.ts'], 'integration-learning-playback');

  console.log('[run] UI stack on 127.0.0.1:8092 (disposable)');
  const uiEnv = { ...process.env, PLAYBACK_RECOVERY_UI_IMAGE: CLIENT_IMG };
  {
    const r = spawnSync(docker, [...composeUi, 'up', '-d', '--wait'], { cwd: root, stdio: 'inherit', env: uiEnv });
    if (r.status !== 0) throw new Error('ui-up failed');
  }
  // Synthetic fixtures in the disposable UI database only (never owner data).
  {
    const fs = await import('node:fs');
    const fixtureSrc = fs.readFileSync(join(root, 'docker/ide/ui-fixtures.cjs'), 'utf8');
    const r = spawnSync(docker, [...composeUi, 'exec', '-T', 'server', 'node', '-e', "eval(require('fs').readFileSync(0,'utf8'))"], { cwd: root, input: fixtureSrc, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`ui-fixture failed: ${(r.stderr || '').slice(0, 500)}`);
    fs.writeFileSync(join(evidence, 'playback-recovery-fixtures.json'), String(r.stdout || '').trim(), { mode: 0o600 });
    console.log('[run] UI fixtures created (disposable DB only)');
  }
  // Browser flow uses the disposable stack only; mocks are harness-only.
  // Mount under /srv/browser so puppeteer-core resolves from the image's node_modules.
  must(['run', '--rm', '--label', `com.docker.compose.project=${uiProject}`, '--label', 'com.docker.compose.service=browser-runner', '--network', `${uiProject}_default`,
    '-e', `PLAYBACK_RECOVERY_MATERIALS_UI=${process.env.PLAYBACK_RECOVERY_MATERIALS_UI || 'true'}`,
    '-v', `${resolve(root, 'docker/playback-recovery-review/playback-recovery-flow.mjs')}:/srv/browser/playback-recovery-flow.mjs:ro`,
    '-v', `${evidence}:/evidence`,
    'fayq-m9-browser:0.9.0', 'node', '/srv/browser/playback-recovery-flow.mjs'], 'browser-flow');

  console.log('[run] ALL CHECKS PASSED');
} catch (e) {
  code = 1;
  console.error(`[run] FAILED: ${e.message}`);
} finally {
  try {
    cleanupProject(composeTest, project);
    cleanupProject(composeUi, uiProject, {
      flowScriptHostPath: resolve(root, 'docker/playback-recovery-review/playback-recovery-flow.mjs'),
      evidenceHostPath: evidence,
    });
    // Task-owned fixture (synthetic ids only): remove exactly this file.
    const fixturePath = join(evidence, 'playback-recovery-fixtures.json');
    rmSync(fixturePath, { force: true });
    console.log('[cleanup] task-owned fixture file removed; screenshots retained as ignored evidence');
    console.log('[cleanup] Retained preview/DRM/data/images preserved; no global prune.');
  } catch (e) {
    console.error(`[cleanup] FAILED: ${e.message}`);
    code = 1;
  }
  process.exit(code);
}
