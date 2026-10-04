// Focused reversible UI checks; no Runs, submissions or private solutions.
import assert from 'node:assert/strict';
import {lookup} from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const host=(await lookup('nginx')).address;
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',`--host-resolver-rules=MAP localhost ${host}`]});
let checks=0;const pass=(name,ok=true)=>{assert(ok,name);checks++;console.log(`PASS ${name}`);};
try{
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});const errors=[];page.on('pageerror',()=>errors.push(1));
 await page.evaluateOnNewDocument(()=>{if(window.top===window)localStorage.setItem('edu-platform-lang','en');});
 await page.goto('http://localhost:8080/#/login',{waitUntil:'networkidle2'});await page.type('#login-id','modes-student@example.test');await page.type('#login-password','synthetic modes password only');await page.click('form button[type=submit]');await page.waitForFunction(()=>location.hash==='#/account');
 await page.goto('http://localhost:8080/#/practice');const active='[role=tabpanel]:not([hidden])';await page.waitForSelector(`${active} .cm-content`);
 for(const mode of ['javascript','web','python']){
  await page.click(`[data-testid=ide-mode-${mode}]`);
  const badge=await page.$eval(`${active} .ide-language`,e=>({bg:getComputedStyle(e).backgroundColor,ink:getComputedStyle(e).color}));
  const expected={javascript:'rgb(247, 223, 30)',web:'rgb(154, 52, 18)',python:'rgb(48, 105, 152)'};
  pass(`${mode} has its own meaningful badge color`,badge.bg===expected[mode]);
  const channels=s=>s.match(/\d+/g).slice(0,3).map(Number).map(n=>{const c=n/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;});
  const lum=s=>channels(s).reduce((n,c,i)=>n+c*[0.2126,0.7152,0.0722][i],0);const a=lum(badge.bg),b=lum(badge.ink);
  pass(`${mode} badge text has accessible contrast`,(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=4.5);
  for(const file of mode==='web'?['HTML','CSS','JavaScript']:['source']){
   if(mode==='web')await page.evaluate(({active,file})=>[...document.querySelector(active).querySelectorAll('[role=tab]')].find(b=>b.textContent===file).click(),{active,file});
   const editor=`${active} .cm-content`;await page.click(editor);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type('alpha\nbeta');
   await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Tab');
   const text=()=>page.$$eval(`${editor} .cm-line`,a=>a.map(e=>e.textContent));const spaces=mode==='python'?'    ':'  ';
   pass(`${mode} ${file} Tab indents selected lines`,(await text()).every(line=>line.startsWith(spaces)));
   await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');
   pass(`${mode} ${file} Shift Tab restores indentation`,JSON.stringify(await text())===JSON.stringify(['alpha','beta']));
   await page.keyboard.press('ArrowRight');await page.keyboard.press('Home');await page.keyboard.press('Tab');
   pass(`${mode} ${file} Tab indents current line`,(await text())[1].startsWith(spaces));
   await page.keyboard.press('Escape');await page.keyboard.press('Tab');
   pass(`${mode} ${file} Escape Tab exits editor`,await page.$eval(editor,e=>document.activeElement!==e));
  }
  await page.screenshot({path:`/evidence/editor-${mode}-indent.png`,fullPage:true});
 }
 pass('editor changes do not consume practice allowance',await page.evaluate(async()=>{const r=await fetch('/api/assessments/practice',{credentials:'include'});return(await r.json()).data.quota.used===0;}));
 pass('no browser runtime errors',errors.length===0);console.log(`Editor keyboard/color checks=${checks} failed=0`);
}finally{await browser.close();}
