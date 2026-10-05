/** Repeatable isolated tests; cleanup on success, failure and normal stop.
 * Build images from the accompanying runbook before invoking this runner.
 * Host Node orchestrates only; application/tests/browser execute in Docker.
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,openSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),docker=process.env.DOCKER_EXE||'docker',project='fayq-ide-modes-test';
if(resolve(process.cwd())!==root)throw Error('Run from repository root');
const prefix=['compose','-p',project,'-f','docker/ide/modes.compose.test.yml'];
const volumes=[`${project}_pg-test`,`${project}_redis-test`],dir=join(root,'docker/browser/evidence/ide-modes');mkdirSync(dir,{recursive:true});
const formatOnly=process.argv.includes('--format-only');
const previewOnly=process.argv.includes('--preview-only');
const syntaxOnly=process.argv.includes('--syntax-only');
const studentOnly=process.argv.includes('--student-only');
const progressOnly=process.argv.includes('--progress-only');
const adminTabsOnly=process.argv.includes('--admin-tabs-only');
const catalogOnly=process.argv.includes('--catalog-only');
const assessmentSaveOnly=process.argv.includes('--assessment-save-only');
const assessmentReturnOnly=process.argv.includes('--assessment-return-only');
const walletBrowserOnly=process.argv.includes('--wallet-browser-only');
const paginationOnly=process.argv.includes('--pagination-only');
const walletOnly=process.argv.includes('--wallet-only')||walletBrowserOnly||paginationOnly;
const editorOnly=process.argv.includes('--editor-only')||formatOnly||previewOnly||syntaxOnly||studentOnly||progressOnly||walletOnly||adminTabsOnly||catalogOnly||assessmentSaveOnly||assessmentReturnOnly;
function capture(args,input){const r=spawnSync(docker,args,{cwd:root,input,encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error('Verification inspection/action failed');return r.stdout;}
function guard(){
 const c=JSON.parse(capture([...prefix,'config','--format','json']));
 if(c.name!==project||Object.keys(c.volumes||{}).length!==2||Object.values(c.volumes).some(v=>v.external||!volumes.includes(v.name)))throw Error('Disposable volumes refused');
 for(const [name,s]of Object.entries(c.services)){
  if(s.ports?.length)throw Error('Published test ports refused');
  for(const m of s.volumes||[]){if(['test','grading'].includes(name)&&m.type==='bind'&&m.source==='/var/run/docker.sock'&&m.target==='/var/run/docker.sock')continue;if(m.type!=='volume'||!volumes.includes(c.volumes[m.source]?.name))throw Error('Test mount refused');}
 }
 if(c.services.test.environment.NODE_ENV!=='test'||c.services.test.environment.DATABASE_URL!=='postgresql://postgres:postgres@postgres:5432/education_platform_test')throw Error('Synthetic database refused');
 const ids=capture(['ps','-aq','--filter',`label=com.docker.compose.project=${project}`]).trim().split(/\s+/).filter(Boolean);
 for(const id of ids){const [r]=JSON.parse(capture(['inspect',id]));if(r.Config.Labels?.['com.docker.compose.project']!==project)throw Error('Container ownership refused');for(const m of r.Mounts){if(['grading','test'].includes(r.Config.Labels['com.docker.compose.service'])&&m.Type==='bind'&&m.Source==='/var/run/docker.sock'&&m.Destination==='/var/run/docker.sock')continue;if(m.Type!=='volume'||!volumes.includes(m.Name))throw Error('Runtime mount refused');}}
 for(const volume of volumes){const owners=capture(['ps','-aq','--filter',`volume=${volume}`]).trim().split(/\s+/).filter(Boolean);for(const id of owners){const [r]=JSON.parse(capture(['inspect',id]));if(r.Config.Labels?.['com.docker.compose.project']!==project)throw Error('Shared volume refused');}}
 const network=spawnSync(docker,['network','inspect',`${project}_default`],{encoding:'utf8'});if(network.status===0){const [n]=JSON.parse(network.stdout);for(const id of Object.keys(n.Containers||{})){const [r]=JSON.parse(capture(['inspect',id]));if(r.Config.Labels?.['com.docker.compose.project']!==project)throw Error('Foreign network member refused');}}
}
function run(label,args){const fd=openSync(join(dir,`${label}.log`),'w',0o600);let r;try{r=spawnSync(docker,args,{cwd:root,stdio:['ignore',fd,fd]});}finally{closeSync(fd);}console.log(`${label} exit=${r.status??1}`);if(r.status!==0)throw Error(`${label} failed; private evidence retained`);}
if(process.argv[2]==='cleanup'){guard();run('cleanup',[...prefix,'down','-v']);}
else{
 guard();if(capture(['ps','-aq','--filter',`label=com.docker.compose.project=${project}`]).trim())throw Error('Existing test project refused; run guarded cleanup first');
 let failed=false;
 try{
  run('migrations',[...prefix,'up','-d','--wait','migrate','redis']);
  if(catalogOnly&&!process.argv.includes('--browser-only'))run('catalog-integration',[...prefix,'run','--rm','--no-deps','identity-test','npx','vitest','run','tests/integration/catalog-']);
  if(paginationOnly&&!process.argv.includes('--browser-only'))run('pagination-integration',[...prefix,'run','--rm','--no-deps','identity-test','npx','vitest','run','tests/integration/list-pagination.test.ts']);
  if(walletOnly&&!walletBrowserOnly&&!process.argv.includes('--browser-only'))run('wallet-integration',[...prefix,'run','--rm','--no-deps','identity-test','npx','vitest','run','tests/integration/wallet-payment-qr.test.ts','tests/integration/wallet-payment-settings.test.ts','tests/integration/wallet-vodafone-settings.test.ts','tests/integration/wallet-recharge.test.ts','tests/integration/wallet-review.test.ts','tests/integration/wallet-integrity.test.ts','tests/integration/wallet-purchase.test.ts','tests/integration/wallet-proof-cleanup.test.ts']);
  if(studentOnly&&!process.argv.includes('--browser-only'))run('student-integration',[...prefix,'run','--rm','--no-deps','identity-test','npx','vitest','run','tests/integration/student-profile.test.ts','tests/integration/identity-auth.test.ts','tests/integration/identity-session.test.ts','tests/integration/identity-security.test.ts','tests/integration/identity-redis.test.ts']);
  if(!editorOnly)run('integration',[...prefix,'run','--rm','--no-deps','test','npx','vitest','run','tests/integration/ide-modes.test.ts','tests/integration/m9-assessments.test.ts','tests/integration/m9-program.test.ts']);
  run('browser-stack',[...prefix,'up','-d','--wait','nginx',...(!editorOnly?['grading']:[])]);
  const fixtures=JSON.parse(capture([...prefix,'exec','-T','server','node','-'],readFileSync(join(root,'docker/ide/modes-fixtures.cjs'))));
  writeFileSync(join(dir,'fixtures.json'),JSON.stringify(fixtures),{mode:0o600});
  if(paginationOnly)capture([...prefix,'exec','-T','server','node','-'],readFileSync(join(root,'docker/ide/pagination-fixtures.cjs')));
  for(const name of assessmentReturnOnly?['assessment-return-flow']:assessmentSaveOnly?['assessment-save-flow']:catalogOnly?['catalog-editor-flow']:paginationOnly?['pagination-flow']:adminTabsOnly?['admin-dashboard-flow']:walletOnly?['wallet-flow']:progressOnly?['progress-flow']:studentOnly?['student-profile-flow']:syntaxOnly?['syntax-theme-flow']:previewOnly?['web-preview-flow']:formatOnly?['python-format-flow']:editorOnly?['editor-keyboard-flow']:['modes-flow','modes-admin-flow'])run(name,['run','--rm','--name',`${project}-${name}`,'--label',`com.docker.compose.project=${project}`,'--network',`${project}_default`,'--mount',`type=bind,source=${join(root,`docker/ide/${name}.mjs`)},target=/srv/browser/${name}.mjs,readonly`,'--mount',`type=bind,source=${dir},target=/evidence`,'fayq-m9-browser:0.9.0','node',`${name}.mjs`]);
 }catch(e){failed=true;console.error(e.message);}
 finally{try{guard();run('cleanup',[...prefix,'down','-v']);}catch(e){failed=true;console.error(e.message);}}
 if(failed)process.exitCode=1;
}
for(const kind of ['container','network','volume']){const list=kind==='container'?['ps','-aq']:[kind,'ls','-q'];if(capture([...list,'--filter',`label=com.docker.compose.project=${project}`]).trim())throw Error(`Owned ${kind} remains`);}
console.log('Disposable containers=0 networks=0 volumes=0; evidence retained');
