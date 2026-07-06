const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.MYMANDAT_URL || 'http://localhost:3035';
const outDir = path.resolve(__dirname, '..', 'public', 'trailer-captures');
fs.mkdirSync(outDir, { recursive: true });

const shots = [
  { name: '01-menu', route: '/menu', wait: 2500 },
  { name: '02-setup', route: '/setup', wait: 2500 },
  { name: '03-warroom', route: '/warroom', wait: 2500 },
  { name: '04-campaign-nomination', route: '/campaign', wait: 2500 },
  { name: '05-polling', route: '/polling', wait: 2500 },
  { name: '06-calendar', route: '/calendar', wait: 2500 },
  { name: '07-results', route: '/results', wait: 2500 },
  { name: '08-stats', route: '/stats', wait: 2500 },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', err => console.log('PAGEERROR', err.message));

  const manifest = [];
  for (const shot of shots) {
    const url = `${baseUrl}${shot.route}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(shot.wait);

    // Put useful routes into visually rich states while still using real rendered UI.
    if (shot.route === '/campaign') {
      await page.evaluate(() => {
        const ledang = [...document.querySelectorAll('button')].find(b => b.textContent && b.textContent.includes('Ledang'));
        ledang?.click();
      });
      await page.waitForTimeout(1200);
    }
    if (shot.route === '/setup') {
      await page.evaluate(() => window.scrollTo({ top: 260, behavior: 'instant' }));
      await page.waitForTimeout(600);
    }

    const file = path.join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    const info = await page.evaluate(() => ({ title: document.title, textLength: document.body.innerText.length, images: document.images.length }));
    manifest.push({ ...shot, file, url, info });
    console.log('captured', shot.name, info);
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await browser.close();
  console.log('saved manifest', path.join(outDir, 'manifest.json'));
}

main().catch(err => { console.error(err); process.exit(1); });
