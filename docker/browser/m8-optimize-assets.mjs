// Format/size conversion only; keep the supplied artwork and composition intact.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const input = fs.readFileSync('/source/fayq-learning-hero.png').toString('base64');
  for (const width of [640, 1280]) {
    const result = await page.evaluate(async (input, width) => {
      const img = new Image(); img.src = `data:image/png;base64,${input}`; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = Math.round(width * img.height / img.width);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return { data: canvas.toDataURL('image/webp', .84).split(',')[1], width, height: canvas.height, original: [img.width, img.height] };
    }, input, width);
    const bytes = Buffer.from(result.data, 'base64');
    fs.writeFileSync(`/out/fayq-learning-${width}.webp`, bytes);
    console.log(JSON.stringify({ width, height: result.height, original: result.original, bytes: bytes.length }));
  }
} finally { await browser.close(); }
