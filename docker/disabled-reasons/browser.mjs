import puppeteer from '/srv/browser/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const fixture = JSON.parse(await readFile('/fixtures.json', 'utf8'));
const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium', args:['--no-sandbox', '--disable-dev-shm-usage']});
const checks = [];
const base = 'http://localhost:8080/';
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log(`PASS ${name}`); };
async function go(page, hash, selector) {
  await page.goto(`${base}?disabled-actions=20261004${hash}`, {waitUntil:'domcontentloaded'});
  await page.waitForSelector(selector);
}
async function language(page, lang) {
  const actual = await page.evaluate(()=>document.documentElement.lang);
  if(actual !== lang) {
    await page.click(`button[aria-label="${lang === 'en' ? 'Switch to English' : 'التبديل إلى العربية'}"]`);
    await page.waitForFunction(lang=>document.documentElement.lang === lang, {}, lang);
  }
}
async function audit(page, name) {
  const result = await page.evaluate(()=>{
    const missing = [...document.querySelectorAll('button:disabled')].filter(b=>b.getClientRects().length).filter(b=>{
      const descriptions = (b.getAttribute('aria-describedby')||'').split(' ').map(id=>document.getElementById(id)).filter(Boolean);
      return !descriptions.some(e=>e.textContent.trim() && e.getClientRects().length);
    }).map(b=>b.textContent.trim());
    return {missing, overflow:document.documentElement.scrollWidth > window.innerWidth + 1};
  });
  check(`${name}: all disabled buttons have a visible accessible reason`,result.missing.length===0);
  check(`${name}: no horizontal overflow`,!result.overflow);
}
try {
  for (const role of ['STUDENT', 'ADMIN']) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({width:1280,height:900});
    const user = fixture.users.find(u=>u.role===role);
    await go(page,'#/login','#login-id');
    await page.type('#login-id',user.email);
    await page.type('#login-password',user.password);
    await page.click('form button[type="submit"]');
    await page.waitForSelector('[data-testid="header-logout"]');
    if(role==='STUDENT') {
      for(const lang of ['ar','en']) {
        await go(page,'#/practice','[data-testid="ide-stop"]');
        await language(page,lang);
        const stop = await page.$eval('[data-testid="ide-stop"]',b=>({disabled:b.disabled,reason:b.querySelector('[data-disabled-reason]')?.textContent}));
        check(`${lang}: stopped IDE explains Stop`,stop.disabled && (lang==='en' ? stop.reason.includes('Run your code first') : stop.reason.includes('شغّل الكود')));
        const clear = await page.$eval('[data-testid="ide-clear"]',b=>b.querySelector('[data-disabled-reason]')?.textContent);
        check(`${lang}: empty console explains Clear`,lang==='en' ? clear.includes('console is empty') : clear.includes('فارغة'));
        await audit(page,`${lang} desktop IDE`);
        await page.setViewport({width:360,height:800});
        await audit(page,`${lang} mobile IDE`);
        await page.screenshot({path:`/evidence/student-${lang}-mobile.png`,fullPage:true});
        await page.setViewport({width:1280,height:900});
        await go(page,'#/learn/fayq-learning-demo-20261004','[data-testid="previous-lesson"]');
        const previous = await page.$eval('[data-testid="previous-lesson"]',b=>({disabled:b.disabled,reason:b.querySelector('[data-disabled-reason]')?.textContent}));
        check(`${lang}: first-lesson Previous explains boundary`,previous.disabled && (lang==='en' ? previous.reason.includes('first lesson') : previous.reason.includes('أول درس')));
        await audit(page,`${lang} lesson navigation`);
        await go(page,'#/notifications','main h1');
        await audit(page,`${lang} notifications`);
      }
    } else {
      for(const lang of ['ar','en']) {
        await go(page,'#/admin/students','main h1');
        await language(page,lang);
        await page.waitForFunction(()=>[...document.querySelectorAll('button:disabled')].some(b=>b.querySelector('[data-disabled-reason]')));
        await audit(page,`${lang} student directory`);
        await go(page,'#/admin/practice','#student-search');
        await page.type('#student-search',fixture.users.find(u=>u.role==='STUDENT').email);
        await page.waitForSelector('main li button');
        await page.click('main li button');
        await page.waitForSelector('#quota-limit');
        await page.click('#quota-limit',{clickCount:3});
        await page.keyboard.press('Backspace');
        await page.waitForSelector('button:disabled [data-disabled-reason]');
        const reason = await page.$eval('button:disabled [data-disabled-reason]',e=>e.textContent);
        check(`${lang}: invalid allowance explains required whole number`,reason.includes('2147483647') || reason.includes('٢١٤٧٤٨٣٦٤٧'));
        await audit(page,`${lang} allowance editor`);
        await page.setViewport({width:360,height:800});
        await audit(page,`${lang} mobile allowance editor`);
        await page.screenshot({path:`/evidence/admin-${lang}-mobile.png`,fullPage:true});
        await page.type('#quota-limit','50');
        await page.waitForFunction(()=>!document.querySelector('[data-disabled-reason]'));
        check(`${lang}: explanation clears when the allowance input is valid`,await page.$$eval('button:disabled',buttons=>buttons.length===0));
        await page.setViewport({width:1280,height:900});
        await go(page,'#/admin/courses/d1cde073-59dc-4e8f-a185-e7dafbdae654','[data-testid="course-workspace-tabs"]');
        await page.waitForSelector('[data-testid="deletion-submit"]');
        await audit(page,`${lang} lesson ordering and deletion`);
        await page.setViewport({width:360,height:800});
        await audit(page,`${lang} mobile lesson ordering and deletion`);
        await page.setViewport({width:1280,height:900});
        await page.click('[data-testid="course-workspace-tabs"] button:nth-child(4)');
        await page.waitForSelector('[data-testid="course-readiness"]');
        await page.click('[data-testid="deletion-d1cde073-59dc-4e8f-a185-e7dafbdae654"] > summary');
        const removal = await page.$eval('[data-testid="deletion-submit"]',b=>({disabled:b.disabled,reason:b.querySelector('[data-disabled-reason]')?.textContent}));
        check(`${lang}: protected deletion explains exact confirmation`,removal.disabled && removal.reason.includes('fayq-learning-demo-20261004'));
        await audit(page,`${lang} course authoring`);
        await page.setViewport({width:360,height:800});
        await audit(page,`${lang} mobile course authoring`);
        await page.screenshot({path:`/evidence/admin-course-${lang}-mobile.png`,fullPage:true});
        await page.setViewport({width:1280,height:900});
      }
    }
    await page.click('[data-testid="header-logout"]');
    await page.waitForFunction(()=>!document.querySelector('[data-testid="header-logout"]'));
    await context.close();
  }
  await writeFile('/evidence/browser-result.json',JSON.stringify({passed:checks.length,checks},null,2));
  console.log(`Browser verification: ${checks.length} checks passed; no purchases, recharge decisions, quota saves, runs or submissions performed.`);
} finally { await browser.close(); }
