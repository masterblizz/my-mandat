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
import { PLOT, slotPos, zoneBuildings, type CellPlacement, type SeatTraits, type ZoneKind } from "./cityData";
import { vehicleBox, makePaintMaterial, makeGlassMaterial, makeTyreMaterial } from "./vehicleLook";

const TILE_H = 4;
const CAR_COLORS = ["#e2e8f0", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#ec6c20", "#a855f7"];
const MC_COLORS = ["#e2382a", "#1c9dd6", "#7c3aed", "#f2b705"];
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
  placed, gridSize, density, traits, claimed,
}: {
  placed: CellPlacement[];
  gridSize: number;
  density: number;
  traits: SeatTraits;
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
      // Build a conservative footprint list from the exact same layout
      // function used by <Buildings>. Parking candidates are rejected if
      // their full car/motorcycle rectangle touches any of these boxes.
      // This keeps a dense tile's forecourt lively without ever placing a
      // vehicle inside a shop, tower or factory.
      const footprints = zoneBuildings(zone, density, traits, coreness).map((spec) => {
        const slot = slotPos(spec.slot);
        return {
          minX: cx - PLOT / 2 + slot.x,
          maxX: cx - PLOT / 2 + slot.x + spec.w,
          minZ: cz - PLOT / 2 + slot.y,
          maxZ: cz - PLOT / 2 + slot.y + spec.d,
        };
      });
      const along = (edge: number, t: number) => {
        if (edge === 0) return { x: cx + MARGIN, z: cz + t * (PLOT / 2 - 14), heading: Math.PI / 2 };
        if (edge === 1) return { x: cx - MARGIN, z: cz + t * (PLOT / 2 - 14), heading: -Math.PI / 2 };
        if (edge === 2) return { x: cx + t * (PLOT / 2 - 14), z: cz + MARGIN, heading: Math.PI };
        return { x: cx + t * (PLOT / 2 - 14), z: cz - MARGIN, heading: 0 };
      };
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? (rnd() - 0.5) * 1.2 : -0.8 + (1.6 * i) / (n - 1);
        const isCar = rnd() < 0.62;
        const startEdge = Math.floor(rnd() * 4);
        let spot: { x: number; z: number; heading: number } | null = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          const edge = (startEdge + attempt) % 4;
          const candidate = along(edge, t);
          // Long axis follows the edge. Leave an extra two units so a car
          // cannot visually kiss a building wall at shallow camera angles.
          const halfX = edge < 2 ? (isCar ? 6 : 2.5) : (isCar ? 11 : 4.5);
          const halfZ = edge < 2 ? (isCar ? 11 : 4.5) : (isCar ? 6 : 2.5);
          const blocked = footprints.some((f) =>
            candidate.x + halfX + 2 > f.minX && candidate.x - halfX - 2 < f.maxX &&
            candidate.z + halfZ + 2 > f.minZ && candidate.z - halfZ - 2 < f.maxZ,
          );
          if (!blocked) { spot = candidate; break; }
        }
        if (!spot) continue;
        const palette = isCar ? CAR_COLORS : MC_COLORS;
        out.push({
          x: spot.x, z: spot.z, heading: spot.heading + (rnd() - 0.5) * 0.05, isCar,
          color: new THREE.Color(palette[Math.floor(rnd() * palette.length)]),
        });
      }
    }
    return out;
  }, [placed, gridSize, density, traits, claimed]);

  const carSpots = useMemo(() => spots.filter((s) => s.isCar), [spots]);
  const mcSpots = useMemo(() => spots.filter((s) => !s.isCar), [spots]);

  const carBodyRef = useRef<THREE.InstancedMesh>(null);
  const carCabinRef = useRef<THREE.InstancedMesh>(null);
  const carWheelRef = useRef<THREE.InstancedMesh>(null);
  const mcBodyRef = useRef<THREE.InstancedMesh>(null);
  const mcTankRef = useRef<THREE.InstancedMesh>(null);
  const mcSeatRef = useRef<THREE.InstancedMesh>(null);
  const mcForkRef = useRef<THREE.InstancedMesh>(null);
  const mcHandlebarRef = useRef<THREE.InstancedMesh>(null);
  const mcLightRef = useRef<THREE.InstancedMesh>(null);
  const mcWheelRef = useRef<THREE.InstancedMesh>(null);
  const paint = useMemo(() => makePaintMaterial(), []);
  const glass = useMemo(() => makeGlassMaterial(), []);
  const tyre = useMemo(() => makeTyreMaterial(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const body = carBodyRef.current;
    const cabin = carCabinRef.current;
    const wheels = carWheelRef.current;
    if (body && cabin && wheels) {
      [body, cabin].forEach((mesh) => {
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.vertexColors = false;
        material.color.set("#ffffff");
        material.needsUpdate = true;
      });
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
        cabin.setColorAt(i, s.color.clone().lerp(new THREE.Color("#78a6c2"), 0.28));

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
    const mcTank = mcTankRef.current;
    const mcSeat = mcSeatRef.current;
    const mcFork = mcForkRef.current;
    const mcHandlebar = mcHandlebarRef.current;
    const mcLights = mcLightRef.current;
    const mcWheels = mcWheelRef.current;
    if (mcBody && mcTank && mcSeat && mcFork && mcHandlebar && mcLights && mcWheels) {
      [mcBody, mcTank].forEach((mesh) => {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.vertexColors = false;
        material.color.set("#ffffff");
        material.needsUpdate = true;
      });
      mcSpots.forEach((s, i) => {
        const cos = Math.cos(s.heading), sin = Math.sin(s.heading);
        const place = (fwd: number, side: number, y: number) =>
          dummy.position.set(s.x + cos * fwd - sin * side, y, s.z + sin * fwd + cos * side);

        // A slim chassis, tank and saddle give parked bikes a recognisable
        // underbone/scooter silhouette instead of a single floating block.
        place(0, 0, TILE_H + 3.05);
        dummy.rotation.set(0, s.heading, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mcBody.setMatrixAt(i, dummy.matrix);
        mcBody.setColorAt(i, s.color);

        place(0.45, 0, TILE_H + 4.0);
        dummy.updateMatrix();
        mcTank.setMatrixAt(i, dummy.matrix);
        mcTank.setColorAt(i, s.color.clone().lerp(new THREE.Color("#e7eef4"), 0.18));

        place(-1.75, 0, TILE_H + 4.12);
        dummy.updateMatrix();
        mcSeat.setMatrixAt(i, dummy.matrix);
        place(3.35, 0, TILE_H + 3.7);
        dummy.updateMatrix();
        mcFork.setMatrixAt(i, dummy.matrix);
        place(3.15, 0, TILE_H + 5.05);
        dummy.updateMatrix();
        mcHandlebar.setMatrixAt(i, dummy.matrix);

        ([-3.4, 3.4] as const).forEach((f, n) => {
          place(f, 0, TILE_H + 1.6);
          dummy.rotation.set(Math.PI / 2, s.heading, 0);
          dummy.updateMatrix();
          mcWheels.setMatrixAt(i * 2 + n, dummy.matrix);
        });
        place(4.05, 0, TILE_H + 3.95);
        dummy.rotation.set(0, s.heading, 0);
        dummy.updateMatrix();
        mcLights.setMatrixAt(i * 2, dummy.matrix);
        place(-4.0, 0, TILE_H + 3.55);
        dummy.updateMatrix();
        mcLights.setMatrixAt(i * 2 + 1, dummy.matrix);
      });
      mcBody.instanceMatrix.needsUpdate = true;
      if (mcBody.instanceColor) mcBody.instanceColor.needsUpdate = true;
      mcBody.computeBoundingSphere();
      mcTank.instanceMatrix.needsUpdate = true;
      if (mcTank.instanceColor) mcTank.instanceColor.needsUpdate = true;
      mcSeat.instanceMatrix.needsUpdate = true;
      mcFork.instanceMatrix.needsUpdate = true;
      mcHandlebar.instanceMatrix.needsUpdate = true;
      mcLights.instanceMatrix.needsUpdate = true;
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
            <primitive object={vehicleBox(18, 5.5, 8, 1.6)} attach="geometry" />
            <primitive object={paint} attach="material" />
          </instancedMesh>
          <instancedMesh ref={carCabinRef} args={[undefined, undefined, carSpots.length]} key={`park-car-cabin-${carSpots.length}`} castShadow>
            <primitive object={vehicleBox(9.5, 3.4, 6.7, 1.3)} attach="geometry" />
            <primitive object={glass} attach="material" />
          </instancedMesh>
          <instancedMesh ref={carWheelRef} args={[undefined, undefined, carSpots.length * 4]} key={`park-car-wheel-${carSpots.length}`} castShadow>
            <cylinderGeometry args={[2.05, 2.05, 1.3, 10]} />
            <primitive object={tyre} attach="material" />
          </instancedMesh>
        </>
      )}
      {mcSpots.length > 0 && (
        <>
          <instancedMesh ref={mcBodyRef} args={[undefined, undefined, mcSpots.length]} key={`park-mc-body-${mcSpots.length}`} castShadow>
            <primitive object={vehicleBox(7.7, 0.7, 1.2, 0.32)} attach="geometry" />
            <primitive object={paint} attach="material" />
          </instancedMesh>
          <instancedMesh ref={mcTankRef} args={[undefined, undefined, mcSpots.length]} key={`park-mc-tank-${mcSpots.length}`} castShadow>
            <primitive object={vehicleBox(2.9, 1.45, 2.15, 0.52)} attach="geometry" />
            <primitive object={paint} attach="material" />
          </instancedMesh>
          <instancedMesh ref={mcSeatRef} args={[undefined, undefined, mcSpots.length]} key={`park-mc-seat-${mcSpots.length}`} castShadow>
            <primitive object={vehicleBox(3.3, 0.72, 1.55, 0.3)} attach="geometry" />
            <meshStandardMaterial color="#1b242d" roughness={0.82} />
          </instancedMesh>
          <instancedMesh ref={mcForkRef} args={[undefined, undefined, mcSpots.length]} key={`park-mc-fork-${mcSpots.length}`} castShadow>
            <boxGeometry args={[0.6, 3.4, 0.55]} />
            <meshStandardMaterial color="#a7b5c2" metalness={0.72} roughness={0.25} />
          </instancedMesh>
          <instancedMesh ref={mcHandlebarRef} args={[undefined, undefined, mcSpots.length]} key={`park-mc-bar-${mcSpots.length}`}>
            <boxGeometry args={[0.7, 0.32, 3.8]} />
            <meshStandardMaterial color="#465563" metalness={0.68} roughness={0.28} />
          </instancedMesh>
          <instancedMesh ref={mcLightRef} args={[undefined, undefined, mcSpots.length * 2]} key={`park-mc-light-${mcSpots.length}`}>
            <sphereGeometry args={[0.62, 7, 6]} />
            <meshBasicMaterial color="#fff1ad" toneMapped={false} />
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
