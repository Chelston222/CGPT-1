import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

const EXPECTED_SHA = '27502d6d020f72635bad9afbec3c9dd9c36aef649747a18ed956be1def682225';
const RELEASE_COMMIT = '04a1763879526ceaafaace99825adb1c39e9544d';
const PUBLIC_URL = `https://rawcdn.githack.com/Chelston222/CGPT-1/${RELEASE_COMMIT}/apps/n30/index.html`;
const chunks = ['c00.txt','p01.txt','q02.txt','q05.txt','c08a.txt','c08b.txt','c08c.txt','q11.txt','q14.txt','q17.txt'];

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

const joined = chunks.map(name => fs.readFileSync(new URL(name, import.meta.url), 'utf8')).join('');
const decoded = Buffer.from(joined, 'base64');
const html = zlib.gunzipSync(decoded);
const sha = crypto.createHash('sha256').update(html).digest('hex');
assert(sha === EXPECTED_SHA, `Canonical SHA mismatch: ${sha}`);
assert(html.length === 302104, `Canonical byte length mismatch: ${html.length}`);
console.log(`INTEGRITY PASS ${sha} ${html.length} bytes`);
console.log(`PUBLIC URL ${PUBLIC_URL}`);

fs.mkdirSync('apps/n30/qa-artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

async function runViewport(label, viewport, isMobile = false) {
  const context = await browser.newContext({ viewport, isMobile, deviceScaleFactor: 1 });
  await context.addCookies([{
    name: '__Http-phish', value: '1', url: 'https://rawcdn.githack.com/',
    secure: true, httpOnly: true, sameSite: 'Lax'
  }]);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(String(err)));
  page.on('requestfailed', req => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText || 'failed'}`));
  const response = await page.goto(PUBLIC_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  assert(response && response.ok(), `${label}: HTTP load failed`);
  await page.waitForFunction(() => {
    const t = document.body?.innerText || '';
    return t.includes('N30') && (t.includes('Today') || t.includes('Start')) && !t.includes('N30 could not start');
  }, { timeout: 90000 });
  await page.waitForTimeout(1200);
  const body = await page.locator('body').innerText();
  assert(!body.includes('N30 could not start'), `${label}: boot error screen shown`);
  assert(body.includes('N30'), `${label}: N30 brand missing`);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const innerWidth = await page.evaluate(() => window.innerWidth);
  assert(scrollWidth <= innerWidth + 2, `${label}: horizontal overflow ${scrollWidth} > ${innerWidth}`);
  await page.screenshot({ path: `apps/n30/qa-artifacts/${label}.png`, fullPage: true });

  const navLabels = ['Learn','Curriculum','Progress','Settings'];
  const navOutcomes = [];
  for (const nav of navLabels) {
    const candidate = page.getByText(nav, { exact: true }).first();
    if (await candidate.count()) {
      await candidate.click({ timeout: 10000 });
      await page.waitForTimeout(300);
      navOutcomes.push(nav);
    }
  }
  assert(navOutcomes.length >= 2, `${label}: too few working navigation destinations (${navOutcomes.join(', ')})`);
  await page.screenshot({ path: `apps/n30/qa-artifacts/${label}-after-nav.png`, fullPage: true });
  assert(pageErrors.length === 0, `${label}: page errors: ${pageErrors.join(' | ')}`);
  const seriousConsole = consoleErrors.filter(x => !/favicon|Failed to load resource.*404/i.test(x));
  assert(seriousConsole.length === 0, `${label}: console errors: ${seriousConsole.join(' | ')}`);
  assert(failedRequests.length === 0, `${label}: failed requests: ${failedRequests.join(' | ')}`);
  results.push({ label, viewport, navOutcomes, bodyLength: body.length, consoleErrors: seriousConsole.length, pageErrors: pageErrors.length, failedRequests: failedRequests.length });
  await context.close();
}

await runViewport('desktop-1440x1000', { width: 1440, height: 1000 });
await runViewport('tablet-834x1112', { width: 834, height: 1112 });
await runViewport('mobile-390x844', { width: 390, height: 844 }, true);
await browser.close();
fs.writeFileSync('apps/n30/qa-artifacts/live-qa-results.json', JSON.stringify({ releaseCommit: RELEASE_COMMIT, publicUrl: PUBLIC_URL, expectedSha: EXPECTED_SHA, results }, null, 2));
console.log('LIVE QA PASS', JSON.stringify(results));
