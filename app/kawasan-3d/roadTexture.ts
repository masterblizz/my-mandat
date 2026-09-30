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

  // Asphalt base. A cool mid-grey lets the material colour provide the
  // final TOD lighting while retaining enough room for tyre wear and lane
  // paint to read from the high city camera.
  // A road should be noticeably darker than concrete paving.  The former
  // pale base made the network read like one broad grey sidewalk under the
  // overhead camera instead of weathered asphalt.
  ctx.fillStyle = "#707981";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // Coarse aggregate and soft, irregular tone variation give the asphalt a
  // lived-in surface. Everything remains baked into the one shared texture:
  // no extra meshes or draw calls are needed for this extra definition.
  let seed = 8081 + laneCount * 193;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 18; i++) {
    const x = rnd() * CANVAS_W;
    const y = rnd() * CANVAS_H;
    const r = 7 + rnd() * 18;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rnd() > 0.48 ? "rgba(211,219,224,0.10)" : "rgba(25,31,36,0.16)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.fillStyle = "rgba(15,20,25,0.25)";
  for (let i = 0; i < 340; i++) {
    const x = rnd() * CANVAS_W;
    const y = rnd() * CANVAS_H;
    const size = 0.45 + rnd() * 1.3;
    ctx.fillRect(x, y, size, size);
  }
  // Subtle wheel polishing: narrow, broken tracks rather than hard black
  // rails. They supply scale and traffic history without looking wet at noon.
  ctx.strokeStyle = "rgba(20,27,33,0.18)";
  ctx.lineWidth = 2.1;
  for (const x of [CANVAS_W * 0.27, CANVAS_W * 0.39, CANVAS_W * 0.61, CANVAS_W * 0.73]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= CANVAS_H; y += 18) {
      ctx.lineTo(x + Math.sin(y * 0.075 + rnd() * 3) * 0.8, y);
    }
    ctx.stroke();
  }
  // A handful of tiny repaired patches stop very large junctions reading
  // like a pristine game board. Wrapped placement keeps the repeat seam
  // visually quiet.
  for (let i = 0; i < 7; i++) {
    const x = 7 + rnd() * (CANVAS_W - 14);
    const y = rnd() * CANVAS_H;
    ctx.fillStyle = `rgba(24,28,34,${0.08 + rnd() * 0.08})`;
    ctx.fillRect(x, y, 2 + rnd() * 4, 6 + rnd() * 12);
  }

  // Fine sealed cracks, mostly near the gutters where real paving fails
  // first. Their low opacity keeps the city legible at tactical zoom.
  ctx.strokeStyle = "rgba(25,29,33,0.35)";
  ctx.lineWidth = 0.65;
  for (let i = 0; i < 13; i++) {
    const edge = i % 2 ? 8 + rnd() * 7 : CANVAS_W - 8 - rnd() * 7;
    const y = rnd() * CANVAS_H;
    ctx.beginPath();
    ctx.moveTo(edge, y);
    ctx.lineTo(edge + (rnd() - 0.5) * 8, y + 5 + rnd() * 9);
    ctx.lineTo(edge + (rnd() - 0.5) * 11, y + 12 + rnd() * 11);
    ctx.stroke();
  }

  // Kerb-and-gutter strips stay muted concrete instead of white borders.
  // The old bright strips formed a glowing square grid at the zoom level
  // used by the 3D city; this reads as a real drainage gutter beside asphalt.
  const curbW = CANVAS_W * 0.07;
  ctx.fillStyle = "rgba(164,173,181,0.96)";
  ctx.fillRect(0, 0, curbW, CANVAS_H);
  ctx.fillRect(CANVAS_W - curbW, 0, curbW, CANVAS_H);
  ctx.fillStyle = "rgba(25,33,41,0.82)";
  ctx.fillRect(curbW, 0, 1.8, CANVAS_H);
  ctx.fillRect(CANVAS_W - curbW - 1.8, 0, 1.8, CANVAS_H);
  // Small drainage inlets anchor the gutter rhythm to the road without
  // turning a whole block into bright street furniture.
  ctx.fillStyle = "rgba(19,25,30,0.72)";
  for (let y = 18; y < CANVAS_H; y += 62) {
    for (const x of [1.7, CANVAS_W - curbW + 0.7]) ctx.fillRect(x, y, curbW - 2.4, 5);
  }

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
        // A narrow double yellow centre line reads as a true arterial road
        // from far above, without turning every street into a glowing grid.
        ctx.fillStyle = "rgba(241,190,50,0.94)";
        ctx.fillRect(x - 2.8, 0, 1.7, CANVAS_H);
        ctx.fillRect(x + 1.1, 0, 1.7, CANVAS_H);
      } else {
        // White dashed dividers distinguish same-direction lanes; the
        // yellow median above is reserved for opposing traffic.
        // Paint fades very slightly into the asphalt, closer to a used road
        // than perfectly white game-guide dashes.
        ctx.fillStyle = "rgba(235,239,235,0.79)";
        for (let y = -period; y < CANVAS_H + period; y += period) {
          ctx.fillRect(x - 1.65, y, 3.3, dash);
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
