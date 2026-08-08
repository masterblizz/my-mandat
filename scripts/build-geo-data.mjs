// One-time (rerun-when-needed) pipeline: pulls real Malaysian state and DUN
// boundary data from DOSM's official open-data repo and writes lightweight
// derived files the app actually ships (public/data/geo/*). Not run at
// request time — see app/components/map/StateZoomMap.tsx for the consumer.
//
// Usage: node scripts/build-geo-data.mjs
import { geoCentroid } from "d3-geo";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const STATE_URL = "https://raw.githubusercontent.com/dosm-malaysia/data-open/main/datasets/geodata/administrative_1_state.geojson";
const DUN_URL = "https://raw.githubusercontent.com/dosm-malaysia/data-open/main/datasets/geodata/electoral_1_dun.geojson";

// DOSM state name -> this game's state id (app/data/states.ts). Most are a
// direct lowercase match; these three aren't.
const STATE_NAME_TO_ID = {
  "Johor": "johor",
  "Kedah": "kedah",
  "Kelantan": "kelantan",
  "Melaka": "melaka",
  "Negeri Sembilan": "ns",
  "Pahang": "pahang",
  "Perak": "perak",
  "Perlis": "perlis",
  "Pulau Pinang": "penang",
  "Sabah": "sabah",
  "Sarawak": "sarawak",
  "Selangor": "selangor",
  "Terengganu": "terengganu",
  // WP Kuala Lumpur / WP Putrajaya / WP Labuan have no DUN (federal
  // territories have no state assembly) and are excluded from the DUN
  // output entirely; the state-boundary file keeps them under one merged
  // "wp" id below only if the game ever needs their outline (it currently
  // doesn't reach StateZoomMap since PRN's state picker filters
  // dunSeats > 0 — see app/setup/page.tsx).
  "W.P. Kuala Lumpur": "wp",
  "W.P. Putrajaya": "wp",
  "W.P. Labuan": "wp",
};

// Known official dunSeats per state (app/data/states.ts) to cross-check
// against — catches silent data drift instead of shipping it unnoticed.
const EXPECTED_DUN_SEATS = {
  johor: 56, kedah: 36, kelantan: 45, melaka: 28, ns: 36, pahang: 42,
  perak: 59, perlis: 15, penang: 40, sabah: 73, sarawak: 82, selangor: 56,
  terengganu: 32,
};

function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function roundCoords(coords, dp) {
  if (typeof coords[0] === "number") return coords.map((c) => round(c, dp));
  return coords.map((c) => roundCoords(c, dp));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed ${res.status}: ${url}`);
  return res.json();
}

async function main() {
  console.log("Fetching state boundaries...");
  const stateGeo = await fetchJson(STATE_URL);
  console.log("Fetching DUN boundaries...");
  const dunGeo = await fetchJson(DUN_URL);

  // ── State outlines: simplify precision, merge the 3 WP entries into one
  // "wp" feature id via a properties tag (kept as separate polygons under
  // one MultiPolygon isn't attempted here — not needed, StateZoomMap never
  // renders wp; each WP feature just gets tagged so it's identifiable if
  // that changes later). ──────────────────────────────────────────────────
  const stateFeatures = stateGeo.features.map((f) => {
    const id = STATE_NAME_TO_ID[f.properties.state];
    if (!id) throw new Error(`Unmapped state name: ${f.properties.state}`);
    return {
      type: "Feature",
      properties: { id, name: f.properties.state },
      geometry: { ...f.geometry, coordinates: roundCoords(f.geometry.coordinates, 3) },
    };
  });
  const stateOut = { type: "FeatureCollection", features: stateFeatures };

  // ── DUN centroids, grouped by state, sorted by code_dun (N.01, N.02, ...)
  // — this order is confirmed (see plan doc) to match this game's existing
  // DUN_NAMES[stateId] array position-for-position. ──────────────────────
  const byState = {};
  for (const f of dunGeo.features) {
    const id = STATE_NAME_TO_ID[f.properties.state];
    if (!id) throw new Error(`Unmapped DUN state name: ${f.properties.state}`);
    (byState[id] ??= []).push(f);
  }

  // Perlis is a KNOWN, already-investigated mismatch (game had 3 bogus DUN
  // names — see Part 2 of the plan doc, app/data/states.ts /
  // app/data/constituencies.ts get corrected separately to 15 seats). Any
  // OTHER mismatch is unexpected data drift and should fail the build.
  const KNOWN_MISMATCHES = new Set(["perlis"]);

  const dunOut = {};
  const unexpectedMismatches = [];
  const knownMismatches = [];
  for (const [id, features] of Object.entries(byState)) {
    features.sort((a, b) => a.properties.code_dun.localeCompare(b.properties.code_dun, undefined, { numeric: true }));
    dunOut[id] = features.map((f) => {
      const [lng, lat] = geoCentroid(f);
      return { code: f.properties.code_dun, name: f.properties.dun.replace(/^N\.\d+\s+/, ""), lng: round(lng, 5), lat: round(lat, 5) };
    });
    const expected = EXPECTED_DUN_SEATS[id];
    if (expected !== undefined && expected !== dunOut[id].length) {
      const msg = `${id}: expected ${expected}, got ${dunOut[id].length}`;
      (KNOWN_MISMATCHES.has(id) ? knownMismatches : unexpectedMismatches).push(msg);
    }
  }

  const missingFromSource = Object.keys(EXPECTED_DUN_SEATS).filter((id) => !dunOut[id]);
  if (missingFromSource.length) unexpectedMismatches.push(`missing from source entirely: ${missingFromSource.join(", ")}`);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.join(__dirname, "..", "public", "data", "geo");
  writeFileSync(path.join(outDir, "malaysia-states.geojson"), JSON.stringify(stateOut));
  writeFileSync(path.join(outDir, "dun-points.json"), JSON.stringify(dunOut));

  console.log(`Wrote malaysia-states.geojson (${stateFeatures.length} features)`);
  console.log(`Wrote dun-points.json (${Object.keys(dunOut).length} states, ${Object.values(dunOut).reduce((s, a) => s + a.length, 0)} seats)`);

  if (knownMismatches.length) {
    console.warn("\nKnown mismatches (expected, fixed separately in app/data/*):");
    knownMismatches.forEach((m) => console.warn(`  - ${m}`));
  }

  if (unexpectedMismatches.length) {
    console.error("\nUNEXPECTED seat-count mismatches vs app/data/states.ts:");
    unexpectedMismatches.forEach((m) => console.error(`  - ${m}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
