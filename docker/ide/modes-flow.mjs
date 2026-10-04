// Synthetic browser verification on the isolated modes project only.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { lookup } from 'node:dns/promises';
const fixture = JSON.parse(fs.readFileSync('/evidence/fixtures.json', 'utf8'));
const origin = 'http://localhost:8080';
const gateway = (await lookup('nginx')).address;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${gateway}`] });
let checks = 0; const errors = [];
const pass = (label, value = true) => { assert(value, label); console.log(`PASS ${label}`); checks++; };
const pause = (ms) => new Promise(r => setTimeout(r, ms));
async function login(email) {
  const context = await browser.createBrowserContext(); const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on('pageerror', () => errors.push('pageerror'));
  await page.evaluateOnNewDocument(() => { if (window.top === window) localStorage.setItem('edu-platform-lang', 'en'); });
  await page.goto(`${origin}/#/login`, { waitUntil: 'networkidle2' });
  await page.type('#login-id', email); await page.type('#login-password', 'synthetic modes password only');
  await page.$eval('form button[type=submit]', b => b.scrollIntoView({ block: 'center' }));
  await page.click('form button[type=submit]'); await page.waitForFunction(() => location.hash === '#/account'); return page;
}
async function api(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const csrf = document.cookie.split('; ').find(x => x.startsWith('edu_csrf='))?.slice(9);
    const r = await fetch(`/api${path}`, { method, credentials: 'include', headers: { ...(body ? {'Content-Type':'application/json'} : {}), ...(method !== 'GET' ? {'X-Csrf-Token':decodeURIComponent(csrf ?? '')} : {}) }, ...(body ? {body:JSON.stringify(body)} : {}) });
    return { status:r.status, body:await r.json() };
  }, { method, path, body });
}
const active = '[role=tabpanel]:not([hidden])';
async function mode(page, kind) { await page.click(`[data-testid=ide-mode-${kind}]`); await page.waitForSelector(`${active} .cm-content`); }
async function code(page, source, scope = active) {
  const selector = `${scope} .cm-content[contenteditable=true]`;
  await page.click(selector); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.type(source);
}
async function run(page, output, scope = active) {
  const selector = `${scope} [data-testid=ide-run]`;
  await page.$eval(selector, b => b.scrollIntoView({block:'center'})); await page.click(selector);
  await page.waitForFunction(({scope,output}) => document.querySelector(`${scope} [data-testid=ide-console]`)?.textContent.includes(output), {timeout:60000}, {scope,output});
}
async function button(page, text, scope = 'main') {
  assert(await page.evaluate(({text,scope}) => { const b = [...document.querySelector(scope).querySelectorAll('button')].find(b => b.textContent.trim()===text); b?.click(); return !!b; }, {text,scope}), `Missing ${text}`);
}
try {
  const student = await login('modes-student@example.test'); const admin = await login('modes-admin@example.test');
  await student.goto(`${origin}/#/practice`); await student.waitForSelector(`${active} .cm-content`);
  pass('three independent accessible mode tabs', await student.$$eval('[data-testid^=ide-mode-]', a => a.length===3));
  await code(student, 'console.log("js-mode-ok")'); await run(student, 'js-mode-ok'); pass('JavaScript Run works');
  await mode(student,'web'); await button(student,'HTML',active); await code(student,'<p id="result">Web original</p>');
  await button(student,'CSS',active); await code(student,'#result { color: rgb(12, 34, 56); }');
  await button(student,'JavaScript',active); await code(student,'document.querySelector("#result").textContent = "Web updated"; console.log("web-mode-ok")');
  await run(student,'web-mode-ok');
  // Locate the visible preview instead of any hidden JavaScript preview frame.
  const handle = await student.$(`${active} iframe`); const frame = await handle.contentFrame();
  pass('HTML CSS and DOM manipulation preview', await frame.evaluate(() => document.querySelector('#result')?.textContent === 'Web updated' && getComputedStyle(document.querySelector('#result')).color === 'rgb(12, 34, 56)'));
  pass('web preview keeps opaque origin', await student.$eval(`${active} iframe`, e => e.contentDocument===null));
  await mode(student,'python'); await code(student,'n = int(input())\nprint(n ** 2)'); await student.type(`${active} [data-testid=ide-input]`,'3'); await run(student,'9');
  pass('Python input print executes through real queued worker');
  pass('Python offers its own Format code action',!!await student.$(`${active} [data-testid=ide-format]`));
  await pause(2000);
  pass('three Runs share one allowance', (await api(student,'GET','/assessments/practice')).body.data.quota.used===3);
  for (const [kind,key,needle] of [['javascript','javascript','js-mode-ok'],['web','html','Web original'],['python','python','n = int(input())']]) {
    const draft=(await api(student,'GET',`/assessments/practice?mode=${kind}`)).body.data.draft;
    pass(`${kind} draft independently saved`, draft.content[key].includes(needle));
  }
  await mode(student,'javascript'); pass('switching tabs preserves JavaScript editor', await student.$eval(`${active} .cm-content`, e=>e.textContent.includes('js-mode-ok')));
  await student.reload(); await student.waitForSelector(`${active} .cm-content`); await mode(student,'python');
  pass('Python draft survives reload',await student.$eval(`${active} .cm-content`, e=>e.textContent.includes('int(input())')));
  await student.screenshot({path:'/evidence/python-practice.png',fullPage:true});
  await mode(student,'web'); await student.screenshot({path:'/evidence/web-practice.png',fullPage:true});
  const src={html:'',css:'',javascript:'',python:'n = int(input())\nprint(n ** 2)'};
  const content={ide:'python',titleAr:'مربع',titleEn:'Python square',instructionsAr:'حل',instructionsEn:'Print the square.',questions:[{id:'p',type:'PROGRAM',titleAr:'رقم',titleEn:'Number',starter:src,program:{inputAr:'رقم',inputEn:'Number',outputAr:'مربع',outputEn:'Square',comparison:'tokens',samples:[{input:'3',output:'9'}],reference:src.python,generator:{mode:'integer',min:-2,max:2,count:2}}}]};
  const created=await api(admin,'POST',`/admin/assessments/lessons/${fixture.lessonId}`,{kind:'QUIZ',required:false,content});
  pass('admin creates independent Python quiz',created.status===201); const id=created.body.data.id;
  pass('private reference preparation accepted', (await api(admin,'POST',`/admin/assessments/${id}/prepare`,{})).status===202);
  let prep; for(let i=0;i<60;i++){prep=(await api(admin,'GET',`/admin/assessments/${id}/preparation`)).body.data; if(!['PENDING','RUNNING'].includes(prep.state))break; await pause(1000);}
  pass('real worker generates private Python tests',prep.state==='READY');
  pass('Python quiz published', (await api(admin,'POST',`/admin/assessments/${id}/publish`,{})).status===200);
  const detail=(await api(student,'GET',`/assessments/${id}`)).body.data;
  pass('admin solution and private tests stay hidden',detail.content.questions[0].starter.python==='' && !JSON.stringify(detail.content).includes('reference') && !JSON.stringify(detail.content).includes('generator'));
  await student.goto(`${origin}/#/assessment/${id}`); await student.waitForSelector('[data-testid=assessment-submit]'); await student.waitForSelector('main .cm-content');
  pass('quiz opens Python editor automatically',await student.$eval('main',e=>e.textContent.includes('Read with input()')));
  await code(student,'print(9)','main'); await button(student,'Submit answer');
  await student.waitForFunction(()=>document.querySelector('[data-testid=assessment-result]')?.textContent.includes('Not correct yet'),{timeout:60000});
  pass('hardcoded sample rejected by private tests');
  await code(student,src.python,'main'); await run(student,'9','main');
  pass('exercise Run is outside practice allowance',(await api(student,'GET','/assessments/practice')).body.data.quota.used===3);
  await button(student,'Submit answer'); await student.waitForFunction(()=>document.querySelector('[data-testid=assessment-result]')?.textContent.includes('Correct!'),{timeout:60000});
  pass('correct Python submission earns pass after retry');
  await student.screenshot({path:'/evidence/python-quiz.png',fullPage:true});
  await student.click('[aria-label="التبديل إلى العربية"]'); await student.setViewport({width:390,height:844});
  pass('Arabic RTL and LTR Python source',await student.evaluate(()=>document.documentElement.dir==='rtl' && document.querySelector('[data-testid=ide-editor]').dir==='ltr'));
  pass('mobile quiz avoids horizontal overflow',await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await student.screenshot({path:'/evidence/python-mobile-ar.png',fullPage:true});
  pass('no browser runtime errors',errors.length===0);
  console.log(`Browser modes PASS checks=${checks}`);
} finally { await browser.close(); }
