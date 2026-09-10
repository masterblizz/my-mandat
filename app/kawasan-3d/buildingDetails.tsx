"use client";

// Lightweight architectural detail pass for the procedural city.  The base
// shapes remain instanced in procedural.tsx; this adds a small, fixed set of
// instanced overlays per building family so the skyline gets façade rhythm,
// entrances and rooftop services without changing any placement data.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useHeightTween, type BuildingInstance } from "./models";
import type { BType } from "./cityData";

const TALL = new Set<BType>(["tower", "skyscraper", "antenna"]);
const RESIDENTIAL = new Set<BType>(["tower", "house", "terrace", "kampung", "shophouse"]);
const RETAIL = new Set<BType>(["shop", "stall", "shophouse", "mall", "clinic", "terminal"]);
const INDUSTRIAL = new Set<BType>(["factory", "warehouse"]);
const FACADE_BANDS = 4;
const BALCONY_BANDS = 3;

export function ArchitecturalDetails({
  type, items, groundY, winLit,
}: {
  type: BType;
  items: BuildingInstance[];
  groundY: number;
  winLit: number;
}) {
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const plantRef = useRef<THREE.InstancedMesh>(null);
  const facadeRef = useRef<THREE.InstancedMesh>(null);
  const balconyRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const isTall = TALL.has(type);
  const isResidential = RESIDENTIAL.has(type);
  const isRetail = RETAIL.has(type);
  const isIndustrial = INDUSTRIAL.has(type);
  const hasEntrance = isRetail || isResidential || isIndustrial;

  const write = (i: number, h: number) => {
    const it = items[i];
    if (!it) return;
    const hh = Math.max(h, 1);
    const roof = roofRef.current;
    const plant = plantRef.current;
    const facade = facadeRef.current;
    const balcony = balconyRef.current;
    const canopy = canopyRef.current;

    // Elevator cores / water tanks: one compact rooftop silhouette is far
    // more readable at the isometric distance than high-poly kitbash parts.
    if (roof) {
      const rw = it.w * (isTall ? 0.38 : isIndustrial ? 0.28 : 0.26);
      const rd = it.d * (isTall ? 0.38 : isIndustrial ? 0.48 : 0.28);
      const rh = isTall ? Math.max(7, hh * 0.055) : Math.max(3.5, hh * 0.11);
      dummy.position.set(it.x, groundY + hh + rh / 2, it.z);
      dummy.scale.set(rw, rh, rd);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      roof.setMatrixAt(i, dummy.matrix);
    }
    if (plant) {
      const ph = isIndustrial ? Math.max(3, hh * 0.11) : Math.max(2.4, hh * 0.04);
      dummy.position.set(it.x - it.w * 0.18, groundY + hh + ph / 2, it.z + it.d * 0.16);
      dummy.scale.set(it.w * (isIndustrial ? 0.24 : 0.14), ph, it.d * (isIndustrial ? 0.22 : 0.14));
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      plant.setMatrixAt(i, dummy.matrix);
    }
    if (facade) {
      for (let b = 0; b < FACADE_BANDS; b++) {
        const ratio = (b + 1) / (FACADE_BANDS + 1);
        dummy.position.set(it.x, groundY + hh * ratio, it.z);
        dummy.scale.set(it.w * 1.025, Math.max(0.9, hh * (isTall ? 0.012 : 0.02)), it.d * 1.025);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        facade.setMatrixAt(i * FACADE_BANDS + b, dummy.matrix);
      }
    }
    if (balcony) {
      for (let b = 0; b < BALCONY_BANDS; b++) {
        const ratio = (b + 1) / (BALCONY_BANDS + 1);
        // A shallow front slab and rail line produces an apartment / shoplot
        // read without obscuring the window texture behind it.
        dummy.position.set(it.x, groundY + hh * ratio, it.z + it.d * 0.515);
        dummy.scale.set(it.w * 0.92, Math.max(0.8, hh * 0.016), Math.max(1.2, it.d * 0.09));
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        balcony.setMatrixAt(i * BALCONY_BANDS + b, dummy.matrix);
      }
    }
    if (canopy) {
      const y = groundY + Math.min(hh * 0.25, 10);
      dummy.position.set(it.x, y, it.z + it.d * 0.54);
      dummy.scale.set(it.w * (isRetail ? 0.68 : 0.38), 1.25, Math.max(2.4, it.d * (isRetail ? 0.18 : 0.1)));
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      canopy.setMatrixAt(i, dummy.matrix);
    }
  };

  const commit = () => {
    [roofRef.current, plantRef.current, facadeRef.current, balconyRef.current, canopyRef.current].forEach((mesh) => {
      if (!mesh) return;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  };
  useHeightTween(items, write, commit);

  useEffect(() => {
    items.forEach((it, i) => write(i, it.h));
    commit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, type]);

  return (
    <group>
      <instancedMesh ref={roofRef} args={[undefined, undefined, items.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={isTall ? "#394958" : "#74787d"} metalness={0.5} roughness={0.42} />
      </instancedMesh>
      <instancedMesh ref={plantRef} args={[undefined, undefined, items.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#4c535b" metalness={0.45} roughness={0.62} />
      </instancedMesh>
      {isTall && (
        <instancedMesh ref={facadeRef} args={[undefined, undefined, items.length * FACADE_BANDS]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#192a38" metalness={0.7} roughness={0.2} envMapIntensity={1.35} />
        </instancedMesh>
      )}
      {isResidential && (
        <instancedMesh ref={balconyRef} args={[undefined, undefined, items.length * BALCONY_BANDS]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#5b6268" metalness={0.5} roughness={0.5} />
        </instancedMesh>
      )}
      {hasEntrance && (
        <instancedMesh ref={canopyRef} args={[undefined, undefined, items.length]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#273746" metalness={0.55} roughness={0.35} emissive="#e8b66d" emissiveIntensity={winLit * 0.16} />
        </instancedMesh>
      )}
    </group>
  );
}
