import { chromium } from "playwright";
const b = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-gpu-sandbox", "--no-sandbox", "--disable-dev-shm-usage"],
});
const p = await b.newPage({ viewport: { width: 1400, height: 880 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e.message)));
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await p.goto("http://localhost:3177/kawasan-3d", { waitUntil: "networkidle" });
await p.waitForSelector("canvas", { timeout: 40000 });
await p.getByRole("button", { name: "Dense metro · 12×12", exact: true }).click();
await p.waitForTimeout(2500);
const tod = p.locator('button[aria-label="Cycle time of day"]');
for (let i = 0; i < 3; i++) {
  const l = (await tod.textContent().catch(() => "")) || "";
  if (/malam|night/i.test(l)) break;
  await tod.click();
  await p.waitForTimeout(600);
}
await p.waitForTimeout(3500);
let ok = false;
for (let a = 0; a < 4 && !ok; a++) {
  try { await p.screenshot({ path: "docs/webgl-qa-screenshots/nightlit-dense.png", timeout: 45000 }); ok = true; }
  catch (e) { console.log("retry " + a + ": " + e.message); await p.waitForTimeout(2000); }
}
console.log(JSON.stringify({ tod: await tod.textContent(), shot: ok, errors: errs }));
await b.close();
