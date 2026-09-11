"use client";

// Bukit-Bintang-style LED billboards / ad screens. A scene-dressing
// sibling that ANCHORS TO REAL BUILDING INSTANCES: it reproduces
// CityScene's per-zone building layout (zoneBuildings → slotPos → world
// box + klHeightMult height), picks a few tall buildings per eligible
// zone and mounts a flat "screen" flush against the wall face that points
// at a road. Standalone billboards get a real two-post frame reaching the
// panel. If a zone has no tall building, it gets no panel (no floaters).
//
// Panels: one InstancedMesh per colour variant (~6 draws total),
// `toneMapped:false` so they read as lit by day and bloom at night, with
// a throttled colour pulse for a "screen is playing" feel.

import { useMemo, useRef, useLayoutEffect, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  PLOT, slotPos, zoneBuildings, FLAT_TYPES,
  type CellPlacement, type ZoneKind, type BType, type SeatTraits,
} from "./cityData";
import { klHeightMult } from "./klProfile";

const TILE_H = 4;

const VARIANTS = ["#2f6bff", "#ff5a2a", "#eef2ff", "#12e6ff", "#ff3fd0", "#ffd23f"] as const;

// One procedural "advertisement" per colour variant, drawn to a canvas and
// used as the screen's `map` so it's actually readable when you zoom in:
// tinted ground, faux logo glyph, a bold headline word, body-copy bars and
// a corner "AD" tag, inside a bezel margin.
const AD_WORDS = ["MEGA SALE", "GRAND OPEN", "NEW SEASON", "50% OFF", "SHOP NOW", "SOON"];
function makeAdTexture(hex: string, seed: number): THREE.CanvasTexture {
  const W = 512, H = 256;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;
  let s = ((seed + 1) * 2654435761) >>> 0;
  const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);

  g.fillStyle = hex;
  g.fillRect(0, 0, W, H);
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0.24)");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  const c = new THREE.Color(hex);
  const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  const ink = lum > 0.62 ? "#0b1220" : "#ffffff";
  const inkDim = lum > 0.62 ? "rgba(11,18,32,0.5)" : "rgba(255,255,255,0.55)";

  g.strokeStyle = ink;
  g.globalAlpha = 0.28;
  g.lineWidth = 8;
  g.strokeRect(12, 12, W - 24, H - 24);
  g.globalAlpha = 1;

  // logo glyph, top-left
  g.fillStyle = ink;
  const glyph = seed % 3;
  if (glyph === 0) { g.beginPath(); g.arc(58, 56, 26, 0, Math.PI * 2); g.fill(); }
  else if (glyph === 1) { g.beginPath(); g.moveTo(58, 26); g.lineTo(88, 84); g.lineTo(28, 84); g.closePath(); g.fill(); }
  else { g.fillRect(30, 30, 54, 54); }

  // headline
  g.fillStyle = ink;
  g.font = "bold 56px Arial, Helvetica, sans-serif";
  g.textBaseline = "top";
  g.fillText(AD_WORDS[seed % AD_WORDS.length], 30, 104);

  // body-copy bars
  g.fillStyle = inkDim;
  for (let i = 0; i < 3; i++) g.fillRect(30, 178 + i * 20, 200 + r() * 210, 9);

  // corner "AD" tag
  g.fillStyle = ink;
  g.fillRect(W - 118, 22, 92, 40);
  g.fillStyle = hex;
  g.font = "bold 26px Arial, Helvetica, sans-serif";
  g.fillText("AD", W - 102, 28);

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// buildings a billboard may hang off — anything with a real flat-ish wall
const MOUNT_TYPES = new Set<BType>([
  "tower", "skyscraper", "shophouse", "mall", "hospital", "museum",
  "terminal", "factory", "warehouse", "clinic", "school", "library", "powerplant",
]);

// yaw so the panel's face points along the outward normal (matches the
// box geometry whose "thickness" is on local Z)
function yawFor(nx: number, nz: number): number {
  if (nx > 0) return Math.PI / 2;
  if (nx < 0) return -Math.PI / 2;
  if (nz > 0) return Math.PI;
  return 0;
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0) || 1;
}
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

function billboardCount(kind: ZoneKind, coreness: number, gridSize: number): number {
  if (gridSize <= 6) return 0;
  const urbanish = kind === "urban" || kind === "commercial" || kind === "market";
  if (gridSize <= 8) return urbanish && coreness > 0.35 ? 1 : 0;
  let n = urbanish
    ? Math.round(1 + coreness * 3.2)
    : (kind === "community" || kind === "education") && coreness > 0.55 ? 1 : 0;
  if (gridSize >= 22) n = Math.min(n, 2);
  return n;
}

type Panel = { x: number; y: number; z: number; yaw: number; w: number; h: number; variant: number };
type Strut = { x: number; y: number; z: number; sx: number; sy: number; sz: number };
type BBox = { type: BType; bx: number; bz: number; bw: number; bd: number; bh: number };

export function Billboards({
  placed, gridSize, density, traits, winLit, claimed,
}: {
  placed: CellPlacement[];
  gridSize: number;
  density: number;
  traits: SeatTraits;
  winLit: number;
  claimed?: Set<string>;
}) {
  const winLitRef = useRef(winLit);
  winLitRef.current = winLit;

  // build the ad textures once, client-side (canvas → CanvasTexture)
  const [adTex, setAdTex] = useState<THREE.CanvasTexture[]>([]);
  useEffect(() => {
    const t = VARIANTS.map((h, i) => makeAdTexture(h, i));
    setAdTex(t);
    return () => t.forEach((x) => x.dispose());
  }, []);

  const { panels, struts } = useMemo(() => {
    const panels: Panel[] = [];
    const struts: Strut[] = [];
    const mid = (gridSize - 1) / 2;
    const maxD = Math.hypot(mid, mid) || 1;

    for (const { zone, col, row, cx, cz } of placed) {
      if (claimed?.has(`${col},${row}`)) continue;
      const coreness = 1 - Math.hypot(col - mid, row - mid) / maxD;
      const n = billboardCount(zone.kind, coreness, gridSize);
      if (!n) continue;
      const rnd = rng(hashSeed(`${zone.id}:bb`));

      // reproduce CityScene's building layout for this zone
      const boxes: BBox[] = [];
      for (const spec of zoneBuildings(zone, density, traits, coreness)) {
        if (FLAT_TYPES.includes(spec.type)) continue;
        const sp = slotPos(spec.slot);
        const vertical = spec.type === "tower" || spec.type === "skyscraper" || spec.type === "antenna";
        const h0 = Math.max(spec.h, 6);
        const bh = vertical
          ? Math.min(275, Math.max(14, h0 * klHeightMult(col, row, gridSize)))
          : h0;
        boxes.push({
          type: spec.type,
          bx: cx - PLOT / 2 + sp.x + spec.w / 2,
          bz: cz - PLOT / 2 + sp.y + spec.d / 2,
          bw: spec.w, bd: spec.d, bh,
        });
      }

      // mountable = tall enough + a real wall type; tallest first
      const mount = boxes
        .filter((b) => b.bh >= 42 && MOUNT_TYPES.has(b.type))
        .sort((a, b) => b.bh - a.bh)
        .slice(0, n);

      for (let i = 0; i < mount.length; i++) {
        const b = mount[i];
        // face whose outward normal points at the nearest tile edge
        const dPX = cx + PLOT / 2 - (b.bx + b.bw / 2);
        const dNX = (b.bx - b.bw / 2) - (cx - PLOT / 2);
        const dPZ = cz + PLOT / 2 - (b.bz + b.bd / 2);
        const dNZ = (b.bz - b.bd / 2) - (cz - PLOT / 2);
        const m = Math.min(dPX, dNX, dPZ, dNZ);
        let nx = 0;
        let nz = 0;
        if (m === dPX) nx = 1; else if (m === dNX) nx = -1; else if (m === dPZ) nz = 1; else nz = -1;
        const halfDepth = nx !== 0 ? b.bw / 2 : b.bd / 2;
        const faceW = nx !== 0 ? b.bd : b.bw;

        // size class relative to THIS building
        const roll = rnd();
        let w = roll < 0.24 ? 34 + rnd() * 20 : roll < 0.72 ? 22 + rnd() * 12 : 14 + rnd() * 8;
        let h = roll < 0.24 ? 22 + rnd() * 12 : roll < 0.72 ? 13 + rnd() * 7 : 7 + rnd() * 4;
        w = Math.min(w, faceW * 0.9);
        h = Math.min(h, b.bh * 0.5);
        if (w < 8 || h < 5) continue; // wall too small — skip, don't float

        // vertical placement: a floor level well within the wall
        const yFrac = 0.45 + rnd() * 0.35;
        const y = Math.max(
          TILE_H + 9 + h / 2,
          Math.min(TILE_H + b.bh - h / 2 - 2, TILE_H + b.bh * yFrac),
        );
        // lateral slide, clamped so the panel never overhangs the wall
        const latMax = Math.max(0, faceW / 2 - w / 2 - 2);
        const slide = (rnd() - 0.5) * 2 * latMax;

        panels.push({
          x: b.bx + nx * (halfDepth + 0.7) + (nx === 0 ? slide : 0),
          z: b.bz + nz * (halfDepth + 0.7) + (nz === 0 ? slide : 0),
          y,
          yaw: yawFor(nx, nz),
          w, h,
          variant: Math.floor(rnd() * VARIANTS.length),
        });
      }

      // standalone screen tower — only on a tile corner clear of every
      // building footprint, and it gets a real 2-post frame.
      const urbanish = zone.kind === "urban" || zone.kind === "commercial" || zone.kind === "market";
      const civic = zone.kind === "community" || zone.kind === "education";
      if (gridSize >= 10 && ((urbanish && rnd() < 0.16) || (civic && rnd() < 0.1))) {
        const sxS = rnd() < 0.5 ? -1 : 1;
        const szS = rnd() < 0.5 ? -1 : 1;
        const px = cx + sxS * (PLOT / 2 - 28);
        const pz = cz + szS * (PLOT / 2 - 28);
        const clear = !boxes.some(
          (b) => Math.abs(px - b.bx) < b.bw / 2 + 14 && Math.abs(pz - b.bz) < b.bd / 2 + 14,
        );
        if (clear) {
          const pw = 30 + rnd() * 14;
          const ph = 20 + rnd() * 10;
          const postTop = 40 + rnd() * 22;
          const post = 3.2;
          const bY = TILE_H + postTop; // panel BOTTOM sits exactly here
          // base plinth
          struts.push({ x: px, y: TILE_H + 2, z: pz, sx: pw * 0.5, sy: 4, sz: 10 });
          // two posts up to the panel
          for (const s of [-1, 1] as const) {
            struts.push({ x: px + s * pw * 0.34, y: TILE_H + postTop / 2, z: pz, sx: post, sy: postTop, sz: post });
          }
          // top beam
          struts.push({ x: px, y: bY + 1, z: pz, sx: pw * 0.8, sy: 3, sz: 4 });
          // face the tile centre
          const yaw = Math.abs(px - cx) > Math.abs(pz - cz) ? yawFor(px > cx ? -1 : 1, 0) : yawFor(0, pz > cz ? -1 : 1);
          panels.push({
            x: px, y: bY + ph / 2, z: pz, yaw, w: pw, h: ph,
            variant: Math.floor(rnd() * VARIANTS.length),
          });
        }
      }
    }
    return { panels, struts };
  }, [placed, gridSize, density, traits, claimed]);

  const byVariant = useMemo(() => {
    const m: Panel[][] = VARIANTS.map(() => []);
    for (const p of panels) m[p.variant].push(p);
    return m;
  }, [panels]);

  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const matRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const strutRef = useRef<THREE.InstancedMesh>(null);
  const frameRef = useRef<THREE.InstancedMesh>(null);
  const acc = useRef(0);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    byVariant.forEach((list, vi) => {
      const mesh = meshRefs.current[vi];
      if (!mesh) return;
      list.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.set(p.w, p.h, 2.2);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
    const st = strutRef.current;
    if (st) {
      struts.forEach((s, i) => {
        dummy.position.set(s.x, s.y, s.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(s.sx, s.sy, s.sz);
        dummy.updateMatrix();
        st.setMatrixAt(i, dummy.matrix);
      });
      st.instanceMatrix.needsUpdate = true;
      st.computeBoundingSphere();
    }
    // dark bezel/frame sitting just behind every screen face
    const fr = frameRef.current;
    if (fr) {
      panels.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.set(p.w + 3.6, p.h + 3.6, 1.4);
        dummy.updateMatrix();
        fr.setMatrixAt(i, dummy.matrix);
      });
      fr.instanceMatrix.needsUpdate = true;
      fr.computeBoundingSphere();
    }
  }, [byVariant, struts, panels]);

  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.09) return;
    acc.current = 0;
    const now = performance.now() / 1000;
    const night = 1 + winLitRef.current * 1.35;
    for (let vi = 0; vi < VARIANTS.length; vi++) {
      const mat = matRefs.current[vi];
      if (!mat) continue;
      // `color` tints the ad `map`; pulse it as a screen-brightness flicker
      // (near 1 by day, well over 1 at night so the ad blooms).
      const pulse = 0.74 + 0.26 * Math.sin(now * 0.75 + vi * 1.7);
      mat.color.setScalar(Math.min(2.4, pulse * night));
    }
  });

  if (!panels.length) return null;
  return (
    <group>
      <instancedMesh
        ref={frameRef}
        args={[undefined, undefined, panels.length]}
        castShadow
        key={`bbf-${panels.length}`}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#14171c" roughness={0.7} metalness={0.4} />
      </instancedMesh>
      {byVariant.map((list, vi) =>
        list.length ? (
          <instancedMesh
            key={`bb-${vi}-${list.length}`}
            ref={(r) => { meshRefs.current[vi] = r; }}
            args={[undefined, undefined, list.length]}
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              ref={(r) => { matRefs.current[vi] = r as THREE.MeshBasicMaterial | null; }}
              map={adTex[vi] ?? null}
              toneMapped={false}
            />
          </instancedMesh>
        ) : null,
      )}
      {struts.length ? (
        <instancedMesh ref={strutRef} args={[undefined, undefined, struts.length]} castShadow key={`bbs-${struts.length}`}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#2a2f38" roughness={0.8} metalness={0.35} />
        </instancedMesh>
      ) : null}
    </group>
  );
}
