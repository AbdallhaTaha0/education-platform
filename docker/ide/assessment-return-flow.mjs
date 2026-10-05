/** Real auth/outline and synthetic grading/DRM API responses; real generated DASH media. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const fixture = JSON.parse(readFileSync('/evidence/fixtures.json', 'utf8'));
const host = (await lookup('nginx')).address;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', `--host-resolver-rules=MAP localhost ${host}`] });
let checks = 0;
const pass = (name, ok = true) => { assert(ok, name); checks++; console.log(`PASS ${name}`); };
const id = '00000000-0000-4000-8000-000000000123';
try {
  for (const [lang, denied] of [['en', false], ['ar', true]]) {
    const context = await browser.createBrowserContext(); const page = await context.newPage(); const errors = []; let state = 'INCORRECT', submissions = 0, playbackRequests = 0;
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: 1280, height: 1000 });
    await page.evaluateOnNewDocument(({ lang, denied }) => {
      if (window !== window.top) return;
      localStorage.setItem('edu-platform-lang', lang); window.__denyAutoPlay = denied; window.__playCalls = 0;
      const original = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function() { window.__playCalls++; return window.__denyAutoPlay ? Promise.reject(new DOMException('Synthetic browser autoplay refusal', 'NotAllowedError')) : original.call(this); };
    }, { lang, denied });
    await page.setRequestInterception(true);
    page.on('request', r => {
      const path = new URL(r.url()).pathname; const json = (data, status = 200) => void r.respond({ status, contentType: 'application/json', body: JSON.stringify({ data }) });
      if (path === `/api/assessments/${id}`) return json({ id, lessonId: fixture.lessonId, courseId: fixture.courseId, required: true, passed: false, version: 1, draft: null, content: { ide: 'javascript', titleAr: 'تقييم تجريبي', titleEn: 'Return assessment', instructionsAr: 'اختر', instructionsEn: 'Choose', questions: [{ id: 'q1', type: 'CHOICE', titleAr: 'سؤال', titleEn: 'Question', choices: [{ id: 'a', textAr: 'إجابة', textEn: 'Answer' }] }] } });
      if (path === `/api/assessments/${id}/history`) return json({ submissions: [], pagination: { page: 1, pageSize: 10, total: 0 } });
      if (path === `/api/assessments/${id}/draft`) return json({ revision: 1 });
      if (path === `/api/assessments/${id}/submit`) return json({ id: `return-submission-${++submissions}` }, 202);
      if (path.startsWith('/api/assessments/submissions/return-submission-')) return json({ id: `return-submission-${submissions}`, state, result: null });
      if (path === `/api/learning/courses/${fixture.courseId}/lessons/${fixture.lessonId}/playback`) {
        playbackRequests++; return json({ playback: { referenceId: 'return-synthetic-reference', playbackSessionId: 'synthetic', playbackToken: 'synthetic', tokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(), sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(), manifestUrl: 'http://localhost:8080/assessment-return-media/assessment-return.mpd', licenseUrl: 'http://localhost:8080/assessment-return-media/license', drmProvider: 'CLEAR_KEY', resumePositionSeconds: 2, watermark: { type: 'MASKED', maskedIdentity: 'synthetic-student', positions: [{ x: 20, y: 20 }], expiresAt: null } } }, 201);
      }
      if (path.startsWith('/api/learning/playback/return-synthetic-reference')) return json({ ended: true, closure: 'CONFIRMED' });
      if (path === '/api/learning/progress') return json({ progress: { completed: false, positionSeconds: 2 } });
      if (path.startsWith('/assessment-return-media/')) {
        try { return void r.respond({ status: 200, contentType: path.endsWith('.mpd') ? 'application/dash+xml' : 'video/mp4', body: readFileSync(`/evidence/${basename(path)}`) }); }
        catch { return void r.respond({ status: 404 }); }
      }
      void r.continue();
    });
    await page.goto('http://localhost:8080/#/login', { waitUntil: 'networkidle2' }); await page.type('#login-id', 'modes-student@example.test'); await page.type('#login-password', 'synthetic modes password only'); await page.click('form button[type=submit]'); await page.waitForFunction(() => location.hash === '#/account');
    await page.goto(`http://localhost:8080/#/assessment/${id}`, { waitUntil: 'networkidle2' }); await page.waitForSelector('main input[type=radio]'); await page.click('main input[type=radio]');
    async function submit() { await page.evaluate(() => { const button = [...document.querySelectorAll('main button')].find(b => /Submit|إرسال الحل/.test(b.textContent)); if (!button) throw Error('Missing submit'); button.scrollIntoView({ block: 'center' }); button.click(); }); }
    for (const outcome of ['INCORRECT', 'ERROR']) {
      state = outcome; await submit(); await page.waitForSelector('[data-testid=assessment-result]');
      pass(`${lang} ${outcome} remains on the assessment`, await page.evaluate(id => location.hash === `#/assessment/${id}`, id));
    }
    state = 'PENDING'; await submit(); await page.waitForFunction(() => !document.querySelector('[data-testid=assessment-result]'));
    await page.evaluate(submission => window.dispatchEvent(new CustomEvent('fayq-assessment-completed', { detail: submission })), `return-submission-${submissions}`);
    pass(`${lang} completion hints alone never navigate`, await page.evaluate(id => location.hash === `#/assessment/${id}`, id));
    state = 'CORRECT'; await page.evaluate(submission => window.dispatchEvent(new CustomEvent('fayq-assessment-completed', { detail: submission })), `return-submission-${submissions}`);
    await page.waitForFunction(({ courseId, lessonId }) => location.hash === `#/learn/${courseId}?lesson=${lessonId}&resume=1`, {}, fixture);
    pass(`${lang} verified CORRECT automatically returns to the originating lesson`);
    await page.waitForSelector('video');
    if (denied) {
      await page.waitForFunction(() => window.__playCalls === 1);
      pass('autoplay refusal retains a usable player and one playback request', playbackRequests === 1 && await page.$eval('[data-testid=player-toggle-playback]', e => !e.disabled));
      await page.evaluate(() => { window.__denyAutoPlay = false; }); await page.click('[data-testid=player-toggle-playback]');
    }
    await page.waitForFunction(() => { const video = document.querySelector('video'); return video && !video.paused && video.currentTime >= 2; }, { timeout: 20000 });
    pass(`${lang} generated DASH video plays from saved progress`, playbackRequests === 1);
    pass(`${lang} no browser runtime errors`, errors.length === 0);
    await page.screenshot({ path: `/evidence/assessment-return-${lang}.png`, fullPage: true });
    await context.close();
  }
  console.log(`Assessment return PASS checks=${checks}`);
} finally { await browser.close(); }
