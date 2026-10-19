const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const output = path.join(process.cwd(), ".multiplayer-test-build");
try {
  fs.rmSync(output, { recursive: true, force: true });
  if (process.platform === "win32") {
    execFileSync("cmd.exe", ["/d", "/s", "/c", "npx tsc -p tsconfig.multiplayer-test.json"], { stdio: "inherit" });
  } else {
    execFileSync("npx", ["tsc", "-p", "tsconfig.multiplayer-test.json"], { stdio: "inherit" });
  }
  require(path.join(output, "tests", "multiplayer-engine.test.js"));
  require(path.join(output, "tests", "online-worlds.test.js"));
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
