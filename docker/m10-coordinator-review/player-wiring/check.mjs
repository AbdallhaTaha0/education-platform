import puppeteer from '/srv/browser/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.setRequestInterception(true);
  page.on('request', request => request.respond({ status: 200, contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto('http://fixture.invalid/');
  await page.addScriptTag({ content: await readFile('/fixture/out/player.js', 'utf8') });
  await page.waitForSelector('video');
  const result = await page.evaluate(async () => {
    const video = document.querySelector('video');
    const state = { paused: false, seeking: false, ended: false, readyState: 4 };
    for (const key of Object.keys(state)) Object.defineProperty(video, key, { configurable: true, get: () => state[key] });
    const sample = async (name, now, change = {}) => {
      Object.assign(state, change);
      window.__clock = now;
      video.dispatchEvent(new Event(name, { bubbles: true }));
      await new Promise(r => setTimeout(r, 20));
    };
    // Allow the real hook to attach and its fixture start to resolve.
    await new Promise(r => setTimeout(r, 50));
    await sample('playing', 0);
    await sample('timeupdate', 1000);
    await sample('pause', 1000, { paused: true });
    await sample('playing', 6000, { paused: false });
    await sample('timeupdate', 6500);
    await sample('pause', 6500, { paused: true });
    const pauseTotal = window.__totals.at(-1);
    await sample('playing', 6500, { paused: false });
    await sample('waiting', 6500);
    await sample('playing', 11500);
    await sample('timeupdate', 12000);
    await sample('pause', 12000, { paused: true });
    const bufferTotal = window.__totals.at(-1);
    await sample('playing', 12000, { paused: false });
    await sample('seeking', 12000, { seeking: true });
    await sample('seeked', 17000, { seeking: false });
    await sample('timeupdate', 17500);
    await sample('pause', 17500, { paused: true });
    const seekTotal = window.__totals.at(-1);
    window.__hang = true;
    await sample('ended', 17500, { ended: true });
    await new Promise(r => setTimeout(r, 2100));
    const boundedEnd = window.__ends;
    await sample('ended', 17500);
    window.__mount('fixture-reference-new');
    await new Promise(r => setTimeout(r, 2100));
    return { pauseTotal, bufferTotal, seekTotal, boundedEnd, endsAfterSupersession: window.__ends };
  });
  assert.deepEqual(result, { pauseTotal: 1500, bufferTotal: 2000, seekTotal: 2500, boundedEnd: 1, endsAfterSupersession: 1 });
  assert.deepEqual(errors, []);
  await writeFile('/fixture/out/evidence.json', JSON.stringify({ kind: 'Chromium, actual React Player and hook; controlled media states/clock; fixture DASH/auth/transport, no real DRM', result, errors }, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
