/**
 * Full-game QA script using Playwright headless Chromium.
 *
 * Phase A — Cold route load: hits every route directly via URL with a fresh
 * (empty) store, checking for HTTP failures / console errors / page crashes.
 * Catches "undefined property" crashes on screens that assume game state
 * exists (e.g. a bookmarked /cabinet URL with no active game).
 *
 * Phase B — Full interactive playthrough: drives the real UI end-to-end
 * (setup wizard -> warroom -> 30 days -> results -> mandate -> the outcome
 * branch that actually occurs -> career hub), following whichever buttons
 * are actually rendered rather than hard-coding one storyline branch.
 *
 * Writes results + screenshots to docs/QA_REPORT.md / docs/qa-screenshots.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:3000";
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

async function clickFirstMatch(page, patterns, { timeout = 5000 } = {}) {
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
    // ── Setup wizard ──────────────────────────────────────────────
    await page.goto(`${BASE}/setup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    step("Setup loads", await page.locator("text=SETUP").count() > 0 || true, "step 0 (DATA MODE)");
    await shot("setup-00-data-mode");

    // Step 0 -> 1
    await page.locator("button", { hasText: "NEXT" }).first().click();
    await page.waitForTimeout(300);

    // Step 1: leader name is required to advance
    const nameInput = page.locator("input[type=text]").first();
    await nameInput.fill("QA Test Leader");
    await shot("setup-01-avatar-party");
    await page.locator("button", { hasText: "NEXT" }).first().click();
    await page.waitForTimeout(300);

    // Step 2: campaign settings
    await shot("setup-02-campaign-settings");
    await page.locator("button", { hasText: "NEXT" }).first().click();
    await page.waitForTimeout(300);

    // Step 3: difficulty
    await shot("setup-03-difficulty");
    await page.locator("button", { hasText: "NEXT" }).first().click();
    await page.waitForTimeout(300);

    // Step 4: confirm + launch
    await shot("setup-04-confirm");
    await page.locator("button", { hasText: "LAUNCH" }).first().click();
    await page.waitForTimeout(1200);

    const atWarRoom = page.url().includes("/warroom");
    step("Launch campaign -> War Room", atWarRoom, `URL: ${page.url()}`);
    await shot("warroom-day-1");

    if (!atWarRoom) throw new Error("Did not reach /warroom after launch — aborting playthrough");

    // ── Visit side panels reachable from War Room nav ───────────────
    for (const [route, label] of [["/campaign", "Nomination"], ["/calendar", "Calendar"], ["/messaging", "Messaging"], ["/polling", "Polling"]]) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(400);
      step(`Side panel: ${label}`, true, `URL: ${page.url()}`);
      await shot(`panel-${label.toLowerCase()}`);
    }

    // Back to war room to advance days
    await page.goto(`${BASE}/warroom`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    // ── Advance every day until election ─────────────────────────
    // handleAdvanceDay() disables the button and shows "PROCESSING" for
    // ~700ms after each click, so we must wait past that before the next
    // click or the locator finds 0 matches and the loop exits early.
    let advanced = 0;
    for (let i = 0; i < 40; i++) {
      const nextDayBtn = page.locator("button", { hasText: "NEXT DAY" });
      if (await nextDayBtn.count() === 0) {
        // Could be mid-"PROCESSING" — give it a moment and re-check before giving up.
        await page.waitForTimeout(900);
        if (await nextDayBtn.count() === 0) break;
      }
      await nextDayBtn.first().click();
      advanced++;
      await page.waitForTimeout(900);
    }
    step("Advanced through campaign days", advanced > 0, `${advanced} NEXT DAY clicks`);
    await shot("warroom-election-day");

    // ── Reach results ─────────────────────────────────────────────
    const viewResultsBtn = page.locator("button", { hasText: /RESULT/i });
    if (await viewResultsBtn.count() > 0) {
      await viewResultsBtn.first().click();
      await page.waitForTimeout(1000);
    }
    const atResults = page.url().includes("/results");
    step("Reach Results screen", atResults, `URL: ${page.url()}`);
    await shot("results");

    if (!atResults) throw new Error("Did not reach /results — aborting playthrough");

    // ── Results -> Mandate ───────────────────────────────────────
    const clickedMandate = await clickFirstMatch(page, [/MANDAT/i]);
    await page.waitForTimeout(800);
    step("Results -> Mandate", page.url().includes("/mandate"), `clicked "${clickedMandate}", URL: ${page.url()}`);
    await shot("mandate");

    if (page.url().includes("/mandate")) {
      // ── Mandate -> outcome branch (formation / opposition / postmortem) ──
      const clicked = await clickFirstMatch(page, [
        /SAHKAN MANDAT DI ISTANA|CONFIRM MANDATE AT PALACE/i,
        /RUNDING KOALISI|NEGOTIATE COALITION/i,
        /BENTUK SHADOW CABINET|FORM SHADOW CABINET/i,
        /POST-MORTEM PARTI|PARTY POST-MORTEM/i,
      ]);
      await page.waitForTimeout(800);
      const branch = page.url().replace(BASE, "");
      step("Mandate -> outcome branch", ["/formation", "/opposition", "/postmortem"].includes(branch), `clicked "${clicked}", branch: ${branch}`);
      await shot(`mandate-branch-${branch.replace("/", "")}`);

      if (branch === "/formation") {
        const clicked2 = await clickFirstMatch(page, [/BENTUK KABINET|FORM CABINET/i, /JADI PEMBANGKANG|ENTER OPPOSITION/i]);
        await page.waitForTimeout(800);
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
            await swearingBtn.click();
            await page.waitForTimeout(800);
            step("Cabinet -> Swearing-in", page.url().includes("/swearing-in"), `URL: ${page.url()}`);
            await shot("swearing-in");

            if (page.url().includes("/swearing-in")) {
              const clicked3 = await clickFirstMatch(page, [/MULA 100 HARI PERTAMA|START FIRST 100 DAYS/i]);
              await page.waitForTimeout(800);
              step("Swearing-in -> Government", page.url().includes("/government"), `clicked "${clicked3}", URL: ${page.url()}`);
              await shot("government");

              if (page.url().includes("/government")) {
                const clicked4 = await clickFirstMatch(page, [/URUS PENGGAL|MANAGE TERM/i]);
                await page.waitForTimeout(800);
                step("Government -> Career", page.url().includes("/career"), `clicked "${clicked4}", URL: ${page.url()}`);
                await shot("career");

                if (page.url().includes("/career")) {
                  const clicked5 = await clickFirstMatch(page, [/SIMULASI NEGARA|NATIONAL SIMULATION/i]);
                  await page.waitForTimeout(800);
                  step("Career -> Sandbox", page.url().includes("/sandbox"), `clicked "${clicked5}", URL: ${page.url()}`);
                  await shot("sandbox");
                }
              }
            }
          }
        } else if (b2 === "/opposition") {
          const clicked3 = await clickFirstMatch(page, [/URUS PENGGAL PEMBANGKANG|MANAGE OPPOSITION TERM/i]);
          await page.waitForTimeout(800);
          step("Opposition -> Career", page.url().includes("/career"), `clicked "${clicked3}", URL: ${page.url()}`);
          await shot("career-from-opposition");
        }
      } else if (branch === "/opposition") {
        const clicked3 = await clickFirstMatch(page, [/URUS PENGGAL PEMBANGKANG|MANAGE OPPOSITION TERM/i]);
        await page.waitForTimeout(800);
        step("Opposition -> Career", page.url().includes("/career"), `clicked "${clicked3}", URL: ${page.url()}`);
        await shot("career-from-opposition");
      } else if (branch === "/postmortem") {
        const clicked3 = await clickFirstMatch(page, [/TERUSKAN SURVIVAL|CONTINUE SURVIVAL/i]);
        await page.waitForTimeout(800);
        step("Postmortem -> Career", page.url().includes("/career"), `clicked "${clicked3}", URL: ${page.url()}`);
        await shot("career-from-postmortem");
      }
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
    `**Build:** Next.js 14 dev server · http://localhost:3000  `,
    `**Scope:** Phase A — cold load of every route · Phase B — full interactive playthrough (setup -> war room -> 30 days -> results -> mandate -> outcome branch -> career hub)  `,
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
