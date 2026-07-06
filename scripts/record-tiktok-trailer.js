const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async()=>{
  const root = process.cwd();
  const outDir = path.join(root, 'public', 'trailers', 'tiktok');
  const videoDir = path.join(outDir, 'recordings');
  fs.mkdirSync(videoDir, { recursive: true });
  const html = 'file:///' + path.join(outDir, 'mymandat-tiktok-trailer.html').replace(/\\/g, '/');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDir, size: { width: 1080, height: 1920 } },
  });
  const page = await context.newPage();
  await page.goto(html, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'tiktok-first-frame.png'), fullPage: false });
  await page.waitForTimeout(19000);
  const video = page.video();
  await context.close();
  await browser.close();
  const raw = await video.path();
  const dest = path.join(outDir, 'mymandat-tiktok-raw.webm');
  fs.copyFileSync(raw, dest);
  console.log(dest);
})();
