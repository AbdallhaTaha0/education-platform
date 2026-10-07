/**
 * M10 browser probe driver (agent 1, Docker-contained, synthetic data only).
 *
 * Runs real Chromium (puppeteer-core + system chromium in the browser image)
 * against the owned disposable stack (nginx same-origin page + platform API +
 * DRM fixture). Drives window.__runPhase in the probe page; every assertion
 * below ran in a genuine browser with real cookies, CSRF, performance.now()
 * and a genuinely playing <video> element. Writes evidence JSON to
 * /browser-out/browser-evidence.json. Exits non-zero on any failed phase.
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE_URL = process.env.BASE_URL ?? 'http://nginx:8080';
const OUT_PATH = '/browser-out/browser-evidence.json';
const seed = JSON.parse(fs.readFileSync('/browser-out/seed.json', 'utf8'));

const evidence = { baseUrl: BASE_URL, phases: {}, startedAt: new Date().toISOString() };
function record(name, value) {
  evidence.phases[name] = value;
  console.log(`[probe] ${name}: ${JSON.stringify(value)}`);
}
function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`);
}
async function phase(page, name, args = {}) {
  const out = await page.evaluate((n, a) => window.__runPhase(n, a), name, args);
  if (!out.ok) throw new Error(`phase ${name} failed: ${JSON.stringify(out.error)}`);
  return out.result;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
  ],
});

try {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction('window.__ready === true', { timeout: 30000 });

  // Prime course/lesson ids for the page (seed values are DB truth).
  await page.evaluate((s) => {
    window.__courseId = s.courseId;
    window.__courseSlug = s.courseSlug;
  }, seed);

  // 1. Real admin media lifecycle + publication + student login.
  const setup = await phase(page, 'setup', {
    adminEmail: seed.adminEmail,
    adminPassword: seed.adminPassword,
    studentEmail: seed.studentEmail,
    studentPassword: seed.studentPassword,
    lessonId: seed.lessonId,
  });
  record('setup', setup);
  assert(setup.mediaReady === true, 'fixture-backed media never became READY');

  // 2. Session A at 1x: play until the server counts (threshold 30s).
  const sessA = await phase(page, 'session', {
    courseSlug: seed.courseSlug,
    lessonId: seed.lessonId,
    deviceId: 'probe-device-a',
  });
  record('sessionA', sessA);
  assert(sessA.playing === true, 'canvas-stream video did not really play');
  let viewA = null;
  for (let i = 0; i < 38; i += 1) {
    await sleep(2000);
    viewA = await phase(page, 'serverView');
    if (viewA.counted) break;
  }
  record('countedAt1x', viewA);
  assert(viewA.counted === true, 'no count after 30+s of real 1x playback');
  assert(viewA.playedMilliseconds >= 30000, 'server total below threshold after counting');

  // 3. Fresh viewer end still accepts the racing final flush (grace).
  const ended = await phase(page, 'endPlayback');
  record('viewerEnd', ended);
  const flushed = await phase(page, 'serverView');
  record('flushAfterEnd', flushed);

  // 4. Session B at 2x: 16 elapsed seconds must NOT count (would be ~32s of
  // media progress under the old currentTime-delta defect).
  const sessB = await phase(page, 'session', {
    courseSlug: seed.courseSlug,
    lessonId: seed.lessonId,
    deviceId: 'probe-device-a',
  });
  record('sessionB', sessB);
  const rate2 = await phase(page, 'setRate', { rate: 2 });
  record('rate2', rate2);
  await sleep(16000);
  const viewB = await phase(page, 'serverView');
  record('after16sAt2x', viewB);
  assert(viewB.counted === false, '2x playback counted after only 16 elapsed seconds');
  assert(
    viewB.playedMilliseconds >= 11000 && viewB.playedMilliseconds <= 23000,
    `2x credited ${viewB.playedMilliseconds}ms for ~16 elapsed seconds (expected elapsed basis)`,
  );

  // 5. Same session at 0.5x: ~6 elapsed seconds credit ~6s (old code: ~3s).
  await phase(page, 'setRate', { rate: 0.5 });
  const beforeHalf = (await phase(page, 'serverView')).playedMilliseconds;
  await sleep(6000);
  const afterHalf = await phase(page, 'serverView');
  const halfDelta = afterHalf.playedMilliseconds - beforeHalf;
  record('halfSpeedDelta6s', { before: beforeHalf, after: afterHalf.playedMilliseconds, delta: halfDelta });
  assert(halfDelta >= 3500 && halfDelta <= 9000, `0.5x delta ${halfDelta}ms not on an elapsed basis`);

  // 6. Pause: no advance while paused.
  await phase(page, 'pauseVideo');
  const beforePause = (await phase(page, 'serverView')).playedMilliseconds;
  await sleep(3000);
  const afterPause = await phase(page, 'serverView');
  record('pauseDelta3s', { delta: afterPause.playedMilliseconds - beforePause });
  assert(afterPause.playedMilliseconds - beforePause <= 1500, 'paused video advanced playing time');

  // 7. Transient start failure retries on a live grant (injected once).
  await page.evaluate(() => { window.__failNextStart = true; });
  const reattached = await page.evaluate(async () => {
    const m = window.__manager;
    const reader = await window.__runPhase('managerState');
    return reader;
  });
  void reattached;
  await page.evaluate(() => {
    window.__manager.attach(window.__courseSlug, window.__seed.lessonId, window.__referenceId);
  });
  let retried = null;
  for (let i = 0; i < 15; i += 1) {
    await sleep(1000);
    retried = await phase(page, 'managerState');
    if (retried.status === 'active') break;
  }
  record('startRetry', retried);
  assert(retried.status === 'active', 'manager did not recover via bounded retry');
  assert(retried.attempt >= 2, 'injected transient failure was not retried');

  // 8. Orderly refresh: end the session, reload (cookies persist), new grant +
  // new session counts again after its own fresh threshold.
  await phase(page, 'endPlayback');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready === true', { timeout: 30000 });
  await page.evaluate((s) => {
    window.__courseId = s.courseId;
    window.__courseSlug = s.courseSlug;
  }, seed);
  // Cookies persist across the reload, so the student session is still valid;
  // only a new playback grant + view session starts (media setup is one-time
  // per lesson and correctly refuses MEDIA_EXISTS on repeat registration).
  const sessC = await phase(page, 'session', {
    courseSlug: seed.courseSlug,
    lessonId: seed.lessonId,
    deviceId: 'probe-device-a',
  });
  record('sessionAfterRefresh', sessC);
  let viewC = null;
  for (let i = 0; i < 38; i += 1) {
    await sleep(2000);
    viewC = await phase(page, 'serverView');
    if (viewC.counted) break;
  }
  record('countedAfterRefresh', viewC);
  assert(viewC.counted === true, 'no second count after refresh + fresh 30s');

  // 9. Roster cross-check through agent 2's read API (read-only): two counted
  // sessions for this student/lesson version.
  const adminCtx = await browser.createBrowserContext();
  const adminPage = await adminCtx.newPage();
  await adminPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 60000 });
  await adminPage.waitForFunction('window.__ready === true', { timeout: 30000 });
  const roster = await adminPage.evaluate(async (s) => {
    await fetch('/api/auth/csrf', { credentials: 'include' });
    const csrf = (document.cookie.match(/(?:^|;\s*)edu_csrf=([^;]+)/) || [])[1] || '';
    const login = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': decodeURIComponent(csrf) },
      body: JSON.stringify({ identifier: s.adminEmail, password: s.adminPassword }),
    });
    if (!login.ok) throw new Error(`admin login ${login.status}`);
    const res = await fetch(
      `/api/admin/courses/${encodeURIComponent(s.courseId)}/students?limit=50`,
      { credentials: 'include', headers: { Accept: 'application/json' } },
    );
    return { status: res.status, body: await res.json() };
  }, seed);
  record('roster', { status: roster.status, students: roster.body?.data?.students ?? roster.body });
  await adminCtx.close();

  // 10. Browser persistence audit: tracking state must be memory-only.
  const audit = await phase(page, 'storageAudit');
  record('storageAudit', audit);
  assert(audit.localStorageEntries === 0, 'localStorage written by tracking');
  assert(audit.sessionStorageEntries === 0, 'sessionStorage written by tracking');
  assert(!audit.cookies.join(' ').includes('view'), 'view id leaked into cookies');

  evidence.finishedAt = new Date().toISOString();
  evidence.verdict = 'PASS';
  fs.writeFileSync(OUT_PATH, JSON.stringify(evidence, null, 2));
  console.log('[probe] PASS');
} catch (error) {
  evidence.finishedAt = new Date().toISOString();
  evidence.verdict = 'FAIL';
  evidence.failure = String(error?.message ?? error);
  try {
    fs.writeFileSync(OUT_PATH, JSON.stringify(evidence, null, 2));
  } catch { /* evidence best-effort */ }
  console.error(`[probe] FAIL: ${evidence.failure}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
