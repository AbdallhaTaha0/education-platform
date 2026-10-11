// Browser regression: synthetic API responses; no users, purchases or DB writes.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const base = process.env.BASE_URL || 'http://host.docker.internal:8080';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const lang of ['ar', 'en']) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    let signedIn = false;
    let protectedBeforeLogin = 0;
    let purchaseWrites = 0;
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/socket.io/')) return request.abort();
      if (!path.startsWith('/api/')) return request.continue();
      if (path.startsWith('/api/wallet') && !signedIn) protectedBeforeLogin++;
      if (path === '/api/wallet/purchases' && request.method() === 'POST') purchaseWrites++;
      let status = 200;
      let body = { data: {} };
      if (path === '/api/auth/me') {
        status = signedIn ? 200 : 401;
        body = signedIn ? { data: { user: { id: 'fixture-student', role: 'STUDENT', displayName: 'Fixture', email: 'fixture@example.invalid', phone: '01000000000' } } } : { error: { code: 'TOKEN_MISSING' } };
      } else if (path === '/api/auth/refresh') { status = 401; body = { error: { code: 'TOKEN_MISSING' } }; }
      else if (path === '/api/auth/login') signedIn = true;
      else if (path === '/api/catalog/courses') body = { data: { courses: [{ id: 'fixture-course', titleAr: 'كورس تجريبي', titleEn: 'Fixture course', plans: [{ id: 'fixture-plan', currentPricePiastres: 100, durationDays: 30 }] }] } };
      else if (path === '/api/wallet') body = { data: { balancePiastres: 1000 } };
      else if (path === '/api/wallet/subscriptions') body = { data: { subscriptions: [] } };
      await request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.evaluateOnNewDocument(value => localStorage.setItem('edu-platform-lang', value), lang);
    await page.goto(`${base}/#/purchase/fixture-plan`);
    await page.waitForSelector('#login-id');
    assert.match(new URL(page.url()).hash, /^#\/login\?next=/);
    assert.equal(protectedBeforeLogin, 0);
    // Reload preserves the selected plan while still requiring authentication.
    await page.reload();
    await page.waitForSelector('#login-id');
    await context.setCookie({ name: 'edu_csrf', value: 'fixture-csrf', domain: new URL(base).hostname, path: '/' });
    await page.type('#login-id', 'fixture@example.invalid');
    await page.type('#login-password', 'fixture-only-password');
    await page.focus('#login-password');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.hash === '#/purchase/fixture-plan').catch(async error => {
      console.log('fixture diagnostic', JSON.stringify({ hash: new URL(page.url()).hash, signedIn, loginVisible: !!(await page.$('#login-id')), errors: await page.$$eval('[role=alert]', nodes => nodes.map(node => node.textContent)) }));
      throw error;
    });
    await page.waitForFunction(() => document.body.innerText.includes('Fixture course') || document.body.innerText.includes('كورس تجريبي'));
    assert.equal(purchaseWrites, 0);
    console.log(`PASS ${lang}: anonymous redirect, no private fetch, reload, login return, no automatic purchase`);
    await context.close();
  }
} finally { await browser.close(); }
