/** Test-only real Chromium UI verification, synthetic API; no WhatsApp traffic. */
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const dir = '/evidence';
await mkdir(dir, {recursive: true});
const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
async function click(page, selector) {
  await page.$eval(selector,el=>el.scrollIntoView({block:'center'}));
  await new Promise(resolve=>setTimeout(resolve,100));
  await page.click(selector);
}
try {
  for(const [lang,width,theme] of [['ar',1280,'light'],['ar',390,'dark'],['en',1280,'dark'],['en',390,'light']]) {
    const page=await browser.newPage();
    await page.setViewport({width,height:950});
    const requests=[];
    page.on('request',r=>{if(r.url().includes('/api/admin/')) requests.push({url:r.url(),body:r.postData()});});
    await page.setRequestInterception(true);
    page.on('request',r=>{if(/^https:\/\/(wa\.me|.*whatsapp\.com)/.test(r.url())) void r.abort(); else void r.continue();});
    await page.evaluateOnNewDocument((lang,theme)=>{
      localStorage.setItem('edu-platform-lang',lang);localStorage.setItem('edu-platform-theme',theme);
      window.__handoffs=[];
      window.open=()=>({opener:null,location:{set href(value){window.__handoffs.push(value);}},focus(){},close(){}});
    },lang,theme);
    await page.goto('http://m10-compact-ui-web:8080/#/login');
    await page.waitForSelector('#login-id');
    await page.type('#login-id','admin.synthetic@m10a3.invalid');
    await page.type('#login-password','synthetic-password-not-real');
    await page.click('form button[type="submit"]');
    await page.waitForFunction(()=>location.hash.startsWith('#/account'));
    await page.goto('http://m10-compact-ui-web:8080/#/admin/courses/course-m10a3');
    await page.waitForSelector('#course-workspace-tab-students');
    await page.click('#course-workspace-tab-students');
    await page.waitForSelector('[data-testid="select-student-student-active"]');
    await page.click('[data-testid="select-student-student-active"]');
    await page.waitForSelector('[data-testid="parent-report-workspace"]');
    assert.equal(await page.$('[data-testid="admin-student-views"]'),null);
    assert.equal(await page.$('[data-testid="generate-report"]'),null);
    assert.equal(await page.$('[data-testid="report-format"]'),null);
    assert.equal(requests.some(r=>r.url.includes('/views')),false);
    assert.ok(await page.$eval('[data-testid="roster-list"]',el=>el.getBoundingClientRect().height<=322));
    assert.ok(await page.$eval('[data-testid="select-student-student-active"]',el=>el.getBoundingClientRect().height<110));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(await page.$('[data-testid="report-opened-student-active"]'),null);
    await page.evaluate(()=>{window.open=()=>null;});
    await click(page,'[data-testid="generate-and-open-whatsapp"]');
    await page.waitForSelector('[data-testid="copy-part-1"]');
    assert.equal(await page.$('[data-testid="report-opened-student-active"]'),null);
    await click(page,'[data-testid="dispose-report"]');
    await page.evaluate(()=>{
      window.open=()=>({opener:null,location:{set href(value){window.__handoffs.push(value);}},focus(){},close(){}});
    });
    await page.$eval('[data-testid="admin-course-students"]',el=>el.scrollIntoView({block:'start'}));
    await page.screenshot({path:dir+'/'+lang+'-'+width+'-'+theme+'.png'});
    for(const reportType of ['WEEK','TWO_WEEKS','FOUR_WEEKS']) {
      await page.select('[data-testid="report-type-picker"]',reportType);
      const prior=await page.evaluate(()=>window.__handoffs.length);
      await click(page,'[data-testid="generate-and-open-whatsapp"]');
      await page.waitForFunction(n=>window.__handoffs.length>n,{timeout:10000},prior).catch(async error => {
        console.log(JSON.stringify({lang,width,reportType,state:await page.evaluate(()=>({note:document.querySelector('[data-testid="handoff-note"]')?.textContent,parts:!!document.querySelector('[data-testid="report-parts"]'),button:document.querySelector('[data-testid="generate-and-open-whatsapp"]')?.outerHTML}))}));
        throw error;
      });
      const req=requests.filter(r=>r.url.includes('/parent-reports/generate')).at(-1);
      const body=JSON.parse(req.body);
      assert.equal(body.format,'SHORT');assert.equal(body.reportType,reportType);
      assert.deepEqual(body.courseIds,['course-m10a3']);
      await page.waitForFunction(()=>!document.querySelector('[data-testid="report-text-1"]'));
      await page.waitForSelector('[data-testid="report-opened-student-active"]');
    }
    await click(page,'[data-testid="select-student-student-quiet"]');
    await page.waitForFunction(()=>document.querySelector('[data-testid="select-student-student-quiet"]')?.getAttribute('aria-pressed')==='true');
    assert.equal(await page.$('[data-testid="report-opened-student-quiet"]'),null);
    assert.ok(await page.$('[data-testid="report-opened-student-active"]'));
    assert.equal(await page.$eval('[data-testid="generate-and-open-whatsapp"]',el=>el.disabled),true);
    await click(page,'[data-testid="select-student-student-active"]');
    await page.waitForFunction(()=>document.querySelector('[data-testid="select-student-student-active"]')?.getAttribute('aria-pressed')==='true');
    await page.evaluate(()=>{window.open=()=>null;});
    await click(page,'[data-testid="generate-and-open-whatsapp"]');
    await page.waitForSelector('[data-testid="copy-part-1"]');
    assert.ok(await page.$('[data-testid="manual-open-part-1"]'));
    await page.click('[data-testid="dispose-report"]');
    assert.equal(await page.$('[data-testid="report-text-1"]'),null);
    results.push({lang,width,theme,pass:true});
    await page.close();
  }
  console.log(JSON.stringify(results));
  await writeFile(dir+'/results.json',JSON.stringify(results,null,2));
} finally {await browser.close();}
