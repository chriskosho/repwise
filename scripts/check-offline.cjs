// Real-browser check of offline support. Usage: npm run build && node scripts/check-offline.cjs
// Serves dist/ the way GitHub Pages does (under /repwise/), installs the service worker,
// goes offline, reloads, and uses the app.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/repwise/')) { res.writeHead(404); return res.end('nope'); }
  let rel = url.pathname.slice('/repwise/'.length) || 'index.html';
  let file = path.join(dist, rel);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

(async () => {
  await new Promise((r) => server.listen(4179, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 400, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = 'http://localhost:4179/repwise/';

  await page.goto(base);
  // A brand-new browser starts with the welcome questions; skip them.
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Start workout' }).waitFor();
  check('app loads online', true);

  // Wait for the service worker to install and take control.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(() => {});
  const ready = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    const cache = keys.length ? await (await caches.open(keys[keys.length - 1])).keys() : [];
    return { active: !!reg.active, caches: keys, files: cache.length };
  });
  check('service worker active with a cache', ready.active && ready.caches.length >= 1, JSON.stringify(ready));

  // Go offline and reload: the app must still open.
  await ctx.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Start workout' }).waitFor({ timeout: 10000 });
  check('reload while offline shows the app', true);

  // Lazy parts must work offline too (Body and Progress are separate files; the library is another).
  await page.getByRole('button', { name: 'Body' }).click();
  await page.getByLabel('Weight (lb)').waitFor({ timeout: 8000 });
  check('Body tab (lazy chunk) opens offline', true);
  await page.getByRole('button', { name: 'Progress' }).click();
  await page.getByRole('tab', { name: 'Tools' }).waitFor({ timeout: 8000 });
  check('Progress tab (lazy chunk) opens offline', true);

  // Log a workout with a library exercise, entirely offline.
  await page.getByRole('button', { name: 'Workout' }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: '+ Add exercise' }).click();
  await page.getByLabel('Search exercises').fill('bench press');
  const first = page.locator('.sheet-list .pick:not(.create)').first();
  await first.waitFor({ timeout: 8000 });
  const name = (await first.getAttribute('aria-label')) || '';
  check('exercise library loads offline', name.length > 0, name);
  await first.click();
  await page.getByRole('button', { name: /^Add 1 exercise/ }).click();
  await page.getByLabel('Set 1 weight').fill('135');
  await page.getByLabel('Set 1 reps').fill('8');
  await page.getByRole('button', { name: 'Mark set 1 done' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByText('Workout complete').waitFor();
  await page.getByRole('button', { name: 'Done' }).click();
  check('workout logged and finished offline', true);

  // And it survives a reload, still offline.
  await page.reload();
  await page.getByRole('button', { name: 'Start workout' }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'History' }).click();
  const saved = await page.getByText(name).first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  check('saved workout is still there after an offline reload', saved);

  // Back online: still fine.
  await ctx.setOffline(false);
  await page.reload();
  await page.getByRole('button', { name: 'Start workout' }).waitFor();
  check('back online works', true);

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch(async (e) => { console.error('FAIL (exception)', e.message); server.close(); process.exit(1); });
