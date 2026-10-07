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
  const adminContext = await browser.createBrowserContext();
  const page = await adminContext.newPage(); await intercept(page);
  await page.evaluateOnNewDocument(() => { localStorage.setItem('edu-platform-lang', 'en'); localStorage.setItem('edu-platform-theme', 'light'); });
  await login(page, seed.adminEmail, seed.adminPassword);
  await workspace(page);
  await record('Real roster pages 20+5, zero activity and actual lesson pages 20+3', async () => {
    assert.equal(await page.$$eval('[data-testid="roster-list"] > li', nodes => nodes.length), 20);
    await click(page, '[data-testid="roster-next"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="roster-list"] > li').length === 5);
    await click(page, '[data-testid="roster-previous"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="roster-list"] > li').length === 20);
    await select(page, seed.studentId);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="views-list"] > li').length === 20);
    await click(page, '[data-testid="views-next"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="views-list"] > li').length === 3);
    await click(page, '[data-testid="views-previous"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="views-list"] > li').length === 20);
  });
  await record('Real 7/14/28-day reports, weekly composition and assessment outcomes', async () => {
    for (const type of ['WEEK', 'TWO_WEEKS', 'FOUR_WEEKS']) {
      const result = await preview(page, type);
      const text = result.parts.map(p => p.text).join('\n');
      assert.ok(text.includes('October course'));
      assert.ok(text.includes('passed'));
      assert.ok(text.includes('service error'));
      assert.ok(!/total views|view count|playbackToken|nationalId/i.test(text));
      for (let week = 1; week <= { WEEK: 1, TWO_WEEKS: 2, FOUR_WEEKS: 4 }[type]; week++) assert.ok(text.includes(`Week ${week}/`));
    }
  });
  await record('Combined report uses two actual memberships, includes zero-activity current videos', async () => {
    await click(page, `[data-testid="report-course-${seed.otherCourseId}"]`);
    const result = await preview(page);
    assert.equal(result.courseIds.length, 2);
    const text = result.parts.map(p => p.text).join('\n');
    assert.ok(text.includes('November course') && text.includes('October course'));
    assert.ok(text.includes('not viewed'));
    await click(page, `[data-testid="report-course-${seed.otherCourseId}"]`);
  });
  await record('Real registered recipient/encoded part and immediate platform disposal', async () => {
    const result = await preview(page);
    const before = wa.length;
    await click(page, '[data-testid="open-part-1"]');
    for (let attempt = 0; attempt < 100 && wa.length === before; attempt++) await delay(50);
    assert.equal(wa.length, before + 1);
    const url = new URL(wa.at(-1));
    assert.equal(url.pathname, '/201001234567');
    assert.equal(url.searchParams.get('text'), result.parts[0].text);
    await page.waitForFunction(() => !document.querySelector('[data-testid="report-text-1"]'));
    assert.ok(await page.$('[data-testid="report-text-2"]'), 'unhanded parts stay transient');
    await click(page, '[data-testid="dispose-report"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid^="report-text-"]'));
  });
  await record('Missing guardian still permits preview, sending is disabled with reason', async () => {
    await select(page, seed.quietId);
    const result = await preview(page);
    assert.equal(result.guardian.phone, null);
    assert.equal(await page.$eval('[data-testid="open-part-1"]', node => node.disabled), true);
    assert.ok((await page.$eval('[data-testid="report-text-1"]', node => node.textContent)).length > 0);
    await select(page, seed.studentId);
  });
  await record('Actual contact change blocks manual fallback and erases old report', async () => {
    await preview(page);
    await fetch(`${BASE}/__m10/contact/change`);
    const before = wa.length;
    await click(page, '[data-testid="manual-open-part-1"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid^="report-text-"]'));
    assert.equal(wa.length, before);
    await fetch(`${BASE}/__m10/contact/restore`);
  });
  await record('Real player -> real telemetry -> admin counts: 31s=one, 42s still one, refresh=second', async () => {
    const studentContext = await browser.createBrowserContext();
    const learner = await studentContext.newPage(); await intercept(learner);
    await login(learner, seed.studentEmail, seed.studentPassword);
    async function start() {
      await learner.goto(`${BASE}/__m10/player`);
      const grantResponse = await api(learner, `/learning/courses/${seed.courseSlug}/lessons/${seed.lessonId}/playback`, { deviceId: 'm10-integrated-browser-device' });
      assert.equal(grantResponse.status, 201);
      const grant = grantResponse.data.data.playback;
      await learner.addScriptTag({ url: `${BASE}/player-fixture.js` });
      await learner.evaluate((grant, course, lesson) => window.__mountIntegrationPlayer(grant, course, lesson), grant, seed.courseSlug, seed.lessonId);
      await learner.waitForFunction(() => { const v = document.querySelector('video'); return v && !v.paused && v.readyState >= 2; });
      return grant;
    }
    const grant = await start();
    await delay(31000);
    await learner.evaluate(() => document.querySelector('video').pause());
    await delay(300);
    let roster = await api(page, `/admin/courses/${seed.courseId}/students?q=00%20Active`);
    assert.equal(roster.data.data.students[0].totalViews, 1);
    await learner.evaluate(() => document.querySelector('video').play());
    await delay(11000);
    await learner.evaluate(() => document.querySelector('video').pause()); await delay(300);
    roster = await api(page, `/admin/courses/${seed.courseId}/students?q=00%20Active`);
    assert.equal(roster.data.data.students[0].totalViews, 1);
    await learner.evaluate(() => window.__unmountIntegrationPlayer());
    assert.equal((await api(learner, `/learning/playback/${grant.referenceId}/end`, {})).status, 200);
    await start(); await delay(31000);
    await learner.evaluate(() => document.querySelector('video').pause()); await delay(300);
    roster = await api(page, `/admin/courses/${seed.courseId}/students?q=00%20Active`);
    assert.equal(roster.data.data.students[0].totalViews, 2);
    const views = await api(page, `/admin/courses/${seed.courseId}/students/${seed.studentId}/views`);
    assert.equal(views.data.data.lessons.find(l => l.lessonId === seed.lessonId).totalViews, 2);
    await studentContext.close();
  });
  await record('Arabic/English, RTL/LTR, both themes and mobile layouts against real API', async () => {
    for (const [lang, theme, mobile] of [['ar','dark',false], ['en','dark',true], ['ar','light',true]]) {
      const context = await browser.createBrowserContext(); const screen = await context.newPage(); await intercept(screen);
      await screen.setViewport({ width: mobile ? 390 : 1280, height: 900, isMobile: mobile, hasTouch: mobile });
      await screen.evaluateOnNewDocument((lang, theme) => { localStorage.setItem('edu-platform-lang', lang); localStorage.setItem('edu-platform-theme', theme); }, lang, theme);
      await login(screen, seed.adminEmail, seed.adminPassword); await workspace(screen); await select(screen, seed.studentId);
      const report = await preview(screen);
      assert.ok(report.parts[0].text.includes(lang === 'ar' ? 'ولي الأمر' : 'Parent Report'));
      assert.equal(await screen.$eval('html', node => node.dir), lang === 'ar' ? 'rtl' : 'ltr');
      assert.equal(await screen.$eval('html', node => node.dataset.theme), theme);
      assert.equal(await screen.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), true, 'no horizontal overflow');
      await screen.screenshot({ path: `/evidence/${lang}-${theme}-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: false, waitForFonts: false });
      const storage = await screen.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
      assert.ok(storage.local.every(key => ['edu-platform-lang', 'edu-platform-theme'].includes(key)));
      assert.ok(storage.session.every(key => !/report|parent|guardian|token|text/i.test(key)));
      await context.close();
    }
  });
  await record('Navigation clears report state; no browser credential/report storage', async () => {
    await preview(page); await page.goto(`${BASE}/#/account`); await workspace(page); await select(page, seed.studentId);
    assert.equal(await page.$('[data-testid^="report-text-"]'), null);
    const storage = await page.evaluate(() => ({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }));
    assert.ok(storage.local.every(([key]) => ['edu-platform-lang','edu-platform-theme'].includes(key)));
    assert.ok(!JSON.stringify(storage).includes('Parent Report'));
  });
  assert.deepEqual(pageErrors, []);
  await writeFile('/evidence/integrated-result.json', JSON.stringify({ checks, whatsappNavigationsAborted: wa.length, pageErrors, boundary: 'Actual React UI, Express APIs and PG/Redis. Native video + DASH transport fixture and DRM API fixture; no external DRM security or WhatsApp send/delivery claim.' }, null, 2));
} catch (error) {
  await writeFile('/evidence/failure.txt', String(error.stack ?? error));
  throw error;
} finally {
  let closed = false;
  await Promise.race([browser.close().then(() => { closed = true; }), delay(5000)]);
  if (!closed) browser.process()?.kill('SIGKILL');
  await fetch(`${BASE}/__m10/finish`).catch(() => {});
}
