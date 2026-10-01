/** Real two-container backend verification through private test Nginx. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { lookup } from 'node:dns/promises';
const f = JSON.parse(fs.readFileSync('/fixtures/private.json', 'utf8'));
const phase = process.env.M6_PHASE ?? 'replicas';
const results = [],
  envelopes = [],
  handshakes = [];
let browser,
  step = 'startup';
const save = (name) => fs.writeFileSync(`/evidence/${name}`, 'ready');
function check(label, passed) {
  step = label;
  results.push({ label, passed: Boolean(passed) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
  if (!passed) throw new Error('check failed');
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFile(name) {
  const deadline = Date.now() + 60000;
  while (!fs.existsSync(`/evidence/${name}`)) {
    if (Date.now() > deadline) throw new Error('checkpoint timeout');
    await pause(250);
  }
}
try {
  const address = (await lookup('nginx')).address;
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--host-resolver-rules=MAP localhost ${address}`,
    ],
  });
  async function login(label, replica = 'a') {
    const context = await browser.createBrowserContext(),
      page = await context.newPage(),
      user = f.users.find((u) => u.label === label);
    await page.setExtraHTTPHeaders({ 'x-m6-replica': replica });
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    cdp.on('Network.webSocketHandshakeResponseReceived', ({ response }) =>
      handshakes.push({
        label,
        upstream: String(response.headers['X-M6-Upstream'] ?? response.headers['x-m6-upstream'])
          .split(',')
          .at(-1)
          .trim(),
      }),
    );
    cdp.on('Network.webSocketFrameReceived', ({ response }) => {
      const at = response.payloadData.indexOf('["notifications:changed",');
      if (at >= 0) {
        try {
          envelopes.push(JSON.parse(response.payloadData.slice(at))[1]);
        } catch {}
      }
    });
    await page.goto('http://localhost:8082/#/login', { waitUntil: 'networkidle0' });
    await page.type('#login-id', user.email);
    await page.type('#login-password', user.password);
    await page.click('main button[type="submit"]');
    await page.waitForSelector('[data-testid="notification-entry"]');
    await page.evaluate(() => {
      location.hash = '#/notifications';
    });
    await connected(page);
    return page;
  }
  async function connected(page) {
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="notification-connection"]')?.textContent.trim() ===
        'تحديثات مباشرة متصلة',
      { timeout: 55000 },
    );
  }
  const liveRows = (page, count) =>
    page.waitForFunction(
      (count) => document.querySelectorAll('[data-testid="notification-item"]').length === count,
      { timeout: 20000 },
      count,
    );
  const rows = (page) => page.$$eval('[data-testid="notification-item"]', (els) => els.length);
  async function request(page, path, method = 'GET', body) {
    return page.evaluate(
      async (path, method, body) => {
        const csrf = document.cookie
          .split(';')
          .map((v) => v.trim())
          .find((v) => v.startsWith('edu_csrf='));
        const res = await fetch('/api' + path, {
          method,
          credentials: 'include',
          headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(method !== 'GET' ? { 'x-csrf-token': decodeURIComponent(csrf.slice(9)) } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return {
          status: res.status,
          upstream: res.headers.get('x-m6-upstream'),
          cache: res.headers.get('cache-control'),
          body: await res.json(),
        };
      },
      path,
      method,
      body,
    );
  }
  const a = await login('a');
  check(
    'student socket handshake terminates on backend A',
    handshakes.some((h) => h.label === 'a' && h.upstream === process.env.M6_A_IP + ':3000'),
  );
  if (phase === 'replicas') {
    const b = await login('b', 'b'),
      admin = await login('admin', 'b');
    check(
      'other student socket terminates on separate backend B',
      handshakes.some((h) => h.label === 'b' && h.upstream === process.env.M6_B_IP + ':3000'),
    );
    await a.setExtraHTTPHeaders({ 'x-m6-replica': 'b' });
    const approval = await request(
      admin,
      `/admin/recharge-requests/${f.requestId}/review`,
      'POST',
      { decision: 'APPROVE', receiptVerified: true },
    );
    check(
      'real approval commits on B while requesting student socket stays on A',
      approval.status === 200 && approval.upstream === process.env.M6_B_IP + ':3000',
    );
    await liveRows(a, 1);
    check(
      'cross-replica approval arrives automatically and stays private',
      (await rows(b)) === 0 && (await rows(admin)) === 0,
    );
    await admin.setExtraHTTPHeaders({ 'x-m6-replica': 'a' });
    const retry = await request(admin, `/admin/recharge-requests/${f.requestId}/review`, 'POST', {
      decision: 'APPROVE',
      receiptVerified: true,
    });
    check(
      'duplicate review on other replica remains 409',
      retry.status === 409 && retry.upstream === process.env.M6_A_IP + ':3000',
    );
    await admin.setExtraHTTPHeaders({ 'x-m6-replica': 'b' });
    const published = await request(
      admin,
      `/admin/catalog/courses/${f.courses[0].id}/transitions`,
      'POST',
      { to: 'PUBLISHED' },
    );
    check(
      'validated publication commits on B',
      published.status === 200 && published.upstream === process.env.M6_B_IP + ':3000',
    );
    await liveRows(a, 2);
    await liveRows(b, 1);
    check(
      'frozen broadcast converges on both replicas and excludes admin',
      (await rows(admin)) === 0,
    );
    const own = await request(a, '/notifications');
    const foreign = await request(
      b,
      `/notifications/${own.body.data.items.find((n) => n.type === 'RECHARGE_APPROVED').id}/read-state`,
      'PUT',
      { read: true },
    );
    check(
      'foreign notice remains inaccessible on the second replica',
      foreign.status === 404 && foreign.body.error.code === 'NOT_FOUND',
    );
    const purchase = await request(a, '/wallet/purchases', 'POST', {
      planId: f.planId,
      idempotencyKey: crypto.randomUUID(),
    });
    check(
      'explicit purchase remains separate and succeeds on B',
      purchase.status === 201 && purchase.upstream === process.env.M6_B_IP + ':3000',
    );
    // Default upstream proves ordinary requests also use both replicas, without affinity.
    await a.setExtraHTTPHeaders({});
    const peers = new Set();
    for (let i = 0; i < 8; i++)
      peers.add((await request(a, '/notifications/unread-count')).upstream);
    check(
      'ordinary private HTTP reads reach both round-robin replicas',
      peers.has(process.env.M6_A_IP + ':3000') && peers.has(process.env.M6_B_IP + ':3000'),
    );
    save('kill-a-ready');
    await waitFile('kill-a-done');
    await connected(a);
    await a.waitForFunction(
      () => document.querySelectorAll('[data-testid="notification-item"]').length === 2,
    );
    check(
      'killed socket owner reconnects to surviving B through Nginx',
      handshakes.filter((h) => h.label === 'a').at(-1)?.upstream === process.env.M6_B_IP + ':3000',
    );
    check(
      'backend kill preserves the exact durable inbox',
      (await request(a, '/notifications')).body.data.items.length === 2,
    );
    save('kill-a-recovered');
    await waitFile('restart-a-done');
    await a.setExtraHTTPHeaders({ 'x-m6-replica': 'a' });
    check(
      'restarted A serves the same inbox as connected B',
      (await request(a, '/notifications')).body.data.items.length === 2,
    );
    await a.screenshot({ path: '/evidence/replicas-ar-dark.png' });
  } else if (phase === 'database') {
    const before = (await request(a, '/notifications')).body.data.items.length;
    save('database-ready');
    await waitFile('database-stopped');
    await a.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="notification-connection"]')
          ?.textContent.trim()
          .startsWith('التحديثات المباشرة غير متصلة.'),
      { timeout: 35000 },
    );
    const denied = await request(a, '/notifications');
    check('PostgreSQL outage closes ongoing private realtime authority', true);
    check(
      'private HTTP dependency failure is sanitized and unavailable',
      denied.status === 503 &&
        denied.body.error.code === 'NOTIFICATIONS_UNAVAILABLE' &&
        denied.cache === 'no-store',
    );
    save('database-observed');
    await waitFile('database-started');
    await connected(a);
    const after = await request(a, '/notifications');
    check(
      'PostgreSQL recovery restores exact durable inbox without backend restart',
      after.status === 200 && after.body.data.items.length === before,
    );
  } else if (phase === 'signal') {
    save('signal-listener-ready');
    await waitFile('signal-published');
    await a.waitForFunction(
      (count) => document.querySelectorAll('[data-testid="notification-item"]').length === count,
      { timeout: 15000 },
      Number(process.env.M6_EXPECTED_NOTICES),
    );
    check(
      'publication before sender crash reaches a different listener replica',
      envelopes.length > 1,
    );
    check(
      'signal-before-ack crash changes inbox only once',
      (await rows(a)) === Number(process.env.M6_EXPECTED_NOTICES),
    );
    save('signal-browser-observed');
  } else throw new Error('unknown browser phase');
  check(
    'all realtime envelopes contain only schema version and revision',
    envelopes.length > 0 &&
      envelopes.every(
        (e) =>
          Object.keys(e).sort().join(',') === 'revision,schemaVersion' &&
          e.schemaVersion === 1 &&
          /^\d{1,20}$/.test(e.revision),
      ),
  );
  check(
    'browser retains only harmless display preferences',
    await a.evaluate(
      async () =>
        Object.keys(localStorage).every((key) =>
          ['edu-platform-lang', 'edu-platform-theme'].includes(key),
        ) &&
        sessionStorage.length === 0 &&
        (await indexedDB.databases()).length === 0,
    ),
  );
} catch {
  if (!results.some((r) => !r.passed))
    results.push({ label: `runner stopped during ${step}`, passed: false });
  console.log(`Acceptance browser stopped during ${step}.`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  fs.writeFileSync(
    `/evidence/${phase}-browser.json`,
    JSON.stringify({ checks: results, skipped: 0 }, null, 2),
  );
  console.log(
    `M6 acceptance ${phase}: passed=${results.filter((r) => r.passed).length}, failed=${results.filter((r) => !r.passed).length}, skipped=0.`,
  );
}
