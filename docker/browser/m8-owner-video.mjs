import fs from 'node:fs';
import {lookup} from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const accounts=JSON.parse(fs.readFileSync('/accounts/fixtures.json'));
const course=JSON.parse(fs.readFileSync('/video/course.json'));
const ip=(await lookup('host.docker.internal')).address;
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',`--host-resolver-rules=MAP localhost ${ip}`]});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',()=>errors.push('pageerror'));
 page.on('requestfailed',r=>console.log('REQUEST_FAILED '+r.method()+' '+(r.failure()?.errorText??'unknown'))); page.on('response',r=>{if(r.status()>=400) console.log('HTTP_FAILURE status='+r.status()+' method='+r.request().method())});
 await page.goto('http://localhost:8080/#/login',{waitUntil:'networkidle2'});
 await page.evaluate(()=>{localStorage.setItem('edu-platform-lang','en')});await page.reload({waitUntil:'networkidle2'});
 const role=process.argv[2]==='upload'?'ADMIN':'STUDENT';const u=accounts.users.find(u=>u.role===role);
 await page.type('#login-id',u.email);await page.type('#login-password',u.password);await page.click('form button[type="submit"]');
 await page.waitForFunction(()=>location.hash==='#/account');
 if(role==='ADMIN') {
   await page.goto(`http://localhost:8080/#/admin/courses/${course.courseId}`,{waitUntil:'networkidle2'});
   const uploader=`[data-testid="uploader-${course.lessonId}"]`;
   await page.waitForSelector(uploader);await (await page.$(uploader+' input[type="file"]')).uploadFile('/video/owner-video.mp4');
   await (await page.$(uploader+' button')).click();
   await page.waitForFunction(selector=>/done|failed/.test(document.querySelector(selector)?.textContent??''),{timeout:90000},uploader);
   await page.screenshot({path:'/video/admin-upload-state.png',fullPage:true});
   const status=await page.$eval(uploader,e=>e.textContent);console.log('UPLOAD_STATE '+status);assert(status.includes('done'),'Admin browser upload failed; inspect the labeled UI state/CORS');
   await page.screenshot({path:'/video/admin-upload.png',fullPage:true});console.log('PASS actual admin browser MP4 upload and completion');
 } else {
   await page.goto(`http://localhost:8080/#/learn/${course.slug}`,{waitUntil:'networkidle2'});
   await page.waitForSelector('[data-testid="learning-start-playback"]');await page.click('[data-testid="learning-start-playback"]');
   await page.waitForSelector('video',{timeout:60000});
   await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2,{timeout:60000});
   await page.evaluate(()=>{const v=document.querySelector('video');v.muted=true;return v.play()});
   await page.waitForFunction(()=>document.querySelector('video')?.currentTime>2,{timeout:30000});
   const time=await page.$eval('video',v=>v.currentTime);assert(time>2);
   await page.screenshot({path:'/video/student-playing.png',fullPage:true});console.log('PASS actual protected student video playback, currentTime > 2 seconds');
   await page.goto('http://localhost:8080/#/dashboard',{waitUntil:'networkidle2'});
 }
 assert.equal(errors.length,0);console.log('PASS no browser page errors');
} finally {await browser.close();}
