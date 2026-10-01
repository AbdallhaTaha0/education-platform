/** Docker Chromium checks. Synthetic notices; no recharge/publication/expiry producer claims. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const fixture = JSON.parse(fs.readFileSync('/fixtures/private.json', 'utf8'));
const evidence = '/evidence';
const origin = 'http://localhost:8082';
const results = [];
let step = 'startup';
let browser;
let releaseDelayed;
const errors = [];
function check(label, condition) {
  step = label; results.push({ label, passed: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) throw new Error('check failed');
}
const user = (label) => fixture.users.find((entry) => entry.label === label);
const digits = (value) => value.replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 1632));

try {
  browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--host-resolver-rules=MAP localhost 192.168.65.254'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('pageerror', () => errors.push('page error'));
  let refreshCalls = 0, writesWithCsrf = 0, writeCalls = 0;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/auth/refresh' && request.method() === 'POST') refreshCalls++;
    if (url.pathname.includes('/read-state') || url.pathname.endsWith('/read-all')) {
      writeCalls++; if (request.headers()['x-csrf-token']) writesWithCsrf++;
    }
  });
  const ready = async () => page.waitForFunction(() => {
    const list = document.querySelector('main ul[aria-busy]');
    const refresh = document.querySelector('main button');
    return list?.getAttribute('aria-busy') === 'false' && refresh && !refresh.disabled;
  });
  const ids = async () => page.$$eval('[data-testid="notification-item"]', (rows) => rows.map((row) => row.dataset.notificationId));
  const count = async () => Number(digits(await page.$eval('[data-testid="notification-unread-count"]', (el) => el.textContent.trim())));
  async function clickText(texts, within = 'main') {
    step = 'button interaction';
    const found = await page.evaluate((texts, within) => {
      const buttons = [...document.querySelectorAll(`${within} button`)];
      const button = buttons.find((entry) => texts.includes(entry.textContent.replace(/^\s*✓\s*/, '').trim()));
      if (!button || button.disabled) return false; button.click(); return true;
    }, texts, within);
    if (!found) throw new Error('button unavailable');
  }
  async function openInbox() {
    step = 'open inbox';
    await page.evaluate(() => { location.hash = '#/notifications'; }); await ready();
  }
  async function login(label) {
    step = 'fixture login';
    await page.evaluate(() => { location.hash = '#/login'; });
    await page.waitForSelector('#login-id');
    await page.type('#login-id', user(label).email); await page.type('#login-password', user(label).password);
    await page.click('main button[type="submit"]');
    await page.waitForSelector('[data-testid="notification-entry"]');
  }
  async function logout() {
    step = 'fixture logout';
    await page.evaluate(() => { location.hash = '#/account'; });
    await page.waitForFunction(() => document.querySelector('main dl'));
    await clickText(['Log out', 'تسجيل الخروج']);
    await page.waitForFunction(() => !document.querySelector('[data-testid="notification-entry"]'));
  }
  async function layout(lang, theme, width, label) {
    await page.setViewport({ width, height: width < 600 ? 844 : 900 });
    await page.evaluate((lang) => {
      const buttons = document.querySelectorAll('header .lang-switch button'); buttons[lang === 'ar' ? 0 : 1].click();
    }, lang);
    if (await page.evaluate(() => document.documentElement.dataset.theme) !== theme) {
      await page.click('header button[title][aria-pressed]');
    }
    await page.waitForFunction((lang, theme) => document.documentElement.lang === lang
      && document.documentElement.dataset.theme === theme, {}, lang, theme);
    check(`${label} direction and theme`, await page.evaluate((lang) => document.documentElement.dir === (lang === 'ar' ? 'rtl' : 'ltr'), lang));
    check(`${label} no page overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    check(`${label} translated notice copy`, await page.$eval('[data-testid="notification-item"] h2',
      (el, lang) => lang === 'ar' ? /[\u0600-\u06FF]/.test(el.textContent) : !/[\u0600-\u06FF]/.test(el.textContent), lang));
    check(`${label} touch targets`, await page.$$eval('main button, main li a',
      (els) => els.every((el) => el.getBoundingClientRect().height >= 43.5)));
    check(`${label} text contrast`, await page.evaluate(() => {
      const card = document.querySelector('[data-testid="notification-item"] > div');
      function luminance(color) {
        const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255)
          .map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
      }
      const background = luminance(getComputedStyle(card).backgroundColor);
      return [...card.querySelectorAll('h2,p,a,span.text-muted')].every((el) => {
        const text = luminance(getComputedStyle(el).color); return (Math.max(text, background) + .05) / (Math.min(text, background) + .05) >= 4.5;
      });
    }));
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(evidence, `${label}.png`) });
  }

  await page.goto(origin + '/#/notifications', { waitUntil: 'networkidle0' });
  check('anonymous sign-in prompt without private rows', await page.evaluate(() => !document.querySelector('[data-testid="notification-item"]')
    && Boolean(document.querySelector('main a[href="#/login"]'))));
  check('Arabic default', await page.evaluate(() => document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl'));
  check('anonymous header has no private entry', await page.$('[data-testid="notification-entry"]') === null);
  await login('a'); await openInbox();
  check('first page has twenty notices', (await ids()).length === 20);
  check('own unread count is exact', await count() === 105);
  const entry = await page.$eval('[data-testid="notification-entry"]', (el) => ({ text: el.textContent, label: el.getAttribute('aria-label') }));
  check('badge capped visually with full accessible count', digits(entry.text).includes('99+') && digits(entry.label).includes('105'));
  check('foreign recipient not present', (await ids()).every((id) => !fixture.foreignNoticeIds.includes(id)));
  check('unavailable course is text with no unsafe destination', await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="notification-item"]')];
    return rows.some((row) => row.textContent.includes('هذه الدورة لم تعد متاحة.') && !row.querySelector('a'));
  }));
  check('dates are directionally isolated', await page.$$eval('main time', (els) => els.length > 0 && els.every((el) => el.parentElement.tagName === 'BDI')));
  check('dedicated route title', (await page.title()).includes('الإشعارات') && (await page.title()).includes('FAYQ'));
  check('selected filter has visible checkmark', await page.$eval('[data-notification-filter][aria-pressed="true"]', (el) => el.textContent.includes('✓')));
  const writesBeforeLink = writeCalls;
  await page.click('[data-testid="notification-item"] a[href="#/wallet"]');
  await page.waitForFunction(() => location.hash === '#/wallet'); await openInbox();
  check('opening a target does not implicitly mark read', await count() === 105 && writeCalls === writesBeforeLink);
  await page.click('[data-testid="notification-item"] button'); await ready();
  check('explicit mark-read updates count', await count() === 104);
  await page.click('[data-testid="notification-item"] button'); await ready();
  check('explicit mark-unread restores count', await count() === 105);
  await clickText(['Show more', 'عرض المزيد']); await ready();
  check('pagination loads forty unique rows', (await ids()).length === 40 && new Set(await ids()).size === 40);
  const loadedIds = await ids(); await clickText(['Refresh', 'تحديث']); await ready();
  check('refresh preserves loaded window and order', JSON.stringify(await ids()) === JSON.stringify(loadedIds));

  let fault = 'none'; let delayedReady = false; let delayedDelivered = false;
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname === '/api/notifications' && request.method() === 'GET' && fault === 'refresh401') {
        fault = 'none'; await request.respond({ status: 401, contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'TOKEN_INVALID', message: 'Fixture token boundary.' } }) }); return;
      }
      if (url.pathname.includes('/read-state') && fault === 'write503') {
        fault = 'none'; await request.respond({ status: 503, contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'NOTIFICATIONS_UNAVAILABLE', message: 'Fixture outage.' } }) }); return;
      }
      if (url.pathname === '/api/notifications' && fault === 'list503') {
        fault = 'none'; await request.respond({ status: 503, contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'NOTIFICATIONS_UNAVAILABLE', message: 'Fixture outage.' } }) }); return;
      }
      if (url.pathname === '/api/notifications' && fault === 'delay') {
        fault = 'none';
        const headers = { ...request.headers() }; delete headers.host;
        const res = await fetch('http://host.docker.internal:8082' + url.pathname + url.search, { headers });
        const body = await res.text();
        await new Promise((resolve) => { releaseDelayed = resolve; delayedReady = true; });
        await request.respond({ status: res.status, contentType: 'application/json', body }); delayedDelivered = true; return;
      }
      await request.continue();
    } catch { /* The page can close an intentionally delayed request during teardown. */ }
  });
  const refreshBefore = refreshCalls; fault = 'refresh401'; await clickText(['Refresh', 'تحديث']); await ready();
  check('one coordinated cookie refresh then successful retry', refreshCalls === refreshBefore + 1 && await count() === 105);
  fault = 'write503'; await page.click('[data-testid="notification-item"] button'); await ready();
  check('failed read shows error and retains server read state', await count() === 105
    && await page.$('[role="alert"]') !== null && await page.$eval('[data-testid="notification-item"] button', (el) => el.textContent.includes('تحديد كمقروء')));
  fault = 'list503'; await clickText(['Refresh', 'تحديث']); await ready();
  check('load failure exposes retry while preserving private loaded rows', (await ids()).length === 40 && await page.$('[role="alert"] button') !== null);
  await page.click('[role="alert"] button'); await ready();
  check('retry recovers from failed refresh', await page.$('[role="alert"]') === null && await count() === 105);
  await page.setOfflineMode(true);
  await page.waitForFunction(() => !navigator.onLine);
  await page.waitForFunction(() => document.querySelector('main').textContent.includes('أنت غير متصل.'));
  check('offline status visible', await page.evaluate(() => document.querySelector('main').textContent.includes('أنت غير متصل.')));
  await page.setOfflineMode(false); await ready();
  check('online recovery refreshes current inbox', await count() === 105);

  await layout('ar', 'dark', 1280, 'desktop-ar-dark');
  await layout('en', 'light', 1280, 'desktop-en-light');
  await layout('ar', 'dark', 390, 'mobile-ar-dark');
  await layout('en', 'light', 390, 'mobile-en-light');
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluate(() => document.querySelector('main h1').focus()); await page.keyboard.press('Tab');
  check('keyboard reaches refresh with visible focus', await page.evaluate(() => document.activeElement?.textContent === 'Refresh'
    && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2));
  await clickText(['Mark all as read']); await ready();
  check('mark-all-read reaches the observed whole inbox', await count() === 0 && await page.$$eval('[data-testid="notification-item"] button',
    (buttons) => buttons.every((button) => button.textContent === 'Mark as unread')));
  await page.click('[data-notification-filter]:nth-of-type(2)'); await ready();
  check('unread filter has a clear empty state', (await ids()).length === 0 && await page.evaluate(() => document.querySelector('main').textContent.includes('No unread notifications')));
  await page.click('[data-notification-filter]:nth-of-type(1)'); await ready();
  await page.click('[data-testid="notification-item"] button'); await ready();
  await page.click('[data-notification-filter]:nth-of-type(2)'); await ready();
  check('unread filter shows the explicitly reopened notice', (await ids()).length === 1 && await count() === 1);
  await page.click('[data-testid="notification-item"] button'); await ready();
  check('focus preserved when read notice leaves unread filter', await page.evaluate(() => document.activeElement?.matches('[data-notification-filter][aria-pressed="true"]')));
  await page.click('[data-notification-filter]:nth-of-type(1)'); await ready();
  fault = 'delay'; await clickText(['Refresh']);
  const delayDeadline = Date.now() + 10000;
  while (!delayedReady && Date.now() < delayDeadline) await new Promise((resolve) => setTimeout(resolve, 20));
  if (!delayedReady) throw new Error('delayed fixture unavailable');
  await logout(); await login('b'); await openInbox();
  releaseDelayed(); releaseDelayed = null;
  const deliveryDeadline = Date.now() + 10000;
  while (!delayedDelivered && Date.now() < deliveryDeadline) await new Promise((resolve) => setTimeout(resolve, 20));
  if (!delayedDelivered) throw new Error('delayed fixture not delivered');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await ready();
  check('late prior-account response cannot restore old private notices', (await ids()).length === 1
    && (await ids()).every((id) => fixture.foreignNoticeIds.includes(id)) && await count() === 1);
  await logout(); await login('admin'); await openInbox();
  check('admin entry shows only its own empty inbox', (await ids()).length === 0 && await count() === 0);
  const revoked = await page.evaluate(async () => {
    const csrf = document.cookie.split(';').map((v) => v.trim()).find((v) => v.startsWith('edu_csrf='));
    return (await fetch('/api/auth/logout-all', { method: 'POST', credentials: 'include',
      headers: { 'x-csrf-token': decodeURIComponent(csrf.slice('edu_csrf='.length)) } })).status;
  });
  check('session revocation fixture succeeds through supported API', revoked === 200);
  await clickText(['Refresh']);
  await page.waitForFunction(() => !document.querySelector('[data-testid="notification-entry"]') && document.querySelector('main a[href="#/login"]'));
  check('final auth failure clears inbox and returns to sign-in state', (await ids()).length === 0);
  check('writes carry session CSRF', writeCalls > 0 && writesWithCsrf === writeCalls);
  const storage = await page.evaluate(async () => ({
    local: Object.keys(localStorage), session: Object.keys(sessionStorage), databases: (await indexedDB.databases()).length,
  }));
  check('private state absent from persistent browser storage', storage.local.every((key) => ['edu-platform-lang', 'edu-platform-theme'].includes(key))
    && storage.session.length === 0 && storage.databases === 0);
  check('no uncaught browser errors', errors.length === 0);
} catch {
  if (!results.some((result) => !result.passed)) results.push({ label: `runner stopped during ${step}`, passed: false });
  console.log(`M6 browser stopped during ${step}.`); process.exitCode = 1;
} finally {
  if (releaseDelayed) releaseDelayed();
  await browser?.close();
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(path.join(evidence, 'checks.json'), JSON.stringify({ checks: results, skipped: 0 }, null, 2));
  const failed = results.filter((result) => !result.passed).length;
  console.log(`M6 BROWSER: passed=${results.length - failed}, failed=${failed}, skipped=0.`);
}
