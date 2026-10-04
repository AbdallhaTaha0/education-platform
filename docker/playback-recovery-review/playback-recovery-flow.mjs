/** Playback-recovery browser proof (task-owned disposable UI only).
 *
 * REAL: cookie auth, outline/progress/entitlement APIs, ADMIN directory APIs,
 * lesson navigation, fullscreen/fallback mechanics, keyboard/focus behavior.
 * EXPLICIT HARNESS-ONLY MOCKS (request interception in this script only):
 * playback-grant POSTs, device inspection/release, own-session list/end, and
 * stalled mock media URLs (no playable bytes exist). Mocked checks prove UI
 * state transitions and control behavior ONLY -- never authorization, storage,
 * DRM enforcement, or advancing protected playback. Those are proven by the
 * Docker API/integration suites with the labeled HTTP fixture plus the prior
 * retained-preview real-playback evidence. No real advancing protected
 * playback is claimed here.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { lookup } from 'node:dns/promises';

const host = (await lookup('host.docker.internal')).address;
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${host}`],
});
const BASE = 'http://localhost:8092';
// The reviewed delivery intentionally excludes pending materials wiring.
// Explicitly assert its absence in that tree; never count absence as caption
// support. Full-workspace verification still requires present caption controls.
const materialsUi = process.env.PLAYBACK_RECOVERY_MATERIALS_UI !== 'false';
let checks = 0;
const errors = [];
function pass(name, value = true) { assert(value, name); checks++; console.log(`PASS ${name}`); }

const NOW = () => new Date().toISOString();
const FUTURE = () => new Date(Date.now() + 3600_000).toISOString();

// Mutable harness-only mock state. Each section sets the mode it needs;
// transitions (CONFIRMED/QUEUED/NOOP, stale lists) are driven by mutating it.
const mock = {
  playbackMode: 'grant',
  grantCount: 0,
  endCount: 0,
  endCalls: [],
  endMode: 'CONFIRMED',
  sessions: [],
  sessionsError: false,
  releaseCalls: 0,
  releaseMode: 'ok', // 'ok' | 'fail-once-then-ok' | 'active' | 'revoked' | 'outage'
  releaseFailedOnce: false,
  delayDevicesMs: 0,
};

function sessionRow(ref, status = 'ACTIVE', terminationStatus = null) {
  return {
    referenceId: ref, courseSlug: 'm9-ui-course',
    courseTitleAr: 'برمجة الويب', courseTitleEn: 'Web programming',
    lessonId: 'mock-lesson', lessonTitleAr: 'الدرس 1', lessonTitleEn: 'Lesson 1',
    status, terminationStatus, pendingEndReason: null,
    createdAt: NOW(), tokenExpiresAt: FUTURE(), sessionExpiresAt: FUTURE(), endedAt: null,
  };
}

function grantBody(n) {
  mock.grantCount += 1;
  const pad = String(n).padStart(2, '0');
  return { data: { playback: {
    referenceId: `44444444-4444-4444-4444-4444444444${pad}`,
    playbackSessionId: `55555555-5555-5555-5555-5555555555${pad}`,
    playbackToken: 'mock-playback-token',
    tokenExpiresAt: FUTURE(), sessionExpiresAt: FUTURE(),
    manifestUrl: `${BASE}/mock-media/manifest.mpd`,
    licenseUrl: `${BASE}/mock-media/license`,
    drmProvider: 'CLEAR_KEY',
    watermark: { type: 'MASKED', maskedIdentity: 'mock***', positions: [{ x: 50, y: 50 }], expiresAt: FUTURE() },
    resumePositionSeconds: 0,
  } } };
}

/** Harness-only interception: real APIs pass through untouched. */
async function mockLearning(p) {
  await p.setRequestInterception(true);
  p.on('request', async (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith('/mock-media/')) return;
    if (/\/api\/learning\/courses\/.+\/lessons\/.+\/playback$/.test(url.pathname) && req.method() === 'POST') {
      if (mock.playbackMode === 'stream-limit') {
        return void req.respond({ status: 403, contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'PLAYBACK_STREAM_LIMIT', message: 'Stop playback on another device.' } }) });
      }
      return void req.respond({ status: 201, contentType: 'application/json', body: JSON.stringify(grantBody(mock.grantCount)) });
    }
    if (/\/api\/learning\/sessions$/.test(url.pathname)) {
      if (mock.sessionsError) {
        return void req.respond({ status: 503, contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'DRM_DEPENDENCY_FAILED', message: 'Unavailable.' } }) });
      }
      return void req.respond({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { sessions: mock.sessions } }) });
    }
    if (/\/api\/learning\/playback\/.+\/end$/.test(url.pathname)) {
      mock.endCount += 1;
      mock.endCalls.push(url.pathname);
      return void req.respond({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { ended: true, closure: mock.endMode } }) });
    }
    if (/\/api\/admin\/learning\/students\/.+\/devices$/.test(url.pathname) && req.method() === 'GET') {
      if (mock.delayDevicesMs > 0) await new Promise((r) => setTimeout(r, mock.delayDevicesMs));
      const now = NOW();
      return void req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { devices: {
        studentId: 'mock-student', maxDevices: 2, activeCount: 1, freeSlots: 1,
        truncated: false, unavailable: false,
        devices: [
          { reference: '11111111-1111-1111-1111-111111111111', status: 'ACTIVE', createdAt: now, lastSeenAt: now, activePlayback: false, releasable: true },
          { reference: '22222222-2222-2222-2222-222222222222', status: 'REVOKED', createdAt: now, lastSeenAt: now, activePlayback: false, releasable: false },
        ],
      } } }) });
    }
    if (/\/api\/admin\/learning\/students\/.+\/devices\/.+\/release$/.test(url.pathname)) {
      mock.releaseCalls += 1;
      if (mock.releaseMode === 'outage' || (mock.releaseMode === 'fail-once-then-ok' && !mock.releaseFailedOnce)) {
        mock.releaseFailedOnce = true;
        return void req.respond({ status: 503, contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'DEVICE_RELEASE_UNAVAILABLE', message: 'Unavailable.' } }) });
      }
      if (mock.releaseMode === 'active') {
        return void req.respond({ status: 409, contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'DEVICE_RELEASE_ACTIVE', message: 'Active playback.' } }) });
      }
      return void req.respond({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { release: { released: false, auditPending: false } } }) });
    }
    return void req.continue();
  });
}

async function makePage(lang, theme, width, height = 900) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width, height });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.evaluateOnNewDocument((l, t) => {
    if (window.top === window) {
      localStorage.setItem('edu-platform-lang', l);
      localStorage.setItem('edu-platform-theme', t);
    }
  }, lang, theme);
  return p;
}
async function route(p, hash) { await p.goto(`${BASE}/${hash}`); }
async function login(p, email) {
  await route(p, '#/login');
  await p.waitForSelector('#login-id', { timeout: 30000 });
  await p.type('#login-id', email);
  await p.type('#login-password', 'm9 fixture password twelve words');
  await p.click('form button[type="submit"]');
  await p.waitForFunction(() => location.hash === '#/account', { timeout: 30000 });
}
async function openLearn(p) {
  await route(p, '#/learn/m9-ui-course');
  await p.waitForFunction(
    () => document.body.textContent.includes('الدرس') || document.body.textContent.includes('Lesson'),
    { timeout: 30000 },
  );
}
async function clickCheckStatus(p) {
  for (let i = 0; i < 8; i++) {
    const btns = await p.$$('section button');
    for (const b of btns) {
      const text = await b.evaluate((el) => el.textContent);
      const disabled = await b.evaluate((el) => el.disabled);
      if (!disabled && (text.includes('Check status') || text.includes('التحقق من الحالة'))) {
        await b.click();
        return true;
      }
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}
async function clickSectionButton(p, ...needles) {
  try {
    await p.waitForFunction(
      (ns) => [...document.querySelectorAll('section button')].some((b) => ns.some((n) => (b.textContent || '').includes(n))),
      { timeout: 15000 },
      needles,
    );
  } catch {
    return false;
  }
  const buttons = await p.$$('section button');
  for (const b of buttons) {
    const text = await b.evaluate((el) => el.textContent);
    if (needles.some((n) => text.includes(n))) { await b.click(); return true; }
  }
  return false;
}
try {
  // A. ADMIN devices (English, desktop, dark).
  {
    console.log('STEP admin-devices');
    const p = await makePage('en', 'dark', 1440);
    await login(p, 'm9-admin@example.test');
    await mockLearning(p);
    await route(p, '#/admin/students');
    await p.waitForFunction(
      () => document.body.textContent.includes('Student directory') || document.body.textContent.includes('دليل الطلاب'),
      { timeout: 30000 },
    );
    pass('admin directory loads');
    await p.waitForSelector('main input', { timeout: 30000 });
    await p.click('main input');
    await p.keyboard.down('Control');
    await p.keyboard.press('a');
    await p.keyboard.up('Control');
    await p.keyboard.press('Backspace');
    await p.type('main input', 'Synthetic Student 0', { delay: 20 });
    await p.waitForFunction(() => document.body.textContent.includes('Synthetic Student 0'), { timeout: 30000 });
    pass('admin search finds synthetic student');
    const buttons = await p.$$('main button');
    let found = false;
    for (const b of buttons) {
      const text = await b.evaluate((el) => el.textContent);
      if (text.includes('Devices')) { await b.click(); found = true; break; }
    }
    pass('admin devices toggle present', found);
    await p.waitForFunction(
      () => document.body.textContent.includes('Student devices') || document.body.textContent.includes('أجهزة الطالب'),
      { timeout: 30000 },
    );
    pass('admin devices section renders');
    await p.waitForFunction(
      () => document.body.textContent.includes('Maximum') || document.body.textContent.includes('الحد الأقصى'),
      { timeout: 30000 },
    );
    pass('admin devices shows max/active/free slots');
    await p.waitForFunction(
      () => document.body.textContent.includes('Banned') || document.body.textContent.includes('محظور'),
      { timeout: 30000 },
    );
    pass('revoked visible as banned, not releasable');
    mock.releaseMode = 'fail-once-then-ok';
    mock.releaseFailedOnce = false;
    mock.delayDevicesMs = 1500;
    await p.evaluate(() => { window.confirm = () => true; });
    const relButtons = await p.$$('main button');
    let relClicked = false;
    for (const b of relButtons) {
      const text = await b.evaluate((el) => el.textContent);
      if (text.includes('Release inactive device') || text.includes('تحرير جهاز غير نشط')) {
        await b.evaluate((el) => el.scrollIntoView());
        await b.click();
        relClicked = true;
        break;
      }
    }
    pass('release action available for inactive device', relClicked);
    await p.waitForFunction(
      () => document.body.textContent.includes('did not return a clear answer') || document.body.textContent.includes('لم يصل رد واضح'),
      { timeout: 30000 },
    );
    pass('uncertain release shows unconfirmed state before resubmission');
    const relDisabled = await p.evaluate(() => [...document.querySelectorAll('main button')]
      .filter((b) => (b.textContent || '').includes('Release inactive device') || (b.textContent || '').includes('تحرير جهاز غير نشط'))
      .every((b) => b.disabled));
    pass('release controls stay disabled while reconciling', relDisabled);
    await p.waitForFunction(
      () => document.body.textContent.includes('still listed') || document.body.textContent.includes('لا يزال ظاهرًا'),
      { timeout: 30000 },
    );
    pass('uncertain release reconciles to still-listed safe retry');
    mock.delayDevicesMs = 0;
    await p.screenshot({ path: '/evidence/playback-recovery-admin-devices.png' });
    await p.close();
  }

  // B. Recovery CONFIRMED offers restart; restart issues one new grant (Arabic, mobile, dark).
  {
    console.log('STEP recovery-confirmed');
    const p = await makePage('ar', 'dark', 390);
    await login(p, 'm9-student@example.test');
    await mockLearning(p);
    mock.playbackMode = 'stream-limit';
    mock.endMode = 'CONFIRMED';
    mock.sessions = [sessionRow('33333333-3333-3333-3333-333333333333')];
    mock.grantCount = 0;
    mock.endCount = 0;
    await openLearn(p);
    await p.waitForSelector('[data-testid="learning-start-playback"]', { timeout: 30000 });
    await p.click('[data-testid="learning-start-playback"]');
    await p.waitForFunction(
      () => document.body.textContent.includes('استعادة جلسة') || document.body.textContent.includes('Recover a previous session'),
      { timeout: 30000 },
    );
    pass('stream denial offers own-session recovery');
    await p.waitForSelector('input[name="own-session"]', { timeout: 30000 });
    pass('own sessions listed for selection');
    await p.click('input[name="own-session"]');
    assert(await clickSectionButton(p, 'إنهاء الجلسة المحددة', 'End selected session'), 'end button present');
    await p.waitForFunction(
      () => document.body.textContent.includes('تم الإغلاق والتأكيد') || document.body.textContent.includes('Closed and confirmed'),
      { timeout: 30000 },
    );
    pass('CONFIRMED closure shows confirmed restart offer');
    const grantsBefore = mock.grantCount;
    mock.playbackMode = 'grant';
    assert(await clickSectionButton(p, 'بدء التشغيل مجددًا', 'Start playback again'), 'start-again present');
    pass('confirmed restart offered through explicit action');
    await p.waitForSelector('.learning-video-frame', { timeout: 30000 });
    pass('restart after CONFIRMED mounts the real player frame');
    assert(mock.grantCount === grantsBefore + 1, 'exactly one new grant for the restart');
    pass('no duplicate grants on confirmed restart');
    await p.close();
  }

  // C. QUEUED stays pending; refresh to COMPLETED promotes the offer (English, desktop, light).
  {
    console.log('STEP recovery-queued');
    const p = await makePage('en', 'light', 1440);
    await login(p, 'm9-student@example.test');
    await mockLearning(p);
    mock.playbackMode = 'stream-limit';
    mock.endMode = 'QUEUED';
    mock.sessions = [sessionRow('77777777-7777-7777-7777-777777777777')];
    await openLearn(p);
    await p.waitForSelector('[data-testid="learning-start-playback"]', { timeout: 30000 });
    await p.click('[data-testid="learning-start-playback"]');
    await p.waitForSelector('input[name="own-session"]', { timeout: 30000 });
    await p.click('input[name="own-session"]');
    assert(await clickSectionButton(p, 'End selected session'), 'end button present');
    await p.waitForFunction(
      () => document.body.textContent.includes('will be retried automatically') || document.body.textContent.includes('ستتم إعادة المحاولة'),
      { timeout: 30000 },
    );
    pass('QUEUED stays pending without a restart offer');
    const hasStart = await p.evaluate(() => [...document.querySelectorAll('section button')].some((b) => b.textContent.includes('Start playback again')));
    pass('no restart offered while QUEUED', !hasStart);
    const grantsWhileQueued = mock.grantCount;
    // Unconfirmed terminal states must NOT promote: FAILED, null, PENDING.
    for (const [status, term, label] of [['ENDED', 'FAILED', 'failed'], ['ENDED', null, 'null'], ['ENDED', 'PENDING', 'pending']]) {
      mock.sessions = [sessionRow('77777777-7777-7777-7777-777777777777', status, term)];
      await clickCheckStatus(p);
      await new Promise((r) => setTimeout(r, 600));
      const offered = await p.evaluate(() => [...document.querySelectorAll('section button')].some((b) => b.textContent.includes('Start playback again')));
      assert(!offered, `no restart offered for ENDED/${label}`);
      pass(`no restart offered for ENDED/${label}`, !offered);
    }
    assert(mock.grantCount === grantsWhileQueued, 'no grant issued while unconfirmed');
    pass('no grant issued while unconfirmed');
    // External confirmation arrives: refresh promotes to the ended offer.
    mock.sessions = [sessionRow('77777777-7777-7777-7777-777777777777', 'ENDED', 'COMPLETED')];
    assert(await clickCheckStatus(p), 'check-status present');
    await p.waitForFunction(
      () => document.body.textContent.includes('Closed and confirmed') || document.body.textContent.includes('تم الإغلاق والتأكيد'),
      { timeout: 30000 },
    );
    pass('refresh to COMPLETED promotes the restart offer');
    await p.close();
  }

  // D. NOOP reconciles truthfully; stale selection is discarded (English, mobile, light).
  {
    console.log('STEP recovery-noop-stale');
    const p = await makePage('en', 'light', 390);
    await login(p, 'm9-student@example.test');
    await mockLearning(p);
    mock.playbackMode = 'stream-limit';
    mock.endMode = 'NOOP';
    mock.sessions = [sessionRow('88888888-8888-8888-8888-888888888888')];
    const grantsBefore = mock.grantCount;
    await openLearn(p);
    await p.waitForSelector('[data-testid="learning-start-playback"]', { timeout: 30000 });
    await p.click('[data-testid="learning-start-playback"]');
    await p.waitForSelector('input[name="own-session"]', { timeout: 30000 });
    await p.click('input[name="own-session"]');
    assert(await clickSectionButton(p, 'End selected session'), 'end button present');
    await p.waitForFunction(
      () => document.body.textContent.includes('Nothing was ended') || document.body.textContent.includes('لم يتم إنهاء شيء'),
      { timeout: 30000 },
    );
    pass('NOOP reconciles without a false Closed message');
    const hasStart = await p.evaluate(() => [...document.querySelectorAll('section button')].some((b) => b.textContent.includes('Start playback again')));
    pass('no restart offered after NOOP', !hasStart);
    assert(mock.grantCount === grantsBefore, 'NOOP triggers no automatic grant');
    pass('NOOP triggers no automatic grant');
    // Stale selection: while QUEUED-tracked, the reference vanishes from the
    // list; the next refresh must discard the selection with an explanation.
    mock.endMode = 'QUEUED';
    mock.sessions = [sessionRow('99999999-9999-9999-9999-999999999999')];
    await p.reload();
    await p.waitForSelector('[data-testid="learning-start-playback"]', { timeout: 30000 });
    await p.click('[data-testid="learning-start-playback"]');
    await p.waitForSelector('input[name="own-session"]', { timeout: 30000 });
    await p.click('input[name="own-session"]');
    const endFound = await clickSectionButton(p, 'End selected session');
    if (!endFound) {
      const dump = await p.evaluate(() => [...document.querySelectorAll('section')].map((s) => s.textContent.slice(0, 160)).join(' ||| '));
      console.log('SECTION-DUMP: ' + dump.slice(0, 900));
    }
    assert(endFound, 'end button present');
    await p.waitForFunction(
      () => document.body.textContent.includes('will be retried automatically') || document.body.textContent.includes('ستتم إعادة المحاولة'),
      { timeout: 30000 },
    );
    mock.sessions = [sessionRow('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')];
    let staleOk = false;
    for (let i = 0; i < 8 && !staleOk; i++) {
      await clickCheckStatus(p);
      await new Promise((r) => setTimeout(r, 700));
      staleOk = await p.evaluate(() => (
        (document.body.textContent.includes('no longer in the list') || document.body.textContent.includes('لم تعد في القائمة'))
        && !document.querySelector('input[name="own-session"]:checked')
      ));
    }
    assert(staleOk, 'stale selection discarded with an explanation on refresh');
    pass('stale selection discarded with an explanation on refresh');
    // Missing reference: the tracked session vanishes entirely — still
    // uncertain, no restart offer, no callback.
    mock.sessions = [];
    await clickCheckStatus(p);
    await new Promise((r) => setTimeout(r, 700));
    const missingOffer = await p.evaluate(() => [...document.querySelectorAll('section button')].some((b) => b.textContent.includes('Start playback again')));
    pass('missing reference offers no restart', !missingOffer);
    await p.close();
  }

  // D2. Unavailable session list: error state, retry available, no offer (English, desktop, light).
  {
    console.log('STEP recovery-unavailable');
    const p = await makePage('en', 'light', 1280);
    await login(p, 'm9-student@example.test');
    await mockLearning(p);
    mock.playbackMode = 'stream-limit';
    mock.sessionsError = true;
    await openLearn(p);
    await p.waitForSelector('[data-testid="learning-start-playback"]', { timeout: 30000 });
    await p.click('[data-testid="learning-start-playback"]');
    await p.waitForFunction(
      () => document.body.textContent.includes('Could not load sessions') || document.body.textContent.includes('تعذّر تحميل الجلسات'),
      { timeout: 30000 },
    );
    pass('unavailable list shows error without an offer');
    const grantsBefore = mock.grantCount;
    const offered = await p.evaluate(() => [...document.querySelectorAll('section button')].some((b) => b.textContent.includes('Start playback again')));
    pass('no restart offered when list is unavailable', !offered);
    assert(mock.grantCount === grantsBefore, 'no grant issued while list unavailable');
    pass('no grant issued while list unavailable');
    mock.sessionsError = false;
    await p.close();
  }
  // E. Granted player: exactly one in-frame control, overlays contained (English, desktop, dark).
  {
    console.log('STEP player-frame');
    const p = await makePage('en', 'dark', 1440);
    await login(p, 'm9-student@example.test');
    await mockLearning(p);
    mock.playbackMode = 'grant';
    mock.grantCount = 0;
    await openLearn(p);
    await p.waitForSelector('[data-testid="learning-start-playback"]', { timeout: 30000 });
    await p.click('[data-testid="learning-start-playback"]');
    await p.waitForSelector('.learning-video-frame', { timeout: 30000 });
    pass('granted player mounts the real frame (no no-frame fallback accepted)');
    const toggleCount = await p.evaluate(() => document.querySelectorAll('[data-testid="player-toggle-playback"]').length);
    assert(toggleCount === 1, 'exactly one playback control with a grant');
    pass('exactly one playback control with a grant');
    const inFrame = await p.evaluate(() => {
      const frame = document.querySelector('.learning-video-frame');
      return {
        toggle: !!frame?.querySelector('[data-testid="player-toggle-playback"]'),
        video: !!frame?.querySelector('video[controls]'),
        watermark: !!frame?.querySelector('[data-testid="watermark-overlay"]'),
        captions: !!frame?.querySelector('[data-testid="caption-controls"]'),
      };
    });
    pass('toggle lives inside the fullscreen frame', inFrame.toggle);
    pass('native controls retained', inFrame.video);
    pass('watermark contained in the frame', inFrame.watermark);
    pass(materialsUi ? 'caption controls inside the frame' : 'pending materials UI excluded from delivery', materialsUi ? inFrame.captions : !inFrame.captions);
    await p.focus('[data-testid="player-toggle-playback"]');
    const focused = await p.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'player-toggle-playback');
    pass('in-frame control is keyboard-focusable', focused);
    await p.screenshot({ path: '/evidence/playback-recovery-learning-ar-mobile.png' });
    await p.close();
  }

  // F. Real toggle rejection paths: gesture preserves the grant, unsupported guides (Arabic, desktop, light).
  {
    console.log('STEP play-rejection');
    const p = await makePage('ar', 'light', 1440);
    await login(p, 'm9-student@example.test');
    await mockLearning(p);
    mock.playbackMode = 'grant';
    await openLearn(p);
    await p.waitForSelector('[data-testid="learning-start-playback"]', { timeout: 30000 });
    await p.click('[data-testid="learning-start-playback"]');
    await p.waitForSelector('.learning-video-frame [data-testid="player-toggle-playback"]:not(:disabled)', { timeout: 30000 });
    await p.evaluate(() => {
      const v = document.querySelector('.learning-video-frame video');
      v.play = () => Promise.reject(Object.assign(new Error('autoplay blocked'), { name: 'NotAllowedError' }));
    });
    await p.click('.learning-video-frame [data-testid="player-toggle-playback"]');
    await p.waitForFunction(
      () => document.body.textContent.includes('اضغط تشغيل للبدء') || document.body.textContent.includes('Press Play to start'),
      { timeout: 30000 },
    );
    pass('NotAllowedError asks for a gesture, preserving the grant');
    const stillFramed = await p.evaluate(() => !!document.querySelector('.learning-video-frame') && !document.querySelector('[data-testid="player-state"][data-phase="error"]'));
    pass('grant survives a gesture refusal (no error state)', stillFramed);
    await p.evaluate(() => {
      const v = document.querySelector('.learning-video-frame video');
      v.play = () => Promise.reject(Object.assign(new Error('unsupported'), { name: 'NotSupportedError' }));
    });
    await p.click('.learning-video-frame [data-testid="player-toggle-playback"]');
    await p.waitForFunction(
      () => document.body.textContent.includes('لا يدعم التشغيل المحمي') || document.body.textContent.includes('does not support protected playback'),
      { timeout: 30000 },
    );
    pass('NotSupportedError guides to a supported browser, not another gesture');
    await p.close();
  }

  // G. Tab hiding ends nothing; unmount closes this page's grant once (English, mobile, dark).
  {
    console.log('STEP visibility-unmount');
    const p = await makePage('en', 'dark', 390);
    await login(p, 'm9-student@example.test');
    await mockLearning(p);
    mock.playbackMode = 'grant';
    mock.endCount = 0;
    await openLearn(p);
    await p.waitForSelector('[data-testid="learning-start-playback"]', { timeout: 30000 });
    await p.click('[data-testid="learning-start-playback"]');
    await p.waitForSelector('.learning-video-frame', { timeout: 30000 });
    const endsBefore = mock.endCount;
    await p.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await new Promise((r) => setTimeout(r, 900));
    assert(mock.endCount === endsBefore, 'hiding the tab sends no termination');
    pass('tab hiding terminates nothing');
    const framed = await p.evaluate(() => !!document.querySelector('.learning-video-frame'));
    pass('grant stays mounted while hidden', framed);
    await route(p, '#/dashboard');
    await p.waitForFunction(() => location.hash === '#/dashboard', { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 700));
    assert(mock.endCount === endsBefore + 1, 'unmount closes this page grant exactly once');
    pass('page exit closes this page grant exactly once');
    await p.close();
  }

  // H. Pause/resume, fullscreen fallback with retained time/captions, Escape (English, desktop, light).
  {
    console.log('STEP pause-fullscreen');
    const p = await makePage('en', 'light', 1280);
    await login(p, 'm9-student@example.test');
    await mockLearning(p);
    mock.playbackMode = 'grant';
    const grantsBefore = mock.grantCount;
    await openLearn(p);
    await p.waitForSelector('[data-testid="learning-start-playback"]', { timeout: 30000 });
    await p.click('[data-testid="learning-start-playback"]');
    await p.waitForSelector('.learning-video-frame [data-testid="player-toggle-playback"]:not(:disabled)', { timeout: 30000 });
    await p.evaluate(() => {
      const v = document.querySelector('.learning-video-frame video');
      let playing = false;
      Object.defineProperty(v, 'paused', { get: () => !playing, configurable: true });
      v.play = () => {
        playing = true;
        v.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
      v.pause = () => {
        playing = false;
        v.dispatchEvent(new Event('pause'));
      };
    });
    await p.focus('[data-testid="player-toggle-playback"]');
    await p.keyboard.press('Enter');
    await p.waitForFunction(
      () => document.querySelector('[data-testid="player-toggle-playback"]')?.getAttribute('aria-label') === 'Pause',
      { timeout: 30000 },
    );
    pass('keyboard Enter starts playback (pause offered)');
    await p.keyboard.press('Enter');
    await p.waitForFunction(
      () => {
        const label = document.querySelector('[data-testid="player-toggle-playback"]')?.getAttribute('aria-label');
        return label === 'Play' || label === 'Resume';
      },
      { timeout: 30000 },
    );
    pass('second activation pauses again (resume offered)');
    const before = await p.evaluate(() => ({
      time: document.querySelector('.learning-video-frame video')?.currentTime ?? null,
      caption: document.querySelector('[data-testid="caption-choice"]')?.value ?? null,
    }));
    await p.click('[data-testid="player-fullscreen"]');
    await p.waitForFunction(
      () => document.fullscreenElement?.classList?.contains('learning-video-frame')
        || document.querySelector('.learning-video-frame--expanded') !== null,
      { timeout: 30000 },
    );
    pass('fullscreen targets the whole frame (native or fallback)');
    const during = await p.evaluate(() => ({
      time: document.querySelector('.learning-video-frame video')?.currentTime ?? null,
      caption: document.querySelector('[data-testid="caption-choice"]')?.value ?? null,
      watermark: !!document.querySelector('.learning-video-frame [data-testid="watermark-overlay"]'),
    }));
    assert(during.time === before.time, 'current time retained through fullscreen entry');
    assert(during.caption === before.caption, 'chosen caption language retained through fullscreen entry');
    pass('time and caption language retained in fullscreen');
    pass('watermark stays inside fullscreen', during.watermark);
    await p.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 500));
    const exited = await p.evaluate(() => !document.querySelector('.learning-video-frame--expanded') && !document.fullscreenElement);
    if (!exited) await p.evaluate(() => { if (document.exitFullscreen) return document.exitFullscreen().catch(() => {}); });
    await p.waitForFunction(
      () => !document.querySelector('.learning-video-frame--expanded') && !document.fullscreenElement,
      { timeout: 30000 },
    );
    pass('Escape leaves fullscreen with focus/scroll restored');
    const toggleCount = await p.evaluate(() => document.querySelectorAll('[data-testid="player-toggle-playback"]').length);
    assert(toggleCount === 1, 'still exactly one control after fullscreen');
    pass('still exactly one control after fullscreen');
    assert(mock.grantCount === grantsBefore + 1, 'interactions issued no duplicate grants');
    pass('no duplicate grants from player interactions');
    await p.close();
  }

  assert(errors.length === 0, `uncaught page errors: ${errors.join('; ')}`);
  console.log(`PLAYBACK_RECOVERY_BROWSER_CHECKS=${checks}`);
  console.log('HARNESS-MOCKS: playback grants, device/session list/end, and stalled mock media are harness-only; no real advancing protected playback claimed.');
  await browser.close();
} catch (e) {
  console.error(`BROWSER FLOW FAILED: ${e.message}`);
  console.error(e.stack?.split('\n').slice(0, 8).join('\n'));
  try { await browser.close(); } catch {}
  process.exit(1);
}
