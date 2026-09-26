"use client";

// Item 8 (task part C): one prominent roundabout at the central 4-way
// junction (the town-centre / zone-0 intersection — for the even grid
// sizes this route uses, that junction sits at world origin).
//
// The four zone tiles around that junction meet only across the 40-unit
// road gap, so a real-sized ring road unavoidably overlaps their inner
// corners. Rather than reshape the tile geometry, the roundabout is built
// as a slightly RAISED circular deck (ring + island a touch above the
// tile tops): the opaque ring covers the tile-corner overlap from every
// camera angle this scene's CAM_CLAMP allows, and per-cell buildings
// whose slot falls within CLEAR_R of the junction corner are dropped
// (see CityScene's Buildings()) so nothing stands in the carriageway.
//
// Curved geometry is generated here (`ringGeometry`) rather than reusing
// the straight road-segment approach: a flat annulus on XZ with UVs so
// the shared road texture's dashes run around the circumference. The four
// approach roads already cross the junction as full-span planes (Grid()),
// so they are the radiating connectors; the opaque centre island hides
// them where they'd otherwise run through the middle.
//
// Traffic: any vehicle loop whose lane crosses the junction is rerouted
// onto the ring (scenery.tsx detourRoundabout) — enter, circulate
// clockwise, exit on its own road — so nothing drives through the island.

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ROAD_GAP, PLOT, worldCentre } from "./cityData";
import { getRoadTextures, ROAD_TEXTURE_WORLD_LENGTH } from "./roadTexture";

const ROAD_W = ROAD_GAP - PLOT;
const TILE_H = 4;

export const R_IN = 84;
export const R_OUT = 156;
const ISLAND_R = 74;
// A building whose footprint centre is within this Manhattan distance of a
// roundabout tile's junction-facing corner is dropped (see Buildings()).
export const CLEAR_R = 132;

const DECK_Y = TILE_H + 0.4; // just above the tile tops, clears z-fighting

// Height a vehicle at (x, z) should ride at so it sits on the raised ring
// deck instead of sinking into it: road level on the approach, ramping up
// to the deck over the last stretch before the outer edge.
export function roundaboutLift(x: number, z: number, cx: number, cz: number, base = 0): number {
  const d = Math.hypot(x - cx, z - cz);
  const ramp = 22;
  if (d >= R_OUT + ramp) return base;
  if (d <= R_OUT) return DECK_Y;
  return DECK_Y + (base - DECK_Y) * ((d - R_OUT) / ramp);
}

export type RoundaboutCorner = "NW" | "NE" | "SW" | "SE";

// Central junction: grid lines i = j = gridSize/2. World position of that
// crossing, recentred exactly like Grid()'s vRoads/hRoads.
export function roundaboutCentre(gridSize: number): [number, number] {
  const i = gridSize / 2;
  const c = worldCentre(gridSize);
  const p = i * ROAD_GAP - c + ROAD_W / 2;
  return [p, p];
}

// The four tiles touching that junction, and which corner faces it.
export function roundaboutTiles(gridSize: number): { col: number; row: number; corner: RoundaboutCorner }[] {
  const h = gridSize / 2;
  return [
    { col: h - 1, row: h - 1, corner: "SE" },
    { col: h, row: h - 1, corner: "SW" },
    { col: h - 1, row: h, corner: "NE" },
    { col: h, row: h, corner: "NW" },
  ];
}

// Tile-local corner offset (world-X sign, world-Z sign) for each label.
// N = -Z, S = +Z, E = +X, W = -X.
export function cornerSign(c: RoundaboutCorner): [number, number] {
  return [c === "NE" || c === "SE" ? 1 : -1, c === "SW" || c === "SE" ? 1 : -1];
}

// ── ring (circular carriageway) geometry ────────────────────────────
// Flat annulus on the XZ plane. UV = (radialFrac, angleFrac ×
// circumferenceRepeat) so the road texture's dashes run around the ring.
function ringGeometry(rInner: number, rOuter: number, segs = 100): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const repeatV = (2 * Math.PI * ((rInner + rOuter) / 2)) / ROAD_TEXTURE_WORLD_LENGTH;
  for (let s = 0; s <= segs; s++) {
    const a = (s / segs) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    pos.push(ca * rInner, 0, sa * rInner, ca * rOuter, 0, sa * rOuter);
    const v = (s / segs) * repeatV;
    uv.push(0, v, 1, v);
  }
  for (let s = 0; s < segs; s++) {
    const b = s * 2;
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function IslandTree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, DECK_Y, z]}>
      <mesh position={[0, 10, 0]} castShadow>
        <cylinderGeometry args={[1.5, 1.9, 20, 6]} />
        <meshStandardMaterial color="#6b4423" />
      </mesh>
      <mesh position={[0, 25, 0]} castShadow>
        <sphereGeometry args={[11, 8, 6]} />
        <meshStandardMaterial color="#2f6b34" roughness={1} />
      </mesh>
    </group>
  );
}

export function Roundabout({
  gridSize, density,
}: {
  gridSize: number; density: number;
}) {
  const [cx, cz] = useMemo(() => roundaboutCentre(gridSize), [gridSize]);
  const ring = useMemo(() => ringGeometry(R_IN, R_OUT), []);
  const ringTex = useMemo(() => {
    const t = getRoadTextures(density).vertical.clone();
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.rotation = 0;
    t.center.set(0.5, 0.5);
    t.needsUpdate = true;
    return t;
  }, [density]);
  useEffect(() => () => { ring.dispose(); ringTex.dispose(); }, [ring, ringTex]);

  const trees = useMemo(
    () =>
      Array.from({ length: 5 }, (_, k) => {
        const a = (k / 5) * Math.PI * 2 + Math.PI / 5;
        return { x: Math.cos(a) * (ISLAND_R - 16), z: Math.sin(a) * (ISLAND_R - 16) };
      }),
    [],
  );

  return (
    <group position={[cx, 0, cz]}>
      {/* circular carriageway — raised a hair above the tile tops so the
          four adjacent tile corners it overlaps stay hidden underneath */}
      <mesh geometry={ring} position={[0, DECK_Y, 0]} receiveShadow>
        <meshStandardMaterial color="#5a6270" map={ringTex} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* landscaped centre island — opaque disc, hides the straight
          approach roads crossing underneath */}
      <mesh position={[0, DECK_Y - 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ISLAND_R + 3, 44]} />
        <meshStandardMaterial color="#47613c" roughness={1} />
      </mesh>
      {/* raised kerb wall around the island */}
      <mesh position={[0, DECK_Y + 2.5, 0]}>
        <cylinderGeometry args={[ISLAND_R, ISLAND_R, 5, 44, 1, true]} />
        <meshStandardMaterial color="#c7ced9" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* mounded island top */}
      <mesh position={[0, DECK_Y + 3, 0]}>
        <cylinderGeometry args={[ISLAND_R - 6, ISLAND_R, 6, 40]} />
        <meshStandardMaterial color="#47613c" roughness={1} />
      </mesh>
      {/* monument: plinth + obelisk + a flag */}
      <mesh position={[0, DECK_Y + 12, 0]} castShadow>
        <cylinderGeometry args={[6, 9, 14, 8]} />
        <meshStandardMaterial color="#b9bec7" roughness={0.9} />
      </mesh>
      <mesh position={[0, DECK_Y + 34, 0]} castShadow>
        <boxGeometry args={[6, 34, 6]} />
        <meshStandardMaterial color="#d6d3d1" roughness={0.85} />
      </mesh>
      <mesh position={[0, DECK_Y + 58, 0]} castShadow>
        <boxGeometry args={[1.6, 20, 1.6]} />
        <meshStandardMaterial color="#9aa4b2" />
      </mesh>
      <mesh position={[8, DECK_Y + 64, 0]}>
        <boxGeometry args={[15, 9, 0.6]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.15} side={THREE.DoubleSide} />
      </mesh>
      {trees.map((t, i) => <IslandTree key={i} x={t.x} z={t.z} />)}
    </group>
  );
}
