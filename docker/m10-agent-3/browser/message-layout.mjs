/** Local layout simulation of actual demo report text; never WhatsApp. */
import puppeteer from 'puppeteer-core';
import {readFile} from 'node:fs/promises';
const texts=await Promise.all(['report-two-weeks.txt','report-week.txt'].map(name=>readFile('/evidence/'+name,'utf8')));
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const page=await browser.newPage();
  await page.setViewport({width:460,height:1300});
  await page.goto('about:blank');
  await page.evaluate(async texts=>{
    document.documentElement.lang='ar';document.documentElement.dir='ltr';
    document.documentElement.style.cssText='min-width:0;width:100%;overflow-x:hidden;';
    document.body.replaceChildren();document.body.style.cssText='display:block;position:static;box-sizing:border-box;min-width:0;width:100%;background:#17242a;margin:0;padding:18px;color:white;';
    for(const text of texts) {
      const card=document.createElement('article');
      card.style.cssText='display:block;width:100%;box-sizing:border-box;background:#14533f;border-radius:12px;padding:14px;margin-bottom:18px;white-space:pre-wrap;overflow-wrap:anywhere;font:16px/1.8 "Noto Sans Arabic",sans-serif;text-align:right;direction:rtl;';
      for(const line of text.split('\n')) {
        const div=document.createElement('div');
        div.style.minHeight='12px';
        div.textContent=line.replace(/\*/g,'');
        if(line.includes('*'))div.style.fontWeight='700';
        card.append(div);
      }
      document.body.append(card);
    }
    await document.fonts.ready;
  },texts);
  await page.screenshot({path:'/evidence/message-layout.png',fullPage:true});
  console.log('Actual demo text layout rendered; local simulation only.');
} finally {await browser.close();}
