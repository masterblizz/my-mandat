const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.resolve(root, '..');
const publicCandidates = path.join(root, 'public', 'candidates');
const splitDir = path.join(root, 'public', 'candidate-portraits');
const edgeTransparentHelper = path.join(root, 'scripts', 'edge-transparent-portrait.py');

const sourceSheets = [
  { version: 'v1', file: path.join(sourceRoot, '100ahliV1.png'), columns: 12, rows: 12 },
  // V2 is 11 columns x 12 rows. Cropping it as 12 columns creates half-face
  // fragments from neighbouring portraits.
  { version: 'v2', file: path.join(sourceRoot, '100ahliV2.png'), columns: 11, rows: 12 },
  // V3 has 12 columns x 11 actual portrait rows placed on a 12-row canvas.
  // A forced 12th generated row produces lower-body fragments (old v3-133..v3-144).
  { version: 'v3', file: path.join(sourceRoot, '100ahliV3.png'), columns: 12, rows: 11, positionRows: 12 },
];

// Export higher-resolution portraits; the UI displays them much smaller, so
// this keeps faces sharper after browser scaling.
const OUTPUT_SIZE = 256;
const CELL_INSET = 1;

const stateSeats = [
  ['johor', 26],
  ['kedah', 15],
  ['kelantan', 14],
  ['melaka', 6],
  ['ns', 8],
  ['pahang', 14],
  ['perak', 24],
  ['perlis', 3],
  ['penang', 13],
  ['sabah', 25],
  ['sarawak', 31],
  ['selangor', 22],
  ['terengganu', 8],
  ['wp', 13],
];

function candidateIds() {
  const ids = [];
  for (let i = 1; i <= 25; i += 1) ids.push(`pm-${String(i).padStart(3, '0')}`);
  for (const [stateId, seats] of stateSeats) {
    for (let i = 0; i < seats; i += 1) ids.push(`branch-${stateId}-${i}`);
  }
  return ids;
}

function runFfmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed (${result.status})\n${result.stderr || result.stdout}`);
  }
}

function runPython(args) {
  const result = spawnSync('python', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`python failed (${result.status})\n${result.stderr || result.stdout}`);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function pngSize(file) {
  const buffer = fs.readFileSync(file);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function detectTopBleed(input, x, y, w, h) {
  const scanHeight = Math.min(55, h);
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-i', input,
    '-vf', `crop=${w}:${scanHeight}:${x}:${y}`,
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'
  ], { encoding: 'buffer', maxBuffer: w * scanHeight * 4 + 1024 * 1024 });

  if (result.status !== 0 || !result.stdout?.length) return 14;

  const data = result.stdout;
  for (let row = 0; row < scanHeight; row += 1) {
    let nonWhite = 0;
    for (let col = 0; col < w; col += 1) {
      const offset = (row * w + col) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      if (!(r > 238 && g > 238 && b > 238)) nonWhite += 1;
    }

    // A row with almost no non-white pixels is the first clean studio backdrop
    // row after the bleed strip from the portrait above.
    if (nonWhite < 8) return row;
  }

  return 14;
}

function buildRowTops(input, columns, rows, width, height) {
  const cellLeft = 0;
  const cellRight = Math.round(width / columns);
  const x = cellLeft + CELL_INSET;
  const w = Math.max(1, cellRight - cellLeft - CELL_INSET * 2);
  const tops = [];

  for (let row = 0; row < rows; row += 1) {
    const cellTop = Math.round((row * height) / rows);
    const cellBottom = Math.round(((row + 1) * height) / rows);
    const baseY = cellTop + CELL_INSET;
    const baseH = Math.max(1, cellBottom - cellTop - CELL_INSET * 2);
    const topBleed = row > 0 ? detectTopBleed(input, x, baseY, w, baseH) : 0;
    tops.push(baseY + topBleed);
  }

  return tops;
}

function cropCell(input, output, row, col, columns, rows, width, height, version, positionRows) {
  const cellLeft = Math.round((col * width) / columns);
  const verticalRows = positionRows ?? rows;
  const cellTop = Math.round((row * height) / verticalRows);
  const cellRight = Math.round(((col + 1) * width) / columns);
  const cellBottom = Math.round(((row + 1) * height) / verticalRows);

  // Crop the real cell with a tiny 1px inset to remove grid/gutter pixels only.
  // Then normalise to 105x105 so no profile image has inconsistent dimensions.
  const x = cellLeft + CELL_INSET;
  const w = Math.max(1, cellRight - cellLeft - CELL_INSET * 2);
  const baseY = cellTop + CELL_INSET;
  const baseH = Math.max(1, cellBottom - cellTop - CELL_INSET * 2);
  const topBleed = version === 'v3' && row > 0 && row < rows - 1 ? detectTopBleed(input, x, baseY, w, baseH) : 0;
  // The last real V3 row starts lower than the mathematical grid because the
  // source image has extra white space below it. Use the measured top for
  // v3-121..v3-132 so these are full portraits, not cropped foreheads/bodies.
  const y = version === 'v3' && row === rows - 1 ? 1116 : baseY + topBleed;
  const h = version === 'v3' && row === rows - 1 ? 105 : Math.max(1, baseH - topBleed);

  // First crop/scale without global colorkey. A global white colorkey creates
  // black holes/lines in faces by removing teeth, eyes, and skin highlights.
  // Then remove only backdrop pixels connected to the image edge.
  const tempOutput = `${output}.tmp.png`;
  runFfmpeg([
    '-y',
    '-i', input,
    '-vf', `crop=${w}:${h}:${x}:${y},scale=${OUTPUT_SIZE}:${OUTPUT_SIZE}:flags=lanczos,format=rgba`,
    '-frames:v', '1',
    tempOutput,
  ]);
  runPython([edgeTransparentHelper, tempOutput, output]);
  fs.unlinkSync(tempOutput);
}

function main() {
  ensureDir(publicCandidates);
  ensureDir(splitDir);

  const missing = sourceSheets.filter((sheet) => !fs.existsSync(sheet.file));
  if (missing.length) throw new Error(`Missing source sheet(s): ${missing.map((sheet) => sheet.file).join(', ')}`);

  const portraits = [];
  for (const sheet of sourceSheets) {
    const { version, file, columns, rows, positionRows } = sheet;
    const { width, height } = pngSize(file);
    const versionDir = path.join(splitDir, version);
    ensureDir(versionDir);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const portraitNo = row * columns + col + 1;
        const out = path.join(versionDir, `${version}-${String(portraitNo).padStart(3, '0')}.png`);
        cropCell(file, out, row, col, columns, rows, width, height, version, positionRows);
        portraits.push(out);
      }
    }
  }

  const ids = candidateIds();
  if (portraits.length < ids.length) {
    throw new Error(`Not enough portraits: ${portraits.length} for ${ids.length} candidate profiles`);
  }

  ids.forEach((id, index) => {
    fs.copyFileSync(portraits[index], path.join(publicCandidates, `${id}.png`));
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceSheets: sourceSheets.map((sheet) => ({
      file: path.basename(sheet.file),
      grid: `${sheet.columns}x${sheet.rows}`,
      portraits: sheet.columns * sheet.rows,
    })),
    outputSize: `${OUTPUT_SIZE}x${OUTPUT_SIZE}`,
    cellInset: CELL_INSET,
    splitPortraits: portraits.length,
    assignedProfiles: ids.length,
    assignedRange: {
      first: { id: ids[0], portrait: path.relative(root, portraits[0]).replace(/\\/g, '/') },
      last: { id: ids[ids.length - 1], portrait: path.relative(root, portraits[ids.length - 1]).replace(/\\/g, '/') },
    },
  };
  fs.writeFileSync(path.join(splitDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Split ${portraits.length} portraits from ${sourceSheets.length} sheets.`);
  console.log(`Assigned ${ids.length} candidate profile pictures into public/candidates/*.png.`);
}

main();
