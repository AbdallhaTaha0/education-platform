/** Local configuration only. Docker generates keys; host orchestration stores
 * them in ignored .env without printing them. Never silently rotate saved keys.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
if(resolve(process.cwd())!==root)throw Error('Run from repository root');
const path=join(root,'.env');
if(spawnSync('git',['check-ignore','--quiet','.env'],{cwd:root}).status!==0)throw Error('Ignored .env required');
const text=readFileSync(path,'utf8');
if(/^\s*NODE_ENV\s*=\s*['"]?production\b/m.test(text))throw Error('Local configuration only');
const names=['STUDENT_DATA_ENCRYPTION_KEY_B64','STUDENT_DATA_INDEX_KEY_B64'];
const existing=names.map(name=>{const lines=text.split(/\r?\n/).filter(line=>line.startsWith(name+'='));if(lines.length>1)throw Error('Duplicate student-data key setting');return lines[0]?.slice(name.length+1).replace(/^['"]|['"]$/g,'')||'';});
if(existing.some(Boolean)&&!existing.every(Boolean))throw Error('Incomplete saved key pair; refused to replace any key');
if(existing.every(Boolean)){
 if(existing.some(v=>!/^[A-Za-z0-9+/]{43}=$/.test(v))||existing[0]===existing[1])throw Error('Invalid saved key pair; refused to replace');
 console.log('studentDataKeys configured=true created=false');
}else{
 const docker=process.env.DOCKER_EXE||'docker';
 const result=spawnSync(docker,['run','--rm','--network','none','fayq-ide-modes-server:test','node','--input-type=module','-e','import {randomBytes} from "node:crypto";process.stdout.write(JSON.stringify([randomBytes(32).toString("base64"),randomBytes(32).toString("base64")]));'],{encoding:'utf8'});
 if(result.status!==0)throw Error('Docker key generation failed');
 const keys=JSON.parse(result.stdout);if(!Array.isArray(keys)||keys.length!==2||keys.some(v=>typeof v!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(v)))throw Error('Generated key shape refused');
 let next=text;for(const [i,name]of names.entries()){const line=`${name}=${keys[i]}`;next=next.replace(new RegExp(`^${name}=.*(?:\r?\n|$)`,'gm'),'');next=next.replace(/\s*$/,'')+'\n'+line+'\n';}
 writeFileSync(path,next,{mode:0o600});chmodSync(path,0o600);console.log('studentDataKeys configured=true created=true valuesNotPrinted=true');
}
