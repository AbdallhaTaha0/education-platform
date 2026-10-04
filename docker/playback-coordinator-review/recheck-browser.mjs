import puppeteer from '/srv/browser/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import assert from 'node:assert/strict';
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const page=await browser.newPage();
  await page.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('input[type="radio"]');
  await page.click('input[type="radio"]');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>!b.disabled&&/End selected session|إنهاء الجلسة المحددة/.test(b.textContent||'')));
  await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(b=>/End selected session|إنهاء الجلسة المحددة/.test(b.textContent||''))?.click());
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>/Start playback again|بدء التشغيل مجددًا/.test(b.textContent||'')));
  const body=await page.$eval('body',e=>e.textContent);
  assert.match(body,/ENDED \/ FAILED/);
  await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(b=>/Start playback again|بدء التشغيل مجددًا/.test(b.textContent||''))?.click());
  await page.waitForFunction(()=>document.querySelector('[data-testid="recovered"]')?.textContent==='1');
  console.log('DEFECT: actual recovery component offers Closed and confirmed / restart after QUEUED followed by ENDED / FAILED. API is mocked; no real DRM playback claim.');
} finally {await browser.close();}
