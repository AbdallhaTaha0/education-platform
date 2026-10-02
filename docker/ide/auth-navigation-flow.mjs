/** Login/logout navigation proof; synthetic isolated accounts only. */
import assert from 'node:assert/strict';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const host = (await lookup('host.docker.internal')).address;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${host}`] });
let checks = 0; const errors = [];
const pass = (name, result) => { assert(result, name); checks++; console.log(`PASS ${name}`); };
try {
  for (const role of ['student', 'admin']) for (const lang of ['ar', 'en']) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage(); page.on('pageerror', (e) => errors.push(e.message));
      await page.evaluateOnNewDocument((l) => { if (window.top === window) localStorage.setItem('edu-platform-lang', l); }, lang);
      await page.setViewport({ width: 390, height: 844 });
      await page.goto('http://localhost:8084/#/');
      await page.waitForSelector('[data-testid="header-login"]');
      pass(`${role}/${lang} guest has visible login and four dock items`, await page.$eval('[data-testid="header-login"]', (e) => e.getBoundingClientRect().height >= 44) && (await page.$$('.mobile-dock a')).length === 4);
      await page.click('[data-testid="header-login"]'); await page.waitForSelector('#login-id');
      await page.type('#login-id', `m9-${role}@example.test`); await page.type('#login-password', 'm9 fixture password twelve words');
      await page.click('form button[type="submit"]'); await page.waitForSelector('[data-testid="header-logout"]');
      pass(`${role}/${lang} authenticated header replaces login with logout`, !await page.$('[data-testid="header-login"]'));
      await page.setViewport({ width: 1024, height: 900 });
      pass(`${role}/${lang} desktop header controls fit`, await page.$$eval('header a, header button', (els) => els.every((e) => {
        const r = e.getBoundingClientRect(); return r.width === 0 || (r.left >= 0 && r.right <= innerWidth);
      })));
      await page.setViewport({ width: 320, height: 844 });
      pass('header logout has a 44px target and fits 320px', await page.$eval('[data-testid="header-logout"]', (e) => e.getBoundingClientRect().height >= 44) && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      pass('mobile logout sits beside theme toggle and dock stays four items', await page.$eval('[data-testid="header-logout"]', (e) => {
        const auth = e.closest('.header-auth-actions'), theme = auth.nextElementSibling;
        const a = auth.getBoundingClientRect(), b = theme.getBoundingClientRect();
        return theme.hasAttribute('aria-pressed') && Math.abs(a.top - b.top) < 4 && document.querySelectorAll('.mobile-dock a').length === 4;
      }));
      if (role === 'student' && lang === 'en') {
        await page.goto('http://localhost:8084/#/account/profile'); await page.waitForSelector('[data-testid="account-settings"]');
        const original = await page.$eval('[data-testid="account-settings"] > form input', (e) => e.value);
        await page.$eval('[data-testid="account-settings"] > form input', (e) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, 'Unsaved header logout probe');
          e.dispatchEvent(new Event('input', { bubbles: true }));
        });
        let confirmations = 0;
        const dismiss = async (d) => { confirmations++; await d.dismiss(); }; page.on('dialog', dismiss);
        await page.click('[data-testid="header-logout"]'); page.off('dialog', dismiss);
        pass('cancelled header logout preserves session and dirty profile', confirmations === 1 && await page.$eval('[data-testid="account-settings"] > form input', (e) => e.value === 'Unsaved header logout probe'));
        await page.$eval('[data-testid="account-settings"] > form input', (e, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, value);
          e.dispatchEvent(new Event('input', { bubbles: true }));
        }, original);
        let fail = true;
        await page.setRequestInterception(true);
        page.on('request', (r) => r.url().endsWith('/api/auth/logout') && fail
          ? r.respond({ status: 503, contentType: 'application/json', body: '{"error":{"code":"SERVICE_ERROR"}}' }) : r.continue());
        await page.click('[data-testid="header-logout"]');
        await page.waitForFunction(() => document.querySelector('[data-testid="error-feedback-stack"]')?.textContent.includes('Could not log out'));
        pass('failed logout has a visible error and retains authentication', await page.evaluate(async () => (await fetch('/api/auth/me')).status === 200));
        fail = false;
      }
      await page.click('[data-testid="header-logout"]'); await page.waitForSelector('[data-testid="header-login"]');
      pass(`${role}/${lang} logout revokes the cookie session`, await page.evaluate(async () => (await fetch('/api/auth/me')).status === 401));
      if (lang === 'ar') await page.screenshot({ path: `/evidence/header-auth-${role}-ar.png` });
    } finally { await context.close(); }
  }
  pass('no browser exceptions', errors.length === 0);
  console.log(`Header authentication checks=${checks} failed=0`);
} finally { await browser.close(); }
