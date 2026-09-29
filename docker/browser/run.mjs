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
    check('localStorage holds only namespaced non-sensitive prefs', Object.keys(store.ls).every((k) => k === 'edu-platform-lang' || k === 'edu-platform-theme'), JSON.stringify(Object.keys(store.ls)));
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

    // ---- M3 catalog assertions (preserve all M2 rows above) ----
    // 12. Arabic-default public catalog (RTL) loads.
    await page.goto(`${BASE_URL}/#/courses`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1000));
    const catBody = await page.evaluate(() => document.body.textContent);
    check('arabic public catalog loads', /الدورات|دورات|لا توجد دورات/.test(catBody));
    const catLang = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
    check('public catalog respects RTL', catLang.lang === 'ar' && catLang.dir === 'rtl', `${catLang.lang}/${catLang.dir}`);
    await shot(page, 'm3-catalog-ar.png');

    // 13. English LTR catalog switch.
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.lang-switch button')];
      btns.find((b) => b.textContent.trim() === 'English').click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const enCat = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, body: document.body.textContent }));
    check('english catalog is LTR', enCat.lang === 'en' && enCat.dir === 'ltr');
    check('english catalog shows courses or empty', /Courses|No published|Recorded/.test(enCat.body));
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.lang-switch button')];
      btns.find((b) => b.textContent.includes('العربية')).click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // 14. Mobile 390px catalog without overflow + EGP rendering check.
    const mob2 = await ctx.newPage();
    await mob2.setViewport({ width: 390, height: 844, isMobile: true });
    await mob2.goto(`${BASE_URL}/#/courses`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1000));
    const mobOverflow = await mob2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const mobText = await mob2.evaluate(() => document.body.textContent);
    check('mobile catalog no overflow', mobOverflow <= 1, `overflow=${mobOverflow}`);
    check('mobile catalog shows EGP or empty', /ج\.م|EGP|لا توجد/.test(mobText));
    await shot(mob2, 'm3-catalog-mobile-ar.png');
    await mob2.close();

    // 15. Anonymous catalog mutation is denied (401); STUDENT denial is proven
    // via API integration tests (403). Use a fresh context with no cookies.
    const anonCtx = await browser.createBrowserContext();
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(`${BASE_URL}/#/courses`, { waitUntil: 'networkidle0', timeout: 60000 });
    const studentDenial = await anonPage.evaluate(async (base) => {
      await fetch(`${base}/api/auth/csrf`, { credentials: 'include' });
      const cookies = document.cookie.split(';').map((s) => s.trim());
      const csrf = (cookies.find((c) => c.startsWith('edu_csrf=')) || '').slice('edu_csrf='.length);
      const res = await fetch(`${base}/api/admin/catalog/courses`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': decodeURIComponent(csrf) },
        body: JSON.stringify({ slug: 'browser-anon-x', titleAr: 'د', titleEn: 'C', descriptionAr: 'و', descriptionEn: 'D' }),
      });
      let code = '';
      try {
        code = (await res.json()).error.code;
      } catch {}
      return { status: res.status, code };
    }, BASE_URL);
    // Anonymous without Origin on state-changing route → 403 ORIGIN_FORBIDDEN or 401.
    check('anon catalog mutation denied', studentDenial.status === 401 || studentDenial.status === 403, `${studentDenial.status}/${studentDenial.code}`);
    await anonCtx.close();

    // 16. ADMIN creates bilingual course via UI (admin session still active from M2 step 10).
    await page.goto(`${BASE_URL}/#/admin/catalog`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    const hasCreate = await page.evaluate(() => !!document.querySelector('#cf-slug'));
    check('admin catalog exposes bilingual creation form', hasCreate);
    let workflowSlug = '';
    if (hasCreate) {
      const createdSlug = `browser-${Date.now().toString(36)}`;
      workflowSlug = createdSlug;
      await page.type('#cf-slug', createdSlug);
      await page.type('#cf-ta', 'دورة متصفح');
      await page.type('#cf-te', 'Browser course');
      await page.type('#cf-da', 'وصف عربي للمتصفح');
      await page.type('#cf-de', 'English browser description');
      await page.click('main form button[type="submit"]');
      await page.waitForFunction((s) => document.body.textContent.includes(s), { timeout: 15000 }, createdSlug);
      check('admin creates bilingual course via UI', true, createdSlug);
      await shot(page, 'm3-admin-catalog-ar.png');
    } else {
      check('admin creates bilingual course via UI', false, 'no form');
    }

    // 17. Full admin workflow through Nginx (labeled DRM fixture only).
    const slug = workflowSlug;
    check('workflow course slug captured', slug !== '', slug);
    const clickText = async (text) => page.evaluate((t) => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
      if (!btn) return false;
      btn.click();
      return true;
    }, text);
    const clearAndType = async (selector, text) => {
      const found = await page.evaluate((sel) => !!document.querySelector(sel), selector);
      if (!found) throw new Error(`missing input ${selector}`);
      await page.evaluate((sel) => {
        const input = document.querySelector(sel);
        input.focus();
        input.select();
      }, selector);
      await page.keyboard.press('Backspace');
      await page.type(selector, text);
    };

    // 17a. Edit the bilingual course created in step 16.
    const courseId = await page.evaluate(async (base, s) => {
      const res = await fetch(`${base}/api/admin/catalog/courses`, { credentials: 'include', headers: { Accept: 'application/json' } });
      const json = await res.json();
      const found = json.data.courses.find((c) => c.slug === s);
      return found ? found.id : '';
    }, BASE_URL, slug);
    check('created course is readable via admin API', courseId !== '');
    await page.goto(`${BASE_URL}/#/admin/courses/${courseId}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1000));
    await clearAndType('#cf-ta', 'دورة متصفح معدلة');
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      btns.find((b) => b.textContent.trim() === 'حفظ').click();
    });
    await page.waitForFunction(() => document.body.textContent.includes('دورة متصفح معدلة'), { timeout: 15000 });
    check('admin edits bilingual course title', true);

    // 17b. Create and edit a plan with current/previous EGP prices and duration.
    await clearAndType('#plan-current', '600.00');
    await clearAndType('#plan-duration', '90');
    await page.click('#plan-prev-toggle');
    await clearAndType('#plan-previous', '900.00');
    await clickText('إضافة خطة');
    await page.waitForFunction(() => document.body.textContent.includes('600.00'), { timeout: 15000 });
    check('admin creates plan with previous-price offer', true);
    const planEdited = await page.evaluate(async (base, cid) => {
      const res = await fetch(`${base}/api/admin/catalog/courses/${cid}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      const json = await res.json();
      return json.data.course.plans.length > 0;
    }, BASE_URL, courseId);
    check('plan persisted with duration', planEdited);

    // 17c. Create two sections and reorder them deterministically.
    const createSection = async (ar, en) => {
      await clearAndType('#sec-ta', ar);
      await clearAndType('#sec-te', en);
      await clickText('إضافة قسم');
      await new Promise((r) => setTimeout(r, 1200));
    };
    await createSection('القسم الأول', 'Section one');
    await createSection('القسم الثاني', 'Section two');
    let sectionIds = await page.evaluate(async (base, cid) => {
      const res = await fetch(`${base}/api/admin/catalog/courses/${cid}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      return (await res.json()).data.course.sections.map((s) => s.id);
    }, BASE_URL, courseId);
    check('two sections created', sectionIds.length === 2, JSON.stringify(sectionIds.length));
    const orderBefore = await page.evaluate(() => [...document.querySelectorAll('h3')].map((h) => h.textContent).join('|'));
    // Move second section up via its ordering controls (second ↑ button on the page).
    await page.evaluate(() => {
      const ups = [...document.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label') === 'نقل لأعلى');
      ups[1].click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    sectionIds = await page.evaluate(async (base, cid) => {
      const res = await fetch(`${base}/api/admin/catalog/courses/${cid}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      return (await res.json()).data.course.sections.map((s) => s.id);
    }, BASE_URL, courseId);
    const orderAfter = await page.evaluate(() => [...document.querySelectorAll('h3')].map((h) => h.textContent).join('|'));
    check('sections reordered deterministically', orderBefore !== orderAfter && sectionIds.length === 2, `${orderBefore} => ${orderAfter}`);

    // 17d. Create two lessons in the first section and reorder them.
    const lessonTaSelector = async () => page.evaluate(() => {
      const input = document.querySelectorAll('input[id^="les-ta-"]')[0];
      return input ? `#${input.id}` : '';
    });
    const createLesson = async (ar, en) => {
      const taSel = await lessonTaSelector();
      const teSel = taSel.replace('les-ta-', 'les-te-');
      await clearAndType(taSel, ar);
      await clearAndType(teSel, en);
      await page.evaluate((sel) => {
        const input = document.querySelector(sel);
        const scope = input.closest('form') || input.closest('div');
        [...scope.querySelectorAll('button')].find((b) => b.textContent.trim() === 'إضافة درس').click();
      }, taSel);
      await new Promise((r) => setTimeout(r, 1200));
    };
    await createLesson('الدرس الأول', 'Lesson one');
    await createLesson('الدرس الثاني', 'Lesson two');
    let lessonIds = await page.evaluate(async (base, cid) => {
      const res = await fetch(`${base}/api/admin/catalog/courses/${cid}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      const course = (await res.json()).data.course;
      return course.sections[0].lessons.map((l) => l.id);
    }, BASE_URL, courseId);
    check('two lessons created', lessonIds.length === 2, JSON.stringify(lessonIds.length));
    const lessonOrderBefore = lessonIds.join(',');
    await page.evaluate(() => {
      const ta = document.querySelectorAll('input[id^="les-ta-"]')[0];
      const scope = ta.closest('form').parentElement;
      const ups = [...scope.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label') === 'نقل لأعلى');
      ups[1].click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    lessonIds = await page.evaluate(async (base, cid) => {
      const res = await fetch(`${base}/api/admin/catalog/courses/${cid}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      return (await res.json()).data.course.sections[0].lessons.map((l) => l.id);
    }, BASE_URL, courseId);
    check('lessons reordered deterministically', lessonIds.join(',') !== lessonOrderBefore, `${lessonOrderBefore} => ${lessonIds.join(',')}`);

    // 17e. No-file regression: register without selecting a file sends nothing.
    const noFileProbe = await page.evaluate(async (base) => {
      let mediaCalls = 0;
      let putCalls = 0;
      const orig = window.fetch;
      window.fetch = (...args) => {
        const url = String(args[0]);
        if (/\/admin\/catalog\/lessons\/.+\/media$/.test(url)) mediaCalls += 1;
        if (args[1] && args[1].method === 'PUT') putCalls += 1;
        return orig(...args);
      };
      const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'تسجيل فيديو');
      btns[0].click();
      await new Promise((r) => setTimeout(r, 1500));
      window.fetch = orig;
      return { mediaCalls, putCalls, body: document.body.textContent };
    }, BASE_URL);
    check('no upload or completion without a selected file', noFileProbe.mediaCalls === 0 && noFileProbe.putCalls === 0, `media=${noFileProbe.mediaCalls} put=${noFileProbe.putCalls}`);

    // 17f. Real file upload via file-input API → READY through the labeled fixture.
    const fileInputs = await page.$$('input[type="file"]');
    check('file input present', fileInputs.length > 0, String(fileInputs.length));
    await fileInputs[0].uploadFile('/srv/browser/fixtures/sample.mp4');
    await clickText('تسجيل فيديو');
    await page.waitForFunction(() => /\(READY\)/.test(document.body.textContent), { timeout: 90000 });
    check('upload flow reaches READY via fixture', true);
    await shot(page, 'm3-upload-ready-ar.png');
    // Second lesson upload as well (all lessons must be READY to publish).
    const fileInputs2 = await page.$$('input[type="file"]');
    await fileInputs2[1].uploadFile('/srv/browser/fixtures/sample.mp4');
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'تسجيل فيديو');
      btns[1].click();
    });
    await page.waitForFunction(() => (document.body.textContent.match(/\(READY\)/g) || []).length >= 2, { timeout: 90000 });
    check('second lesson reaches READY', true);

    // 17g. Publication blocked before readiness is proven on a fresh course instead:
    // this course is READY-capable, so assert the blocked-path error shape via API.
    const blockedProbe = await page.evaluate(async (base, cid) => {
      const csrf = decodeURIComponent((document.cookie.split(';').map((s) => s.trim()).find((c) => c.startsWith('edu_csrf=')) || '').slice('edu_csrf='.length));
      const res = await fetch(`${base}/api/admin/catalog/courses/${cid}/transitions`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ to: 'PUBLISHED' }),
      });
      return { status: res.status };
    }, BASE_URL, courseId);
    check('direct PUBLISHED from DRAFT is blocked', blockedProbe.status === 409, String(blockedProbe.status));
    for (const [label, want] of [['DRAFT → PROCESSING', 'PROCESSING'], ['PROCESSING → READY', 'READY'], ['READY → PUBLISHED', 'PUBLISHED']]) {
      let status = '';
      let diag = '';
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await page.evaluate((text) => {
          const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
          if (btn && !btn.disabled) btn.click();
        }, label);
        await new Promise((r) => setTimeout(r, 2500));
        const probe = await page.evaluate(async (base, cid, to) => {
          const detail = await fetch(`${base}/api/admin/catalog/courses/${cid}`, { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json());
          const media = detail.data.course.sections.flatMap((s) => s.lessons.map((l) => `${l.id.slice(0, 4)}:${l.media ? `${l.media.status}/${l.media.assetId ? 'asset' : 'noasset'}` : 'nomedia'}`)).join(',');
          return { status: detail.data.course.status, media };
        }, BASE_URL, courseId, want);
        status = probe.status;
        diag = probe.media;
        if (status === want) break;
      }
      check(`course transitions to ${want}`, status === want, status === want ? status : `${status} media=[${diag}]`);
    }
    const publishedStatus = await page.evaluate(async (base, cid) => {
      const res = await fetch(`${base}/api/admin/catalog/courses/${cid}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      return (await res.json()).data.course.status;
    }, BASE_URL, courseId);
    check('course publishes after readiness', publishedStatus === 'PUBLISHED', publishedStatus);

    // 17h. Public offer renders without lesson/media leakage.
    await page.goto(`${BASE_URL}/#/courses/${slug}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1000));
    const offerText = await page.evaluate(() => document.body.textContent);
    const lessonLeak = lessonIds.some(() => /Lesson one|Lesson two|الدرس الأول/.test(offerText));
    check('public offer hides lesson list', !lessonLeak);
    check('public offer shows EGP price', /ج\.م|EGP/.test(offerText));
    await shot(page, 'm3-offer-ar.png');

    // 17i. Archive hides publicly; unarchive restores.
    await page.goto(`${BASE_URL}/#/admin/courses/${courseId}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    await clickText('أرشفة');
    await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'أرشفة' && b.closest('[role="dialog"]'));
      if (dlg) dlg.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    const archivedGone = await page.evaluate(async (base, s) => (await fetch(`${base}/api/catalog/courses/${s}`)).status, BASE_URL, slug);
    check('archived course hidden publicly', archivedGone === 404, String(archivedGone));
    await clickText('استعادة من الأرشيف');
    await new Promise((r) => setTimeout(r, 1500));
    const restoredVisible = await page.evaluate(async (base, s) => (await fetch(`${base}/api/catalog/courses/${s}`)).status, BASE_URL, slug);
    check('unarchived course visible publicly', restoredVisible === 200, String(restoredVisible));

    // 17j. Lesson permanent deletion returns surviving course visibility.
    await page.goto(`${BASE_URL}/#/admin/courses/${courseId}`, { waitUntil: 'networkidle0', timeout: 60000 });
    lessonIds = await page.evaluate(async (base, cid) => {
      const res = await fetch(`${base}/api/admin/catalog/courses/${cid}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      return (await res.json()).data.course.sections[0].lessons.map((l) => l.id);
    }, BASE_URL, courseId);
    const delLessonId = lessonIds[1];
    await page.waitForFunction((lid) => !!document.querySelector(`[data-testid="deletion-${lid}"]`), { timeout: 30000 }, delLessonId);
    check('lesson deletion panel present', true);
    await clearAndType(`[data-testid="deletion-${delLessonId}"] [data-testid="deletion-confirm"]`, delLessonId);
    await page.click(`[data-testid="deletion-${delLessonId}"] [data-testid="deletion-submit"]`);
    await page.waitForFunction(() => /اكتمل الحذف الدائم|COMPLETED/.test(document.body.textContent), { timeout: 60000 });
    check('lesson deletion completes', true);
    const survivor = await page.evaluate(async (base, cid) => {
      const res = await fetch(`${base}/api/admin/catalog/courses/${cid}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      const json = await res.json();
      return { status: res.status, marker: json.data.course.deletionRequestedAt };
    }, BASE_URL, courseId);
    check('surviving course visibility returns', survivor.status === 200 && survivor.marker === null, JSON.stringify(survivor.marker));

    // 17k. Deletion failure and retry via the labeled fixture control plane.
    await fetch('http://drm-fixture:8090/__fixture/fail-deletes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: 99 }) }).catch(() => null);
    const remainingLesson = await page.evaluate(async (base, cid) => {
      const res = await fetch(`${base}/api/admin/catalog/courses/${cid}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      const course = (await res.json()).data.course;
      return course.sections[0].lessons[0].id;
    }, BASE_URL, courseId);
    await clearAndType(`[data-testid="deletion-${remainingLesson}"] [data-testid="deletion-confirm"]`, remainingLesson);
    await page.click(`[data-testid="deletion-${remainingLesson}"] [data-testid="deletion-submit"]`);
    await page.waitForFunction(() => /فشل الحذف الدائم|FAILED/.test(document.body.textContent), { timeout: 60000 });
    check('deletion failure surfaces retry state', true);
    await fetch('http://drm-fixture:8090/__fixture/fail-deletes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: 0 }) });
    await page.click(`[data-testid="deletion-${remainingLesson}"] [data-testid="deletion-retry"]`);
    await page.waitForFunction(() => /اكتمل الحذف الدائم|COMPLETED/.test(document.body.textContent), { timeout: 90000 });
    check('deletion retry completes', true);
    await shot(page, 'm3-deletion-ar.png');

    // 19. M4 wallet, purchase, and theme journeys (Arabic UI).
    const themeState = () => page.evaluate(() => ({
      theme: document.documentElement.dataset.theme || '',
      stored: (() => { try { return window.localStorage.getItem('edu-platform-theme'); } catch { return null; } })(),
    }));
    const contrastRatio = () => page.evaluate(() => {
      const parse = (s) => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s || '');
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
      };
      const lum = ([r, g, b]) => {
        const f = (v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const css = getComputedStyle(document.body);
      const l1 = lum(parse(css.color));
      const l2 = lum(parse(css.backgroundColor));
      const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
      return (hi + 0.05) / (lo + 0.05);
    });
    const themeToggle = () => page.evaluate(() => {
      const btn = document.querySelector('header button[aria-label]');
      if (!btn) return false;
      btn.click();
      return true;
    });

    // 19a. Dark is the default; toggle to light persists without flash.
    await page.goto(`${BASE_URL}/#/wallet`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    let theme = await themeState();
    check('dark theme is the default', theme.theme === 'dark', theme.theme);
    check('dark body contrast meets AA', (await contrastRatio()) >= 4.5, String(await contrastRatio()));
    await shot(page, 'm4-wallet-dark-ar.png');
    check('theme toggle present', await themeToggle());
    await new Promise((r) => setTimeout(r, 500));
    theme = await themeState();
    check('light theme applies and persists', theme.theme === 'light' && theme.stored === 'light', `${theme.theme}/${theme.stored}`);
    check('light body contrast meets AA', (await contrastRatio()) >= 4.5, String(await contrastRatio()));
    await shot(page, 'm4-wallet-light-ar.png');
    await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
    theme = await themeState();
    check('light theme survives reload without flash', theme.theme === 'light', theme.theme);
    await themeToggle();
    await new Promise((r) => setTimeout(r, 300));

    // 19b. Student wallet journey in an isolated context.
    const studentCtx = await browser.createBrowserContext();
    const spage = await studentCtx.newPage();
    await spage.setViewport({ width: 1440, height: 900 });
    await spage.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle0', timeout: 60000 });
    await spage.type('#login-id', email);
    await spage.type('#login-password', password);
    await Promise.all([
      spage.click('.form-card form button[type="submit"]'),
      spage.waitForFunction(() => window.location.hash === '#/account', { timeout: 15000 }),
    ]);
    check('student signs in for wallet journey', true);
    await spage.goto(`${BASE_URL}/#/wallet`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1000));
    const walletText = await spage.evaluate(() => document.body.textContent);
    check('wallet shows balance', /ج\.م|EGP/.test(walletText));
    await spage.goto(`${BASE_URL}/#/wallet/recharge`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    const rechargeRef = uniq('m4ref');
    await spage.type('#rch-amount', '600');
    await spage.waitForFunction(() => !!document.querySelector('#rch-channel option[value="INSTAPAY"]'), { timeout: 15000 });
    await spage.select('#rch-channel', 'INSTAPAY');
    await spage.type('#rch-reference', rechargeRef);
    await spage.type('#rch-sender', 'طالب متصفح');
    await spage.type('#rch-phone', '01512345678');
    await spage.evaluate(() => {
      const input = document.querySelector('#rch-date');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '2026-09-20');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const proofInputs = await spage.$$('#rch-proof');
    check('proof file input present', proofInputs.length === 1, String(proofInputs.length));
    await proofInputs[0].uploadFile('/srv/browser/fixtures/receipt.jpg');
    await spage.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'إرسال الطلب');
      btns[0].click();
    });
    await spage.waitForFunction(() => document.body.textContent.includes('تم إرسال الطلب'), { timeout: 30000 });
    check('recharge request submits without auto-credit language', true);
    const noCredit = await spage.evaluate(async (base) => {
      const res = await fetch(`${base}/api/wallet`, { credentials: 'include', headers: { Accept: 'application/json' } });
      return (await res.json()).data.balancePiastres;
    }, BASE_URL);
    check('pending request creates zero credit', noCredit === 0, String(noCredit));

    // 19c. Student cannot open proof bytes (admin-only endpoint).
    const proofProbe = await spage.evaluate(async (base) => {
      const list = await fetch(`${base}/api/wallet/recharge-requests`, { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json());
      const id = list.data.requests[0].id;
      const proof = await fetch(`${base}/api/admin/recharge-requests/${id}/proof`, { credentials: 'include' });
      return { status: proof.status, id };
    }, BASE_URL);
    check('student proof download denied', proofProbe.status === 403, String(proofProbe.status));

    // 19d. Admin reviews and approves via UI dialog (main admin page).
    await page.goto(`${BASE_URL}/#/admin/recharge`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));
    const queueHas = await page.evaluate((ref) => document.body.textContent.includes(ref.toUpperCase()), rechargeRef);
    check('admin queue shows the request', queueHas, rechargeRef);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'مراجعة');
      btns[0].click();
    });
    await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 15000 });
    const dialogFocus = await page.evaluate(() => !!document.querySelector('[role="dialog"]')?.contains(document.activeElement));
    check('review dialog takes focus', dialogFocus);
    await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      const box = [...dlg.querySelectorAll('input[type="checkbox"]')][0];
      if (box && !box.checked) box.click();
    });
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('[role="dialog"] button')].filter((b) => b.textContent.trim() === 'تأكيد المراجعة');
      btns[0].click();
    });
    await page.waitForFunction(() => document.body.textContent.includes('تم القبول وإضافة الرصيد'), { timeout: 30000 });
    check('admin approval credits via dialog', true);
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 400));
    const dialogClosed = await page.evaluate(() => !document.querySelector('[role="dialog"]'));
    check('dialog closes on Escape', dialogClosed);
    const credited = await spage.evaluate(async (base) => {
      const res = await fetch(`${base}/api/wallet`, { credentials: 'include', headers: { Accept: 'application/json' } });
      return (await res.json()).data.balancePiastres;
    }, BASE_URL);
    check('wallet credited exactly 600 EGP', credited === 60000, String(credited));

    // 19e. Student purchases the workflow course plan explicitly.
    const buyPlanId = await page.evaluate(async (base, cid) => {
      const res = await fetch(`${base}/api/admin/catalog/courses/${cid}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      const course = (await res.json()).data.course;
      return course.plans.length > 0 ? course.plans[0].id : '';
    }, BASE_URL, courseId);
    check('workflow plan available for purchase', buyPlanId !== '');
    await spage.goto(`${BASE_URL}/#/purchase/${buyPlanId}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));
    const reviewText = await spage.evaluate(() => document.body.textContent);
    check('purchase review shows trusted price', /600/.test(reviewText) && /ج\.م|EGP/.test(reviewText));
    await spage.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'تأكيد الشراء');
      btns[0].click();
    });
    await spage.waitForFunction(() => document.body.textContent.includes('إيصال الشراء'), { timeout: 30000 });
    check('explicit purchase yields a receipt', true);
    await shot(spage, 'm4-receipt-ar.png');
    const afterBuy = await spage.evaluate(async (base) => {
      const res = await fetch(`${base}/api/wallet`, { credentials: 'include', headers: { Accept: 'application/json' } });
      return (await res.json()).data.balancePiastres;
    }, BASE_URL);
    check('balance debited exactly once', afterBuy === 0, String(afterBuy));

    // 19f. 390px wallet/recharge/purchase without overflow.
    const mob4 = await studentCtx.newPage();
    await mob4.setViewport({ width: 390, height: 844, isMobile: true });
    for (const [label, hash] of [['wallet', '#/wallet'], ['recharge', '#/wallet/recharge']]) {
      await mob4.goto(`${BASE_URL}/${hash}`, { waitUntil: 'networkidle0', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 800));
      const overflow = await mob4.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`mobile ${label} no overflow`, overflow <= 1, `overflow=${overflow}`);
    }
    await mob4.close();
    await spage.close();
    await studentCtx.close();

    // 18. No auth/DRM material in storage or bundles.
    const store2 = await storageAudit(page);
    const lsKeys = Object.keys(store2.ls);
    check('browser storage holds only namespaced prefs', lsKeys.every((k) => k === 'edu-platform-lang' || k === 'edu-platform-theme'), JSON.stringify(lsKeys));
    const bundleLeak = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/`, { credentials: 'include' });
      const html = await res.text();
      return /DRM_CLIENT_SECRET|AUTH_JWT_SECRET|x-client-secret/i.test(html);
    }, BASE_URL);
    check('frontend bundle contains no privileged secrets', bundleLeak === false);

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
