const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message || String(error)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('http://localhost:3037/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => sessionStorage.removeItem('mymandat-opening-seen'));
  await page.goto('http://localhost:3037/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const rootHasIntro = await page.locator('video[src^="/intro/"]').count();
  if (rootHasIntro !== 1) throw new Error(`Expected intro video only on opening route, got ${rootHasIntro}`);

  await page.locator('button', { hasText: /LANGKAU|SKIP/ }).click();
  await page.waitForURL('**/menu', { timeout: 10000 });
  const menuHasIntro = await page.locator('video[src^="/intro/"]').count();
  if (menuHasIntro !== 0) throw new Error(`Menu should not show intro video, got ${menuHasIntro}`);

  await page.goto('http://localhost:3037/setup', { waitUntil: 'domcontentloaded' });
  const setupHasIntro = await page.locator('video[src^="/intro/"]').count();
  if (setupHasIntro !== 0) throw new Error(`Setup should not show intro video, got ${setupHasIntro}`);

  await page.goto('http://localhost:3037/load-game', { waitUntil: 'domcontentloaded' });
  const loadHasIntro = await page.locator('video[src^="/intro/"]').count();
  if (loadHasIntro !== 0) throw new Error(`Load-game should not show intro video, got ${loadHasIntro}`);

  console.log(JSON.stringify({ rootHasIntro, menuHasIntro, setupHasIntro, loadHasIntro, errors }, null, 2));
  await browser.close();
  if (errors.length) process.exit(2);
})().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
