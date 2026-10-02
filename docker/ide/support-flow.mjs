/** Support settings proof in the guarded disposable UI project, never owner data. */
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {lookup} from 'node:dns/promises';
const host=(await lookup('host.docker.internal')).address;
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',`--host-resolver-rules=MAP localhost ${host}`]});
const contexts=[];const errors=[];let checks=0;
const pass=(name,condition=true)=>{assert(condition,name);checks++;console.log(`PASS ${name}`);};
async function page(){const c=await browser.createBrowserContext();contexts.push(c);const p=await c.newPage();await p.setViewport({width:1280,height:900});p.on('pageerror',e=>errors.push(e.message));await p.evaluateOnNewDocument(()=>localStorage.setItem('edu-platform-lang','en'));return p;}
async function route(p,hash){const url='http://localhost:8084/'+hash;if(p.url()===url)await p.reload();else await p.goto(url);}
async function login(p,email){await route(p,'#/login');await p.waitForSelector('#login-id');await p.type('#login-id',email);await p.type('#login-password','m9 fixture password twelve words');await p.click('form button[type="submit"]');await p.waitForFunction(()=>location.hash==='#/account');}
async function set(p,selector,value){await p.$eval(selector,(f,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f,v);f.dispatchEvent(new Event('input',{bubbles:true}));},value);}
try{
  const guest=await page();await route(guest,'#/support');await guest.waitForSelector('[data-testid="public-support-contact"]');
  pass('anonymous help shows the supplied email and normalized Egyptian phone',await guest.$eval('[data-testid="public-support-contact"]',e=>e.textContent.includes('aliibrahim3600@gmail.com')&&e.textContent.includes('+201062419263')));
  pass('contact links use mailto and tel without sending messages',await guest.$eval('[data-testid="public-support-contact"]',e=>e.querySelector('a[href^="mailto:"]').getAttribute('href')==='mailto:aliibrahim3600%40gmail.com'&&e.querySelector('a[href^="tel:"]').getAttribute('href')==='tel:+201062419263'));
  const admin=await page();await login(admin,'m9-admin@example.test');await route(admin,'#/admin/support');await admin.waitForSelector('#support-email');
  pass('admin settings load the persisted contacts',await admin.$eval('#support-email',e=>e.value==='aliibrahim3600@gmail.com'));
  pass('support settings are discoverable in admin navigation',!!await admin.$('nav a[href="#/admin/support"]'));
  await set(admin,'#support-email','updated-support@example.test');let dialogs=0;const cancel=async d=>{dialogs++;await d.dismiss();};admin.on('dialog',cancel);await admin.$eval('nav a[href="#/admin/catalog"]',e=>e.click());await admin.waitForFunction(()=>location.hash==='#/admin/support');
  pass('cancelled navigation preserves edited contact fields',dialogs===1&&await admin.$eval('#support-email',e=>e.value==='updated-support@example.test'));admin.off('dialog',cancel);
  await set(admin,'#support-phone','invalid-number');await admin.click('[data-testid="support-settings"] button[type="submit"]');await admin.waitForFunction(()=>document.querySelector('[data-testid="error-feedback-stack"]')?.textContent.includes('Could not save'));
  pass('invalid phone gives a visible popup without clearing edited data',await admin.$eval('#support-phone',e=>e.value==='invalid-number'));
  await set(admin,'#support-phone','01062419263');await admin.click('[data-testid="support-settings"] button[type="submit"]');await admin.waitForFunction(()=>document.querySelector('main')?.textContent.includes('Support details saved'));
  pass('successful save normalizes the phone and shows confirmation',await admin.$eval('#support-phone',e=>e.value==='+201062419263'));
  await route(guest,'#/support');await guest.waitForFunction(()=>document.querySelector('[data-testid="public-support-contact"]')?.textContent.includes('updated-support@example.test'));pass('public help immediately reads admin changes without rebuilding');
  await route(admin,'#/admin/support');await admin.waitForFunction(()=>document.querySelector('#support-email')?.value==='updated-support@example.test');pass('contacts survive a complete admin page reload');
  await admin.screenshot({path:'/evidence/support-settings-en.png'});
  await guest.click('[aria-label="التبديل إلى العربية"]');await guest.setViewport({width:390,height:844});pass('Arabic support fits a narrow viewport with readable LTR contacts',await guest.evaluate(()=>document.documentElement.dir==='rtl'&&document.documentElement.scrollWidth<=innerWidth));await guest.screenshot({path:'/evidence/support-help-ar-mobile.png'});
  const student=await page();await login(student,'m9-student@example.test');await route(student,'#/admin/support');await student.waitForFunction(()=>document.body.textContent.includes('ADMIN only'));pass('student cannot open contact editing fields',!await student.$('#support-email'));
  pass('no browser exceptions on the new support flow',errors.length===0);console.log(`Support browser checks=${checks} failed=0`);
}catch(e){console.error(e.stack);process.exitCode=1;for(const c of contexts)for(const p of await c.pages())console.error('PAGE',p.url(),await p.evaluate(()=>document.querySelector('main')?.textContent?.slice(0,1600)));}
finally{for(const c of contexts)await c.close();await browser.close();}
