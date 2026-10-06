import fs from 'node:fs';
import assert from 'node:assert/strict';
import {lookup} from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const fixture=JSON.parse(fs.readFileSync('/evidence/fixtures.json','utf8'));
const host=(await lookup('nginx')).address;
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',`--host-resolver-rules=MAP localhost ${host}`]});
let checks=0;const errors=[];const pass=(name,ok=true)=>{assert(ok,name);checks++;console.log('PASS '+name);};
const editor='[data-testid=assessment-editor]',question=editor+' [data-admin-question="1"]';
let page;
try{
 page=await browser.newPage();await page.setViewport({width:1440,height:1000});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.evaluateOnNewDocument(()=>{if(window===window.top)localStorage.setItem('edu-platform-lang','en');});
 await page.goto('http://localhost:8080/#/login',{waitUntil:'networkidle2'});
 await page.type('#login-id','modes-admin@example.test');await page.type('#login-password','synthetic modes password only');await page.click('form button[type=submit]');await page.waitForFunction(()=>location.hash==='#/account');
 await page.goto(`http://localhost:8080/#/admin/courses/${fixture.courseId}`,{waitUntil:'networkidle2'});
 await page.waitForSelector('#course-workspace-tab-assessments');await page.click('#course-workspace-tab-assessments');
 const scope=`[data-testid=assessment-admin-${fixture.lessonId}]`;
 async function button(text,root=editor){await page.evaluate(({root,text})=>{const b=[...document.querySelector(root).querySelectorAll('button')].find(b=>b.textContent.trim()===text||b.querySelector('span')?.textContent.trim()===text);if(!b)throw Error('Missing button '+text);b.setAttribute('data-author-click','yes');b.scrollIntoView({block:'center'});},{root,text});await page.click('[data-author-click=yes]');await page.evaluate(()=>document.querySelectorAll('[data-author-click]').forEach(e=>e.removeAttribute('data-author-click')));}
 async function fill(selector,text){await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.focus(selector);await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type(text);}
 async function choose(selector,value){const index=await page.$eval(selector,(e,value)=>[...e.options].findIndex(o=>o.value===value),value);assert(index>=0);await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.focus(selector);await page.keyboard.press('Home');for(let i=0;i<index;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');await page.waitForFunction((s,v)=>document.querySelector(s)?.value===v,{},selector,value);pass('native selection persists: '+value);}
 async function basics(title){await fill(editor+' > .grid input[dir=rtl]',title+' عربي');await fill(editor+' > .grid input[dir=ltr]',title);await fill(editor+' > .grid textarea[dir=rtl]','تعليمات الاختبار');await fill(editor+' > .grid textarea[dir=ltr]','Exercise instructions');await page.$eval(editor+' [data-testid=assessment-required-false]',e=>e.click());await fill(question+' input[dir=rtl]','السؤال');await fill(question+' input[dir=ltr]','Question');}
 let failureTested=false;
 async function save(mode,type){if(!failureTested){failureTested=true;await page.setRequestInterception(true);const failSave=request=>{if(request.url().endsWith(`/api/admin/assessments/lessons/${fixture.lessonId}`)&&request.method()==='POST')void request.respond({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'INTERNAL_ERROR'}})});else void request.continue();};page.on('request',failSave);await button('Save draft');await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('Request failed. Keep your work and retry.'),{},editor);pass('save failure is visible inside editor and preserves entered work',await page.$eval(editor+' > .grid input[dir=ltr]',e=>e.value.length>0));page.off('request',failSave);await page.setRequestInterception(false);}const response=page.waitForResponse(r=>r.url().endsWith(`/api/admin/assessments/lessons/${fixture.lessonId}`)&&r.request().method()==='POST');await button('Save draft');const r=await response;assert.equal(r.status(),201);const {data}=await r.json();assert.equal(data.content.ide,mode);assert.equal(data.content.questions[0].type,type);await page.waitForFunction(()=>!document.querySelector('[data-testid=assessment-editor]'));pass(mode+' '+type+' saved with real API');return data;}
 await button('Add assessment',scope);await page.waitForSelector(editor+' .cm-content');
 await choose('[data-testid=program-comparison]','exact');await choose('[data-testid=program-comparison]','json');await choose('[data-testid=program-comparison]','tokens');
 await choose('[data-testid=program-generator]','custom');await page.waitForSelector('[data-admin-required-code] .cm-content');await choose('[data-testid=program-generator]','integer');
 await choose('[data-testid=program-comparison]','exact');await basics('Authoring JS');
 await choose(editor+' > .grid select','QUIZ');
 await choose('[data-testid=question-type]','CHOICE');pass('question type changes after titles without a blocking dialog');
 await choose('[data-testid=question-type]','PROGRAM');pass('program settings survive switching types',await page.$eval('[data-testid=program-comparison]',e=>e.value==='exact'));
 await choose('[data-testid=question-type]','CODING');
 await choose(question+' [data-admin-check] select','function');
 await fill(question+' input[pattern="[A-Za-z_$][A-Za-z0-9_$]*"]','sum');
 const expected=question+' [data-testid=typed-value] > label select';
 await choose(expected,'number');await fill(question+' [data-testid=typed-value] input','7');
 await choose(expected,'boolean');await choose(question+' [data-testid=typed-value] select[dir=ltr]','true');
 await choose(expected,'object');await button('Add property');await fill(question+' input[aria-label="Property name"]','completeName');await page.keyboard.press('Tab');pass('object property accepts a full name',await page.$eval(question+' input[aria-label="Property name"]',e=>e.value==='completeName'));
 await choose(expected,'array');await button('Add item');await button('Remove item');await choose(expected,'null');await choose(expected,'string');
 await button('Remove check');await button('Save draft');await page.waitForSelector('[data-admin-checks] [data-testid=admin-field-error]');pass('empty behavior checks rejected locally');await button('Add check');
 await choose(question+' [data-admin-check] select','function');await fill(question+' input[pattern="[A-Za-z_$][A-Za-z0-9_$]*"]','sum');await choose(expected,'number');await fill(question+' [data-testid=typed-value] input','2');
 await fill(question+' [data-testid=typed-value] input','invalid number');await button('Save draft');await page.waitForSelector('[data-testid=typed-value] [data-testid=admin-field-error]');pass('invalid typed number cannot save stale committed value');await fill(question+' [data-testid=typed-value] input','2');await button('Add question');await page.waitForSelector(editor+' [data-admin-question="2"]');pass('new question opens and first collapses',await page.$eval(question,e=>!e.open));await page.$eval(editor+' [data-admin-question="2"] > summary',e=>e.click());pass('missing second question is collapsed before validation',await page.$eval(editor+' [data-admin-question="2"]',e=>!e.open));await button('Save draft');await page.waitForFunction(()=>document.activeElement?.closest('[data-admin-question]')?.getAttribute('data-admin-question')==='2');pass('validation opens and focuses a collapsed missing question');await button('Remove question',editor+' [data-admin-question="2"]');
 const coding=await save('javascript','CODING');pass('function expected number round-trips',coding.content.questions[0].checks[0].expected===2);
 const codingPublish=page.waitForResponse(r=>r.url().endsWith('/api/admin/assessments/'+coding.id+'/publish'));await button('Publish revision',scope+' [data-admin-assessment="'+coding.id+'"]');assert.equal((await codingPublish).status(),200);pass('coding assessment publishes through UI and protected API');
 for(const mode of ['web','python']){
  await page.click(scope+' [data-testid=ide-mode-'+mode+']');await button('Add assessment',scope);await page.waitForSelector(editor+' .cm-content');await basics('Authoring '+mode);
  if(mode==='web'){
   await choose(question+' [data-admin-check] select','attribute');await fill(question+' input[pattern]','data-value');await fill(question+' input[maxlength="256"]','#result');
   await button('Add interaction');await button('Save draft');await page.waitForSelector('[data-testid=check-interaction] [data-testid=admin-field-error]');pass('empty interaction selector rejected locally');await choose('[data-testid=check-interaction] select','input');await fill('[data-testid=check-interaction] input[dir=ltr]','#field');await fill('[data-testid=check-interaction] input:not([dir])','typed');
   await choose(question+' [data-admin-check] select','style');await fill(question+' input[pattern]','color');await fill(question+' input[maxlength="256"]','#result');await save(mode,'CODING');
  }else{
   pass('Python excludes browser coding checks',await page.$$eval('[data-testid=question-type] option',a=>!a.some(e=>e.value==='CODING')));
   await choose('[data-testid=program-comparison]','exact');await choose('[data-testid=program-generator]','custom');await choose('[data-testid=program-generator]','integer');await fill('[data-testid=generator-count]','2');const python=await save(mode,'PROGRAM');const card=scope+' [data-admin-assessment="'+python.id+'"]';pass('program publish stays disabled before preparation',await page.$eval(card+' [data-testid=program-preparation]',e=>[...e.querySelectorAll('button')].find(b=>b.querySelector('span')?.textContent.trim()==='Publish revision')?.disabled===true));await button('Prepare and review tests',card);await page.waitForFunction(card=>document.querySelector(card)?.textContent.includes('Tests ready to publish'),{timeout:120000},card);await page.$eval(card+' [data-testid=program-preparation] details summary',e=>{e.scrollIntoView({block:'center'});e.click();});const publish=page.waitForResponse(r=>r.url().endsWith('/api/admin/assessments/'+python.id+'/publish'));await button('Publish revision',card);assert.equal((await publish).status(),200);pass('Python prepares hidden tests, reviews and publishes with real grader');
  }
 }
 await page.click(scope+' [data-testid=ide-mode-javascript]');await button('Add assessment',scope);await page.waitForSelector(editor+' .cm-content');await basics('Authoring choice');await choose('[data-testid=question-type]','CHOICE');
 await button('Add choice');await page.$eval(question+' input[type=radio]',e=>e.click());await button('Remove choice');pass('removing the correct choice requires a new answer',await page.$$eval(question+' input[type=radio]',a=>a.every(e=>!e.checked)));
 const choiceInputs=await page.$$(question+' input[dir]');for(let i=2;i<choiceInputs.length;i++){await choiceInputs[i].evaluate(e=>e.scrollIntoView({block:'center'}));await choiceInputs[i].type('Choice '+i);}
 await page.$eval(question+' input[type=radio]',e=>e.click());await save('javascript','CHOICE');
 await button('Add assessment',scope);await page.waitForSelector(editor+' .cm-content');await page.click(editor+' button[aria-label="التبديل إلى العربية"]');await choose('[data-testid=program-comparison]','exact');await choose('[data-testid=question-type]','CHOICE');pass('Arabic native question and comparison controls work');
 await page.setViewport({width:390,height:844});const rect=await page.$eval(editor,e=>{const r=e.getBoundingClientRect();return {top:r.top,left:r.left,width:r.width,height:r.height};});console.log('Mobile editor bounds '+JSON.stringify(rect));await page.screenshot({path:'/evidence/assessment-authoring-ar-mobile.png',fullPage:false});pass('editor covers mobile viewport',Math.abs(rect.top)<1&&Math.abs(rect.left)<1&&Math.abs(rect.width-390)<1&&Math.abs(rect.height-844)<1);pass('mobile form fits viewport',await page.$eval(editor,e=>e.scrollWidth<=e.clientWidth+1));
 await page.focus('[data-testid=question-type]');await page.keyboard.press('Escape');pass('Escape on a native select preserves the editor',!!await page.$(editor));
 await button('إلغاء');await page.waitForFunction(()=>!document.querySelector('[data-testid=assessment-editor]'));await page.waitForFunction(()=>document.documentElement.lang==='ar');
 pass('browser has no runtime errors',errors.length===0);console.log('Assessment authoring PASS checks='+checks);
}catch(e){if(page)await page.screenshot({path:'/evidence/assessment-authoring-failure.png',fullPage:true});throw e;}finally{await browser.close();}
