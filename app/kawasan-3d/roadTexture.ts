// Road surface + crosswalk textures, generated once on an offscreen
// <canvas> and reused everywhere via UV tiling — no per-segment geometry,
// no per-marking draw call. Ported VISUALLY (not technique-for-technique,
// canvas 2D standing in for CSS background-image layering) from the CSS
// version's laneBg()/`.kw-road-x`/`.kw-road-y` (app/kawasan/page.tsx,
// app/globals.css): asphalt base, density-scaled lane-line count (a rural
// single-track road carries no markings; dense metro gets a 3-lane
// boulevard with a median), yellow dashed dividers, light curb edges.
//
// NOTE: this was the first canvas-texture generator in app/kawasan-3d/ —
// there was no existing pattern to reuse, since the CSS "organic
// lit-window map" is a CSS-only technique and this route's original
// window-lighting (models.tsx's InstancedBoxes) was a flat per-instance
// emissive tint. windows.ts later ported that lit-window map here as a
// real emissiveMap for the procedural buildings, following this file's
// module-level canvas cache + CanvasTexture idiom.

import * as THREE from "three";

type LaneConfig = { count: number; medianIndex: number };

// Mirrors the CSS version's LANE_OFFSETS/LANE_MEDIAN_INDEX thresholds
// exactly (same density cutoffs), expressed as a lane count instead of
// pixel offsets since the canvas draws its own even spacing.
function laneConfigForDensity(density: number): LaneConfig {
  if (density >= 0.85) return { count: 3, medianIndex: 1 };
  if (density >= 0.62) return { count: 2, medianIndex: -1 };
  if (density >= 0.3) return { count: 1, medianIndex: -1 };
  return { count: 0, medianIndex: -1 };
}

const CANVAS_W = 64; // road-width axis — never repeated
const CANVAS_H = 256; // road-length axis — tiled via wrapT repeat
// One canvas-length tile = this many world units of road, so the dash
// pattern reads at a consistent physical scale regardless of how long an
// individual road segment (which spans the whole grid, see CityScene.tsx)
// ends up being at a given density.
export const ROAD_TEXTURE_WORLD_LENGTH = 140;

const roadCanvasCache = new Map<number, HTMLCanvasElement>();

function buildRoadCanvas(laneCount: number, medianIndex: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;

  // Asphalt base — drawn white so the plane's own meshStandardMaterial
  // `color` (ROAD_COLOR, see CityScene.tsx) tints it; only the curb/lane
  // paint below needs to carry real colour.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // Faint asphalt noise/variation so it doesn't read as a flat sticker.
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * CANVAS_W;
    const y = Math.random() * CANVAS_H;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Curb strips along both edges (light concrete, matches the CSS
  // sidewalk's paver-slab tone rather than the asphalt).
  const curbW = CANVAS_W * 0.1;
  ctx.fillStyle = "rgba(226,232,240,0.65)";
  ctx.fillRect(0, 0, curbW, CANVAS_H);
  ctx.fillRect(CANVAS_W - curbW, 0, curbW, CANVAS_H);

  // Lane markings: evenly spaced across the drivable width (inside the
  // curbs), one solid median if medianIndex is set, dashed dividers
  // otherwise — same "rural = none, dense metro = median" progression as
  // the CSS version.
  if (laneCount > 0) {
    const usableL = curbW + 4;
    const usableR = CANVAS_W - curbW - 4;
    const dash = 26, gap = 20, period = dash + gap;
    for (let i = 0; i < laneCount; i++) {
      const x = usableL + ((i + 1) / (laneCount + 1)) * (usableR - usableL);
      if (i === medianIndex) {
        ctx.fillStyle = "rgba(250,204,21,0.92)";
        ctx.fillRect(x - 1.6, 0, 3.2, CANVAS_H);
      } else {
        ctx.fillStyle = "rgba(250,204,21,0.8)";
        for (let y = -period; y < CANVAS_H + period; y += period) {
          ctx.fillRect(x - 1.1, y, 2.2, dash);
        }
      }
    }
  }

  return canvas;
}

// Returns a { vertical, horizontal } texture pair for the given density's
// lane config — `vertical` has its length axis on V (for vRoads' plane,
// whose local Y == world length), `horizontal` is the same image rotated
// 90° (for hRoads' plane, whose local X == world length). Cached per lane
// config so switching density presets doesn't regenerate canvases.
const textureCache = new Map<string, { vertical: THREE.CanvasTexture; horizontal: THREE.CanvasTexture }>();

export function getRoadTextures(density: number): { vertical: THREE.CanvasTexture; horizontal: THREE.CanvasTexture } {
  const { count, medianIndex } = laneConfigForDensity(density);
  const key = `${count}:${medianIndex}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  // `count` uniquely determines `medianIndex` in laneConfigForDensity, so
  // caching the canvas by count alone is sufficient.
  let canvas = roadCanvasCache.get(count);
  if (!canvas) {
    canvas = buildRoadCanvas(count, medianIndex);
    roadCanvasCache.set(count, canvas);
  }

  const vertical = new THREE.CanvasTexture(canvas);
  vertical.wrapS = THREE.ClampToEdgeWrapping;
  vertical.wrapT = THREE.RepeatWrapping;
  vertical.colorSpace = THREE.SRGBColorSpace;
  vertical.needsUpdate = true;

  const horizontal = vertical.clone();
  horizontal.image = canvas;
  horizontal.center.set(0.5, 0.5);
  horizontal.rotation = Math.PI / 2;
  horizontal.wrapS = THREE.RepeatWrapping;
  horizontal.wrapT = THREE.ClampToEdgeWrapping;
  horizontal.needsUpdate = true;

  const pair = { vertical, horizontal };
  textureCache.set(key, pair);
  return pair;
}

// Crosswalk (zebra-stripe) decal texture — a single shared square texture,
// applied to instances scaled/rotated per intersection. White stripes on
// transparent background so it decals cleanly over the road surface below.
let crosswalkTexture: THREE.CanvasTexture | null = null;
export function getCrosswalkTexture(): THREE.CanvasTexture {
  if (crosswalkTexture) return crosswalkTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  const stripeW = 7, gapW = 6, period = stripeW + gapW;
  for (let x = 2; x < size; x += period) ctx.fillRect(x, 0, stripeW, size);
  crosswalkTexture = new THREE.CanvasTexture(canvas);
  crosswalkTexture.colorSpace = THREE.SRGBColorSpace;
  crosswalkTexture.needsUpdate = true;
  return crosswalkTexture;
}
