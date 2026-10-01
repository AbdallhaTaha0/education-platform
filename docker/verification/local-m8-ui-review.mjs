/** Isolated existing M8 UI harness, fresh serving images, owned cleanup always. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync, rmSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const docker = process.env.DOCKER_EXE || 'docker';
const browserImage = process.env.LOCAL_UI_BROWSER_IMAGE || 'fayq-review-browser:0.8.0-local';
const project = 'fayq-m8-ui-review-20261001';
const prefix = ['compose','-p',project,'-f','docker/verification/compose.m6-delivery-browser.yml','-f','docker/compose.local-ui-review.yml'];
const evidence = join(root,'docker/browser/evidence/local-refresh-20261001/ui');
mkdirSync(evidence,{recursive:true});
function capture(args) {
  const r = spawnSync(docker,args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
  if (r.status !== 0) throw new Error('Docker inspection failed.');
  return r.stdout.trim();
}
function guard() {
  const c = JSON.parse(capture([...prefix,'config','--format','json']));
  const names = [`${project}_pgdata`,`${project}_redis-review`];
  if (c.name !== project || Object.values(c.volumes).length !== 2 || Object.values(c.volumes).some(v=>v.external || !names.includes(v.name))) throw new Error('UI volume guard refused.');
  for (const [name,s] of Object.entries(c.services)) {
    if (s.ports?.length) throw new Error('UI published port refused.');
    for (const m of s.volumes || []) {
      if (m.type === 'volume' && names.includes(c.volumes[m.source]?.name)) continue;
      if (name === 'nginx' && m.type === 'bind' && m.source === resolve(root,'docker/verification/nginx.m6-test.conf') && m.read_only) continue;
      throw new Error('UI mount guard refused.');
    }
  }
  if (c.services.server.environment.NODE_ENV !== 'test') throw new Error('UI test environment refused.');
}
function run(label,args) {
  const fd = openSync(join(evidence,`${label}.log`),'w',0o600);
  let r;
  try { r = spawnSync(docker,args,{cwd:root,stdio:['ignore',fd,fd]}); } finally {closeSync(fd);}
  console.log(`${label} exit=${r.status ?? 1}`);
  if (r.status !== 0) throw new Error(`${label} failed; inspect saved evidence.`);
}
let code = 0;
guard();
try {
  run('ui-start',[...prefix,'up','-d','--wait']);
  const server = capture([...prefix,'ps','-q','server']);
  run('ui-fixture-copy',['cp','docker/verification/m8-final-ui-fixtures.cjs',`${server}:/tmp/m8-fixtures.cjs`]);
  run('ui-fixture-seed',['exec',server,'node','/tmp/m8-fixtures.cjs','seed']);
  run('ui-receipt-copy',['cp',`${server}:/tmp/m8-final-fixtures.json`,join(evidence,'fixtures.json')]);
  run('ui-browser',['run','--rm','--network',`${project}_default`,'--shm-size','512m',
    '--mount',`type=bind,source=${evidence},target=/evidence`,
    '--mount',`type=bind,source=${join(root,'docker/browser/m8-final-ui.mjs')},target=/srv/browser/m8-final-ui.mjs,readonly`,
    browserImage,'node','/srv/browser/m8-final-ui.mjs']);
  const proof = JSON.parse(readFileSync(join(evidence,'browser-results.json'),'utf8'));
  if (proof.errors.length || proof.results.some(r=>!r.passed) || proof.results.length !== 81) throw new Error('UI evidence failed.');
  console.log(`ui checks=${proof.results.length} failed=0 browserErrors=0`);
} catch(err) { code = 1; console.error(err.message); }
finally {
  try {
    guard();
    const server = capture([...prefix,'ps','-q','server']);
    if (server) {
      // Explicit fixture cleanup is checked; teardown still runs on its failure.
      try {run('ui-fixture-cleanup',['exec',server,'node','/tmp/m8-fixtures.cjs','cleanup']);}
      catch(err) {code=1;console.error(err.message);}
    }
    for (const id of capture([...prefix,'ps','-aq']).split(/\s+/).filter(Boolean))
      if (capture(['inspect','--format','{{index .Config.Labels "com.docker.compose.project"}}',id]) !== project) throw new Error('UI ownership guard refused.');
    run('ui-cleanup',[...prefix,'down','-v']);
    for (const kind of ['container','network','volume']) {
      const args = kind === 'container' ? ['ps','-aq'] : [kind,'ls','-q'];
      if(capture([...args,'--filter',`label=com.docker.compose.project=${project}`])) throw new Error('UI resource remains.');
    }
    console.log('ui cleanup: containers=0 networks=0 volumes=0');
  } catch(err) {code=1;console.error(err.message);}
  rmSync(join(evidence,'fixtures.json'),{force:true});
}
process.exitCode=code;
