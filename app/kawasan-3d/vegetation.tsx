"use client";

// Phase D: instanced foliage with wind sway for "sawah" (paddy) / "field"
// (grass) ground-cover tiles.
//
// Same cost shape as Phase C's water: however many sawah/field tiles the
// grid places (and, like "pond", these recur a lot — ZONE_FILLER.village
// is ["kampung","sawah"] and village-kind zones cycle repeatedly past the
// base archetype pool, same as river-kind zones did for pond), every
// blade across every tile of a given ground-cover type lives in ONE
// InstancedMesh. Sway is computed per-vertex from a single shared uTime
// uniform — the CPU sets each blade's instance matrix ONCE at layout time
// and never touches it again; there is no per-frame JS work proportional
// to blade count, only the one `uTime` uniform update.
//
// This is layered ON TOP of the existing flat colour box for the tile
// (unchanged — see CityScene.tsx), not a replacement: the box still reads
// as the paddy "floor"/field turf, the blades are the new detail on top.

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BuildingInstance } from "./models";
import { SWAY_VERT, SWAY_FRAG } from "./sway";

const BLADES_PER_TILE = 14;
const BLADE_W = 3.2;
const BLADE_H = 9;

// Blades keep a small rotation variance (not a full 0..2π spread) so the
// per-instance wind sway below — applied along each blade's own local X
// before the instance rotation/scale — still reads as one field swaying
// together instead of blades waving in random unrelated directions.
const ROT_JITTER = 0.3; // radians, +/-

const COLORS: Record<"sawah" | "field", { base: string; tip: string }> = {
  sawah: { base: "#3f6b1e", tip: "#cfd97c" }, // paddy: darker waterline -> golden tips
  field: { base: "#2f5e18", tip: "#82cc45" }, // open grass: darker root -> bright blade
};

function hashSeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return (h >>> 0) || 1;
}
function rngFrom(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

export function Vegetation({
  items, groundY, type, density = 1,
}: {
  items: BuildingInstance[];
  groundY: number;
  type: "sawah" | "field";
  /** 0..1 fraction of BLADES_PER_TILE actually placed — Phase F's quality-tier knob. */
  density?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const bladesPerTile = Math.max(1, Math.round(BLADES_PER_TILE * density));
  const count = items.length * bladesPerTile;
  const colors = COLORS[type];

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0.5 },
      uFreq: { value: 2.0 },
      uColorBase: { value: new THREE.Color(colors.base) },
      uColorTip: { value: new THREE.Color(colors.tip) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    let i = 0;
    for (const it of items) {
      const rnd = rngFrom(hashSeed(it.key));
      for (let b = 0; b < bladesPerTile; b++) {
        const px = it.x + (rnd() - 0.5) * Math.max(it.w - 6, 4);
        const pz = it.z + (rnd() - 0.5) * Math.max(it.d - 6, 4);
        const rotY = (rnd() - 0.5) * ROT_JITTER;
        const wScale = BLADE_W * (0.7 + rnd() * 0.6);
        const hScale = BLADE_H * (0.7 + rnd() * 0.7);
        dummy.position.set(px, groundY + hScale / 2, pz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(wScale, hScale, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [items, groundY, bladesPerTile, dummy]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
  });

  if (!count) return null;
  return (
    <instancedMesh
      ref={ref}
      key={`veg-${type}-${count}`}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={SWAY_VERT}
        fragmentShader={SWAY_FRAG}
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}
