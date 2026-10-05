/** Real APIs and browser controls on a disposable synthetic course only. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const fixture = JSON.parse(readFileSync('/evidence/fixtures.json', 'utf8'));
const host = (await lookup('nginx')).address;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${host}`] });
let checks = 0; const errors = [];
const pass = (name, ok = true) => { assert(ok, name); checks++; console.log(`PASS ${name}`); };
async function route(p, hash) { await p.goto('http://localhost:8080/' + hash, { waitUntil: 'networkidle2' }); }
async function tab(p, name) { const selector=`#course-workspace-tab-${name}`; await p.waitForFunction(selector=>document.querySelector(selector)&&!document.querySelector(selector).disabled,{},selector); await p.$eval(selector,e=>e.scrollIntoView({block:'center'})); await p.click(selector); await p.waitForSelector(`${selector}[aria-selected=true]`); }
async function text(p, selector, value) { await p.waitForFunction(selector=>document.querySelector(selector)&&!document.querySelector(selector).disabled,{},selector); await p.$eval(selector, e => { e.scrollIntoView({ block: 'center' }); e.focus(); e.select(); }); await p.keyboard.press('Backspace'); await p.type(selector, value); }
async function button(p, scope, label) { const selector = await p.evaluate(({scope,label}) => {
  const root = document.querySelector(scope); const buttons = [...root.querySelectorAll('button')];
  const target = buttons.find(b => b.querySelector('span')?.textContent.trim() === label || b.textContent.trim() === label);
  if (!target) throw Error(`Missing button ${label}`); target.setAttribute('data-catalog-click', 'active'); target.scrollIntoView({block:'center'}); return '[data-catalog-click=active]';
}, {scope,label}); await p.waitForFunction(selector=>document.querySelector(selector)&&!document.querySelector(selector).disabled,{},selector); await p.click(selector); await p.evaluate(() => document.querySelectorAll('[data-catalog-click]').forEach(e=>e.removeAttribute('data-catalog-click'))); }
async function api(p, path, method = 'GET', body) { return p.evaluate(async ({path,method,body}) => {
  const csrf = document.cookie.split('; ').find(c=>c.startsWith('edu_csrf='))?.slice(9);
  const r = await fetch('/api'+path, { method, headers: {'Content-Type':'application/json','X-Csrf-Token':csrf ?? ''}, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
  return { status:r.status, ...(await r.json()) };
}, {path,method,body}); }
async function course(p,id) { const result = await api(p,`/admin/catalog/courses/${id}`); assert.equal(result.status,200); return result.data.course; }
async function submit(p, selector, path) { const response=p.waitForResponse(r=>r.url().includes(path)&&r.request().method()==='POST'); await p.click(`form:has(${selector}) button[type=submit]`); const r=await response; assert.equal(r.status(),201); await p.waitForFunction(selector=>document.querySelector(selector)?.value===''&&!document.querySelector(`form:has(${selector}) button[type=submit]`)?.disabled,{},selector); }
try {
  const p=await browser.newPage(); p.on('pageerror', e=>{errors.push(e.message);console.log(`BROWSER ERROR ${e.stack ?? e.message}`);}); await p.setViewport({width:1440,height:1100});
  await p.evaluateOnNewDocument(()=>{if(window===window.top)localStorage.setItem('edu-platform-lang','en');});
  await route(p,'#/login'); await p.type('#login-id','modes-admin@example.test'); await p.type('#login-password','synthetic modes password only'); await p.click('form button[type=submit]'); await p.waitForFunction(()=>location.hash==='#/account');
  await route(p,`#/admin/courses/${fixture.courseId}`); await p.waitForSelector(`[id="les-ta-${(await course(p,fixture.courseId)).sections[0].id}"]`);
  pass('published course explains which changes still require a draft',await p.$eval('main',e=>e.textContent.includes('Published courses allow adding lessons')));
  pass('published section creation and rename remain disabled',await p.evaluate(()=>[...document.querySelectorAll('#course-workspace-panel-outline button')].filter(b=>['Add section','Edit'].includes(b.querySelector('span')?.textContent.trim())).every(b=>b.disabled)));
  const liveSection=(await course(p,fixture.courseId)).sections[0].id;
  await text(p,`#les-ta-${liveSection}`,'درس جديد بعد النشر'); await text(p,`#les-te-${liveSection}`,'New published lesson'); await submit(p,`#les-ta-${liveSection}`,`/sections/${liveSection}/lessons`);
  const live=await course(p,fixture.courseId); const liveLesson=live.sections[0].lessons.at(-1);
  pass('published Add lesson succeeds through the real form and backend',live.status==='PUBLISHED'&&liveLesson.titleEn==='New published lesson'&&live.sections[0].lessons[0].media.status==='READY');
  pass('new published lesson video upload controls are enabled',await p.$eval(`[data-testid=uploader-${liveLesson.id}] input[type=file]`,e=>!e.disabled));
  await p.click('.language-tool'); await p.waitForFunction(()=>document.documentElement.dir==='rtl'); await p.setViewport({width:390,height:844});
  pass('Arabic mobile explains published lesson additions without generic error',await p.$eval('main',e=>e.textContent.includes('يمكنك إضافة دروس')&&!e.textContent.includes('حدث خطأ غير متوقع')));
  pass('Arabic mobile course editor has no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.screenshot({path:'/evidence/catalog-published-mobile-ar.png',fullPage:true});
  await p.click('.language-tool'); await p.setViewport({width:1440,height:1100});
  await route(p,'#/admin/catalog'); await button(p,'main','Create a new course'); await p.waitForSelector('#cf-slug');
  for(const [selector,value] of [['#cf-slug','catalog-editor-synthetic'],['#cf-ta','اختبار الإدارة'],['#cf-te','Synthetic editor'],['#cf-da','اختبار معزول'],['#cf-de','Isolated editor verification']]) await text(p,selector,value);
  const createResponse=p.waitForResponse(r=>r.url().endsWith('/api/admin/catalog/courses')&&r.request().method()==='POST'); await p.$eval('form:has(#cf-slug) button[type=submit]',e=>e.scrollIntoView({block:'center'})); await p.click('form:has(#cf-slug) button[type=submit]');
  const createdResponse=await createResponse; assert.equal(createdResponse.status(),201); const created=await createdResponse.json(); const id=created.data.course.id;
  await p.waitForFunction(()=>!document.querySelector('#cf-slug')); pass('ADMIN course creation form saves bilingual details');
  await route(p,`#/admin/courses/${id}`); await p.waitForSelector('#sec-ta');
  const sectionForm='#sec-ta'; await p.click(`${sectionForm}`); await button(p,'#course-workspace-panel-outline','Add section');
  pass('empty section fields trigger browser validation',await p.$eval('#sec-ta',e=>!e.validity.valid));
  for (const [ar,en] of [['القسم الأول','Section one'],['القسم الثاني','Section two']]) {
    await text(p,'#sec-ta',ar); await text(p,'#sec-te',en); await submit(p,'#sec-ta','/sections');
    pass(`creates bilingual ${en}`);
  }
  let draft=await course(p,id); const sectionId=draft.sections[0].id;
  for(const [ar,en] of [['الدرس الأول','Lesson one'],['الدرس الثاني','Lesson two']]) {
    await text(p,`#les-ta-${sectionId}`,ar); await text(p,`#les-te-${sectionId}`,en); await submit(p,`#les-ta-${sectionId}`,`/sections/${sectionId}/lessons`); pass(`real Add lesson creates ${en}`);
  }
  draft=await course(p,id); const lessonId=draft.sections[0].lessons[0].id;
  const sectionRow='[data-testid=paged-list-section-ordering] li:first-child';
  await button(p,sectionRow,'Edit'); await text(p,`${sectionRow} input:not([dir=ltr])`,'قسم مُعدّل'); await text(p,`${sectionRow} input[dir=ltr]`,'Renamed section');
  const sectionSaved=p.waitForResponse(r=>r.url().endsWith(`/sections/${sectionId}`)&&r.request().method()==='PATCH'); await button(p,sectionRow,'Save'); assert.equal((await sectionSaved).status(),200);
  await p.waitForFunction(()=>document.querySelector('[data-testid=paged-list-section-ordering]').textContent.includes('Renamed section')); pass('section rename persists');
  const lessonRow=`[data-testid=paged-list-lessons-${sectionId}] > li:first-child`;
  await button(p,lessonRow,'Edit'); await text(p,`${lessonRow} form input[dir=ltr]`,'Renamed lesson');
  const lessonSaved=p.waitForResponse(r=>r.url().endsWith(`/lessons/${lessonId}`)&&r.request().method()==='PATCH'); await button(p,`${lessonRow} form`,'Save'); assert.equal((await lessonSaved).status(),200);
  await p.waitForFunction(lessonId=>document.querySelector(`[data-testid=deletion-${lessonId}]`).textContent.includes('Renamed lesson'),{},lessonId); pass('lesson rename persists');
  const move=p.waitForResponse(r=>r.url().includes(`/sections/${sectionId}/lessons/reorder`)&&r.request().method()==='POST'); await button(p,lessonRow,'↓'); assert.equal((await move).status(),200);
  await p.waitForFunction(lessonId=>document.querySelector(`[data-testid=deletion-${lessonId}]`)?.closest('li')?.textContent.includes('#2'),{},lessonId);
  pass('lesson reorder persists with contiguous positions',(await course(p,id)).sections[0].lessons.map(l=>l.position).join(',')==='1,2');
  const sectionMoved=p.waitForResponse(r=>r.url().includes(`/courses/${id}/sections/reorder`)&&r.request().method()==='POST'); await button(p,sectionRow,'↓'); assert.equal((await sectionMoved).status(),200);
  pass('section reorder persists',(await course(p,id)).sections[1].id===sectionId);
  await tab(p,'details'); await p.waitForSelector('#cf-ta'); await text(p,'#cf-ta','عنوان محدث'); await text(p,'#cf-te','Updated course');
  const savedCourse=p.waitForResponse(r=>r.url().endsWith(`/courses/${id}`)&&r.request().method()==='PATCH'); await p.click('form:has(#cf-ta) button[type=submit]'); assert.equal((await savedCourse).status(),200);
  await p.waitForFunction(()=>[...document.querySelectorAll('h1')].some(e=>e.textContent==='Updated course'),{timeout:5000}).catch(async e=>{console.log(JSON.stringify({headings:await p.$$eval('h1',els=>els.map(e=>e.textContent)),course:await course(p,id)}));await p.screenshot({path:'/evidence/catalog-save-failure.png',fullPage:true});throw e;}); pass('course details save and reload');
  await p.waitForFunction(()=>document.querySelector('#course-workspace-panel-details [role=status]')?.textContent==='No unsaved changes');
  await tab(p,'access'); await text(p,'#plan-current','125'); await p.select('#plan-mode','UNTIL_REMOVAL'); await submit(p,'#plan-current',`/courses/${id}/plans`);
  draft=await course(p,id); pass('access offer saves exact price and indefinite terms',draft.plans.length===1&&draft.plans[0].currentPricePiastres===12500&&draft.plans[0].accessMode==='UNTIL_REMOVAL');
  await button(p,'[data-testid=paged-list-price-plans] li','Edit'); await text(p,'#plan-current','150');
  const priceSaved=p.waitForResponse(r=>r.url().includes(`/plans/${draft.plans[0].id}`)&&r.request().method()==='PATCH'); await p.click('form:has(#plan-current) button[type=submit]'); assert.equal((await priceSaved).status(),200);
  pass('access offer edit persists',(await course(p,id)).plans[0].currentPricePiastres===15000);
  await p.waitForFunction(()=>document.querySelector('#plan-current')?.value==='');
  await tab(p,'publish'); await p.waitForSelector('[data-testid=course-readiness]');
  pass('readiness checklist exposes missing videos',await p.$eval('[data-testid=course-readiness]',e=>e.textContent.includes('Needs attention')));
  const blocked=await api(p,`/admin/catalog/courses/${id}/transitions`,'POST',{to:'PROCESSING'}); pass('incomplete publication refused by real server',blocked.status===409&&blocked.error.code==='PUBLICATION_BLOCKED');
  await button(p,'#course-workspace-panel-publish','Archive'); await p.waitForSelector('[role=dialog]');
  const archived=p.waitForResponse(r=>r.url().endsWith(`/courses/${id}/archive`)&&r.request().method()==='POST'); await button(p,'[role=dialog]','Archive'); assert.equal((await archived).status(),200);
  await p.waitForFunction(()=>document.querySelector('main').textContent.includes('Unarchive')); pass('archive confirmation works');
  await tab(p,'outline'); pass('archived section/lesson controls explain restore path',await p.$eval('main',e=>e.textContent.includes('Restore it from the Publish, archive & delete')));
  await tab(p,'publish'); const restored=p.waitForResponse(r=>r.url().endsWith(`/courses/${id}/unarchive`)&&r.request().method()==='POST'); await button(p,'#course-workspace-panel-publish','Unarchive'); assert.equal((await restored).status(),200);
  await p.waitForFunction(()=>document.querySelector('#course-workspace-panel-publish')?.textContent.includes('Archive')&&!document.querySelector('#course-workspace-panel-publish')?.textContent.includes('Unarchive'));
  await tab(p,'outline'); await p.waitForSelector(`#les-ta-${sectionId}`); pass('restored draft permits lesson creation',await p.$eval(`#les-ta-${sectionId}`,e=>!e.disabled));
  const scope=`[data-testid=assessment-admin-${lessonId}]`; await button(p,scope,'Assignments and quizzes'); await p.waitForSelector(`${scope} [data-testid=ide-mode-python]`);
  for(const mode of ['javascript','web','python']) {
    await p.click(`${scope} [data-testid=ide-mode-${mode}]`); await button(p,scope,'Add assessment'); await p.waitForSelector('[data-testid=assessment-editor] .cm-content'); pass(`${mode} assessment authoring opens`);
    await button(p,'[data-testid=assessment-editor]','Cancel'); await p.waitForFunction(()=>!document.querySelector('[data-testid=assessment-editor]')); pass(`${mode} assessment cancellation closes safely`);
  }
  const removable=(await course(p,id)).sections.find(s=>s.id===sectionId).lessons.find(l=>l.id!==lessonId).id;
  const deletion=`[data-testid=deletion-${removable}]`; await p.click(`${deletion} summary`); pass('deletion requires exact confirmation',await p.$eval(`${deletion} [data-testid=deletion-submit]`,e=>e.disabled));
  await text(p,`${deletion} input`,removable); const removed=p.waitForResponse(r=>r.url().endsWith(`/lessons/${removable}/delete`)&&r.request().method()==='POST'); await p.click(`${deletion} [data-testid=deletion-submit]`); assert.equal((await removed).status(),202);
  const final=await course(p,id); pass('synthetic empty lesson deletion succeeds',!final.sections.flatMap(s=>s.lessons).some(l=>l.id===removable));
  await p.screenshot({path:'/evidence/catalog-draft-desktop-en.png',fullPage:true});
  const emptySection=final.sections.find(s=>s.lessons.length===0).id; const sectionDelete=`[data-testid=deletion-${emptySection}]`;
  await p.click(`${sectionDelete} summary`); await text(p,`${sectionDelete} input`,emptySection); const sectionGone=p.waitForResponse(r=>r.url().endsWith(`/sections/${emptySection}/delete`)&&r.request().method()==='POST'); await p.$eval(`${sectionDelete} [data-testid=deletion-submit]`,e=>e.scrollIntoView({block:'center'})); await p.click(`${sectionDelete} [data-testid=deletion-submit]`); assert.equal((await sectionGone).status(),202);
  pass('synthetic empty section deletion succeeds',!(await course(p,id)).sections.some(s=>s.id===emptySection));
  await tab(p,'access'); const planId=(await course(p,id)).plans[0].id; const planGone=p.waitForResponse(r=>r.url().endsWith(`/plans/${planId}`)&&r.request().method()==='DELETE'); await button(p,'[data-testid=paged-list-price-plans] li','Remove'); assert.equal((await planGone).status(),200); pass('synthetic price offer removal succeeds',(await course(p,id)).plans.length===0);
  await tab(p,'publish'); const courseDelete=`[data-testid=deletion-${id}]`; await p.click(`${courseDelete} summary`); await text(p,`${courseDelete} input`,'catalog-editor-synthetic');
  const courseGone=p.waitForResponse(r=>r.url().endsWith(`/courses/${id}/delete`)&&r.request().method()==='POST'); await p.$eval(`${courseDelete} [data-testid=deletion-submit]`,e=>e.scrollIntoView({block:'center'})); await p.click(`${courseDelete} [data-testid=deletion-submit]`); assert.equal((await courseGone).status(),202); pass('synthetic course permanent deletion succeeds',(await api(p,`/admin/catalog/courses/${id}`)).status===404);
  pass('editor browser has no runtime errors',errors.length===0); console.log(`Catalog editor PASS checks=${checks}`);
} finally { await browser.close(); }
