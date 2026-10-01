import fs from 'node:fs';
import { lookup } from 'node:dns/promises';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const fixture = JSON.parse(fs.readFileSync('/evidence/fixtures.json'));
const host = (await lookup('host.docker.internal')).address;
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${host}`],
});
try {
  for (const role of ['STUDENT', 'ADMIN']) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', () => errors.push('pageerror'));
    await page.goto('http://localhost:8080/#/login', { waitUntil: 'networkidle2' });
    const u = fixture.users.find((u) => u.role === role);
    await page.type('#login-id', u.email);
    await page.type('#login-password', u.password);
    await page.click('form button[type="submit"]');
    await page.waitForFunction(
      () => location.hash === '#/account' && document.querySelector('main dl'),
    );
    const cookies = await context.cookies();
    assert(cookies.some((c) => c.httpOnly));
    const response = await page.evaluate(async () => {
      const r = await fetch('/api/admin/catalog/summary');
      return { status: r.status };
    });
    assert.equal(response.status, role === 'ADMIN' ? 200 : 403);
    assert.equal(errors.length, 0);
    console.log(`PASS ${role}: real login, protected cookie, role guard`);
    await context.close();
  }
} finally {
  await browser.close();
}
