/**
 * Remaps CANDIDATE_PORTRAIT_MAP so every female candidate gets a female portrait
 * and every male candidate gets a male portrait.
 *
 * Run: node scripts/fix-portrait-genders.js
 * Outputs TypeScript code to replace the CANDIDATE_PORTRAIT_MAP block in page.tsx.
 */

// ── Portrait gender data (from manual visual audit of all 408 portraits) ──────
// Female portrait numbers within each version folder
const V1_FEMALE = new Set([
  5, 14, 25, 28, 31, 32, 37, 38, 41, 42, 45, 51, 56, 58, 60, 62, 67, 69,
  77, 78, 79, 80, 81, 83, 86, 88, 90, 92, 95, 97, 98, 102, 103, 105, 106,
  107, 110, 113, 115, 117, 119, 122, 124, 128, 130, 133, 138, 139, 140, 142,
]);
const V2_FEMALE = new Set([
  5, 6, 10, 14, 17, 18, 20, 24, 28, 33, 36, 41, 46, 51, 52, 53, 54, 57, 60,
  64, 67, 68, 69, 76, 78, 81, 85, 91, 94, 95, 96, 101, 109, 113, 114, 118,
  125, 126, 130,
]);
const V3_FEMALE = new Set([
  10, 13, 14, 18, 21, 22, 23, 25, 29, 33, 37, 39, 40, 43, 45, 46, 49, 52,
  54, 55, 58, 62, 65, 66, 68, 69, 70, 77, 79, 81, 85,
  // newly audited (v3-086 through v3-132):
  86, 89, 100, 114, 120, 122, 129,
]);

// Portrait counts per version (v3 has 132, not 88 as previously assumed)
const V1_COUNT = 144;
const V2_COUNT = 132;
const V3_COUNT = 132;

function portraitSrc(n) {
  if (n <= V1_COUNT)
    return `/candidate-portraits/v1/v1-${String(n).padStart(3, "0")}.png`;
  if (n <= V1_COUNT + V2_COUNT)
    return `/candidate-portraits/v2/v2-${String(n - V1_COUNT).padStart(3, "0")}.png`;
  return `/candidate-portraits/v3/v3-${String(n - V1_COUNT - V2_COUNT).padStart(3, "0")}.png`;
}

function isPortraitFemale(n) {
  if (n <= V1_COUNT) return V1_FEMALE.has(n);
  if (n <= V1_COUNT + V2_COUNT) return V2_FEMALE.has(n - V1_COUNT);
  return V3_FEMALE.has(n - V1_COUNT - V2_COUNT);
}

// Round-robin interleave so portraits from all three versions are spread evenly.
// Without interleaving, sequential assignment exhausts v1 and v2 before reaching
// any v3 portraits, leaving all of v3 unused for the 247-candidate pool.
function interleave(a, b, c) {
  const result = [];
  const len = Math.max(a.length, b.length, c.length);
  for (let i = 0; i < len; i++) {
    if (i < a.length) result.push(a[i]);
    if (i < b.length) result.push(b[i]);
    if (i < c.length) result.push(c[i]);
  }
  return result;
}

// ── Candidate ordering (mirrors CANDIDATE_PORTRAIT_MAP ordering) ──────────────
const STATE_SEATS = [
  ["johor", 26], ["kedah", 15], ["kelantan", 14], ["melaka", 6], ["ns", 8],
  ["pahang", 14], ["perak", 24], ["perlis", 3], ["penang", 13], ["sabah", 25],
  ["sarawak", 31], ["selangor", 22], ["terengganu", 8], ["wp", 13],
];
const PM_FEMALE = new Set([2, 4, 7, 12, 14, 16, 19, 23, 25]);

const candidates = [];

for (let i = 1; i <= 25; i++) {
  candidates.push({
    id: `pm-${String(i).padStart(3, "0")}`,
    isFemale: PM_FEMALE.has(i),
  });
}

let flatIndex = 0;
for (const [state, seats] of STATE_SEATS) {
  for (let j = 0; j < seats; j++) {
    const constituencyId = `${state}-${j}`;
    const charCodeSum = constituencyId
      .split("")
      .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const seed = charCodeSum + flatIndex * 17;
    const nameIdx = seed % 16;
    candidates.push({
      id: `branch-${constituencyId}`,
      isFemale: nameIdx % 2 === 1,
    });
    flatIndex++;
  }
}

// ── Build portrait pools — v2-004..v2-132 EXCLUDED (defective batch crop) ──────
// v2-001, v2-002, v2-003 are the only clean v2 portraits (all male).
// All other v2 portraits were incorrectly cropped from a contact sheet and show
// parts of adjacent portraits (other people visible at top and side edges).
const V2_CLEAN_MAX = 3;
const TOTAL_PORTRAITS = V1_COUNT + V2_COUNT + V3_COUNT;
const v1Female = [], v3Female = [];
const v1Male  = [], v2Male  = [], v3Male  = [];
for (let n = 1; n <= TOTAL_PORTRAITS; n++) {
  const female = isPortraitFemale(n);
  if (n <= V1_COUNT) {
    female ? v1Female.push(n) : v1Male.push(n);
  } else if (n <= V1_COUNT + V2_COUNT) {
    const v2n = n - V1_COUNT;
    if (v2n <= V2_CLEAN_MAX && !female) v2Male.push(n); // only 3 clean v2 males
    // skip all other v2 (defective)
  } else {
    female ? v3Female.push(n) : v3Male.push(n);
  }
}
// Interleave v1/v3 so both versions are spread evenly; v2 clean males folded in
const femalePortraits = interleave(v1Female, v3Female, []);
const malePortraits   = interleave(v1Male,   v3Male,   v2Male);

const femaleCandidates = candidates.filter((c) => c.isFemale);
const maleCandidates = candidates.filter((c) => !c.isFemale);

console.error(`Total candidates   : ${candidates.length}`);
console.error(`Female candidates  : ${femaleCandidates.length}`);
console.error(`Male candidates    : ${maleCandidates.length}`);
console.error(`Female portraits   : ${femalePortraits.length} (v1:${v1Female.length} v2:0 excluded v3:${v3Female.length})`);
console.error(`Male portraits     : ${malePortraits.length} (v1:${v1Male.length} v2_clean:${v2Male.length} v3:${v3Male.length})`);
if (femaleCandidates.length > femalePortraits.length) {
  console.error(
    `⚠  ${femaleCandidates.length - femalePortraits.length} female candidates will share a portrait`
  );
}

// ── Assign portraits ──────────────────────────────────────────────────────────
// PM female candidates always get unique portraits from the pool head.
// Overflow branch female candidates cycle starting AFTER PM portrait positions
// so PM member portraits are never duplicated.
const PM_FEMALE_COUNT = candidates.filter((c) => c.id.startsWith("pm-") && c.isFemale).length;

const newMap = new Map();
femaleCandidates.forEach((cand, i) => {
  let portraitIdx;
  if (i < femalePortraits.length) {
    portraitIdx = i;
  } else {
    const cycleOffset = i - femalePortraits.length;
    portraitIdx = PM_FEMALE_COUNT + (cycleOffset % (femalePortraits.length - PM_FEMALE_COUNT));
  }
  newMap.set(cand.id, portraitSrc(femalePortraits[portraitIdx]));
});
maleCandidates.forEach((cand, i) => {
  newMap.set(cand.id, portraitSrc(malePortraits[i % malePortraits.length]));
});

// ── Emit TypeScript IIFE replacement ─────────────────────────────────────────
const lines = [];
lines.push("const CANDIDATE_PORTRAIT_MAP: Map<string, string> = new Map([");
for (const cand of candidates) {
  lines.push(`  ["${cand.id}", "${newMap.get(cand.id)}"],`);
}
lines.push("]);");
console.log(lines.join("\n"));
