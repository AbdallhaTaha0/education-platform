/** M7-02 PostCSS verification: rendered UI across the language/theme/width matrix.
 *
 * Runs inside the disposable m7-02-postcss project against its INTERNAL nginx
 * (no host ports, no access to the port-8082 preview). Inbox rows are the
 * labelled synthetic fixtures materialized through the real notification
 * store (`m6-ui:<run>:` event keys); they prove rendering only, not external
 * playback or real bank receipt.
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { lookup } from 'node:dns/promises';

const fixture = JSON.parse(fs.readFileSync('/fixtures/m6-inbox-ui-fixtures.json', 'utf8'));
const evidence = '/evidence';
const origin = 'http://localhost:8082';
const results = [];
let step = 'startup';
let browser;
const errors = [];
function check(label, condition) {
  step = label;
  results.push({ label, passed: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) throw new Error('check failed');
}
const user = (label) => fixture.users.find((entry) => entry.label === label);
const digits = (value) => value.replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 1632));

try {
  const address = (await lookup('nginx')).address;
  console.log(`resolved nginx=${address}`);
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--host-resolver-rules=MAP localhost ${address}`,
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('pageerror', () => errors.push('page error'));
  page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
  const ready = async () =>
    page.waitForFunction(
      () => {
        const list = document.querySelector('main ul[aria-busy]');
        const refresh = document.querySelector('main button');
        return list?.getAttribute('aria-busy') === 'false' && refresh && !refresh.disabled;
      },
      { timeout: 30000 },
    );
  const ids = async () =>
    page.$$eval('[data-testid="notification-item"]', (rows) =>
      rows.map((row) => row.dataset.notificationId),
    );
  const count = async () =>
    Number(
      digits(
        await page.$eval('[data-testid="notification-unread-count"]', (el) =>
          el.textContent.trim(),
        ),
      ),
    );
  async function clickText(texts, within = 'main') {
    step = 'button interaction';
    const found = await page.evaluate(
      (texts, within) => {
        const buttons = [...document.querySelectorAll(`${within} button`)];
        const button = buttons.find((entry) =>
          texts.includes(entry.textContent.replace(/^\s*✓\s*/, '').trim()),
        );
        if (!button || button.disabled) return false;
        button.click();
        return true;
      },
      texts,
      within,
    );
    if (!found) throw new Error('button unavailable');
  }
  async function openInbox() {
    step = 'open inbox';
    await page.evaluate(() => {
      location.hash = '#/notifications';
    });
    await ready();
  }
  async function settlePaint() {
    step = 'settle repaint';
    await page.waitForFunction(
      () =>
        new Promise((resolve) => {
          const sample = () => {
            const card = document.querySelector('[data-testid="notification-item"] > div');
            const text = card && [...card.querySelectorAll('h2,p,a,span.text-muted')];
            return card && text.length
              ? getComputedStyle(card).backgroundColor +
                  '|' +
                  text.map((el) => getComputedStyle(el).color).join('|')
              : null;
          };
          let previous = sample();
          let stable = 0;
          const timer = setInterval(() => {
            const current = sample();
            stable = current !== null && current === previous ? stable + 1 : 0;
            previous = current;
            if (stable >= 2) {
              clearInterval(timer);
              resolve(true);
            }
          }, 250);
          setTimeout(() => {
            clearInterval(timer);
            resolve(false);
          }, 8000);
        }),
      { timeout: 30000 },
    );
  }
  async function login(label) {
    step = 'fixture login';
    await page.evaluate(() => {
      location.hash = '#/login';
    });
    await page.waitForSelector('#login-id', { timeout: 30000 });
    await page.type('#login-id', user(label).email);
    await page.type('#login-password', user(label).password);
    await page.click('main button[type="submit"]');
    await page.waitForSelector('[data-testid="notification-entry"]', { timeout: 30000 });
  }
  async function layout(lang, theme, width, label) {
    await page.setViewport({ width, height: width < 600 ? 844 : 900 });
    await page.evaluate((lang) => {
      const buttons = document.querySelectorAll('header .lang-switch button');
      buttons[lang === 'ar' ? 0 : 1].click();
    }, lang);
    if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== theme) {
      await page.click('header button[title][aria-pressed]');
    }
    await page.waitForFunction(
      (lang, theme) =>
        document.documentElement.lang === lang && document.documentElement.dataset.theme === theme,
      { timeout: 30000 },
      lang,
      theme,
    );
    await ready();
    await settlePaint();
    check(
      `${label} lang/dir/theme state`,
      await page.evaluate(
        (lang, theme) =>
          document.documentElement.lang === lang &&
          document.documentElement.dir === (lang === 'ar' ? 'rtl' : 'ltr') &&
          document.documentElement.dataset.theme === theme,
        lang,
        theme,
      ),
    );
    check(
      `${label} header navigation present`,
      await page.evaluate(() => document.querySelectorAll('header a, header button').length > 2),
    );
    check(
      `${label} stylesheet applied`,
      await page.evaluate(
        () =>
          document.styleSheets.length > 0 &&
          getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)',
      ),
    );
    check(
      `${label} no page overflow`,
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    );
    check(
      `${label} translated notice copy`,
      await page.$eval(
        '[data-testid="notification-item"] h2',
        (el, lang) =>
          lang === 'ar'
            ? /[\u0600-\u06FF]/.test(el.textContent)
            : !/[\u0600-\u06FF]/.test(el.textContent),
        lang,
      ),
    );
    check(
      `${label} touch targets`,
      await page.$$eval('main button, main li a', (els) =>
        els.every((el) => el.getBoundingClientRect().height >= 43.5),
      ),
    );
    check(
      `${label} text contrast`,
      await page.evaluate(() => {
        const card = document.querySelector('[data-testid="notification-item"] > div');
        function luminance(color) {
          const values = color
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number)
            .map((v) => v / 255)
            .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
          return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
        }
        const background = luminance(getComputedStyle(card).backgroundColor);
        return [...card.querySelectorAll('h2,p,a,span.text-muted')].every((el) => {
          const text = luminance(getComputedStyle(el).color);
          return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05) >= 4.5;
        });
      }),
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(evidence, `${label}.png`) });
  }

  await page.goto(origin + '/#/notifications', { waitUntil: 'networkidle0', timeout: 60000 });
  check(
    'anonymous sign-in prompt without private rows',
    await page.evaluate(
      () =>
        !document.querySelector('[data-testid="notification-item"]') &&
        Boolean(document.querySelector('main a[href="#/login"]')),
    ),
  );
  check(
    'Arabic default',
    await page.evaluate(
      () => document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl',
    ),
  );
  await login('a');
  await openInbox();
  check('first page has twenty notices', (await ids()).length === 20);
  check('own unread count is exact', (await count()) === 105);
  check(
    'served stylesheets load with 200',
    await page.evaluate(async () => {
      const hrefs = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .map((el) => el.href)
        .filter((href) => href.startsWith(location.origin));
      if (hrefs.length === 0) return false;
      for (const href of hrefs) {
        if ((await fetch(href, { credentials: 'include' })).status !== 200) return false;
      }
      return true;
    }),
  );
  await page.click('[data-testid="notification-item"] a[href="#/wallet"]');
  await page.waitForFunction(() => location.hash === '#/wallet', { timeout: 30000 });
  await openInbox();
  check(
    'target navigation works and inbox restores',
    (await ids()).length === 20 && (await count()) === 105,
  );

  await layout('ar', 'dark', 390, 'm7-02-mobile-ar-dark');
  await layout('ar', 'light', 390, 'm7-02-mobile-ar-light');
  await layout('en', 'dark', 390, 'm7-02-mobile-en-dark');
  await layout('en', 'light', 390, 'm7-02-mobile-en-light');
  await layout('ar', 'dark', 1280, 'm7-02-desktop-ar-dark');
  await layout('ar', 'light', 1280, 'm7-02-desktop-ar-light');
  await layout('en', 'dark', 1280, 'm7-02-desktop-en-dark');
  await layout('en', 'light', 1280, 'm7-02-desktop-en-light');
  await page.evaluate(() => document.querySelector('main h1').focus());
  await page.keyboard.press('Tab');
  check(
    'keyboard reaches refresh with visible focus',
    await page.evaluate(
      () =>
        document.activeElement?.textContent === 'Refresh' &&
        parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2,
    ),
  );
  await page.click('[data-testid="notification-item"] button');
  await ready();
  check('explicit mark-read updates count', (await count()) === 104);
  await page.click('[data-testid="notification-item"] button');
  await ready();
  check('explicit mark-unread restores count', (await count()) === 105);
  await clickText(['Mark all as read']);
  await ready();
  check('mark-all-read reaches the observed whole inbox', (await count()) === 0);
  const storage = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    databases: (await indexedDB.databases()).length,
  }));
  check(
    'private state absent from persistent browser storage',
    storage.local.every((key) => ['edu-platform-lang', 'edu-platform-theme'].includes(key)) &&
      storage.session.length === 0 &&
      storage.databases === 0,
  );
  check('no uncaught browser errors or failed requests', errors.length === 0);
} catch {
  if (!results.some((result) => !result.passed))
    results.push({ label: `runner stopped during ${step}`, passed: false });
  console.log(`M7-02 browser stopped during ${step}.`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(
    path.join(evidence, 'm7-02-checks.json'),
    JSON.stringify({ checks: results, skipped: 0 }, null, 2),
  );
  const failed = results.filter((result) => !result.passed).length;
  console.log(`M7-02 BROWSER: passed=${results.length - failed}, failed=${failed}, skipped=0.`);
}
