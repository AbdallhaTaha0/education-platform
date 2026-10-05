/** Real assessment saves and validation with disposable course/admin fixtures. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const fixture = JSON.parse(readFileSync('/evidence/fixtures.json', 'utf8'));
const host = (await lookup('nginx')).address;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${host}`] });
let checks = 0;
const pass = (name, ok = true) => { assert(ok, name); checks++; console.log(`PASS ${name}`); };
try {
  const page = await browser.newPage(); const errors = []; const writes = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => void d.accept());
  page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/api/admin/assessments/lessons/')) writes.push(r); });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.evaluateOnNewDocument(() => { if (window === window.top) localStorage.setItem('edu-platform-lang', 'en'); });
  await page.goto('http://localhost:8080/#/login', { waitUntil: 'networkidle2' });
  await page.type('#login-id', 'modes-admin@example.test'); await page.type('#login-password', 'synthetic modes password only'); await page.click('form button[type=submit]'); await page.waitForFunction(() => location.hash === '#/account');
  await page.goto(`http://localhost:8080/#/admin/courses/${fixture.courseId}`, { waitUntil: 'networkidle2' });
  const scope = `[data-testid=assessment-admin-${fixture.lessonId}]`; const editor = '[data-testid=assessment-editor]';
  async function button(root, label) {
    await page.waitForSelector(root);
    await page.evaluate(({ root, label }) => { const b = [...document.querySelector(root).querySelectorAll('button')].find(b => b.querySelector('span')?.textContent.trim() === label || b.textContent.trim() === label); if (!b) throw Error(`Missing ${label}`); b.setAttribute('data-save-test-click', 'active'); b.scrollIntoView({ block: 'center' }); }, { root, label });
    await page.click('[data-save-test-click=active]'); await page.evaluate(() => document.querySelectorAll('[data-save-test-click]').forEach(e => e.removeAttribute('data-save-test-click')));
  }
  await page.waitForSelector('#course-workspace-tab-assessments'); await page.$eval('#course-workspace-tab-assessments',e=>e.scrollIntoView({block:'center'})); await page.click('#course-workspace-tab-assessments'); await page.waitForSelector(`${scope} [data-testid=ide-mode-javascript]`);
  for (const [lang, choice] of [['en', 'false'], ['ar', 'true']]) {
    await button(scope, 'Add assessment'); await page.waitForSelector(`${editor} .cm-content`);
    if (lang === 'ar') await page.click(`${editor} button[aria-label="التبديل إلى العربية"]`);
    const question = `${editor} [data-admin-question="1"]`;
    const typeSelect = await page.evaluate(question => { const select = [...document.querySelector(question).querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'CHOICE')); select.setAttribute('data-save-test-type', 'true'); return '[data-save-test-type]'; }, question);
    await page.select(typeSelect, 'CHOICE');
    await page.waitForSelector(`${question} input[name^=correct-]`);
    const inputs = await page.$$(`${editor} input:not([type=radio]):not([type=checkbox])`);
    for (let i = 0; i < inputs.length; i++) { await inputs[i].evaluate(e => e.scrollIntoView({ block: 'center' })); await inputs[i].type(`Assessment ${lang} field ${i}`); }
    for (const area of await page.$$(`${editor} textarea`)) { await area.evaluate(e => e.scrollIntoView({ block: 'center' })); await area.type(`Assessment instructions ${lang}`); }
    await page.$eval(`${question} input[name^=correct-]`, e => { e.scrollIntoView({ block: 'center' }); e.click(); });
    const requirement = `${editor} [data-testid=assessment-requirement]`;
    pass(`${lang} presents Required and Optional with no silent default`, await page.$$eval(`${requirement} input[type=radio]`, els => els.length === 2 && els.every(e => !e.checked)));
    const beforeWrites = writes.length;
    await button(editor, lang === 'ar' ? 'حفظ مسودة' : 'Save draft'); await page.waitForSelector(`${requirement} [data-testid=admin-field-error]`);
    pass(`${lang} missing choice stays local and preserves entered values`, writes.length === beforeWrites && await page.$eval(`${editor} input:not([type=radio]):not([type=checkbox])`, e => !!e.value));
    pass(`${lang} shows one specific inline warning without a generic toast`, await page.$$eval(`${requirement} [data-testid=admin-field-error]`, (els, lang) => els.length === 1 && els[0].textContent.includes(lang === 'ar' ? 'اختر مطلوب أو اختياري' : 'Choose Required or Optional'), lang) && await page.$('[data-testid=error-feedback-stack]') === null);
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'assessment-required-true'); pass(`${lang} focuses the unanswered choice`);
    await page.$eval(`${requirement} [data-testid=assessment-required-${choice}]`, e => { e.scrollIntoView({ block: 'center' }); e.click(); });
    await page.waitForFunction(() => !document.querySelector('[data-testid=admin-field-error]'));
    const saved = page.waitForResponse(r => r.url().endsWith(`/api/admin/assessments/lessons/${fixture.lessonId}`) && r.request().method() === 'POST');
    await button(editor, lang === 'ar' ? 'حفظ مسودة' : 'Save draft'); const response = await saved; assert.equal(response.status(), 201); const body = await response.json();
    pass(`${lang} saves the explicitly selected ${choice === 'true' ? 'Required' : 'Optional'} policy on the real server`, body.data.required === (choice === 'true'));
    await page.waitForFunction(() => !document.querySelector('[data-testid=assessment-editor]'));
    await page.screenshot({ path: `/evidence/assessment-save-${lang}.png`, fullPage: true });
  }
  pass('assessment editor has no runtime errors', errors.length === 0);
  console.log(`Assessment save PASS checks=${checks}`);
} finally { await browser.close(); }
