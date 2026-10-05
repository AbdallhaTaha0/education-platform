// Disposable identities only; modes-verify guards and cleans all resources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const fixture = JSON.parse(readFileSync('/evidence/fixtures.json','utf8'));
const host = (await lookup('nginx')).address;
const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',`--host-resolver-rules=MAP localhost ${host}`]});
let checks=0; const errors=[];
const pass=(name,ok=true)=>{assert(ok,name);checks++;console.log(`PASS ${name}`);};
async function pageFor(role){
  const context=await browser.createBrowserContext(),p=await context.newPage();
  await p.setViewport({width:1440,height:1100});p.on('pageerror',()=>errors.push(1));
  await p.evaluateOnNewDocument(()=>{if(window.top===window)localStorage.setItem('edu-platform-lang','en');});
  await p.goto('http://localhost:8080/#/login',{waitUntil:'networkidle2'});
  await p.type('#login-id',`modes-${role}@example.test`);await p.type('#login-password','synthetic modes password only');
  await p.click('form button[type=submit]');await p.waitForFunction(()=>location.hash==='#/account');return p;
}
async function route(p,hash){await p.goto('http://localhost:8080/'+hash,{waitUntil:'networkidle2'});}
async function text(p,selector,value){await p.click(selector,{clickCount:3});await p.keyboard.press('Backspace');await p.type(selector,value);}
try{
  const admin=await pageFor('admin');await admin.waitForSelector('[data-testid=admin-workspace]');
  pass('six clearly named dashboard groups and one active group',await admin.$$eval('[data-testid=admin-dashboard-tabs] a',links=>links.length===6&&links.filter(a=>a.getAttribute('aria-current')==='page').length===1&&links.some(a=>a.textContent.includes('Platform settings'))));
  pass('ADMIN has full-width workspace without duplicate sidebar',await admin.evaluate(()=>!document.querySelector('.workspace-sidebar')));
  for(const hash of ['#/admin/catalog','#/admin/packages','#/admin/students','#/admin/practice','#/admin/recharge','#/admin/support','#/admin/policies','#/admin','#/account/profile','#/notifications']){
    await route(admin,hash);await admin.waitForSelector('[data-testid=admin-workspace]');
    pass(`preserved destination ${hash}`,await admin.$$eval('[data-testid=admin-section-links] a',links=>links.some(a=>a.getAttribute('aria-current')==='page')));
  }
  await route(admin,`#/admin/courses/${fixture.courseId}`);await admin.waitForSelector('[data-testid=course-workspace-tabs]');
  pass('course editing has five named tabs and matching panels',await admin.evaluate(()=>document.querySelectorAll('[data-testid=course-workspace-tabs] [role=tab]').length===5&&[...document.querySelectorAll('[data-testid=course-workspace-tabs] [role=tab]')].every(tab=>document.getElementById(tab.getAttribute('aria-controls')))));
  await admin.click('#course-workspace-tab-details');await admin.waitForSelector('#cf-ta');await text(admin,'#cf-ta','Unsaved synthetic course title');
  admin.once('dialog',d=>d.dismiss());await admin.click('#course-workspace-tab-access');
  pass('cancelled course tab change retains unsaved details',await admin.$eval('#cf-ta',e=>e.value==='Unsaved synthetic course title'));
  admin.once('dialog',d=>d.dismiss());await admin.click('[data-testid=admin-dashboard-tabs] a[href="#/admin/recharge"]');
  await admin.waitForFunction(id=>location.hash===`#/admin/courses/${id}`,{},fixture.courseId);
  pass('global tab navigation honors unsaved course confirmation');
  admin.once('dialog',d=>d.accept());await admin.click('#course-workspace-tab-access');await admin.waitForSelector('#course-workspace-tab-access[aria-selected=true]');
  await admin.focus('#course-workspace-tab-access');await admin.keyboard.press('End');
  pass('course tabs support keyboard selection and clear dangerous-actions description',await admin.$eval('#course-workspace-panel-publish',e=>!e.hidden&&e.textContent.includes('permanent deletion')));
  await route(admin,'#/admin/recharge');await admin.waitForSelector('#instapay-account');
  pass('recharge review starts separately from receiving forms',await admin.evaluate(()=>!document.querySelector('#admin-payments-panel-review').hidden&&document.querySelector('#admin-payments-panel-instapay').hidden));
  await admin.focus('#admin-payments-tab-review');await admin.keyboard.press('ArrowRight');
  pass('English arrow keys open and focus InstaPay tab',await admin.evaluate(()=>document.activeElement.id==='admin-payments-tab-instapay'&&!document.querySelector('#admin-payments-panel-instapay').hidden));
  await text(admin,'#instapay-account','draft@synthetic');await admin.click('#admin-payments-tab-vodafone');await admin.click('#admin-payments-tab-instapay');
  pass('switching payment tabs preserves in-memory drafts',await admin.$eval('#instapay-account',e=>e.value==='draft@synthetic'));
  const unchanged=await admin.evaluate(async()=> (await (await fetch('/api/admin/payment-settings/instapay')).json()).data.accountLabel==='');pass('switching tabs never autosaves receiving details',unchanged);
  admin.once('dialog',d=>d.dismiss());await admin.click('[data-testid=admin-dashboard-tabs] a[href="#/admin/catalog"]');await admin.waitForFunction(()=>location.hash==='#/admin/recharge');
  pass('unsaved receiving details block unwanted route changes');
  await text(admin,'#instapay-account','');
  await admin.screenshot({path:'/evidence/admin-dashboard-desktop-en.png',fullPage:true});
  await admin.click('.language-tool');await admin.waitForFunction(()=>document.documentElement.dir==='rtl');
  await admin.setViewport({width:390,height:900});await admin.focus('#admin-payments-tab-instapay');await admin.keyboard.press('ArrowLeft');
  pass('Arabic arrow keys select the next tab in RTL',await admin.evaluate(()=>document.activeElement.id==='admin-payments-tab-vodafone'&&!document.querySelector('#admin-payments-panel-vodafone').hidden));
  pass('mobile Arabic dashboard has no horizontal overflow',await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  pass('Arabic labels distinguish settings and payment destinations',await admin.$eval('[data-testid=admin-workspace]',e=>e.textContent.includes('إعدادات المنصة')&&e.textContent.includes('بيانات استقبال فودافون كاش')));
  await admin.screenshot({path:'/evidence/admin-dashboard-mobile-ar.png',fullPage:true});
  const student=await pageFor('student');pass('student workspace remains unchanged and has no ADMIN tabs',await student.evaluate(()=>!!document.querySelector('.workspace-sidebar')&&!document.querySelector('[data-testid=admin-workspace]')));
  await route(student,'#/admin/recharge');pass('student cannot read ADMIN receiving settings',await student.evaluate(async()=> (await fetch('/api/admin/payment-settings/instapay')).status===403));
  pass('no browser errors',errors.length===0);console.log(`Admin dashboard checks=${checks} failed=0`);
}finally{await browser.close();}
