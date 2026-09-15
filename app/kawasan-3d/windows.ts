// Lit-window emissive maps for the procedural buildings (procedural.tsx).
//
// The CSS route gives tower/skyscraper/antenna an "organic lit-window map"
// — a seeded scatter of ~40% lit cells baked into one background-image so
// the pattern is stable per building yet differs building to building
// (app/kawasan/page.tsx `litWindowMap`). The WebGL route had nothing
// equivalent: buildings got a flat whole-body emissive tint at dusk/night
// (models.tsx `InstancedBoxes`), which reads as a glowing block, not a
// tower with a mixed occupied/dark floor grid.
//
// This is the texture version of that CSS technique. Same deterministic
// LCG walk and constants as `litWindowMap` (no Math.random — same seed
// yields the same pattern every reload), drawn onto a small offscreen
// canvas as an emissiveMap: near-black everywhere (emissiveMap multiplies
// the material's `emissive`, so black = no glow) with warm `rgb(255,206,
// 120)` panes — the exact CSS lit colour — plus a soft halo so the scene
// bloom (Phase E) has something to catch.
//
// One texture per (type, variant): all instances in a given
// InstancedMesh share it (same granularity the procedural geometry
// variants already work at). Per-instance variety — a UV-offset atlas
// keyed off an instanced attribute — is a possible later refinement;
// per-variant is already a large step up from one uniform body glow.

import * as THREE from "three";
import type { BType } from "./cityData";

type WinSpec = {
  cols: number;      // window columns baked across the texture width
  rows: number;      // window rows baked across the texture height
  litPct: number;    // ~percentage of cells lit (CSS uses ~40)
  repeatY: number;   // vertical texture repeats up a wall face (tall = more)
};

// Tall commercial/residential blocks tile vertically many times; squat
// domestic types get a handful of windows and no vertical tiling.
// litPct raised across the board (towers were going near-black at night —
// a 38% grid of tiny warm dots on a huge dark slab read as "no lights").
const SPEC: Partial<Record<BType, WinSpec>> = {
  tower: { cols: 5, rows: 8, litPct: 58, repeatY: 4 },
  skyscraper: { cols: 6, rows: 10, litPct: 55, repeatY: 6 },
  shophouse: { cols: 3, rows: 3, litPct: 48, repeatY: 1 },
  shop: { cols: 3, rows: 2, litPct: 42, repeatY: 1 },
  mall: { cols: 6, rows: 3, litPct: 58, repeatY: 1 },
  house: { cols: 3, rows: 2, litPct: 50, repeatY: 1 },
  terrace: { cols: 4, rows: 2, litPct: 46, repeatY: 1 },
  kampung: { cols: 3, rows: 2, litPct: 44, repeatY: 1 },
};
const DEFAULT_SPEC: WinSpec = { cols: 5, rows: 7, litPct: 52, repeatY: 3 };

// A real city at night is not one warm colour. Each lit pane picks from
// this weighted palette via the same deterministic LCG that decides
// lit/unlit — so the mix is stable per (type, variant) but varied across
// the skyline. Neon accents (cyan / pink) are deliberately rare.
const WIN_PALETTE: { c: [number, number, number]; w: number }[] = [
  { c: [255, 236, 200], w: 34 }, // warm white
  { c: [255, 202, 128], w: 26 }, // soft yellow (the old single colour)
  { c: [223, 233, 255], w: 18 }, // cool white
  { c: [169, 198, 255], w: 12 }, // office blue
  { c: [120, 255, 240], w: 4 },  // neon cyan
  { c: [255, 130, 220], w: 3 },  // neon pink
  { c: [255, 150, 90], w: 3 },   // sodium orange
];
const WIN_PALETTE_TOTAL = WIN_PALETTE.reduce((s, p) => s + p.w, 0);
function pickPaneColor(roll: number): [number, number, number] {
  let acc = 0;
  for (const p of WIN_PALETTE) {
    acc += p.w;
    if (roll < acc / WIN_PALETTE_TOTAL) return p.c;
  }
  return WIN_PALETTE[0].c;
}

export const windowSpec = (type: BType): WinSpec => SPEC[type] ?? DEFAULT_SPEC;

const SIZE = 128; // power-of-two: safe with RepeatWrapping + mipmaps
const cache = new Map<string, THREE.Texture>();
const facadeCache = new Map<string, THREE.Texture>();

// Daylight façade map. Unlike the emissive map below, this remains visible
// with lit windows disabled: dark inset panes, pale mullions and a few soft
// reflected sky streaks give every procedural building an actual elevation
// instead of a single flat paint colour.
export function getFacadeTexture(type: BType, variant: number): THREE.Texture {
  const key = `${type}:${variant}`;
  const hit = facadeCache.get(key);
  if (hit) return hit;
  const spec = windowSpec(type);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const glassy = type === "tower" || type === "skyscraper" || type === "antenna";
  ctx.fillStyle = glassy ? "#d3dde0" : "#d4d0c7";
  ctx.fillRect(0, 0, SIZE, SIZE);

  let s = ((type.length * 71 + variant * 173 + 19) % 97) + 1;
  const next = () => (s = (s * 1103515245 + 12345) & 0x7fffffff);
  const cw = SIZE / spec.cols;
  const ch = SIZE / spec.rows;
  const mx = Math.max(2, cw * 0.14);
  const my = Math.max(2, ch * 0.16);
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      const shift = ((next() >>> 10) % 12) - 6;
      ctx.fillStyle = glassy
        ? `rgb(${42 + shift},${65 + shift},${80 + shift})`
        : `rgb(${62 + shift},${69 + shift},${70 + shift})`;
      ctx.fillRect(c * cw + mx, r * ch + my, cw - mx * 2, ch - my * 2);
      if (glassy && (r + c + variant) % 3 === 0) {
        ctx.fillStyle = "rgba(202,231,242,0.26)";
        ctx.fillRect(c * cw + mx + 1, r * ch + my + 1, (cw - mx * 2) * 0.24, ch - my * 2 - 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, spec.repeatY);
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  facadeCache.set(key, tex);
  return tex;
}

export function getWindowTexture(type: BType, variant: number): THREE.Texture {
  const key = `${type}:${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const spec = windowSpec(type);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Deterministic LCG — same multiplier/increment/mask as the CSS
  // litWindowMap, seeded off (type, variant) so each procedural bucket
  // lights a different pattern but the same one on every reload.
  let s = ((type.length * 37 + variant * 101 + 13) % 97) + 1;
  const next = () => (s = (s * 1103515245 + 12345) & 0x7fffffff);

  const cw = SIZE / spec.cols;
  const ch = SIZE / spec.rows;
  const mx = cw * 0.22; // mullion gaps around each pane
  const my = ch * 0.26;
  let litCount = 0;

  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      if ((next() >>> 9) % 100 >= spec.litPct) continue;
      litCount++;
      const x = c * cw + mx;
      const y = r * ch + my;
      const w = cw - mx * 2;
      const h = ch - my * 2;
      const cx = x + w / 2;
      const cy = y + h / 2;

      // colour from the weighted palette, plus a per-pane brightness so
      // the grid isn't a uniform sheet of identical squares
      const [pr, pg, pb] = pickPaneColor(((next() >>> 8) % 1000) / 1000);
      const bri = 0.72 + (((next() >>> 7) % 100) / 100) * 0.28;
      const R = Math.round(pr * bri);
      const G = Math.round(pg * bri);
      const B = Math.round(pb * bri);

      const halo = ctx.createRadialGradient(cx, cy, 1, cx, cy, Math.max(cw, ch) * 0.75);
      halo.addColorStop(0, `rgba(${R},${G},${B},0.85)`);
      halo.addColorStop(0.5, `rgba(${R},${G},${B},0.32)`);
      halo.addColorStop(1, `rgba(${R},${G},${B},0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(c * cw - mx, r * ch - my, cw + mx * 2, ch + my * 2);

      ctx.fillStyle = `rgb(${R},${G},${B})`;
      ctx.fillRect(x, y, w, h);
    }
  }
  // A low seed can light zero cells — force one so no building goes fully
  // dark at night (same guard as the CSS litWindowMap).
  if (!litCount) {
    ctx.fillStyle = "rgb(255,226,180)";
    ctx.fillRect(mx, my, cw - mx * 2, ch - my * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, spec.repeatY);
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

// Dense window grid for the KL landmark shafts (klProfile.tsx). Those are
// merged cylinder/box geometry, so the emissiveMap just tiles over
// everything with heavy RepeatWrapping — from any distance it reads as a
// fully-glazed tower lit up at night, which is the whole point ("nampak
// bentuk menara"). Uses the same palette, mostly cool/office tones.
let towerStrip: THREE.Texture | null = null;
export function getTowerStripTexture(): THREE.Texture {
  if (towerStrip) return towerStrip;
  const W = 96;
  const H = 192;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);
  let s = 917;
  const next = () => (s = (s * 1103515245 + 12345) & 0x7fffffff);
  const cols = 8;
  const rows = 16;
  const cw = W / cols;
  const chh = H / rows;
  const mx = cw * 0.24;
  const my = chh * 0.28;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((next() >>> 9) % 100 >= 80) continue;
      const roll = ((next() >>> 8) % 1000) / 1000;
      // bias toward cool/office for a corporate-tower read
      const [pr, pg, pb] = roll < 0.5 ? [223, 233, 255] : roll < 0.8 ? [169, 198, 255] : roll < 0.9 ? [255, 236, 200] : [120, 255, 240];
      const bri = 0.7 + (((next() >>> 7) % 100) / 100) * 0.3;
      ctx.fillStyle = `rgb(${Math.round(pr * bri)},${Math.round(pg * bri)},${Math.round(pb * bri)})`;
      ctx.fillRect(c * cw + mx, r * chh + my, cw - mx * 2, chh - my * 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 15);
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  towerStrip = tex;
  return tex;
}

// DAYTIME facade for the KL landmark shafts (klProfile.tsx) — the twin
// towers were a flat painted metal next to the procedural skyscrapers'
// gridded curtain-wall. This is the sibling `map` of getTowerStripTexture
// (its night emissive): strong vertical mullions (KL towers' signature
// vertical articulation), horizontal floor bands, and dark inset glass
// panes with a few sky-reflection streaks. Tiled hard over the merged
// hex-prism UVs so the pane scale roughly matches the nearby towers.
let towerFacade: THREE.Texture | null = null;
export function getTowerFacadeTexture(): THREE.Texture {
  if (towerFacade) return towerFacade;
  const W = 128;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  let s = 4231;
  const next = () => (s = (s * 1103515245 + 12345) & 0x7fffffff);

  // spandrel / mullion base tone (bluish, so the twins keep their pale
  // landmark colour with material.color left white)
  ctx.fillStyle = "#7f8b98";
  ctx.fillRect(0, 0, W, H);

  const cols = 11;
  const rows = 22;
  const cw = W / cols;
  const ch = H / rows;

  // glass panes
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const j = ((next() >>> 9) % 24) - 12;
      ctx.fillStyle = `rgb(${58 + j},${72 + j},${88 + j})`;
      ctx.fillRect(c * cw + 1.4, r * ch + 1.6, cw - 2.8, ch - 3.2);
      // occasional pale sky-reflection wedge on a pane
      if ((next() >>> 10) % 5 === 0) {
        ctx.fillStyle = "rgba(206,228,242,0.20)";
        ctx.fillRect(c * cw + 1.6, r * ch + 1.8, (cw - 3) * 0.36, ch - 3.6);
      }
    }
  }
  // vertical mullions / pilaster lines — the dominant read at distance
  ctx.fillStyle = "#59636e";
  for (let c = 0; c <= cols; c++) ctx.fillRect(c * cw - 1, 0, 2, H);
  ctx.fillStyle = "rgba(180,196,208,0.35)"; // thin bright highlight beside each
  for (let c = 0; c <= cols; c++) ctx.fillRect(c * cw + 1, 0, 1, H);
  // horizontal floor bands (thinner)
  ctx.fillStyle = "#4f5862";
  for (let r = 0; r <= rows; r++) ctx.fillRect(0, r * ch - 0.75, W, 1.5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 22);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  towerFacade = tex;
  return tex;
}
