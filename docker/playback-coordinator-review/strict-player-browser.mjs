import puppeteer from '/srv/browser/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import assert from 'node:assert/strict';
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  const p=await browser.newPage();
  await p.setRequestInterception(true);
  p.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/mock-media/'))return;void req.continue();});
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await p.waitForSelector('[data-testid="player-toggle-playback"]');
  await p.evaluate(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Synthetic gesture denial','NotAllowedError'));};});
  await p.click('[data-testid="player-toggle-playback"]');
  await p.waitForFunction(()=>document.body.textContent.includes('Gesture required'),{timeout:5000});
  console.log('PASS actual player handles gesture rejection after StrictMode setup replay');
  await p.evaluate(()=>window.changeGrant('strict-two'));
  await p.waitForFunction(()=>!document.body.textContent.includes('Gesture required'));
  console.log('PASS new grant clears the previous gesture notice');
  await p.evaluate(()=>{HTMLMediaElement.prototype.play=function(){return new Promise((_,reject)=>{window.rejectOldPlay=reject;});};});
  await p.click('[data-testid="player-toggle-playback"]');
  await p.evaluate(()=>window.changeGrant('strict-three'));
  await p.waitForFunction(()=>document.querySelector('[data-reference-id]')?.getAttribute('data-reference-id')==='strict-three');
  await p.evaluate(()=>window.rejectOldPlay(new DOMException('Synthetic stale denial','NotAllowedError')));
  await new Promise(r=>setTimeout(r,150));
  assert.equal(await p.$eval('body',e=>e.textContent.includes('Gesture required')),false);
  console.log('PASS stale play rejection does not affect the new grant');
  await p.evaluate(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Synthetic unsupported media','NotSupportedError'));};});
  await p.click('[data-testid="player-toggle-playback"]');
  await p.waitForFunction(()=>document.querySelector('[data-testid="player-errors"]')?.textContent==='["UNSUPPORTED_PROVIDER"]');
  console.log('PASS actual player reports unsupported media after StrictMode replay');
}finally{await browser.close();}
