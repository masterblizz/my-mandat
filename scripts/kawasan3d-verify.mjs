// Headless verification harness for the /kawasan-3d WebGL migration.
//
// Launches Chromium with software WebGL (SwiftShader via ANGLE) since this
// environment has no GPU, drives the /kawasan-3d sandbox through its four
// density presets (Rural 6x6, Semi-urban 8x8, Metro 10x10, Dense metro
// 12x12 — see DENSITY_PRESETS in app/kawasan-3d/Scene.tsx), grabs a
// screenshot of each, and reads the in-app perf HUD (fps / draw calls /
// triangles) for the density under test.
//
// Usage:
//   NODE_PATH=<repo>/node_modules node scripts/kawasan3d-verify.mjs \
//     --base http://localhost:3177 --out docs/webgl-qa-screenshots --tag phaseA
//
// Requires the Next dev server already running at --base.

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const BASE = args.base ?? "http://localhost:3177";
const OUT = args.out ?? "docs/webgl-qa-screenshots";
const TAG = args.tag ?? "run";
const SETTLE_MS = Number(args.settle ?? 1800); // let instancing + tweens settle
const SAMPLE_MS = Number(args.sample ?? 2200); // perf HUD samples every 500ms

// Exact chip labels from DENSITY_PRESETS in app/kawasan-3d/Scene.tsx.
const PRESETS = [
  { key: "rural", label: "Rural · 6×6", name: "Rural 6x6" },
  { key: "semi", label: "Semi-urban · 8×8", name: "Semi-urban 8x8" },
  { key: "metro", label: "Metro · 10×10", name: "Metro 10x10" },
  { key: "dense", label: "Dense metro · 12×12", name: "Dense metro 12x12" },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--disable-gpu-sandbox",
      "--no-sandbox",
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  await page.goto(`${BASE}/kawasan-3d`, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 30000 });

  // Warmup lap: first-touch of each density compiles/links shaders and
  // JITs the tween/instancing code paths under SwiftShader, which skews
  // the first real sample low regardless of code changes. Cycle through
  // all four once, unmeasured, before the timed pass below.
  for (const preset of PRESETS) {
    const chip = page.getByRole("button", { name: preset.label, exact: true });
    await chip.click();
    await page.waitForTimeout(600);
  }

  const results = [];
  for (const preset of PRESETS) {
    // preset chip buttons render their label text verbatim (see Scene.tsx)
    const chip = page.getByRole("button", { name: preset.label, exact: true });
    await chip.click();
    await page.waitForTimeout(SETTLE_MS);

    // turn on the perf HUD (the "ᐧ" button) if not already on, then sample
    const perfBtn = page.locator('button[aria-label="Toggle perf readout"]');
    const hudVisibleBefore = await page.locator("text=/fps ·/").count();
    if (hudVisibleBefore === 0) await perfBtn.click();
    await page.waitForTimeout(SAMPLE_MS);

    const hudText = await page.locator("text=/fps ·/").first().textContent().catch(() => null);
    const shot = path.join(OUT, `${TAG}-${preset.key}.png`);
    await page.screenshot({ path: shot });

    const fpsMatch = hudText?.match(/(\d+)\s*fps/);
    const callsMatch = hudText?.match(/(\d+)\s*draws/);
    const trisMatch = hudText?.match(/([\d.]+)k\s*tris/);
    results.push({
      preset: preset.key,
      label: preset.name,
      fps: fpsMatch ? Number(fpsMatch[1]) : null,
      draws: callsMatch ? Number(callsMatch[1]) : null,
      tris_k: trisMatch ? Number(trisMatch[1]) : null,
      screenshot: shot,
    });
  }

  await browser.close();

  console.log(JSON.stringify({ tag: TAG, results, consoleErrors: errors }, null, 2));
  if (errors.length) {
    console.error(`\n${errors.length} console/page error(s) captured — see above.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
