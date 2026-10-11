import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { lookup } from 'node:dns/promises';
const gateway = (await lookup('nginx')).address;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${gateway}`] });
const origin = 'http://localhost:8080', quiz = '11000000-0000-4000-8000-000000000004', lesson = '11000000-0000-4000-8000-000000000002';
let checks = 0; const errors = [];
const pass = (label, value) => { assert(value, label); console.log(`PASS ${label}`); checks++; };
async function login(role) {
  const context = await browser.createBrowserContext(), page = await context.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on('pageerror', () => errors.push('pageerror'));
  await page.evaluateOnNewDocument(() => localStorage.setItem('edu-platform-lang', 'en'));
  await page.goto(`${origin}/#/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#login-id');
  const english = await page.$('button[aria-label="EN — Switch to English"]');
  if (english) await english.click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.type('#login-id', `ide-off-${role}@example.test`); await page.type('#login-password', 'synthetic IDE disabled password');
  const response = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
  await page.$eval('form button[type=submit]', b => b.scrollIntoView({ block: 'center' }));
  await page.click('form button[type=submit]');
  const loginResult = await response;
  if (loginResult.status() !== 200) { const body = await loginResult.json(); throw Error(`Synthetic login failed status=${loginResult.status()} code=${body.error?.code ?? 'unknown'}`); }
  await page.waitForFunction(() => location.hash === '#/account');
  await page.waitForNetworkIdle(); return page;
}
async function clickText(page, text, scope = 'main') {
  const clicked = await page.$eval(scope, (root, text) => { const button = [...root.querySelectorAll('button')].find(b => b.textContent.trim() === text); button?.click(); return !!button; }, text);
  assert(clicked, `button ${text}`);
}
async function route(page, hash) {
  await page.evaluate(hash => { location.hash = hash; }, hash);
  await page.waitForFunction(hash => location.hash === hash, {}, hash);
  await page.waitForNetworkIdle();
}
try {
  const student = await login('student');
  pass('no student IDE entry points', await student.$$eval('a[href="#/practice"]', a => a.length === 0));
  await route(student, '#/practice');
  pass('direct practice route is disabled without loading an editor', await student.evaluate(() => document.querySelector('main')?.textContent.includes('temporarily disabled') && !document.querySelector('[data-testid="web-ide"]')));
  await route(student, `#/assessment/${quiz}`);
  await student.waitForSelector('input[type=radio][value=a]');
  pass('choice quiz has no editor or code-running instructions', await student.evaluate(() => !document.querySelector('[data-testid="web-ide"]') && !document.querySelector('main').textContent.includes('Run is for')));
  await student.click('input[type=radio][value=a]'); await clickText(student, 'Submit answer');
  await student.waitForFunction(() => document.querySelector('[data-testid="assessment-result"]')?.textContent.includes('Not correct yet'));
  pass('wrong answer feedback works with no grading service', true);
  await student.click('input[type=radio][value=b]'); await clickText(student, 'Submit answer');
  await student.waitForFunction(() => location.hash.startsWith('#/learn/'));
  pass('correct retry returns to learning', true);
  const list = await student.evaluate(async lesson => (await (await fetch(`/api/assessments/lessons/${lesson}`)).json()).data.assessments, lesson);
  pass('choice quiz stays visible across IDE modes and coding is hidden', list.length === 1 && list[0].id === quiz && list[0].passed);
  const admin = await login('admin');
  pass('no admin IDE/allowance links', await admin.$$eval('a[href="#/admin/practice"]', a => a.length === 0));
  await route(admin, '#/admin/practice');
  pass('direct admin practice route shows disabled notice', await admin.evaluate(() => document.querySelector('main')?.textContent.includes('temporarily disabled')));
  await route(admin, '#/admin/courses/11000000-0000-4000-8000-000000000006');
  // Course workspace uses named tabs and collapsed lesson panels.
  await admin.evaluate(() => { for (const d of document.querySelectorAll('details')) d.open = true; });
  const tab = await admin.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Assessments'); b?.click(); return !!b; });
  if (tab) await admin.waitForNetworkIdle();
  const panel = '[data-testid="assessment-admin-11000000-0000-4000-8000-000000000007"]';
  await admin.waitForSelector(panel);
  if (!await admin.$(`${panel} button`)) throw Error('Assessment panel missing');
  if (!await admin.$(`${panel} [data-testid="assessment-editor"]`)) {
    const add = await admin.$eval(panel, p => [...p.querySelectorAll('button')].some(b => b.textContent.trim() === 'Add assessment'));
    if (!add) await clickText(admin, 'Assignments and quizzes', panel);
    await clickText(admin, 'Add assessment', panel);
  }
  await admin.waitForSelector('[data-testid="assessment-editor"]');
  pass('new admin assessment starts as multiple choice', await admin.$eval('[data-testid="assessment-editor"]', e => [...e.querySelectorAll('select')].some(s => s.value === 'CHOICE' && s.options.length === 1)));
  pass('admin has no coding editor or test preparation controls', await admin.$eval('[data-testid="assessment-editor"]', e => !e.querySelector('[data-testid="web-ide"]') && !e.textContent.includes('Prepare tests')));
  pass('no browser runtime errors', errors.length === 0);
  console.log(`IDE disabled browser checks=${checks} failed=0`);
} finally { await browser.close(); }
