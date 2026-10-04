/** Real synthetic identity/entitlement/progress APIs; player grant is an explicit
 * browser fixture. This proves UI/fullscreen, not actual DRM or media playback.
 * ui-review owns and guards cleanup of the disposable stack and these fixtures. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const fixture = JSON.parse(fs.readFileSync('/evidence/m9-fixtures.json', 'utf8'));
const host = (await lookup('host.docker.internal')).address;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${host}`] });
const errors = []; let checks = 0; const playbackRequests = [];
function pass(name, value = true) { assert(value, name); checks++; console.log(`PASS ${name}`); }
async function makePage(lang, theme, width) {
  const context = await browser.createBrowserContext(); const p = await context.newPage();
  await p.setViewport({ width, height: 900 });
  p.on('pageerror', error => errors.push(error.message));
  await p.evaluateOnNewDocument((lang, theme) => {
    if (window.top === window) { localStorage.setItem('edu-platform-lang', lang); localStorage.setItem('edu-platform-theme', theme); }
  }, lang, theme);
  return p;
}
async function route(p, hash) { await p.goto('http://localhost:8084/' + hash); }
async function login(p, email) {
  await route(p, '#/login'); await p.waitForSelector('#login-id');
  await p.type('#login-id', email); await p.type('#login-password', 'm9 fixture password twelve words');
  await p.click('form button[type="submit"]'); await p.waitForFunction(() => location.hash === '#/account');
}
async function mockPlayer(p) {
  await p.setRequestInterception(true);
  p.on('request', request => {
    const url = new URL(request.url());
    if (/\/api\/learning\/courses\/[^/]+\/lessons\/[^/]+\/playback$/.test(url.pathname)) {
      playbackRequests.push(url.pathname);
      return void request.respond({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { playback: {
        referenceId: 'course-ux-fixture-reference', playbackSessionId: 'course-ux-fixture-session', playbackToken: 'synthetic-ui-token',
        tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(), sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        manifestUrl: 'http://localhost:8084/ui-fixture/manifest.mpd', licenseUrl: 'http://localhost:8084/ui-fixture/license',
        drmProvider: 'CLEAR_KEY', resumePositionSeconds: 0,
        watermark: { type: 'VISIBLE', maskedIdentity: 'SYNTHETIC ***', positions: [{ x: 50, y: 50 }], expiresAt: null },
      } } }) });
    }
    if (url.pathname.startsWith('/ui-fixture/')) return void request.respond({ status: 404, body: 'Explicit UI fixture: no real media.' });
    if (url.pathname === '/api/learning/playback/course-ux-fixture-reference/end') return void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ended: true, closure: 'CONFIRMED' } }) });
    void request.continue();
  });
}
try {
  const anon = await makePage('en', 'dark', 1280);
  await route(anon, '#/courses/m9-ui-course'); await anon.waitForSelector('h1');
  await anon.waitForFunction(() => document.querySelector('h1')?.textContent.includes('Web programming'));
  pass('anonymous offer has no protected curriculum', !await anon.$('[data-testid="course-plan"]'));
  pass('anonymous offer retains subscription action', await anon.$('a[href^="#/purchase/"]'));
  pass('anonymous protected outline denied', await anon.evaluate(async id => (await fetch(`/api/learning/courses/${id}/outline`)).status === 401, fixture.courseId));

  const p = await makePage('en', 'dark', 1280); await login(p, 'm9-student@example.test');
  await route(p, '#/courses/m9-ui-course'); await p.waitForSelector('[data-testid="course-plan"]');
  pass('subscribed offer exposes existing curriculum', (await p.$$('[data-testid="lesson-row"]')).length === 2);
  pass('owned course has no duplicate purchase action', !await p.$('a[href^="#/purchase/"]'));
  pass('initial completion reads zero', await p.$eval('[role="progressbar"]', e => e.getAttribute('aria-valuenow') === '0'));
  pass('locked lesson disabled', await p.$eval('[data-testid="lesson-row"][data-playable="false"]', e => e.disabled));
  await p.click('[data-testid="course-outline"] summary');
  pass('curriculum section collapses', await p.$eval('[data-testid="course-outline"] details', e => !e.open));
  await p.click('[data-testid="course-outline"] summary');
  await p.click('[data-testid="lesson-row"][data-playable="true"]');
  await p.waitForSelector('[data-testid="learning-start-playback"]');
  pass('offer lesson navigates to its learning context', (await p.url()).includes(`?lesson=${fixture.lessonId}`));
  pass('selected lesson named above player', await p.$eval('main', e => e.textContent.includes('Lesson 1 of 2')));
  pass('start is inside video placeholder', await p.$('[data-testid="player-placeholder"] [data-testid="learning-start-playback"]'));
  pass('previous disabled on first lesson', await p.$eval('[data-testid="previous-lesson"]', e => e.disabled));
  pass('next lesson respects required assessment lock', await p.$eval('[data-testid="next-lesson"]', e => e.disabled));
  pass('required assessment shortcut remains visible', await p.$(`a[href="#/assessment/${fixture.assessmentId}"]`));
  await mockPlayer(p);
  await p.click('[data-testid="learning-start-playback"]'); await p.waitForSelector('[data-testid="player-fullscreen"]');
  pass('start requests selected lesson once', playbackRequests.length === 1 && playbackRequests[0].includes(fixture.lessonId));
  pass('fullscreen action always available', await p.$('[data-testid="player-fullscreen"]'));
  await p.click('[data-testid="player-fullscreen"]');
  await p.waitForFunction(() => document.fullscreenElement?.classList.contains('learning-video-frame'));
  pass('native fullscreen includes entire player', await p.evaluate(() => document.fullscreenElement?.contains(document.querySelector('video'))));
  pass('watermark stays inside native fullscreen', await p.evaluate(() => document.fullscreenElement?.contains(document.querySelector('[data-testid="watermark-overlay"]'))));
  pass('exit fullscreen accessible', await p.$eval('[data-testid="player-fullscreen"]', e => e.getAttribute('aria-pressed') === 'true' && e.textContent.includes('Exit')));
  await p.click('[data-testid="player-fullscreen"]'); await p.waitForFunction(() => !document.fullscreenElement);
  pass('fullscreen exits through same control');
  await p.evaluate(() => { document.querySelector('.learning-video-frame').requestFullscreen = () => Promise.reject(new Error('Synthetic fullscreen refusal')); });
  await p.click('[data-testid="player-fullscreen"]'); await p.waitForSelector('.learning-video-frame--expanded');
  pass('browser refusal opens expanded mode', await p.evaluate(() => document.body.style.overflow === 'hidden'));
  pass('expanded player keeps watermark', await p.$('.learning-video-frame--expanded [data-testid="watermark-overlay"]'));
  await p.keyboard.press('Tab');
  pass('expanded mode keeps keyboard focus in player', await p.evaluate(() => document.querySelector('.learning-video-frame').contains(document.activeElement)));
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('.learning-video-frame--expanded'));
  pass('Escape restores document scrolling', await p.evaluate(() => document.body.style.overflow !== 'hidden'));
  pass('Escape restores keyboard focus', await p.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'player-fullscreen'));
  await p.evaluate(() => document.querySelector('video').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
  await p.waitForSelector('.learning-video-frame--expanded'); pass('double click expands player');
  await p.keyboard.press('Escape');
  const progressSaved = p.waitForResponse(r => r.url().endsWith('/api/learning/progress') && r.request().method() === 'POST');
  await p.evaluate(() => { const v = document.querySelector('video'); Object.defineProperty(v, 'duration', { configurable: true, value: 120 }); v.currentTime = 120; v.dispatchEvent(new Event('ended')); });
  pass('completion persisted via real progress API', (await progressSaved).ok());
  await p.waitForFunction(() => document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') === '50');
  pass('live completion updates plan to 50%');
  await p.screenshot({ path: '/evidence/course-en-desktop-dark.png', fullPage: true });

  for (const [lang, theme] of [['ar', 'dark'], ['en', 'light']]) {
    const mobile = await makePage(lang, theme, 390); await login(mobile, 'm9-student@example.test');
    await route(mobile, '#/learn/m9-ui-course'); await mobile.waitForSelector('[data-testid="course-plan"]');
    pass(`${lang}/${theme}: curriculum shows saved completion`, await mobile.$eval('[role="progressbar"]', e => e.getAttribute('aria-valuenow') === '50'));
    pass(`${lang}/${theme}: correct writing direction`, await mobile.evaluate(l => document.documentElement.dir === (l === 'ar' ? 'rtl' : 'ltr'), lang));
    pass(`${lang}/${theme}: no horizontal overflow`, await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    pass(`${lang}/${theme}: lesson title wraps`, await mobile.$eval('[data-testid="lesson-row"]', e => getComputedStyle(e).minHeight === '64px'));
    const hash = await mobile.evaluate(() => location.hash);
    await mobile.click('[data-testid="course-plan-jump"]');
    pass(`${lang}/${theme}: curriculum jump preserves route`, await mobile.evaluate(hash => location.hash === hash && document.querySelector('#course-plan summary') === document.activeElement, hash));
    await mobile.evaluate(() => window.scrollTo(0, 0));
    await mobile.screenshot({ path: `/evidence/course-${lang}-mobile-${theme}.png`, fullPage: true });
  }
  const inactive = await makePage('en', 'dark', 1280); await login(inactive, 'm9-inactive@example.test');
  await route(inactive, '#/learn/m9-ui-course'); await inactive.waitForSelector('[data-testid="renewal-required"]');
  pass('unsubscribed student cannot see curriculum', !await inactive.$('[data-testid="course-plan"]'));
  pass('runtime has no uncaught errors', errors.length === 0);
  console.log(`COURSE_UI_CHECKS=${checks} PASS; playback grant/manifest are explicit UI fixtures, not DRM evidence.`);
} finally { await browser.close(); }
