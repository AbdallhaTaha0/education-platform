import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { lookup } from 'node:dns/promises';
const fixture = JSON.parse(fs.readFileSync('/evidence/fixtures.json'));
const content = JSON.parse(fs.readFileSync('/demo/demo-content.json'));
const courses = content.courses.map((c, n) => ({
  id: `demo-${n}`,
  slug: c.slug,
  titleAr: c.titleAr,
  titleEn: c.titleEn,
  descriptionAr: c.descriptionAr,
  descriptionEn: c.descriptionEn,
  publishedAt: null,
  plans: [
    {
      id: `demo-plan-${n}`,
      currentPricePiastres: c.pricePiastres,
      previousPricePiastres: null,
      durationDays: c.durationDays,
    },
  ],
}));
const results = [];
const errors = [];
const assets = [];
let browser;
let mode = 'real';
let step = 'startup';
function check(label, ok) {
  step = label;
  results.push({ label, passed: Boolean(ok) });
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
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/assets/'))
      assets.push({ url: new URL(response.url()).pathname, status: response.status() });
  });
  page.on('requestfailed', (r) => errors.push(new URL(r.url()).pathname));
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url());
    if (mode !== 'real' && url.pathname === '/api/catalog/courses') {
      if (mode === 'loading') await new Promise((resolve) => setTimeout(resolve, 1200));
      await request.respond({
        status: mode === 'failure' ? 503 : 200,
        contentType: 'application/json',
        body: JSON.stringify(
          mode === 'failure'
            ? { error: { code: 'SERVICE_ERROR' } }
            : { data: { courses: mode === 'empty' ? [] : courses } },
        ),
      });
    } else if (mode === 'sample' && url.pathname.startsWith('/api/catalog/courses/')) {
      const course = courses.find(
        (c) => c.slug === decodeURIComponent(url.pathname.split('/').at(-1)),
      );
      await request.respond({
        status: course ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify({ data: { course } }),
      });
    } else await request.continue();
  });
  let navigation = 0;
  const open = async (hash) => {
    navigation++;
    await page.goto(`http://localhost:8082/?ui-run=${navigation}${hash}`, {
      waitUntil: 'networkidle0',
    });
    await page.evaluate(() => document.fonts.ready);
  };
  const prefs = async (lang, theme) => {
    await page.evaluate(
      (lang, theme) => {
        localStorage.setItem('edu-platform-lang', lang);
        localStorage.setItem('edu-platform-theme', theme);
      },
      lang,
      theme,
    );
  };
  const overflow = async () =>
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await page.setViewport({ width: 390, height: 844 });
  await open('#/');
  check(
    'real API catalog excludes draft fixtures',
    await page.$$eval('main article h3', (e) => e.length === 0),
  );
  check('no health cards in landing', (await page.$('#status')) === null);
  check(
    'anonymous My learning links to real login',
    await page.$$eval('.mobile-dock a', (es) =>
      es.some((e) => e.getAttribute('href') === '#/login'),
    ),
  );
  mode = 'sample';
  for (const lang of ['ar', 'en'])
    for (const theme of ['dark', 'light'])
      for (const width of [390, 1440]) {
        const key = `${lang}-${theme}-${width}`;
        await prefs(lang, theme);
        await page.setViewport({ width, height: 900 });
        await open('#/');
        // Only test screenshots carry this banner; no demo switch exists in product code.
        await page.evaluate(() => {
          const banner = document.createElement('p');
          banner.textContent = 'UI test: illustrative course API doubles — not published content';
          banner.style.cssText =
            'background:#f7b500;color:#0f1f12;padding:8px;text-align:center;font:12px sans-serif';
          document.body.prepend(banner);
        });
        check(
          `${key}: language/direction/theme`,
          await page.evaluate(
            (lang, theme) =>
              document.documentElement.lang === lang &&
              document.documentElement.dir === (lang === 'ar' ? 'rtl' : 'ltr') &&
              document.documentElement.dataset.theme === theme,
            lang,
            theme,
          ),
        );
        check(`${key}: no overflow`, await overflow());
        check(
          `${key}: hero loaded`,
          await page.$eval('.youth-hero__art img', (e) => e.complete && e.naturalWidth > 0),
        );
        check(
          `${key}: three illustrative courses`,
          (await page.$$('main article h3')).length === 3,
        );
        const dock = await page.$eval('.mobile-dock', (e) => {
          const b = e.getBoundingClientRect();
          return {
            visible: getComputedStyle(e).display !== 'none',
            targets: [...e.querySelectorAll('a')].every((a) => {
              const r = a.getBoundingClientRect();
              return r.width >= 44 && r.height >= 44;
            }),
            count: e.querySelectorAll('a').length,
            active: e.querySelector('[aria-current="page"]')?.getAttribute('href'),
            bottom: b.bottom <= innerHeight,
          };
        });
        check(
          `${key}: responsive dock`,
          dock.visible === width < 1024 &&
            dock.count === 4 &&
            dock.active === '#/' &&
            (!dock.visible || (dock.targets && dock.bottom)),
        );
        check(
          `${key}: text contrast`,
          await page.evaluate(() => {
            const rgb = (s) =>
              s
                .match(/[\d.]+/g)
                .slice(0, 3)
                .map(Number);
            const lum = (a) =>
              a
                .map((x) => {
                  x /= 255;
                  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
                })
                .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
            const pairs = [
              ['.hero-description', 'body'],
              ['.eyebrow', 'body'],
              ['.fayq-action', '.fayq-action'],
              ['.hero-art-note p', '.hero-art-note'],
            ];
            return pairs.every(([text, bg]) => {
              const a = lum(rgb(getComputedStyle(document.querySelector(text)).color));
              const b = lum(rgb(getComputedStyle(document.querySelector(bg)).backgroundColor));
              return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5;
            });
          }),
        );
        await page.screenshot({ path: `/evidence/${key}-landing.png`, fullPage: true });
        await page.screenshot({ path: `/evidence/${key}-viewport.png` });
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        check(
          `${key}: footer action clears dock`,
          await page.evaluate(
            () =>
              getComputedStyle(document.querySelector('.mobile-dock')).display === 'none' ||
              document.querySelector('.footer-discovery').getBoundingClientRect().bottom <
                document.querySelector('.mobile-dock').getBoundingClientRect().top,
          ),
        );
        const hash = await page.evaluate(() => location.hash);
        await page.click('.hero-actions button');
        check(
          `${key}: how scroll preserves router and focus`,
          await page.evaluate(
            (hash) => location.hash === hash && document.activeElement.id === 'how-title',
            hash,
          ),
        );
        await page.evaluate(() => document.querySelector('.landing-faq summary').click());
        check(`${key}: FAQ opens`, await page.$eval('.landing-faq details', (e) => e.open));
      }
  await page.setViewport({ width: 390, height: 844 });
  await prefs('en', 'dark');
  await open('#/');
  await page.click('.mobile-dock a[href="#/courses"]');
  await page.waitForFunction(
    () => location.hash === '#/courses' && document.querySelector('main article h3'),
  );
  check(
    'discover dock navigates and activates',
    await page.$eval(
      '.mobile-dock [aria-current="page"]',
      (e) => e.getAttribute('href') === '#/courses',
    ),
  );
  await page.click('main article button');
  await page.waitForFunction(() =>
    document.querySelector('main h1')?.textContent.includes('Python'),
  );
  check(
    'course offer remains discover-active',
    await page.$eval(
      '.mobile-dock [aria-current="page"]',
      (e) => e.getAttribute('href') === '#/courses',
    ),
  );
  check(
    'offer subscription text contrast',
    await page.$eval('main a[href^="#/purchase/"]', (e) => {
      const parse = (s) =>
        s
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number);
      const l = (a) =>
        a
          .map((x) => {
            x /= 255;
            return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          })
          .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
      const st = getComputedStyle(e),
        a = l(parse(st.color)),
        b = l(parse(st.backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5;
    }),
  );
  await page.click('.mobile-dock a[href="#/account"]');
  await page.waitForFunction(() => location.hash === '#/account');
  check('anonymous account exposes login, no invented profile', (await page.$('main dl')) === null);
  await open('#/login');
  await page.focus('#login-id');
  check(
    'dock hidden while form input focused',
    await page.$eval('.mobile-dock', (e) => getComputedStyle(e).display === 'none'),
  );
  const login = async (role) => {
    const user = fixture.users.find((u) => u.role === role);
    await open('#/login');
    await page.type('#login-id', user.email);
    await page.type('#login-password', user.password);
    await page.click('form button[type="submit"]');
    await page.waitForFunction(
      () => location.hash === '#/account' && document.querySelector('main dl'),
    );
  };
  await login('STUDENT');
  check(
    'real cookie login and profile shortcuts',
    await page.$$eval('.account-shortcuts a', (es) =>
      ['#/wallet', '#/purchases', '#/dashboard', '#/notifications'].every((h) =>
        es.some((e) => e.getAttribute('href') === h),
      ),
    ),
  );
  check(
    'notification remains top-bar accessible',
    (await page.$('[data-testid="notification-entry"]')) !== null,
  );
  await page.screenshot({ path: '/evidence/student-profile.png', fullPage: true });
  await open('#/wallet');
  check(
    'wallet maps to profile dock',
    await page.$eval(
      '.mobile-dock [aria-current="page"]',
      (e) => e.getAttribute('href') === '#/account',
    ),
  );
  check('wallet no overflow', await overflow());
  await open('#/purchases');
  check('purchase history reachable', (await page.$('main')) !== null);
  await open('#/dashboard');
  check(
    'learning dock active',
    await page.$eval(
      '.mobile-dock [aria-current="page"]',
      (e) => e.getAttribute('href') === '#/dashboard',
    ),
  );
  await open('#/account');
  await page.evaluate(() =>
    [...document.querySelectorAll('main button')]
      .find((b) => b.textContent.trim() === 'Log out')
      .click(),
  );
  await page.waitForFunction(() => !document.querySelector('main dl'));
  check(
    'logout returns anonymous state',
    (await page.$('[data-testid="notification-entry"]')) === null,
  );
  await login('ADMIN');
  check(
    'admin dock has correct real destinations',
    await page.$$eval(
      '.mobile-dock a',
      (es) =>
        JSON.stringify(es.map((e) => e.getAttribute('href'))) ===
        JSON.stringify(['#/admin', '#/admin/catalog', '#/admin/recharge', '#/account']),
    ),
  );
  await open('#/admin/catalog');
  check(
    'actual admin draft courses visible',
    await page.evaluate(() => document.querySelector('main').textContent.includes('Python')),
  );
  await page.screenshot({ path: '/evidence/admin-catalog.png', fullPage: true });
  check('admin no overflow', await overflow());
  await open('#/admin');
  check('admin creation task preserved', (await page.$('main form')) !== null);
  await open('#/admin/recharge');
  check('recharge queue reachable', (await page.$('main')) !== null);
  mode = 'empty';
  await open('#/');
  check('empty catalog has no fake cards', (await page.$$('main article h3')).length === 0);
  mode = 'loading';
  const nav = page.goto('http://localhost:8082/#/', { waitUntil: 'domcontentloaded' });
  await nav;
  check(
    'catalog loading state',
    await page.waitForFunction(() =>
      document.querySelector('main').textContent.includes('Loading'),
    ),
  );
  await page.waitForFunction(() => document.querySelectorAll('main article h3').length === 3);
  mode = 'failure';
  await open('#/');
  check(
    'catalog failure exposes retry',
    await page.$$eval('main button', (es) => es.some((e) => e.textContent.trim() === 'Retry')),
  );
  mode = 'sample';
  await page.evaluate(() =>
    [...document.querySelectorAll('main button')]
      .find((e) => e.textContent.trim() === 'Retry')
      .click(),
  );
  await page.waitForFunction(() => document.querySelectorAll('main article h3').length === 3);
  check('catalog retry recovers', true);
  courses[0].titleEn += ' — A longer course title for a first programming project'.repeat(3);
  await page.setViewport({ width: 320, height: 720 });
  await open('#/');
  check('320px long title does not overflow', await overflow());
  await page.focus('.skip-link');
  const beforeHash = await page.evaluate(() => location.hash);
  await page.keyboard.press('Enter');
  check(
    'skip link focuses content without changing route',
    await page.evaluate(
      (hash) => location.hash === hash && document.activeElement.id === 'main',
      beforeHash,
    ),
  );
  await page.evaluate(() => document.querySelector('main').requestFullscreen());
  check(
    'global dock hidden in fullscreen',
    await page.$eval(
      '.mobile-dock',
      (e) => document.fullscreenElement !== null && getComputedStyle(e).display === 'none',
    ),
  );
  await page.evaluate(() => document.exitFullscreen());
  check(
    'dock returns after fullscreen',
    await page.$eval('.mobile-dock', (e) => getComputedStyle(e).display !== 'none'),
  );
  check(
    'styles/images/self-hosted font requests succeed',
    assets.length > 10 &&
      assets.every((a) => [200, 304].includes(a.status)) &&
      assets.some((a) => a.url.endsWith('.woff2')) &&
      assets.some((a) => a.url.endsWith('.webp')),
  );
  check('no unexpected page/request failures', errors.length === 0);
  check(
    'storage contains only language/theme preferences',
    await page.evaluate(
      () =>
        Object.keys(localStorage).every((k) =>
          ['edu-platform-lang', 'edu-platform-theme'].includes(k),
        ) && sessionStorage.length === 0,
    ),
  );
} catch (e) {
  console.error(`FAIL at ${step}: ${e.message}`);
  results.push({ label: step, error: e.message, passed: false });
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  fs.writeFileSync('/evidence/results.json', JSON.stringify({ results, errors }, null, 2));
  console.log(`M8 checks: ${results.filter((r) => r.passed).length}/${results.length}`);
}
