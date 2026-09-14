"use client";

// Rooftop water tanks + satellite dishes on low-rise residential
// buildings (house / terrace / kampung) — cheap, deterministic, and one
// of the most recognisable details on a real Malaysian rooftop that a
// plain gabled box otherwise leaves out entirely.

import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import type { BuildingInstance } from "./models";

function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Spot = { x: number; y: number; z: number; rot: number; tank: boolean; dish: boolean };

export function RoofDetails({ items, groundY }: { items: BuildingInstance[]; groundY: number }) {
  const spots = useMemo<Spot[]>(() => items.flatMap((it) => {
    const h = hash(it.key);
    const r1 = (h % 1000) / 1000;
    const r2 = (Math.floor(h / 1000) % 1000) / 1000;
    const r3 = (Math.floor(h / 1_000_000) % 1000) / 1000;
    // Not every roof gets both — a mix of tank-only / dish-only / both /
    // neither reads as real variety, not a uniform grid of props.
    const tank = r1 < 0.62;
    const dish = r2 < 0.55;
    if (!tank && !dish) return [];
    const side = r3 < 0.5 ? -1 : 1;
    return [{
      x: it.x + side * it.w * 0.22,
      y: groundY + it.h,
      z: it.z - it.d * 0.22,
      rot: r3 * Math.PI * 2,
      tank, dish,
    }];
  }), [items, groundY]);

  const tankSpots = useMemo(() => spots.filter((s) => s.tank), [spots]);
  const dishSpots = useMemo(() => spots.filter((s) => s.dish), [spots]);

  const tankRef = useRef<THREE.InstancedMesh>(null);
  const dishRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const tank = tankRef.current;
    if (tank) {
      tankSpots.forEach((s, i) => {
        dummy.position.set(s.x, s.y + 1.6, s.z);
        dummy.rotation.set(0, s.rot, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        tank.setMatrixAt(i, dummy.matrix);
      });
      tank.instanceMatrix.needsUpdate = true;
      tank.computeBoundingSphere();
    }
    const dish = dishRef.current;
    const arm = armRef.current;
    if (dish && arm) {
      dishSpots.forEach((s, i) => {
        // offset from the tank spot so a roof with both doesn't stack them
        const dx = s.x + Math.cos(s.rot) * 3.4;
        const dz = s.z + Math.sin(s.rot) * 3.4;
        dummy.position.set(dx, s.y + 1.1, dz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        arm.setMatrixAt(i, dummy.matrix);
        dummy.position.set(dx, s.y + 2.2, dz);
        dummy.rotation.set(-0.5, s.rot, 0);
        dummy.updateMatrix();
        dish.setMatrixAt(i, dummy.matrix);
      });
      dish.instanceMatrix.needsUpdate = true;
      dish.computeBoundingSphere();
      arm.instanceMatrix.needsUpdate = true;
      arm.computeBoundingSphere();
    }
  }, [tankSpots, dishSpots, dummy]);

  if (!spots.length) return null;
  return (
    <group>
      {tankSpots.length > 0 && (
        <instancedMesh ref={tankRef} args={[undefined, undefined, tankSpots.length]} key={`roof-tank-${tankSpots.length}`} castShadow>
          <cylinderGeometry args={[1.5, 1.5, 3.2, 10]} />
          <meshStandardMaterial color="#8a939e" roughness={0.6} metalness={0.3} />
        </instancedMesh>
      )}
      {dishSpots.length > 0 && (
        <>
          <instancedMesh ref={armRef} args={[undefined, undefined, dishSpots.length]} key={`roof-arm-${dishSpots.length}`}>
            <cylinderGeometry args={[0.15, 0.15, 2.2, 5]} />
            <meshStandardMaterial color="#4a4e56" roughness={0.7} />
          </instancedMesh>
          <instancedMesh ref={dishRef} args={[undefined, undefined, dishSpots.length]} key={`roof-dish-${dishSpots.length}`} castShadow>
            <coneGeometry args={[1.3, 0.7, 12, 1, true]} />
            <meshStandardMaterial color="#dcdfe4" roughness={0.4} metalness={0.15} side={THREE.DoubleSide} />
          </instancedMesh>
        </>
      )}
    </group>
  );
}
