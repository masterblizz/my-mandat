"use client";

// Landmark-scale public spaces for the Bukit Bintang profile. These are not
// map tiles: each is a small piece of recognisable urban fabric placed around
// the existing KL landmarks, so the city reads as districts instead of an
// uninterrupted procedural building grid.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PLOT, plotXY, worldCentre } from "./cityData";

const TILE_H = 4;

function centre(index: number, gridSize: number) {
  return plotXY(gridSize)[index] + PLOT / 2 - worldCentre(gridSize);
}

function landmarkCells(gridSize: number) {
  const mid = Math.round((gridSize - 1) / 2);
  return {
    // Keep these aligned with klProfile.tsx, where the landmark meshes live.
    twin: [Math.min(gridSize - 1, mid + 1), mid] as const,
    tower: [Math.max(0, mid - 4), Math.max(0, mid - 3)] as const,
    retail: [Math.max(0, mid - 2), mid] as const,
  };
}

// Only a handful of plots become deliberately open public realm. CityScene
// merges these with its normal claims before it produces ordinary buildings.
export function bukitBintangDistrictClaims(gridSize: number): string[] {
  if (gridSize < 10) return [];
  const { twin, tower, retail } = landmarkCells(gridSize);
  const raw = [
    twin, [twin[0] + 1, twin[1]], [twin[0] + 1, twin[1] + 1], [twin[0], twin[1] + 1],
    tower, [tower[0] - 1, tower[1]], [tower[0], tower[1] - 1],
    retail,
  ];
  return raw
    .filter(([col, row]) => col >= 0 && row >= 0 && col < gridSize && row < gridSize)
    .map(([col, row]) => `${col},${row}`);
}

function ParkTrees({ x, z, count, radius }: { x: number; z: number; count: number; radius: number }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const trees = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = i * 2.399963 + 0.4;
    const ring = radius * (0.54 + ((i * 37) % 41) / 100);
    return { x: Math.cos(angle) * ring, z: Math.sin(angle) * ring, s: 0.78 + (i % 5) * 0.09 };
  }), [count, radius]);
  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const crown = crownRef.current;
    if (!trunk || !crown) return;
    const d = new THREE.Object3D();
    trees.forEach((tree, i) => {
      d.position.set(x + tree.x, TILE_H + 12 * tree.s, z + tree.z);
      d.scale.set(2.4 * tree.s, 24 * tree.s, 2.4 * tree.s);
      d.updateMatrix(); trunk.setMatrixAt(i, d.matrix);
      d.position.set(x + tree.x, TILE_H + 31 * tree.s, z + tree.z);
      d.scale.set(19 * tree.s, 20 * tree.s, 19 * tree.s);
      d.updateMatrix(); crown.setMatrixAt(i, d.matrix);
    });
    trunk.instanceMatrix.needsUpdate = true;
    crown.instanceMatrix.needsUpdate = true;
  }, [trees, x, z]);
  return <>
    <instancedMesh ref={trunkRef} args={[undefined, undefined, count]} castShadow>
      <cylinderGeometry args={[0.5, 0.8, 1, 6]} />
      <meshStandardMaterial color="#755337" roughness={0.9} />
    </instancedMesh>
    <instancedMesh ref={crownRef} args={[undefined, undefined, count]} castShadow>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#276340" roughness={0.92} />
    </instancedMesh>
  </>;
}

export function BukitBintangDistricts({ gridSize, night = 0 }: { gridSize: number; night?: number }) {
  if (gridSize < 10) return null;
  const { twin, tower, retail } = landmarkCells(gridSize);
  const klccX = centre(twin[0], gridSize);
  const klccZ = centre(twin[1], gridSize);
  const hillX = centre(tower[0], gridSize);
  const hillZ = centre(tower[1], gridSize);
  const retailX = centre(retail[0], gridSize);
  const retailZ = centre(retail[1], gridSize);
  const light = night > 0.25;

  return <group>
    {/* Put KLCC Park on the adjoining claimed precinct, not through the twin
        towers' own footprint. This keeps the planted landscape visually
        connected to KLCC while preventing trees, water and paving from
        intersecting the tower bases. */}
    <group position={[klccX + 240, TILE_H + 0.8, klccZ + 120]}>
      <mesh receiveShadow>
        <boxGeometry args={[220, 1.2, 220]} />
        <meshStandardMaterial color="#315e43" roughness={0.96} />
      </mesh>
      <mesh position={[0, 1.2, 68]} receiveShadow>
        <boxGeometry args={[160, 0.85, 26]} />
        <meshStandardMaterial color="#d7d1bd" roughness={0.88} />
      </mesh>
      <mesh position={[42, 2.1, -34]} receiveShadow>
        <boxGeometry args={[76, 2.1, 56]} />
        <meshStandardMaterial color="#28738b" roughness={0.2} metalness={0.24} emissive="#0b3141" emissiveIntensity={light ? 0.55 : 0.08} />
      </mesh>
      <mesh position={[42, 3.3, -34]}>
        <boxGeometry args={[64, 0.7, 44]} />
        <meshBasicMaterial color="#67cde0" transparent opacity={light ? 0.58 : 0.22} toneMapped={false} />
      </mesh>
      <ParkTrees x={-24} z={8} count={12} radius={58} />
    </group>

    {/* Bukit Nanas: an unmistakable low, forested hill below Menara KL. */}
    <group position={[hillX, 0, hillZ]}>
      <mesh position={[0, TILE_H + 21, 0]} receiveShadow>
        <coneGeometry args={[184, 42, 18]} />
        <meshStandardMaterial color="#29543b" roughness={1} />
      </mesh>
      <mesh position={[0, TILE_H + 43.3, 0]}>
        <cylinderGeometry args={[67, 76, 1.2, 20]} />
        <meshStandardMaterial color="#66705e" roughness={0.92} />
      </mesh>
      <ParkTrees x={0} z={0} count={28} radius={145} />
    </group>

    {/* A compact Pavilion/Jalan Alor-style pedestrian forecourt: warm stone,
        palms and a lit arcade line give the retail core a human-scale layer. */}
    <group position={[retailX, TILE_H + 1, retailZ]}>
      <mesh receiveShadow>
        <boxGeometry args={[218, 1.1, 218]} />
        <meshStandardMaterial color="#b8aa8b" roughness={0.9} />
      </mesh>
      {[-72, -24, 24, 72].map((offset) => <mesh key={offset} position={[offset, 18, -86]} castShadow>
        <boxGeometry args={[7, 34, 7]} />
        <meshStandardMaterial color="#3f4548" metalness={0.32} roughness={0.6} />
      </mesh>)}
      <mesh position={[0, 37, -86]}>
        <boxGeometry args={[188, 5, 8]} />
        <meshStandardMaterial color="#c6a24d" metalness={0.45} roughness={0.42} emissive="#8b5d10" emissiveIntensity={light ? 0.52 : 0.04} />
      </mesh>
      <ParkTrees x={0} z={44} count={8} radius={76} />
    </group>
  </group>;
}
