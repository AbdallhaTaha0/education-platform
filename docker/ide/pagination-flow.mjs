import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const host=(await lookup('nginx')).address, fixtures=JSON.parse(readFileSync('/evidence/fixtures.json','utf8'));
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',`--host-resolver-rules=MAP localhost ${host}`]});
let checks=0;const errors=[];
const pass=(name,value=true)=>{assert(value,name);checks++;console.log('PASS '+name);};
async function click(page,selector){await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.click(selector);}
async function open(page,hash){await page.goto('http://localhost:8080/'+hash,{waitUntil:'networkidle2'});}
async function login(role){const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width:1280,height:900});page.on('pageerror',e=>errors.push(e.message));await page.evaluateOnNewDocument(()=>localStorage.setItem('edu-platform-lang','en'));await open(page,'#/login');await page.type('#login-id',`modes-${role}@example.test`);await page.type('#login-password','synthetic modes password only');await page.click('form button[type=submit]');await page.waitForFunction(()=>location.hash==='#/account');return page;}
async function chooseStatus(page,text){await page.evaluate(text=>[...document.querySelectorAll('[role=group] button')].find(b=>b.textContent.trim()===text)?.click(),text);await page.waitForNetworkIdle();}
async function pageRows(page){return page.$$eval('main ul > li',rows=>rows.map(r=>r.textContent));}
try{
 const admin=await login('admin');await open(admin,'#/admin/recharge');await admin.waitForSelector('[data-testid=pagination-admin-requests]');await chooseStatus(admin,'Rejected');
 const rows=await pageRows(admin);pass('Rejected requests render 10 rows',rows.length===10);
 const nav='[data-testid=pagination-admin-requests]';await click(admin,nav+' [data-testid=page-next]');await admin.waitForNetworkIdle();const next=await pageRows(admin);pass('Next page is distinct',next.length===10&&next.every(r=>!rows.includes(r)));
 await click(admin,nav+' [data-testid=page-previous]');await admin.waitForNetworkIdle();pass('Previous restores the same stable page',JSON.stringify(await pageRows(admin))===JSON.stringify(rows));
 await admin.select(nav+' select','50');await admin.waitForNetworkIdle();pass('Page-size selection renders 50 rows',(await pageRows(admin)).length===50);
 await click(admin,nav+' [data-testid=page-next]');await admin.waitForNetworkIdle();await click(admin,nav+' [data-testid=page-next]');await admin.waitForNetworkIdle();pass('Records beyond old 100 cap are reachable',(await pageRows(admin)).length===5);
 await chooseStatus(admin,'Approved');pass('Changing status resets page and isolates approved rows',(await pageRows(admin)).length===25);
 await admin.select(nav+' select','10');await admin.waitForNetworkIdle();pass('Approved requests are paginated',(await pageRows(admin)).length===10);
 await admin.type('#recharge-request-search','PAGEFIXTURE129');await admin.waitForNetworkIdle();pass('Search covers all pages',(await pageRows(admin)).length===1&&(await pageRows(admin))[0].includes('PAGEFIXTURE129'));
 await open(admin,'#/admin/catalog');await admin.waitForSelector('[data-testid=paged-list-admin-courses]');pass('ADMIN course cards are bounded',await admin.$$eval('[data-testid=paged-list-admin-courses] > *',r=>r.length===10));
 await click(admin,'[data-testid=pagination-admin-courses] [data-testid=page-next]');await admin.type('#admin-search','Pagination course 0');await admin.waitForFunction(()=>document.querySelector('[data-testid=paged-list-admin-courses]').children.length===1);pass('Course filtering resets a later page');
 await open(admin,`#/admin/courses/${fixtures.courseId}`);await admin.waitForSelector('[data-testid=paged-list-course-sections]');pass('Course sections are paginated',await admin.$$eval('[data-testid=paged-list-course-sections] > *',r=>r.length===10));pass('Lesson editors mount only one page',await admin.$$eval('[data-testid^=paged-list-lessons-]:first-of-type > li',r=>r.length<=10));
 await open(admin,'#/admin/students');await admin.waitForSelector('main ul li');pass('Student directory keeps server cursor paging',await admin.$$eval('main ul > li',r=>r.length===10));
 await open(admin,'#/admin/practice');await admin.waitForSelector('[data-testid=pagination-practice-students]');await admin.waitForNetworkIdle();pass('Practice student list is bounded',await admin.$$eval('main ul > li',r=>r.length===10));
 const student=await login('student');await open(student,'#/wallet');await student.waitForSelector('[data-testid=pagination-wallet-requests]');await student.waitForFunction(()=>!document.querySelector('[data-testid=pagination-wallet-requests] select').disabled);pass('STUDENT recharge history is bounded',(await pageRows(student)).length===10);await click(student,'[data-testid=pagination-wallet-requests] [data-testid=page-next]');await student.waitForNetworkIdle();pass('STUDENT history next page stays usable',(await pageRows(student)).length===10);
 await open(student,'#/purchases');await student.waitForSelector('[data-testid=pagination-course-receipts]');pass('Course receipt history is paginated',await student.$$eval('main ul > li',r=>r.length===10));
 await open(student,'#/courses');await student.waitForSelector('[data-testid=pagination-public-courses]');pass('Public course catalog is paginated',await student.$$eval('[data-testid=paged-list-public-courses] > *',r=>r.length===10));
 await student.setViewport({width:390,height:844});pass('Mobile paging does not overflow',await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await click(student,'.language-tool');await student.waitForFunction(()=>document.documentElement.dir==='rtl');await student.waitForSelector('[data-testid=pagination-public-courses]');pass('Arabic paging remains RTL without overflow',await student.evaluate(()=>document.documentElement.dir==='rtl'&&document.documentElement.scrollWidth<=innerWidth+1));pass('No browser exceptions',errors.length===0);console.log(`Pagination browser checks=${checks} failed=0`);
}finally{await browser.close();}
