import puppeteer from '/srv/browser/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import assert from 'node:assert/strict';
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const page=await browser.newPage();
  await page.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('input[type="radio"]');
  await page.click('input[type="radio"]');
  await page.click('section button');
  await page.waitForFunction(()=>document.querySelector('[data-testid="recovered"]')?.textContent==='1');
  const result=await page.$eval('[data-testid="recovered"]',e=>e.textContent);
  assert.equal(result,'1');
  console.log('DEFECT REPRODUCED: actual OwnSessionRecovery calls onRecovered after NOOP, despite no confirmed closure.');
} finally {await browser.close();}
