import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const sources=['/repo/.env','/repo/docker/local-settings.env.local','/repo/education-drm-service/.env'];
const local=[];
for(const file of sources){
  if(!fs.existsSync(file))continue;
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const match=/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if(match){const value=match[2].replace(/^(['"])(.*)\1$/,'$2');if(value.length>=8)local.push({file,name:match[1],value});}
  }
}
const reports=[];
for(const [name,repo] of [['platform','/repo'],['drm','/repo/education-drm-service']]){
  const report='/tmp/'+name+'-private.json';
  const result=spawnSync('gitleaks',['git',repo,'--log-opts=--all','--no-banner','--ignore-gitleaks-allow',
    '--log-level=error','--report-format=json','--report-path='+report],{encoding:'utf8',maxBuffer:1024*1024});
  if(![0,1].includes(result.status))throw new Error('Private scan failed for '+name+'; raw output withheld');
  const candidates=fs.existsSync(report)?JSON.parse(fs.readFileSync(report,'utf8')):[];
  const safe=candidates.map(item=>{
    const matched=local.filter(entry=>entry.value===item.Secret);
    const explicitFixture=/synthetic|fixture|test[-_ ]|change[_-]?me|example|dummy|placeholder/i.test(item.Secret);
    return {file:item.File,commit:item.Commit,line:item.StartLine,rule:item.RuleID,
      explicitFixtureValue:explicitFixture,localMatches:matched.map(({file,name})=>({file,name}))};
  });
  reports.push({repository:name,candidateCount:safe.length,localMatchCount:safe.filter(x=>x.localMatches.length).length,candidates:safe});
  fs.rmSync(report,{force:true});
}
console.log(JSON.stringify({redacted:true,credentialValuesPrinted:false,localFilesCompared:sources.filter(fs.existsSync),reports},null,2));
