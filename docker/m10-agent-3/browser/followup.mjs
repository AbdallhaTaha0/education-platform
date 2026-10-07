import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const base = process.env.BASE_URL ?? 'http://web:8080';
const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium',headless:true,protocolTimeout:15000,args:['--no-sandbox','--disable-dev-shm-usage'] });
const results = [];
let navigation = [];
async function intercept(page) {
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().startsWith('https://wa.me/')) { navigation.push(req.url()); void req.respond({status:204}); }
    else void req.continue();
  });
}
browser.on('targetcreated', async target => { if(target.type()==='page'){const page=await target.page();if(page)await intercept(page).catch(()=>{});} });
async function click(page, selector) { process.stdout.write('click '+selector+'\n'); await page.bringToFront(); await page.waitForSelector(selector); await page.$eval(selector, n=>n.scrollIntoView({block:'center'})); await page.click(selector); await page.bringToFront(); }
async function setup(mobile=false) {
  navigation=[];
  const page = await browser.newPage();
  if(mobile) await page.setUserAgent('Mozilla/5.0 iPhone Mobile Safari');
  await page.setViewport({width:mobile?390:1280,height:900});
  await page.goto(`${base}/#/login`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#login-id'); await new Promise(r=>setTimeout(r,250));
  await page.type('#login-id','admin.synthetic@m10a3.invalid');await page.type('#login-password','synthetic-password-not-real');
  await click(page,'form button[type=submit]');
  await page.waitForFunction(()=>location.hash.startsWith('#/account'));
  await page.goto(`${base}/#/admin/courses/course-m10a3`,{waitUntil:'domcontentloaded'});
  await click(page,'#course-workspace-tab-students');
  await click(page,'[data-testid="select-student-student-active"]');
  return page;
}
async function preview(page) {await click(page,'[data-testid=generate-report]');await page.waitForSelector('[data-testid=report-text-1]');await new Promise(r=>setTimeout(r,250));}
async function check(name, action) {try{await action();results.push({name,status:'PASS'});process.stdout.write('PASS '+name+'\n');}catch(e){results.push({name,status:'FAIL',error:e.message});process.stdout.write('FAIL '+name+': '+e.message+'\n');}}
const desktop=await setup();
await check('late contact response after cancel cannot navigate, restore text or leave a reserved window',async()=>{
  await preview(desktop);
  const before=browser.targets().filter(target=>target.type()==='page').length;
  await desktop.evaluate(()=>{window.popupClosed=0;window.popupNavigated=0;window.open=()=>({location:{set href(value){window.popupNavigated++;}},close(){window.popupClosed++;},opener:null});});
  await desktop.evaluate(()=>{window.originalFetch=window.fetch;window.fetch=async(...args)=>{const response=await window.originalFetch(...args);if(String(args[0]).includes('report-contact'))await new Promise(r=>setTimeout(r,900));return response;};});
  await click(desktop,'[data-testid=open-part-1]');await click(desktop,'[data-testid=dispose-report]');
  await new Promise(r=>setTimeout(r,1400));
  assert.equal(navigation.length,0);assert.equal(await desktop.$('[data-testid=report-text-1]'),null);
  assert.equal(await desktop.evaluate(()=>window.popupNavigated),0);
  assert.equal(await desktop.evaluate(()=>window.popupClosed),1);
  assert.equal(browser.targets().filter(target=>target.type()==='page').length,before);
  await desktop.evaluate(()=>window.fetch=window.originalFetch);
});
await check('manual fallback rechecks changed registered contact and opens no old recipient',async()=>{
  await preview(desktop);
  await desktop.evaluate(()=>{window.originalFetch=window.fetch;window.fetch=async(...args)=>String(args[0]).includes('report-contact')?new Response(JSON.stringify({data:{phone:'+201001234569'}}),{status:200,headers:{'Content-Type':'application/json'}}):window.originalFetch(...args);});
  await click(desktop,'[data-testid=manual-open-part-1]');
  await desktop.waitForFunction(()=>document.querySelector('[data-testid=report-error-code]')?.textContent==='CONTACT_CHANGED');
  assert.equal(navigation.length,0);assert.equal(await desktop.$('[data-testid=report-text-1]'),null);
  await desktop.evaluate(()=>window.fetch=window.originalFetch);
});
await check('cancel while clipboard is pending does not resurrect the copied notice',async()=>{
  await preview(desktop);
  await desktop.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise(r=>window.finishCopy=r)}}));
  await click(desktop,'[data-testid=copy-part-1]');await click(desktop,'[data-testid=dispose-report]');await desktop.evaluate(()=>window.finishCopy());
  await new Promise(r=>setTimeout(r,100));assert.equal(await desktop.$('[data-testid=handoff-note]'),null);
});
await desktop.close();
const mobile=await setup(true);
await check('mobile Generate and open navigates encoded Arabic text then disposes the report and recipient',async()=>{
  await click(mobile,'[data-testid=generate-and-open-whatsapp]');
  await mobile.waitForSelector('[data-testid=report-part-disposed-1]');
  assert.equal(navigation.length,1);
  const url=new URL(navigation[0]);assert.equal(url.pathname,'/201001234567');assert.ok(url.searchParams.get('text').includes('تقرير ولي الأمر'));
  assert.equal(await mobile.$('[data-testid=report-text-1]'),null);
  assert.ok(!(await mobile.$eval('[data-testid=report-recipient]',n=>n.textContent)).includes('567'));
});
await check('handoff data does not persist in browser storage',async()=>{
  const storage=await mobile.evaluate(()=>({local:Object.entries(localStorage),session:Object.entries(sessionStorage)}));
  assert.equal(storage.session.length,0);for(const [key,value] of storage.local){assert.ok(['edu-platform-theme','edu-platform-lang'].includes(key));assert.ok(!value.includes('wa.me')&&!value.includes('FAYQ'));}
});
await writeFile('/evidence/followup-results.json',JSON.stringify(results,null,2));
process.stdout.write(JSON.stringify(results,null,2)+'\n');
browser.process()?.kill('SIGTERM');
await Promise.race([browser.close().catch(()=>{}),new Promise(r=>setTimeout(r,3000))]);
process.exit(results.some(r=>r.status==='FAIL')?1:0);
