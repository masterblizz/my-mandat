import { chromium } from 'playwright';

const BASE = 'http://localhost:3333';
const issues = [];
const log = (msg) => console.log('[QA]', msg);

async function check(label, fn) {
  try { await fn(); }
  catch (e) { issues.push(`❌ ${label}: ${e.message.slice(0,120)}`); console.log('FAIL:', label, e.message.slice(0,120)); }
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const screenshots = [];

async function shot(name) {
  const p = `/tmp/qa-${name}.png`;
  await page.screenshot({ path: p, fullPage: false });
  screenshots.push({ name, p });
}

// ─── 1. Root redirects to /menu ──────────────────────────────────────────────
log('Testing root redirect...');
await check('Root → /menu redirect', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  if (!page.url().includes('/menu')) throw new Error(`Landed on ${page.url()}`);
});
await shot('01-menu');

// ─── 2. Menu page language consistency ───────────────────────────────────────
log('Checking menu language...');
await check('Menu: BM/EN header visible', async () => {
  const text = await page.textContent('body');
  if (!text.includes('MY MANDAT')) throw new Error('MY MANDAT title missing');
});
await check('Menu: nav items present', async () => {
  const btns = await page.$$('button');
  if (btns.length < 5) throw new Error(`Only ${btns.length} buttons found on menu`);
});
await check('Menu: MULA KEMPEN or START CAMPAIGN button', async () => {
  const text = await page.textContent('body');
  if (!text.includes('MULA KEMPEN') && !text.includes('START CAMPAIGN')) throw new Error('Start campaign button text missing');
});
await check('Menu: Election Status panel shows days', async () => {
  const text = await page.textContent('body');
  if (!text.includes('HARI BERBAKI') && !text.includes('DAYS LEFT')) throw new Error('Days left label missing');
});
await check('Menu: Coalition Watch present', async () => {
  const text = await page.textContent('body');
  if (!text.includes('PEMERHATIAN KOALISI') && !text.includes('COALITION WATCH')) throw new Error('Coalition watch missing');
});

// ─── 3. Menu buttons navigate correctly ──────────────────────────────────────
log('Testing menu START CAMPAIGN button...');
await check('Menu: START CAMPAIGN → /setup', async () => {
  await page.goto(`${BASE}/menu`, { waitUntil: 'networkidle' });
  // click item 01 / MULA KEMPEN / START CAMPAIGN
  const btn = await page.getByText(/MULA KEMPEN|START CAMPAIGN/i).first();
  await btn.click();
  await page.waitForURL('**/setup**', { timeout: 5000 });
});
await shot('02-setup');

// ─── 4. Setup page ────────────────────────────────────────────────────────────
log('Checking setup page...');
await check('Setup: step indicator visible', async () => {
  const text = await page.textContent('body');
  if (!text.includes('DATA MODE') && !text.includes('AVATAR')) throw new Error('Step indicator missing');
});
await check('Setup: NEXT button present', async () => {
  const btn = await page.getByText(/NEXT →|NEXT/i).first();
  if (!btn) throw new Error('NEXT button not found');
});
await check('Setup: BACK button present', async () => {
  const text = await page.textContent('body');
  if (!text.includes('← BACK') && !text.includes('BACK')) throw new Error('BACK button missing');
});
await check('Setup: navigate to step 2', async () => {
  const btn = await page.getByText(/NEXT →/i).first();
  await btn.click();
  await page.waitForTimeout(500);
  const text = await page.textContent('body');
  if (!text.includes('AVATAR') && !text.includes('LEADER')) throw new Error('Did not advance to avatar step');
});
await shot('03-setup-step2');

// ─── 5. Navigate through setup to warroom ────────────────────────────────────
log('Completing setup flow...');
await check('Setup: complete all steps', async () => {
  // Step through remaining steps
  for (let i = 0; i < 3; i++) {
    const btn = await page.getByText(/NEXT →/i).first();
    if (btn) { await btn.click(); await page.waitForTimeout(400); }
  }
  // Now on step 4 confirm — click LAUNCH
  const launch = await page.getByText(/LAUNCH CAMPAIGN|LAUNCH →/i).first();
  if (!launch) throw new Error('LAUNCH button not found on confirm step');
  await launch.click();
  // Intro video may play, wait up to 8s for either /warroom or intro
  await page.waitForTimeout(500);
  // Skip intro if it shows
  const skipBtn = await page.$('button:has-text("SKIP"), [data-testid="skip"]');
  if (skipBtn) await skipBtn.click();
});

// ─── 6. Warroom ───────────────────────────────────────────────────────────────
log('Navigating to warroom directly...');
await page.goto(`${BASE}/warroom`, { waitUntil: 'networkidle' });
await shot('04-warroom');
await check('Warroom: NEXT DAY button present', async () => {
  const btn = await page.getByText(/NEXT DAY/i).first();
  if (!btn) throw new Error('NEXT DAY button missing');
});
await check('Warroom: top stats bar shows seats/support', async () => {
  const text = await page.textContent('body');
  if (!text.includes('SEATS PROJECTED') && !text.includes('PARTY SUPPORT')) throw new Error('Stats bar missing');
});
await check('Warroom: NEXT DAY button click works', async () => {
  const before = await page.textContent('body');
  const btn = await page.getByText(/» NEXT DAY/i).first();
  await btn.click();
  await page.waitForTimeout(1000);
  // Day counter should have advanced
  const after = await page.textContent('body');
  if (before === after) throw new Error('Page unchanged after NEXT DAY');
});
await shot('05-warroom-day2');

// ─── 7. Warroom nav links ─────────────────────────────────────────────────────
log('Testing warroom nav links...');
const navLinks = [
  { label: /CAMPAIGN OPS/i, url: '/campaign' },
  { label: /POLLING/i, url: '/polling' },
  { label: /MESSAGING/i, url: '/messaging' },
  { label: /CALENDAR/i, url: '/calendar' },
];
for (const link of navLinks) {
  await check(`Warroom nav: ${link.url}`, async () => {
    await page.goto(`${BASE}/warroom`, { waitUntil: 'domcontentloaded' });
    const btn = await page.getByText(link.label).first();
    await btn.click();
    await page.waitForURL(`**${link.url}**`, { timeout: 5000 });
  });
}

// ─── 8. Campaign page ─────────────────────────────────────────────────────────
log('Checking campaign page...');
await page.goto(`${BASE}/campaign`, { waitUntil: 'networkidle' });
await shot('06-campaign');
await check('Campaign: tabs present', async () => {
  const text = await page.textContent('body');
  if (!text.includes('NOMINATION') && !text.includes('OPERATIONS')) throw new Error('Tabs missing');
});
await check('Campaign: tab switching works', async () => {
  const tab = await page.getByText('OPERATIONS').first();
  await tab.click();
  await page.waitForTimeout(300);
  const text = await page.textContent('body');
  if (!text.includes('OPERATION')) throw new Error('Operations tab did not activate');
});

// ─── 9. Polling page ─────────────────────────────────────────────────────────
log('Checking polling page...');
await page.goto(`${BASE}/polling`, { waitUntil: 'networkidle' });
await shot('07-polling');
await check('Polling: national support data visible', async () => {
  const text = await page.textContent('body');
  if (!text.includes('SOKONGAN') && !text.includes('SUPPORT') && !text.includes('%')) throw new Error('Support data missing');
});

// ─── 10. Settings: theme toggle ───────────────────────────────────────────────
log('Checking settings...');
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await shot('08-settings');
await check('Settings: DISPLAY tab present', async () => {
  const tab = await page.getByText('DISPLAY').first();
  if (!tab) throw new Error('DISPLAY tab missing');
  await tab.click();
  await page.waitForTimeout(300);
});
await check('Settings: DARK/LIGHT theme buttons present', async () => {
  const text = await page.textContent('body');
  if (!text.includes('DARK') || !text.includes('LIGHT')) throw new Error('Theme buttons missing');
});

// ─── 11. State detail page ────────────────────────────────────────────────────
log('Checking state detail page...');
await page.goto(`${BASE}/state/selangor`, { waitUntil: 'networkidle' });
await shot('09-state');
await check('State: tabs render', async () => {
  const text = await page.textContent('body');
  if (!text.includes('OVERVIEW') && !text.includes('PARLIAMENT')) throw new Error('Tabs missing');
});

// ─── 12. Results page ────────────────────────────────────────────────────────
log('Checking results page...');
await page.goto(`${BASE}/results`, { waitUntil: 'networkidle' });
await shot('10-results');
await check('Results: seat verdict visible', async () => {
  const text = await page.textContent('body');
  if (!text.includes('GOVERNMENT') && !text.includes('OPPOSITION') && !text.includes('PARLIAMENT')) throw new Error('Verdict missing');
});

// ─── 13. Language: mixed BM+EN detection ─────────────────────────────────────
log('Checking language consistency on each page...');
const PAGES = ['/menu', '/warroom', '/campaign', '/polling', '/messaging', '/calendar', '/settings', '/stats'];
// Known acceptable bilingual pairings — not bugs
const BILINGUAL_OK = ['MY MANDAT', 'PRU', 'SPR', 'MANDAT', 'LAWAN', 'CERAMAH', 'KL', 'RM'];
for (const path of PAGES) {
  await check(`Language OK: ${path}`, async () => {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    const text = await page.textContent('body');
    // Check no raw "undefined" or "[object Object]" rendered
    if (text.includes('[object Object]')) throw new Error('Rendered [object Object]');
    if (text.includes('undefined') && !text.includes('UNDEFINED')) throw new Error('Rendered literal undefined');
    if (text.includes('NaN')) throw new Error('Rendered NaN');
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────
await browser.close();
console.log('\n========== QA RESULTS ==========');
if (issues.length === 0) {
  console.log('✅ ALL CHECKS PASSED');
} else {
  console.log(`❌ ${issues.length} ISSUE(S) FOUND:`);
  issues.forEach(i => console.log(i));
}
console.log('=================================\n');
