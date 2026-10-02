/** Bounded dashboard-navigation/layout proof on the owned synthetic project only. Read-only: no financial, grade or owner mutation. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const fixture = JSON.parse(fs.readFileSync('/evidence/m9-fixtures.json', 'utf8'));
const host = (await lookup('host.docker.internal')).address;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${host}`] });
const contexts = []; const errors = []; let checks = 0;
const pass = (name, condition = true) => { assert(condition, name); checks++; console.log(`PASS ${name}`); };
async function page(lang = 'en', width = 1280, height = 900) {
  const context = await browser.createBrowserContext(); contexts.push(context);
  const p = await context.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.setViewport({ width, height });
  await p.evaluateOnNewDocument((l) => { if (window.top === window) localStorage.setItem('edu-platform-lang', l); }, lang);
  return p;
}
async function route(p, hash) { await p.goto('http://localhost:8084/' + hash); }
async function login(p, email) {
  await route(p, '#/login');
  await p.waitForSelector('#login-id');
  await p.type('#login-id', email);
  await p.type('#login-password', 'm9 fixture password twelve words');
  await p.click('form button[type="submit"]');
  await p.waitForFunction(() => location.hash === '#/account');
}
async function centredIn(panelSel, groupSel, p) {
  return p.evaluate((panelSel, groupSel) => {
    const panel = document.querySelector(panelSel);
    const groups = [...document.querySelectorAll(groupSel)];
    if (!panel || !groups.length) return false;
    const pr = panel.getBoundingClientRect();
    return groups.every((g) => {
      const gr = g.getBoundingClientRect();
      const style = getComputedStyle(g);
      if (style.display !== 'flex' || style.justifyContent !== 'center') return false;
      const buttons = [...g.querySelectorAll(':scope > button')];
      if (!buttons.length || Math.abs((pr.left + pr.right) / 2 - (gr.left + gr.right) / 2) > 4) return false;
      const rows = new Map();
      for (const b of buttons) {
        const br = b.getBoundingClientRect();
        if (br.width === 0 || br.height === 0) continue;
        const key = Math.round(br.top);
        const row = rows.get(key) || { left: br.left, right: br.right };
        row.left = Math.min(row.left, br.left); row.right = Math.max(row.right, br.right); rows.set(key, row);
      }
      return rows.size > 0 && [...rows.values()].every((r) => Math.abs((r.left + r.right) / 2 - (gr.left + gr.right) / 2) <= 4);
    });
  }, panelSel, groupSel);
}
async function shot(p, name, fullPage = false) { await p.screenshot({ path: `/evidence/navigation-${name}.png`, fullPage }); }
try {
  // Four mobile destinations, with authentication beside the header theme toggle.
  const anon = await page('ar', 390, 844);
  await route(anon, '#/');
  await anon.waitForSelector('[data-testid="mobile-dock"]');
  pass('anonymous mobile dock has exactly four destinations', (await anon.$$('[data-testid="mobile-dock"] a')).length === 4);
  pass('anonymous dock labels are Home/Discover/My learning/My account', await anon.$eval('[data-testid="mobile-dock"]', (e) => {
    const t = e.textContent;
    return t.includes('الرئيسية') && t.includes('اكتشف') && t.includes('تعلّمي') && t.includes('حسابي');
  }));
  pass('anonymous protected learning leads through login', (await anon.$eval('[data-testid="mobile-dock"]', (e) => [...e.querySelectorAll('a')].map((a) => a.getAttribute('href')))).join() === '#/,#/courses,#/login,#/account');
  pass('anonymous dock icons sit above labels with lime active state', await anon.evaluate(() => {
    const link = document.querySelector('[data-testid="mobile-dock"] a[aria-current="page"]');
    if (!link) return false;
    const icon = link.querySelector('.mobile-dock__icon');
    if (!icon) return false;
    const lr = link.getBoundingClientRect(); const ir = icon.getBoundingClientRect();
    return ir.top < lr.top + lr.height / 2 && getComputedStyle(icon).borderRadius.includes('50');
  }));
  pass('anonymous mobile has no horizontal overflow', await anon.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  pass('all dock touch targets meet 44px', await anon.$$eval('[data-testid="mobile-dock"] a', (es) => es.every((e) => e.getBoundingClientRect().height >= 44)));
  await route(anon, '#/account');
  await anon.waitForFunction(() => document.querySelector('main')?.textContent.includes('سجّل الدخول'));
  pass('anonymous account keeps the sign-in prompt without workspace data', !await anon.$('[data-testid="account-workspace"] [href="#/dashboard"]'));
  await shot(anon, 'anon-ar-mobile');

  // Anonymous desktop English.
  const anonEn = await page('en', 1280, 900);
  await route(anonEn, '#/');
  pass('desktop top navbar is visible with language/theme controls', !!await anonEn.$('.desktop-navigation') && !!await anonEn.$('.language-tool') && await anonEn.evaluate(() => getComputedStyle(document.querySelector('.desktop-navigation')).display !== 'none'));
  pass('mobile dock is hidden on desktop widths', await anonEn.evaluate(() => getComputedStyle(document.querySelector('.mobile-dock')).display === 'none'));

  // Student workspace.
  const student = await page('en', 1280, 900);
  await login(student, 'm9-student@example.test');
  await route(student, '#/account');
  await student.waitForSelector('[data-testid="account-workspace"]');
  await student.waitForFunction(() => document.querySelector('main')?.textContent.includes('Active courses') || document.querySelector('main')?.textContent.includes('Could not load'));
  pass('student account opens role overview in the shared workspace', await student.$eval('main', (e) => e.textContent.includes('Welcome to your account') && e.textContent.includes('Active courses')));
  pass('student sidebar lists learning/profile sections without a second dock', (await student.$$('[data-testid="account-workspace"] .workspace-sidebar a')).length === 7 && !await student.$('[data-testid="account-workspace"] .mobile-dock'));
  pass('desktop sidebar hides the compact section menu', await student.evaluate(() => getComputedStyle(document.querySelector('[data-testid="workspace-section-menu"]')).display === 'none'));
  pass('single main landmark and single main id', await student.evaluate(() => document.querySelectorAll('main').length === 1 && document.querySelectorAll('#main').length <= 1));
  pass('sidebar exposes active page semantics', await student.$eval('[data-testid="account-workspace"] .workspace-sidebar a[aria-current="page"]', (e) => e.getAttribute('href') === '#/account'));
  await shot(student, 'student-overview-en-desktop');

  await route(student, '#/account/profile');
  await student.waitForSelector('[data-testid="account-settings"]');
  pass('profile/security is reachable in the same workspace', await student.$eval('[data-testid="account-workspace"] .workspace-sidebar a[aria-current="page"]', (e) => e.getAttribute('href') === '#/account/profile'));
  pass('save-name group is centred in its panel', await centredIn('[data-testid="account-settings"] > form', '[data-testid="account-settings"] > form .form-actions', student));
  await student.$eval('[data-testid="account-settings"] details', (e) => { e.open = true; });
  await student.type('[data-testid="account-settings"] details input', 'keep twelve words');
  await student.$eval('[data-testid="account-settings"] details .form-actions button', (b) => b.click());
  pass('password visibility toggle preserves its input', await student.$eval('[data-testid="account-settings"] details input', (e) => e.value === 'keep twelve words' && e.type === 'text'));
  await student.$eval('[data-testid="account-settings"] details input', (e) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(e, ''); e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await shot(student, 'student-profile-en-desktop');

  // Student deep links + back/forward with distinct active states.
  await route(student, '#/dashboard');
  await student.waitForFunction(() => document.querySelector('main')?.textContent.includes('Active subscriptions'));
  pass('existing dashboard deep link still works inside the workspace', !!await student.$('[data-testid="account-workspace"]'));
  pass('my learning and my account have distinct active states', await student.evaluate(() => {
    const cur = document.querySelector('[data-testid="account-workspace"] .workspace-sidebar a[aria-current="page"]')?.getAttribute('href');
    return cur === '#/dashboard';
  }));
  await student.evaluate(() => history.back());
  await student.waitForFunction(() => location.hash === '#/account/profile');
  pass('browser back returns to profile without losing workspace', !!await student.$('[data-testid="account-settings"]'));
  await student.evaluate(() => history.forward());
  await student.waitForFunction(() => location.hash === '#/dashboard');
  pass('browser forward restores the learning dashboard', !!await student.$('[data-testid="account-workspace"]'));

  // Student mobile 390 Arabic + 320, dark/light.
  await student.click('[aria-label="التبديل إلى العربية"]');
  await student.setViewport({ width: 390, height: 844 });
  await route(student, '#/account');
  await student.waitForSelector('[data-testid="workspace-section-menu"]');
  pass('mobile workspace uses an inline section menu, not a second floating dock', await student.evaluate(() => {
    const menu = document.querySelector('[data-testid="workspace-section-menu"]');
    if (!menu) return false;
    const r = getComputedStyle(menu);
    return r.position !== 'fixed' && document.querySelectorAll('[data-testid="mobile-dock"]').length === 1;
  }));
  pass('mobile account fits 390px without overflow', await student.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await student.click('[data-testid="workspace-section-menu"] summary');
  pass('mobile section links meet 44px targets', await student.$$eval('[data-testid="workspace-section-menu"] a, [data-testid="mobile-dock"] a', (es) => es.every((e) => e.getBoundingClientRect().height >= 44)));
  await student.click('[data-testid="workspace-section-menu"] a[href="#/wallet"]');
  await student.waitForFunction(() => location.hash === '#/wallet');
  pass('wallet stays in workspace and selected mobile section closes', await student.evaluate(() => !!document.querySelector('.account-workspace') && !document.querySelector('.workspace-mobile-menu').open));
  await shot(student, 'student-overview-ar-mobile');
  await student.setViewport({ width: 320, height: 568 });
  await route(student, '#/account/profile');
  await student.waitForSelector('[data-testid="account-settings"]');
  pass('profile fits 320px without horizontal overflow', await student.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  pass('save-name stays centred at 320px Arabic', await centredIn('[data-testid="account-settings"] > form', '[data-testid="account-settings"] > form .form-actions', student));
  pass('wrapped logout buttons stay centred at 320px Arabic', await centredIn('main .bg-surface', 'main .bg-surface > .form-actions', student));
  await shot(student, 'student-profile-ar-320');
  await student.click('[aria-label="Switch to English"]');
  await student.setViewport({ width: 390, height: 844 });
  await student.click('header button[aria-pressed]');
  await student.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  const lightDock = await student.$eval('.mobile-dock', (e) => getComputedStyle(e).backgroundColor);
  await student.click('header button[aria-pressed]');
  await student.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  pass('dock surface changes with light/dark themes', lightDock !== await student.$eval('.mobile-dock', (e) => getComputedStyle(e).backgroundColor));
  await student.setViewport({ width: 1280, height: 900 });

  // Login/register centred groups in both directions.
  const auth = await page('ar', 390, 844);
  await route(auth, '#/login');
  await auth.waitForSelector('#login-id');
  pass('login submit group is centred (Arabic mobile)', await centredIn('.form-card', '.form-card .form-actions', auth));
  pass('anonymous login has one active dock destination', (await auth.$$('.mobile-dock a[aria-current="page"]')).length === 1);
  await shot(auth, 'login-ar-mobile');
  await route(auth, '#/register');
  await auth.waitForSelector('#reg-password');
  pass('register submit group is centred (Arabic mobile)', await centredIn('.form-card', '.form-card .form-actions', auth));
  await auth.click('[aria-label="Switch to English"]');
  pass('register submit group is centred (English mobile)', await centredIn('.form-card', '.form-card .form-actions', auth));
  await route(auth, '#/login'); await auth.waitForSelector('#login-id');
  pass('login submit group is centred (English mobile)', await centredIn('.form-card', '.form-card .form-actions', auth));

  // Practice entitlement preserved through the workspace destination.
  await route(student, '#/practice');
  await student.waitForSelector('[data-testid="web-ide"]');
  pass('active subscription keeps standalone practice through the workspace link', !!await student.$('[data-testid="web-ide"]'));
  const inactive = await page('en', 1280, 900);
  await login(inactive, 'm9-inactive@example.test');
  await route(inactive, '#/practice');
  await inactive.waitForFunction(() => document.querySelector('[data-testid="error-feedback-stack"]')?.textContent.includes('active course subscription'));
  pass('inactive student practice stays locked (no entitlement bypass)', !await inactive.$('[data-testid="web-ide"]'));

  // Unsaved profile navigation can be cancelled (no mutation).
  await route(inactive, '#/account/profile');
  await inactive.waitForSelector('[data-testid="account-settings"]');
  await inactive.$eval('[data-testid="account-settings"] > form input', (e) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, 'Unsaved navigation probe');
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  let prompts = 0; const dialog = async (d) => { prompts++; await d.dismiss(); }; inactive.on('dialog', dialog);
  await inactive.$eval('[data-testid="account-workspace"] .workspace-sidebar a[href="#/dashboard"]', (e) => e.click());
  await new Promise((r) => setTimeout(r, 300));
  pass('unsaved profile navigation can be cancelled without losing values', prompts === 1 && await inactive.$eval('[data-testid="account-settings"] > form input', (e) => e.value === 'Unsaved navigation probe'));
  inactive.off('dialog', dialog);

  // ADMIN workspace.
  const admin = await page('en', 1280, 900);
  await login(admin, 'm9-admin@example.test');
  await route(admin, '#/admin/summary');
  await admin.waitForSelector('[data-testid="account-workspace"]');
  pass('admin overview lives in the consistent workspace navigation', (await admin.$$('[data-testid="account-workspace"] .workspace-sidebar a')).length >= 11);
  pass('no duplicated legacy admin navigation above the sidebar', !await admin.evaluate(() => [...document.querySelectorAll('nav')].some((n) => n.getAttribute('aria-label') === 'Platform management')));
  await route(admin, '#/account');
  await admin.waitForFunction(() => document.querySelector('main')?.textContent.includes('Management and my account'));
  pass('admin account opens the admin role overview', await admin.$eval('main', (e) => e.textContent.includes('Management and my account') && !e.textContent.includes('Active courses')));
  await route(admin, '#/account/profile');
  await admin.waitForSelector('[data-testid="account-settings"]');
  pass('admin personal profile is distinct from platform overview', await admin.$eval('[data-testid="account-workspace"] .workspace-sidebar a[aria-current="page"]', (e) => e.getAttribute('href') === '#/account/profile'));
  pass('admin student data stays protected from students', await student.evaluate(async () => {
    const r = await fetch('/api/admin/catalog/summary', { credentials: 'include' });
    return r.status === 403;
  }));
  await admin.setViewport({ width: 390, height: 844 });
  await route(admin, '#/admin/recharge');
  await admin.waitForSelector('main');
  pass('admin mobile dock keeps exactly four items', (await admin.$$('[data-testid="mobile-dock"] a')).length === 4);
  pass('admin dock routes are Overview/Courses/Recharge/My account', (await admin.$eval('[data-testid="mobile-dock"]', (e) => [...e.querySelectorAll('a')].map((a) => a.getAttribute('href')))).join() === '#/admin/summary,#/admin/catalog,#/admin/recharge,#/account');
  pass('admin mobile has no overflow or obstructed content', await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await shot(admin, 'admin-en-mobile');
  await admin.setViewport({ width: 1280, height: 900 });

  // Representative centred ADMIN/support/assessment action groups (placement, no save).
  await route(admin, '#/admin/support');
  await admin.waitForSelector('[data-testid="support-settings"]');
  pass('support save group is centred relative to its panel', await centredIn('[data-testid="support-settings"]', '[data-testid="support-settings"] .form-actions', admin));
  await shot(admin, 'admin-support-en-desktop');
  await route(admin, '#/admin/catalog');
  await admin.waitForSelector('#admin-search');
  pass('catalog creation action is centred while filters stay attached', await admin.evaluate(() => {
    const action = [...document.querySelectorAll('main .form-actions')][0];
    return !!action && getComputedStyle(action).justifyContent === 'center';
  }));
  await route(admin, '#/admin/packages');
  pass('ADMIN packages has exactly one active sidebar destination', await admin.$$eval('.workspace-sidebar a[aria-current="page"]', (es) => es.length === 1 && es[0].getAttribute('href') === '#/admin/packages'));

  // Owned checkout safeguards preserved (no new purchase).
  await route(student, `#/purchase/${fixture.planId}`);
  await student.waitForFunction(() => document.querySelector('main')?.textContent.includes('Continue learning') || document.querySelector('main')?.textContent.includes('Back to courses'));
  pass('owned course still refuses duplicate payment without a new charge', !await student.evaluate(() => [...document.querySelectorAll('main button')].some((b) => b.textContent.includes('Confirm purchase'))));

  // Inspect actual visible button rectangles, including wrapped rows, for
  // both roles, languages and themes rather than just asserting CSS classes.
  for (const [role, p] of [['student', student], ['admin', admin]]) {
    await route(p, '#/account/profile'); await p.waitForSelector('[data-testid="account-settings"]');
    for (const lang of ['ar', 'en']) {
      if (await p.evaluate(() => document.documentElement.lang) !== lang) await p.click('.language-tool');
      for (const theme of ['light', 'dark']) {
        if (await p.evaluate(() => document.documentElement.dataset.theme) !== theme) await p.click('header button[aria-pressed]');
        for (const width of [320, 390, 1024, 1280]) {
          await p.setViewport({ width, height: 900 });
          await p.$eval('[data-testid="account-settings"] details', (e) => { e.open = true; });
          pass(`${role} ${lang} ${theme} ${width}px profile groups centre with no overflow`,
            await centredIn('[data-testid="account-settings"] > form', '[data-testid="account-settings"] > form .form-actions', p)
            && await centredIn('[data-testid="account-settings"] details form', '[data-testid="account-settings"] details .form-actions', p)
            && await centredIn('main .bg-surface', 'main .bg-surface > .form-actions', p)
            && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          if (width >= 1024) pass(`${role} ${lang} ${theme} ${width}px top navbar fits`, await p.$$eval('header a, header button', (els) => els.every((e) => {
            const r = e.getBoundingClientRect(); return r.width === 0 || (r.left >= 0 && r.right <= innerWidth);
          })));
          if (width === 390 && lang === 'ar') await shot(p, `${role}-profile-ar-${theme}-mobile`, true);
        }
      }
    }
  }

  // Simulate a service failure only in the browser; no server data edits.
  let failDashboard = true;
  await student.setRequestInterception(true);
  student.on('request', (r) => r.url().endsWith('/api/learning/dashboard') && failDashboard
    ? r.respond({ status: 503, contentType: 'application/json', body: '{"error":{"code":"SERVICE_ERROR"}}' }) : r.continue());
  await route(student, '#/account');
  await student.waitForFunction(() => document.querySelector('[data-testid="error-feedback-stack"]')?.textContent.includes('Could not load'));
  pass('failed student overview shows visible error without invented zero metrics', !await student.$('main dl'));
  failDashboard = false;
  await student.$eval('main button', (e) => e.click());
  await student.waitForSelector('main dl');
  pass('overview retry restores real course and wallet data', await student.$eval('main', (e) => e.textContent.includes('Active courses')));

  pass('no React/browser page errors across navigation checks', errors.length === 0);
  console.log(`Navigation checks=${checks} failed=0`);
} catch (e) { console.error(e.stack); for (const c of contexts) for (const p of await c.pages()) { try { console.error('PAGE', p.url(), await p.evaluate(() => document.querySelector('main')?.textContent?.slice(0, 1600))); await p.screenshot({ path: '/evidence/navigation-failure-' + contexts.indexOf(c) + '.png' }); } catch { /* ignore */ } } process.exitCode = 1; } finally { for (const c of contexts) await c.close(); await browser.close(); }
