/** Course-learning UI proof (agent 2 harness only).
 *
 * Uses REAL outline/progress/auth APIs from the disposable stack plus EXPLICIT
 * TEST-HARNESS-ONLY mocks for the pending contract endpoints (materials,
 * captions, downloads, playback grant/manifest). Mocks are request
 * interception in this script only: never a production fallback and never
 * evidence of authorization/storage/playback. Real-API integration reruns the
 * same flow after the backend handoff.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';

const fixture = JSON.parse(fs.readFileSync('/evidence/course-learning-ui-fixtures.json', 'utf8'));
const host = (await lookup('host.docker.internal')).address;
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${host}`],
});
const errors = [];
let checks = 0;
const playbackRequests = [];
function pass(name, value = true) { assert(value, name); checks++; console.log(`PASS ${name}`); }

const MOCK_VTT_AR = 'WEBVTT\n\n00:00.000 --> 00:02.000\n\u0645\u0631\u062d\u0628\u0627 \u0628\u0627\u0644\u062f\u0631\u0633\n';
const MOCK_VTT_EN = 'WEBVTT\n\n00:00.000 --> 00:02.000\nHello lesson\n';
const MOCK_RESOURCE_ID = 'course-learning-ui-resource-1';
const MOCK_CAPTION_AR = 'course-learning-ui-caption-ar';
const MOCK_CAPTION_EN = 'course-learning-ui-caption-en';

async function makePage(lang, theme, width) {
  const context = await browser.createBrowserContext();
  const p = await context.newPage();
  await p.setViewport({ width, height: 900 });
  p.on('pageerror', (error) => errors.push(error.message));
  await p.evaluateOnNewDocument((l, t) => {
    if (window.top === window) {
      localStorage.setItem('edu-platform-lang', l);
      localStorage.setItem('edu-platform-theme', t);
    }
  }, lang, theme);
  return p;
}

async function route(p, hash) { await p.goto(`http://localhost:8091/${hash}`); }

async function login(p, email) {
  await route(p, '#/login');
  await p.waitForSelector('#login-id');
  await p.type('#login-id', email);
  await p.type('#login-password', 'm9 fixture password twelve words');
  await p.click('form button[type="submit"]');
  await p.waitForFunction(() => location.hash === '#/account');
}

async function clearSearchInput(p) {
  await p.click('[data-testid="course-plan-search"]');
  await p.keyboard.down('Control');
  await p.keyboard.press('a');
  await p.keyboard.up('Control');
  await p.keyboard.press('Backspace');
}

/** Explicit harness mocks: materials/captions/downloads/playback/manifest. */
async function mockLearning(p) {
  await p.setRequestInterception(true);
  p.on('request', (request) => {
    const url = new URL(request.url());
    // Playback grant fixture (explicit UI fixture, not DRM evidence).
    if (/\/api\/learning\/courses\/[^/]+\/lessons\/[^/]+\/playback$/.test(url.pathname)) {
      playbackRequests.push(url.pathname);
      return void request.respond({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { playback: {
          referenceId: 'course-learning-ui-reference',
          playbackSessionId: 'course-learning-ui-session',
          playbackToken: 'synthetic-ui-token',
          tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
          sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(),
          manifestUrl: 'http://localhost:8091/ui-fixture/manifest.mpd',
          licenseUrl: 'http://localhost:8091/ui-fixture/license',
          drmProvider: 'CLEAR_KEY',
          resumePositionSeconds: 0,
          watermark: { type: 'VISIBLE', maskedIdentity: 'SYNTHETIC ***', positions: [{ x: 50, y: 50 }], expiresAt: null },
        } } }),
      });
    }
    if (url.pathname.startsWith('/ui-fixture/')) {
      return void request.respond({ status: 404, body: 'Explicit UI fixture: no real media.' });
    }
    if (url.pathname === '/api/learning/playback/course-learning-ui-reference/end') {
      return void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ended: true, closure: 'CONFIRMED' } }) });
    }
    // Pending contract mocks (TEST HARNESS ONLY).
    const materialsMatch = /^\/api\/learning\/lessons\/([^/]+)\/materials$/.exec(url.pathname);
    if (materialsMatch && request.method() === 'GET') {
      const lessonId = decodeURIComponent(materialsMatch[1]);
      const isFirst = lessonId === fixture.lessonId;
      return void request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: {
          lessonId,
          durationSeconds: isFirst ? 125 : null,
          captions: isFirst
            ? [
                { id: MOCK_CAPTION_AR, language: 'ar', labelAr: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', labelEn: 'Arabic', byteSize: 120 },
                { id: MOCK_CAPTION_EN, language: 'en', labelAr: '\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629', labelEn: 'English', byteSize: 110 },
              ]
            : [],
          resources: isFirst
            ? [{ id: MOCK_RESOURCE_ID, labelAr: '\u0645\u0630\u0643\u0631\u0629 \u0627\u0644\u062f\u0631\u0633', labelEn: 'Lesson notes', fileName: 'notes.pdf', mimeType: 'application/pdf', byteSize: 10240 }]
            : [],
        } }),
      });
    }
    if (url.pathname === `/api/learning/captions/${MOCK_CAPTION_AR}`) {
      return void request.respond({ status: 200, contentType: 'text/vtt; charset=utf-8', body: MOCK_VTT_AR });
    }
    if (url.pathname === `/api/learning/captions/${MOCK_CAPTION_EN}`) {
      return void request.respond({ status: 200, contentType: 'text/vtt; charset=utf-8', body: MOCK_VTT_EN });
    }
    if (url.pathname === `/api/learning/resources/${MOCK_RESOURCE_ID}/download`) {
      return void request.respond({
        status: 200,
        contentType: 'application/pdf',
        headers: { 'content-disposition': 'attachment; filename="notes.pdf"', 'cache-control': 'private, no-store' },
        body: '%PDF-1.4 mock resource bytes',
      });
    }
    const adminMaterials = /^\/api\/admin\/learning\/lessons\/([^/]+)\/materials$/.exec(url.pathname);
    if (adminMaterials && request.method() === 'GET') {
      const lessonId = decodeURIComponent(adminMaterials[1]);
      return void request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { lessonId, durationSeconds: null, captions: [], resources: [] } }),
      });
    }
    void request.continue();
  });
}

try {
  // ---- Subscribed offer page: search + durations, no autoplay ----
  const p = await makePage('en', 'dark', 1280);
  await login(p, 'm9-student@example.test');
  await mockLearning(p);
  await route(p, '#/courses/m9-ui-course');
  await p.waitForSelector('[data-testid="course-plan"]');
  pass('offer exposes search input', await p.$('[data-testid="course-plan-search"]'));
  pass('offer shows lesson count', (await p.$eval('[data-testid="course-plan-search-count"]', (e) => e.textContent)).includes('2'));
  pass('legacy outline shows unknown durations, never guessed', await p.evaluate(() => [...document.querySelectorAll('[data-testid="lesson-duration"]')].every((e) => e.textContent.includes('unknown') || e.textContent.includes('Duration'))));
  pass('course total distinguishes unknown/partial, not complete', await p.evaluate(() => {
    const text = document.querySelector('[data-testid="course-duration"]')?.textContent ?? '';
    return text.includes('unknown') || text.includes('partial');
  }));

  // English search narrows to one row without autoplay.
  await p.type('[data-testid="course-plan-search"]', 'Lesson 1');
  await p.waitForFunction(() => document.querySelectorAll('[data-testid="lesson-row"]').length === 1);
  pass('english search narrows lessons', true);
  pass('search shows accessible result count', (await p.$eval('[data-testid="course-plan-search-count"]', (e) => e.textContent)).includes('1'));
  pass('filtering triggers no playback request', playbackRequests.length === 0);
  pass('filtered row keeps duration label', await p.$('[data-testid="lesson-row"] [data-testid="lesson-duration"]'));

  // Locked-lesson match stays locked/disabled.
  await clearSearchInput(p);
  await p.waitForFunction(() => document.querySelectorAll('[data-testid="lesson-row"]').length === 2);
  await p.type('[data-testid="course-plan-search"]', 'Lesson');
  await p.waitForFunction(() => document.querySelectorAll('[data-testid="lesson-row"]').length === 2);
  pass('locked lesson matches remain visible', true);
  pass('locked match stays disabled', await p.$eval('[data-testid="lesson-row"][data-playable="false"]', (e) => e.disabled));
  pass('required assessment link preserved while filtering', await p.$(`a[href="#/assessment/${fixture.assessmentId}"]`));

  // Empty state + clear restores browsing.
  await clearSearchInput(p);
  await p.type('[data-testid="course-plan-search"]', 'zzz-no-such-lesson');
  await p.waitForSelector('[data-testid="course-plan-search-empty"]');
  pass('empty search shows accessible empty state', true);
  await p.click('[data-testid="course-plan-search-clear"]');
  await p.waitForFunction(() => document.querySelectorAll('[data-testid="lesson-row"]').length === 2);
  pass('clear restores browsing state', !(await p.$('[data-testid="course-plan-search-empty"]')));

  // Arabic diacritics-insensitive search on the learning page.
  await route(p, '#/learn/m9-ui-course');
  await p.waitForSelector('[data-testid="course-plan-search"]');
  // Request interception from mockLearning persists across same-page navigation.
  // Type the Arabic lesson title with diacritics; the plain outline title must still match.
  await p.type('[data-testid="course-plan-search"]', '\u0627\u064e\u0644\u062f\u064e\u0651\u0631\u0652\u0633\u064f');
  await p.waitForFunction(() => document.querySelectorAll('[data-testid="lesson-row"]').length >= 1);
  pass('arabic diacritics-insensitive search matches', true);
  await p.click('[data-testid="course-plan-search-clear"]');
  await p.waitForFunction(() => document.querySelectorAll('[data-testid="lesson-row"]').length === 2);

  // ---- Playback + captions inside the fullscreen frame + resources ----
  // Clicking a curriculum lesson starts its playback session directly.
  await p.click('[data-testid="lesson-row"][data-playable="true"]');
  await p.waitForSelector('[data-testid="player-fullscreen"]');
  pass('caption controls render', await p.$('[data-testid="caption-controls"]'));
  pass('caption track starts off', !(await p.$('video track')));
  pass('resources panel lists bilingual download', await p.$('[data-testid="resource-row"]'));
  pass('resource row shows mime and size', await p.evaluate(() => (document.querySelector('[data-testid="resource-row"]')?.textContent ?? '').includes('application/pdf')));
  // Authenticated mocked download succeeds (harness mock, not storage proof).
  pass('mocked protected download ok', await p.evaluate(async (id) => (await fetch(`/api/learning/resources/${id}/download`, { credentials: 'include' })).ok, MOCK_RESOURCE_ID));
  // Caption selection fetches validated WebVTT into a Blob URL.
  await p.select('[data-testid="caption-choice"]', 'ar');
  await p.waitForSelector('video track');
  pass('arabic caption attaches validated Blob track', await p.evaluate(() => document.querySelector('video track')?.getAttribute('src')?.startsWith('blob:')));
  await p.click('[data-testid="player-fullscreen"]');
  await p.waitForFunction(() => document.fullscreenElement?.classList.contains('learning-video-frame'));
  pass('fullscreen frame keeps caption controls', await p.evaluate(() => document.fullscreenElement?.contains(document.querySelector('[data-testid="caption-controls"]'))));
  pass('fullscreen frame keeps caption track', await p.evaluate(() => document.fullscreenElement?.contains(document.querySelector('video track'))));
  pass('watermark stays inside fullscreen with captions', await p.evaluate(() => document.fullscreenElement?.contains(document.querySelector('[data-testid="watermark-overlay"]'))));
  await p.click('[data-testid="player-fullscreen"]');
  await p.waitForFunction(() => !document.fullscreenElement);
  pass('caption selection survives fullscreen exit without breaking playback', await p.$('video track'));
  await p.screenshot({ path: '/evidence/course-learning-ui-en-desktop-dark.png', fullPage: true });

  // ---- Access expiry while open: no curriculum, no materials ----
  for (const [lang, theme] of [['ar', 'dark'], ['en', 'light']]) {
    const mobile = await makePage(lang, theme, 390);
    await login(mobile, 'm9-student@example.test');
    await mockLearning(mobile);
    await route(mobile, '#/learn/m9-ui-course');
    await mobile.waitForSelector('[data-testid="course-plan"]');
    pass(`${lang}/${theme}: search present`, await mobile.$('[data-testid="course-plan-search"]'));
    pass(`${lang}/${theme}: correct direction`, await mobile.evaluate((l) => document.documentElement.dir === (l === 'ar' ? 'rtl' : 'ltr'), lang));
    pass(`${lang}/${theme}: no horizontal overflow`, await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await mobile.evaluate(() => window.scrollTo(0, 0));
    await mobile.screenshot({ path: `/evidence/course-learning-ui-${lang}-mobile-${theme}.png`, fullPage: true });
  }
  const inactive = await makePage('en', 'dark', 1280);
  await login(inactive, 'm9-inactive@example.test');
  await mockLearning(inactive);
  await route(inactive, '#/learn/m9-ui-course');
  await inactive.waitForSelector('[data-testid="renewal-required"]');
  pass('expired access shows renewal without curriculum', !(await inactive.$('[data-testid="course-plan"]')));
  pass('expired access exposes no materials', !(await inactive.$('[data-testid="resources-panel"]')));
  pass('runtime has no uncaught errors', errors.length === 0);
  console.log(`COURSE_LEARNING_UI_CHECKS=${checks} PASS; materials/playback are explicit harness mocks, not real-API proof.`);
} finally { await browser.close(); }
