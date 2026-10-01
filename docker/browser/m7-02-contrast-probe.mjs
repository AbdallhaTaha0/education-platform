/** Temporary M7-02 diagnostic: dump per-element contrast inputs for the first inbox card. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { lookup } from 'node:dns/promises';
const fixture = JSON.parse(fs.readFileSync('/fixtures/m6-inbox-ui-fixtures.json', 'utf8'));
const origin = 'http://localhost:8082';
let browser;
try {
  const address = (await lookup('nginx')).address;
  browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${address}`] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(origin + '/#/login', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('#login-id', { timeout: 30000 });
  const me = fixture.users.find((e) => e.label === 'a');
  await page.type('#login-id', me.email); await page.type('#login-password', me.password);
  await page.click('main button[type="submit"]');
  await page.waitForSelector('[data-testid="notification-entry"]', { timeout: 30000 });
  await page.evaluate(() => { location.hash = '#/notifications'; });
  await page.waitForFunction(() => {
    const list = document.querySelector('main ul[aria-busy]');
    return list?.getAttribute('aria-busy') === 'false';
  }, { timeout: 30000 });
  await page.waitForFunction(() => document.documentElement.lang === 'ar'
    && document.documentElement.dataset.theme === 'dark', { timeout: 30000 });
  const dump = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="notification-item"] > div');
    function lum(color) {
      const v = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((x) => x / 255)
        .map((x) => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
      return v[0] * .2126 + v[1] * .7152 + v[2] * .0722;
    }
    const bg = getComputedStyle(card).backgroundColor; const bgL = lum(bg);
    return [...card.querySelectorAll('h2,p,a,span.text-muted')].map((el) => {
      const c = getComputedStyle(el).color; const t = lum(c);
      const ratio = (Math.max(t, bgL) + .05) / (Math.min(t, bgL) + .05);
      return { tag: el.tagName, cls: el.className?.slice?.(0, 60) ?? '', text: (el.textContent ?? '').trim().slice(0, 40), color: c, bg, ratio: Math.round(ratio * 100) / 100 };
    });
  });
  console.log(JSON.stringify(dump, null, 1));
} finally { await browser?.close(); }
