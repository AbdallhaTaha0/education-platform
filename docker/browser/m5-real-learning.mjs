/** Real-DRM browser learning experience (TEST-ONLY, disposable verification).
 *
 * Runs inside the containerized Chromium image against the isolated platform
 * (http://localhost:8082 via Chromium resolver mapping) with the real DRM
 * service behind playback (ClearKey via RS256 platform assertions, never the
 * fixture). Flow: API setup (student, bilingual course with TWO lessons,
 * plan, media x2, publish, fund, purchase) -> UI login -> error-state probe
 * (aborted manifest) -> real playback with advancing time -> pause/resume ->
 * saved progress -> platform renewal preserving playback -> lesson switch
 * ending the previous session -> expiry marker for the host fixture ->
 * stopped playback with renewal state -> watermark matrix -> cleanup
 * (session ends, course/media delete, logouts) -> screenshots to /evidence.
 *
 * Receives ignored local credentials via a temporary env-file; prints safe scalars only.
 * Screenshot pixels carry only the masked watermark identity. Expects:
 *   REPO=/repo, MEDIA_PATH, ISO_FILE, ISO_DONE_FILE, EVIDENCE_DIR,
 *   RESOLVER_IP (host gateway for the localhost origin mapping).
 */
import { randomInt, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import {
  expect,
  recordFail,
  summary,
  configureSensitiveValues,
} from '/repo/docker/verification/lib/safe-log.mjs';
import puppeteer from 'puppeteer-core';
import { PlatformClient } from '/repo/docker/verification/lib/platform.mjs';

const ORIGIN = 'http://localhost:8082';
const API_BASE = 'http://host.docker.internal:8082';
const RESOLVER_IP = process.env.RESOLVER_IP || '192.168.65.254';
const MEDIA_PATH = process.env.MEDIA_PATH || '/media/probe.mp4';
const EVIDENCE = process.env.EVIDENCE_DIR || '/tmp/evidence';

const secrets = process.env;
configureSensitiveValues(
  Object.values(secrets).filter((v) => typeof v === 'string' && v.length > 24),
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function check(label, cond, extra = '') {
  expect(`browser-${label}`, cond, { note: extra });
  if (!cond) throw new Error(`check:${label}`);
}
let browser = null;
let page = null;
const mediaStatuses = [];
const manifestFacts = [];
let courseId = null;
let deletionCompleted = false;
const grantRefs = [];
const platform = new PlatformClient({ baseUrl: API_BASE, origin: ORIGIN });
const student = new PlatformClient({ baseUrl: API_BASE, origin: ORIGIN });
const runId = randomBytes(6).toString('hex');
const shortId = runId.slice(-8);

try {
  // ---- API setup ----
  const adminLogin = await platform.login(
    secrets.VERIFY_ADMIN_IDENTIFIER,
    secrets.VERIFY_ADMIN_PASSWORD,
  );
  check('admin-login', adminLogin.status === 200, `status=${adminLogin.status}`);
  const studentPhone = `+201${randomInt(100000000, 999999999)}`;
  const studentPassword = `Fayq-bw-${shortId}-pw12`;
  {
    const r = await student.register({
      displayName: 'FAYQ Browser Student',
      email: `fayq-m5-bw-${shortId}@example.test`,
      phone: studentPhone,
      password: studentPassword,
    });
    check('student-register', r.status === 201, `status=${r.status}`);
  }
  const slug = `fayq-m5-bw-${shortId}`;
  const course = await platform.createCourse({
    slug,
    titleAr: `متصفح ${shortId}`,
    titleEn: `Browser ${shortId}`,
    descriptionAr: `وصف ${shortId}`,
    descriptionEn: `Description ${shortId}`,
  });
  courseId = course.json?.data?.course?.id;
  check('course', course.status === 201, `status=${course.status}`);
  const section = await platform.createSection(courseId, {
    titleAr: `قسم ${shortId}`,
    titleEn: `Section ${shortId}`,
    position: 1,
  });
  const sectionId = section.json?.data?.section?.id;
  const lessonIds = [];
  for (let i = 1; i <= 2; i += 1) {
    const lesson = await platform.createLesson(sectionId, {
      titleAr: `درس ${shortId}-${i}`,
      titleEn: `Lesson ${shortId}-${i}`,
      position: i,
    });
    lessonIds.push(lesson.json?.data?.lesson?.id);
  }
  const plan = await platform.createPlan(courseId, {
    currentPricePiastres: 6000,
    durationDays: 30,
  });
  const planId = plan.json?.data?.plan?.id;
  check('plan', plan.status === 201, `status=${plan.status}`);
  const video = await readFile(MEDIA_PATH);
  for (const lessonId of lessonIds) {
    const reg = await platform.registerLessonMedia(lessonId, {
      contentType: 'video/mp4',
      title: 'Browser verification',
    });
    check('media-register', reg.status === 201);
    const uploadUrl = reg.json?.data?.uploadUrl;
    const uploaded = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
      body: video,
      signal: AbortSignal.timeout(90000),
    });
    check('media-upload', uploaded.status === 200);
    const complete = await platform.completeLessonMedia(lessonId);
    check('media-complete', complete.status === 200);
  }
  let ready = false;
  for (const lessonId of lessonIds) {
    ready = false;
    for (let i = 0; i < 120 && !ready; i += 1) {
      const sync = await platform.syncLessonMedia(lessonId);
      ready = sync.json?.data?.mapping?.status === 'READY';
      if (!ready) await sleep(5000);
    }
    if (!ready) break;
  }
  check('media-ready', ready, '');
  for (const to of ['PROCESSING', 'READY', 'PUBLISHED']) {
    const tr = await platform.transitionCourse(courseId, to);
    if (tr.status !== 200) check(`publish-${to}`, false, `status=${tr.status}`);
  }
  check('published', true, '');
  const recharge = await student.submitRecharge({
    amountPiastres: 10000,
    channel: 'INSTAPAY',
    reference: `FAYQ-M5-BW-${shortId}`,
    senderName: 'FAYQ Verification',
    senderPhone: studentPhone,
    transferDate: '2026-09-29T10:00:00.000Z',
    proofFilename: 'receipt.png',
    proofMime: 'image/png',
    proofBase64:
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    idempotencyKey: `bw-recharge-${shortId}`,
  });
  const requestId = recharge.json?.data?.id ?? recharge.json?.data?.request?.id;
  await platform.reviewRecharge(requestId, { decision: 'APPROVE', receiptVerified: true });
  const wallet = await student.walletBalance();
  check('funded', wallet.json?.data?.balancePiastres === 10000, `status=${wallet.status}`);
  const purchase = await student.purchase({ planId, idempotencyKey: `bw-purchase-${shortId}` });
  check('purchase', purchase.status === 201, `status=${purchase.status}`);
  // ---- Chromium ----
  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required',
      `--host-resolver-rules=MAP localhost ${RESOLVER_IP}`,
    ],
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const renewHits = [];
  const endHits = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes(':3000/') && !url.endsWith('/health'))
      mediaStatuses.push({
        status: res.status(),
        kind: url.includes('manifest')
          ? 'manifest'
          : url.includes('license')
            ? 'license'
            : 'segment',
        requested: res.request().headers()['access-control-request-headers'] || '',
        allowed: res.headers()['access-control-allow-headers'] || '',
      });
    try {
      if (url.includes(':3000/') && url.endsWith('.mpd') && res.status() === 200) {
        const root = (await res.text()).match(/<MPD\b[^>]*>/)?.[0] || '';
        manifestFacts.push({
          static: /\btype="static"/.test(root),
          finiteDuration: /\bmediaPresentationDuration="PT[^"]+"/.test(root),
        });
      }
      if (url.includes('/api/learning/playback/') && url.endsWith('/renew'))
        renewHits.push(res.status());
      if (url.includes('/api/learning/playback/') && url.endsWith('/end'))
        endHits.push(res.status());
      if (
        url.includes('/api/learning/courses/') &&
        url.endsWith('/playback') &&
        res.request().method() === 'POST'
      ) {
        const body = await res.json().catch(() => ({}));
        const ref = body?.data?.playback?.referenceId;
        if (typeof ref === 'string' && ref.length > 0) grantRefs.push(ref);
      }
    } catch {
      /* observability only */
    }
  });
  const consoleErrors = [];
  page.on('requestfailed', (request) => {
    if (request.url().includes(':3000/')) mediaStatuses.push({ status: 0, kind: 'network-failed' });
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(String(err && err.message ? err.message : err).slice(0, 120));
  });
  async function endLastGrant() {
    const ref = grantRefs[grantRefs.length - 1];
    if (!ref) return false;
    const res = await student.endPlayback(ref);
    return res.status === 200;
  }
  async function uiText(selector, timeout = 30000) {
    await page.waitForSelector(selector, { timeout });
    return page.$eval(selector, (el) => el.textContent || '');
  }
  await page.goto(`${ORIGIN}/#/login`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.type('input[name="username"]', `fayq-m5-bw-${shortId}@example.test`);
  await page.type('input[name="current-password"]', studentPassword);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
    page.click('button[type="submit"]'),
  ]);
  check(
    'ui-login',
    (page.url() || '').includes('#/'),
    `hash=${(page.url().split('#')[1] || '').slice(0, 20)}`,
  );

  await page.goto(`${ORIGIN}/#/learn/${slug}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector(
    '[data-testid="lesson-row"], [data-testid="renewal-required"], [data-testid="learning-error"]',
    { timeout: 60000 },
  );
  check('learn-page-loads', true, '');
  const gatedEarly = await page.evaluate(
    () =>
      !!document.querySelector('[data-testid="renewal-required"], [data-testid="learning-error"]'),
  );
  check('learn-page-entitled', !gatedEarly, '');
  await page.waitForSelector('[data-testid="lesson-row"]', { timeout: 60000 });
  const lessonRows = await page.$$('[data-testid="lesson-row"]');
  check('outline-two-lessons', lessonRows.length >= 2, `rows=${lessonRows.length}`);

  // ---- error state first: abort manifests, start, expect visible error ----
  await page.setRequestInterception(true);
  const abortHandler = (req) => {
    if (req.url().endsWith('.mpd')) void req.abort();
    else void req.continue();
  };
  page.on('request', abortHandler);
  await lessonRows[0].click();
  await page.waitForSelector('[data-testid="learning-start-playback"]', { timeout: 30000 });
  await page.click('[data-testid="learning-start-playback"]');
  await page.waitForSelector('[data-testid="player-state"][data-phase="error"]', {
    timeout: 90000,
  });
  const errState = await uiText('[data-testid="player-state"]');
  check('error-state-visible', errState.length > 0, '');
  check('error-watermark-visible', !!(await page.$('[data-testid="watermark-overlay"]')), '');
  const failedReference = await page.$eval('[data-reference-id]', (el) =>
    el.getAttribute('data-reference-id'),
  );
  const retryEndsBefore = endHits.length;
  await page.setRequestInterception(false);
  page.off('request', abortHandler);
  mediaStatuses.length = 0;
  manifestFacts.length = 0;
  await page.click('[data-testid="player-retry"]');
  await page.waitForFunction(
    (old) => {
      const ref = document.querySelector('[data-reference-id]')?.getAttribute('data-reference-id');
      return Boolean(ref && ref !== old);
    },
    { timeout: 30000 },
    failedReference,
  );
  check('retry-creates-new-grant', true);
  check('error-session-ended', endHits.length > retryEndsBefore && endHits.at(-1) === 200);
  check(
    'player-mounted',
    (await page.$('video')) !== null,
    `consoleErrors=${consoleErrors.length}`,
  );
  await page.waitForSelector('video', { timeout: 15000 });
  await page.waitForSelector('[data-testid="watermark-overlay"]', { timeout: 60000 });
  await page.waitForFunction(
    () =>
      document.querySelector('video')?.readyState >= 1 ||
      !!document.querySelector('[data-phase="error"]'),
    { timeout: 30000 },
  );
  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) v.muted = true;
  });
  await page.click('[data-testid="player-toggle-playback"]');
  await page.waitForFunction(
    () =>
      document.querySelector('video')?.readyState >= 2 ||
      !!document.querySelector('[data-phase="error"]'),
    { timeout: 30000 },
  );
  const readiness = await page.evaluate(() => ({
    ready: document.querySelector('video')?.readyState,
    code: document.querySelector('[data-phase="error"]')?.getAttribute('data-code'),
  }));
  check('decoded-video-ready', readiness.ready >= 2, `code=${readiness.code ?? 'none'}`);
  check(
    'recorded-static-manifests',
    manifestFacts.length > 0 && manifestFacts.every((m) => m.static && m.finiteDuration),
  );
  const t0 = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
  await sleep(9000);
  const t1 = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
  check('video-time-advances', t1 > t0, `t0=${Math.floor(t0)} t1=${Math.floor(t1)}`);

  // pause / resume
  await page.evaluate(() => document.querySelector('video')?.pause());
  await sleep(1500);
  const pausedState = await page.evaluate(() => ({
    paused: document.querySelector('video')?.paused ?? null,
    t: document.querySelector('video')?.currentTime ?? -1,
  }));
  await sleep(2500);
  const frozenState = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
  await page.click('[data-testid="player-toggle-playback"]');
  await sleep(4000);
  const resumedState = await page.evaluate(
    () => document.querySelector('video')?.currentTime ?? -1,
  );
  check('pause-freezes', pausedState.paused === true && frozenState === pausedState.t, '');
  check('resume-advances', resumedState > frozenState, '');

  // saved progress proven through the outline resume position
  await sleep(12000);
  const outlineAfter = await page.evaluate(async (origin) => {
    const res = await fetch(
      `${origin}/api/learning/courses/${encodeURIComponent(window.location.hash.split('/learn/')[1] || '')}/outline`,
    );
    const j = await res.json().catch(() => ({}));
    const lessons = (j?.data?.sections || []).flatMap((s) => s.lessons || []);
    return {
      status: res.status,
      lessons: lessons.map((l) => ({
        id: l.lessonId,
        pos: l.resumePositionSeconds ?? null,
        completed: !!l.completed,
      })),
    };
  }, ORIGIN);
  const savedPos = outlineAfter.lessons.find((l) => (l.pos ?? 0) > 0);
  check(
    'progress-saved',
    outlineAfter.status === 200 && Boolean(savedPos),
    `status=${outlineAfter.status}`,
  );

  // renewal preserves playback (TTL 60 preset by host; renew ~40 s in)
  const renewSeen = await new Promise((resolve) => {
    const iv = setInterval(() => {
      if (renewHits.length > 0) {
        clearInterval(iv);
        resolve(true);
      }
    }, 2000);
    setTimeout(() => {
      clearInterval(iv);
      resolve(renewHits.length > 0);
    }, 100000);
  });
  check(
    'renew-requested',
    renewSeen && renewHits.every((status) => status === 200),
    `hits=${renewHits.join(',')}`,
  );
  const sameVideo = await page.evaluate(() => {
    const vids = document.querySelectorAll('video');
    return vids.length;
  });
  const t2 = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
  await sleep(6000);
  const t3 = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
  check('renewal-preserves-playback', sameVideo === 1 && t3 > t2, `videos=${sameVideo}`);
  const errAfterRenew = await page.evaluate(
    () => document.querySelector('[data-testid="player-state"]')?.textContent || 'none',
  );
  check('no-error-after-renew', !/error/i.test(errAfterRenew), '');

  // Normal navigation closes the session; reopening restores saved progress.
  const navEnds = endHits.length;
  await page.evaluate(() => {
    window.location.hash = '/dashboard';
  });
  await page.waitForFunction(() => !document.querySelector('video'), { timeout: 15000 });
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="dashboard-active"]') ||
      window.location.hash === '#/dashboard',
    { timeout: 15000 },
  );
  await sleep(2000);
  check('navigation-ends-session', endHits.length > navEnds && endHits.at(-1) === 200);
  await page.goto(`${ORIGIN}/#/learn/${slug}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="learning-start-playback"]');
  await page.click('[data-testid="learning-start-playback"]');
  await page.waitForSelector('video');
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1, {
    timeout: 30000,
  });
  await page.evaluate(() => {
    document.querySelector('video').muted = true;
  });
  await page.click('[data-testid="player-toggle-playback"]');
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2, {
    timeout: 30000,
  });
  await page.evaluate(() => {
    const v = document.querySelector('video');
    v.muted = true;
    return v.play();
  });
  await sleep(2000);
  const restoredPosition = await page.evaluate(() => document.querySelector('video').currentTime);
  check('saved-progress-restored', restoredPosition >= savedPos.pos - 3);

  // lesson switch ends previous session
  const endsBefore = endHits.length;
  const rows2 = await page.$$('[data-testid="lesson-row"]');
  await rows2[1].click();
  await page.waitForSelector('[data-testid="learning-start-playback"]', { timeout: 30000 });
  await page.click('[data-testid="learning-start-playback"]');
  await page.waitForSelector('video', { timeout: 90000 });
  await sleep(4000);
  check(
    'lesson-switch-ends-previous',
    endHits.length > endsBefore && endHits.every((s) => s === 200),
    `ends=${endHits.join(',')}`,
  );
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1, {
    timeout: 30000,
  });
  await page.evaluate(() => {
    document.querySelector('video').muted = true;
  });
  await page.click('[data-testid="player-toggle-playback"]');
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2, {
    timeout: 60000,
  });
  await page.evaluate(() => document.querySelector('video').play());
  const t4 = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
  await sleep(5000);
  const t5 = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
  check('second-lesson-plays', t5 > t4, '');

  // screenshots during healthy playback
  await page.screenshot({ path: `${EVIDENCE}/bw-playing.png` });
  const wmShot = await page.$('[data-testid="watermark-overlay"]');
  if (wmShot) await wmShot.screenshot({ path: `${EVIDENCE}/bw-watermark.png` });
  check('screenshots-captured', true, '');
  const persistedKeys = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  check(
    'credential-storage-clear',
    persistedKeys.local.every((k) => ['edu-platform-lang', 'edu-platform-theme'].includes(k)) &&
      persistedKeys.session.every((k) => k === 'edu-learning-device'),
    `local=${persistedKeys.local.length} session=${persistedKeys.session.length}`,
  );

  // ---- watermark matrix (healthy player) ----
  await page.$eval('video', (v) => v.scrollIntoView({ block: 'center' }));
  async function watermarkFacts() {
    return page.evaluate(() => {
      const overlay = document.querySelector('[data-testid="watermark-overlay"]');
      const label = document.querySelector('[data-testid="watermark-label"]');
      if (!overlay || !label) return { present: false };
      const r = overlay.getBoundingClientRect();
      const fr =
        document
          .querySelector('[data-testid="player-state"]')
          ?.parentElement?.getBoundingClientRect() || r;
      const cs = getComputedStyle(overlay);
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      const text = label.textContent || '';
      return {
        present: true,
        labels: document.querySelectorAll('[data-testid="watermark-label"]').length,
        masked: text.includes('*') || text.includes('•'),
        exposesEmail: /@/.test(text),
        ariaHidden: overlay.getAttribute('aria-hidden') === 'true',
        pointerNone: cs.pointerEvents === 'none',
        hitIsVideo: hit instanceof HTMLVideoElement,
        overflowX: Math.max(0, Math.round(r.right - window.innerWidth)),
        width: Math.round(r.width),
        dir: document.documentElement.getAttribute('dir'),
        labelDir: label.getAttribute('dir'),
      };
    });
  }
  const wmAr = await watermarkFacts();
  check(
    'watermark-ar-visible-masked',
    wmAr.present && wmAr.labels > 0 && wmAr.labels <= 12 && wmAr.masked && !wmAr.exposesEmail,
    `labels=${wmAr.labels}`,
  );
  check('watermark-unobstructive', wmAr.ariaHidden && wmAr.pointerNone && wmAr.hitIsVideo, '');
  check('watermark-ar-rtl', wmAr.dir === 'rtl', `dir=${wmAr.dir}`);
  await page.click('.lang-switch button:last-child');
  await sleep(1500);
  const wmEn = await watermarkFacts();
  check(
    'watermark-en-visible',
    wmEn.present && wmEn.masked && wmEn.dir === 'ltr',
    `dir=${wmEn.dir}`,
  );
  await page.click('.lang-switch button:first-child');
  await sleep(1500);
  const themeBefore = await page.evaluate(() =>
    document.querySelector('header button[aria-pressed]')?.getAttribute('aria-pressed'),
  );
  await page.click('header button[aria-pressed]');
  await sleep(1500);
  const themeAfter = await page.evaluate(() =>
    document.querySelector('header button[aria-pressed]')?.getAttribute('aria-pressed'),
  );
  const wmTheme = await watermarkFacts();
  check('watermark-across-theme', themeBefore !== themeAfter && wmTheme.present, '');
  await page.setViewport({ width: 390, height: 700 });
  await sleep(1500);
  const wmMobile = await watermarkFacts();
  check(
    'watermark-mobile-fits',
    wmMobile.present && wmMobile.overflowX === 0,
    `overflow=${wmMobile.overflowX}`,
  );
  await page.setViewport({ width: 1280, height: 800 });
  await page.click('[data-testid="player-fullscreen"]');
  await page.waitForFunction(() => Boolean(document.fullscreenElement), { timeout: 15000 });
  const fsResult = await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="watermark-overlay"]');
    const rect = overlay?.getBoundingClientRect();
    return document.fullscreenElement?.contains(overlay) && rect?.width > 0 ? 'visible' : 'hidden';
  });
  await page.click('[data-testid="player-fullscreen"]');
  await page.waitForFunction(() => !document.fullscreenElement, { timeout: 15000 });
  check('watermark-fullscreen', fsResult === 'visible', `state=${fsResult}`);

  for (const width of [1280, 390]) {
    await page.setViewport({ width, height: 800 });
    for (const language of ['ar', 'en']) {
      await page.click(`.lang-switch button:${language === 'ar' ? 'first-child' : 'last-child'}`);
      for (let theme = 0; theme < 2; theme++) {
        await page.click('header button[aria-pressed]');
        await page.$eval('video', (v) => v.scrollIntoView({ block: 'center' }));
        const facts = await watermarkFacts();
        check(
          `matrix-${width}-${language}-${theme}`,
          facts.present &&
            facts.masked &&
            facts.pointerNone &&
            facts.overflowX === 0 &&
            facts.dir === (language === 'ar' ? 'rtl' : 'ltr'),
        );
      }
    }
  }
  // ---- expiry: ask host to move subscription, wait for stop + renewal state ----
  const meRes = await student.call('GET', '/api/auth/me', { withCsrf: false });
  const studentId = meRes.json?.data?.user?.id;
  const subscriptionId = purchase.json?.data?.subscription?.id;
  check('expiry-identifiers-present', Boolean(subscriptionId && studentId && courseId));
  await writeFile(
    process.env.ISO_FILE,
    JSON.stringify({
      subscriptionId,
      studentId,
      courseId,
      targetIso: new Date(Date.now() + 5000).toISOString(),
    }),
  );
  let marker = false;
  for (let i = 0; i < 36 && !marker; i += 1) {
    try {
      const flag = JSON.parse(readFileSync(process.env.ISO_DONE_FILE, 'utf8'));
      marker = flag.done === true;
    } catch {
      /* not yet */
    }
    if (!marker) await sleep(5000);
  }
  check('expiry-fixture-marker', marker, '');
  const frozenAt = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
  await sleep(80000);
  const frozenLater = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
  const expiredState = await page.evaluate(
    () => document.querySelector('[data-testid="player-state"]')?.textContent || 'none',
  );
  check(
    'expiry-stops-playback',
    frozenLater === -1 || frozenLater === frozenAt || !!(await page.$('[data-phase="expired"]')),
    '',
  );
  await page.waitForSelector('[data-testid="renewal-required"]', { timeout: 15000 });
  check('expiry-shows-renewal', true, '');

  check('page-errors-absent', consoleErrors.length === 0, `count=${consoleErrors.length}`);
} catch (err) {
  if (page) {
    const state = await page
      .evaluate(() => ({
        phase: document.querySelector('[data-testid="player-state"]')?.getAttribute('data-phase'),
        code: document.querySelector('[data-testid="player-state"]')?.getAttribute('data-code'),
        ready: document.querySelector('video')?.readyState,
        paused: document.querySelector('video')?.paused,
        network: document.querySelector('video')?.networkState,
        buffered: document.querySelector('video')?.buffered.length,
        mediaError: document.querySelector('video')?.error?.code,
      }))
      .catch(() => ({}));
    expect('browser-failure-state', false, { note: JSON.stringify(state) });
    for (const status of mediaStatuses.slice(-20))
      expect(`browser-${status.kind}-response`, status.status >= 200 && status.status < 400, {
        status: status.status,
        note: `requested=${status.requested || ''} allowed=${status.allowed || ''}`,
      });
    await page.screenshot({ path: `${EVIDENCE}/bw-failed.png` }).catch(() => {});
  }
  recordFail('browser-aborted', {
    note: String(err?.message || '').startsWith('check:') ? err.message : err?.name || 'Error',
  });
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const ref of grantRefs) {
    const ended = await student.endPlayback(ref).catch(() => null);
    expect('browser-cleanup-session', ended?.status === 200, { status: ended?.status });
  }
  if (courseId) {
    const deletion = await platform.deleteCourse(courseId, courseId).catch(() => null);
    const operationId = deletion?.json?.data?.operation?.id;
    if (operationId) {
      for (let i = 0; i < 40 && !deletionCompleted; i++) {
        const state = await platform.readDeletion(operationId).catch(() => null);
        deletionCompleted = state?.json?.data?.operation?.status === 'COMPLETED';
        if (!deletionCompleted) await sleep(3000);
      }
    }
    expect('browser-cleanup-course', deletionCompleted);
  }
  const studentLogout = await student.logout().catch(() => null);
  const adminLogout = await platform.logout().catch(() => null);
  expect('browser-cleanup-student-logout', studentLogout?.status === 200);
  expect('browser-cleanup-admin-logout', adminLogout?.status === 200);
}
summary();
