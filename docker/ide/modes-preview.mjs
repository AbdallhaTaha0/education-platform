/** Bounded platform-only IDE update of the retained localhost preview.
 * Requires already built serving/migration/controller/Python images.
 * check|upgrade. No DRM action, owner fixtures, volume removal or reset.
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync,openSync,closeSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),docker=process.env.DOCKER_EXE||'docker';
if(resolve(process.cwd())!==root)throw Error('Run from repository root');
const args=['compose','--env-file','.env','--env-file','docker/local-settings.env.local','-p','fayq-local-preview','-f','docker/compose.dev.yml','-f','docker/compose.local.yml'];
function call(argv,encoding='utf8'){const r=spawnSync(docker,argv,{cwd:root,encoding,maxBuffer:256*1024*1024});if(r.status!==0)throw Error('Preview action failed; private diagnostics suppressed');return r.stdout;}
const guard=spawnSync(process.execPath,['docker/ide/preview.mjs','check'],{cwd:root,stdio:'inherit'});if(guard.status!==0)throw Error('Retained preview guard refused');
call(['image','inspect','fayq-python-execution:0.10.0']);
const command=process.argv[2]||'check';if(!['check','upgrade'].includes(command))throw Error('Supported commands: check|upgrade');
if(command==='upgrade'){
 // Re-created Docker installations may lose this required external network.
 // Creating a network does not recreate object storage or its data volume.
 const materials=spawnSync(docker,['network','inspect','fayq-local-materials'],{encoding:'utf8'});
 if(materials.status!==0)call(['network','create','--label','fayq.owner=local-materials','fayq-local-materials']);
 const dir=join(root,'docker/browser/evidence/ide-modes');mkdirSync(dir,{recursive:true});
 if(spawnSync('git',['check-ignore','--quiet','docker/browser/evidence/ide-modes/backup.dump'],{cwd:root}).status!==0)throw Error('Protected evidence must be ignored');
 const config=JSON.parse(call([...args,'config','--format','json']));const old={};
 for(const service of ['server','client','grading']){
  const ids=call([...args,'ps','-aq',service]).trim().split(/\s+/).filter(Boolean);if(ids.length!==1)throw Error('Preview runtime refused');
  const [c]=JSON.parse(call(['inspect',ids[0]]));old[service]={image:c.Image,alias:config.services[service].image,container:ids[0]};
 }
 writeFileSync(join(dir,'rollback-images.json'),JSON.stringify(old,null,2),{mode:0o600});
 const tables=['User','StudentProfile','Wallet','WalletLedgerEntry','RechargeRequest','Purchase','Subscription','SubscriptionPlan','Course','CourseSection','Lesson','MediaMapping','MaterialObject','LessonCaption','LessonResource','Assessment','AssessmentVersion','AssessmentDraft','AssessmentSubmission','AssessmentPass','PreservedLessonUnlock','PracticeQuota','PracticeRun','PythonRun'];
 const sql=q=>call([...args,'exec','-T','postgres','sh','-c','psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1 -c "$1"','sh',q]);
 // Some transferred previews precede the committed materials migrations.
 // Compare every existing column, without treating a new nullable column as
 // a changed owner value or requiring a table that is not installed yet.
 const columns=JSON.parse(sql(`SELECT coalesce(json_agg(x),'[]') FROM (SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN (${tables.map(t=>`'${t}'`).join(',')}) ORDER BY table_name,ordinal_position) x`));
 const present=tables.filter(t=>columns.some(c=>c.table_name===t));
 const fingerprint=present.map(t=>{const fields=columns.filter(c=>c.table_name===t).map(c=>`'${c.column_name}',t."${c.column_name}"`).join(',');return `SELECT '${t}',count(*),md5(coalesce(string_agg(jsonb_build_object(${fields})::text,',' ORDER BY jsonb_build_object(${fields})::text),'')) FROM "${t}" t`;}).join(' UNION ALL ');
 let stopped=false;
 try{
  call([...args,'stop','server','grading']);stopped=true;const before=sql(fingerprint);
  const dump=call([...args,'exec','-T','postgres','sh','-c','pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'],null);
  if(!Buffer.isBuffer(dump)||dump.length<100||dump.subarray(0,5).toString()!=='PGDMP')throw Error('Backup proof failed');
  const backup=join(dir,`before-ide-modes-${Date.now()}.dump`),fd=openSync(backup,'wx',0o600);try{writeFileSync(fd,dump);}finally{closeSync(fd);}
  call([...args,'run','--rm','--no-deps','migrate']);call([...args,'run','--rm','--no-deps','migrate']);
  if(sql(fingerprint)!==before)throw Error('Existing data fingerprints changed; backup retained');
  call([...args,'up','-d','--wait','server','client','grading']);
  call([...args,'up','-d','--wait','--no-deps','--force-recreate','nginx']);
  const ready=await fetch('http://localhost:8080/api/health/ready');if(!ready.ok)throw Error('Preview readiness failed');
  stopped=false;writeFileSync(join(dir,'preview-upgrade.json'),JSON.stringify({time:new Date().toISOString(),existingTablesPreserved:present.length,migrationRepeated:true,ready:true,drmUnchanged:true}),{mode:0o600});
  console.log(`IDE preview ready=true existingTableFingerprintsPreserved=${present.length} migrationRepeated=true DRM unchanged`);
 }catch(error){
  if(stopped){
   const available=Object.values(old).every(s=>spawnSync(docker,['image','inspect',s.image],{stdio:'ignore'}).status===0);
   if(available){for(const s of Object.values(old))call(['tag',s.image,s.alias]);call([...args,'up','-d','--wait','--no-deps','server','client','grading']);call([...args,'up','-d','--no-deps','--force-recreate','nginx']);console.error('Previous serving images restored; additive schema and protected backup retained');}
   else {for(const s of Object.values(old))spawnSync(docker,['start',s.container],{stdio:'ignore'});console.error('Existing containers restarted where available; transferred old image layers are unavailable. Retained database/backup preserved; readiness must be rechecked.');}
  }
  throw error;
 }
}
