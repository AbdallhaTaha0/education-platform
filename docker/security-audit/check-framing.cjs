const assert = require('node:assert/strict');
const puppeteer = require('/execution/node_modules/puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const response = await page.goto('http://fayq-security-audit-static:8080/', { waitUntil: 'networkidle0' });
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-security-policy'], /frame-ancestors 'none'/);
    assert.equal(response.headers()['x-frame-options'], 'DENY');
    assert.ok(await page.$('#root'), 'Application root mounts');
    assert.ok(await page.$eval('#root', root => root.textContent.length > 20), 'React application renders');
    const preview = require('node:fs').readFileSync('/evidence/preview-fixture.html', 'utf8');
    const previewResult = await page.evaluate(document => new Promise(resolve => {
      const frame = window.document.createElement('iframe'); frame.setAttribute('sandbox', 'allow-scripts');
      const timer = setTimeout(() => resolve(false), 3000);
      window.addEventListener('message', function listener(event) {
        if (event.source === frame.contentWindow && event.origin === 'null' && event.data?.runId === 'audit-preview' && event.data?.message === 'preview-fixture-ok') {
          clearTimeout(timer); window.removeEventListener('message', listener); frame.remove(); resolve(true);
        }
      }); frame.srcdoc = document; window.document.body.append(frame);
    }), preview);
    assert.equal(previewResult, true, 'Actual IDE preview executes within the inherited page policy');
    const attacker = await browser.newPage(); const messages = [];
    attacker.on('console', message => messages.push(message.text()));
    await attacker.setContent('<iframe src="http://fayq-security-audit-static:8080/"></iframe>');
    await new Promise(resolve => setTimeout(resolve, 800));
    assert.ok(messages.some(message => /frame-ancestors|X-Frame-Options|refused to frame/i.test(message)), 'Browser refuses hostile framing');
    const frame = attacker.frames().find(frame => frame !== attacker.mainFrame());
    if (frame) assert.equal(await frame.$('#root'), null);
    console.log('PASS: application renders; actual isolated IDE preview executes; Chromium blocks hostile framing. Browser sandbox disabled only in this isolated non-production test container.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exit(1); });
