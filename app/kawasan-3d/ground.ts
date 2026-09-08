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
  housing: "#3f5a36",
  village: "#47613c",
  education: "#42603b",
  community: "#3c5738",
};
const GRASS_FALLBACK = "#425c39";
// Undeveloped land: drier, scrubbier, slightly yellow-green so unbuilt
// cells still read as distinct from a kept lawn.
export const UNDEVELOPED_GRASS = "#4a5330";

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
  // Mid-grey base: map multiplies colour, so ~0.5 grey ≈ "leave the base
  // colour alone", blobs lighten/darken it a little.
  ctx.fillStyle = "#7c7c7c";
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
    blob(rnd() * SIZE, rnd() * SIZE, 22 + rnd() * 34, rnd() < 0.5 ? "150,158,120" : "40,46,28", 0.28 + rnd() * 0.22);
  }
  // Fine speckle for a bit of near-range texture (kept subtle).
  for (let i = 0; i < 700; i++) {
    const v = Math.floor(90 + rnd() * 90);
    ctx.fillStyle = `rgba(${v},${v},${Math.floor(v * 0.85)},0.10)`;
    ctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1.4, 1.4);
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
