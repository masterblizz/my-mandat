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
const SPEC: Partial<Record<BType, WinSpec>> = {
  tower: { cols: 5, rows: 8, litPct: 42, repeatY: 4 },
  skyscraper: { cols: 6, rows: 9, litPct: 38, repeatY: 6 },
  shophouse: { cols: 4, rows: 3, litPct: 55, repeatY: 2 },
  house: { cols: 3, rows: 2, litPct: 48, repeatY: 1 },
  terrace: { cols: 4, rows: 2, litPct: 42, repeatY: 1 },
  kampung: { cols: 3, rows: 2, litPct: 42, repeatY: 1 },
};
const DEFAULT_SPEC: WinSpec = { cols: 5, rows: 6, litPct: 40, repeatY: 3 };

export const windowSpec = (type: BType): WinSpec => SPEC[type] ?? DEFAULT_SPEC;

const SIZE = 128; // power-of-two: safe with RepeatWrapping + mipmaps
const cache = new Map<string, THREE.Texture>();

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

      const halo = ctx.createRadialGradient(cx, cy, 1, cx, cy, Math.max(cw, ch) * 0.75);
      halo.addColorStop(0, "rgba(255,214,150,0.85)");
      halo.addColorStop(0.5, "rgba(255,198,120,0.32)");
      halo.addColorStop(1, "rgba(255,198,120,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(c * cw - mx, r * ch - my, cw + mx * 2, ch + my * 2);

      ctx.fillStyle = "rgb(255,206,120)";
      ctx.fillRect(x, y, w, h);
    }
  }
  // A low seed can light zero cells — force one so no building goes fully
  // dark at night (same guard as the CSS litWindowMap).
  if (!litCount) {
    ctx.fillStyle = "rgb(255,206,120)";
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
