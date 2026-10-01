"use client";

// Walking people — a scene-dressing sibling (like <Traffic> / <Trees>).
// Everyone follows the sidewalk perimeter of one developed tile. Road
// crossings are intentionally left out: traffic does not yet simulate a
// pedestrian-yield phase, so keeping people on the pavement guarantees they
// never clip through moving vehicles.
//
// The crowd is men, women, boys and girls rather than one generic figure:
//   • adult proportions (head ≈ 1/6 of height), kids ~2/3 adult height
//     with a relatively larger head and a quicker, shorter stride;
//   • varied skin tones, and hair per person — short crop, long hair,
//     ponytail or bun — or a tudung on many of the women and some girls;
//   • outfits by person: shirt + trousers, baju kurung (long skirt, long
//     sleeves), blouse + knee skirt, school uniform (white shirt + navy
//     shorts / pinafore), kids' tees and shorts;
//   • hands, shoes, a tapered torso and a bent elbow, so a figure reads as
//     a person at close zoom instead of a stack of boxes;
//   • some children walk beside a parent, matched to their pace.
// The gait is an alternating stride (legs + arms in cross-body
// coordination, body double-bounce per stride). Density scales with zone
// kind × how central the tile is × the live trafficLevel.

import { useMemo, useRef, useLayoutEffect, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PLOT, type CellPlacement, type ZoneKind } from "./cityData";
import { type Weather } from "./scenery";

const TILE_H = 4;

const col = (hexes: string[]) => hexes.map((h) => new THREE.Color(h));
const SKINS = col(["#f0cba8", "#e3b48e", "#cf9a72", "#b98058", "#9a6744", "#74492f"]);
const HAIRS = col(["#141110", "#1f1712", "#2b1d15", "#3d2a1d", "#0b0a09", "#4a3324"]);
const GREY_HAIR = new THREE.Color("#9a9692");
const MEN_TOPS = col(["#e2e8f0", "#3b82f6", "#1f2937", "#ef4444", "#22c55e", "#f59e0b", "#14b8a6", "#6b7280", "#7c3aed", "#ffffff"]);
const PANTS = col(["#2b3140", "#1f2937", "#3f4a5c", "#584a3a", "#0f172a", "#b9a98a", "#41506b"]);
const KURUNG = col(["#e879a6", "#60a5fa", "#f4c95d", "#34d399", "#c084fc", "#fb923c", "#f9a8d4", "#5eead4", "#b91c1c"]);
const TUDUNG = col(["#f5f5f4", "#1f2937", "#fda4af", "#93c5fd", "#d6d3d1", "#a78bfa", "#fcd34d", "#0f766e", "#7c2d12"]);
const WOMEN_TOPS = col(["#fde68a", "#f9a8d4", "#bfdbfe", "#ffffff", "#fca5a5", "#a7f3d0", "#1f2937", "#e9d5ff"]);
const SKIRTS = col(["#1f2937", "#334155", "#7c2d12", "#1e3a8a", "#9d174d", "#d6d3d1", "#4b5563"]);
const KID_TOPS = col(["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#a855f7", "#facc15", "#06b6d4"]);
const KID_BOTTOMS = col(["#1e3a8a", "#374151", "#7c3aed", "#065f46", "#be185d", "#0f172a"]);
const SHOES = col(["#1c1917", "#f5f5f4", "#57381f", "#27272a", "#1c1917"]);
const SCHOOL_WHITE = new THREE.Color("#f8fafc");
const SCHOOL_NAVY = new THREE.Color("#1e3a8a");
const UMBRELLA_COL = col(["#c53d4f", "#e2b84b", "#277da1", "#40513b", "#6d597a", "#d8e2dc"]);

// Adult rig proportions (before per-person scale) — feet at TILE_H.
const LEG_LEN = 4.4;
const TORSO_H = 3.4;
const UPPER_ARM = 1.65;
const FOREARM = 1.45;
const HEAD_R = 0.82;
const HEAD_SY = 1.12;       // head is a touch taller than wide
const NECK = 0.32;
const HIP_W = 0.55;         // leg offset from centre line
const SHOULDER_W = 1.42;    // arm offset from centre line
const GAIT_RATE = 0.74;     // stride phase per world-unit travelled (adult)
const SWING_AMP = 0.5;      // leg swing, radians
const ARM_AMP = 0.38;       // arm swing, radians
const ELBOW_BEND = 0.32;    // forearm carried slightly forward
const BOB_AMP = 0.32;       // vertical bounce

type Kind = "man" | "woman" | "boy" | "girl";
type HairStyle = "short" | "long" | "pony" | "bun" | "tudung" | "bald";
const HAIR_STYLES: HairStyle[] = ["short", "long", "pony", "bun", "tudung"];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0) || 1;
}
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

// Body frame: forward is local +X, the person's left/right is local Z.
// Rotations use yaw = -heading so local +X lines up with the walking
// direction (and local +Z with side() below). Limb swing rotates about
// local Z first, then yaws — positive swing carries the foot/hand forward.
const _qYaw = new THREE.Quaternion();
const _qSwing = new THREE.Quaternion();
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);
function limbQuat(heading: number, swing: number, out: THREE.Quaternion): THREE.Quaternion {
  _qYaw.setFromAxisAngle(_axisY, -heading);
  _qSwing.setFromAxisAngle(_axisZ, swing);
  return out.copy(_qYaw).multiply(_qSwing);
}

function pedCount(kind: ZoneKind, coreness: number, gridSize: number): number {
  const busy = kind === "urban" || kind === "commercial" || kind === "market";
  const mid = kind === "housing" || kind === "community" || kind === "village" || kind === "education";
  // Even a small kampung (rural preset) gets a person or two — an empty
  // sidewalk read as "unfinished", not "quiet".
  if (gridSize <= 6) return busy ? 1 : mid && coreness > 0.45 ? 1 : 0;
  let n = busy ? Math.round(4 + coreness * 5) : mid ? Math.round(2 + coreness * 2) : 1;
  if (gridSize >= 22) n = Math.min(n, 5);
  return n;
}

type Ped = {
  kind: Kind;
  cx: number; cz: number;
  lane: number;          // offset from the base walking line (outward +)
  u: number;             // 0..1 position around the loop
  speed: number;         // world units / s along this ped's own loop
  phase: number;
  b: number;             // overall body scale
  shoulder: number;      // shoulder-width factor
  headScale: number;     // head size relative to b (kids: larger)
  swingMul: number;      // long skirts shorten the stride
  skin: THREE.Color;
  hairStyle: HairStyle;
  hair: THREE.Color;
  top: THREE.Color;
  forearm: THREE.Color;  // sleeve colour (long sleeves) or skin
  legs: THREE.Color;     // trousers, or skin under a skirt / shorts
  garment: null | { type: "skirt" | "shorts"; color: THREE.Color; len: number };
  shoe: THREE.Color;
  umbrella: number;
};

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

function makePerson(kind: Kind, rnd: () => number, skin: THREE.Color, schoolKid: boolean): Omit<Ped, "cx" | "cz" | "lane" | "u" | "speed" | "phase" | "umbrella"> {
  const hair = pick(rnd, HAIRS);
  const shoe = pick(rnd, SHOES);
  if (kind === "man") {
    const top = pick(rnd, MEN_TOPS);
    const longSleeve = rnd() < 0.3;
    const old = rnd() < 0.15;
    return {
      kind, b: 0.96 + rnd() * 0.12, shoulder: 1, headScale: 1, swingMul: 1, skin,
      hairStyle: old && rnd() < 0.4 ? "bald" : "short",
      hair: old ? GREY_HAIR : hair,
      top, forearm: longSleeve ? top : skin, legs: pick(rnd, PANTS), garment: null, shoe,
    };
  }
  if (kind === "woman") {
    const r = rnd();
    if (r < 0.45) {
      // baju kurung + tudung: long skirt, long sleeves, same fabric
      const fabric = pick(rnd, KURUNG);
      return {
        kind, b: 0.88 + rnd() * 0.09, shoulder: 0.86, headScale: 1, swingMul: 0.62, skin,
        hairStyle: "tudung", hair: pick(rnd, TUDUNG),
        top: fabric, forearm: fabric, legs: fabric,
        garment: { type: "skirt", color: fabric, len: 0.9 }, shoe,
      };
    }
    const top = pick(rnd, WOMEN_TOPS);
    const hairStyle: HairStyle = pick(rnd, ["long", "long", "pony", "bun"] as HairStyle[]);
    if (r < 0.75) {
      // blouse + knee-length skirt
      return {
        kind, b: 0.88 + rnd() * 0.09, shoulder: 0.86, headScale: 1, swingMul: 0.85, skin,
        hairStyle, hair, top, forearm: skin, legs: skin,
        garment: { type: "skirt", color: pick(rnd, SKIRTS), len: 0.5 }, shoe,
      };
    }
    // blouse + trousers
    return {
      kind, b: 0.88 + rnd() * 0.09, shoulder: 0.86, headScale: 1, swingMul: 0.95, skin,
      hairStyle, hair, top, forearm: rnd() < 0.4 ? top : skin, legs: pick(rnd, PANTS), garment: null, shoe,
    };
  }
  const b = 0.6 + rnd() * 0.12;
  const headScale = 1.18;
  if (kind === "boy") {
    const top = schoolKid ? SCHOOL_WHITE : pick(rnd, KID_TOPS);
    const shorts = schoolKid ? SCHOOL_NAVY : pick(rnd, KID_BOTTOMS);
    return {
      kind, b, shoulder: 0.92, headScale, swingMul: 1.05, skin,
      hairStyle: "short", hair, top, forearm: skin, legs: skin,
      garment: { type: "shorts", color: shorts, len: 0.38 }, shoe,
    };
  }
  // girl
  const top = schoolKid ? SCHOOL_WHITE : pick(rnd, KID_TOPS);
  const skirt = schoolKid ? SCHOOL_NAVY : pick(rnd, KID_BOTTOMS);
  const tudung = rnd() < (schoolKid ? 0.55 : 0.25);
  return {
    kind, b, shoulder: 0.9, headScale, swingMul: 0.95, skin,
    hairStyle: tudung ? "tudung" : rnd() < 0.55 ? "pony" : "long",
    hair: tudung ? (schoolKid ? SCHOOL_WHITE : pick(rnd, TUDUNG)) : hair,
    top, forearm: tudung && schoolKid ? top : skin, legs: tudung && schoolKid ? skirt : skin,
    garment: { type: "skirt", color: skirt, len: tudung && schoolKid ? 0.9 : 0.55 }, shoe,
  };
}

// ── geometry (built once; pivots chosen so limbs share the joint matrix) ──
function flatMerge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map((g) => {
    const f = g.index ? g.toNonIndexed() : g;
    if (f.getAttribute("uv")) f.deleteAttribute("uv");
    return f;
  });
  return mergeGeometries(flat, false) ?? flat[0];
}

function hairCap(thetaLen: number, tilt: number, rScale: number) {
  const g = new THREE.SphereGeometry(HEAD_R * rScale, 14, 9, 0, Math.PI * 2, 0, thetaLen);
  g.scale(1, HEAD_SY, 1);
  g.rotateZ(tilt); // positive tilt drops the rim at the back, lifts the hairline
  return g;
}

function buildHairGeometry(style: HairStyle): THREE.BufferGeometry | null {
  const r = HEAD_R;
  switch (style) {
    case "short":
      return flatMerge([hairCap(Math.PI * 0.47, 0.5, 1.07)]);
    case "long": {
      const back = new THREE.BoxGeometry(0.42 * r, 2.3 * r, 1.75 * r);
      back.translate(-0.72 * r, -0.72 * r, 0);
      return flatMerge([hairCap(Math.PI * 0.52, 0.42, 1.09), back]);
    }
    case "pony": {
      const tie = new THREE.SphereGeometry(0.34 * r, 8, 6);
      tie.translate(-1.02 * r, 0.25 * r, 0);
      const tail = new THREE.CylinderGeometry(0.3 * r, 0.1 * r, 1.5 * r, 6);
      tail.rotateZ(-0.35);
      tail.translate(-1.25 * r, -0.5 * r, 0);
      return flatMerge([hairCap(Math.PI * 0.5, 0.45, 1.08), tie, tail]);
    }
    case "bun": {
      const bun = new THREE.SphereGeometry(0.46 * r, 9, 7);
      bun.translate(-0.85 * r, 0.62 * r, 0);
      return flatMerge([hairCap(Math.PI * 0.5, 0.45, 1.08), bun]);
    }
    case "tudung": {
      // covers crown, sides and back of the head; the drape falls over the
      // neck and shoulders, leaving the face open at the front.
      const wrap = hairCap(Math.PI * 0.63, 0.55, 1.13);
      const drape = new THREE.CylinderGeometry(r * 0.95, r * 1.4, r * 1.9, 16, 1, true);
      drape.scale(0.85, 1, 1.12);
      drape.translate(-0.08 * r, -1.45 * r * HEAD_SY, 0);
      return flatMerge([wrap, drape]);
    }
    default:
      return null;
  }
}

export function Pedestrians({
  placed, gridSize, trafficLevel = 0.5, claimed, avoidCentre, weather = "clear",
}: {
  placed: CellPlacement[];
  gridSize: number;
  trafficLevel?: number;
  weather?: Weather;
  claimed?: Set<string>;
  /** Central roundabout centre. Its four adjacent plots have no reliable
      pedestrian pavement because the raised ring overlaps their inner edges. */
  avoidCentre?: [number, number] | null;
}) {
  const levelRef = useRef(trafficLevel);
  levelRef.current = trafficLevel;

  // Walking line on the plot's paved forecourt, just inside the 7-unit kerb
  // strip (PLOT/2-7 .. PLOT/2). It used to sit at PLOT/2+5 — out on the
  // asphalt, where motorcycle lanes (~PLOT/2+6) and car flanks (~PLOT/2+8)
  // passed within a body-width of walkers. Buildings end by ~PLOT/2-14.
  // Each person walks a lane within ±2 of this line; a child walking with
  // a parent takes the next lane out.
  const R = PLOT / 2 - 9;

  const peds = useMemo(() => {
    const out: Ped[] = [];
    const mid = (gridSize - 1) / 2;
    const maxD = Math.hypot(mid, mid) || 1;
    for (const { zone, col, row, cx, cz } of placed) {
      if (claimed?.has(`${col},${row}`)) continue;
      // The sidewalk route normally follows a tile perimeter. On the four
      // plots beside the central roundabout, that route runs under the
      // roundabout deck / landscaped island. Suppress only those four local
      // pedestrian spawners so the junction stays free of walkers rather
      // than having people visibly clip through the island or kerb.
      if (avoidCentre && Math.hypot(cx - avoidCentre[0], cz - avoidCentre[1]) < PLOT) continue;
      const coreness = 1 - Math.hypot(col - mid, row - mid) / maxD;
      const n = pedCount(zone.kind, coreness, gridSize);
      if (!n) continue;
      const rnd = rng(hashSeed(`${zone.id}:ped`));
      const kidFriendly = zone.kind !== "industry";
      const schoolZone = zone.kind === "education";
      for (let i = 0; i < n; i++) {
        const lane = -2 + rnd() * 2.2;
        const u = rnd();
        const phase = rnd() * Math.PI * 2;
        const umbrella = Math.floor(rnd() * UMBRELLA_COL.length);
        const skin = pick(rnd, SKINS);
        // A few unaccompanied school kids, mostly adults.
        const kr = rnd();
        const soloKid = kidFriendly && kr < (schoolZone ? 0.45 : 0.12);
        const kind: Kind = soloKid ? (rnd() < 0.5 ? "boy" : "girl") : rnd() < 0.5 ? "man" : "woman";
        const person = makePerson(kind, rnd, skin, soloKid && (schoolZone || rnd() < 0.6));
        const speed = soloKid ? 8 + rnd() * 4 : 7 + rnd() * 5;
        out.push({ ...person, cx, cz, lane, u, speed, phase, umbrella });

        // Family: a child beside this adult, same skin, matched pace.
        if (!soloKid && kidFriendly && rnd() < 0.28) {
          const childKind: Kind = rnd() < 0.5 ? "boy" : "girl";
          const child = makePerson(childKind, rnd, skin, false);
          const laneC = lane + 2.4;
          out.push({
            ...child, cx, cz, lane: laneC, u: u + 0.0015,
            // same fraction of the loop per second as the parent
            speed: speed * (R + laneC) / (R + lane),
            phase: phase + 1.3, umbrella: (umbrella + 2) % UMBRELLA_COL.length,
          });
        }
      }
    }
    return out;
  }, [placed, gridSize, claimed, avoidCentre, R]);

  // Index lists for the per-style / per-garment instanced meshes.
  const groups = useMemo(() => {
    const hair = Object.fromEntries(HAIR_STYLES.map((s) => [s, [] as number[]])) as Record<HairStyle, number[] | undefined>;
    const skirts: number[] = [];
    const shorts: number[] = [];
    peds.forEach((p, i) => {
      hair[p.hairStyle]?.push(i);
      if (p.garment?.type === "skirt") skirts.push(i);
      else if (p.garment?.type === "shorts") shorts.push(i);
    });
    return { hair, skirts, shorts };
  }, [peds]);

  const torsoRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const legRef = useRef<THREE.InstancedMesh>(null);
  const shoeRef = useRef<THREE.InstancedMesh>(null);
  const upperArmRef = useRef<THREE.InstancedMesh>(null);
  const forearmRef = useRef<THREE.InstancedMesh>(null);
  const skirtRef = useRef<THREE.InstancedMesh>(null);
  const shortsRef = useRef<THREE.InstancedMesh>(null);
  const hairRefs = useRef<Partial<Record<HairStyle, THREE.InstancedMesh | null>>>({});
  const umbrellaRef = useRef<THREE.InstancedMesh>(null);
  const umbrellaShaftRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  const geo = useMemo(() => {
    // Tapered torso: shoulders wider than the waist, shallow front-to-back.
    const torso = new THREE.CylinderGeometry(1, 0.86, TORSO_H, 4, 1);
    torso.rotateY(Math.PI / 4);
    torso.scale(0.62 / Math.SQRT1_2, 1, 1.18 / Math.SQRT1_2);
    const head = new THREE.SphereGeometry(HEAD_R, 12, 10);
    head.scale(1, HEAD_SY, 1);
    // Leg pivots at the hip; the shoe is a separate mesh sharing that matrix.
    const leg = new THREE.BoxGeometry(0.62, LEG_LEN, 0.62);
    leg.translate(0, -LEG_LEN / 2, 0);
    const shoe = new THREE.BoxGeometry(1.15, 0.42, 0.7);
    shoe.translate(0.22, -LEG_LEN + 0.21, 0);
    const upperArm = new THREE.BoxGeometry(0.5, UPPER_ARM, 0.5);
    upperArm.translate(0, -UPPER_ARM / 2, 0);
    // Forearm pivots at the elbow and ends in a hand.
    const forearm = new THREE.BoxGeometry(0.42, FOREARM, 0.42);
    forearm.translate(0, -FOREARM / 2, 0);
    const hand = new THREE.BoxGeometry(0.4, 0.5, 0.3);
    hand.translate(0.02, -FOREARM - 0.2, 0);
    const forearmHand = flatMerge([forearm, hand]);
    // Garments pivot at the waist; instance Y scale sets their length.
    const skirt = new THREE.CylinderGeometry(1.0, 1.42, 1, 14, 1);
    skirt.translate(0, -0.5, 0);
    skirt.scale(0.7, 1, 1.02);
    const shorts = new THREE.CylinderGeometry(1.0, 1.08, 1, 10, 1);
    shorts.translate(0, -0.5, 0);
    shorts.scale(0.68, 1, 1.0);
    const hair = Object.fromEntries(
      HAIR_STYLES.map((s) => [s, buildHairGeometry(s)]),
    ) as Record<HairStyle, THREE.BufferGeometry | null>;
    return { torso, head, leg, shoe, upperArm, forearmHand, skirt, shorts, hair };
  }, []);
  useEffect(() => () => {
    [geo.torso, geo.head, geo.leg, geo.shoe, geo.upperArm, geo.forearmHand, geo.skirt, geo.shorts]
      .forEach((g) => g.dispose());
    Object.values(geo.hair).forEach((g) => g?.dispose());
  }, [geo]);

  useLayoutEffect(() => {
    const torso = torsoRef.current;
    const head = headRef.current;
    const legs = legRef.current;
    const shoes = shoeRef.current;
    const upper = upperArmRef.current;
    const fore = forearmRef.current;
    if (!torso || !head || !legs || !shoes || !upper || !fore) return;
    peds.forEach((p, i) => {
      torso.setColorAt(i, p.top);
      head.setColorAt(i, p.skin);
      for (let n = 0; n < 2; n++) {
        legs.setColorAt(i * 2 + n, p.legs);
        shoes.setColorAt(i * 2 + n, p.shoe);
        upper.setColorAt(i * 2 + n, p.top);
        fore.setColorAt(i * 2 + n, p.forearm);
      }
    });
    [torso, head, legs, shoes, upper, fore].forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });

    for (const style of HAIR_STYLES) {
      const mesh = hairRefs.current[style];
      if (!mesh) continue;
      (groups.hair[style] ?? []).forEach((pi, k) => mesh.setColorAt(k, peds[pi].hair));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const sk = skirtRef.current;
    if (sk) {
      groups.skirts.forEach((pi, k) => sk.setColorAt(k, peds[pi].garment!.color));
      if (sk.instanceColor) sk.instanceColor.needsUpdate = true;
    }
    const sh = shortsRef.current;
    if (sh) {
      groups.shorts.forEach((pi, k) => sh.setColorAt(k, peds[pi].garment!.color));
      if (sh.instanceColor) sh.instanceColor.needsUpdate = true;
    }
    const umbrellas = umbrellaRef.current;
    if (umbrellas) {
      peds.forEach((p, i) => umbrellas.setColorAt(i, UMBRELLA_COL[p.umbrella]));
      if (umbrellas.instanceColor) umbrellas.instanceColor.needsUpdate = true;
    }
  }, [peds, groups, weather]);

  // Reverse lookup: ped index -> slot in its hair / garment mesh.
  const slots = useMemo(() => {
    const hairSlot = new Int32Array(peds.length).fill(-1);
    for (const style of HAIR_STYLES) (groups.hair[style] ?? []).forEach((pi, k) => { hairSlot[pi] = k; });
    const garmentSlot = new Int32Array(peds.length).fill(-1);
    groups.skirts.forEach((pi, k) => { garmentSlot[pi] = k; });
    groups.shorts.forEach((pi, k) => { garmentSlot[pi] = k; });
    return { hairSlot, garmentSlot };
  }, [peds, groups]);

  useFrame((_, dt) => {
    const torso = torsoRef.current;
    const head = headRef.current;
    const legs = legRef.current;
    const shoes = shoeRef.current;
    const upper = upperArmRef.current;
    const fore = forearmRef.current;
    const skirts = skirtRef.current;
    const shortsMesh = shortsRef.current;
    const umbrellas = umbrellaRef.current;
    const umbrellaShafts = umbrellaShaftRef.current;
    const rainy = weather === "rain";
    if (!torso || !head || !legs || !shoes || !upper || !fore) return;
    if (rainy && (!umbrellas || !umbrellaShafts)) return;
    const step = Math.min(dt, 0.05);
    const lv = Math.max(0, Math.min(1, levelRef.current));
    const active = Math.max(1, Math.round(peds.length * (0.32 + 0.68 * lv)));
    const paceMul = 0.7 + 0.5 * lv;

    const setAll = (i: number) => {
      // Writes the current dummy.matrix into every mesh slot owned by ped i.
      torso.setMatrixAt(i, dummy.matrix);
      head.setMatrixAt(i, dummy.matrix);
      for (let n = 0; n < 2; n++) {
        legs.setMatrixAt(i * 2 + n, dummy.matrix);
        shoes.setMatrixAt(i * 2 + n, dummy.matrix);
        upper.setMatrixAt(i * 2 + n, dummy.matrix);
        fore.setMatrixAt(i * 2 + n, dummy.matrix);
      }
      const p = peds[i];
      const hs = slots.hairSlot[i];
      if (hs >= 0) hairRefs.current[p.hairStyle]?.setMatrixAt(hs, dummy.matrix);
      const gs = slots.garmentSlot[i];
      if (gs >= 0) (p.garment!.type === "skirt" ? skirts : shortsMesh)?.setMatrixAt(gs, dummy.matrix);
      umbrellas?.setMatrixAt(i, dummy.matrix);
      umbrellaShafts?.setMatrixAt(i, dummy.matrix);
    };

    for (let i = 0; i < peds.length; i++) {
      if (i >= active) {
        dummy.position.set(0, -1000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        setAll(i);
        continue;
      }
      const p = peds[i];
      const Rp = R + p.lane;
      const segLen = 2 * Rp;
      const perim = 8 * Rp;
      p.u = (p.u + (p.speed * paceMul * step) / perim) % 1;
      const s = p.u * perim;
      const seg = Math.floor(s / segLen);
      const t = (s - seg * segLen) / segLen;
      let x: number, z: number, heading: number;
      if (seg === 0) { x = p.cx - Rp + t * segLen; z = p.cz - Rp; heading = 0; }
      else if (seg === 1) { x = p.cx + Rp; z = p.cz - Rp + t * segLen; heading = Math.PI / 2; }
      else if (seg === 2) { x = p.cx + Rp - t * segLen; z = p.cz + Rp; heading = Math.PI; }
      else { x = p.cx - Rp; z = p.cz + Rp - t * segLen; heading = -Math.PI / 2; }

      const b = p.b;
      // Shorter legs take quicker steps for the same ground speed.
      const gait = p.phase + s * (GAIT_RATE / b);
      const legSwingL = Math.sin(gait) * SWING_AMP * p.swingMul;
      const legSwingR = -legSwingL;
      const armSwingL = -legSwingL * (ARM_AMP / SWING_AMP);
      const armSwingR = -armSwingL;
      const bob = Math.abs(Math.sin(gait)) * BOB_AMP * b * p.swingMul;
      const yaw = -heading;

      const cosH = Math.cos(heading), sinH = Math.sin(heading);
      const side = (d: number) => [x - sinH * d, z + cosH * d] as const;

      const hipY = TILE_H + LEG_LEN * b + bob * 0.5;
      const shoulderY = hipY + TORSO_H * b;
      const hb = b * p.headScale;
      const headY = shoulderY + NECK * b + HEAD_R * HEAD_SY * hb;

      // torso (slight forward lean while walking)
      dummy.position.set(x, hipY + (TORSO_H / 2) * b, z);
      dummy.rotation.set(0, yaw, -0.05, "YXZ");
      dummy.scale.set(b, b, b * p.shoulder);
      dummy.updateMatrix();
      torso.setMatrixAt(i, dummy.matrix);

      // head + hair (hair shares the head matrix)
      dummy.position.set(x + cosH * 0.12 * b, headY, z + sinH * 0.12 * b);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(hb, hb, hb);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
      const hs = slots.hairSlot[i];
      if (hs >= 0) hairRefs.current[p.hairStyle]?.setMatrixAt(hs, dummy.matrix);

      // garment hangs from the waist, scaled to its length
      const gs = slots.garmentSlot[i];
      if (gs >= 0) {
        const gmesh = p.garment!.type === "skirt" ? skirts : shortsMesh;
        dummy.position.set(x, hipY + 0.25 * b, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(b, p.garment!.len * LEG_LEN * b, b);
        dummy.updateMatrix();
        gmesh?.setMatrixAt(gs, dummy.matrix);
      }

      // legs + shoes (pivot at the hip)
      const legPairs: [number, number][] = [[-HIP_W, legSwingL], [HIP_W, legSwingR]];
      legPairs.forEach(([off, swing], n) => {
        const [lx, lz] = side(off * b);
        dummy.position.set(lx, hipY, lz);
        dummy.quaternion.copy(limbQuat(heading, swing, tmpQ));
        dummy.scale.set(b, b, b);
        dummy.updateMatrix();
        legs.setMatrixAt(i * 2 + n, dummy.matrix);
        shoes.setMatrixAt(i * 2 + n, dummy.matrix);
      });

      // arms: upper arm from the shoulder, forearm + hand from the elbow
      const armPairs: [number, number][] = [[-SHOULDER_W * p.shoulder, armSwingL], [SHOULDER_W * p.shoulder, armSwingR]];
      armPairs.forEach(([off, swing], n) => {
        const [ax, az] = side(off * b);
        dummy.position.set(ax, shoulderY - 0.2 * b, az);
        limbQuat(heading, swing, tmpQ);
        dummy.quaternion.copy(tmpQ);
        dummy.scale.set(b, b, b);
        dummy.updateMatrix();
        upper.setMatrixAt(i * 2 + n, dummy.matrix);
        tmpV.set(0, -UPPER_ARM * b, 0).applyQuaternion(tmpQ);
        dummy.position.add(tmpV);
        dummy.quaternion.copy(limbQuat(heading, swing * 1.3 + ELBOW_BEND, tmpQ));
        dummy.updateMatrix();
        fore.setMatrixAt(i * 2 + n, dummy.matrix);
      });

      if (rainy && umbrellas && umbrellaShafts) {
        // One hand carries the umbrella slightly to the pedestrian's right.
        // The shared lean gives the rainy crowd a coherent wind direction;
        // the small gait bob keeps each canopy attached to its owner.
        const [ux, uz] = side(1.15 * b);
        dummy.position.set(ux, headY + 1.05 * b, uz);
        dummy.rotation.set(0.07, heading, -0.1);
        dummy.scale.set(b, b, b);
        dummy.updateMatrix();
        umbrellaShafts.setMatrixAt(i, dummy.matrix);

        dummy.position.set(ux, headY + 3.0 * b, uz);
        dummy.updateMatrix();
        umbrellas.setMatrixAt(i, dummy.matrix);
      }
    }
    [torso, head, legs, shoes, upper, fore, skirts, shortsMesh].forEach((m) => { if (m) m.instanceMatrix.needsUpdate = true; });
    for (const style of HAIR_STYLES) {
      const m = hairRefs.current[style];
      if (m) m.instanceMatrix.needsUpdate = true;
    }
    if (rainy && umbrellas && umbrellaShafts) {
      umbrellas.instanceMatrix.needsUpdate = true;
      umbrellaShafts.instanceMatrix.needsUpdate = true;
    }
  });

  if (!peds.length) return null;
  const n = peds.length;
  return (
    <group>
      <instancedMesh ref={torsoRef} args={[geo.torso, undefined, n]} key={`ped-t-${n}`} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[geo.head, undefined, n]} key={`ped-h-${n}`} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={legRef} args={[geo.leg, undefined, n * 2]} key={`ped-l-${n}`} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={shoeRef} args={[geo.shoe, undefined, n * 2]} key={`ped-s-${n}`} frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={upperArmRef} args={[geo.upperArm, undefined, n * 2]} key={`ped-ua-${n}`} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={forearmRef} args={[geo.forearmHand, undefined, n * 2]} key={`ped-fa-${n}`} frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </instancedMesh>
      {groups.skirts.length > 0 && (
        <instancedMesh ref={skirtRef} args={[geo.skirt, undefined, groups.skirts.length]} key={`ped-sk-${n}-${groups.skirts.length}`} castShadow frustumCulled={false}>
          <meshStandardMaterial color="#ffffff" roughness={0.85} />
        </instancedMesh>
      )}
      {groups.shorts.length > 0 && (
        <instancedMesh ref={shortsRef} args={[geo.shorts, undefined, groups.shorts.length]} key={`ped-sh-${n}-${groups.shorts.length}`} castShadow frustumCulled={false}>
          <meshStandardMaterial color="#ffffff" roughness={0.88} />
        </instancedMesh>
      )}
      {HAIR_STYLES.map((style) => {
        const count = groups.hair[style]?.length ?? 0;
        const g = geo.hair[style];
        if (!count || !g) return null;
        return (
          <instancedMesh
            key={`ped-hair-${style}-${n}-${count}`}
            ref={(m) => { hairRefs.current[style] = m; }}
            args={[g, undefined, count]}
            castShadow
            frustumCulled={false}
          >
            <meshStandardMaterial
              color="#ffffff"
              roughness={style === "tudung" ? 0.9 : 0.6}
              side={style === "tudung" ? THREE.DoubleSide : THREE.FrontSide}
            />
          </instancedMesh>
        );
      })}
      {weather === "rain" && (
        <>
          <instancedMesh ref={umbrellaShaftRef} args={[undefined, undefined, n]} key={`ped-us-${n}`} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 4.2, 5]} />
            <meshStandardMaterial color="#30353b" metalness={0.45} roughness={0.5} />
          </instancedMesh>
          <instancedMesh ref={umbrellaRef} args={[undefined, undefined, n]} key={`ped-u-${n}`} castShadow>
            <coneGeometry args={[3.35, 1.25, 10, 1, true]} />
            <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} roughness={0.78} />
          </instancedMesh>
        </>
      )}
    </group>
  );
}
