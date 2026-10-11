// Real Chromium and components; synthetic discovery API/media timeline, no retained data.
import puppeteer from '/srv/browser/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const painter = await browser.newPage();
const photo = Buffer.from(await painter.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
  const context = canvas.getContext('2d'); context.fillStyle = '#172b42'; context.fillRect(0, 0, 960, 540);
  context.fillStyle = '#c9f24d'; context.font = 'bold 46px sans-serif'; context.fillText('Synthetic course cover', 70, 280);
  return canvas.toDataURL('image/jpeg', .9).split(',')[1];
}), 'base64');
await writeFile('/evidence/photo.jpg', photo); await painter.close();
const results = [];
try {
  for (const [lang, width] of [['ar', 1280], ['en', 390], ['ar', 320]]) {
    const page = await browser.newPage(); await page.setViewport({ width, height: 950 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (req.url().endsWith('/api/catalog/courses')) return req.respond({ contentType: 'application/json', body: JSON.stringify({ data: { courses: [{ id: 'synthetic-course', slug: 'synthetic-course', titleAr: 'دورة بصورة', titleEn: 'Course with a photo', descriptionAr: 'محتوى تجريبي', descriptionEn: 'Synthetic content', plans: [], coverUrl: '/catalog/courses/synthetic-course/cover', academic: { grade: 'FIRST_SECONDARY', term: 1 } }] } }) });
      if (req.url().includes('/api/catalog/courses/synthetic-course/cover')) return req.respond({ contentType: 'image/jpeg', body: photo });
      req.continue();
    });
    await page.goto(`http://fayq-cover-review-web:8080/review.html?lang=${lang}`);
    await page.waitForFunction(() => document.querySelector('[data-testid="course-cover"] img')?.naturalWidth > 0);
    assert.equal(await page.$eval('[data-testid="course-cover"] img', image => image.alt), lang === 'ar' ? 'دورة بصورة' : 'Course with a photo');
    await page.click('[data-testid="player-rewind"]'); assert.equal(await page.$eval('video', video => video.currentTime), 5);
    await page.click('[data-testid="player-rewind"]'); assert.equal(await page.$eval('video', video => video.currentTime), 0);
    await page.focus('[data-testid="player-forward"]'); await page.keyboard.press('Enter'); assert.equal(await page.$eval('video', video => video.currentTime), 10);
    for (let i = 0; i < 3; i++) await page.click('[data-testid="player-forward"]');
    assert.equal(await page.$eval('video', video => video.currentTime), 35);
    assert.ok(await page.evaluate(() => {
      const frame = document.querySelector('.learning-video-frame').getBoundingClientRect();
      return [...document.querySelectorAll('.learning-player-controls button')].every(button => { const b = button.getBoundingClientRect(); return b.width >= 44 && b.height >= 44 && b.left >= frame.left && b.right <= frame.right && b.top >= frame.top && b.bottom <= frame.bottom; });
    }));
    for (const [id, value] of [['cf-slug', 'synthetic-photo'], ['cf-ta', 'دورة'], ['cf-te', 'Course'], ['cf-da', 'وصف'], ['cf-de', 'Description']]) await page.type(`#${id}`, value);
    await page.click('form button[type="submit"]'); assert.equal(await page.evaluate(() => window.__submitted), undefined);
    const input = await page.$('#cf-photo'); await input.uploadFile('/evidence/photo.jpg');
    await page.waitForFunction(() => document.querySelector('[data-testid="course-photo-preview"]')?.naturalWidth > 0);
    await page.click('form button[type="submit"]'); await page.waitForFunction(() => !!window.__submitted);
    const saved = await page.evaluate(() => window.__submitted);
    await page.waitForSelector('[data-testid="success-feedback-message"]');
    assert.equal(await page.$eval('[data-testid="success-feedback-message"]', el => el.getAttribute('role')), 'status');
    await page.click('[data-testid="success-feedback-message"] button');
    assert.equal(await page.$('[data-testid="success-feedback-message"]'), null);
    await page.click('#show-feedback');
    await page.waitForSelector('[data-testid="success-feedback-message"]');
    assert.equal(await page.$$eval('[data-testid="success-feedback-message"]', elements => elements.length), 1);
    assert.equal(await page.$eval('[data-testid="error-feedback-message"]', el => el.getAttribute('role')), 'alert');
    assert.equal(await page.$eval('[data-testid="success-feedback-message"] button', el => el.getAttribute('aria-label')), lang === 'ar' ? 'إغلاق رسالة النجاح' : 'Dismiss success message');
    assert.ok(await page.evaluate(() => {
      const popup = document.querySelector('[data-testid="error-feedback-stack"]').getBoundingClientRect();
      return popup.left >= 0 && popup.right <= innerWidth && popup.top >= 0 && popup.bottom <= innerHeight;
    }));
    await page.screenshot({ path: `/evidence/feedback-${lang}-${width}.png`, fullPage: false });
    await page.focus('[data-testid="success-feedback-message"] button'); await page.keyboard.press('Enter');
    assert.equal(await page.$('[data-testid="success-feedback-message"]'), null);
    assert.ok(await page.$('[data-testid="error-feedback-message"]'));
    await page.click('#hide-feedback'); await page.waitForFunction(() => !document.querySelector('[data-testid="error-feedback-message"]'));
    await page.click('#repeat-success'); await page.waitForSelector('[data-testid="success-feedback-message"]');
    await page.click('[data-testid="success-feedback-message"] button');
    await page.click('#repeat-success'); await page.waitForSelector('[data-testid="success-feedback-message"]');
    await page.click('#repeat-success'); assert.equal(await page.$$eval('[data-testid="success-feedback-message"]', elements => elements.length), 1);
    await page.click('[data-testid="success-feedback-message"] button');
    assert.equal(saved.coverImage.mime, 'image/jpeg'); assert.ok(Buffer.from(saved.coverImage.base64, 'base64').length <= 131072);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.deepEqual(errors, []);
    await page.screenshot({ path: `/evidence/review-${lang}-${width}.png`, fullPage: true });
    results.push({ lang, width, mode: 'create', result: 'PASS' });
    for (const mode of ['edit-missing', 'edit-existing']) {
      await page.goto(`http://fayq-cover-review-web:8080/review.html?lang=${lang}&mode=${mode}`);
      await page.waitForSelector('#cf-photo');
      const label = mode === 'edit-existing' ? (lang === 'ar' ? 'تغيير صورة الدورة' : 'Change course photo') : (lang === 'ar' ? 'إضافة صورة للدورة' : 'Add course photo');
      assert.equal(await page.$eval('label[for="cf-photo"]', el => el.textContent), label);
      if (mode === 'edit-existing') await page.waitForFunction(() => document.querySelector('form [data-testid="course-cover"] img')?.naturalWidth > 0);
      else assert.equal(await page.$('form [data-testid="course-cover"] img'), null);
      const fileInput = await page.$('#cf-photo'); await fileInput.uploadFile('/evidence/photo.jpg');
      await page.waitForFunction(() => document.querySelector('[data-testid="course-photo-preview"]')?.naturalWidth > 0);
      await page.click('form button[type="button"]');
      assert.equal(await page.$('[data-testid="course-photo-preview"]'), null);
      assert.equal(await page.$eval('#cf-photo', input => input.value), '');
      await fileInput.uploadFile('/evidence/photo.jpg');
      await page.waitForFunction(() => document.querySelector('[data-testid="course-photo-preview"]')?.naturalWidth > 0);
      await page.click('form button[type="submit"]'); await page.waitForFunction(() => !!window.__submitted);
      assert.ok(await page.evaluate(() => !!window.__submitted.coverImage));
      assert.equal(await page.$eval('#cf-photo', input => input.value), '');
      assert.ok(await page.$('[data-testid="course-photo-preview"]'));
      assert.equal(await page.$('form button[type="button"]'), null);
      await page.evaluate(() => { window.__submitted = null; });
      await page.click('form button[type="submit"]'); await page.waitForFunction(() => !!window.__submitted);
      assert.equal(await page.evaluate(() => window.__submitted.coverImage), undefined);
      await page.screenshot({ path: `/evidence/${mode}-${lang}-${width}.png`, fullPage: true });
      results.push({ lang, width, mode, result: 'PASS' });
    }
    await page.close();
  }
  await writeFile('/evidence/browser-results.json', JSON.stringify(results, null, 2));
  console.log('PASS: 9 browser scenarios; create/photo edits, matching success/error popups, keyboard dismissal, repeated success without duplicates, rendered cover and responsive seek controls. Synthetic API/media clock.');
} finally { await browser.close(); }
