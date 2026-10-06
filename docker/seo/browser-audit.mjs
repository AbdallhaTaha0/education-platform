import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://fayq-seo-edge:8080';
const out=process.env.EVIDENCE_DIR||'/srv/browser/evidence';
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const results={synthetic:true,base,crawl:[],browser:[],checks:[]};
try {
 const sitemap=await fetch(base+'/sitemap.xml').then(r=>{assert.equal(r.status,200);return r.text()});
 const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 assert.equal(new Set(urls).size,urls.length);assert.equal(urls.length,34);
 assert.match(await fetch(base+'/robots.txt').then(r=>r.text()),/Sitemap: https:\/\/seo.example.test\/sitemap.xml/);
 const raw=await browser.newPage();await raw.setJavaScriptEnabled(false);
 const discovered=new Set();
 for(const url of urls){
  const path=new URL(url).pathname+new URL(url).search;
  const response=await raw.goto(base+path,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,path);
  const data=await raw.evaluate(()=>({title:document.title,description:document.querySelector('meta[name=description]')?.content,h1:[...document.querySelectorAll('h1')].map(x=>x.textContent),canonical:document.querySelector('link[rel=canonical]')?.href,robots:document.querySelector('meta[name=robots]')?.content,lang:document.documentElement.lang,dir:document.documentElement.dir,alternates:[...document.querySelectorAll('link[hreflang]')].map(x=>[x.hreflang,x.href]),schemas:[...document.querySelectorAll('script[type="application/ld+json"]')].map(x=>JSON.parse(x.textContent)),links:[...document.querySelectorAll('a[href]')].map(x=>x.getAttribute('href')),missingAlt:document.querySelectorAll('img:not([alt])').length,text:document.body.innerText}));
  assert.equal(data.h1.length,1,path);assert.ok(data.title&&data.description);assert.equal(data.canonical,url);assert.equal(data.robots,'index, follow');assert.equal(data.missingAlt,0);assert.equal(data.alternates.length,3);assert.equal(data.dir,data.lang==='ar'?'rtl':'ltr');assert.ok(data.schemas.length);assert.ok(!data.text.includes('PRIVATE LESSON'));assert.ok(!data.text.includes('Loading'));
  for(const href of data.links)if(href.startsWith('/'))discovered.add(href);
  results.crawl.push({url,...data,text:data.text.length});
 }
 assert.equal(new Set(results.crawl.map(x=>x.title)).size,urls.length,'unique titles');assert.equal(new Set(results.crawl.map(x=>x.description)).size,urls.length,'unique descriptions');
 for(const path of discovered){const r=await fetch(base+path);assert.equal(r.status,200,'link '+path)}
 for(const [path,status] of [['/ar/missing',404],['/ar/courses/missing',404],['/ar/courses?page=9',404],['/api/seo/ar',404],['/',308],['/AR/',308],['/index.html',308]]){const r=await fetch(base+path,{redirect:'manual'});assert.equal(r.status,status,path);results.checks.push({path,status,location:r.headers.get('location')})}
 const sized=await raw.goto(base+'/en/courses?size=20');assert.equal(sized.status(),200);assert.equal(await raw.$eval('meta[name=robots]',e=>e.content),'noindex, follow');assert.equal(await raw.$('link[rel=canonical]'),null);
 const headers=await fetch(base+'/ar',{headers:{'Accept-Encoding':'gzip'}}).then(r=>r.headers);assert.equal(headers.get('content-encoding'),'gzip');assert.equal(headers.get('x-frame-options'),'DENY');assert.match(headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.equal(await fetch(base+'/favicon.svg').then(r=>r.status),200);assert.equal(await fetch(base+'/site.webmanifest').then(r=>r.status),200);
 await raw.close();
 for(const lang of ['ar','en'])for(const mobile of [false,true])for(const dark of [false,true]){
  const p=await browser.newPage();await p.setViewport({width:mobile?390:1440,height:mobile?844:1000,deviceScaleFactor:1});await p.evaluateOnNewDocument(dark=>localStorage.setItem('edu-platform-theme',dark?'dark':'light'),dark);await p.emulateMediaFeatures([{name:'prefers-color-scheme',value:dark?'dark':'light'}]);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text())});await p.goto(base+'/'+lang,{waitUntil:'networkidle0'});
  const info=await p.evaluate(()=>({theme:document.documentElement.dataset.theme,lang:document.documentElement.lang,dir:document.documentElement.dir,h1:document.querySelector('h1')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(x=>!x.complete||x.naturalWidth===0).map(x=>x.src),main:document.querySelectorAll('main').length}));
  assert.equal(info.lang,lang);assert.equal(info.theme,dark?'dark':'light');assert.equal(info.overflow,false);assert.equal(info.brokenImages.length,0);assert.equal(info.main,1);assert.deepEqual(errors,[]);
  await p.screenshot({path:out+'/'+lang+'-'+(mobile?'mobile':'desktop')+'-'+(dark?'dark':'light')+'.png',fullPage:true});results.browser.push({lang,mobile,dark,...info,errors});await p.close();
 }
 for(const path of ['ar/courses','en/courses','ar/courses/javascript-1','en/courses/javascript-1','ar/package/30000000-0000-4000-8000-000000000001','en/package/30000000-0000-4000-8000-000000000001','ar/support','en/support']) {const q=await browser.newPage();await q.setViewport({width:390,height:844});const errors=[];q.on('pageerror',e=>errors.push(e.message));q.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text())});await q.goto(base+'/'+path,{waitUntil:'networkidle0'});const info=await q.evaluate(()=>({h1:[...document.querySelectorAll('h1')].map(x=>x.textContent),overflow:document.documentElement.scrollWidth>innerWidth,robots:document.querySelector('meta[name=robots]')?.content}));assert.equal(info.h1.length,1,path);assert.equal(info.overflow,false,path);assert.equal(info.robots,'index, follow',path);assert.deepEqual(errors,[],path);await q.screenshot({path:out+'/'+path.replaceAll('/','-')+'-mobile.png',fullPage:true});results.browser.push({path,...info,errors});await q.close();}
 const p=await browser.newPage();await p.goto(base+'/en/courses?page=2',{waitUntil:'networkidle0'});assert.match(await p.$eval('main',e=>e.textContent),/Programming fundamentals 11/);
 await p.goto(base+'/en/courses/javascript-1',{waitUntil:'networkidle0'});assert.equal(await p.$eval('h1',e=>e.textContent),'Programming fundamentals 1');assert.equal(await p.$eval('link[rel=canonical]',e=>e.href),'https://seo.example.test/en/courses/javascript-1');
 await p.goto(base+'/en#/login',{waitUntil:'networkidle0'});assert.equal(await p.$eval('meta[name=robots]',e=>e.content),'noindex, follow');assert.equal(await p.$('link[rel=canonical]'),null);
 await p.goto(base+'/ar#/courses/javascript-2',{waitUntil:'networkidle0'});assert.equal(new URL(p.url()).pathname,'/en/courses/javascript-2');
 await p.close();await fs.writeFile(out+'/browser-audit-'+(base.includes('railway')?'railway':'local')+'.json',JSON.stringify(results,null,2));console.log(JSON.stringify({status:'PASS',sitemapPages:urls.length,crawlableLinks:discovered.size,viewports:results.browser.length,checks:results.checks.length}));
} finally {await browser.close()}
