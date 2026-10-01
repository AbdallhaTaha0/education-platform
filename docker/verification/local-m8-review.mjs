/** Fresh isolated platform review. Images built from compose.local-review.yml.
 * Runs typechecks/full suites once and always removes only its owned resources.
 * Evidence remains ignored under docker/browser/evidence/local-refresh-20261001.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const docker = process.env.DOCKER_EXE || 'docker';
const project = 'fayq-m8-review-20261001';
const prefix = ['compose','-p',project,'-f','docker/compose.test.yml','-f','docker/compose.local-review.yml'];
const evidence = join(root,'docker/browser/evidence/local-refresh-20261001');
mkdirSync(evidence,{recursive:true});
const capture = args => {
  const r = spawnSync(docker,args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
  if (r.status !== 0) throw new Error('Docker ownership/configuration inspection failed.');
  return r.stdout;
};
function guard() {
  const c = JSON.parse(capture([...prefix,'config','--format','json']));
  const allowed = [`${project}_pgdata-test`,`${project}_redis-review`];
  if (c.name !== project || Object.values(c.volumes || {}).length !== 2 ||
    Object.values(c.volumes).some(v => v.external || !allowed.includes(v.name))) throw new Error('Disposable volume guard refused.');
  for (const s of Object.values(c.services)) {
    if (s.ports?.length) throw new Error('Unexpected test port.');
    for (const m of s.volumes || [])
      if (m.type !== 'volume' || !allowed.includes(c.volumes[m.source]?.name)) throw new Error('Disposable mount guard refused.');
  }
  if (!c.services.test.environment.DATABASE_URL.endsWith('/education_platform_test') ||
    c.services.test.environment.NODE_ENV !== 'test') throw new Error('Test database/environment guard refused.');
}
function run(label, args) {
  const fd = openSync(join(evidence,`${label}.log`),'w',0o600);
  let r;
  try { r = spawnSync(docker,[...prefix,...args],{cwd:root,stdio:['ignore',fd,fd]}); }
  finally { closeSync(fd); }
  console.log(`${label} exit=${r.status ?? 1}`);
  if (r.status !== 0) throw new Error(`${label} failed; inspect saved evidence.`);
}
let code = 0;
guard();
try {
  run('review-start',['up','-d','--wait','postgres','redis']);
  run('review-migrate',['run','--rm','--no-deps','migrate']);
  run('review-server-typecheck',['run','--rm','--no-deps','test','npm','run','typecheck']);
  run('review-server-tests',['run','--rm','--no-deps','test','npm','run','test:ci']);
  run('review-client-typecheck',['run','--rm','--no-deps','client-test','npm','run','typecheck']);
  run('review-client-tests',['run','--rm','--no-deps','client-test','npm','test']);
} catch (err) {
  code = 1; console.error(err.message);
} finally {
  try {
    guard();
    const ids = capture([...prefix,'ps','-aq']).trim().split(/\s+/).filter(Boolean);
    for (const id of ids) {
      if (capture(['inspect','--format','{{index .Config.Labels "com.docker.compose.project"}}',id]).trim() !== project)
        throw new Error('Cleanup ownership guard refused.');
    }
    run('review-cleanup',['down','-v']);
    for (const kind of ['container','network','volume']) {
      const list = kind === 'container' ? ['ps','-aq'] : [kind,'ls','-q'];
      if (capture([...list,'--filter',`label=com.docker.compose.project=${project}`]).trim()) throw new Error(`Owned ${kind} remains.`);
    }
    console.log('review cleanup: containers=0 networks=0 volumes=0');
  } catch (err) { code = 1; console.error(err.message); }
}
process.exitCode = code;
