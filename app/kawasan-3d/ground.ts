"use client";

// Item A: grass tone + patchy variation for the ground tiles of the
// "green" zone kinds (residential / village / school / community) and the
// undeveloped cells. The other kinds — urban / commercial / market /
// industry / river — keep their existing distinct `zoneGroundColor()`
// palette untouched, because the legend + minimap score coding read
// against that per-kind hue.
//
// GPU-cheap by construction: ONE shared canvas noise texture (the same
// module-level-cache + CanvasTexture idiom as roadTexture.ts / windows.ts),
// cloned per tile with a deterministic rotation/offset so adjacent tiles
// don't show the same mottle. A clone shares its source image, so this is
// one GPU upload regardless of tile count; the zone tiles are already one
// mesh each (they carry per-tile hover/select state), so nothing here adds
// a draw call. The noise sits in the material `map` (multiplies the base
// colour ~±18%); the per-kind grass hue and a small deterministic
// per-tile shade jitter live in the material `color`. Layer order, if a
// score tint is ever brought onto the 3D tiles (today it's minimap-only,
// see City3DMapGL.tsx `scoreTint`): base grass `color` × noise `map`, with
// the score tint going on top as an `emissive` add or a second colour
// multiply — it would not fight this.

import * as THREE from "three";
import type { ZoneKind } from "./cityData";

// Kinds that get grass instead of their dark palette colour.
const GRASS_KINDS = new Set<ZoneKind>(["housing", "village", "education", "community"]);
export const isGrassKind = (kind: ZoneKind): boolean => GRASS_KINDS.has(kind);

// Brighter, natural greens — a manicured-lawn family, one nudge per kind
// so a housing estate and a school field aren't identical. Much lighter
// than the old zoneGroundColor() values (#1d2a24 etc.), which read as
// "dark olive/navy", not grass.
const GRASS_BASE: Partial<Record<ZoneKind, string>> = {
  housing: "#3f6241",
  village: "#52683f",
  education: "#426a47",
  community: "#395d40",
};
const GRASS_FALLBACK = "#456342";
// Undeveloped land: drier, scrubbier, slightly yellow-green so unbuilt
// cells still read as distinct from a kept lawn.
export const UNDEVELOPED_GRASS = "#596044";

// Deterministic LCG (same family as windows.ts / vegetation.ts).
function lcg(seed: number) {
  let s = (seed % 2147483647) || 1;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

// Per-tile grass colour: kind base with a small seeded lightness + hue
// jitter so neighbouring lawns differ tile-to-tile as well as within-tile.
export function grassColor(kind: ZoneKind, seed: number): THREE.Color {
  const c = new THREE.Color(GRASS_BASE[kind] ?? GRASS_FALLBACK);
  const rnd = lcg(seed * 2654435761);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    hsl.h + (rnd() - 0.5) * 0.03,
    THREE.MathUtils.clamp(hsl.s + (rnd() - 0.5) * 0.08, 0, 1),
    THREE.MathUtils.clamp(hsl.l * (0.86 + rnd() * 0.3), 0, 1),
  );
  return c;
}

export function undevelopedGrassColor(seed: number): THREE.Color {
  const c = new THREE.Color(UNDEVELOPED_GRASS);
  const rnd = lcg(seed * 40503 + 7);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h + (rnd() - 0.5) * 0.04, hsl.s, THREE.MathUtils.clamp(hsl.l * (0.82 + rnd() * 0.36), 0, 1));
  return c;
}

// ── shared noise texture ────────────────────────────────────────────
const SIZE = 128;
let sharedGrass: THREE.Texture | null = null;

function buildGrassCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  // Albedo maps multiply the material colour in linear space: white is
  // neutral, while sRGB #7c becomes roughly 0.2, crushing the lawn colour.
  // Keep the texture near white and let the material supply the grass hue.
  ctx.fillStyle = "#eeeeee";
  ctx.fillRect(0, 0, SIZE, SIZE);

  const rnd = lcg(20260908);
  // Low-frequency patches: a handful of big soft blobs, lighter and
  // darker, wrapped (drawn 3×3 tiled so RepeatWrapping has no seam).
  const blob = (cx: number, cy: number, r: number, tone: string, a: number) => {
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const g = ctx.createRadialGradient(cx + ox * SIZE, cy + oy * SIZE, 0, cx + ox * SIZE, cy + oy * SIZE, r);
        g.addColorStop(0, `rgba(${tone},${a})`);
        g.addColorStop(1, `rgba(${tone},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(cx + ox * SIZE - r, cy + oy * SIZE - r, r * 2, r * 2);
      }
    }
  };
  for (let i = 0; i < 10; i++) {
    blob(rnd() * SIZE, rnd() * SIZE, 22 + rnd() * 34, rnd() < 0.5 ? "244,244,244" : "156,156,156", 0.12 + rnd() * 0.16);
  }
  // Grass-tick marks: short strokes at random lean, some lighter (fresh
  // blades catching light), some darker (shadow between tufts) — the
  // "grass-tick texture" read from the target mockup. Still one shared
  // canvas; drawn ±SIZE-wrapped so RepeatWrapping stays seamless.
  ctx.lineCap = "round";
  for (let i = 0; i < 240; i++) {
    const x = rnd() * SIZE;
    const y = rnd() * SIZE;
    const len = 2.2 + rnd() * 3.4;
    const lean = (rnd() - 0.5) * 1.1;
    const light = rnd() < 0.55;
    ctx.strokeStyle = light
      ? `rgba(${170 + Math.floor(rnd() * 40)},${180 + Math.floor(rnd() * 40)},120,${0.14 + rnd() * 0.12})`
      : `rgba(38,46,26,${0.16 + rnd() * 0.14})`;
    ctx.lineWidth = 0.9 + rnd() * 0.5;
    for (const ox of [-SIZE, 0, SIZE]) {
      for (const oy of [-SIZE, 0, SIZE]) {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy + len);
        ctx.lineTo(x + ox + lean * len, y + oy - len * 0.4);
        ctx.stroke();
      }
    }
  }
  return canvas;
}

function sharedGrassTexture(): THREE.Texture {
  if (sharedGrass) return sharedGrass;
  const tex = new THREE.CanvasTexture(buildGrassCanvas());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  sharedGrass = tex;
  return tex;
}

// A per-tile view of the one shared texture: clone (shares the GPU image)
// with a deterministic quarter-turn rotation + offset + slight repeat, so
// the mottle pattern differs tile to tile without a second upload.
export function grassTextureFor(seed: number): THREE.Texture {
  const base = sharedGrassTexture();
  const t = base.clone();
  t.needsUpdate = true;
  const rnd = lcg(seed * 668265263 + 3);
  t.center.set(0.5, 0.5);
  t.rotation = (Math.floor(rnd() * 4) * Math.PI) / 2;
  const rep = 1.5 + rnd() * 0.8;
  t.repeat.set(rep, rep);
  t.offset.set(rnd(), rnd());
  return t;
}

// ── paved / bare-earth surfaces (design canvas: TEKSTUR TANAH) ───────
// The non-grass kinds — urban / commercial / market / industry — used to
// paint a single flat `zoneGroundColor()` box (near-black olive/navy). The
// "City Realism" canvas wants "tiled asphalt, paver, soil ... instead of
// one flat colour per kind". Same idiom as the grass texture: ONE shared
// 128² canvas per surface recipe, cloned per tile with a seeded
// rotation/offset, so it stays one GPU upload per recipe regardless of
// tile count and adds no draw call (the tile mesh already exists).

type Surface = "asphalt" | "paver" | "soil";

// Which recipe each paved kind gets, plus its realistic mid-tone base
// (from the design's P palette — much lighter than the old #1a2530 etc.,
// which is the point: lit daytime pavement is grey, not black). Kinds not
// listed (river, and anything new) fall back to zoneGroundColor().
const PAVED: Partial<Record<ZoneKind, { surface: Surface; base: string; rough: number }>> = {
  urban: { surface: "asphalt", base: "#484e55", rough: 0.95 },
  commercial: { surface: "asphalt", base: "#50565d", rough: 0.95 },
  market: { surface: "paver", base: "#8f8a80", rough: 0.9 },
  industry: { surface: "soil", base: "#786e5c", rough: 1 },
};
export const pavedSurfaceFor = (kind: ZoneKind) => PAVED[kind] ?? null;

const RECIPE: Record<Surface, { fill: string; spots: [string, string, string]; count: number; blob: number; grid?: string; seed: number }> = {
  asphalt: { fill: "#ededed", spots: ["196,196,196", "248,248,248", "180,180,180"], count: 320, blob: 2.4, seed: 11 },
  paver: { fill: "#eeeeee", spots: ["210,210,210", "250,250,250", "224,224,224"], count: 160, blob: 2.0, grid: "rgba(100,100,100,0.3)", seed: 5 },
  soil: { fill: "#e8e8e8", spots: ["218,218,218", "166,166,166", "244,244,244"], count: 360, blob: 4.2, seed: 23 },
};

const sharedPaved: Partial<Record<Surface, THREE.Texture>> = {};

function buildPavedCanvas(surface: Surface): HTMLCanvasElement {
  const r = RECIPE[surface];
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = r.fill;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const rnd = lcg(r.seed * 2654435761 + 17);
  // Speckle grain: many small blobs in the recipe's spot tones, 3×3
  // wrapped so RepeatWrapping has no seam. `map` multiplies the base, so
  // near-white retains the material's base colour; grey specks weather it.
  for (let i = 0; i < r.count; i++) {
    const x = rnd() * SIZE;
    const y = rnd() * SIZE;
    const rad = 1 + rnd() * r.blob;
    const tone = r.spots[(rnd() * r.spots.length) | 0];
    ctx.fillStyle = `rgba(${tone},${0.16 + rnd() * 0.34})`;
    for (const ox of [-SIZE, 0, SIZE]) {
      for (const oy of [-SIZE, 0, SIZE]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (r.grid) {
    // Paver joints — a faint 4-cell grid.
    ctx.strokeStyle = r.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= SIZE; i += SIZE / 4) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(SIZE, i); ctx.stroke();
    }
  }
  return canvas;
}

function sharedPavedTexture(surface: Surface): THREE.Texture {
  const cached = sharedPaved[surface];
  if (cached) return cached;
  const tex = new THREE.CanvasTexture(buildPavedCanvas(surface));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  sharedPaved[surface] = tex;
  return tex;
}

// Per-tile clone of the shared paved texture — seeded rotation / repeat /
// offset so adjacent tiles don't align. Paver keeps its repeat integer so
// the joint grid stays square.
export function pavedTextureFor(kind: ZoneKind, seed: number): THREE.Texture | null {
  const p = PAVED[kind];
  if (!p) return null;
  const t = sharedPavedTexture(p.surface).clone();
  t.needsUpdate = true;
  const rnd = lcg(seed * 2246822519 + 13);
  t.center.set(0.5, 0.5);
  t.rotation = (Math.floor(rnd() * 4) * Math.PI) / 2;
  const rep = p.surface === "paver" ? 2 + Math.floor(rnd() * 2) : 1.4 + rnd() * 0.9;
  t.repeat.set(rep, rep);
  t.offset.set(rnd(), rnd());
  return t;
}
