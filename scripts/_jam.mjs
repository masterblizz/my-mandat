import { chromium } from "playwright";
const b = await chromium.launch({ args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-gpu-sandbox", "--disable-dev-shm-usage"] });
const p = await b.newPage({ viewport: { width: 1400, height: 880 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 150)));
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 150)); });
process.stdout.write("nav\n");
await p.goto("http://localhost:3177/kawasan-3d", { waitUntil: "networkidle" });
await p.waitForSelector("canvas", { timeout: 45000 });
process.stdout.write("canvas ok\n");
await p.getByRole("button", { name: "Metro · 16×16", exact: true }).click();
await p.waitForTimeout(5000);
const tb = p.locator('button[aria-label="Cycle traffic density"]');
for (let i = 0; i < 4; i++) {
  const l = (await tb.textContent().catch(() => "")) || "";
  if (/\bPEAK\b/.test(l) && !/AUTO/.test(l)) break;
  await tb.click();
  await p.waitForTimeout(400);
}
process.stdout.write("traffic=" + (await tb.textContent()) + "\n");
await p.waitForTimeout(7000);
await p.screenshot({ path: "docs/webgl-qa-screenshots/jam-metro-peak.png", timeout: 60000 });
process.stdout.write("shot ok errs=" + JSON.stringify(errs.slice(0, 5)) + "\n");
await b.close();
