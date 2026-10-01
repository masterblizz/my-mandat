"use client";

// Bukit-Bintang-style LED billboards / ad screens. A scene-dressing
// sibling that ANCHORS TO REAL BUILDING INSTANCES: it reproduces
// CityScene's per-zone building layout (zoneBuildings → slotPos → world
// box + klHeightMult height), picks a few tall buildings per eligible
// zone and mounts a flat "screen" flush against the wall face that points
// at a road. Standalone billboards get a real two-post frame reaching the
// panel. If a zone has no tall building, it gets no panel (no floaters).
//
// Panels share one instanced mesh and one canvas atlas. Each panel receives a
// stable atlas tile plus its own animation phase, keeping dense cities cheap
// while ensuring that adjacent screens never repeat the same campaign.

import { useMemo, useRef, useLayoutEffect, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  PLOT, slotPos, zoneBuildings, FLAT_TYPES,
  type CellPlacement, type ZoneKind, type BType, type SeatTraits,
} from "./cityData";
import { klHeightMult } from "./klProfile";
import { bukitBintangRoadIntersects } from "./bukitBintangRoads";

const TILE_H = 4;

const CAMPAIGNS = [
  ["NOVA//MOBILE", "5G UNTUK SEMUA", "DATA TANPA HENTI", "SERTAI SEKARANG"],
  ["RASA KITA", "MAKAN. LEPAK.", "MALAM INI", "TEMPAH MEJA"],
  ["URBAN//RUN", "LARI LEBIH JAUH", "KOLEKSI BAHARU", "LIHAT DROP"],
  ["VISTA BANK", "MASA DEPAN ANDA", "MULA DENGAN RM10", "BUKA AKAUN"],
  ["KOPI LORONG", "SEBUAH CERITA", "DALAM SETIAP CAWAN", "JUMPA DI SINI"],
  ["PULSE//STUDIO", "JADI LUAR BIASA", "KELAS PERCUBAAN", "MASUK SEKARANG"],
  ["CINEMA 88", "MALAM INI", "SKRIN BESAR. RASA BESAR.", "DAPATKAN TIKET"],
  ["HIJAU KITA", "BANDAR LEBIH BERSIH", "BERSAMA KITA", "KETAHUI CARA"],
] as const;
const AD_COLOURS = ["#2f6bff", "#ff5a2a", "#14d9c4", "#ff3fd0", "#e9b949", "#7c6cff", "#1ea5ff", "#78c850"] as const;

function drawAd(g: CanvasRenderingContext2D, x: number, y: number, W: number, H: number, seed: number, frame: number) {
  let s = ((seed + 1) * 2654435761) >>> 0;
  const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const campaign = CAMPAIGNS[seed % CAMPAIGNS.length];
  const hex = AD_COLOURS[(seed >>> 3) % AD_COLOURS.length];
  const alternate = (frame + Math.floor(seed / 7)) % 3;

  g.fillStyle = hex;
  g.fillRect(x, y, W, H);
  const grad = g.createLinearGradient(x, y, x + W, y + H);
  grad.addColorStop(0, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0.24)");
  g.fillStyle = grad;
  g.fillRect(x, y, W, H);

  const c = new THREE.Color(hex);
  const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  const ink = lum > 0.62 ? "#0b1220" : "#ffffff";
  const inkDim = lum > 0.62 ? "rgba(11,18,32,0.5)" : "rgba(255,255,255,0.55)";

  g.strokeStyle = ink;
  g.globalAlpha = 0.28;
  g.lineWidth = Math.max(3, W * 0.018);
  g.strokeRect(x + 8, y + 8, W - 16, H - 16);
  g.globalAlpha = 1;

  // Distinct seeded identity mark, hero form and copy layout per campaign.
  g.fillStyle = ink;
  const glyph = seed % 3;
  const iconX = x + W * (0.14 + r() * 0.08), iconY = y + H * (0.25 + r() * 0.1);
  if (glyph === 0) { g.beginPath(); g.arc(iconX, iconY, W * 0.11, 0, Math.PI * 2); g.fill(); }
  else if (glyph === 1) { g.beginPath(); g.moveTo(iconX, iconY - H * 0.13); g.lineTo(iconX + W * 0.13, iconY + H * 0.13); g.lineTo(iconX - W * 0.13, iconY + H * 0.13); g.closePath(); g.fill(); }
  else { g.fillRect(iconX - W * 0.1, iconY - H * 0.1, W * 0.2, H * 0.2); }

  g.fillStyle = ink;
  g.font = `bold ${Math.round(H * 0.11)}px Arial, Helvetica, sans-serif`;
  g.textBaseline = "top";
  g.fillText(campaign[0], x + W * 0.06, y + H * 0.06);
  g.font = `bold ${Math.round(H * 0.17)}px Arial, Helvetica, sans-serif`;
  g.fillText(alternate === 0 ? campaign[1] : alternate === 1 ? campaign[2] : "EDISI TERHAD", x + W * 0.06, y + H * 0.52);

  // Moving frame copies use the same brand but a fresh scene every cycle.
  g.fillStyle = inkDim;
  for (let i = 0; i < 2; i++) g.fillRect(x + W * 0.06, y + H * (0.76 + i * 0.055), W * (0.34 + r() * 0.2), Math.max(2, H * 0.025));

  // CTA plus a frame counter makes the content visibly progress even when
  // viewed from a distance. The shader below supplies continuous LED motion.
  g.fillStyle = ink;
  g.fillRect(x + W * 0.68, y + H * 0.77, W * 0.26, H * 0.13);
  g.fillStyle = hex;
  g.font = `bold ${Math.max(9, Math.round(H * 0.055))}px Arial, Helvetica, sans-serif`;
  g.fillText(campaign[3], x + W * 0.7, y + H * 0.805);
  g.fillStyle = ink;
  g.font = `bold ${Math.max(8, Math.round(H * 0.045))}px Arial, Helvetica, sans-serif`;
  g.fillText(`LIVE 0${alternate + 1}`, x + W * 0.76, y + H * 0.19);
}

function makeAdAtlas(panels: Panel[], frame: number): { texture: THREE.CanvasTexture; canvas: HTMLCanvasElement; grid: THREE.Vector2 } {
  const cellW = 256, cellH = 128;
  const cols = Math.min(16, Math.max(1, Math.ceil(Math.sqrt(panels.length))));
  const rows = Math.max(1, Math.ceil(panels.length / cols));
  const canvas = document.createElement("canvas");
  canvas.width = cols * cellW; canvas.height = rows * cellH;
  const g = canvas.getContext("2d")!;
  panels.forEach((panel, i) => drawAd(g, (i % cols) * cellW, Math.floor(i / cols) * cellH, cellW, cellH, panel.seed, frame));

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return { texture: tex, canvas, grid: new THREE.Vector2(cols, rows) };
}

// buildings a billboard may hang off — anything with a real flat-ish wall
const MOUNT_TYPES = new Set<BType>([
  "tower", "skyscraper", "shophouse", "mall", "hospital", "museum",
  "terminal", "factory", "warehouse", "clinic", "school", "library", "powerplant", "hotel",
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

type Panel = { x: number; y: number; z: number; yaw: number; w: number; h: number; seed: number };
type Strut = { x: number; y: number; z: number; sx: number; sy: number; sz: number };
type BBox = { type: BType; bx: number; bz: number; bw: number; bd: number; bh: number };

export function Billboards({
  placed, gridSize, density, traits, winLit, claimed, buildingBudget = 1,
}: {
  placed: CellPlacement[];
  gridSize: number;
  density: number;
  traits: SeatTraits;
  winLit: number;
  claimed?: Set<string>;
  /** Quality-tier knob (see quality.ts / CityScene's <Buildings>) — the
   * fraction of non-flag/non-glow buildings that actually get instanced.
   * MUST match that same thinning here, or a billboard can end up mounted
   * on a wall that the budget dropped from the real scene: the anchor
   * building never renders, so the panel reads as floating in mid-air. */
  buildingBudget?: number;
}) {
  const winLitRef = useRef(winLit);
  winLitRef.current = winLit;

  const { panels, struts } = useMemo(() => {
    const panels: Panel[] = [];
    const struts: Strut[] = [];
    const mid = (gridSize - 1) / 2;
    const maxD = Math.hypot(mid, mid) || 1;
    // Exact copy of CityScene's <Buildings> `keep()` — same hash, same
    // key shape, same flag/glow exemption — so "is this building tall
    // enough to hang a billboard off" agrees with "does this building
    // actually get instanced at this quality tier".
    const keep = (key: string): boolean => {
      if (buildingBudget >= 1) return true;
      let h = 2166136261;
      for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
      return ((h >>> 0) % 1000) / 1000 < buildingBudget;
    };

    for (const { zone, col, row, cx, cz } of placed) {
      if (claimed?.has(`${col},${row}`)) continue;
      const coreness = 1 - Math.hypot(col - mid, row - mid) / maxD;
      const n = billboardCount(zone.kind, coreness, gridSize);
      if (!n) continue;
      const rnd = rng(hashSeed(`${zone.id}:bb`));

      // reproduce CityScene's building layout for this zone — including
      // its budget thinning, or a billboard can anchor to a wall that
      // was dropped and never actually renders.
      const boxes: BBox[] = [];
      for (const spec of zoneBuildings(zone, density, traits, coreness)) {
        if (FLAT_TYPES.includes(spec.type)) continue;
        if (!spec.flag && !spec.glow && !keep(`${zone.id}:${spec.slot}:${spec.type}`)) continue;
        const sp = slotPos(spec.slot);
        const vertical = spec.type === "tower" || spec.type === "skyscraper" || spec.type === "antenna";
        const h0 = Math.max(spec.h, 6);
        const bh = vertical
          ? Math.min(275, Math.max(14, h0 * klHeightMult(col, row, gridSize)))
          : h0;
        const bx = cx - PLOT / 2 + sp.x + spec.w / 2;
        const bz = cz - PLOT / 2 + sp.y + spec.d / 2;
        // Buildings crossing the hand-composed Bukit Bintang corridors are
        // omitted by CityScene. Apply that exact test here too: a billboard
        // must never attach to a wall that the visible city no longer has.
        if (traits.bukitBintang && bukitBintangRoadIntersects(gridSize, bx, bz, spec.w, spec.d)) continue;
        boxes.push({
          type: spec.type,
          bx,
          bz,
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
          seed: hashSeed(`${zone.id}:${b.type}:${i}:${Math.round(w)}:${Math.round(h)}`),
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
          // Standalone frames need a genuine kerb-side footprint as well.
          // Skipping a road overlap is preferable to a screen suspended above
          // moving traffic.
          if (traits.bukitBintang && bukitBintangRoadIntersects(gridSize, px, pz, pw, 10)) continue;
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
            seed: hashSeed(`${zone.id}:tower:${Math.round(px)}:${Math.round(pz)}`),
          });
        }
      }
    }
    return { panels, struts };
  }, [placed, gridSize, density, traits, claimed, buildingBudget]);

  const [adAtlas, setAdAtlas] = useState<ReturnType<typeof makeAdAtlas> | null>(null);
  const atlasFrame = useRef(-1);
  useEffect(() => {
    if (!panels.length) return;
    const atlas = makeAdAtlas(panels, 0);
    atlasFrame.current = 0;
    setAdAtlas(atlas);
    return () => atlas.texture.dispose();
  }, [panels]);

  const screenRef = useRef<THREE.InstancedMesh>(null);
  const strutRef = useRef<THREE.InstancedMesh>(null);
  const frameRef = useRef<THREE.InstancedMesh>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  // R3F creates the material before the client-only canvas exists. Assign the
  // late texture directly as well as through JSX props so a billboard can
  // never remain a blank fallback panel after hydration.
  useEffect(() => {
    if (!shaderRef.current || !adAtlas) return;
    shaderRef.current.uniforms.uMap.value = adAtlas.texture;
    shaderRef.current.uniforms.uAtlasGrid.value.copy(adAtlas.grid);
  }, [adAtlas]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const screen = screenRef.current;
    if (screen) {
      panels.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.set(p.w, p.h, 2.2);
        dummy.updateMatrix();
        screen.setMatrixAt(i, dummy.matrix);
      });
      screen.instanceMatrix.needsUpdate = true;
      screen.computeBoundingSphere();
    }
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
  }, [struts, panels]);

  useLayoutEffect(() => {
    const screen = screenRef.current;
    if (!screen || !adAtlas) return;
    const cells = new Float32Array(panels.length * 2);
    const phases = new Float32Array(panels.length);
    panels.forEach((panel, i) => {
      cells[i * 2] = i % adAtlas.grid.x;
      cells[i * 2 + 1] = Math.floor(i / adAtlas.grid.x);
      phases[i] = (panel.seed % 1009) / 1009;
    });
    screen.geometry.setAttribute("adCell", new THREE.InstancedBufferAttribute(cells, 2));
    screen.geometry.setAttribute("adPhase", new THREE.InstancedBufferAttribute(phases, 1));
  }, [adAtlas, panels]);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = now;
      shaderRef.current.uniforms.uBrightness.value = 0.9 + winLitRef.current * 1.45;
    }
    // Every creative advances through its own copy sequence. Updating one
    // atlas every four seconds is substantially cheaper than a video texture
    // or material per billboard, and the shader carries the in-between motion.
    const frame = Math.floor(now / 4);
    if (adAtlas && frame !== atlasFrame.current) {
      const g = adAtlas.canvas.getContext("2d");
      if (g) {
        panels.forEach((panel, i) => drawAd(g, (i % adAtlas.grid.x) * 256, Math.floor(i / adAtlas.grid.x) * 128, 256, 128, panel.seed, frame));
        adAtlas.texture.needsUpdate = true;
        atlasFrame.current = frame;
      }
    }
  });

  if (!panels.length) return null;
  return (
    <group>
      {adAtlas ? <>
        <instancedMesh
          ref={frameRef}
          args={[undefined, undefined, panels.length]}
          castShadow
          key={`bbf-${panels.length}`}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#14171c" roughness={0.7} metalness={0.4} />
        </instancedMesh>
        <instancedMesh ref={screenRef} args={[undefined, undefined, panels.length]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <shaderMaterial
            ref={shaderRef}
            transparent={false}
            toneMapped={false}
            uniforms={{
              uMap: { value: adAtlas.texture },
              uAtlasGrid: { value: adAtlas.grid },
              uTime: { value: 0 },
              uBrightness: { value: 1 },
            }}
          // No instanceMatrix declaration: ShaderMaterial on an InstancedMesh
          // already gets one in its prefix, and a second one fails to compile.
          vertexShader={`
            attribute vec2 adCell;
            attribute float adPhase;
            uniform vec2 uAtlasGrid;
            varying vec2 vUv;
            varying float vPhase;
            void main() {
              vUv = (uv + adCell) / uAtlasGrid;
              vPhase = adPhase;
              gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform sampler2D uMap;
            uniform float uTime;
            uniform float uBrightness;
            uniform vec2 uAtlasGrid;
            varying vec2 vUv;
            varying float vPhase;
            void main() {
              vec4 ad = texture2D(uMap, vUv);
              vec2 local = fract(vUv * uAtlasGrid);
              float localX = local.x;
              float localY = local.y;
              float sweep = smoothstep(0.13, 0.0, abs(fract(localX * 0.72 + localY * 0.36 - uTime * 0.20 - vPhase) - 0.5));
              float scan = 0.035 * sin((localY * 128.0 + uTime * 22.0 + vPhase * 41.0) * 1.8);
              float ticker = step(0.88, localY) * (0.08 + 0.07 * sin(uTime * 4.0 + localX * 38.0 + vPhase * 9.0));
              ad.rgb *= uBrightness + scan + ticker;
              ad.rgb += sweep * vec3(0.20, 0.32, 0.38);
              gl_FragColor = ad;
            }
          `}
          />
        </instancedMesh>
      </> : null}
      {struts.length ? (
        <instancedMesh ref={strutRef} args={[undefined, undefined, struts.length]} castShadow key={`bbs-${struts.length}`}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#2a2f38" roughness={0.8} metalness={0.35} />
        </instancedMesh>
      ) : null}
    </group>
  );
}
