"use client";

// Phase 3: real GLB models with a graceful box fallback.
//
// - MODEL_MAP (cityData.ts) gives each BType a /models/*.glb path.
// - useModelAvailability() HEAD-checks those paths once on mount and only
//   the ones that actually exist get loaded — a missing file silently
//   keeps the Phase 2 coloured box, so models can be added one at a time.
// - Each loaded GLB is normalised (all meshes merged into one geometry,
//   base moved to y=0, centred on x/z) and drawn with ONE InstancedMesh
//   per type — instancing survives the switch from box to model.
// - Height changes (buildingHeight() growing when a project is approved)
//   are lerped in useFrame, not snapped.

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MODEL_MAP, COMMON_MODEL_TYPES, type BType } from "./cityData";

// One placed building. Geometry convention for BOTH box and model paths:
// base sits at y = groundY, footprint centred on (x, z).
export type BuildingInstance = {
  key: string;   // stable id: `${zoneId}:${slot}:${type}` — survives re-layout
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;     // target height (world units)
};

const HEIGHT_LERP = 6;      // per-second approach rate for the grow tween
const SETTLE_EPS = 0.4;     // stop tweening within this many units

// ── availability ─────────────────────────────────────────────────────
// Driven by public/models/manifest.json — one request, so a fresh checkout
// with no models produces a single 404, not one per type. Shape:
//   { "models": ["house", "tower", ...] }   // BType keys present in MODEL_MAP
//   { "models": "*" }                        // every MODEL_MAP entry has its
//                                              // base (index-0) file only
// A variant beyond the base file is its own key: "house-2" means
// house-2.glb (MODEL_MAP.house[1]) is also present, in addition to listing
// "house" for house.glb. Order in the manifest doesn't matter — resolved
// variants always come back sorted (base first). An unlisted variant is
// never fetched, so a partial rollout (e.g. only house.glb, not house-2/3
// yet) produces zero 404s. No manifest -> every type falls back to its
// coloured box.
const VARIANT_KEY = /^([a-z]+)(?:-(\d+))?$/;

export function useModelAvailability(): { ready: boolean; available: Map<BType, string[]> } {
  const [state, setState] = useState<{ ready: boolean; available: Map<BType, string[]> }>(
    { ready: false, available: new Map() },
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let listed: string[] = [];
      try {
        const r = await fetch("/models/manifest.json", { cache: "no-cache" });
        if (r.ok) {
          const j = (await r.json()) as { models?: string[] | "*" };
          listed = j.models === "*" ? Object.keys(MODEL_MAP) : j.models ?? [];
        }
      } catch {
        /* no manifest -> boxes everywhere */
      }
      if (cancelled) return;

      // key "house" -> (house, variant 1); key "house-3" -> (house, variant 3)
      const byType = new Map<BType, Set<number>>();
      for (const key of listed) {
        const m = VARIANT_KEY.exec(key);
        if (!m) continue;
        const type = m[1] as BType;
        const paths = MODEL_MAP[type];
        if (!paths) continue;
        const variant = m[2] ? Number(m[2]) : 1;
        if (variant < 1 || variant > paths.length) continue; // beyond the naming-convention ceiling
        (byType.get(type) ?? byType.set(type, new Set()).get(type)!).add(variant);
      }
      const available = new Map<BType, string[]>();
      byType.forEach((variants, type) => {
        const paths = MODEL_MAP[type]!;
        const urls = Array.from(variants).sort((a, b) => a - b).map((v) => paths[v - 1]);
        if (urls.length) available.set(type, urls);
      });

      for (const t of COMMON_MODEL_TYPES) {
        available.get(t)?.forEach((url) => useGLTF.preload(url));
      }
      setState({ ready: true, available });
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

// ── height tween shared by box + model instancing ────────────────────
// Keeps a per-key "current height", lerps it toward the target each frame,
// and calls onWrite(index, currentHeight) for the dirty instances so the
// caller can rewrite just those matrices.
export function useHeightTween(
  items: BuildingInstance[],
  write: (i: number, h: number) => void,
  commit: () => void,
) {
  const heights = useRef<Map<string, number>>(new Map());
  const cur = useRef<Float32Array>(new Float32Array(0));

  // Seed/refresh: keep known keys' animated height, snap new keys to target.
  useMemo(() => {
    const next = new Float32Array(items.length);
    items.forEach((it, i) => {
      const prev = heights.current.get(it.key);
      next[i] = prev ?? it.h;
    });
    cur.current = next;
    // prune stale keys
    const live = new Set(items.map((it) => it.key));
    heights.current.forEach((_, k) => {
      if (!live.has(k)) heights.current.delete(k);
    });
    items.forEach((it, i) => heights.current.set(it.key, next[i]));
  }, [items]);

  useFrame((_, dt) => {
    let dirty = false;
    const step = Math.min(1, dt * HEIGHT_LERP);
    const n = Math.min(items.length, cur.current.length);
    for (let i = 0; i < n; i++) {
      const target = items[i].h;
      const c = cur.current[i];
      if (Math.abs(c - target) < SETTLE_EPS) {
        if (c !== target) {
          cur.current[i] = target;
          heights.current.set(items[i].key, target);
          write(i, target);
          dirty = true;
        }
        continue;
      }
      const nv = c + (target - c) * step;
      cur.current[i] = nv;
      heights.current.set(items[i].key, nv);
      write(i, nv);
      dirty = true;
    }
    if (dirty) commit();
  });

  return cur;
}

// ── model normalisation ─────────────────────────────────────────────
function useNormalizedModel(url: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    scene.updateWorldMatrix(true, true);
    const geoms: THREE.BufferGeometry[] = [];
    let material: THREE.Material | null = null;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      for (const attr of Object.keys(g.attributes)) {
        if (!["position", "normal", "uv"].includes(attr)) g.deleteAttribute(attr);
      }
      if (!g.getAttribute("normal")) g.computeVertexNormals();
      geoms.push(g);
      if (!material) material = Array.isArray(m.material) ? m.material[0] : m.material;
    });
    if (!geoms.length) return null;

    let merged: THREE.BufferGeometry | null = null;
    try {
      merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
    } catch {
      merged = null;
    }
    if (!merged) merged = geoms[0];

    merged.computeBoundingBox();
    const bb = merged.boundingBox!;
    const size = new THREE.Vector3().subVectors(bb.max, bb.min);
    merged.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -(bb.max.z + bb.min.z) / 2);
    return {
      geometry: merged,
      material: (material as THREE.Material | null) ?? new THREE.MeshStandardMaterial({ color: "#9aa4b2" }),
      size,
    };
  }, [scene]);
}

// ── instanced model ─────────────────────────────────────────────────
export function InstancedModel({
  url, items, groundY, fallbackColor,
}: {
  url: string; items: BuildingInstance[]; groundY: number; fallbackColor: string;
}) {
  const norm = useNormalizedModel(url);
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const writeMatrix = (i: number, h: number) => {
    const mesh = ref.current;
    const s = norm?.size;
    if (!mesh || !s) return;
    const it = items[i];
    dummy.position.set(it.x, groundY, it.z);
    dummy.scale.set(it.w / s.x, Math.max(h, 1) / s.y, it.d / s.z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };
  const commit = () => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  useHeightTween(items, writeMatrix, commit);

  useEffect(() => {
    if (!norm || !ref.current) return;
    for (let i = 0; i < items.length; i++) writeMatrix(i, items[i].h);
    commit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [norm, items]);

  if (!norm) return <InstancedBoxes items={items} groundY={groundY} color={fallbackColor} />;
  return (
    <instancedMesh
      ref={ref}
      key={`model-${items.length}`}
      args={[norm.geometry, norm.material, items.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
}

// ── instanced box (Phase 2 fallback, now with the same tween) ────────
// `winLit` (0..1, from TOD_ENV) adds a *very* faint warm emissive at
// dusk/night so the box skyline keeps a little life instead of going
// flat-black. It is deliberately subtle — a full-body glow can't emulate
// the CSS version's per-facade lit windows; real window-lights are
// deferred to a later pass. Real GLB models keep their own material.
export function InstancedBoxes({
  items, groundY, color, winLit = 0,
}: {
  items: BuildingInstance[]; groundY: number; color: string; winLit?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const writeMatrix = (i: number, h: number) => {
    const mesh = ref.current;
    if (!mesh) return;
    const it = items[i];
    const hh = Math.max(h, 1);
    dummy.position.set(it.x, groundY + hh / 2, it.z);
    dummy.scale.set(it.w, hh, it.d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };
  const commit = () => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  useHeightTween(items, writeMatrix, commit);

  useEffect(() => {
    if (!ref.current) return;
    for (let i = 0; i < items.length; i++) writeMatrix(i, items[i].h);
    commit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <instancedMesh
      ref={ref}
      key={`box-${items.length}`}
      args={[undefined, undefined, items.length]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        metalness={0.25}
        roughness={0.45}
        envMapIntensity={1}
        emissive="#ffb066"
        emissiveIntensity={winLit * 0.06}
      />
    </instancedMesh>
  );
}
