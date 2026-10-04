/** No interception or mocks: real authoring/storage/DRM/browser integration. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
const f=JSON.parse(fs.readFileSync('/evidence/fixtures.json','utf8'));
// Transport only, with no response interception/doubles or disabled security.
// The isolated Nginx receives localhost:8080 traffic; existing DRM receives
// localhost:3000 traffic. Never forward a request to the owner's platform.
const proxy=http.createServer((req,res)=>{
 let url; try{url=new URL(req.url);}catch{res.writeHead(400).end();return;}
 if(url.hostname!=='localhost'||!['8080','3000'].includes(url.port)){res.writeHead(502).end();return;}
 const upstream=http.request({hostname:url.port==='8080'?'nginx':'host.docker.internal',port:url.port==='8080'?8080:3000,path:url.pathname+url.search,method:req.method,headers:{...req.headers,host:url.host}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
 upstream.on('error',()=>res.writeHead(502).end());req.pipe(upstream);
});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',`--proxy-server=http://127.0.0.1:${proxy.address().port}`,'--proxy-bypass-list=<-loopback>']});
const BASE='http://localhost:8080'; let checks=0; const errors=[]; let admin,student;
const pass=(name,value=true)=>{assert(value,name);checks++;console.log('PASS '+name);};
async function page(email,lang){const context=await browser.createBrowserContext();const p=await context.newPage();await p.setViewport({width:1360,height:900});p.on('pageerror',e=>errors.push(e.message));await p.evaluateOnNewDocument(l=>{localStorage.setItem('edu-platform-lang',l);},lang);await p.goto(BASE+'/#/login');await p.waitForSelector('#login-id');await p.type('#login-id',email);await p.type('#login-password',f.password);await p.click('form button[type="submit"]');await p.waitForFunction(()=>location.hash==='#/account');return p;}
async function api(p,path,method='GET',body){return p.evaluate(async(path,method,body)=>{const token=decodeURIComponent(document.cookie.match(/(?:^|;\s*)edu_csrf=([^;]+)/)?.[1]??'');const r=await fetch('/api'+path,{method,credentials:'include',headers:method==='GET'?{}:{'x-csrf-token':token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};},path,method,body);}
async function cleanup(){
 if(student){
  const sessions=await api(student,'/learning/sessions');
  if(sessions.status===200)for(const row of sessions.body.data.sessions??[])if(row.status==='ACTIVE'||row.pendingEndReason){const end=await api(student,`/learning/playback/${row.referenceId}/end`,'POST',{});assert(end.status===200,'Owned session closure API');}
  const verify=await api(student,'/learning/sessions');
  assert(verify.status===200,'Owned session inspection');
  assert((verify.body.data.sessions??[]).every(r=>r.status!=='ACTIVE' && !r.pendingEndReason),'No owned active/pending session before removing disposable DB');
 }
 if(admin){const list=await api(admin,`/admin/learning/students/${f.studentId}/devices`);assert(list.status===200,'Owned device inspection');const inspection=list.body.data.devices;assert(!inspection.truncated,'Complete owned device inspection');for(const d of inspection.devices??[])if(d.releasable){const result=await api(admin,`/admin/learning/students/${f.studentId}/devices/${d.reference}/release`,'POST',{});assert(result.status===200,'Owned registration release');}}
 console.log('Owned external test session and registration cleanup confirmed.');
}
try{
 admin=await page('materials-admin@example.test','en');student=await page('materials-student@example.test','ar');
 const synced=await api(admin,`/admin/catalog/lessons/${f.lessonId}/media/sync`,'POST',{});pass('actual external duration sync',synced.status===200);
 await admin.goto(BASE+`/#/admin/courses/${f.courseId}`);
 await admin.waitForSelector(`[data-testid="admin-materials-${f.lessonId}"]`,{timeout:30000});
 await admin.waitForSelector(`[data-testid="admin-caption-ar-${f.lessonId}"]`,{visible:true});
 pass('ADMIN panels load through the real contract');
 fs.writeFileSync('/evidence/ar.vtt','WEBVTT\r\n\r\n00:00:00.000 --> 00:00:15.000\r\nترجمة تجريبية للفيديو\r\n');
 fs.writeFileSync('/evidence/en.vtt','WEBVTT\n\n00:00:00.000 --> 00:00:15.000\nDemo captions for the test video\n');
 fs.writeFileSync('/evidence/lesson.txt','Protected Arabic resource: مرحبا');
 await (await admin.$(`[data-testid="admin-caption-ar-${f.lessonId}"]`)).uploadFile('/evidence/ar.vtt');
 await (await admin.$(`[data-testid="admin-caption-en-${f.lessonId}"]`)).uploadFile('/evidence/en.vtt');
 await admin.click(`[data-testid="admin-caption-upload-${f.lessonId}"]`);
 await admin.waitForFunction(()=>document.querySelectorAll('[data-testid="admin-caption-row"]').length===2);pass('real bilingual multipart authoring');
 await admin.type(`[data-testid="admin-resource-label-ar-${f.lessonId}"]`,'ملف الدرس');await admin.type(`[data-testid="admin-resource-label-en-${f.lessonId}"]`,'Lesson notes');
 await (await admin.$(`[data-testid="admin-resource-file-${f.lessonId}"]`)).uploadFile('/evidence/lesson.txt');await admin.click(`[data-testid="admin-resource-upload-${f.lessonId}"]`);
 await admin.waitForFunction(()=>document.querySelectorAll('[data-testid="admin-resource-row"]').length===1);pass('real protected resource authoring');
 await student.goto(BASE+`/#/learn/${f.slug}`);await student.waitForSelector('[data-testid="resource-row"]');pass('student real resource list');
 const outline=await api(student,`/learning/courses/${f.slug}/outline`);const lesson=outline.body.data.sections[0].lessons[0];pass('outline duration matches existing processed video',lesson.durationSeconds===20);
 await student.waitForSelector('[data-testid="course-plan"]');const buttons=await student.$$('[data-testid="course-plan"] button');
 let clicked=false;for(const b of buttons){const text=await b.evaluate(e=>e.textContent);if(text.includes('فيديو الاختبار')||text.includes('Test video')){await b.click();clicked=true;break;}}pass('starts selected real lesson',clicked);
 await student.waitForSelector('video',{timeout:30000});
 await student.waitForFunction(()=>document.querySelector('video')?.readyState>=2,{timeout:45000});
 const toggle=await student.$('[data-testid="player-toggle-playback"]');if(toggle)await toggle.click();
 await student.waitForFunction(()=>{const v=document.querySelector('video');return v?.currentTime>1&&!v.error;},{timeout:45000});
 pass('encrypted real playback advances');
 await student.click('[data-testid="player-toggle-playback"]');
 await student.waitForFunction(()=>document.querySelector('video')?.paused===true);
 pass('real video pauses before caption inspection');
 await student.select('[data-testid="caption-choice"]','ar');
 await student.waitForFunction(()=>{const t=document.querySelector('video track');return t?.src.startsWith('blob:')&&t.track.cues?.length>0;});
 const ar=await student.evaluate(()=>{const t=document.querySelector('video track');return {language:t.srclang,mode:t.track.mode,cues:Array.from(t.track.cues??[]).map(c=>c.text)};});pass('real Arabic CRLF cue bytes load and display',ar.language==='ar'&&ar.mode==='showing'&&ar.cues[0].includes('ترجمة'));
 await student.click('[data-testid="player-fullscreen"]');await student.waitForFunction(()=>!!document.fullscreenElement);pass('captions and controls remain in native fullscreen',await student.evaluate(()=>document.fullscreenElement.contains(document.querySelector('video track'))&&!!document.fullscreenElement.querySelector('[data-testid="caption-choice"]')));
 await student.keyboard.press('Escape');
 // Headless Chrome may not perform its native-window Escape action. Exercise
 // the actual exit API in that case; do not claim this proves native OS Escape.
 await student.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
 await student.waitForFunction(()=>!document.fullscreenElement);
 await student.select('[data-testid="caption-choice"]','en');await student.waitForFunction(()=>document.querySelector('video track')?.srclang==='en'&&document.querySelector('video track')?.track.cues?.length>0);pass('real English cue bytes load');
 await student.select('[data-testid="caption-choice"]','off');await student.waitForFunction(()=>!document.querySelector('video track'));pass('Off removes the caption track');
 pass('caption state changes preserve exactly one assessments section',await student.evaluate(()=>Array.from(document.querySelectorAll('h2')).filter(e=>e.textContent.includes('الواجبات والاختبارات')||e.textContent.includes('Assignments and quizzes')).length===1));
 const resource=(await api(student,`/learning/lessons/${f.lessonId}/materials`)).body.data.resources[0];
 const text=await student.evaluate(async id=>{const r=await fetch(`/api/learning/resources/${id}/download`,{credentials:'include'});return {status:r.status,text:await r.text()};},resource.id);pass('real protected bytes downloaded',text.status===200&&text.text==='Protected Arabic resource: مرحبا');
 const response=student.waitForResponse(r=>r.url().endsWith(`/resources/${resource.id}/download`));
 await student.click(`[data-testid="resource-download-${resource.id}"]`);pass('resource UI receives real protected bytes',(await response).status()===200);
 await student.setViewport({width:390,height:844});await student.screenshot({path:'/evidence/student-ar-mobile.png',fullPage:true});pass('Arabic mobile layout has no horizontal overflow',await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await admin.screenshot({path:'/evidence/admin-en-materials.png',fullPage:true});
 await student.goto(BASE+'/#/account');await student.waitForFunction(()=>!document.querySelector('video'));pass('navigation removes protected player/captions');
 pass('no uncaught browser errors',errors.length===0);
 console.log(`REAL_MATERIALS_BROWSER_CHECKS=${checks}`);
}catch(error){
 if(student) {
  console.log('Safe video diagnostic',await student.evaluate(()=>{const v=document.querySelector('video');return {readyState:v?.readyState,time:v?.currentTime,paused:v?.paused,duration:v?.duration,error:v?.error?.code,alerts:Array.from(document.querySelectorAll('[role="alert"]')).map(e=>e.textContent?.slice(0,200))};}));
  await student.screenshot({path:'/evidence/browser-failure.png',fullPage:true});
 }
 throw error;
}finally{try{await cleanup();}finally{await browser.close();await new Promise(r=>proxy.close(r));}}
