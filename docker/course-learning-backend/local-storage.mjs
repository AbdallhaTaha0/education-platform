/** Private persistent Docker storage setup only; never seeds lessons or touches DRM.
 * node docker/course-learning-backend/local-storage.mjs up
 * Reuses existing ignored credentials; refuses partial or non-local configuration.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),docker=process.env.DOCKER_EXE||'docker';
if(resolve(process.cwd())!==root||process.argv[2]!=='up')throw Error('Run from repository root with up.');
if(spawnSync('git',['check-ignore','--quiet','.env'],{cwd:root}).status!==0)throw Error('Ignored environment required.');
const run=args=>{const r=spawnSync(docker,args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error('Storage action failed; credentials/diagnostics suppressed.');return r.stdout;};
run(['image','inspect','fayq-materials-minio-fixture:20261004']);
const names={network:'fayq-local-materials',volume:'fayq-local-materials-objects'};
const absent=[];
for(const[kind,name]of Object.entries(names)){
 const inventory=run([kind,'ls','--format','json']).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));
 // Inventories are newline JSON records in Docker; inspect only an exact observed name.
 const exists=(Array.isArray(inventory)?inventory:[inventory]).some(x=>x.Name===name);
 if(exists){const [object]=JSON.parse(run([kind,'inspect',name]));if(object.Labels?.['fayq.owner']!=='local-materials')throw Error('Local storage ownership refused.');}
 else absent.push([kind,name]);
}
let text=readFileSync(resolve(root,'.env'),'utf8');
const env=Object.fromEntries(text.split(/\r?\n/).filter(x=>x.includes('=')&&!x.trim().startsWith('#')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const keys=['STORAGE_ENDPOINT','STORAGE_REGION','STORAGE_ACCESS_KEY_ID','STORAGE_SECRET_ACCESS_KEY','STORAGE_BUCKET'];
const configured=keys.filter(key=>env[key]);
if(configured.length&&configured.length!==keys.length)throw Error('Partial storage settings: restore the existing configuration, do not overwrite it.');
if(configured.length&&env.STORAGE_ENDPOINT!=='http://materials-minio:9000')throw Error('Non-local storage configuration refused.');
if(!configured.length){
 if(!absent.some(([kind])=>kind==='volume'))throw Error('Existing object volume requires credential recovery before setup.');
 const counts=JSON.parse(run(['exec','fayq-local-preview-server-1','node','-e',`const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();Promise.all([db.lessonResource.count(),db.materialObject.count()]).then(rows=>console.log(JSON.stringify(rows))).finally(()=>db.$disconnect());`]).trim());
 if(counts.some(count=>count!==0))throw Error('Existing attachment metadata requires storage recovery; fresh setup refused.');
 const values={STORAGE_ENDPOINT:'http://materials-minio:9000',STORAGE_REGION:'us-east-1',STORAGE_ACCESS_KEY_ID:'local'+randomBytes(10).toString('hex'),STORAGE_SECRET_ACCESS_KEY:randomBytes(32).toString('hex'),STORAGE_BUCKET:'fayq-local-materials'};
 for(const[key,value]of Object.entries(values)){const re=new RegExp(`^${key}=.*$`,'m');text=re.test(text)?text.replace(re,`${key}=${value}`):text+`\n${key}=${value}\n`;}
 writeFileSync(resolve(root,'.env'),text,{mode:0o600});
}
for(const[kind,name]of absent)run([kind,'create','--label','fayq.owner=local-materials',name]);
const args=['compose','--env-file','.env','-p','fayq-local-materials','-f','docker/course-learning-backend/compose.local-storage.yml'];
const config=JSON.parse(run([...args,'config','--format','json']));
const service=config.services['materials-minio'];
if(config.name!=='fayq-local-materials'||Object.keys(config.services).length!==1||service.image!=='fayq-materials-minio-fixture:20261004'||service.ports?.length||service.volumes?.length!==1||service.volumes[0].type!=='volume'||service.volumes[0].target!=='/data'||config.volumes[service.volumes[0].source]?.name!==names.volume||config.volumes[service.volumes[0].source]?.external!==true)throw Error('Private storage compose guard refused.');
run([...args,'up','-d','--wait']);
console.log('Private local materials storage ready; credentials kept in ignored .env; no published ports.');
