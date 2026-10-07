/** Real UI -> actual Express/Prisma/PG/Redis. All identities synthetic.
 * Outbound WhatsApp requests are aborted; sending/delivery is never tested. */
import puppeteer from '/srv/browser/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.BASE_URL ?? 'http://web:8080';
await mkdir('/evidence', { recursive: true });
const seed = await fetch(`${BASE}/__m10/seed`).then(r => r.json());
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', protocolTimeout: 20000, headless: true, args: ['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required','--mute-audio'] });
const checks = [];
const wa = [];
const pageErrors = [];
const intercepted = new WeakSet();
const delay = ms => new Promise(r => setTimeout(r, ms));
async function intercept(page) {
  if (intercepted.has(page)) return;
  intercepted.add(page);
  const originalWait = page.waitForFunction.bind(page);
  page.waitForFunction = (fn, options = {}, ...args) => originalWait(fn, { polling: 100, ...options }, ...args);
  await page.exposeFunction('__m10CaptureHandoff', url => { wa.push(url); });
  await page.evaluateOnNewDocument(() => {
    const actualOpen = window.open.bind(window);
    window.open = (...args) => {
      const actual = { closed: false, opener: null, close() { this.closed = true; } };
      if (!actual) return null;
      // Test-only transport boundary: replace only the external popup transport but
      // capture navigation before contacting external WhatsApp.
      return {
        get closed() { return actual.closed; },
        close() { actual.close(); },
        set opener(value) { actual.opener = value; },
        location: { set href(url) { void window.__m10CaptureHandoff(url); actual.close(); } },
      };
    };
  });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (new URL(req.url()).hostname === 'wa.me') { wa.push(req.url()); void req.abort().catch(() => {}); }
    else void req.continue().catch(() => {});
  });
  page.on('pageerror', err => { pageErrors.push(err.message); console.log('PAGEERROR',err.message); });
  page.on('requestfailed', req => console.log('REQUESTFAIL',req.url(),req.failure()?.errorText));
  page.on('response', res => { if(res.url().includes('/api/')) console.log('API',res.status(),res.url()); });
}
browser.on('targetcreated', async target => { if (target.type() === 'page') { const page = await target.page(); if (page) await intercept(page).catch(() => {}); } });
async function click(page, selector) { await page.bringToFront();
  await page.waitForSelector(selector, { timeout: 20000 });
  await page.$eval(selector, element => element.scrollIntoView({ block: 'center' }));
  await delay(80);
  await page.click(selector); await page.bringToFront();
}
async function api(page, path, body) {
  return page.evaluate(async (path, body) => {
    const csrf = decodeURIComponent(document.cookie.match(/(?:^|;\s*)edu_csrf=([^;]+)/)?.[1] ?? '');
    const response = await fetch(`/api${path}`, { credentials: 'include', method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Csrf-Token': csrf }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
  }, path, body);
}
async function login(page, email, password) {
  await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded' });
  await api(page, '/auth/csrf');
  const result = await api(page, '/auth/login', { identifier: email, password });
  assert.equal(result.status, 200, 'real cookie login');
  await page.reload({ waitUntil: 'domcontentloaded' });
}
async function workspace(page) {
  await page.goto(`${BASE}/#/admin/courses/${seed.courseId}`, { waitUntil: 'domcontentloaded' });
  await click(page, '#course-workspace-tab-students');
  await page.waitForSelector('[data-testid="roster-list"]');
}
async function select(page, id) {
  await click(page, `[data-testid="select-student-${id}"]`);
  await page.waitForSelector('[data-testid="report-course-picker"]');
  await page.waitForSelector(`[data-testid="report-course-${seed.courseId}"]`);
}
async function preview(page, type = 'WEEK') {
  await click(page, `[data-testid="report-type-${type}"]`);
  const pending = page.waitForResponse(r => r.url().endsWith('/api/admin/parent-reports/generate') && r.request().method() === 'POST');
  await click(page, '[data-testid="generate-report"]');
  const response = await pending;
  assert.equal(response.status(), 200);
  assert.equal(response.headers()['cache-control'], 'no-store');
  const result = (await response.json()).data;
  await page.waitForSelector('[data-testid="report-text-1"]');
  assert.equal((Date.parse(result.period.end) - Date.parse(result.period.start)) / 86400000, { WEEK: 7, TWO_WEEKS: 14, FOUR_WEEKS: 28 }[type]);
  assert.ok(result.parts.every((p, i) => p.index === i + 1 && p.total === result.parts.length && p.text.length <= 1000 && `https://wa.me/201001234567?text=${encodeURIComponent(p.text)}`.length <= 4000));
  return result;
}
async function record(name, task) { await task(); checks.push(name); console.log(`PASS ${name}`); }

try {
 const context = await browser.createBrowserContext(); const page = await context.newPage(); await intercept(page);
 await page.evaluateOnNewDocument(() => { localStorage.setItem('edu-platform-lang','en'); });
 await login(page, seed.adminEmail, seed.adminPassword); await workspace(page); await select(page, seed.studentId);
 await page.evaluate(() => { window.open = () => null; });
 await click(page, '[data-testid="generate-and-open-whatsapp"]');
 await delay(800);
 const note = await page.$eval('[data-testid="error-feedback-stack"]', node => node.textContent);
 console.log('BLOCKED_NOTE', note);
 assert.ok(note.includes('blocked'));
 assert.ok(await page.$('[data-testid="report-text-1"]'));
 assert.equal(wa.length,0);
 await click(page, '[data-testid="dispose-report"]');
 assert.equal(await page.$('[data-testid^="report-text-"]'),null);
 await writeFile('/evidence/blocked-result.json',JSON.stringify({passed:true,scenario:'Real API generation, deterministic blocked-popup adapter, fallback and disposal'},null,2));
} finally {
 await Promise.race([browser.close(),delay(5000)]); browser.process()?.kill('SIGKILL');
 await fetch(`${BASE}/__m10/finish`).catch(()=>{});
}
