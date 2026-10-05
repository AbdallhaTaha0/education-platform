/** Disposable synthetic users. Real auth, refresh and durable progress APIs;
 * explicitly simulated media events/storage transfer, never owner media/data.
 * modes-verify owns cleanup on success, failure and stop; no global prune. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const fixture = JSON.parse(readFileSync('/evidence/fixtures.json', 'utf8'));
const host = (await lookup('nginx')).address;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${host}`] });
let checks = 0; const errors = [];
const pass = (name, value = true) => { assert(value, name); checks++; console.log(`PASS ${name}`); };
async function pageFor(lang = 'en') {
  const context = await browser.createBrowserContext(); const p = await context.newPage();
  await p.setViewport({ width: 1280, height: 1000 });
  p.on('pageerror', error => errors.push(error.message));
  await p.evaluateOnNewDocument(lang => localStorage.setItem('edu-platform-lang', lang), lang);
  return p;
}
async function route(p, hash) { await p.goto('http://localhost:8080/' + hash, { waitUntil: 'networkidle2' }); }
async function login(p, who) {
  await route(p, '#/login'); await p.type('#login-id', `modes-${who}@example.test`);
  await p.type('#login-password', 'synthetic modes password only'); await p.click('form button[type=submit]');
  await p.waitForFunction(() => location.hash === '#/account');
}
async function percent(p, expected) {
  try {
    await p.waitForFunction(expected => document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === String(expected), { timeout: 10000 }, expected);
  } catch (error) {
    await p.screenshot({ path: '/evidence/progress-diagnostic.png', fullPage: true });
    console.log(await p.$eval('main', e => e.innerText)); throw error;
  }
  pass(`progress shows ${expected}%`, await p.$eval('[role=progressbar] > div', (e, expected) => e.style.width === `${expected}%`, expected));
}
let failWrite = false, reference = 0, refreshes = 0;
async function mediaFixture(p) {
  await p.setRequestInterception(true);
  p.on('request', r => {
    const path = new URL(r.url()).pathname;
    if (path.endsWith('/auth/refresh')) refreshes++;
    if (path.endsWith('/learning/progress') && failWrite) {
      failWrite = false; return void r.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SERVICE_ERROR' } }) });
    }
    if (path.endsWith('/playback') && path.includes('/lessons/')) return void r.respond({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { playback: {
      referenceId: `progress-synthetic-${++reference}`, playbackSessionId: 'synthetic', playbackToken: 'synthetic',
      tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(), sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      manifestUrl: 'http://localhost:8080/progress-fixture/manifest', licenseUrl: 'http://localhost:8080/progress-fixture/license',
      drmProvider: 'CLEAR_KEY', resumePositionSeconds: 0, watermark: null,
    } } }) });
    if (path.includes('/learning/playback/progress-synthetic-') && path.endsWith('/end')) return void r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ended: true, closure: 'CONFIRMED' } }) });
    if (path.startsWith('/progress-fixture/')) return void r.respond({ status: 404 });
    void r.continue();
  });
}
async function start(p) { await p.waitForSelector('[data-testid=learning-start-playback]'); await p.click('[data-testid=learning-start-playback]'); await p.waitForSelector('video'); }
async function signal(p, position, event) {
  await p.$eval('video', (video, position, event) => {
    Object.defineProperty(video, 'duration', { configurable: true, value: 20 });
    Object.defineProperty(video, 'currentTime', { configurable: true, value: position });
    video.dispatchEvent(new Event(event));
  }, position, event);
}
try {
  const p = await pageFor(); await login(p, 'student'); await mediaFixture(p);
  await route(p, '#/learn/ide-modes-browser'); await percent(p, 0); await start(p);
  failWrite = true; await signal(p, 5, 'pause'); await p.waitForSelector('[data-testid=progress-save-error]');
  pass('failed progress save is visible without removing player', await p.$('video'));
  await p.click('[data-testid=progress-save-error] button'); await p.waitForSelector('[data-testid=progress-save-error]', { hidden: true });
  pass('retry saves partial position without completing lesson', await p.$eval('[data-lesson-state=current]', e => !!e));
  const leave = p.waitForResponse(r => r.url().endsWith('/api/learning/progress') && r.request().method() === 'POST');
  await signal(p, 9, 'seeked');
  await p.click('a[href="#/dashboard"]'); await leave;
  await route(p, '#/learn/ide-modes-browser');
  pass('teardown saved latest position', await p.evaluate(async lessonId => {
    const result = await (await fetch(`/api/learning/courses/ide-modes-browser/lessons/${lessonId}/progress`)).json();
    return result.data.positionSeconds === 9;
  }, fixture.lessonId));
  await start(p);
  const cookie = (await p.cookies('http://localhost:8080/api/')).find(c => c.name === 'edu_access'); assert(cookie);
  await p.deleteCookie(cookie);
  const saved = p.waitForResponse(r => r.url().endsWith('/api/learning/progress') && r.status() === 200);
  await signal(p, 20, 'ended'); await saved; await percent(p, 100);
  pass('expired access cookie refreshed during final progress save', refreshes === 1);
  pass('completed lesson displays completion', await p.$('[data-lesson-state=completed]'));
  await route(p, '#/dashboard'); await percent(p, 100);
  await route(p, '#/account'); await percent(p, 100);
  await route(p, '#/courses/ide-modes-browser'); await percent(p, 100);
  await route(p, '#/learn/ide-modes-browser'); await percent(p, 100);
  await p.reload({ waitUntil: 'networkidle2' }); await percent(p, 100);
  await p.screenshot({ path: '/evidence/progress-student.png', fullPage: true });

  const admin = await pageFor('ar'); await login(admin, 'admin');
  await admin.evaluateOnNewDocument(() => {
    window.XMLHttpRequest = class {
      constructor() { this.upload = {}; this.status = 0; }
      open(method, url) { if (method !== 'PUT' || !String(url).endsWith('/progress-fixture/upload')) throw new Error('Unexpected synthetic storage request'); }
      setRequestHeader() {}
      abort() { this.onabort?.(); }
      send() {
        setTimeout(() => this.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 }), 100);
        setTimeout(() => { this.status = 200; this.onload?.(); }, 2000);
      }
    };
  });
  await admin.setRequestInterception(true);
  let syncs = 0;
  admin.on('request', r => {
    const path = new URL(r.url()).pathname;
    if (path.endsWith(`/lessons/${fixture.lessonId}/media`)) return void r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { uploadUrl: 'http://localhost:8080/progress-fixture/upload' } }) });
    if (path.endsWith(`/lessons/${fixture.lessonId}/media/complete`)) return void r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    if (path.endsWith(`/lessons/${fixture.lessonId}/media/sync`)) return void r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { mapping: { status: syncs++ < 10 ? 'PROCESSING' : 'READY' } } }) });
    void r.continue();
  });
  await route(admin, `#/admin/courses/${fixture.courseId}`);
  // Hash navigation keeps the existing document; reload installs the storage fixture.
  await admin.reload({ waitUntil: 'networkidle2' });
  const uploader = `[data-testid="uploader-${fixture.lessonId}"]`;
  await admin.waitForSelector(`${uploader} input[type=file]`);
  await admin.$eval(`${uploader} input[type=file]`, input => {
    const transfer = new DataTransfer(); transfer.items.add(new File(['synthetic'], 'fixture.mp4', { type: 'video/mp4' }));
    input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await admin.click(`${uploader} button`); await percent(admin, 25);
  await admin.waitForFunction(selector => {
    const e = document.querySelector(selector); return e?.textContent.includes('الفيديو قيد التجهيز') && e.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === null;
  }, {}, uploader);
  pass('100% transfer does not invent processing completion');
  await admin.waitForFunction(selector => !document.querySelector(selector + ' button')?.disabled, {}, uploader);
  await admin.$eval(uploader, e => e.querySelectorAll('button')[1].click()); await percent(admin, 100);
  pass('ADMIN progress is labelled and ready reflects processing result', await admin.$eval(uploader, e => e.textContent.includes('الفيديو جاهز')));
  await admin.screenshot({ path: '/evidence/progress-admin.png', fullPage: true });
  for (const [who, page] of [['STUDENT', p], ['ADMIN', admin]]) {
    await page.click('[data-testid=header-logout]');
    await page.waitForFunction(() => location.hash === '#/login' && document.querySelector('#login-id'));
    pass(`${who} successful logout opens the login page`);
  }
  pass('no browser errors', errors.length === 0); console.log(`Progress browser checks=${checks} failed=0`);
} finally { await browser.close(); }
