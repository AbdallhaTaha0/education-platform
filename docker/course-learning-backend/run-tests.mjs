/** Docker-only material verification with fail-closed ownership/mount cleanup. */
import { spawnSync, execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { checkContainerIdentity, checkContainerMounts, checkNetworkMembers, checkNoUnexpectedVolumes, checkVolumeIdentity } from '../playback-recovery-review/guards.mjs';
const root = resolve(import.meta.dirname, '../..'), docker = process.env.DOCKER_EXE || 'docker';
const project = 'fayq-course-learning-backend-final-20261004';
const compose = ['compose', '-p', project, '-f', 'docker/course-learning-backend/compose.test.yml'];
const SERVER = process.argv.includes('--course-revisions') ? 'fayq-ide-modes-server:test' : 'fayq-materials-final-server-test:20261004';
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


const env = ['-e','NODE_ENV=test','-e','DATABASE_URL=postgresql://materials:synthetic_materials_test_only@postgres:5432/course_learning_test','-e','REDIS_URL=redis://redis:6379','-e','AUTH_JWT_SECRET=materials-test-jwt-secret-012345678901234567890','-e','AUTH_ISSUER=materials-test','-e','AUTH_AUDIENCE=materials-browser','-e','ALLOWED_ORIGINS=http://localhost:8080','-e','COOKIE_SECURE=false','-e','ARGON2_MEMORY_KB=8192','-e','ARGON2_TIME_COST=2','-e','ARGON2_PARALLELISM=1','-e','LOG_LEVEL=error','-e','STORAGE_ENDPOINT=http://minio:9000','-e','STORAGE_REGION=us-east-1','-e','STORAGE_ACCESS_KEY_ID=materials-test','-e','STORAGE_SECRET_ACCESS_KEY=synthetic_materials_storage_only','-e','STORAGE_BUCKET=course-learning','-e','STORAGE_REQUEST_TIMEOUT_MS=2000','-e','STORAGE_MAX_RETRIES=1'];
env.push('-e','STUDENT_DATA_ENCRYPTION_KEY_B64=YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=','-e','STUDENT_DATA_INDEX_KEY_B64=YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI=');
const run = args => must(['run','--rm','--label',`com.docker.compose.project=${project}`,'--network',`${project}_default`,...env,SERVER,...args], args.join(' '));
let failure;
try {
  if (process.argv.includes('--cleanup')) { cleanupProject(compose, project); process.exit(0); }
  must([...compose, 'up','-d','--wait'], 'start isolated fixtures');
  if (!process.argv.includes('--course-revisions')) {
  // Upgrade a populated accepted pre-materials schema before testing a fresh DB.
  must([...compose, 'exec','-T','postgres','psql','-U','materials','-d','course_learning_test','-c','CREATE DATABASE materials_upgrade_test'], 'create upgrade fixture');
  const upgradeEnv = ['-e','DATABASE_URL=postgresql://materials:synthetic_materials_test_only@postgres:5432/materials_upgrade_test'];
  const legacy = 'fayq-playback-delivery-server-test:20261004';
  const job = (image, args, mount = []) => must(['run','--rm','--label',`com.docker.compose.project=${project}`,'--network',`${project}_default`,...mount,...upgradeEnv,image,...args], 'populated migration gate');
  job(legacy, ['npx','prisma','migrate','deploy']);
  job(legacy, ['node','/srv/server/migration-seed.cjs'], ['--mount',`type=bind,source=${resolve(root,'docker/course-learning-backend/migration-seed.cjs')},target=/srv/server/migration-seed.cjs,readonly`]);
  const snapshotSql = ['User','Wallet','Course','CourseSection','Lesson','MediaMapping','LessonProgress','Assessment'].map(t => `SELECT '${t}', md5(coalesce(string_agg((to_jsonb(t) - 'durationSeconds')::text, ',' ORDER BY id),'')) FROM "${t}" t`).join(' UNION ALL ');
  // Structured arguments prevent shell interpolation of the SQL.
  const fingerprint = () => { const r = sh([...compose,'exec','-T','postgres','psql','-U','materials','-d','materials_upgrade_test','-At','-c',snapshotSql]); if(r.status !== 0)throw Error('Snapshot failed'); return r.stdout; };
  const before = fingerprint();
  job(SERVER, ['npx','prisma','migrate','deploy']);
  job(SERVER, ['npx','prisma','migrate','deploy']);
  if (before !== fingerprint()) throw Error('Populated migration changed retained fixture data');
  console.log('Populated migration/repeat gate passed; existing string IDs and rows preserved.');
  }
  run(['npx','prisma','migrate','deploy']);
  run(['npx','prisma','migrate','deploy']);
  run(['npm','run','typecheck']);
  run(['npm','run','test:unit']);
  run(['npx','vitest','run','tests/integration/learning-materials.test.ts','tests/integration/learning-playback.test.ts','tests/integration/playback-recovery.test.ts','tests/integration/device-release-recovery-regressions.test.ts']);
} catch (err) { failure = err; console.error(err.message); }
finally { if (!process.argv.includes('--retain')) cleanupProject(compose, project); }
if (failure) process.exit(1);
console.log('ALL MATERIAL CHECKS PASSED');
