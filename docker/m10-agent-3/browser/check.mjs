/**
 * M10 agent 3 — real-browser verification of the ADMIN Students & Parent
 * Reports workspace (TEST-ONLY, disposable).
 *
 * Runs system Chromium against the disposable synthetic ADMIN fixture. Every
 * WhatsApp navigation is intercepted inside the browser and aborted before it
 * can leave the container: no message is ever sent, and nothing in this
 * repository claims WhatsApp delivery.
 */
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://web:8080';
const EVIDENCE = process.env.EVIDENCE_DIR ?? '/evidence';
const COURSE = 'course-m10a3';
const OTHER_COURSE = 'course-m10a3-b';
const results = [];
const waNavigations = [];
const generateRequests = [];

await mkdir(EVIDENCE, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  protocolTimeout: 240000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server'],
});

/** Abort any WhatsApp navigation before it leaves the browser and record it. */
const intercepted = new WeakSet();
async function intercept(page) {
  if (intercepted.has(page)) return;
  intercepted.add(page);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (/^https:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\//.test(url)) {
      waNavigations.push({ url });
      void request.respond({ status: 204 }).catch(() => {});
      return;
    }
    void request.continue().catch(() => {});
  });
}

// One global handler covers every popup the app reserves for a handoff.
browser.on('targetcreated', async target => {
  if (target.type() !== 'page') return;
  const popup = await target.page().catch(() => null);
  if (!popup) return;
  await intercept(popup).catch(() => {});
});

function recordGenerate(page) {
  page.on('request', request => {
    if (!request.url().includes('/api/admin/parent-reports/generate')) return;
    let body = null;
    try {
      body = JSON.parse(request.postData() ?? 'null');
    } catch {
      body = null;
    }
    generateRequests.push(body);
  });
}

/** The mobile dock overlays the viewport bottom, so centre the target first. */
async function clickControl(page, selector) {
  await page.bringToFront();
  await page.waitForSelector(selector, { timeout: 20000 });
  // React attaches its delegated listeners on the first commit; clicking before
  // that would fall back to a native form submit.
  await page.waitForFunction(() => Boolean(document.querySelector('main')), { timeout: 20000 });
  await page.$eval(selector, node => node.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.click(selector);
  await page.bringToFront();
}

async function diagnose(page, label) {
  const state = await page.evaluate(() => ({
    url: window.location.href,
    testids: [...document.querySelectorAll('[data-testid]')].map(node => node.dataset.testid).slice(0, 30),
    body: (document.body.innerText ?? '').slice(0, 400),
  }));
  process.stdout.write(`DIAGNOSE ${label} ${JSON.stringify(state, null, 2)}\n`);
}

async function login(page) {
  await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-id');
  await new Promise(resolve => setTimeout(resolve, 800));
  await page.type('#login-id', 'admin.synthetic@m10a3.invalid');
  await page.type('#login-password', 'synthetic-password-not-real');
  await clickControl(page, 'form button[type="submit"]');
  try {
    await page.waitForFunction(() => window.location.hash.startsWith('#/account'), { timeout: 20000 });
  } catch (error) {
    await diagnose(page, 'login');
    throw error;
  }
}

async function openStudentsTab(page) {
  await page.goto(`${BASE}/#/admin/courses/${COURSE}`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('#course-workspace-tab-students', { timeout: 20000 });
    await clickControl(page, '#course-workspace-tab-students');
    await page.waitForSelector('[data-testid="roster-list"]', { timeout: 20000 });
  } catch (error) {
    await diagnose(page, 'students-tab');
    throw error;
  }
}

async function newSession({ width = 1280, height = 900, lang = 'ar', theme = 'dark', mobile = false } = {}) {
  waNavigations.length = 0;
  const page = await browser.newPage();
  if (mobile) {
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
  }
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await intercept(page);
  recordGenerate(page);
  await page.evaluateOnNewDocument(
    (l, t) => {
      window.localStorage.setItem('edu-platform-lang', l);
      window.localStorage.setItem('edu-platform-theme', t);
    },
    lang,
    theme,
  );
  await login(page);
  await openStudentsTab(page);
  return page;
}

const text = (page, selector) =>
  page.$eval(selector, node => node.textContent ?? '').catch(() => null);

const visible = (page, selector) =>
  page.evaluate(sel => {
    const node = document.querySelector(sel);
    if (!node) return false;
    return !node.closest('[hidden]') && node.getClientRects().length > 0;
  }, selector);

// Viewport screenshots: the workspace is taller than any single frame and a
// full-page capture of it times out inside the disposable container. A capture
// problem is recorded as a failure of the evidence, never of the behaviour.
const evidenceResults = [];
const shot = async (page, name) => {
  try {
    await page.evaluate(() => (document.querySelector('[data-testid="parent-report-workspace"]') ?? document.querySelector('[data-testid="admin-course-students"]'))?.scrollIntoView({ block: 'start' }));
    await page.bringToFront();
    await page.screenshot({ path: join(EVIDENCE, `${name}.png`), waitForFonts: false, timeout: 10000 });
    evidenceResults.push({ name: `${name}.png`, status: 'CAPTURED' });
  } catch (error) {
    evidenceResults.push({ name: `${name}.png`, status: 'CAPTURE_FAILED', error: String(error.message ?? error) });
  }
};

async function check(name, fn) {
  const before = waNavigations.length;
  try {
    await fn();
    results.push({ name, status: 'PASS', whatsappNavigations: waNavigations.length - before });
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    results.push({ name, status: 'FAIL', error: String(error && error.message ? error.message : error) });
    process.stdout.write(`FAIL ${name}: ${error.message}\n`);
  }
}

async function selectStudent(page, studentId) {
  await clickControl(page, `[data-testid="select-student-${studentId}"]`);
  await page.waitForSelector('[data-testid="parent-report-workspace"]', { timeout: 20000 });
  await page.waitForFunction(id => document.querySelector(`[data-testid="select-student-${id}"]`)?.getAttribute('aria-pressed') === 'true', {}, studentId);
}

async function search(page, value) {
  await page.focus('[data-testid="roster-search"]');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  if (value) await page.type('[data-testid="roster-search"]', value);
}

async function generatePreview(page, reportType) {
  if (reportType) await clickControl(page, `[data-testid="report-type-${reportType}"]`);
  await clickControl(page, '[data-testid="generate-report"]');
  await page.waitForSelector('[data-testid="report-text-1"]', { timeout: 30000 });
}

// ---------------------------------------------------------------------------
// 1. Arabic desktop dark: roster paging, zero activity, per-video counts.
// ---------------------------------------------------------------------------
{
  const page = await newSession({ lang: 'ar', theme: 'dark' });
  await check('ar desktop dark: roster renders one server page of 20 students', async () => {
    assert.equal(await page.$$eval('[data-testid="roster-list"] > li', nodes => nodes.length), 20);
    assert.equal(await page.$eval('[data-testid="roster-previous"]', node => node.disabled), true);
    const reason = await text(page, '[data-testid="roster-previous"] [data-disabled-reason]');
    assert.ok(reason && reason.trim().length > 0, 'first-page disabled reason must be visible');
    assert.equal(await page.$eval('html', node => node.lang), 'ar');
    assert.equal(await page.$eval('html', node => node.dir), 'rtl');
    assert.equal(await page.$eval('html', node => node.dataset.theme), 'dark');
  });

  await check('ar desktop dark: roster never exposes a plaintext guardian number', async () => {
    const cards = await page.$$eval('[data-testid="roster-list"]', nodes => nodes.map(node => node.textContent ?? ''));
    for (const card of cards) {
      assert.ok(!/20\d{9,}/.test(card), `guardian number leaked into the roster: ${card.slice(0, 80)}`);
    }
  });

  await check('ar desktop dark: roster paging advances with the server cursor', async () => {
    await clickControl(page, '[data-testid="roster-next"]');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="roster-list"] > li').length === 5,
      { timeout: 20000 },
    );
    assert.equal(await page.$eval('[data-testid="roster-previous"]', node => node.disabled), false);
    const firstId = await page.$eval(
      '[data-testid="roster-list"] > li [data-testid^="select-student-"]',
      node => node.dataset.testid,
    );
    assert.ok(firstId.includes('student-20'), `unexpected first row on page 2: ${firstId}`);
  });

  await check('ar desktop dark: a zero-activity student without a guardian number is listed', async () => {
    await search(page, 'Quiet');
    await page.waitForSelector('[data-testid="select-student-student-quiet"]', { timeout: 20000 });
    assert.equal(await text(page, '[data-testid="guardian-student-quiet"]'), 'لا يوجد رقم ولي أمر مسجل. يمكن عرض التقرير، لكن لا يمكن فتح محادثة واتساب.');
    assert.equal(await text(page, '[data-testid="last-viewed-student-quiet"]'), 'لا يوجد نشاط مسجل');
    assert.equal(await text(page, '[data-testid="total-views-student-quiet"]'), 'لا يوجد نشاط مسجل');
  });

  await check('ar desktop dark: per-video counts and coverage appear for the selected student', async () => {
    await search(page, 'سلمى');
    await selectStudent(page, 'student-active');
    await page.waitForSelector('[data-testid="views-list"]', { timeout: 20000 });
    assert.equal(await text(page, '[data-testid="lesson-count-lesson-1"]'), '٢');
    assert.equal(await text(page, '[data-testid="lesson-count-lesson-2"]'), '١');
    assert.equal(await text(page, '[data-testid="lesson-count-lesson-3"]'), 'غير معروف');
    assert.equal(await text(page, '[data-testid="lesson-coverage-lesson-2"]'), 'تغطية جزئية');
    assert.equal(await text(page, '[data-testid="lesson-coverage-lesson-3"]'), 'التعقب غير متاح');
    assert.equal(await text(page, '[data-testid="media-asset-lesson-3"]'), 'بدون فيديو');
    assert.ok((await text(page, '[data-testid="views-tracking-start"]')).includes('بدأ تسجيل المشاهدات في'));
  });

  await shot(page, 'ar-1280-dark-roster');
  await page.close();
}

// ---------------------------------------------------------------------------
// 2. English desktop light: report types, text, combined courses, no storage.
// ---------------------------------------------------------------------------
{
  const page = await newSession({ lang: 'en', theme: 'light' });
  await check('en desktop light: language, direction and theme follow the preference', async () => {
    assert.equal(await page.$eval('html', node => node.lang), 'en');
    assert.equal(await page.$eval('html', node => node.dir), 'ltr');
    assert.equal(await page.$eval('html', node => node.dataset.theme), 'light');
  });

  await check('en desktop light: a week report shows the backend text, exact period and statuses', async () => {
    await selectStudent(page, 'student-active');
    await generatePreview(page, 'WEEK');
    const body = await text(page, '[data-testid="report-text-1"]');
    assert.ok(body.includes('FAYQ'), 'FAYQ heading');
    assert.ok(body.includes('Quiz: passed'), 'passed assessment');
    assert.ok(body.includes('Assignment: not submitted'), 'unsubmitted assessment');
    assert.ok(body.includes('Lesson one: viewed') && body.includes('Lesson two: not viewed'), 'video statuses');
    assert.ok(!/\d+\s*(views|مشاهدات)/i.test(body), 'no numeric view counts in the parent text');
    assert.ok(!/\d+\s*%/.test(body), 'no invented percentage');
    assert.ok((await text(page, '[data-testid="report-period-value"]')).includes('–'));
    assert.ok((await text(page, '[data-testid="report-generated-at"]')).length > 0);
  });

  await check('en desktop light: two-week and four-week reports keep the weekly components', async () => {
    for (const [type, expected] of [['TWO_WEEKS', 'Week 2'], ['FOUR_WEEKS', 'Week 4']]) {
      await clickControl(page, `[data-testid="report-type-${type}"]`);
      await clickControl(page, '[data-testid="generate-report"]');
      await page.waitForFunction(
        selector => (document.querySelector('[data-testid="report-text-1"]')?.textContent ?? '').includes(selector),
        { timeout: 30000 },
        expected,
      );
      const last = generateRequests[generateRequests.length - 1];
      assert.equal(last.reportType, type);
    }
  });

  await check('en desktop light: a combined report requests every selected current membership', async () => {
    await clickControl(page, '[data-testid="report-type-WEEK"]');
    await clickControl(page, `[data-testid="report-course-${OTHER_COURSE}"]`);
    await clickControl(page, '[data-testid="generate-report"]');
    await page.waitForFunction(
      () => (document.querySelector('[data-testid="report-text-1"]')?.textContent ?? '').includes('Course:'),
      { timeout: 30000 },
    );
    const last = generateRequests[generateRequests.length - 1];
    assert.deepEqual([...last.courseIds].sort(), [COURSE, OTHER_COURSE]);
    assert.equal(last.reportType, 'WEEK');
    assert.equal(last.language, 'en');
  });

  await check('en desktop light: report responses are served with a no-store policy', async () => {
    const cacheControl = await page.evaluate(async () => {
      const response = await fetch('/api/admin/parent-reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: 'student-active', courseIds: ['course-m10a3'], reportType: 'WEEK', language: 'en' }),
      });
      return response.headers.get('cache-control');
    });
    assert.ok(cacheControl && cacheControl.includes('no-store'), cacheControl);
  });

  await check('en desktop light: no report or recipient data reaches browser storage', async () => {
    const storage = await page.evaluate(() => ({
      local: Object.entries(window.localStorage),
      session: Object.entries(window.sessionStorage),
    }));
    const allowed = new Set(['edu-platform-lang', 'edu-platform-theme']);
    for (const [key, value] of storage.local) {
      assert.ok(allowed.has(key), `unexpected localStorage key: ${key}`);
      assert.ok(!value.includes('FAYQ'), 'report text must not be stored');
      assert.ok(!value.includes('wa.me'), 'recipient URL must not be stored');
      assert.ok(!/20\d{9,}/.test(value), 'guardian number must not be stored');
    }
    assert.deepEqual(storage.session, []);
    const dom = await page.evaluate(() => document.documentElement.innerHTML);
    assert.ok(!dom.includes('wa.me/'), 'no click-to-chat URL is left in the DOM');
  });

  await shot(page, 'en-1280-light-report');
  await page.close();
}

// ---------------------------------------------------------------------------
// 3. Desktop: WhatsApp handoff, encoding, disposal, long parts, blocked popup.
// ---------------------------------------------------------------------------
{
  const page = await newSession({ lang: 'ar', theme: 'dark' });
  await check('desktop: Generate & open WhatsApp hands part 1 to the reserved gesture', async () => {
    await selectStudent(page, 'student-active');
    await clickControl(page, '[data-testid="generate-and-open-whatsapp"]');
    await page.waitForSelector('[data-testid="report-part-disposed-1"]', { timeout: 40000 });
    const navigations = waNavigations.filter(entry => /wa\.me/.test(entry.url));
    assert.equal(navigations.length, 1, 'exactly one click-to-chat navigation');
    const url = new URL(navigations[0].url);
    assert.equal(url.hostname, 'wa.me');
    assert.equal(url.protocol, 'https:');
    assert.equal(url.pathname.slice(1), '201001234567', 'current registered guardian number');
    const message = url.searchParams.get('text') ?? '';
    assert.ok(message.includes('تقرير ولي الأمر'), 'Arabic text survives encoding');
    assert.ok(message.includes('\n'), 'newlines survive encoding');
    assert.ok(!message.includes('مشاهدات مسجلة'), 'no ADMIN-only counts in the parent text');
    assert.equal(await visible(page, '[data-testid="report-text-1"]'), false, 'platform copy disposed at handoff');
  });

  await check('desktop: the handoff note never claims the message was sent', async () => {
    const note = await text(page, '[data-testid="handoff-note"]');
    assert.ok(note && note.includes('لا يُعرف هنا'), note);
    assert.ok(!/تم الإرسال|delivered|sent successfully/i.test(note ?? ''), note);
  });

  await check('desktop: a four-part long report keeps every part and refuses the over-long URL', async () => {
    // The primary check above exercises a real reserved Chromium window.
    // Deterministic handles isolate part bookkeeping from Chromium target
    // initialization when an over-long URL closes a still-blank popup.
    await page.evaluate(() => { window.open = () => ({ location: { set href(url) { void fetch('/fixture-handoff?url=' + encodeURIComponent(url)); } }, close() {}, opener: null }); });
    page.on('request', request => { if (request.url().includes('/fixture-handoff?')) waNavigations.push({url:new URL(request.url()).searchParams.get('url')}); });
    await selectStudent(page, 'student-long');
    await clickControl(page, '[data-testid="report-type-FOUR_WEEKS"]');
    await clickControl(page, '[data-testid="generate-and-open-whatsapp"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="handoff-note"]')?.textContent.includes('أطول من حد رابط واتساب'), { timeout: 40000 });
    const note = await text(page, '[data-testid="handoff-note"]');
    assert.ok(note && note.includes('أطول من حد رابط واتساب'), note);
    assert.equal(waNavigations.filter(entry => /wa\.me/.test(entry.url)).length, 1, 'no navigation for an over-long part');
    assert.equal(await page.$$eval('[data-testid^="report-part-"]', nodes => nodes.length), 4, 'no part is dropped');
    const body = await text(page, '[data-testid="report-text-1"]');
    assert.ok(body.length > 4000, `long part must stay whole, got ${body.length}`);
    assert.ok(body.includes('سطر طويل تجريبي رقم 399'), 'the last long line is preserved');
  });

  await check('desktop: explicit copy works and never claims delivery', async () => {
    await page.evaluate(() => {
      window.__clipboard = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async value => { window.__clipboard = value; } },
      });
    });
    await clickControl(page, '[data-testid="copy-part-1"]');
    await page.waitForFunction(() => (window.__clipboard ?? '').length > 4000, { timeout: 20000 });
    const copied = await page.evaluate(() => window.__clipboard);
    assert.ok(copied.includes('FAYQ'));
    const copyNote = await text(page, '[data-testid="copy-note-1"]');
    assert.ok(copyNote && copyNote.includes('لا ترسل ولا تؤكد الإرسال'), copyNote);
  });

  await check('desktop: handing off one later part keeps the remaining text transient', async () => {
    await clickControl(page, '[data-testid="open-part-2"]');
    await page.waitForSelector('[data-testid="report-part-disposed-2"]', { timeout: 30000 });
    const navigations = waNavigations.filter(entry => /wa\.me/.test(entry.url));
    assert.equal(navigations.length, 2, 'one more click-to-chat navigation');
    const url = new URL(navigations[1].url);
    assert.equal(url.pathname.slice(1), '201001234568', 'that student own registered number');
    assert.equal(await visible(page, '[data-testid="report-text-1"]'), true, 'unhanded part still readable');
    assert.equal(await visible(page, '[data-testid="report-text-3"]'), true);
    assert.equal(await text(page, '[data-testid="report-remaining"]'), 'أجزاء لم تُسلَّم بعد: ٣');
  });

  await check('desktop: discarding the text removes every remaining part at once', async () => {
    await clickControl(page, '[data-testid="dispose-report"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="report-parts"]'), { timeout: 20000 });
    assert.equal(await visible(page, '[data-testid="report-text-1"]'), false);
    assert.equal(await visible(page, '[data-testid="report-text-3"]'), false);
    const dom = await page.evaluate(() => document.documentElement.innerHTML);
    assert.ok(!dom.includes('سطر طويل تجريبي رقم 399'), 'no report payload is left in the DOM after disposal');
  });

  await shot(page, 'ar-1280-dark-handoff');
  await page.close();
}

// ---------------------------------------------------------------------------
// 4. Desktop: blocked popup fallback and same-tab manual open.
// ---------------------------------------------------------------------------
{
  const page = await newSession({ lang: 'ar', theme: 'light' });
  await check('desktop: a blocked popup is reported and opens nothing', async () => {
    await page.evaluate(() => { window.open = () => null; });
    await selectStudent(page, 'student-active');
    await clickControl(page, '[data-testid="generate-and-open-whatsapp"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="handoff-note"]')?.textContent.includes('حظر المتصفح'), { timeout: 40000 });
    const note = await text(page, '[data-testid="handoff-note"]');
    assert.ok(note && note.includes('حظر المتصفح'), note);
    assert.equal(waNavigations.length, 0, 'no chat navigation while blocked');
    assert.equal(await visible(page, '[data-testid="report-text-1"]'), true, 'text stays readable');
    assert.equal(await page.$eval('[data-testid="copy-part-1"]', node => node.disabled), false);
    assert.equal(await page.$eval('[data-testid="manual-open-part-1"]', node => node.disabled), false);
  });

  await check('desktop: the visible manual fallback performs the reviewed handoff', async () => {
    await clickControl(page, '[data-testid="manual-open-part-1"]');
    await page.waitForSelector('[data-testid="report-part-disposed-1"]', { timeout: 30000 });
    assert.equal(waNavigations.length, 1, 'the manual fallback navigates exactly once');
    assert.ok(/wa\.me\/201001234567/.test(waNavigations[0].url));
  });

  await shot(page, 'ar-1280-light-popup-blocked');
  await page.close();
}

// ---------------------------------------------------------------------------
// 5. Mobile: layout, missing contact, changed contact, stale work, cleanup.
// ---------------------------------------------------------------------------
{
  const page = await newSession({ lang: 'ar', theme: 'light', width: 390, height: 844, mobile: true });
  await check('mobile 390: the workspace stays inside the viewport', async () => {
    assert.equal(await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1), false);
  });

  await check('mobile: a student without a registered number blocks the handoff with a visible reason', async () => {
    await selectStudent(page, 'student-quiet');
    await generatePreview(page, 'WEEK');
    assert.equal(await visible(page, '[data-testid="report-text-1"]'), true);
    assert.equal(await page.$eval('[data-testid="open-part-1"]', node => node.disabled), true);
    const reason = await text(page, '[data-testid="open-part-1"] [data-disabled-reason]');
    assert.ok(reason && reason.includes('لا يوجد رقم ولي أمر'), reason);
    const recipient = await text(page, '[data-testid="report-recipient"]');
    assert.ok(recipient && !recipient.includes('201001234567'), 'no number is offered');
  });

  await check('mobile: changing the selected student discards the held text', async () => {
    await search(page, 'Contact change');
    await selectStudent(page, 'student-contact-change');
    await page.waitForFunction(() => !document.querySelector('[data-testid="report-text-1"]'), { timeout: 20000 });
    assert.equal(await visible(page, '[data-testid="report-text-1"]'), false);
  });

  await check('mobile: a contact changed after preparation holds nothing and opens nothing', async () => {
    const before = waNavigations.length;
    await clickControl(page, '[data-testid="generate-report"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="handoff-note"]')?.textContent.includes('تغيّر رقم ولي الأمر'), { timeout: 40000 });
    const note = await text(page, '[data-testid="handoff-note"]');
    assert.ok(note && note.includes('تغيّر رقم ولي الأمر'), note);
    assert.equal(await visible(page, '[data-testid="report-text-1"]'), false);
    assert.equal(waNavigations.length, before, 'no chat opened for a changed contact');
    assert.ok((await text(page, '[data-testid="report-error-code"]')).includes('CONTACT_CHANGED'));
  });

  await check('mobile: a slow response for a superseded student is discarded', async () => {
    const before = waNavigations.length;
    await search(page, 'Quiet');
    await selectStudent(page, 'student-quiet');
    await clickControl(page, '[data-testid="generate-report"]');
    // Change the selection while the slow generation is still in flight.
    await search(page, 'سلمى');
    await selectStudent(page, 'student-active');
    await new Promise(resolve => setTimeout(resolve, 3000));
    assert.equal(await visible(page, '[data-testid="report-text-1"]'), false, 'stale text must not appear');
    assert.equal(waNavigations.length, before, 'a stale response must not open a chat');
  });

  await check('mobile: leaving the workspace and returning clears every remaining part', async () => {
    await generatePreview(page, 'WEEK');
    assert.equal(await visible(page, '[data-testid="report-text-1"]'), true);
    await clickControl(page, '#course-workspace-tab-outline');
    await page.waitForFunction(() => !document.querySelector('[data-testid="parent-report-workspace"]'), { timeout: 20000 });
    await clickControl(page, '#course-workspace-tab-students');
    await page.waitForSelector('[data-testid="roster-list"]', { timeout: 20000 });
    assert.equal(await visible(page, '[data-testid="report-text-1"]'), false);
    assert.equal(await page.$('[data-testid="report-parts"]'), null);
  });

  await shot(page, 'ar-390-light-students');
  await page.close();
}

// ---------------------------------------------------------------------------
// 6. Mobile English dark: focus, accessible names, screenshot.
// ---------------------------------------------------------------------------
{
  const page = await newSession({ lang: 'en', theme: 'dark', width: 390, height: 844, mobile: true });
  await check('en mobile dark: keyboard focus reaches the handoff control visibly', async () => {
    await selectStudent(page, 'student-active');
    await generatePreview(page, 'WEEK');
    await page.focus('[data-testid="open-part-1"]');
    await page.keyboard.press('Tab'); await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
    const focus = await page.evaluate(() => {
      const node = document.activeElement;
      if (!node) return null;
      const style = window.getComputedStyle(node);
      return { testid: node.dataset.testid, outline: style.outlineStyle, shadow: style.boxShadow };
    });
    assert.equal(focus?.testid, 'open-part-1');
    assert.ok(focus?.outline !== 'none' || focus?.shadow !== 'none');
  });

  await check('en mobile dark: every roster and report control has an accessible name', async () => {
    const unnamed = await page.$$eval(
      '[data-testid="parent-report-workspace"] button, [data-testid="admin-course-roster"] button, [data-testid="admin-course-roster"] input, [data-testid="admin-course-roster"] label',
      nodes => nodes.filter(node => {
        if (node.tagName === 'LABEL') return (node.textContent ?? '').trim() === '';
        if (node.id && document.querySelector(`label[for="${node.id}"]`)?.textContent.trim()) return false;
        const label = node.getAttribute('aria-label') ?? node.textContent ?? '';
        return label.trim() === '' && !node.getAttribute('aria-labelledby');
      }).length,
    );
    assert.equal(unnamed, 0);
  });

  await check('en mobile dark: the tab strip keeps its role semantics', async () => {
    assert.equal(await page.$eval('#course-workspace-tab-students', node => node.getAttribute('role')), 'tab');
    assert.equal(await page.$eval('#course-workspace-tab-students', node => node.getAttribute('aria-selected')), 'true');
  });

  await shot(page, 'en-390-dark-report');
  await page.close();
}

browser.process()?.kill('SIGTERM');
await Promise.race([browser.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);

const failed = results.filter(entry => entry.status === 'FAIL');
const summary = {
  project: 'edu-platform-m10a3',
  base: BASE,
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  whatsappNavigationsIntercepted: waNavigations.length,
  whatsappDeliveriesObserved: 'not observable and not claimed: click-to-chat only pre-fills a composer draft',
  note: 'WhatsApp navigation was intercepted inside the browser; no message was sent.',
  screenshots: evidenceResults,
  results,
};
await writeFile(join(EVIDENCE, 'results.json'), JSON.stringify(summary, null, 2));
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (failed.length > 0) process.exitCode = 1;
process.exit(failed.length > 0 ? 1 : 0);
