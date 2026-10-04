/** Guarded owner-local additive upgrade. Never resets/deletes retained data. */
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,openSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
const root=resolve(import.meta.dirname,'../..');
if(resolve(process.cwd())!==root)throw Error('Run from repository root');
const platform=['compose','--env-file','.env','--env-file','docker/local-settings.env.local','-p','fayq-local-preview','-f','docker/compose.dev.yml','-f','docker/compose.local.yml'];
const storage=['compose','--env-file','.env','-p','fayq-local-materials','-f','docker/course-learning-backend/compose.local-storage.yml'];
function call(args,encoding='utf8',input){const r=spawnSync('docker',args,{cwd:root,encoding,input,maxBuffer:256*1024*1024});if(r.status!==0)throw Error('Local action failed; private diagnostics suppressed');return r.stdout;}
function guard(){const r=spawnSync(process.execPath,['docker/ide/preview.mjs','check'],{cwd:root,stdio:'inherit'});if(r.status!==0)throw Error('Retained preview guard refused');}
guard();
if(process.argv[2]!=='upgrade')throw Error('Explicit upgrade argument required');
const dir=join(root,'docker/browser/evidence/materials-preview');mkdirSync(dir,{recursive:true});
if(spawnSync('git',['check-ignore','--quiet','docker/browser/evidence/materials-preview/backup.dump'],{cwd:root}).status!==0)throw Error('Private evidence must be ignored');
let env=readFileSync(join(root,'.env'),'utf8');
const configured=/^STORAGE_ACCESS_KEY_ID=\S+/m.test(env);
if(configured)throw Error('Existing storage settings require inspection before replacement');
const values={STORAGE_ENDPOINT:'http://materials-minio:9000',STORAGE_REGION:'us-east-1',STORAGE_ACCESS_KEY_ID:'local'+randomBytes(10).toString('hex'),STORAGE_SECRET_ACCESS_KEY:randomBytes(32).toString('hex'),STORAGE_BUCKET:'fayq-local-materials',STORAGE_REQUEST_TIMEOUT_MS:'5000',STORAGE_MAX_RETRIES:'2'};
for(const [key,value]of Object.entries(values)){const re=new RegExp(`^${key}=.*$`,'m');env=re.test(env)?env.replace(re,`${key}=${value}`):env+`\n${key}=${value}\n`;}
writeFileSync(join(root,'.env'),env,{mode:0o600});
for(const [kind,name]of [['network','fayq-local-materials'],['volume','fayq-local-materials-objects']]){
 const probe=spawnSync('docker',[kind,'inspect',name],{encoding:'utf8'});
 if(probe.status===0){const [obj]=JSON.parse(probe.stdout);if(obj.Labels?.['fayq.owner']!=='local-materials')throw Error('Existing materials storage ownership refused');}
 else call([kind,'create','--label','fayq.owner=local-materials',name]);
}
call([...storage,'up','-d','--wait']);
const cfg=JSON.parse(call([...platform,'config','--format','json']));
const backups={};
for(const [service,tag]of [['server','fayq-materials-final-server:20261004'],['migrate','fayq-materials-final-migrate:20261004'],['client','fayq-materials-final-client:20261004'],['nginx','fayq-materials-final-nginx:20261004']]){
 const alias=cfg.services[service].image;const id=call(['image','inspect','--format','{{.Id}}',alias]).trim();backups[service]={alias,id};call(['image','inspect',tag]);call(['tag',tag,alias]);
}
writeFileSync(join(dir,'rollback-images.json'),JSON.stringify(backups,null,2),{mode:0o600});
call([...platform,'stop','server','grading']);
function sql(query){return call([...platform,'exec','-T','postgres','sh','-c','psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1 -c "$1"','sh',query]);}
const tables=['User','Wallet','Purchase','Subscription','SubscriptionPlan','Course','CourseSection','Lesson','MediaMapping','LessonProgress','Assessment','AssessmentSubmission','AssessmentPass','PreservedLessonUnlock'];
const fingerprint=tables.map(t=>`SELECT '${t}',count(*),md5(coalesce(string_agg(${t==='MediaMapping'?"(to_jsonb(t)-'durationSeconds')::text":"to_jsonb(t)::text"},',' ORDER BY to_jsonb(t)::text),'')) FROM "${t}" t`).join(' UNION ALL ');
const before=sql(fingerprint);
const dump=call([...platform,'exec','-T','postgres','sh','-c','pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'],null);
if(dump.length<100||dump.subarray(0,5).toString()!=='PGDMP')throw Error('Database backup proof failed');
const backup=join(dir,`before-materials-${Date.now()}.dump`),fd=openSync(backup,'wx',0o600);try{writeFileSync(fd,dump);}finally{closeSync(fd);}
console.log('Protected retained database backup created');
call([...platform,'run','--rm','--no-deps','migrate']);
call([...platform,'run','--rm','--no-deps','migrate']);
if(sql(fingerprint)!==before)throw Error('Existing data changed during additive migration; protected backup retained');
console.log('Fourteen retained-data fingerprints preserved; repeated migration passed');
call([...platform,'up','-d','--wait','server','client','grading']);
call([...platform,'up','-d','--wait','--no-deps','--force-recreate','nginx']);
const seed=readFileSync(join(root,'docker/course-learning-backend/preview-seed.cjs'),'utf8');
console.log(call([...platform,'exec','-T','server','node','-'], 'utf8',seed).trim());
guard();
const response=await fetch('http://localhost:8080/api/health/ready');if(!response.ok)throw Error('Preview not ready');
writeFileSync(join(dir,'upgrade.json'),JSON.stringify({time:new Date().toISOString(),dataPreserved:true,backup:backup.split(/[\\/]/).pop(),privateStorage:'fayq-local-materials-objects',ready:true}),{mode:0o600});
console.log('Local materials preview ready; retained data and external DRM preserved');
