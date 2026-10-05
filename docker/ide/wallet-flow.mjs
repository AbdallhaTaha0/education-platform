/** Real platform APIs and synthetic transfers only. Runner owns disposable cleanup. */
import assert from 'node:assert/strict';
import { lookup } from 'node:dns/promises';
import { writeFileSync, unlinkSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const host = (await lookup('nginx')).address;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=MAP localhost ${host}`] });
let checks = 0; const errors = [];
function pass(name, value = true) { assert(value, name); checks++; console.log(`PASS ${name}`); }
async function page() {
  const context = await browser.createBrowserContext(); const p = await context.newPage();
  await p.setViewport({ width: 1280, height: 1000 }); p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument(() => localStorage.setItem('edu-platform-lang', 'ar'));
  return p;
}
async function route(p, hash) { await p.goto('http://localhost:8080/' + hash, { waitUntil: 'networkidle2' }); }
async function login(p, role) {
  await route(p, '#/login'); await p.type('#login-id', `modes-${role}@example.test`); await p.type('#login-password', 'synthetic modes password only');
  await p.click('form button[type=submit]'); await p.waitForFunction(() => location.hash === '#/account');
}
async function text(p, selector, value) { await p.click(selector, { clickCount: 3 }); await p.type(selector, value); }
async function api(p, path) { return p.evaluate(async path => (await (await fetch('/api' + path)).json()).data, path); }
try {
  const admin = await page(), student = await page(); await login(admin, 'admin'); await login(student, 'student');
  pass('Arabic navigation says IDE', await student.$eval('.site-header a[href="#/practice"]', e => e.textContent.trim() === 'IDE'));
  await route(admin, '#/admin/recharge'); await admin.waitForSelector('#instapay-account');
  await admin.click('#admin-payments-tab-instapay');
  await admin.click('#instapay-enabled');
  await text(admin, '#instapay-account', 'synthetic@instapay');
  await text(admin, '#instapay-ar', 'مستلم تجريبي فقط'); await text(admin, '#instapay-en', 'Synthetic recipient only');
  await admin.click('[data-testid=instapay-settings] button[type=submit]');
  await admin.waitForFunction(() => document.querySelector('[data-testid=instapay-settings]').textContent.includes('تم حفظ'));
  pass('ADMIN saves receiving details');
  await admin.reload({ waitUntil: 'networkidle2' }); await admin.waitForSelector('#instapay-account');
  pass('receiving settings persist after reload', await admin.$eval('#instapay-account', e => e.value === 'synthetic@instapay'));
  await admin.click('#admin-payments-tab-vodafone');
  await admin.click('#vodafone-cash-enabled');
  await text(admin, '#vodafone-cash-account', '+201001234567');
  await text(admin, '#vodafone-cash-ar', 'مستلم فودافون تجريبي');
  await text(admin, '#vodafone-cash-en', 'Synthetic Vodafone recipient');
  await admin.click('[data-testid=vodafone-cash-settings] button[type=submit]');
  await admin.waitForFunction(() => document.querySelector('[data-testid=vodafone-cash-settings]').textContent.includes('تم حفظ'));
  pass('ADMIN configures Vodafone Cash independently');
  pass('both payment methods available', (await api(student, '/wallet/instructions')).channels.length === 2);
  await route(student, '#/wallet'); await student.waitForFunction(() => document.querySelector('main').textContent.includes('synthetic@instapay'));
  pass('student sees saved receiving details');
  await admin.$eval('#admin-payments-tab-instapay', e => e.scrollIntoView({ block: 'center' })); await admin.click('#admin-payments-tab-instapay');
  await admin.waitForSelector('#instapay-qr-file', { visible: true });
  const qrPath = '/tmp/synthetic-instapay-qr.png';
  writeFileSync(qrPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ioAAAAASUVORK5CYII=', 'base64'));
  await (await admin.$('#instapay-qr-file')).uploadFile(qrPath);
  const uploaded = admin.waitForResponse(r => r.url().includes('/api/admin/payment-settings/instapay/qr') && r.request().method() === 'POST' && r.status() === 200);
  await admin.click('[data-testid=upload-instapay-qr]'); await uploaded; unlinkSync(qrPath);
  await admin.waitForFunction(() => { const image = document.querySelector('[data-testid=admin-instapay-qr]'); return image?.complete && image.naturalWidth > 0; });
  pass('ADMIN uploads and previews InstaPay QR');
  await admin.reload({ waitUntil: 'networkidle2' }); await admin.click('#admin-payments-tab-instapay'); await admin.waitForSelector('[data-testid=admin-instapay-qr]', { visible: true });
  pass('QR persists after ADMIN reload');
  await student.reload({ waitUntil: 'networkidle2' }); await student.waitForFunction(() => { const image = document.querySelector('[data-testid=instapay-qr]'); return image?.complete && image.naturalWidth > 0; });
  pass('STUDENT sees saved QR without account credit');
  const jpeg = await admin.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8; canvas.getContext('2d').fillRect(0,0,8,8); return canvas.toDataURL('image/jpeg').split(',')[1]; });
  const jpegPath = '/tmp/synthetic-instapay-qr.jpg'; writeFileSync(jpegPath, Buffer.from(jpeg, 'base64'));
  await (await admin.$('#instapay-qr-file')).uploadFile(jpegPath);
  const replaced = admin.waitForResponse(r => r.url().includes('/api/admin/payment-settings/instapay/qr') && r.request().method() === 'POST' && r.status() === 200);
  await admin.click('[data-testid=upload-instapay-qr]'); await replaced; unlinkSync(jpegPath);
  await student.reload({ waitUntil: 'networkidle2' }); await student.waitForFunction(() => { const image = document.querySelector('[data-testid=instapay-qr]'); return image?.complete && image.naturalWidth === 8; });
  pass('ADMIN replaces PNG with JPEG and STUDENT sees new image');
  admin.once('dialog', d => d.accept()); const removed = admin.waitForResponse(r => r.url().includes('/api/admin/payment-settings/instapay/qr') && r.request().method() === 'DELETE' && r.status() === 200);
  await admin.click('[data-testid=remove-instapay-qr]'); await removed;
  await student.reload({ waitUntil: 'networkidle2' });
  pass('QR removal preserves receiving details', await student.$$eval('[data-testid=instapay-qr]', images => images.length === 0) && (await api(student, '/wallet/instructions')).channels[0].accountLabel === 'synthetic@instapay');
  await student.waitForFunction(() => [...document.querySelectorAll('[data-testid=payment-logo]')].length === 2 && [...document.querySelectorAll('[data-testid=payment-logo]')].every(e => e.complete && e.naturalWidth > 0));
  pass('both official payment logos load locally', await student.$$eval('[data-testid=payment-logo]', images => images.every(e => (e.src.startsWith('data:image/') || new URL(e.src).origin === location.origin) && e.getBoundingClientRect().width >= 40)));

  pass('desktop receiving cards are side by side', await student.$$eval('[data-testid=payment-methods] > [data-testid=payment-details]', cards => { const [a,b] = cards.map(e => e.getBoundingClientRect()); return cards.length === 2 && Math.abs(a.top-b.top) < 2 && Math.abs(a.left-b.left) > 200; }));
  await student.setViewport({ width: 390, height: 900 });
  pass('mobile receiving cards stack without overflow', await student.$$eval('[data-testid=payment-methods] > [data-testid=payment-details]', cards => { const [a,b] = cards.map(e => e.getBoundingClientRect()); return b.top >= a.bottom && Math.abs(a.left-b.left) < 2 && document.documentElement.scrollWidth <= innerWidth; }));
  await student.screenshot({ path: '/evidence/wallet-payment-logos-mobile.png', fullPage: true });
  await student.setViewport({ width: 1280, height: 1000 });
  await student.browserContext().overridePermissions('http://localhost:8080', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await student.bringToFront();
  await student.click('[data-testid=copy-receiving]');
  await student.waitForFunction(() => document.querySelector('[data-testid=copy-receiving]').textContent.includes('تم النسخ'));
  pass('receiving details copy the exact destination', await student.evaluate(async () => (await navigator.clipboard.readText()) === 'synthetic@instapay'));
  pass('only wallet navigation is highlighted', await student.$$eval('.site-header nav [aria-current=page]', links => links.length === 1 && links[0].getAttribute('href') === '#/wallet'));
  const before = (await api(student, '/wallet')).balancePiastres;
  await route(student, '#/wallet/recharge'); await student.waitForSelector('#rch-channel'); await student.select('#rch-channel', 'MOBILE_WALLET'); await student.waitForSelector('[data-testid=recharge-receiving]');
  pass('receiving details shown beside recharge form', await student.$eval('[data-testid=recharge-receiving]', e => e.textContent.replace(/\s/g, '').includes('+201001234567')));
  await student.type('#rch-amount', '25'); await student.select('#rch-channel', 'MOBILE_WALLET');
  pass('Vodafone Cash appears in method selector', await student.$eval('#rch-channel', e => e.selectedOptions[0].textContent.includes('فودافون كاش')));
  const reference = 'BROWSERWALLET' + Date.now();
  await student.type('#rch-reference', reference); await student.type('#rch-sender', 'Synthetic Student'); await student.type('#rch-phone', '+201001239902');
  await student.$eval('#rch-date', (e, date) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(e, date); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, new Date().toISOString().slice(0, 10));
  await student.$eval('#rch-proof', e => {
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1kAAAAASUVORK5CYII='), c => c.charCodeAt(0));
    const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'synthetic-receipt.png', { type: 'image/png' })); e.files = transfer.files; e.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const access = (await student.cookies('http://localhost:8080/api/')).find(c => c.name === 'edu_access'); await student.deleteCookie(access);
  const submitted = student.waitForResponse(r => r.url().endsWith('/api/wallet/recharge-requests') && r.request().method() === 'POST' && r.status() === 201);
  await student.click('form button[type=submit]'); const request = (await (await submitted).json()).data;
  pass('recharge submission refreshes expired session and remains pending', request.status === 'PENDING' && request.channel === 'MOBILE_WALLET');
  pass('submission does not credit balance', (await api(student, '/wallet')).balancePiastres === before);
  await route(admin, '#/admin/recharge'); await admin.reload({ waitUntil: 'networkidle2' }); await admin.waitForFunction(reference => [...document.querySelectorAll('main li')].some(e => e.textContent.includes(reference)), {}, reference);
  await admin.$$eval('main li', (rows, reference) => rows.find(e => e.textContent.includes(reference)).querySelector('button').click(), reference);
  await admin.waitForSelector('[role=dialog] input[type=checkbox]');
  pass('approval requires receipt verification', await admin.$eval('[role=dialog] .form-actions button', e => e.disabled));
  await admin.click('[role=dialog] input[type=checkbox]');
  const reviewed = admin.waitForResponse(r => r.url().endsWith(`/recharge-requests/${request.id}/review`) && r.status() === 200);
  await admin.click('[role=dialog] .form-actions button'); await reviewed;
  pass('verified approval credits exact amount', (await api(student, '/wallet')).balancePiastres === before + 2500);
  await student.waitForFunction(async () => (await (await fetch('/api/notifications/unread-count')).json()).data.unreadCount > 0);
  const acknowledged = student.waitForResponse(r => r.url().endsWith('/api/notifications/read-all') && r.status() === 200);
  await route(student, '#/notifications'); await acknowledged;
  await student.waitForSelector('[data-testid=notification-unread-count]');
  await student.waitForFunction(() => [...document.querySelectorAll('[data-testid=notification-entry]')].every(e => !e.querySelector('bdi')));
  pass('opening inbox acknowledges notifications on the server', (await api(student, '/notifications/unread-count')).unreadCount === 0);
  await route(student, '#/wallet'); await student.reload({ waitUntil: 'networkidle2' });
  await student.waitForFunction(() => document.querySelector('main').textContent.includes('synthetic@instapay'));
  pass('read notifications stay absent from navbar after navigation and reload', await student.$$eval('[data-testid=notification-entry]', entries => entries.every(e => !e.querySelector('bdi'))));
  await student.screenshot({ path: '/evidence/wallet-student.png', fullPage: true });
  await route(admin, '#/admin/recharge'); await admin.reload({ waitUntil: 'networkidle2' }); await admin.waitForSelector('#instapay-enabled'); await admin.click('#admin-payments-tab-instapay');
  await admin.click('#instapay-enabled'); await admin.click('[data-testid=instapay-settings] button[type=submit]');
  await admin.waitForFunction(() => document.querySelector('[data-testid=instapay-settings]').textContent.includes('تم حفظ'));
  pass('disabling InstaPay preserves enabled Vodafone Cash', (await api(student, '/wallet/instructions')).channels[0].channel === 'MOBILE_WALLET');
  await admin.waitForFunction(() => !document.querySelector('#admin-payments-tab-vodafone').disabled);
  await admin.$eval('#admin-payments-tab-vodafone', e => e.scrollIntoView({ block: 'center' }));
  await admin.click('#admin-payments-tab-vodafone');
  await admin.waitForSelector('#vodafone-cash-enabled', { visible: true });
  await admin.click('#vodafone-cash-enabled'); await admin.click('[data-testid=vodafone-cash-settings] button[type=submit]');
  await admin.waitForFunction(() => document.querySelector('[data-testid=vodafone-cash-settings]').textContent.includes('تم حفظ'));
  await route(student, '#/wallet'); await student.reload({ waitUntil: 'networkidle2' }); await student.waitForFunction(() => document.querySelector('main').textContent.includes('الشحن غير متاح'));
  pass('disabling both methods closes new recharge without losing wallet history');
  await admin.screenshot({ path: '/evidence/wallet-admin.png', fullPage: true });
  for (const [role, p] of [['STUDENT', student], ['ADMIN', admin]]) {
    await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }), p.click('[data-testid=header-logout]')]); await p.waitForFunction(() => location.hash === '#/login' && document.querySelector('#login-id'));
    pass(`${role} logout reloads login page`);
    pass(`${role} login help centered`, await p.$eval('[data-testid=login-help]', e => getComputedStyle(e).textAlign === 'center'));
  }
  await student.screenshot({ path: '/evidence/wallet-login.png', fullPage: true });
  await route(student, '#/');
  pass('homepage headline does not create drag-selection blocks', await student.$eval('#hero-title', e => getComputedStyle(e).userSelect === 'none'));
  pass('no browser errors', errors.length === 0); console.log(`Wallet browser checks=${checks} failed=0`);
} catch (error) { console.error(error); throw error; } finally { await browser.close(); }
