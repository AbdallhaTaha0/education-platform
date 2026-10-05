import assert from 'node:assert/strict';
import {lookup} from 'node:dns/promises';
import puppeteer from 'puppeteer-core';
const host=(await lookup('nginx')).address;
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',`--host-resolver-rules=MAP localhost ${host}`]});
const scope='[role=tabpanel]:not([hidden])';let checks=0;const pass=(name,ok=true)=>{assert(ok,name);checks++;console.log(`PASS ${name}`);};
const samples=[
 ['web','HTML','html','<!-- A profile card -->\n<section class="card" id="profile">\n  <h1>Hello!</h1>\n  <button disabled>Welcome</button>\n</section>'],
 ['web','CSS','css','/* Responsive card */\n.card:hover {\n  color: #ffffff;\n  margin: 12px;\n  display: grid;\n}\n@media (min-width: 600px) {\n  .card { padding: 20px; }\n}'],
 ['python',null,'python','# A friendly Python example\ndef greet(name):\n    message = "Hello, " + name\n    print(message)\n    return 42 if True else 0\ngreet("FAYQ")'],
 ['javascript',null,'javascript','// Existing JavaScript colors\nfunction greet(name) {\n  const count = 42;\n  console.log("Hello", name);\n  return count;\n}'],
];
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',()=>errors.push(1));await page.setViewport({width:1440,height:1000});await page.evaluateOnNewDocument(()=>{if(window.top===window)localStorage.setItem('edu-platform-lang','en');});await page.goto('http://localhost:8080/#/login',{waitUntil:'networkidle2'});await page.type('#login-id','modes-student@example.test');await page.type('#login-password','synthetic modes password only');await page.click('form button[type=submit]');await page.waitForFunction(()=>location.hash==='#/account');await page.goto('http://localhost:8080/#/practice');await page.waitForSelector('[data-testid=ide-mode-web]');
 for(const theme of ['dark','light']){
  if(await page.$eval('html',e=>e.dataset.theme)!==theme){await page.click('header button[aria-pressed]');await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,{},theme);}
  for(const [mode,file,language,source]of samples){
   await page.click(`[data-testid=ide-mode-${mode}]`);
   if(file){await page.waitForFunction(({scope,file})=>[...document.querySelector(scope).querySelectorAll('[role=tab]')].some(b=>b.textContent===file),{},{scope,file});await page.evaluate(({scope,file})=>[...document.querySelector(scope).querySelectorAll('[role=tab]')].find(b=>b.textContent===file).click(),{scope,file});}
   const editor=`${scope} [data-ide-language="${language}"]`;await page.waitForSelector(`${editor} .cm-content`);await page.click(`${editor} .cm-content`);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.sendCharacter(source);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const evidence=await page.$eval(editor,e=>{
    const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    const backgrounds=[getComputedStyle(e).backgroundColor,getComputedStyle(e.querySelector('.cm-activeLine')).backgroundColor];
    const spans=[...e.querySelectorAll('.cm-line span')].filter(s=>s.textContent.trim()).map(s=>({text:s.textContent,color:getComputedStyle(s).color}));
    const contrast=spans.every(s=>backgrounds.every(bg=>{const a=luminance(s.color),b=luminance(bg);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;}));
    return {spans,contrast,colors:new Set(spans.map(s=>s.color)).size};
   });
   pass(`${language} ${theme} has distinct syntax categories`,evidence.colors>=4);pass(`${language} ${theme} tokens meet 4.5 contrast on normal and active lines`,evidence.contrast);
   const find=text=>evidence.spans.find(s=>s.text===text)?.color;
   if(language==='html')pass(`HTML ${theme} tags and attributes have different colors`,!!find('section')&&!!find('class')&&find('section')!==find('class'));
   if(language==='css')pass(`CSS ${theme} selectors and properties have different colors`,!!find('card')&&!!find('color')&&find('card')!==find('color'));
   if(language==='python')pass(`Python ${theme} keywords and function names have different colors`,!!find('def')&&!!find('greet')&&find('def')!==find('greet'));
   await page.click(`${editor} .cm-content`);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const selection=await page.$eval(editor,e=>{
    const background=getComputedStyle(e.querySelector('.cm-selectionBackground')).backgroundColor;
    const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    const spans=[...e.querySelectorAll('.cm-line span')].filter(s=>s.textContent.trim());
    return {contrast:spans.every(s=>{const a=luminance(getComputedStyle(s,'::selection').color),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;}),nativeColor:spans.every(s=>getComputedStyle(s,'::selection').color===getComputedStyle(e).color)};
   });
   if(!selection.nativeColor||!selection.contrast)console.log('Selection diagnostic',language,theme,selection);
   pass(`${language} ${theme} selection uses readable theme ink`,selection.nativeColor&&selection.contrast);
   await page.keyboard.press('ArrowLeft');
   await page.$eval(editor,e=>e.scrollIntoView({block:'center'}));
   const drag=await page.$eval(editor,e=>{
    const node=e.querySelector('.cm-line span').firstChild;
    const from=2,to=Math.min(12,node.textContent.length);
    const point=offset=>{const r=document.createRange();r.setStart(node,offset);r.collapse(true);const b=r.getBoundingClientRect();return{x:b.x,y:b.y+b.height/2};};
    return {start:point(from),end:point(to),text:node.textContent.slice(from,to)};
   });
   await page.mouse.move(drag.start.x,drag.start.y);await page.mouse.down();await page.mouse.move(drag.end.x,drag.end.y,{steps:12});await page.mouse.up();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const draggedText=await page.evaluate(()=>window.getSelection()?.toString());
   if(draggedText!==drag.text)console.log('Mouse selection diagnostic',{expected:drag.text,actual:draggedText});
   await page.screenshot({path:`/evidence/mouse-selection-${language}-${theme}.png`});
   pass(`${language} ${theme} mouse drag selects part of one line`,draggedText===drag.text);
   pass(`${language} ${theme} mouse selection has a visible background`,await page.$eval(editor,e=>{const node=e.querySelector('.cm-line span');return getComputedStyle(node,'::selection').backgroundColor===getComputedStyle(e.querySelector('.cm-selectionBackground')).backgroundColor;}));
   if(language!=='javascript'){await page.$eval(editor,e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:`/evidence/syntax-${language}-${theme}.png`});}
  }
 }
 pass('theme changes do not use Runs',await page.evaluate(async()=>{const r=await fetch('/api/assessments/practice',{credentials:'include'});return(await r.json()).data.quota.used===0;}));pass('no browser errors',errors.length===0);console.log(`Syntax theme checks=${checks} failed=0`);
}finally{await browser.close();}
