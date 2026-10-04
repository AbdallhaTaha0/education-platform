/** Real integration UI gate; preserves the owner preview and external asset. */
import {spawnSync,execSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {checkContainerIdentity,checkContainerMounts,checkNetworkMembers,checkNoUnexpectedVolumes,checkVolumeIdentity} from '../playback-recovery-review/guards.mjs';
const root=resolve(import.meta.dirname,'../..'),docker=process.env.DOCKER_EXE||'docker';
const project='fayq-course-learning-integrated-20261004';
const compose=['compose','-p',project,'-f','docker/course-learning-backend/compose.test.yml','-f','docker/course-learning-backend/compose.ui.yml'];
const preview=['compose','--env-file','.env','--env-file','docker/local-settings.env.local','-p','fayq-local-preview','-f','docker/compose.dev.yml','-f','docker/compose.local.yml'];
const evidence=resolve(root,'docker/browser/evidence/materials-ui'); mkdirSync(evidence,{recursive:true});
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
      { type: 'bind', source: flowScriptHostPath, target: '/srv/browser/materials-flow.mjs', read_only: true },
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



function privateCapture(args,input){ const r=sh(args,{input,stdio:'pipe'}); if(r.status!==0)throw Error('Private setup/inspection failed'); return r.stdout; }
let failed;
try {
  const config=JSON.parse(privateCapture([...preview,'config','--format','json']));
  writeFileSync(join(evidence,'server.env.local'),Object.entries(config.services.server.environment).filter(([k])=> k.startsWith('DRM_') || k.startsWith('AUTH_') || k === 'OWNER_PREVIEW').map(([k,v])=>`${k}=${v}`).join('\n'),{mode:0o600});
  must([...compose,'up','-d','--wait'],'start real integrated stack');
  const sql=`SELECT row_to_json(m)::text FROM "MediaMapping" m JOIN "Lesson" l ON l.id=m."lessonId" JOIN "CourseSection" s ON s.id=l."sectionId" JOIN "Course" c ON c.id=s."courseId" WHERE c.slug='fayq-learning-demo-20261004' ORDER BY l.position LIMIT 1`;
  const binding=privateCapture([...preview,'exec','-T','postgres','sh','-c','psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"','sh',sql]).trim(); JSON.parse(binding);
  const fixture=privateCapture([...compose,'exec','-T','server','node','-e',"eval(require('fs').readFileSync(0,'utf8'))"],readFileSync(join(root,'docker/course-learning-backend/ui-seed.cjs'),'utf8').replace("require('fs').readFileSync(0,'utf8')",JSON.stringify(binding)));
  writeFileSync(join(evidence,'fixtures.json'),JSON.stringify(JSON.parse(fixture.trim())),{mode:0o600});
  must(['run','--rm','--name',`${project}-browser`,'--label',`com.docker.compose.project=${project}`,'--label','com.docker.compose.service=browser-runner','--network',`${project}_default`,'--mount',`type=bind,source=${resolve(root,'docker/course-learning-backend/materials-flow.mjs')},target=/srv/browser/materials-flow.mjs,readonly`,'--mount',`type=bind,source=${evidence},target=/evidence`,'fayq-m9-browser:0.9.0','node','/srv/browser/materials-flow.mjs'],'real materials browser');
} catch(err) {failed=err;console.error(err.message);}
finally {
  // A browser failure cannot discard durable termination/audit obligations.
  try {
    const fixture=readFileSync(join(evidence,'fixtures.json'),'utf8');
    const cleanup=readFileSync(join(root,'docker/course-learning-backend/ui-cleanup.cjs'),'utf8').replace("require('fs').readFileSync(0,'utf8')",JSON.stringify(fixture));
    privateCapture([...compose,'exec','-T','server','node','-e',"eval(require('fs').readFileSync(0,'utf8'))"],cleanup);
    console.log('External obligations independently confirmed before disposable DB removal.');
  } catch(err) {
    if(failed)throw new Error('Recovery inspection failed; integrated stack preserved for bounded recovery.');
    throw err;
  }
  cleanupProject(compose,project,{flowScriptHostPath:resolve(root,'docker/course-learning-backend/materials-flow.mjs'),evidenceHostPath:evidence});
  for(const file of ['server.env.local','fixtures.json'])rmSync(join(evidence,file),{force:true});
}
if(failed)process.exit(1);
console.log('REAL MATERIALS UI CHECKS PASSED');
