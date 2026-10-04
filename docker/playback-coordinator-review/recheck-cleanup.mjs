import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const project='fayq-playback-coordinator-recheck-20261004';
const task='playback-coordinator-recheck-20261004';
const ui='fayq-playback-coordinator-recheck-ui-20261004';
const root=resolve(import.meta.dirname,'../..');
function run(args){const r=spawnSync('docker',args,{encoding:'utf8',cwd:root});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const inspect=name=>JSON.parse(run(['inspect',name]))[0];
const norm=s=>s.replaceAll('\\','/').toLowerCase();
const uiIds=run(['ps','-aq','--filter',`name=^/${ui}$`]);
if(uiIds){
const front=inspect(ui);
assert.equal(front.Config.Labels['fayq.task'],task);
assert.equal(front.Config.Image,'fayq-playback-coordinator-recheck-client:20261004');
assert.equal(front.HostConfig.NetworkMode,'none');
assert.equal(front.Mounts.length,2);
const expectedBinds={'/srv/client/index.html':resolve(import.meta.dirname,'index.html'),'/srv/client/review-entry.tsx':resolve(import.meta.dirname,'recheck-entry.tsx')};
for(const m of front.Mounts){assert.equal(m.Type,'bind');assert.equal(m.RW,false);assert.ok(expectedBinds[m.Destination]);assert.equal(norm(m.Source),norm(expectedBinds[m.Destination]));}
}
const owned=run(['ps','-aq','--filter',`label=com.docker.compose.project=${project}`]).split(/\s+/).filter(Boolean);
assert.equal(owned.length,2);
const entries=owned.map(inspect);
for(const e of entries){assert.equal(e.Config.Labels['com.docker.compose.project'],project);assert.equal(norm(e.Config.Labels['com.docker.compose.project.config_files']),norm(resolve(import.meta.dirname,'recheck.compose.yml')));assert.deepEqual(e.HostConfig.PortBindings,{});}
const pg=entries.find(e=>e.Config.Labels['com.docker.compose.service']==='postgres');
const redis=entries.find(e=>e.Config.Labels['com.docker.compose.service']==='redis');
assert.ok(pg&&redis);assert.equal(pg.Config.Image,'postgres:16-alpine');assert.equal(redis.Config.Image,'redis:7-alpine');
assert.equal(pg.Mounts.length,0);assert.deepEqual(Object.keys(pg.HostConfig.Tmpfs),['/var/lib/postgresql/data']);
assert.equal(redis.Mounts.length,1);assert.equal(redis.Mounts[0].Type,'volume');assert.equal(redis.Mounts[0].Destination,'/data');
const volume=redis.Mounts[0].Name;assert.match(volume,/^[a-f0-9]{64}$/);
const allIds=run(['ps','-aq']).split(/\s+/).filter(Boolean);
for(const id of allIds){const e=inspect(id);if(!owned.includes(e.Id.slice(0,12))&&!entries.some(o=>o.Id===e.Id))assert.ok(!e.Mounts.some(m=>m.Name===volume),'Unexpected container shares review volume');}
const networks=run(['network','ls','-q','--filter',`label=com.docker.compose.project=${project}`]).split(/\s+/).filter(Boolean);
assert.equal(networks.length,1);
const net=JSON.parse(run(['network','inspect',networks[0]]))[0];
assert.equal(net.Name,`${project}_default`);assert.equal(net.Labels['com.docker.compose.project'],project);
assert.ok(Object.keys(net.Containers).every(id=>entries.some(e=>e.Id===id)));
console.log('Guard passed: exact labels, configuration, images, mounts, volume consumers and network members.');
if(uiIds)run(['rm','-f',ui]);
run(['compose','-p',project,'-f','docker/playback-coordinator-review/recheck.compose.yml','down','-v']);
assert.equal(run(['ps','-aq','--filter',`label=com.docker.compose.project=${project}`]),'');
assert.equal(run(['ps','-aq','--filter',`label=fayq.task=${task}`]),'');
assert.equal(run(['network','ls','-q','--filter',`label=com.docker.compose.project=${project}`]),'');
assert.equal(run(['volume','ls','-q','--filter',`label=com.docker.compose.project=${project}`]),'');
assert.equal(run(['volume','ls','-q','--filter',`name=${volume}`]),'');
console.log('Cleanup verified: containers=0 networks=0 volumes=0; anonymous Redis volume also absent. Images and evidence retained.');
