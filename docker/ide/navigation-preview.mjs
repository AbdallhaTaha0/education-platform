/** Read-only public checks of the retained preview. No login, fixtures or data writes. */
import assert from 'node:assert/strict';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const host = (await lookup('host.docker.internal')).address;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${host}`] });
let checks = 0; const errors = [];
const pass = (name, result) => { assert(result, name); checks++; console.log(`PASS ${name}`); };
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:8080/#/');
  await page.waitForSelector('.mobile-dock');
  pass('retained preview readiness is healthy', await page.evaluate(async () => (await fetch('/api/health/ready')).status === 200));
  pass('retained preview serves the four-item mobile dock', await page.$$eval('.mobile-dock a', (links) => links.length === 4));
  await page.waitForSelector('[data-testid="header-login"]');
  pass('retained preview has visible login beside the theme toggle', await page.$eval('[data-testid="header-login"]', (e) => e.getBoundingClientRect().height >= 44 && e.closest('.header-auth-actions').nextElementSibling.hasAttribute('aria-pressed')));
  pass('retained preview mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '/evidence/preview-home-ar-mobile.png' });
  await page.goto('http://localhost:8080/#/login'); await page.waitForSelector('#login-id');
  pass('retained login submit buttons are centred', await page.evaluate(() => {
    const group = document.querySelector('form .form-actions:last-child');
    const b = group?.querySelector('button'); if (!b) return false;
    const g = group.getBoundingClientRect(), r = b.getBoundingClientRect();
    return Math.abs((r.left + r.right) / 2 - (g.left + g.right) / 2) <= 4;
  }));
  await page.screenshot({ path: '/evidence/preview-login-ar-mobile.png' });
  await page.goto('http://localhost:8080/#/account/profile');
  await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('الملف والأمان'));
  pass('retained preview recognizes the explicit profile route with sign-in protection', !await page.$('[data-testid="account-settings"]'));
  pass('public contacts remain configured', await page.evaluate(async () => {
    const r = await fetch('/api/support/contact'); const body = await r.json();
    return r.status === 200 && !!body.data.contact.email && !!body.data.contact.phone;
  }));
  pass('retained preview has no browser exceptions', errors.length === 0);
  console.log(`Retained navigation preview checks=${checks} failed=0`);
} finally { await browser.close(); }
