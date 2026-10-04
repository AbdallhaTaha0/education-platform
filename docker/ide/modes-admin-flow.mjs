import fs from 'node:fs';
import assert from 'node:assert/strict';
import {lookup} from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const fixture=JSON.parse(fs.readFileSync('/evidence/fixtures.json','utf8'));
const host=(await lookup('nginx')).address;
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',`--host-resolver-rules=MAP localhost ${host}`]});
let checks=0;const errors=[];const pass=(name,ok=true)=>{assert(ok,name);checks++;console.log(`PASS ${name}`);};
try{
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});page.on('pageerror',()=>errors.push(1));
 await page.evaluateOnNewDocument(()=>{if(window.top===window)localStorage.setItem('edu-platform-lang','en');});
 await page.goto('http://localhost:8080/#/login',{waitUntil:'networkidle2'});await page.type('#login-id','modes-admin@example.test');await page.type('#login-password','synthetic modes password only');await page.click('form button[type=submit]');await page.waitForFunction(()=>location.hash==='#/account');
 await page.goto(`http://localhost:8080/#/admin/courses/${fixture.courseId}`);
 const scope=`[data-testid="assessment-admin-${fixture.lessonId}"]`;await page.waitForSelector(scope);
 async function button(text,root=scope){assert(await page.evaluate(({text,root})=>{const b=[...document.querySelector(root).querySelectorAll('button')].find(b=>b.textContent.trim()===text);b?.click();return !!b;},{text,root}),`Missing ${text}`);}
 await button('Assignments and quizzes');await page.waitForSelector(`${scope} [data-testid=ide-mode-python]`);
 pass('admin has all three assessment categories',await page.$$eval(`${scope} [data-testid^=ide-mode-]`,a=>a.length===3));
 for(const mode of ['javascript','web','python']){
  await page.click(`${scope} [data-testid=ide-mode-${mode}]`);
  pass(`${mode} only lists its own quizzes`,await page.$eval(scope,(e,mode)=>mode==='python'?e.textContent.includes('Python square'):!e.textContent.includes('Python square'),mode));
  await button('Add assessment');await page.waitForSelector('[data-testid=assessment-editor] .cm-content');
  pass(`${mode} creates editor in correct mode`,await page.$eval('[data-testid=assessment-editor]',(e,mode)=>e.textContent.includes(mode==='python'?'Python':mode==='web'?'HTML + CSS + JavaScript':'JavaScript'),mode));
  if(mode==='web'){
   pass('web authoring exposes DOM check types',await page.$$eval('[data-testid=assessment-editor] select',s=>s.some(x=>[...x.options].some(o=>o.value==='text'))));
   pass('web authoring supports removable interactions',await page.$eval('[data-testid=assessment-editor]',e=>e.textContent.includes('Add interaction')));
  }
  if(mode==='python')pass('Python authoring uses input print reference solution',await page.$eval('[data-testid=assessment-editor]',e=>e.textContent.includes('input()')&&e.textContent.includes('print(')));
  await button('Cancel','[data-testid=assessment-editor]');await page.waitForFunction(()=>!document.querySelector('[data-testid=assessment-editor]'));
 }
 await page.screenshot({path:'/evidence/admin-python-assessments.png',fullPage:true});
 pass('admin browser has no runtime errors',errors.length===0);console.log(`Admin modes PASS checks=${checks}`);
}finally{await browser.close();}
