/** Normal-cookie browser verification of real platform producers; media readiness is a fixture. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { lookup } from 'node:dns/promises';
const fixture = JSON.parse(fs.readFileSync('/fixtures/private.json', 'utf8'));
const phase = process.env.M6_PHASE ?? 'decisions';
const results = []; let browser, step = 'startup';
function check(label, passed) { step = label; results.push({ label, passed: Boolean(passed) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`); if (!passed) throw new Error('check failed'); }
try {
  const address = process.env.M6_INTERNAL === 'true' ? (await lookup('nginx')).address : '192.168.65.254';
  browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${address}`] });
  async function login(label) {
    const context = await browser.createBrowserContext(); const page = await context.newPage(); const user = fixture.users.find((row) => row.label === label);
    await page.goto('http://localhost:8082/#/login', { waitUntil: 'networkidle0' });
    await page.type('#login-id', user.email); await page.type('#login-password', user.password); await page.click('main button[type="submit"]');
    await page.waitForSelector('[data-testid="notification-entry"]');
    await page.evaluate(() => { location.hash = '#/notifications'; });
    await page.waitForFunction(() => document.querySelector('[data-testid="notification-connection"]')?.textContent.trim() === 'تحديثات مباشرة متصلة');
    return page;
  }
  async function post(page, pathname, body) {
    return page.evaluate(async (pathname, body) => {
      const csrf = document.cookie.split(';').map((v) => v.trim()).find((v) => v.startsWith('edu_csrf='));
      const res = await fetch('/api' + pathname, { method: 'POST', credentials: 'include', headers: {
        'Content-Type': 'application/json', 'x-csrf-token': decodeURIComponent(csrf.slice('edu_csrf='.length)),
      }, body: JSON.stringify(body) }); return res.status;
    }, pathname, body);
  }
  const a = await login('a'); const envelopes = [];
  const cdp = await a.createCDPSession(); await cdp.send('Network.enable');
  cdp.on('Network.webSocketFrameReceived', ({ response }) => {
    const index = response.payloadData.indexOf('["notifications:changed",');
    if (index >= 0) { try { envelopes.push(JSON.parse(response.payloadData.slice(index))[1]); } catch {} }
  });
  const rows = (page) => page.$$eval('[data-testid="notification-item"]', (els) => els.length);
  const liveRows = (page, expected) => page.waitForFunction((expected) => document.querySelectorAll('[data-testid="notification-item"]').length === expected, { timeout: 15000 }, expected);
  check('connected through Nginx with cookie WebSocket handshake', await a.$eval('[data-testid="notification-connection"]', (el) => el.textContent.trim() === 'تحديثات مباشرة متصلة'));
  if (phase === 'decisions') {
    const b = await login('b'), admin = await login('admin');
    check('initial inboxes are empty', await rows(a) === 0 && await rows(b) === 0 && await rows(admin) === 0);
    check('committed approval through supported API', await post(admin, `/admin/recharge-requests/${fixture.requestId}/review`, { decision: 'APPROVE', receiptVerified: true }) === 200);
    await liveRows(a, 1);
    check('approval arrives without refresh or navigation', await a.$eval('[data-testid="notification-item"] h2', (el) => el.textContent.includes('الموافقة')));
    check('approval stays private to requester', await rows(b) === 0 && await rows(admin) === 0);
    check('retry preserves immutable decision', await post(admin, `/admin/recharge-requests/${fixture.requestId}/review`, { decision: 'APPROVE', receiptVerified: true }) === 409);
    check('first publication through supported lifecycle API', await post(admin, `/admin/catalog/courses/${fixture.courses[0].id}/transitions`, { to: 'PUBLISHED' }) === 200);
    await liveRows(a, 2); await liveRows(b, 1);
    check('publication reaches both students, excludes admin', await rows(a) === 2 && await rows(b) === 1 && await rows(admin) === 0);
    check('explicit purchase succeeds independently of the approval notice', await post(a, '/wallet/purchases', { planId: fixture.planId, idempotencyKey: crypto.randomUUID() }) === 201);
    await a.reload({ waitUntil: 'networkidle0' }); await liveRows(a, 2);
    check('reconnect recovers durable inbox without duplicate rows', await rows(a) === 2);
    await a.screenshot({ path: '/evidence/realtime-ar-dark.png' });
  } else if (phase === 'expiry') {
    await liveRows(a, 3);
    check('effective expiry produced by runtime scanner without playback', await a.$$eval('[data-testid="notification-item"] h2', (els) => els.some((el) => el.textContent.includes('انتهى الاشتراك'))));
    check('expiry arrives through an actual realtime revision', envelopes.length > 0);
    await a.screenshot({ path: '/evidence/expiry-ar-dark.png' });
  } else if (phase === 'outage') {
    await liveRows(a, 3); fs.writeFileSync('/evidence/outage-ready', 'ready');
    await a.waitForFunction(() => document.querySelector('[data-testid="notification-connection"]')?.textContent.includes('غير متصلة'), { timeout: 15000 });
    check('Redis outage disconnects private realtime delivery', true);
    fs.writeFileSync('/evidence/outage-disconnected', 'disconnected');
    await a.waitForFunction(() => document.querySelector('[data-testid="notification-connection"]')?.textContent.trim() === 'تحديثات مباشرة متصلة', { timeout: 45000 });
    await liveRows(a, 3);
    check('Redis restart reconnects and recovers the durable inbox', await rows(a) === 3);
  }
  check('signals contain only schema version and revision', envelopes.length > 0 && envelopes.every((signal) => Object.keys(signal).sort().join(',') === 'revision,schemaVersion'
    && signal.schemaVersion === 1 && /^\d+$/.test(signal.revision)));
  check('private browser storage remains transient', await a.evaluate(async () => Object.keys(localStorage).every((key) => ['edu-platform-lang', 'edu-platform-theme'].includes(key))
    && sessionStorage.length === 0 && (await indexedDB.databases()).length === 0));
} catch {
  if (!results.some((row) => !row.passed)) results.push({ label: `runner stopped during ${step}`, passed: false });
  console.log(`Realtime browser stopped during ${step}.`); process.exitCode = 1;
} finally {
  await browser?.close(); fs.writeFileSync(`/evidence/${phase}-checks.json`, JSON.stringify({ checks: results, skipped: 0 }, null, 2));
  console.log(`M6 ${phase}: passed=${results.filter((row) => row.passed).length}, failed=${results.filter((row) => !row.passed).length}, skipped=0.`);
}
