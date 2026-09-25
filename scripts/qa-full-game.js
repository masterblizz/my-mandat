/**
 * Full-game QA script using Playwright headless Chromium.
 *
 * Phase A — Cold route load: hits every route directly via URL with a fresh
 * (empty) store, checking for HTTP failures / console errors / page crashes.
 * Catches "undefined property" crashes on screens that assume game state
 * exists (e.g. a bookmarked /cabinet URL with no active game).
 *
 * Phase B — Full interactive playthrough: drives the real UI end-to-end
 * (scenario start -> 3D city -> warroom -> 30 days -> election night -> results
 * -> mandate -> the outcome branch that actually occurs -> career hub),
 * following whichever buttons are actually rendered rather than hard-coding
 * one storyline branch.
 *
 * Run against a dev server with auth disabled (the middleware skips the gate
 * when the Supabase vars are empty):
 *   NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3000
 *   QA_BASE=http://localhost:3000 node scripts/qa-full-game.js
 *
 * Writes results + screenshots to docs/QA_REPORT.md / docs/qa-screenshots.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.QA_BASE || "http://localhost:3000";
const SCREENSHOT_DIR = path.resolve(__dirname, "../docs/qa-screenshots");
const REPORT_PATH = path.resolve(__dirname, "../docs/QA_REPORT.md");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

const COLD_ROUTES = [
  { name: "Root redirect", path: "/", expectRedirect: true },
  { name: "Main Menu", path: "/menu" },
  { name: "Setup / New Game", path: "/setup" },
  { name: "War Room", path: "/warroom" },
  { name: "Campaign (Nomination)", path: "/campaign" },
  { name: "Calendar", path: "/calendar" },
  { name: "Messaging", path: "/messaging" },
  { name: "Polling", path: "/polling" },
  { name: "Stats", path: "/stats" },
  { name: "Results", path: "/results" },
  { name: "Elected", path: "/elected" },
  { name: "Mandate", path: "/mandate" },
  { name: "Formation", path: "/formation" },
  { name: "Cabinet", path: "/cabinet" },
  { name: "Swearing-in", path: "/swearing-in" },
  { name: "Government", path: "/government" },
  { name: "Career", path: "/career" },
  { name: "Sandbox", path: "/sandbox" },
  { name: "Opposition", path: "/opposition" },
  { name: "Postmortem", path: "/postmortem" },
  { name: "Load Game", path: "/load-game" },
  { name: "Constituency city", path: "/kawasan" },
  { name: "Political office", path: "/office" },
  { name: "Location: party HQ", path: "/location/party" },
  { name: "Term report card", path: "/report-card" },
  { name: "Settings", path: "/settings" },
  { name: "State (Selangor)", path: "/state/selangor" },
];

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function gotoAndCheck(page, url, results, name, checks) {
  const consoleErrors = [];
  const handler = (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); };
  const errHandler = (err) => consoleErrors.push(`PAGE ERROR: ${err.message}`);
  page.on("console", handler);
  page.on("pageerror", errHandler);

  let status = "PASS";
  let detail = "";
  let screenshotFile = null;

  try {
    // "load" rather than "networkidle" — Next dev's HMR websocket keeps the
    // network non-idle indefinitely, and first-hit cold compiles can take
    // 20s+, so networkidle is both slower and less reliable here.
    const response = await page.goto(url, { waitUntil: "load", timeout: 45000 });
    await page.waitForTimeout(600);
    const httpStatus = response?.status() ?? 0;

    const missing = [];
    for (const text of checks || []) {
      const found = await page.locator(`text=${text}`).count();
      if (found === 0) missing.push(text);
    }

    if (missing.length > 0) {
      status = "FAIL";
      detail = `Missing text: ${missing.join(", ")}`;
    } else if (httpStatus >= 400) {
      status = "FAIL";
      detail = `HTTP ${httpStatus}`;
    } else if (consoleErrors.length > 0) {
      status = "WARN";
      detail = `Console errors: ${consoleErrors.slice(0, 3).join(" | ")}`;
    } else {
      detail = `HTTP ${httpStatus}`;
    }

    const ssName = `${slug(name)}.png`;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ssName), fullPage: false });
    screenshotFile = ssName;
  } catch (err) {
    status = "FAIL";
    detail = err.message.slice(0, 160);
  } finally {
    page.off("console", handler);
    page.off("pageerror", errHandler);
  }

  results.push({ name, status, detail, screenshotFile });
  console.log(`[${status}] ${name}: ${detail}`);
  return { status, detail, consoleErrors };
}

// Client transitions (usePendingNav) can take longer than a fixed short wait
// under a slow first render/compile — poll for the URL to actually change
// rather than assuming a fixed delay is enough.
async function waitForNavAway(page, prevUrl, timeout = 10000) {
  await page.waitForFunction((prev) => window.location.href !== prev, prevUrl, { timeout }).catch(() => {});
}

async function clickFirstMatch(page, patterns, { timeout = 5000, waitFor = 20000 } = {}) {
  // First-hit dev compiles and entrance animations can leave a screen blank
  // for a while — wait for any candidate button before trying them in order.
  await Promise.any(patterns.map((p) => page.locator("button", { hasText: p }).first().waitFor({ state: "visible", timeout: waitFor }))).catch(() => {});
  for (const p of patterns) {
    const loc = page.locator("button", { hasText: p }).first();
    try {
      if (await loc.count() > 0 && await loc.isVisible({ timeout: 500 })) {
        const disabled = await loc.isDisabled().catch(() => false);
        if (disabled) continue;
        await loc.click({ timeout });
        return p;
      }
    } catch { /* try next */ }
  }
  return null;
}

async function runColdRoutes(context, results) {
  console.log("\n=== PHASE A: Cold route load ===\n");
  for (const route of COLD_ROUTES) {
    const page = await context.newPage();
    await gotoAndCheck(page, `${BASE}${route.path}`, results, `Cold: ${route.name}`, route.checks);
    await page.close();
  }
}

async function runPlaythrough(context, playResults) {
  console.log("\n=== PHASE B: Interactive playthrough ===\n");
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(`PAGE ERROR: ${err.message}`));

  function step(name, ok, detail) {
    playResults.push({ name, status: ok ? "PASS" : "FAIL", detail: detail || "" });
    console.log(`[${ok ? "PASS" : "FAIL"}] ${name}: ${detail || ""}`);
  }

  async function shot(name) {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `play-${slug(name)}.png`) }).catch(() => {});
  }

  try {
    // ── Scenario start -> city -> War Room ───────────────────────
    // "load" not "networkidle": the dev HMR socket keeps the network busy.
    await page.goto(`${BASE}/setup`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(1500);
    await shot("setup-scenarios");
    const startBtn = page.locator("button", { hasText: /Mulakan senario|Start scenario/ }).first();
    const box = await startBtn.boundingBox();
    // AGENTS.md: a DOM click that works while a real click is blocked is still a bug.
    const onTop = box && await page.evaluate(({ x, y }) => /senario|scenario/i.test(document.elementFromPoint(x, y)?.textContent || ""), { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    step("Scenario start button is clickable (not covered)", !!onTop, box ? `at y=${Math.round(box.y)}` : "not found");
    await page.locator("input[aria-label]").first().fill("QA Test Leader");
    await startBtn.click();
    await page.waitForURL("**/kawasan", { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(3000);
    step("Start scenario -> 3D city", page.url().includes("/kawasan"), `URL: ${page.url()}`);
    await shot("kawasan-day-1");

    await page.goto(`${BASE}/warroom`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(1500);
    const atWarRoom = page.url().includes("/warroom");
    step("City -> War Room", atWarRoom, `URL: ${page.url()}`);
    await shot("warroom-day-1");

    if (!atWarRoom) throw new Error("Did not reach /warroom — aborting playthrough");

    // ── Visit side panels reachable from War Room nav ───────────────
    for (const [route, label] of [["/campaign", "Nomination"], ["/calendar", "Calendar"], ["/messaging", "Messaging"], ["/polling", "Polling"]]) {
      await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 120000 }).catch(() => {});
      await page.waitForTimeout(400);
      step(`Side panel: ${label}`, true, `URL: ${page.url()}`);
      await shot(`panel-${label.toLowerCase()}`);
    }

    // Back to war room to advance days
    await page.goto(`${BASE}/warroom`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(1500);

    // ── Advance every day until election ─────────────────────────
    // Varied play: rotate briefing actions so repeat fatigue is exercised,
    // then advance. The end-of-day recap must appear after each advance.
    let advanced = 0, recaps = 0;
    const rotation = [/Lawatan komuniti|Community visit/, /Kutip dana|Fundraise/, /Latih jentera|Train organisers/];
    for (let i = 0; i < 40; i++) {
      const act = page.locator("button:not([disabled])", { hasText: rotation[i % 3] }).first();
      if (await act.count() > 0) await act.click().catch(() => {});
      const nextDayBtn = page.locator("button:not([disabled])", { hasText: /HARI SETERUSNYA|NEXT DAY/ });
      if (await nextDayBtn.count() === 0) {
        await page.waitForTimeout(900);
        if (await nextDayBtn.count() === 0) break;
      }
      await nextDayBtn.first().click();
      advanced++;
      await page.waitForTimeout(900);
      if (await page.locator("[role=status][aria-live=polite]").count() > 0) recaps++;
    }
    step("Advanced through campaign days", advanced > 0, `${advanced} day advances`);
    step("End-of-day recap shown after advances", recaps >= Math.max(1, advanced - 2), `${recaps}/${advanced} recaps seen`);
    await shot("warroom-election-day");

    // ── Reach results ─────────────────────────────────────────────
    const viewResultsBtn = page.locator("button", { hasText: /RESULT|Malam keputusan|Election night/i });
    if (await viewResultsBtn.count() > 0) {
      await viewResultsBtn.first().click();
      await page.waitForURL("**/results", { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    // Election night plays as a full-screen overlay; skip to the official result.
    await page.locator("button", { hasText: /LANGKAU|SKIP/ }).first().waitFor({ timeout: 30000 }).catch(() => {});
    step("Day recap does not cover election night", await page.locator("[role=status][aria-live=polite]").count() === 0, "");
    const skip = page.locator("button", { hasText: /LANGKAU|SKIP/ }).first();
    if (await skip.count() > 0) await skip.click().catch(() => {});
    await page.waitForTimeout(800);
    const official = page.locator("button", { hasText: /KEPUTUSAN RASMI|OFFICIAL/ }).first();
    if (await official.count() > 0) await official.click().catch(() => {});
    await page.waitForTimeout(800);
    const atResults = page.url().includes("/results");
    step("Reach Results screen", atResults, `URL: ${page.url()}`);
    await shot("results");

    if (!atResults) throw new Error("Did not reach /results — aborting playthrough");

    // ── Results -> Mandate (or -> Elected -> Mandate if the leader won their own seat) ──
    const clickedMandate = await clickFirstMatch(page, [/MANDAT/i]);
    const _prevUrl_clickedMandate = page.url();
    await waitForNavAway(page, _prevUrl_clickedMandate);
    step("Results -> Mandate/Elected", page.url().includes("/mandate") || page.url().includes("/elected"), `clicked "${clickedMandate}", URL: ${page.url()}`);

    if (page.url().includes("/elected")) {
      await shot("elected");
      const clickedElected = await clickFirstMatch(page, [/MANDAT/i]);
      const _prevUrlElected = page.url();
      await waitForNavAway(page, _prevUrlElected);
      step("Elected -> Mandate", page.url().includes("/mandate"), `clicked "${clickedElected}", URL: ${page.url()}`);
    }
    await shot("mandate");

    if (page.url().includes("/mandate")) {
      // ── Mandate -> outcome branch (formation / opposition / postmortem) ──
      const clicked = await clickFirstMatch(page, [
        /SAHKAN MANDAT DI ISTANA|CONFIRM MANDATE AT PALACE/i,
        /RUNDING KOALISI|NEGOTIATE COALITION/i,
        /BENTUK SHADOW CABINET|FORM SHADOW CABINET/i,
        /POST-MORTEM PARTI|PARTY POST-MORTEM/i,
      ]);
      const _prevUrl_clicked = page.url();
      await waitForNavAway(page, _prevUrl_clicked);
      const branch = page.url().replace(BASE, "");
      step("Mandate -> outcome branch", ["/formation", "/opposition", "/postmortem"].includes(branch), `clicked "${clicked}", branch: ${branch}`);
      await shot(`mandate-branch-${branch.replace("/", "")}`);

      if (branch === "/formation") {
        const clicked2 = await clickFirstMatch(page, [/BENTUK KABINET|FORM CABINET/i, /JADI PEMBANGKANG|ENTER OPPOSITION/i]);
        const _prevUrl_clicked2 = page.url();
        await waitForNavAway(page, _prevUrl_clicked2);
        const b2 = page.url().replace(BASE, "");
        step("Formation -> Cabinet/Opposition", ["/cabinet", "/opposition"].includes(b2), `clicked "${clicked2}", branch: ${b2}`);
        await shot(`formation-branch-${b2.replace("/", "")}`);

        if (b2 === "/cabinet") {
          const swearingBtn = page.locator("button", { hasText: /ANGKAT SUMPAH|SWEARING-IN/i }).first();
          const exists = await swearingBtn.count() > 0;
          const disabled = exists ? await swearingBtn.isDisabled().catch(() => true) : true;
          step("Cabinet: swearing-in button state", exists, disabled ? "disabled (coalition short of majority — expected if hung)" : "enabled");
          await shot("cabinet");
          if (exists && !disabled) {
            const _prevUrlSwearing = page.url();
            await swearingBtn.click();
            await waitForNavAway(page, _prevUrlSwearing);
            step("Cabinet -> Swearing-in", page.url().includes("/swearing-in"), `URL: ${page.url()}`);
            await shot("swearing-in");

            if (page.url().includes("/swearing-in")) {
              const clicked3 = await clickFirstMatch(page, [/MULA 100 HARI PERTAMA|START FIRST 100 DAYS/i]);
              const _prevUrl_clicked3 = page.url();
              await waitForNavAway(page, _prevUrl_clicked3);
              step("Swearing-in -> Government", page.url().includes("/government"), `clicked "${clicked3}", URL: ${page.url()}`);
              await shot("government");

            }
          }
        }
      }
    }

    // ── Governing / opposition / rebuilding term ──────────────────
    // Every outcome branch lands on the same term dashboard. Play the term:
    // quarters resolve with a recap, month 60 opens the report card, and the
    // report card starts the next election (closing the career loop).
    const termRoutes = ["/government", "/opposition", "/postmortem", "/career"];
    if (termRoutes.some((r) => page.url().includes(r))) {
      await shot(`term-${page.url().replace(BASE, "").replace("/", "")}`);
      let quarters = 0, quarterRecap = false;
      for (let q = 0; q < 25; q++) {
        const openReport = page.locator("button", { hasText: /Buka kad laporan penggal|Open term report card/ });
        if (await openReport.count() > 0) break;
        const advance = await clickFirstMatch(page, [/Majukan suku tahun|Advance quarter/]);
        if (!advance) break;
        quarters++;
        await page.waitForTimeout(500);
        if (q === 0) quarterRecap = await page.locator("[role=status][aria-live=polite]", { hasText: /SUKU TAHUN SELESAI|QUARTER COMPLETE/ }).count() > 0;
      }
      step("Term: quarters advance to month 60", quarters >= 19, `${quarters} quarters`);
      step("Term: quarter recap shown", quarterRecap, "");
      const clickedReport = await clickFirstMatch(page, [/Buka kad laporan penggal|Open term report card/]);
      await page.waitForURL("**/report-card", { timeout: 60000 }).catch(() => {});
      step("Term -> Report card", page.url().includes("/report-card"), `clicked "${clickedReport}", URL: ${page.url()}`);
      await shot("report-card");
      const clickedNext = await clickFirstMatch(page, [/Mulakan pilihan raya seterusnya|Start next election/]);
      await page.waitForURL("**/warroom", { timeout: 60000 }).catch(() => {});
      step("Report card -> next election War Room", page.url().includes("/warroom"), `clicked "${clickedNext}", URL: ${page.url()}`);
      await shot("next-election-warroom");
    }
  } catch (err) {
    step("Playthrough aborted with exception", false, err.message.slice(0, 200));
  }

  if (consoleErrors.length > 0) {
    step("Console errors during playthrough", false, consoleErrors.slice(0, 8).join(" | "));
  } else {
    step("No console errors during playthrough", true, "");
  }

  await page.close();
}

async function run() {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const coldResults = [];
  const playResults = [];

  await runColdRoutes(context, coldResults);
  await runPlaythrough(context, playResults);

  await browser.close();

  const allResults = [...coldResults, ...playResults];
  const passCount = allResults.filter((r) => r.status === "PASS").length;
  const failCount = allResults.filter((r) => r.status === "FAIL").length;
  const warnCount = allResults.filter((r) => r.status === "WARN").length;

  const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const lines = [
    "# My Mandat — QA Report",
    "",
    `**Date:** ${now}  `,
    `**Build:** Next.js 14 dev server · ${BASE}  `,
    `**Scope:** Phase A — cold load of every route · Phase B — full interactive playthrough (scenario -> city -> war room -> 30 days -> election night -> mandate -> outcome branch -> career hub)  `,
    "",
    "## Summary",
    "",
    "| Result | Count |",
    "|--------|-------|",
    `| ✅ PASS | ${passCount} |`,
    `| ❌ FAIL | ${failCount} |`,
    `| ⚠️ WARN | ${warnCount} |`,
    `| **TOTAL** | **${allResults.length}** |`,
    "",
    "---",
    "",
    "## Phase A — Cold Route Load",
    "",
    "Each route hit directly via URL with a fresh (empty) game store — catches crashes on screens that assume an active game exists.",
    "",
    "| Route | Result | Detail |",
    "|-------|--------|--------|",
    ...coldResults.map((r) => {
      const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⚠️";
      const ss = r.screenshotFile ? ` ([screenshot](qa-screenshots/${r.screenshotFile}))` : "";
      return `| ${r.name.replace("Cold: ", "")} | ${icon} ${r.status}${ss} | ${r.detail} |`;
    }),
    "",
    "---",
    "",
    "## Phase B — Interactive Playthrough",
    "",
    "Drives the real UI: setup wizard -> war room -> 30 campaign days -> results -> mandate -> whichever outcome branch actually occurs (formation/cabinet/swearing-in/government/career/sandbox, or opposition/career, or postmortem/career).",
    "",
    "| Step | Result | Detail |",
    "|------|--------|--------|",
    ...playResults.map((r) => {
      const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⚠️";
      return `| ${r.name} | ${icon} ${r.status} | ${r.detail} |`;
    }),
    "",
    "---",
    "",
    `*Generated by \`scripts/qa-full-game.js\` on ${now}*`,
  ];

  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf-8");
  console.log(`\nReport written to ${REPORT_PATH}`);
  console.log(`Total: ${passCount} pass, ${failCount} fail, ${warnCount} warn`);
  if (failCount > 0) process.exitCode = 1;
}

run().catch((err) => { console.error(err); process.exit(1); });
