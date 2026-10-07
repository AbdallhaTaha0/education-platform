// Real Chromium, current UI/player; synthetic API/DASH transport. No external sends.
import puppeteer from '/srv/browser/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('/evidence',{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function chooseSpeed(page,rate){await page.click('[data-testid="player-speed"]');await page.click(`[data-testid="player-speed-${rate}"]`);}
async function chooseQuality(page,id){await page.click('[data-testid="player-quality"]');await page.click(`[data-testid="player-quality-${id}"]`);}
async function pageFor(lang,theme,width){
  const page=await browser.newPage(); await page.setViewport({width,height:950});
  await page.evaluateOnNewDocument((lang,theme)=>{localStorage.setItem('edu-platform-lang',lang);localStorage.setItem('edu-platform-theme',theme);},lang,theme);
  return page;
}
async function admin(page,host){
  await page.goto(`http://${host}:8080/#/login`);await page.waitForSelector('#login-id');
  await page.type('#login-id','admin.synthetic@m10a3.invalid');await page.type('#login-password','synthetic-password-not-real');
  await page.click('form button[type="submit"]');await page.waitForFunction(()=>location.hash.startsWith('#/account'));
  await page.goto(`http://${host}:8080/#/admin/courses/course-m10a3`);await page.waitForSelector('#course-workspace-tab-students');await page.click('#course-workspace-tab-students');
  await page.waitForSelector('[data-testid="select-student-student-active"]');await page.click('[data-testid="select-student-student-active"]');
  await page.waitForSelector('[data-testid="parent-report-workspace"]');
}
function ratio(a,b){
  const luminance=c=>{const rgb=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
try{
  const fresh=await browser.newPage();await fresh.goto('http://fayq-dark-player-web:8080/#/login');await fresh.waitForSelector('#login-id');assert.equal(await fresh.evaluate(()=>document.documentElement.dataset.theme),'dark');await fresh.close();const before=await pageFor('ar','dark',1280);await admin(before,'fayq-dark-player-before');
  await before.screenshot({path:'/evidence/before-admin-ar-dark.png',fullPage:true});await before.close();
  for(const [lang,theme,width] of [['ar','dark',1280],['en','dark',390],['ar','light',390],['en','light',1280],['ar','dark',320]]){
    const page=await pageFor(lang,theme,width);const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await admin(page,'fayq-dark-player-web');
    const colors=await page.evaluate(()=>{
      const field=document.querySelector('[data-testid="roster-search"]');const panel=document.querySelector('[data-testid="admin-course-roster"]');
      const f=getComputedStyle(field),p=getComputedStyle(panel),body=getComputedStyle(document.body),active=getComputedStyle(document.querySelector('[aria-selected="true"]'));
      return{field:f.backgroundColor,fieldText:f.color,fieldBorder:f.borderColor,panel:p.backgroundColor,canvas:body.backgroundColor,active:active.backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.notEqual(colors.field,colors.panel);assert.notEqual(colors.panel,colors.canvas);assert.equal(colors.overflow,false);
    assert.ok(ratio(colors.fieldText,colors.field)>=4.5);assert.ok(ratio(colors.fieldBorder,colors.field)>=3);
    await page.focus('[data-testid="roster-search"]');await page.keyboard.press('Tab');
    await page.screenshot({path:`/evidence/after-admin-${lang}-${theme}-${width}.png`,fullPage:true});
    await page.goto(`http://fayq-dark-player-web:8080/player-test.html?lang=${lang}&theme=${theme}`);
    await page.waitForSelector('[data-testid="player-settings"]');assert.equal(await page.$('[data-testid="player-speed"]'),null);await page.click('[data-testid="player-settings"]');await page.waitForFunction(()=>!document.querySelector('[data-testid="player-quality"]')?.disabled);await page.click('[data-testid="player-quality"]');assert.equal(await page.$$eval('.learning-player-settings__options button',buttons=>buttons.length),4);await page.click('[data-testid="player-settings-back"]');
    assert.equal(await page.$$eval('[data-testid="watermark-label"]',labels=>labels.length),1);
    await page.click('[data-testid="player-speed"]');assert.equal(await page.$eval('[data-testid="player-speed-1"]',el=>el.getAttribute('aria-pressed')),'true');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('video').playbackRate===1.25);await chooseSpeed(page,'1.5');await page.waitForFunction(()=>document.querySelector('video').playbackRate===1.5);
    await page.$eval('[data-testid="player-volume"]',input=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'0.35');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.waitForFunction(()=>Math.abs(document.querySelector('video').volume-.35)<.01&&!document.querySelector('video').muted);
    await page.keyboard.press('Escape');await page.click('[data-testid="player-mute"]');await page.waitForFunction(()=>document.querySelector('video').muted);
    await page.click('[data-testid="player-mute"]');await page.waitForFunction(()=>!document.querySelector('video').muted&&Math.abs(document.querySelector('video').volume-.35)<.01);
    await page.click('[data-testid="player-settings"]');await chooseQuality(page,'representation:hd');await page.waitForFunction(()=>window.__qualityChanges?.at(-1)?.id==='hd');
    assert.equal(await page.evaluate(()=>window.__settings.at(-1).streaming.abr.autoSwitchBitrate.video),false);await page.evaluate(()=>window.__activate());await page.click('[data-testid="player-quality"]');assert.equal(await page.$eval('[data-testid="player-quality-representation:hd"]',el=>el.getAttribute('aria-pressed')),'true');await page.click('[data-testid="player-settings-back"]');
    await chooseQuality(page,'auto');assert.equal(await page.evaluate(()=>window.__settings.at(-1).streaming.abr.autoSwitchBitrate.video),true);
    await page.evaluate(()=>window.__failQuality=true);await chooseQuality(page,'representation:full');
    await page.waitForFunction(()=>document.querySelector('[data-testid="player-quality"]')?.innerText.match(/Auto|تلقائي/));await page.evaluate(()=>window.__failQuality=false);await chooseQuality(page,'auto');
    await page.screenshot({path:`/evidence/settings-${lang}-${theme}-${width}.png`,fullPage:true});await page.click('[data-testid="player-speed"]');assert.ok(await page.evaluate(()=>{const panel=document.querySelector('[data-testid="player-settings-panel"]').getBoundingClientRect(),frame=document.querySelector('.learning-video-frame').getBoundingClientRect();return panel.top>=frame.top&&panel.bottom<=frame.bottom&&panel.left>=frame.left&&panel.right<=frame.right;}));await page.screenshot({path:`/evidence/speed-options-${lang}-${theme}-${width}.png`,fullPage:true});await page.click('[data-testid="player-settings-back"]');await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.waitForFunction(()=>!document.querySelector('[data-testid="player-settings-panel"]'));await page.click('[data-testid="player-settings"]');await page.keyboard.press('Escape');assert.equal(await page.$('[data-testid="player-speed"]'),null);const initial=await page.$eval('[data-testid="watermark-label"]',el=>[el.style.left,el.style.top]);
    if(theme==='dark'&&width===1280){await sleep(8200);assert.notDeepEqual(await page.$eval('[data-testid="watermark-label"]',el=>[el.style.left,el.style.top]),initial);}
    const bounded=await page.evaluate(()=>{
      const label=document.querySelector('[data-testid="watermark-label"]').getBoundingClientRect(),frame=document.querySelector('.learning-video-frame').getBoundingClientRect(),controls=document.querySelector('[data-testid="player-controls"]').getBoundingClientRect();
      return label.left>=frame.left&&label.right<=frame.right&&label.top>=frame.top&&label.bottom<=controls.top+1;
    });assert.ok(bounded,'Watermark must stay inside the frame above controls');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`/evidence/player-${lang}-${theme}-${width}.png`,fullPage:true});
    if(width===1280&&theme==='dark'){
      await page.click('[data-testid="player-fullscreen"]');await page.waitForFunction(()=>!!document.fullscreenElement||!!document.querySelector('.learning-video-frame--expanded'));
      await page.waitForSelector('[data-testid="watermark-label"]');await page.click('[data-testid="player-settings"]');await chooseSpeed(page,'2');
      assert.equal(await page.$eval('video',el=>el.playbackRate),2);await page.click('[data-testid="player-fullscreen"]');
    }
    await page.evaluate(()=>window.__mount(true));await page.waitForFunction(()=>document.querySelector('[data-testid="player-settings"]').disabled);
    assert.equal(await page.$('[data-testid="player-quality"]'),null);assert.equal(await page.$eval('[data-testid="player-volume"]',el=>el.disabled),true);
    assert.equal(await page.$$eval('[data-testid="watermark-label"]',labels=>labels.length),1);assert.deepEqual(errors,[]);
    results.push({lang,theme,width,colors,fieldTextContrast:ratio(colors.fieldText,colors.field),fieldBorderContrast:ratio(colors.fieldBorder,colors.field),player:'PASS'});await page.close();
  }
  await writeFile('/evidence/results.json',JSON.stringify({kind:'Actual UI/Player, synthetic API and DASH, real Chromium',results},null,2));console.log(`PASS ${results.length} bilingual/theme/viewport scenarios; speed, volume, quality/auto/error, single watermark bounds, timer, fullscreen, expiry.`);
}finally{await browser.close();}
