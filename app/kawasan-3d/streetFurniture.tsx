"use client";

// Compact street-level dressing for close camera views. These are instanced
// so even a dense metro only adds four draw calls: benches, bins, planter
// bases, and their shrubs. The deterministic placement keeps the city stable
// across re-renders and leaves enough open pavement for pedestrians.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PLOT, type CellPlacement } from "./cityData";

const TILE_H = 4;

type Spot = { x: number; z: number; rot: number; seed: number };
function hash(text: string) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}

export function StreetFurniture({ placed, claimed }: { placed: CellPlacement[]; claimed?: Set<string> }) {
  const benchRef = useRef<THREE.InstancedMesh>(null);
  const binRef = useRef<THREE.InstancedMesh>(null);
  const potRef = useRef<THREE.InstancedMesh>(null);
  const shrubRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const spots = useMemo<Spot[]>(() => placed.flatMap(({ zone, col, row, cx, cz }) => {
    if (claimed?.has(`${col},${row}`)) return [];
    const seed = hash(zone.id);
    // Keep street furniture deliberately sparse in the largest maps.
    if (seed % 100 > (placed.length > 350 ? 18 : 34)) return [];
    const east = seed % 2 === 0;
    return [{
      x: east ? cx + PLOT / 2 - 13 : cx - PLOT / 2 + 13,
      z: east ? cz + ((seed % 3) - 1) * 42 : cz + PLOT / 2 - 13,
      rot: east ? Math.PI / 2 : 0,
      seed,
    }];
  }), [placed, claimed]);

  useLayoutEffect(() => {
    const refs = [benchRef.current, binRef.current, potRef.current, shrubRef.current];
    if (refs.some((ref) => !ref)) return;
    spots.forEach((spot, i) => {
      // Timber bench with a slight alternating position from the bin.
      dummy.position.set(spot.x, TILE_H + 3.2, spot.z);
      dummy.rotation.set(0, spot.rot, 0);
      dummy.scale.set(10, 1.15, 2.3);
      dummy.updateMatrix();
      benchRef.current!.setMatrixAt(i, dummy.matrix);

      const sideX = Math.cos(spot.rot) * 8;
      const sideZ = -Math.sin(spot.rot) * 8;
      dummy.position.set(spot.x + sideX, TILE_H + 2.1, spot.z + sideZ);
      dummy.scale.set(1.7, 4.2, 1.7);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      binRef.current!.setMatrixAt(i, dummy.matrix);

      const plantX = -Math.cos(spot.rot) * 9;
      const plantZ = Math.sin(spot.rot) * 9;
      dummy.position.set(spot.x + plantX, TILE_H + 2.1, spot.z + plantZ);
      dummy.scale.set(3.3, 4.2, 3.3);
      dummy.updateMatrix();
      potRef.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(spot.x + plantX, TILE_H + 6.7, spot.z + plantZ);
      dummy.scale.set(4.6 + (spot.seed % 3), 5.4, 4.6 + (spot.seed % 3));
      dummy.updateMatrix();
      shrubRef.current!.setMatrixAt(i, dummy.matrix);
    });
    refs.forEach((ref) => {
      ref!.instanceMatrix.needsUpdate = true;
      ref!.computeBoundingSphere();
    });
  }, [spots, dummy]);

  if (!spots.length) return null;
  return (
    <group>
      <instancedMesh ref={benchRef} args={[undefined, undefined, spots.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#7a5134" roughness={0.78} />
      </instancedMesh>
      <instancedMesh ref={binRef} args={[undefined, undefined, spots.length]} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1.25, 1, 8]} />
        <meshStandardMaterial color="#39434c" metalness={0.5} roughness={0.48} />
      </instancedMesh>
      <instancedMesh ref={potRef} args={[undefined, undefined, spots.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8b5e3c" roughness={0.82} />
      </instancedMesh>
      <instancedMesh ref={shrubRef} args={[undefined, undefined, spots.length]} castShadow>
        <sphereGeometry args={[1, 7, 6]} />
        <meshStandardMaterial color="#3d7a45" roughness={0.95} />
      </instancedMesh>
    </group>
  );
}
