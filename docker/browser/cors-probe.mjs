/** Probe driver for R2 CORS browser verification (TEST-ONLY).
 *
 * Runs inside the containerized Chromium image (puppeteer-core + system
 * Chromium). Loads one probe page, waits for its self-reported RESULT title,
 * and prints scalars only: verdict, status or error name. The embedded
 * presigned PUT URL never leaves the page. Environment:
 *   PAGE_URL     probe page to load (run-scoped, no secrets)
 *   EXPECT_MODE  "status" (EXPECT_STATUS must equal the PUT status) or "block"
 *   EXPECT_STATUS expected PUT status for mode "status" (default "200")
 */
import puppeteer from 'puppeteer-core';

const pageUrl = process.env.PAGE_URL || '';
const mode = process.env.EXPECT_MODE || 'status';
const wantStatus = process.env.EXPECT_STATUS || '200';
if (!pageUrl) {
  process.stderr.write('probe verdict=FAIL note=missing-page-url\n');
  process.exit(2);
}

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    ...(process.env.RESOLVER_RULES ? [`--host-resolver-rules=${process.env.RESOLVER_RULES}`] : []),
  ],
});
try {
  const page = await browser.newPage();
  await page.goto(pageUrl, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => document.title.startsWith('RESULT'), { timeout: 90000 });
  const title = await page.title();
  const statusMatch = /^RESULT status=(\d+)$/.exec(title);
  const errorMatch = /^RESULT error=([A-Za-z]+)$/.exec(title);
  if (mode === 'block') {
    const pass = errorMatch !== null;
    process.stdout.write(`probe verdict=${pass ? 'PASS' : 'FAIL'} error=${errorMatch ? errorMatch[1] : 'none'} status=${statusMatch ? statusMatch[1] : 'none'}\n`);
    process.exit(pass ? 0 : 1);
  }
  const pass = statusMatch !== null && statusMatch[1] === wantStatus;
  process.stdout.write(`probe verdict=${pass ? 'PASS' : 'FAIL'} status=${statusMatch ? statusMatch[1] : 'none'} error=${errorMatch ? errorMatch[1] : 'none'}\n`);
  process.exit(pass ? 0 : 1);
} finally {
  await browser.close();
}
