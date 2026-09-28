/**
 * Containerized M2 browser assertions (Chromium via puppeteer-core).
 *
 * Runs INSIDE Docker (docker compose --profile browser) against the platform
 * Nginx entry point. Asserts bilingual identity flows, cookie attributes,
 * absence of auth browser storage, and role isolation. Screenshots are
 * evidence only; every row below is an executable assertion.
 *
 * Required env: BASE_URL (e.g. http://nginx:8080), ADMIN_EMAIL,
 * ADMIN_PHONE, ADMIN_PASSWORD (bootstrap admin created before this run).
 * Optional: EVIDENCE_DIR for screenshots (failures there never fail the run).
 */
const puppeteer = (await import('puppeteer-core')).default;
const fs = (await import('node:fs')).default;
const path = (await import('node:path')).default;

const BASE_URL = process.env.BASE_URL || 'http://nginx:8080';
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || null;
const ADMIN = {
  email: process.env.ADMIN_EMAIL || '',
  phone: process.env.ADMIN_PHONE || '',
  password: process.env.ADMIN_PASSWORD || '',
};

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function shot(page, name) {
  if (!EVIDENCE_DIR) return;
  try {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, name) });
  } catch {
    // Screenshots are evidence only.
  }
}

function uniq(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`;
}

async function docState(page) {
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    title: document.querySelector('main h1') ? document.querySelector('main h1').textContent : '',
  }));
}

async function cookies(page) {
  // Auth cookies are Path-scoped (/api, /api/auth): query under /api so the
  // harness sees exactly what the browser sends to backend routes.
  return page.cookies(`${BASE_URL}/api/auth/me`);
}

function cookieByName(list, name) {
  return list.find((c) => c.name === name);
}

async function storageAudit(page) {
  return page.evaluate(async () => {
    const ls = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      ls[k] = localStorage.getItem(k);
    }
    const ss = {};
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      ss[k] = sessionStorage.getItem(k);
    }
    let idb = [];
    try {
      if (indexedDB.databases) idb = (await indexedDB.databases()).map((d) => d.name);
    } catch {
      idb = ['unavailable'];
    }
    return { ls, ss, idb };
  });
}

async function main() {
  if (!ADMIN.email || !ADMIN.password) throw new Error('ADMIN_EMAIL/ADMIN_PASSWORD are required');
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // 1. Arabic-default RTL shell.
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));
    let st = await docState(page);
    check('default language is Arabic RTL', st.lang === 'ar' && st.dir === 'rtl', `${st.lang}/${st.dir}`);

    // 2. English LTR switch (real UI toggle), then back.
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.lang-switch button')];
      btns.find((b) => b.textContent.trim() === 'English').click();
    });
    await new Promise((r) => setTimeout(r, 500));
    st = await docState(page);
    check('english switch yields LTR', st.lang === 'en' && st.dir === 'ltr', `${st.lang}/${st.dir}`);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.lang-switch button')];
      btns.find((b) => b.textContent.includes('العربية')).click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // 3. Student registration through the UI.
    const email = `${uniq('m2b')}@example.test`;
    const phone = `015${String(Date.now()).slice(-8)}`;
    const password = 'browser secret twelve words';
    await page.goto(`${BASE_URL}/#/register`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.type('#reg-name', 'Browser Student');
    await page.type('#reg-email', email);
    await page.type('#reg-phone', phone);
    await page.type('#reg-password', password);
    await page.type('#reg-confirm', password);
    await Promise.all([
      page.click('.form-card form button[type="submit"]'),
      page.waitForFunction(
        () => window.location.hash === '#/account' && document.body.textContent.includes('Browser Student'),
        { timeout: 15000 },
      ),
    ]);
    check('UI registration signs in as student', true, email);
    await shot(page, 'm2-account-ar.png');

    // 4. Cookie attributes.
    const list = await cookies(page);
    const access = cookieByName(list, 'edu_access');
    const refresh = cookieByName(list, 'edu_refresh');
    const csrf = cookieByName(list, 'edu_csrf');
    check('edu_access present and HttpOnly', !!access && access.httpOnly === true);
    check('edu_refresh present and HttpOnly', !!refresh && refresh.httpOnly === true);
    check('edu_csrf present and readable (non-HttpOnly)', !!csrf && csrf.httpOnly === false);
    check(
      'auth cookies scoped to /api paths',
      !!access && access.path === '/api' && !!refresh && refresh.path === '/api/auth',
      `${access && access.path}/${refresh && refresh.path}`,
    );

    // 5. No auth material in browser storage.
    const store = await storageAudit(page);
    const storedValues = [...Object.values(store.ls), ...Object.values(store.ss)].join('\n');
    const cookieValues = [access && access.value, refresh && refresh.value].filter(Boolean).join('\n');
    const leaks = cookieValues.split('\n').filter((v) => v && storedValues.includes(v));
    check('localStorage holds only the language preference', Object.keys(store.ls).every((k) => k === 'edu-platform-lang'), JSON.stringify(Object.keys(store.ls)));
    check('sessionStorage empty', Object.keys(store.ss).length === 0);
    check('IndexedDB empty', Array.isArray(store.idb) && store.idb.length === 0, JSON.stringify(store.idb));
    check('no cookie values in web storage', leaks.length === 0);

    // 6. UI logout returns to anonymous.
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      btns.find((b) => b.textContent.includes('تسجيل الخروج') && !b.textContent.includes('كل')).click();
    });
    await page.waitForFunction(() => document.body.textContent.includes('سجّل الدخول'), { timeout: 15000 });
    const afterLogout = await cookies(page);
    check(
      'logout clears auth cookies',
      !cookieByName(afterLogout, 'edu_access') && !cookieByName(afterLogout, 'edu_refresh'),
    );

    // 7. Email login through the UI.
    await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.type('#login-id', email);
    await page.type('#login-password', password);
    await Promise.all([
      page.click('.form-card form button[type="submit"]'),
      page.waitForFunction(() => window.location.hash === '#/account', { timeout: 15000 }),
    ]);
    check('UI email login succeeds', true);

    // 8. Logout-all through the UI, then phone login.
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      btns.find((b) => b.textContent.includes('كل الأجهزة') || b.textContent.includes('everywhere')).click();
    });
    await page.waitForFunction(() => document.body.textContent.includes('سجّل الدخول'), { timeout: 15000 });
    check('UI logout-all signs out', true);
    await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.type('#login-id', phone);
    await page.type('#login-password', password);
    await Promise.all([
      page.click('.form-card form button[type="submit"]'),
      page.waitForFunction(() => window.location.hash === '#/account', { timeout: 15000 }),
    ]);
    check('UI phone login succeeds', true, phone);

    // 9. Student sees the admin gate; direct API call is 403.
    await page.goto(`${BASE_URL}/#/admin`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    const adminBody = await page.evaluate(() => document.body.textContent);
    check('student admin view shows forbidden', /غير مسموح|Not allowed/.test(adminBody));
    const denial = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/api/admin/users`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ displayName: 'X', email: 'x@x.test', phone: '+10000000000', password: 'twelve chars xx' }),
      });
      return { status: res.status, code: (await res.json()).error.code };
    }, BASE_URL);
    check('student admin API denied with 403', denial.status === 403 && denial.code === 'FORBIDDEN', `${denial.status}/${denial.code}`);

    // 10. Bootstrap admin signs in and creates another admin through the UI.
    await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.type('#login-id', ADMIN.email);
    await page.type('#login-password', ADMIN.password);
    await Promise.all([
      page.click('.form-card form button[type="submit"]'),
      page.waitForFunction(() => window.location.hash === '#/account', { timeout: 15000 }),
    ]);
    await page.goto(`${BASE_URL}/#/admin`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    const admin2Email = `${uniq('m2adm')}@example.test`;
    const admin2Phone = `010${String(Date.now()).slice(-8)}`;
    const admin2Pw = 'second admin twelve words';
    const hasForm = await page.evaluate(() => !!document.querySelector('#adm-email'));
    check('admin view exposes creation form', hasForm);
    await page.type('#adm-name', 'Second Admin');
    await page.type('#adm-email', admin2Email);
    await page.type('#adm-phone', admin2Phone);
    await page.type('#adm-password', admin2Pw);
    await page.click('.form-card form button[type="submit"]');
    await page.waitForFunction((em) => document.body.textContent.includes(em), { timeout: 15000 }, admin2Email);
    check('admin creates admin via UI', true, admin2Email);
    await shot(page, 'm2-admin-ar.png');

    // 11. Mobile viewport: Arabic register screen, no horizontal overflow.
    const mob = await ctx.newPage();
    await mob.setViewport({ width: 390, height: 844, isMobile: true });
    await mob.goto(`${BASE_URL}/#/register`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    const mst = await docState(mob);
    const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('mobile register is Arabic RTL without overflow', mst.lang === 'ar' && mst.dir === 'rtl' && overflow <= 1, `overflow=${overflow}`);
    await shot(mob, 'm2-register-mobile-ar.png');
    await mob.close();

    await ctx.close();
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  // eslint-disable-next-line no-console
  console.log(`\nBROWSER: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`BROWSER-ERROR ${err && err.message ? err.message : err}`);
  process.exit(1);
});
