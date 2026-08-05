const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3036';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa-screenshots', 'hidden-ui');
const VIEWPORT = { width: 1600, height: 900 };

const routes = [
  '/',
  '/menu',
  '/setup',
  '/warroom',
  '/campaign',
  '/polling',
  '/messaging',
  '/calendar',
  '/results',
  '/mandate',
  '/formation',
  '/cabinet',
  '/swearing-in',
  '/government',
  '/career',
  '/sandbox',
  '/elected',
  '/kawasan',
  '/opposition',
  '/postmortem',
  '/stats',
  '/settings',
  '/state/selangor',
];

function slug(route) {
  return route === '/' ? 'root' : route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-$/, '') || 'root';
}

async function seed(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('mymandat-opening-seen', '1');
    localStorage.setItem('mandat-lang', 'ms');
    localStorage.setItem('mandat-music-enabled', 'false');
    localStorage.setItem('mymandat-game-settings', JSON.stringify({
      campaignLength: 'full',
      electionScope: 'prn',
      prnStateId: 'ns',
      difficulty: 'normal',
      startingFund: 2300000,
      oppositionStrength: 60,
      mediaBias: 'balanced',
      realisticPolls: true,
      eventRandomness: true,
      permanentConsequences: true,
    }));
  });
}

async function inspectPage(page) {
  return await page.evaluate(() => {
    const viewport = { width: innerWidth, height: innerHeight };
    const selector = 'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
    const items = Array.from(document.querySelectorAll(selector));
    const issues = [];

    const isVisible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') > 0.02 && rect.width > 2 && rect.height > 2;
    };

    const labelFor = (el) => {
      const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('href') || el.tagName).trim();
      return text.replace(/\s+/g, ' ').slice(0, 90);
    };

    for (const el of items) {
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const fixedOrSticky = style.position === 'fixed' || style.position === 'sticky';
      const inViewport = rect.bottom > 0 && rect.top < viewport.height && rect.right > 0 && rect.left < viewport.width;
      if (!inViewport) continue;

      const clipped = rect.top < -1 || rect.left < -1 || rect.right > viewport.width + 1 || rect.bottom > viewport.height + 1;
      if (clipped && fixedOrSticky) {
        issues.push({
          type: 'fixed-interactive-clipped',
          label: labelFor(el),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height), right: Math.round(rect.right), bottom: Math.round(rect.bottom) },
          position: style.position,
        });
      }

      const cx = Math.min(viewport.width - 1, Math.max(0, rect.left + rect.width / 2));
      const cy = Math.min(viewport.height - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(cx, cy);
      if (hit && !el.contains(hit) && !hit.contains(el)) {
        const hitStyle = getComputedStyle(hit);
        const hitBlocks = hitStyle.pointerEvents !== 'none';
        if (hitBlocks && fixedOrSticky) {
          issues.push({
            type: 'fixed-interactive-covered',
            label: labelFor(el),
            coveredBy: (hit.innerText || hit.className || hit.tagName || '').toString().replace(/\s+/g, ' ').slice(0, 90),
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          });
        }
      }
    }

    const nextDay = Array.from(document.querySelectorAll('button')).find((button) => /NEXT DAY|PROCESS|RESULTS/.test(button.innerText || ''));
    if (location.pathname === '/warroom' && nextDay) {
      const rect = nextDay.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (rect.top < 40 || rect.bottom > 150 || !nextDay.contains(hit)) {
        issues.push({
          type: 'warroom-top-control-risk',
          label: labelFor(nextDay),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height), bottom: Math.round(rect.bottom) },
          hit: hit ? (hit.innerText || hit.tagName || '').toString().replace(/\s+/g, ' ').slice(0, 90) : null,
        });
      }
    }

    return issues;
  });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  await seed(page);
  const report = [];

  for (const route of routes) {
    const url = `${BASE_URL}${route}`;
    const entry = { route, url, issues: [], error: null, screenshot: path.join(OUT_DIR, `${slug(route)}.png`) };
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(350);
      entry.issues = await inspectPage(page);
      await page.screenshot({ path: entry.screenshot, fullPage: false });
    } catch (error) {
      entry.error = String(error && error.message ? error.message : error);
    }
    report.push(entry);
    console.log(`${entry.issues.length === 0 && !entry.error ? 'PASS' : 'FAIL'} ${route} issues=${entry.issues.length}${entry.error ? ` error=${entry.error}` : ''}`);
  }

  await browser.close();
  const reportPath = path.join(OUT_DIR, 'hidden-ui-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  const failing = report.filter((entry) => entry.error || entry.issues.length);
  console.log(`REPORT ${reportPath}`);
  if (failing.length) {
    console.error(`Hidden/covered UI issues found on ${failing.length} route(s).`);
    process.exit(1);
  }
  console.log('No fixed interactive controls clipped or covered in viewport.');
})();
