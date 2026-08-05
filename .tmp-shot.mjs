import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'C:/Users/maste/AppData/Local/Temp/claude/c--Users-maste-MyMandatWeb/5b9624e7-6c3e-4eff-9082-bdecfe9df30f/scratchpad/login.png' });
await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'C:/Users/maste/AppData/Local/Temp/claude/c--Users-maste-MyMandatWeb/5b9624e7-6c3e-4eff-9082-bdecfe9df30f/scratchpad/register.png' });
await browser.close();
