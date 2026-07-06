/**
 * Removes white studio backgrounds from candidate portraits using edge-seeded
 * flood-fill, then feathers the alpha edge so faces don't look hard-cut.
 *
 * Reads from public/candidate-portraits/{v1,v2,v3}/ and writes in-place.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORTRAIT_DIR = path.join(ROOT, "public", "candidate-portraits");
const VERSIONS = ["v1", "v2", "v3"];

// Pixels whose R,G,B are all above this value are treated as "maybe background"
const BG_THRESHOLD = 215;
// Number of pixels from a background edge to apply feathering
const FEATHER_PX = 3;

async function cleanPortrait(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const px = new Uint8Array(data);

  // ── helpers ──────────────────────────────────────────────────────────────
  const idx = (x, y) => (y * width + x) * 4;
  const isNearWhite = (x, y) => {
    const i = idx(x, y);
    return px[i] > BG_THRESHOLD && px[i + 1] > BG_THRESHOLD && px[i + 2] > BG_THRESHOLD;
  };

  // ── BFS flood-fill from all 4 edges ──────────────────────────────────────
  const bg = new Uint8Array(width * height); // 1 = identified background
  const queue = new Int32Array(width * height);
  let qHead = 0, qTail = 0;

  const seed = (x, y) => {
    const vi = y * width + x;
    if (!bg[vi] && isNearWhite(x, y)) { bg[vi] = 1; queue[qTail++] = vi; }
  };

  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { seed(0, y); seed(width - 1, y); }

  const DIRS = [-1, 1, -width, width]; // left, right, up, down in flat index
  while (qHead < qTail) {
    const vi = queue[qHead++];
    const x = vi % width;
    const y = (vi / width) | 0;
    for (const d of DIRS) {
      const nvi = vi + d;
      const nx = nvi % width;
      const ny = (nvi / width) | 0;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (bg[nvi]) continue;
      if (isNearWhite(nx, ny)) { bg[nvi] = 1; queue[qTail++] = nvi; }
    }
  }

  // ── Set background pixels to fully transparent ────────────────────────────
  for (let vi = 0; vi < width * height; vi++) {
    if (bg[vi]) px[vi * 4 + 3] = 0;
  }

  // ── Feather: reduce alpha of foreground pixels near a background pixel ───
  // Build distance-to-bg map with a simple BFS distance transform
  const dist = new Float32Array(width * height).fill(Infinity);
  const dq = new Int32Array(width * height);
  let dHead = 0, dTail = 0;

  for (let vi = 0; vi < width * height; vi++) {
    if (bg[vi]) { dist[vi] = 0; dq[dTail++] = vi; }
  }

  const DIAG = Math.SQRT2;
  const NEIGHBORS = [
    [-1, -1, DIAG], [0, -1, 1], [1, -1, DIAG],
    [-1,  0, 1],                [1,  0, 1],
    [-1,  1, DIAG], [0,  1, 1], [1,  1, DIAG],
  ];

  while (dHead < dTail) {
    const vi = dq[dHead++];
    const x = vi % width;
    const y = (vi / width) | 0;
    for (const [dx, dy, cost] of NEIGHBORS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nvi = ny * width + nx;
      const nd = dist[vi] + cost;
      if (nd < dist[nvi]) { dist[nvi] = nd; dq[dTail++] = nvi; }
    }
  }

  for (let vi = 0; vi < width * height; vi++) {
    if (bg[vi]) continue; // already transparent
    const d = dist[vi];
    if (d < FEATHER_PX) {
      const alpha = Math.round((d / FEATHER_PX) * 255);
      if (alpha < px[vi * 4 + 3]) px[vi * 4 + 3] = alpha;
    }
  }

  // ── Write result in-place ─────────────────────────────────────────────────
  await sharp(Buffer.from(px.buffer), { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 7 })
    .toFile(filePath + ".tmp");

  fs.renameSync(filePath + ".tmp", filePath);
}

async function main() {
  const files = [];
  for (const ver of VERSIONS) {
    const dir = path.join(PORTRAIT_DIR, ver);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".png")) files.push(path.join(dir, f));
    }
  }

  console.log(`Processing ${files.length} portraits…`);
  let done = 0;
  // Process in parallel batches of 16
  const BATCH = 16;
  for (let i = 0; i < files.length; i += BATCH) {
    await Promise.all(files.slice(i, i + BATCH).map(cleanPortrait));
    done = Math.min(i + BATCH, files.length);
    process.stdout.write(`\r  ${done}/${files.length}`);
  }
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
