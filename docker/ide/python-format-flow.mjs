import assert from 'node:assert/strict';
import {lookup} from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const fixture=JSON.parse(fs.readFileSync('/evidence/fixtures.json','utf8'));
const host=(await lookup('nginx')).address;
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',`--host-resolver-rules=MAP localhost ${host}`]});
let checks=0,executionRequests=0;const errors=[],remote=[];
const pass=(name,ok=true)=>{assert(ok,name);checks++;console.log(`PASS ${name}`);};
async function login(email){const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width:1440,height:1000});
 page.on('pageerror',()=>errors.push(1));page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='http:'||u.protocol==='https:'){if(u.origin!=='http://localhost:8080')remote.push(1);if(/\/python\/run$|\/practice\/run$|\/submit$/.test(u.pathname))executionRequests++;}});
 await page.evaluateOnNewDocument(()=>{if(window.top===window)localStorage.setItem('edu-platform-lang','en');});await page.goto('http://localhost:8080/#/login',{waitUntil:'networkidle2'});await page.type('#login-id',email);await page.type('#login-password','synthetic modes password only');await page.click('form button[type=submit]');await page.waitForFunction(()=>location.hash==='#/account');return page;}
async function edit(page,scope,code){await page.click(`${scope} .cm-content`);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.sendCharacter(code);}
const read=(page,scope)=>page.$$eval(`${scope} .cm-line`,a=>a.map(e=>e.textContent).join('\n'));
async function format(page,scope){await page.$eval(`${scope} [data-testid=ide-format]`,b=>b.scrollIntoView({block:'center'}));await page.click(`${scope} [data-testid=ide-format]`);await page.waitForFunction(scope=>document.querySelector(`${scope} [data-testid=ide-format]`).disabled,{},scope);await page.waitForFunction(scope=>!document.querySelector(`${scope} [data-testid=ide-format]`).disabled,{timeout:15000},scope);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
try{
 const page=await login('modes-student@example.test');await page.goto('http://localhost:8080/#/practice');await page.waitForSelector('[data-testid=ide-mode-python]');await page.click('[data-testid=ide-mode-python]');const scope='[role=tabpanel]:not([hidden])';await page.waitForSelector(`${scope} .cm-content`);
 pass('Python Format code button available',!!await page.$(`${scope} [data-testid=ide-format]`));
 await edit(page,scope,'def square( n ):\n return n*n\nprint( square(3) )');await format(page,scope);
 const output=await read(page,scope);pass('real WASM formatter organizes Python spacing and four-space indentation',output.includes('def square(n):')&&output.includes('    return n * n')&&output.includes('print(square(3))'));
 await format(page,scope);pass('formatting is idempotent',(await read(page,scope))===output);
 await edit(page,scope,'message = "مرحبا"\nprint( message )');await format(page,scope);pass('Unicode strings preserved',(await read(page,scope)).includes('"مرحبا"'));
 const invalid='def broken(';await edit(page,scope,invalid);await format(page,scope);pass('syntax failure preserves original source',(await read(page,scope))===invalid);
 pass('safe formatting error displayed',await page.$$eval('[role=alert]',a=>a.some(e=>e.textContent.includes('Could not format'))));
 await edit(page,scope,'raise RuntimeError( "never execute" )');await format(page,scope);pass('formatter does not execute submitted Python',await page.$eval(`${scope} [data-testid=ide-console] pre`,e=>e.textContent===''));
 await page.screenshot({path:'/evidence/python-format.png',fullPage:true});
 pass('formatting does not charge allowance',await page.evaluate(async()=>{const r=await fetch('/api/assessments/practice',{credentials:'include'});return(await r.json()).data.quota.used===0;}));
 for(const [mode,file,source,expected]of [['javascript',null,'const x=2','const x = 2;'],['web','HTML','<div>\n<p>Hi</p>\n</div>','  <p>Hi</p>'],['web','CSS','p{color:red}','  color: red;']]){
  await page.click(`[data-testid=ide-mode-${mode}]`);
  if(file){await page.evaluate(({scope,file})=>[...document.querySelector(scope).querySelectorAll('[role=tab]')].find(b=>b.textContent===file).click(),{scope,file});await page.waitForSelector(`${scope} [aria-label="${file.toLowerCase()} editor"]`);}
  await edit(page,scope,source);await format(page,scope);pass(`existing ${file??mode} Prettier formatting preserved`,(await read(page,scope)).includes(expected));
 }
 const admin=await login('modes-admin@example.test');await admin.goto(`http://localhost:8080/#/admin/courses/${fixture.courseId}`);const panel=`[data-testid="assessment-admin-${fixture.lessonId}"]`;await admin.waitForSelector(panel);
 await admin.$eval(panel,e=>[...e.querySelectorAll('button')].find(b=>b.textContent==='Assignments and quizzes').click());await admin.waitForSelector(`${panel} [data-testid=ide-mode-python]`);await admin.click(`${panel} [data-testid=ide-mode-python]`);
 await admin.$eval(panel,e=>[...e.querySelectorAll('button')].find(b=>b.textContent==='Add assessment').click());const ref='[data-admin-required-code]';await admin.waitForSelector(`${ref} .cm-content`);
 await edit(admin,ref,'n=int(input())\nprint( n**2 )');await format(admin,ref);pass('admin private reference editor supports Python formatting',(await read(admin,ref)).includes('n = int(input())'));
 pass('no Run or submission request made',executionRequests===0);pass('formatter uses no external host',remote.length===0);pass('no browser runtime errors',errors.length===0);
 console.log(`Python formatter checks=${checks} failed=0`);
}finally{await browser.close();}
