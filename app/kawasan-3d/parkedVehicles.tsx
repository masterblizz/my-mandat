"use client";

// Parked cars + motorcycles along a tile's own kerb margin — a street
// lined only with moving traffic and bare pavement reads as a film set,
// not a lived-in city. Fully static (no useFrame, built once like
// <StreetFurniture>), sitting inside the tile's paved forecourt margin
// (radius PLOT/2-22) rather than out on the road band itself, which is
// already tightly packed with the moving-traffic lane, the sidewalk
// loop and the kerb-side street lamps/utility poles.

import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import { PLOT, type CellPlacement, type ZoneKind } from "./cityData";

const TILE_H = 4;
const CAR_COLORS = ["#e2e8f0", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#111827", "#a855f7"];
const MC_COLORS = ["#e2382a", "#1c9dd6", "#1a1c22", "#f2b705"];
const MARGIN = PLOT / 2 - 22;

function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

function parkWorthy(kind: ZoneKind): boolean {
  return kind === "urban" || kind === "commercial" || kind === "market" || kind === "housing";
}

type Spot = { x: number; z: number; heading: number; isCar: boolean; color: THREE.Color };

export function ParkedVehicles({
  placed, gridSize, claimed,
}: {
  placed: CellPlacement[];
  gridSize: number;
  claimed?: Set<string>;
}) {
  const spots = useMemo<Spot[]>(() => {
    if (gridSize <= 6) return [];
    const out: Spot[] = [];
    const mid = (gridSize - 1) / 2;
    const maxD = Math.hypot(mid, mid) || 1;
    for (const { zone, col, row, cx, cz } of placed) {
      if (claimed?.has(`${col},${row}`)) continue;
      if (!parkWorthy(zone.kind)) continue;
      const coreness = 1 - Math.hypot(col - mid, row - mid) / maxD;
      const rnd = rng(hash(`${zone.id}:park`));
      const busy = zone.kind === "urban" || zone.kind === "commercial" || zone.kind === "market";
      const n = busy ? Math.round(1 + coreness * 3) : rnd() < 0.5 ? 1 : 0;
      if (!n) continue;
      // one edge of the tile's own margin is this zone's kerb-parking bay
      const edge = Math.floor(rnd() * 4); // 0=+x,1=-x,2=+z,3=-z
      const along = (t: number) => {
        if (edge === 0) return { x: cx + MARGIN, z: cz + t * (PLOT / 2 - 14), heading: Math.PI / 2 };
        if (edge === 1) return { x: cx - MARGIN, z: cz + t * (PLOT / 2 - 14), heading: -Math.PI / 2 };
        if (edge === 2) return { x: cx + t * (PLOT / 2 - 14), z: cz + MARGIN, heading: Math.PI };
        return { x: cx + t * (PLOT / 2 - 14), z: cz - MARGIN, heading: 0 };
      };
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? (rnd() - 0.5) * 1.2 : -0.8 + (1.6 * i) / (n - 1);
        const { x, z, heading } = along(t);
        const isCar = rnd() < 0.62;
        const palette = isCar ? CAR_COLORS : MC_COLORS;
        out.push({
          x, z, heading: heading + (rnd() - 0.5) * 0.05, isCar,
          color: new THREE.Color(palette[Math.floor(rnd() * palette.length)]),
        });
      }
    }
    return out;
  }, [placed, gridSize, claimed]);

  const carSpots = useMemo(() => spots.filter((s) => s.isCar), [spots]);
  const mcSpots = useMemo(() => spots.filter((s) => !s.isCar), [spots]);

  const carBodyRef = useRef<THREE.InstancedMesh>(null);
  const carCabinRef = useRef<THREE.InstancedMesh>(null);
  const carWheelRef = useRef<THREE.InstancedMesh>(null);
  const mcBodyRef = useRef<THREE.InstancedMesh>(null);
  const mcWheelRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const body = carBodyRef.current;
    const cabin = carCabinRef.current;
    const wheels = carWheelRef.current;
    if (body && cabin && wheels) {
      carSpots.forEach((s, i) => {
        dummy.position.set(s.x, TILE_H + 2.75, s.z);
        dummy.rotation.set(0, s.heading, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        body.setMatrixAt(i, dummy.matrix);
        body.setColorAt(i, s.color);

        dummy.position.set(s.x, TILE_H + 5.7, s.z);
        dummy.updateMatrix();
        cabin.setMatrixAt(i, dummy.matrix);
        cabin.setColorAt(i, s.color.clone().lerp(new THREE.Color("#172033"), 0.64));

        const cos = Math.cos(s.heading), sin = Math.sin(s.heading);
        ([[-5.7, -4.1], [-5.7, 4.1], [5.7, -4.1], [5.7, 4.1]] as const).forEach(([f, side], n) => {
          const wx = s.x + cos * f - sin * side;
          const wz = s.z + sin * f + cos * side;
          dummy.position.set(wx, TILE_H + 2.25, wz);
          dummy.rotation.set(Math.PI / 2, s.heading, 0);
          dummy.updateMatrix();
          wheels.setMatrixAt(i * 4 + n, dummy.matrix);
        });
      });
      body.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      body.computeBoundingSphere();
      cabin.instanceMatrix.needsUpdate = true;
      if (cabin.instanceColor) cabin.instanceColor.needsUpdate = true;
      cabin.computeBoundingSphere();
      wheels.instanceMatrix.needsUpdate = true;
      wheels.computeBoundingSphere();
    }

    const mcBody = mcBodyRef.current;
    const mcWheels = mcWheelRef.current;
    if (mcBody && mcWheels) {
      mcSpots.forEach((s, i) => {
        dummy.position.set(s.x, TILE_H + 3.1, s.z);
        dummy.rotation.set(0, s.heading, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mcBody.setMatrixAt(i, dummy.matrix);
        mcBody.setColorAt(i, s.color);

        const cos = Math.cos(s.heading), sin = Math.sin(s.heading);
        ([-3.4, 3.4] as const).forEach((f, n) => {
          const wx = s.x + cos * f;
          const wz = s.z + sin * f;
          dummy.position.set(wx, TILE_H + 1.6, wz);
          dummy.rotation.set(Math.PI / 2, s.heading, 0);
          dummy.updateMatrix();
          mcWheels.setMatrixAt(i * 2 + n, dummy.matrix);
        });
      });
      mcBody.instanceMatrix.needsUpdate = true;
      if (mcBody.instanceColor) mcBody.instanceColor.needsUpdate = true;
      mcBody.computeBoundingSphere();
      mcWheels.instanceMatrix.needsUpdate = true;
      mcWheels.computeBoundingSphere();
    }
  }, [carSpots, mcSpots, dummy]);

  if (!spots.length) return null;
  return (
    <group>
      {carSpots.length > 0 && (
        <>
          <instancedMesh ref={carBodyRef} args={[undefined, undefined, carSpots.length]} key={`park-car-body-${carSpots.length}`} castShadow>
            <boxGeometry args={[18, 5.5, 8]} />
            <meshStandardMaterial color="#ffffff" metalness={0.18} roughness={0.42} />
          </instancedMesh>
          <instancedMesh ref={carCabinRef} args={[undefined, undefined, carSpots.length]} key={`park-car-cabin-${carSpots.length}`} castShadow>
            <boxGeometry args={[9.5, 3.4, 6.7]} />
            <meshStandardMaterial color="#ffffff" metalness={0.35} roughness={0.2} />
          </instancedMesh>
          <instancedMesh ref={carWheelRef} args={[undefined, undefined, carSpots.length * 4]} key={`park-car-wheel-${carSpots.length}`} castShadow>
            <cylinderGeometry args={[2.05, 2.05, 1.3, 8]} />
            <meshStandardMaterial color="#111318" roughness={0.9} />
          </instancedMesh>
        </>
      )}
      {mcSpots.length > 0 && (
        <>
          <instancedMesh ref={mcBodyRef} args={[undefined, undefined, mcSpots.length]} key={`park-mc-body-${mcSpots.length}`} castShadow>
            <boxGeometry args={[7.5, 3.2, 2.6]} />
            <meshStandardMaterial color="#ffffff" metalness={0.3} roughness={0.35} />
          </instancedMesh>
          <instancedMesh ref={mcWheelRef} args={[undefined, undefined, mcSpots.length * 2]} key={`park-mc-wheel-${mcSpots.length}`} castShadow>
            <cylinderGeometry args={[1.6, 1.6, 0.9, 8]} />
            <meshStandardMaterial color="#111318" roughness={0.9} />
          </instancedMesh>
        </>
      )}
    </group>
  );
}
