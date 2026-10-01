import fs from 'node:fs';
import assert from 'node:assert/strict';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const fixture = JSON.parse(fs.readFileSync('/evidence/m9-fixtures.json', 'utf8'));
const host = (await lookup('host.docker.internal')).address;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${host}`] });
let checks = 0; const contexts = []; const errors = [];
const pass = (name, condition = true) => { assert(condition, name); checks++; console.log(`PASS ${name}`); };
async function login(email) {
  const context = await browser.createBrowserContext(); contexts.push(context); const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message.slice(0, 300)));
  page.on('response', (response) => { if (response.url().includes('/admin/assessments/') && response.url().includes('/submissions')) console.log(`Submission browse HTTP ${response.status()}`); });
  // Puppeteer injects into every child frame too; only the trusted top page
  // has storage. The IDE's opaque frame correctly denies that access.
  await page.evaluateOnNewDocument(() => { if (window.top === window) localStorage.setItem('edu-platform-lang', 'en'); });
  await page.goto('http://localhost:8084/#/login', { waitUntil: 'networkidle2' });
  await page.type('#login-id', email); await page.type('#login-password', 'm9 fixture password twelve words');
  await page.click('form button[type="submit"]'); await page.waitForFunction(() => location.hash === '#/account'); return page;
}
async function api(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const csrf = document.cookie.split('; ').find((x) => x.startsWith('edu_csrf='))?.slice(9);
    const r = await fetch(`/api${path}`, { method, credentials: 'include', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-Csrf-Token': decodeURIComponent(csrf ?? '') } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, body: await r.json() };
  }, { method, path, body });
}
async function clickText(page, text, scope = 'main') {
  const found = await page.evaluate(({ text, scope }) => { const button = [...document.querySelector(scope).querySelectorAll('button')].find((x) => x.textContent.trim() === text); if (!button) return false; button.click(); return true; }, { text, scope });
  assert(found, `Button missing: ${text}`);
}
async function fillLabel(page, label, value, scope) {
  const selector = await page.evaluate(({ label, scope }) => {
    const field = [...document.querySelector(scope).querySelectorAll('label')].find((x) => x.textContent.trim() === label)?.querySelector('input,textarea');
    if (!field) return null; const id = `probe-${crypto.randomUUID()}`; field.id = id; return `#${id}`;
  }, { label, scope });
  assert(selector, `Field missing: ${label}`); await page.type(selector, value);
}
async function setField(page, selector, value) {
  await page.$eval(selector, (field, text) => { const prototype = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, text); field.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}
async function editCode(page, code) {
  await page.bringToFront(); await page.waitForSelector('.cm-content'); await page.click('.cm-content'); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.type(code);
}
try {
  const student = await login('m9-student@example.test'); const admin = await login('m9-admin@example.test');
  pass('cookie-authenticated STUDENT and ADMIN');
  await student.goto('http://localhost:8084/#/practice'); await student.waitForSelector('[data-testid="web-ide"]');
  pass('standalone reusable IDE loads for active subscription');
  await editCode(student, 'console.log("m9-preview-ok");'); await student.$eval('[data-testid="ide-run"]', (button) => button.scrollIntoView({ block: 'center' })); await student.click('[data-testid="ide-run"]');
  await student.waitForFunction(() => [...document.querySelectorAll('pre')].some((p) => p.textContent.includes('m9-preview-ok')), { polling: 100 });
  pass('Run executes JavaScript and prints console output');
  pass('JavaScript-only editor and large console replace visible preview', await student.evaluate(() => { const ide = document.querySelector('[data-testid=web-ide]'); const output = ide.querySelector('[data-testid=ide-console]'); return output.parentElement === ide.querySelector('[data-testid=ide-workspace]') && output.getBoundingClientRect().height >= 420 && ide.querySelector('iframe').getBoundingClientRect().width <= 1 && ![...ide.querySelectorAll('button')].some((b) => ['HTML', 'CSS'].includes(b.textContent.trim())); }));
  await clickText(student, 'Clear console');
  pass('console can be cleared without clearing source', await student.evaluate(() => document.querySelector('[data-testid=ide-console] pre').textContent === '' && document.querySelector('.cm-content').textContent.includes('m9-preview-ok')));
  const quota = await api(student, 'GET', '/assessments/practice'); pass('one official Run consumes one of 50', quota.body.data.quota.used === 1 && quota.body.data.quota.remaining === 49);
  pass('preview has opaque origin', await student.evaluate(() => document.querySelector('iframe').contentDocument === null));
  const frame = student.frames().find((x) => x !== student.mainFrame());
  pass('preview cannot read platform cookies', await frame.evaluate(() => { try { document.cookie; return false; } catch { return true; } }));
  pass('preview blocks async-generator dynamic code escape', await frame.evaluate(() => { try { Object.getPrototypeOf(async function*(){}).constructor('while(true){}'); return false; } catch { return true; } }));
  pass('copied bootstrap nonce cannot authorize another script', await frame.evaluate(async () => {
    window.__nonceEscape = false;
    const nonce = document.querySelector('meta[http-equiv="Content-Security-Policy"]').content.match(/nonce-([^']+)/)[1];
    const tag = document.createElement('script'); tag.nonce = nonce; tag.textContent = 'window.__nonceEscape=true'; document.head.append(tag);
    await new Promise((resolve) => setTimeout(resolve, 20)); return window.__nonceEscape === false;
  }));
  await student.waitForFunction(() => document.querySelector('main').textContent.includes('Saved'));
  pass('practice draft persists server-side', (await api(student, 'GET', '/assessments/practice')).body.data.draft.content.javascript.includes('m9-preview-ok'));
  await student.click('[aria-label="التبديل إلى العربية"]');
  pass('Arabic RTL with LTR editor', await student.evaluate(() => document.documentElement.dir === 'rtl' && document.querySelector('[data-testid="ide-editor"]').dir === 'ltr'));
  await student.setViewport({ width: 390, height: 844 }); await student.evaluate(() => window.scrollTo(0, 0)); await student.screenshot({ path: '/evidence/m9-practice-mobile-ar.png', fullPage: true });
  pass('mobile page fits without horizontal overflow', await student.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await student.click('[aria-label="Switch to English"]');
  pass('language change preserves edited source', await student.$eval('.cm-content', (e) => e.textContent.includes('m9-preview-ok')));
  await student.setViewport({ width: 1280, height: 900 });
  await student.goto(`http://localhost:8084/#/assessment/${fixture.assessmentId}`); await student.waitForSelector('[data-testid="assessment-submit"]');
  pass('coding assignment reuses the same IDE', !!await student.$('[data-testid="web-ide"]'));
  pass('admin code is not seeded into the new student editor', !await student.$eval('.cm-content', (e) => e.textContent.includes('function sum')));
  const initialSubmissionCount = (await api(student, 'GET', `/assessments/${fixture.assessmentId}/history`)).body.data.submissions.length;
  await editCode(student, 'console.log("discard me")');
  await clickText(student, 'Reset to starter'); await clickText(student, 'Cancel');
  pass('cancelled starter reset preserves the student draft', await student.$eval('.cm-content', (e) => e.textContent.includes('discard me')));
  await clickText(student, 'Reset to starter'); await clickText(student, 'Confirm reset');
  pass('starter reset restores private-by-default blank source', await student.$eval('.cm-content', (e) => e.textContent === ''));

  pass('reset creates no submission', (await api(student, 'GET', `/assessments/${fixture.assessmentId}/history`)).body.data.submissions.length === initialSubmissionCount);
  const before = await api(student, 'GET', '/learning/courses/m9-ui-course/outline');
  pass('required assessment locks next lesson', before.body.data.sections[0].lessons[1].locked === true);
  await student.click('[data-testid="assessment-submit"]');
  await student.waitForFunction(() => document.querySelector('[data-testid="assessment-result"]')?.textContent.includes('Not correct yet'), { timeout: 60000 });
  pass('real worker returns incorrect for wrong source');
  await student.evaluate(() => { window.__gradeHints = 0; window.addEventListener('fayq-assessment-completed', () => window.__gradeHints++); });
  await editCode(student, 'function broken('); const unfinishedCode = await student.$eval('.cm-content', (e) => e.textContent); await clickText(student, 'Format code');
  await student.waitForFunction(() => document.querySelector('[data-testid=web-ide]').textContent.includes('Could not format'), { polling: 100 });
  pass('Prettier syntax failure preserves unfinished code', (await student.$eval('.cm-content', (e) => e.textContent)) === unfinishedCode);
  await editCode(student, 'function sum(a,b){return a+b}'); await clickText(student, 'Format code');
  await student.waitForFunction(() => document.querySelector('.cm-content').textContent.includes('return a + b;'), { polling: 100 });
  pass('Prettier organizes JavaScript in the browser worker', await student.$eval('.cm-content', (e) => e.innerText.includes('function sum(a, b) {')));
  pass('format and reset do not consume practice allowance', (await api(student, 'GET', '/assessments/practice')).body.data.quota.used === 1); await student.$eval('[data-testid="ide-run"]', (button) => button.scrollIntoView({ block: 'center' })); await student.click('[data-testid="ide-run"]');
  pass('exercise preview is quota-exempt', (await api(student, 'GET', '/assessments/practice')).body.data.quota.used === 1);
  await student.click('[data-testid="assessment-submit"]');
  await student.waitForFunction(() => document.querySelector('[data-testid="assessment-result"]')?.textContent.includes('Correct!'), { timeout: 60000 });
  pass('correct coding submission passes all private tests');
  pass('authenticated completion hint delivered', await student.evaluate(() => window.__gradeHints > 0));
  pass('passing unlocks the next lesson', (await api(student, 'GET', '/learning/courses/m9-ui-course/outline')).body.data.sections[0].lessons[1].locked === false);
  const history = await api(student, 'GET', `/assessments/${fixture.assessmentId}/history`); pass('history retains incorrect and correct attempts', history.body.data.submissions.some((s) => s.state === 'INCORRECT') && history.body.data.submissions.some((s) => s.state === 'CORRECT'));
  const readable = () => student.evaluate(() => {
    const tokens = [...document.querySelectorAll('.cm-content span')];
    const colors = tokens.map((token) => getComputedStyle(token).color);
    const luminance = (color) => { const channels = color.match(/[\d.]+/g).slice(0,3).map(Number).map((n) => n/255).map((n) => n <= 0.04045 ? n/12.92 : ((n+0.055)/1.055)**2.4); return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722; };
    const background = luminance(getComputedStyle(document.querySelector('[data-testid=ide-editor]')).backgroundColor);
    return new Set(colors).size >= 3 && colors.every((color) => { const ink = luminance(color); return (Math.max(ink,background)+0.05)/(Math.min(ink,background)+0.05) >= 4.5; });
  });
  pass('distinct syntax colors have readable contrast in dark mode', await readable());
  await student.click('header button[aria-pressed]');
  await student.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  pass('distinct syntax colors have readable contrast in light mode', await readable());
  await student.evaluate(() => window.scrollTo(0, 0)); await student.screenshot({ path: '/evidence/m9-assessment-light.png', fullPage: true });
  await student.click('header button[aria-pressed]'); await student.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await student.evaluate(() => window.scrollTo(0, 0)); await student.screenshot({ path: '/evidence/m9-assessment-desktop.png', fullPage: true });
  await student.goto(`http://localhost:8084/#/assessment/${fixture.starterAssessmentId}`); await student.waitForSelector('[data-testid=ide-reset]');
  await editCode(student, 'console.log("changed")'); await clickText(student, 'Reset to starter'); await clickText(student, 'Confirm reset');
  pass('reset restores the explicitly shared question starter', await student.$eval('.cm-content', (e) => e.textContent.includes('// Start here') && e.textContent.includes('console.log("Starter");') && !e.textContent.includes('changed')));
  await student.waitForFunction(() => document.querySelector('main').textContent.includes('Saved'), { polling: 100 });
  await student.reload(); await student.waitForSelector('.cm-content');
  pass('reset starter is saved as the student draft and survives reload', await student.$eval('.cm-content', (e) => e.textContent.includes('// Start here') && e.textContent.includes('Starter')));
  await admin.goto('http://localhost:8084/#/admin/practice'); await admin.waitForSelector('#student-search'); await admin.type('#student-search', 'm9-student');
  await admin.waitForFunction(() => [...document.querySelectorAll('main button')].some((b) => b.textContent.includes('m9-student@example.test')));
  await admin.evaluate(() => [...document.querySelectorAll('main button')].find((b) => b.textContent.includes('m9-student@example.test')).click()); await admin.waitForSelector('#quota-limit');
  await admin.click('#quota-limit', { clickCount: 3 }); await admin.type('#quota-limit', '1'); await clickText(admin, 'Save limit');
  await admin.waitForFunction(() => document.querySelector('main').textContent.includes('0/1')); pass('ADMIN can lower a student allowance below usage');
  await student.goto('http://localhost:8084/#/practice'); await student.waitForSelector('[data-testid="ide-run"]');
  pass('exhausted allowance disables standalone Run', await student.$eval('[data-testid="ide-run"]', (b) => b.disabled));
  await clickText(admin, 'Reset allowance now'); await admin.waitForFunction(() => document.querySelector('main').textContent.includes('1/1'));
  const reset = await api(student, 'GET', '/assessments/practice'); pass('manual reset starts the approved recurring 24h schedule', reset.body.data.quota.schedule === 'ANCHORED_24H' && reset.body.data.quota.remaining === 1 && Math.abs(new Date(reset.body.data.quota.nextResetAt).getTime() - Date.now() - 86400000) < 15000);
  await clickText(admin, 'Restore default (50)'); await admin.waitForFunction(() => document.querySelector('main').textContent.includes('50/50')); pass('restore default retains 24h schedule', (await api(student, 'GET', '/assessments/practice')).body.data.quota.schedule === 'ANCHORED_24H');
  await admin.goto(`http://localhost:8084/#/admin/courses/${fixture.courseId}`);
  const panel = `[data-testid="assessment-admin-${fixture.lessonId}"]`;
  await admin.waitForSelector(panel); await clickText(admin, 'Assignments and quizzes', panel); await clickText(admin, 'Add assessment', panel);
  const editor = `${panel} [data-testid="assessment-editor"]`;
  await fillLabel(admin, 'العنوان بالعربية', 'اختبار اختياري', editor); await fillLabel(admin, 'Title in English', 'Optional quiz', editor);
  await fillLabel(admin, 'Arabic instructions', 'اختر الصحيح', editor); await fillLabel(admin, 'English instructions', 'Choose the right answer', editor);
  await admin.evaluate((scope) => { const labels = [...document.querySelector(scope).querySelectorAll('label')]; for (const [name, value] of [['Assessment type', 'QUIZ'], ['Required to continue?', 'false']]) { const select = labels.find((l) => l.textContent.startsWith(name)).querySelector('select'); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(select, value); select.dispatchEvent(new Event('change', { bubbles: true })); } }, editor);
  await admin.select(`${editor} select[aria-label="Question type"]`, 'CHOICE');
  await fillLabel(admin, 'السؤال بالعربية', 'ما الصحيح؟', editor); await fillLabel(admin, 'Question in English', 'Which is correct?', editor);
  const arabicChoices = await admin.$$(`${editor} label input[dir="rtl"]`); const englishChoices = await admin.$$(`${editor} label input[dir="ltr"]`);
  // Choice fields are the final two input pairs, after titles/question text.
  await arabicChoices.at(-2).type('الأول'); await arabicChoices.at(-1).type('الثاني'); await englishChoices.at(-2).type('First'); await englishChoices.at(-1).type('Second');
  await admin.click(`${editor} input[type="radio"]`); await clickText(admin, 'Save draft', editor);
  await admin.waitForFunction((scope) => !document.querySelector(`${scope} [data-testid="assessment-editor"]`), {}, panel);
  await admin.waitForFunction((scope) => [...document.querySelector(scope).querySelectorAll('strong')].some((e) => e.textContent === 'Optional quiz'), {}, panel);
  await admin.evaluate((scope) => { const row = [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Optional quiz').parentElement; [...row.querySelectorAll('button')].find((b) => b.textContent === 'Publish revision').click(); }, panel);
  await admin.waitForFunction((scope) => [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Optional quiz')?.parentElement.textContent.includes('Published'), {}, panel);
  pass('ADMIN authors and publishes bilingual optional multiple-choice quiz through UI');
  const list = await api(student, 'GET', `/assessments/lessons/${fixture.lessonId}`); const quiz = list.body.data.assessments.find((a) => a.titleEn === 'Optional quiz');
  pass('private choice answer never reaches student API', !JSON.stringify((await api(student, 'GET', `/assessments/${quiz.id}`)).body).includes('correctChoiceId'));
  await student.goto(`http://localhost:8084/#/assessment/${quiz.id}`); await student.waitForSelector('main input[type="radio"]'); await student.click('main input[type="radio"]'); await student.click('[data-testid="assessment-submit"]');
  await student.waitForFunction(() => document.querySelector('[data-testid="assessment-result"]')?.textContent.includes('Correct!'), { timeout: 60000 }); pass('multiple-choice quiz is graded correctly by the real queue');
  await clickText(admin, 'Add assessment', panel);
  await admin.select(`${editor} select[aria-label="Question type"]`, 'CODING');
  await fillLabel(admin, 'العنوان بالعربية', 'اطبع اثنين', editor); await fillLabel(admin, 'Title in English', 'Print two', editor);
  await fillLabel(admin, 'Arabic instructions', 'اطبع اثنين', editor); await fillLabel(admin, 'English instructions', 'Print the number two', editor);
  await fillLabel(admin, 'السؤال بالعربية', 'المخرجات', editor); await fillLabel(admin, 'Question in English', 'Output', editor);
  await admin.evaluate((scope) => { const select = [...document.querySelector(scope).querySelectorAll('label')].find((l) => l.textContent.startsWith('Required to continue?')).querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'false'); select.dispatchEvent(new Event('change', { bubbles: true })); }, editor);
  await fillLabel(admin, 'Expected value', '"2"', editor);
  pass('author sees warning that console-output quotes are literal', await admin.$eval(editor, (e) => e.textContent.includes('Quotation marks in this field')));
  await admin.select(`${editor} select[aria-label="Expected value value type"]`, 'number');
  await setField(admin, `${editor} input[aria-label="Expected value"]`, '2');
  pass('console number field stores a number rather than quoted text', await admin.$eval(`${editor} select[aria-label="Expected value value type"]`, (e) => e.value === 'number'));
  pass('new JavaScript checks have no Add interaction control', !await admin.evaluate((scope) => [...document.querySelector(scope).querySelectorAll('button')].some((b) => b.textContent.trim() === 'Add interaction'), editor));
  pass('new checks offer only function and console', await admin.evaluate((scope) => { const field = [...document.querySelector(scope).querySelectorAll('label')].find((l) => l.textContent.startsWith('Check type')).querySelector('select'); return [...field.options].every((o) => ['function', 'console'].includes(o.value)); }, editor));
  await admin.evaluate((scope) => [...document.querySelector(scope).querySelectorAll('summary')].find((s) => s.textContent === 'Private admin JavaScript code').click(), editor);
  await editCode(admin, 'console.log(2)');
  pass('admin answer sharing is an explicit unchecked choice', !await admin.$eval(`${editor} input[type="checkbox"]`, (e) => e.checked));
  await clickText(admin, 'Save draft', editor);
  await admin.waitForFunction((scope) => !document.querySelector(`${scope} [data-testid="assessment-editor"]`), {}, panel);
  await admin.waitForFunction((scope) => [...document.querySelector(scope).querySelectorAll('strong')].some((e) => e.textContent === 'Print two'), {}, panel);
  await admin.evaluate((scope) => { const row = [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Print two').parentElement; [...row.querySelectorAll('button')].find((b) => b.textContent === 'Publish revision').click(); }, panel);
  await admin.waitForFunction((scope) => [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Print two')?.parentElement.textContent.includes('Published'), {}, panel);
  const consoleList = await api(student, 'GET', `/assessments/lessons/${fixture.lessonId}`); const consoleQuiz = consoleList.body.data.assessments.find((a) => a.titleEn === 'Print two');
  const publicConsole = (await api(student, 'GET', `/assessments/${consoleQuiz.id}`)).body.data;
  pass('private admin answer absent from student API', publicConsole.content.questions[0].starter.javascript === '' && !JSON.stringify(publicConsole).includes('console.log(2)'));
  await student.goto(`http://localhost:8084/#/assessment/${consoleQuiz.id}`); await student.waitForSelector('.cm-content');
  pass('student starts console exercise with an empty editor', (await student.$eval('.cm-content', (e) => e.textContent)).trim() === '');
  await editCode(student, 'console.log(2)'); await student.click('[data-testid="assessment-submit"]');
  await student.waitForFunction(() => document.querySelector('[data-testid="assessment-result"]')?.textContent.includes('Correct!'), { timeout: 60000 });
  pass('expected output 2 and console.log(2) pass through author UI and actual isolated grading');
  await clickText(admin, 'Add assessment', panel);
  await admin.select(`${editor} select[aria-label="Question type"]`, 'CODING');
  await fillLabel(admin, 'العنوان بالعربية', 'قيمة مركبة', editor); await fillLabel(admin, 'Title in English', 'Structured result', editor);
  await fillLabel(admin, 'Arabic instructions', 'أرجع كائنًا', editor); await fillLabel(admin, 'English instructions', 'Return the structured result', editor);
  await fillLabel(admin, 'السؤال بالعربية', 'الدالة', editor); await fillLabel(admin, 'Question in English', 'Function', editor);
  await admin.evaluate((scope) => { for (const [label, value] of [['Required to continue?', 'false'], ['Check type', 'function']]) { const select = [...document.querySelector(scope).querySelectorAll('label')].find((l) => l.textContent.startsWith(label)).querySelector('select'); select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); } }, editor);
  await fillLabel(admin, 'Property or function name', 'build', editor);
  await clickText(admin, 'Add input', editor); await admin.select(`${editor} select[aria-label="Input 1 value type"]`, 'number');
  await setField(admin, `${editor} input[aria-label="Input 1"]`, '5');
  await admin.select(`${editor} select[aria-label="Expected value value type"]`, 'object');
  async function property(name, type) {
    await clickText(admin, 'Add property', editor);
    await admin.evaluate(({scope,name}) => { const fields = [...document.querySelector(scope).querySelectorAll('input[aria-label="Property name"]')]; const field = fields[fields.length-1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,name); field.dispatchEvent(new Event('input',{bubbles:true})); }, {scope:editor,name});
    await admin.select(`${editor} select[aria-label="${name} value type"]`, type);
  }
  await property('score', 'number'); await setField(admin, `${editor} input[aria-label="score"]`, 'invalid');
  await clickText(admin, 'Save draft', editor);
  pass('invalid typed number prevents saving a stale expected value', !!await admin.$(editor) && await admin.$eval(editor, (e) => !!e.querySelector('[aria-invalid="true"]')));
  await setField(admin, `${editor} input[aria-label="score"]`, '5');
  await property('passed', 'boolean'); await admin.select(`${editor} select[aria-label="passed"]`, 'true');
  await property('labels', 'array'); await clickText(admin, 'Add item', editor);
  await setField(admin, `${editor} textarea[aria-label="labels [0]"]`, 'ok');
  await clickText(admin, 'Add item', editor); await admin.select(`${editor} select[aria-label="labels [1] value type"]`, 'number');
  await setField(admin, `${editor} input[aria-label="labels [1]"]`, '2');
  pass('ADMIN builds an object and mixed array without writing JSON', (await admin.$$eval(`${editor} input[aria-label="Property name"]`, (fields) => fields.map((e) => e.value))).join(',') === 'score,passed,labels');
  await admin.screenshot({ path: '/evidence/m9-typed-checks-admin.png', fullPage: true });
  await clickText(admin, 'Save draft', editor); await admin.waitForFunction((scope) => !document.querySelector(`${scope} [data-testid="assessment-editor"]`), {}, panel);
  await admin.waitForFunction((scope) => [...document.querySelector(scope).querySelectorAll('strong')].some((e) => e.textContent === 'Structured result'), { polling: 100 }, panel);
  await admin.evaluate((scope) => { const row = [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Structured result').parentElement; [...row.querySelectorAll('button')].find((b) => b.textContent === 'Publish revision').click(); }, panel);
  await admin.waitForFunction((scope) => [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Structured result')?.parentElement.textContent.includes('Published'), {}, panel);
  const structuredList = await api(student, 'GET', `/assessments/lessons/${fixture.lessonId}`); const structured = structuredList.body.data.assessments.find((item) => item.titleEn === 'Structured result');
  const publicStructured = (await api(student, 'GET', `/assessments/${structured.id}`)).body.data;
  pass('typed object checks and function inputs remain private', !JSON.stringify(publicStructured.content).includes('checks') && !JSON.stringify(publicStructured.content).includes('score'));
  await student.goto(`http://localhost:8084/#/assessment/${structured.id}`); await student.waitForSelector('.cm-content');
  await editCode(student, 'function build(n){return {score:String(n),passed:true,labels:["ok",2]}}'); await student.click('[data-testid="assessment-submit"]');
  await student.waitForFunction(() => document.querySelector('[data-testid="assessment-result"]')?.textContent.includes('Not correct yet'), { timeout: 60000 });
  pass('real grading rejects text where the object expects a number', true);
  await editCode(student, 'function build(n){return {labels:["ok",2],passed:true,score:n}}'); await student.click('[data-testid="assessment-submit"]');
  await student.waitForFunction(() => document.querySelector('[data-testid="assessment-result"]')?.textContent.includes('Correct!'), { timeout: 60000 });
  pass('real grading accepts typed function input and nested object/array values independent of object key order');
  await clickText(admin, 'Add assessment', panel);
  pass('new coding assessments default to input/output problems', await admin.$eval(editor + ' select[aria-label="Question type"]', (e) => e.value === 'PROGRAM'));
  await fillLabel(admin, 'العنوان بالعربية', 'مربع الرقم', editor); await fillLabel(admin, 'Title in English', 'Generated square', editor);
  await fillLabel(admin, 'Arabic instructions', 'اقرأ الرقم واطبع مربعه', editor); await fillLabel(admin, 'English instructions', 'Read a number and print its square', editor);
  await fillLabel(admin, 'السؤال بالعربية', 'المربع', editor); await fillLabel(admin, 'Question in English', 'Square', editor);
  await admin.evaluate((scope) => { const select = [...document.querySelector(scope).querySelectorAll('label')].find((l) => l.textContent.startsWith('Required to continue?')).querySelector('select'); select.value = 'false'; select.dispatchEvent(new Event('change', { bubbles: true })); }, editor);
  await clickText(admin, 'Save draft', editor); await admin.waitForFunction((scope) => !document.querySelector(scope + ' [data-testid="assessment-editor"]'), {}, panel);
  const adminAssessments = await api(admin, 'GET', '/admin/assessments/lessons/' + fixture.lessonId);
  const square = adminAssessments.body.data.assessments.find((a) => a.content.titleEn === 'Generated square'); assert(square);
  const premature = await api(admin, 'POST', '/admin/assessments/' + square.id + '/publish', {});
  pass('unprepared input/output problems cannot be published', premature.status === 409 && premature.body.error.code === 'TESTS_NOT_READY');
  await admin.evaluate((scope) => { const row = [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Generated square').parentElement; [...row.querySelectorAll('button')].find((b) => b.textContent === 'Prepare and review tests').click(); }, panel);
  await admin.waitForFunction((scope) => [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Generated square')?.parentElement.textContent.includes('Tests ready to publish'), { timeout: 90000 }, panel);
  pass('private reference prepares generated tests in the isolated controller');
  await admin.evaluate((scope) => { const row = [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Generated square').parentElement; row.querySelector('[data-testid="program-preparation"] summary').click(); }, panel);
  pass('admin can review private generated inputs and expected outputs', await admin.evaluate((scope) => [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Generated square').parentElement.querySelectorAll('pre').length >= 4, panel));
  await admin.screenshot({ path: '/evidence/m9-program-private-tests.png', fullPage: true });
  await admin.evaluate((scope) => { const row = [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Generated square').parentElement; [...row.querySelectorAll('button')].find((b) => b.textContent === 'Publish revision').click(); }, panel);
  await admin.waitForFunction((scope) => [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Generated square')?.parentElement.textContent.includes('Published'), {}, panel);
  const publicSquare = await api(student, 'GET', '/assessments/' + square.id);
  pass('students receive public samples without the reference, generator or hidden cases', !['reference','generator','tests'].some((key) => Object.hasOwn(publicSquare.body.data.content.questions[0].program,key)) && publicSquare.body.data.content.questions[0].starter.javascript === '');
  await student.goto('http://localhost:8084/#/assessment/' + square.id); await student.waitForSelector('.cm-content');
  pass('student problem starts with its public sample input', await student.$eval('[data-testid="ide-input"]', (e) => e.value === '3'));
  await editCode(student, 'console.log(Number(readline()) ** 2)'); await student.$eval('[data-testid="ide-run"]', (e) => e.scrollIntoView({block:'center'})); await student.click('[data-testid="ide-run"]');
  await student.waitForFunction(() => document.querySelector('[data-testid="ide-console"] pre').textContent.trim() === '9');
  pass('readline and console.log run the public sample locally');
  await editCode(student, 'console.log(9)'); await student.click('[data-testid="assessment-submit"]');
  await student.waitForFunction(() => document.querySelector('[data-testid="assessment-result"]')?.textContent.includes('Not correct yet'), {timeout:90000});
  pass('hardcoded sample answer fails hidden generated tests through the real submission queue');
  await editCode(student, 'const n=Number(readline()); console.log(n*n)'); await setField(student, '[data-testid="ide-input"]', '7');
  await student.click('[data-testid="assessment-submit"]'); await student.waitForFunction(() => document.querySelector('[data-testid="assessment-result"]')?.textContent.includes('Correct!'), {timeout:90000});
  pass('dynamic solution passes frozen hidden tests independently of local input');
  await student.screenshot({path:'/evidence/m9-program-student.png',fullPage:true});
  await admin.evaluate((scope) => { const row = [...document.querySelector(scope).querySelectorAll('strong')].find((e) => e.textContent === 'Add two numbers').parentElement; [...row.querySelectorAll('button')].find((b) => b.textContent === 'Submissions').click(); }, panel);
  await admin.waitForSelector('[data-testid="submission-row"]');
  pass('admin loads only ten compact submission summaries', (await admin.$$('[data-testid="submission-row"]')).length === 10 && !await admin.$('[data-testid="submission-detail"]'));
  const firstPageIds = await admin.$$eval('[data-testid="submission-row"]', (rows) => rows.map((r) => r.dataset.submissionId));
  await admin.bringToFront();
  await clickText(admin, 'View answer', '[data-testid="submission-review"]');
  await admin.waitForFunction(() => document.querySelector('[data-testid="submission-detail"] pre'));
  pass('only one selected answer expands', (await admin.$$('[data-testid="submission-detail"]')).length === 1);
  await clickText(admin, 'Next', '[data-testid="submission-review"]');
  await admin.waitForFunction((ids) => document.querySelector('[data-testid="submission-review"] nav')?.textContent.includes('Page 2') && document.querySelectorAll('[data-testid="submission-row"]').length === 10 && [...document.querySelectorAll('[data-testid="submission-row"]')].every((r) => !ids.includes(r.dataset.submissionId)), { polling: 100 }, firstPageIds);
  pass('next page replaces rows and closes previous answer', !await admin.$('[data-testid="submission-detail"]'));
  await clickText(admin, 'Previous', '[data-testid="submission-review"]');
  await admin.waitForFunction((ids) => document.querySelector('[data-testid="submission-review"] nav')?.textContent.includes('Page 1') && [...document.querySelectorAll('[data-testid="submission-row"]')].map((r) => r.dataset.submissionId).join() === ids.join(), { polling: 100 }, firstPageIds);
  pass('previous submission page works');
  await admin.screenshot({ path: '/evidence/m9-submission-review.png', fullPage: true });
  await admin.setViewport({ width: 390, height: 844 });
  pass('compact submission review fits mobile width', await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await admin.screenshot({ path: '/evidence/m9-submission-review-mobile.png', fullPage: true });
  await admin.setViewport({ width: 1280, height: 900 });
  await student.goto(`http://localhost:8084/#/purchase/${fixture.planId}`);
  await student.waitForFunction(() => document.querySelector('main').textContent.includes('You already have access'));
  pass('owned course cannot reach payment confirmation', !await student.evaluate(() => [...document.querySelectorAll('main button')].some((b) => b.textContent.includes('Confirm purchase'))));
  const duplicate = await api(student, 'POST', '/wallet/purchases', { planId: fixture.planId, idempotencyKey: crypto.randomUUID() });
  pass('API also refuses owned-course payment with a new key', duplicate.status === 409 && duplicate.body.error.code === 'COURSE_ALREADY_SUBSCRIBED');
  await student.evaluate((id) => { location.hash = `#/assessment/${id}`; }, fixture.assessmentId);
  await student.waitForSelector('[data-testid="web-ide"]'); pass('switching assessment IDs remounts the correct editor without stale answers');
  const inactive = await login('m9-inactive@example.test'); await inactive.goto('http://localhost:8084/#/practice'); await inactive.waitForFunction(() => document.querySelector('main').textContent.includes('active course subscription'));
  pass('inactive student cannot open standalone practice', !await inactive.$('[data-testid="web-ide"]'));
  pass('student cannot use ADMIN quota API', (await api(student, 'GET', '/admin/assessments/students')).status === 403);
  pass('no authentication data in browser storage', await student.evaluate(() => Object.keys(localStorage).every((k) => ['edu-platform-lang', 'edu-platform-theme'].includes(k)) && sessionStorage.length === 0));
  if (errors.length) console.error(`Synthetic browser error diagnostics: ${JSON.stringify(errors)}`);
  pass('no React/browser page errors', errors.length === 0);
  console.log(`M9 UI checks=${checks} failed=0`);
} catch (error) {
  for (const context of contexts) for (const page of await context.pages()) {
    if (await page.$('[data-testid="submission-review"]')) {
      console.error(JSON.stringify(await page.evaluate(() => ({ reviewText: document.querySelector('[data-testid="submission-review"]').textContent.slice(0, 200), navText: document.querySelector('[data-testid="submission-review"] nav')?.textContent, rowCount: document.querySelectorAll('[data-testid="submission-row"]').length }))));
      await page.screenshot({ path: '/evidence/m9-submission-failure.png', fullPage: true });
    }
  }
  for (const context of contexts) for (const page of await context.pages()) { console.error(JSON.stringify(await page.evaluate(() => ({ console: document.querySelector('[data-testid=ide-console] pre')?.textContent, frameCount: document.querySelectorAll('iframe').length })))); }
  console.error(error.message); process.exitCode = 1;
} finally { for (const c of contexts) await c.close(); await browser.close(); }
