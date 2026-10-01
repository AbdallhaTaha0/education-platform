// Intended for an operator-owned uptime runner, not a public application API.
const origin=process.env.PLATFORM_ORIGIN;
if(!origin) throw new Error('PLATFORM_ORIGIN is required');
const url=new URL(origin);
if(url.protocol!=='https:' && !(process.env.LOCAL_REHEARSAL==='1' && url.origin==='http://edge:8080')) throw new Error('An HTTPS production origin is required');
let unhealthy=false;
for(const path of ['/edge-health','/api/health/live','/api/health/ready']) {
  const started=performance.now();
  try {
    const response=await fetch(new URL(path,url),{signal:AbortSignal.timeout(5000),redirect:'error'});
    const ok=response.status===200; unhealthy ||= !ok;
    console.log(JSON.stringify({check:path,ok,status:response.status,durationMs:Math.round(performance.now()-started)}));
  } catch {
    unhealthy=true; console.log(JSON.stringify({check:path,ok:false,category:'NETWORK_OR_TIMEOUT'}));
  }
}
process.exitCode=unhealthy ? 1 : 0;
