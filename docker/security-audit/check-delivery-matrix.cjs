const assert = require('node:assert/strict');
const fs = require('node:fs');
const puppeteer = require('/srv/browser/node_modules/puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const cases = [];
  try {
    for (const width of [390, 1440]) {
      for (const lang of ['ar', 'en']) {
        for (const theme of ['dark', 'light']) {
          const page = await browser.newPage();
          await page.setViewport({ width, height: 900 });
          await page.evaluateOnNewDocument((lang, theme) => {
            localStorage.setItem('edu-platform-lang', lang);
            localStorage.setItem('edu-platform-theme', theme);
          }, lang, theme);
          await page.goto('http://fayq-security-delivery-candidate:8080/', { waitUntil: 'networkidle0' });
          const state = await page.evaluate(() => ({
            lang: document.documentElement.lang,
            dir: document.documentElement.dir,
            theme: document.documentElement.dataset.theme,
            text: document.querySelector('#root')?.textContent.length,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          }));
          assert.equal(state.lang, lang);
          assert.equal(state.dir, lang === 'ar' ? 'rtl' : 'ltr');
          assert.equal(state.theme, theme);
          assert.ok(state.text > 20);
          assert.equal(state.overflow, false);
          await page.screenshot({ path: '/delivery-evidence/home-' + width + '-' + lang + '-' + theme + '.png', fullPage: true });
          cases.push({ width, ...state });
          await page.close();
        }
      }
    }
    fs.writeFileSync('/delivery-evidence/browser-matrix.json', JSON.stringify({
      puppeteer: require('/srv/browser/node_modules/puppeteer-core/package.json').version,
      chromium: await browser.version(), cases,
    }, null, 2));
    console.log('PASS: 8 homepage viewport/language/theme cases, no horizontal overflow.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exit(1); });
