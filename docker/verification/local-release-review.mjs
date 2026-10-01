/** Review the existing Railway candidate locally; no deployment/recovery/load qualification. */
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const docker=process.env.DOCKER_EXE || 'docker';
const project='fayq-release-review-20261001';
const env={...process.env, M7_FIXTURE_KEY:Buffer.from(generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey).toString('base64')};
const prefix=['compose','-p',project,'-f','docker/verification/compose.m7-08.yml','-f','docker/compose.local-release-review.yml'];
const evidence=join(root,'docker/browser/evidence/local-refresh-20261001');
mkdirSync(evidence,{recursive:true});
function capture(args) {
  const r=spawnSync(docker,args,{cwd:root,env,encoding:'utf8',maxBuffer:8*1024*1024});
  if(r.status!==0)throw new Error('Release inspection failed; output withheld.');
  return r.stdout.trim();
}
function guard() {
  const c=JSON.parse(capture([...prefix,'config','--format','json']));
  const names=[`${project}_pgdata`,`${project}_redisdata`];
  if(c.name!==project || Object.values(c.volumes).length!==2 || Object.values(c.volumes).some(v=>v.external || !names.includes(v.name)))throw new Error('Release volume guard refused.');
  for(const s of Object.values(c.services)) {
    if(s.ports?.length)throw new Error('Release published port refused.');
    for(const m of s.volumes || [])if(m.type!=='volume' || !names.includes(c.volumes[m.source]?.name))throw new Error('Release mount guard refused.');
  }
  if(c.services.server.environment.NODE_ENV!=='production' || c.services.server.environment.COOKIE_SECURE!=='true' || c.services.server.environment.ALLOWED_ORIGINS!=='https://m7-fixture.example.test')throw new Error('Production fixture guard refused.');
}
function run(label,args) {
  const fd=openSync(join(evidence,`${label}.log`),'w',0o600);
  let r;try{r=spawnSync(docker,args,{cwd:root,env,stdio:['ignore',fd,fd]});}finally{closeSync(fd);}
  console.log(`${label} exit=${r.status ?? 1}`);
  if(r.status!==0)throw new Error(`${label} failed; inspect private evidence.`);
}
let code=0;guard();
try {
  run('release-edge-build',['build','--no-cache','-f','docker/railway/edge.Dockerfile','--build-arg','CLIENT_IMAGE=fayq-platform-client:0.8.0-local','-t','fayq-railway-edge:0.8.0-local-review','.']);
  run('release-start',[...prefix,'up','-d','--wait','--scale','server=2']);
  run('release-edge-check',['run','--rm','--network',`${project}_default`,'--mount',`type=bind,source=${join(root,'docker/verification/m7-08-edge-check.mjs')},target=/tmp/edge-check.mjs,readonly`,'fayq-platform-server:0.8.0-local','node','/tmp/edge-check.mjs']);
  const ids=capture([...prefix,'ps','-q','server']).split(/\s+/).filter(Boolean);
  if(ids.length!==2)throw new Error('Expected two healthy replicas.');
  console.log('release replicas=2 readiness=PASS');
}catch(err){code=1;console.error(err.message);}
finally {
  try {
    guard();
    for(const id of capture([...prefix,'ps','-aq']).split(/\s+/).filter(Boolean))
      if(capture(['inspect','--format','{{index .Config.Labels "com.docker.compose.project"}}',id])!==project)throw new Error('Release ownership guard refused.');
    run('release-cleanup',[...prefix,'down','-v']);
    for(const kind of ['container','network','volume']) {
      const args=kind==='container'?['ps','-aq']:[kind,'ls','-q'];
      if(capture([...args,'--filter',`label=com.docker.compose.project=${project}`]))throw new Error('Release resource remains.');
    }
    console.log('release cleanup: containers=0 networks=0 volumes=0');
  }catch(err){code=1;console.error(err.message);}
}
process.exitCode=code;
