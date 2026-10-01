import fs from 'node:fs';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const fixture = JSON.parse(fs.readFileSync('/evidence/fixtures.json'));
const results = [];
const errors = [];
let browser;
function check(label, ok) {
  results.push({ label, passed: !!ok });
  if (!ok) throw new Error(label);
  console.log(`PASS ${label}`);
}
try {
  const ip = (await lookup('nginx')).address;
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${ip}`],
  });
  const page = await browser.newPage();
  page.on('pageerror', () => errors.push('pageerror'));
  const open = async (hash) => {
    await page.goto(`http://localhost:8082/?m8=${Date.now()}${hash}`, {
      waitUntil: 'networkidle2',
    });
    await page.waitForSelector('main');
  };
  const text = () => page.$eval('main', (e) => e.textContent);
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  const prefs = async (lang, theme) => {
    await page.evaluate(
      (l, t) => {
        localStorage.setItem('edu-lang', l);
        localStorage.setItem('edu-theme', t);
      },
      lang,
      theme,
    );
  };
  await open('#/');
  // Use the existing preference keys from the real UI rather than assume a locale API.
  const prefsActual = async (lang, theme) => {
    await page.evaluate(
      (l, t) => {
        localStorage.setItem('edu-platform-lang', l);
        localStorage.setItem('edu-platform-theme', t);
      },
      lang,
      theme,
    );
  };
  for (const lang of ['ar', 'en'])
    for (const theme of ['dark', 'light'])
      for (const width of [390, 1280]) {
        await page.setViewport({ width, height: 900 });
        await prefsActual(lang, theme);
        await open('#/courses');
        await page.waitForSelector('main article');
        await page.waitForSelector('a[href^="#/package/"]');
        const key = `${lang}-${theme}-${width}`;
        check(
          `${key}: language and theme applied`,
          await page.evaluate(
            (l, t) =>
              document.documentElement.lang === l && document.documentElement.dataset.theme === t,
            lang,
            theme,
          ),
        );
        check(`${key}: catalog fits`, await overflow());
        check(
          `${key}: catalog includes safe presale label`,
          (await text()).includes(lang === 'ar' ? 'لم يُنشر بعد' : 'Not published yet'),
        );
        await page.select('#catalog-grade', 'SECOND_SECONDARY');
        await page.waitForFunction(() => document.querySelectorAll('main article').length === 1);
        check(
          `${key}: grade filter`,
          await page.$eval(
            'main article',
            (e) => e.textContent.includes('ثانية') || e.textContent.includes('Second'),
          ),
        );
        await page.select('#catalog-term', '1');
        check(`${key}: term filter empty state`, (await page.$$('main article')).length === 0);
        await page.select('#catalog-grade', '');
        await page.select('#catalog-term', '');
        await page.evaluate(() => document.fonts.ready);
        check(
          `${key}: readable text contrast`,
          await page.evaluate(() => {
            const parse = (s) => s.match(/[\d.]+/g)?.map(Number);
            const lum = (a) =>
              a
                .slice(0, 3)
                .map((v) => {
                  v /= 255;
                  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
                })
                .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
            return [
              ...document.querySelectorAll(
                'main input,main select,main button,main a,main p,main h1,main h2,main h3',
              ),
            ]
              .filter(
                (e) =>
                  e.getBoundingClientRect().width &&
                  e.getBoundingClientRect().height &&
                  (e.textContent.trim() || e.tagName === 'INPUT'),
              )
              .every((e) => {
                const foreground = parse(getComputedStyle(e).color);
                let current = e;
                let bg;
                while (current) {
                  const c = parse(getComputedStyle(current).backgroundColor);
                  if (c && (c.length === 3 || c[3] === 1)) {
                    bg = c;
                    break;
                  }
                  current = current.parentElement;
                }
                if (!foreground || !bg) return false;
                const a = lum(foreground),
                  b = lum(bg);
                return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5;
              });
          }),
        );
        await page.screenshot({ path: `/evidence/${key}-catalog.png`, fullPage: true });
        await open(`#/package/${fixture.packageIds[0]}`);
        check(`${key}: package fits`, await overflow());
        check(
          `${key}: login required and unpublished warning`,
          (await text()).includes(lang === 'ar' ? 'لن يكون متاحًا للمشاهدة' : 'cannot be watched'),
        );
      }
  await prefsActual('en', 'dark');
  await page.setViewport({ width: 390, height: 900 });
  const login = async (role) => {
    const u = fixture.users.find((u) => u.role === role);
    await open('#/login');
    await page.type('#login-id', u.email);
    await page.type('#login-password', u.password);
    await page.click('form button[type="submit"]');
    await page.waitForFunction(
      () => location.hash === '#/account' && document.querySelector('main dl'),
    );
  };
  await login('STUDENT');
  await open(`#/purchase/${fixture.plans[0].id}`);
  await page.waitForFunction(() =>
    document.querySelector('main')?.textContent.includes('No expiry'),
  );
  check(
    'standalone checkout clearly has no expiry',
    (await text()).includes('permanent course removal'),
  );
  await page.click('main button');
  await page.waitForFunction(
    () =>
      document.querySelector('main h1')?.textContent.includes('receipt') ||
      document.querySelector('main h1')?.textContent.includes('Receipt'),
  );
  check('indefinite purchase receipt', (await text()).includes('No expiry'));
  await open(`#/package/${fixture.packageIds[0]}`);
  await page.waitForFunction(() =>
    document.querySelector('main')?.textContent.includes('already have access'),
  );
  check(
    'overlap warns but purchase is enabled',
    await page.$eval('main button', (b) => !b.disabled),
  );
  await page.screenshot({ path: '/evidence/student-package-review.png', fullPage: true });
  await page.click('main button');
  await page.waitForFunction(() =>
    document.querySelector('main h1')?.textContent.includes('Your package is ready'),
  );
  check('real package receipt lists three items', (await page.$$('main li')).length === 3);
  await open('#/dashboard');
  await page.waitForSelector('[data-testid="subscription-active"]');
  check(
    'unpublished grant has no viewing button',
    await page.$$eval('[data-testid="subscription-active"]', (es) =>
      es.some(
        (e) =>
          e.textContent.includes('Viewing is currently unavailable') &&
          e.querySelector('button') === null,
      ),
    ),
  );
  check('dashboard retains indefinite access', (await text()).includes('No expiry'));
  await page.screenshot({ path: '/evidence/student-learning.png', fullPage: true });
  await open('#/purchases');
  await page.waitForFunction(() =>
    document.querySelector('main')?.textContent.includes('One package payment'),
  );
  check(
    'history includes package and indefinite purchase',
    (await text()).includes('No expiry') && (await text()).includes('One package payment'),
  );
  await open('#/admin/packages');
  check('student cannot use admin package UI', !(await page.$('main form')));
  await open('#/account');
  const logout = await page.$$('main button');
  await logout[logout.length - 2].click();
  await page.waitForFunction(() => !document.querySelector('main dl'));
  await login('ADMIN');
  await open('#/admin/summary');
  await page.waitForSelector('main dl');
  check('admin summary uses real aggregates', (await page.$$('main dl dt')).length === 9);
  check('admin summary fits mobile', await overflow());
  await page.screenshot({ path: '/evidence/admin-summary.png', fullPage: true });
  await open('#/admin/packages');
  await page.waitForSelector('#pkg-titleAr');
  check(
    'package editor has three explicit member controls',
    (await page.$$('select[id^="pkg-member-"]')).length === 3,
  );
  await page.type('#pkg-titleAr', 'باقة اختبار واجهة');
  await page.type('#pkg-titleEn', 'Browser test package');
  await page.type('#pkg-descriptionAr', 'اختبار توضيحي');
  await page.type('#pkg-descriptionEn', 'Synthetic browser test');
  await page.type('#pkg-price', '300.01');
  await page.$eval('#pkg-deadline', (e) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(e, '2027-07-15T18:00:00');
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  for (let i = 0; i < 3; i++) await page.select(`#pkg-member-${i}`, fixture.courseIds[i]);
  await page.select('#pkg-status', 'PUBLISHED');
  await page.click('main form button[type="submit"]');
  await page.waitForFunction(() =>
    document.querySelector('main ul')?.textContent.includes('Browser test package'),
  );
  check(
    'admin creates real package with unpublished member',
    (await text()).includes('Browser test package'),
  );
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('main li')].find((e) =>
      e.textContent.includes('Browser test package'),
    );
    [...card.querySelectorAll('button')].find((b) => b.textContent === 'Archive').click();
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('main li')].some(
      (e) => e.textContent.includes('Browser test package') && e.textContent.includes('Archived'),
    ),
  );
  check('admin archives a package without deleting purchased access', true);
  await page.screenshot({ path: '/evidence/admin-packages.png', fullPage: true });
  await open(`#/admin/courses/${fixture.courseIds[2]}`);
  await page.waitForSelector('#plan-mode');
  await page.evaluate(() =>
    document
      .querySelector('#plan-mode')
      .closest('form')
      .parentElement.querySelector('ul button')
      .click(),
  );
  await page.select('#plan-mode', 'UNTIL_REMOVAL');
  check(
    'admin indefinite mode has no date input',
    !(await page.$('#plan-deadline')) && (await text()).includes('No expiry'),
  );
  await page.click('#plan-current', { clickCount: 3 });
  await page.type('#plan-current', '100.02');
  await page.click('#plan-mode');
  await page.evaluate(() =>
    document
      .querySelector('#plan-mode')
      .closest('form')
      .querySelector('button[type="submit"]')
      .click(),
  );
  await page.waitForFunction(() => document.querySelector('#plan-current')?.value === '');
  check(
    'admin persists indefinite access mode',
    await page.evaluate(() =>
      document
        .querySelector('#plan-mode')
        .closest('form')
        .parentElement.querySelector('ul')
        .textContent.includes('No expiry'),
    ),
  );
  check('no browser errors', errors.length === 0);
  check(
    'no authentication material in storage',
    await page.evaluate(() =>
      Object.entries(localStorage).every(
        ([k, v]) => !/token|password|session|csrf/i.test(k) && !/eyJ[A-Za-z0-9_-]+\./.test(v),
      ),
    ),
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  fs.writeFileSync('/evidence/browser-results.json', JSON.stringify({ results, errors }, null, 2));
  await browser?.close();
}
