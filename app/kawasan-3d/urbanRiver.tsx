"use client";

// A metro-only river corridor that replaces one otherwise-identical road.
// The narrow channel, retained banks, planted promenade and frequent road
// bridges are modelled after the engineered urban rivers found through KL.
// All repeated details are instanced so the dense 30x30 city only adds a
// handful of draw calls.

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLOT, ROAD_GAP, roadsH, roadsV, worldCentre, worldSize, type Tod } from "./cityData";
import type { Weather } from "./scenery";

const ROAD_W = ROAD_GAP - PLOT;
const WATER_W = 28;
const BRIDGE_SPAN = 62;
const BRIDGE_DECK_H = 0.82;
const BRIDGE_DECK_Y = 1.28;

/** Run near the core, like KL's real river system, while clearing the landmark/roundabout axis. */
export function urbanRiverRoadIndex(gridSize: number): number | null {
  return gridSize >= 10 ? Math.max(1, Math.floor(gridSize * 0.4)) : null;
}

function makeWaterTexture(): THREE.DataTexture {
  const width = 64;
  const height = 256;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const wave = Math.sin(y * 0.2 + Math.sin(x * 0.31) * 2.2) * 0.5 + 0.5;
      const eddy = Math.sin(x * 0.52 - y * 0.075) * 0.5 + 0.5;
      const n = Math.round(wave * 13 + eddy * 7);
      const i = (y * width + x) * 4;
      pixels[i] = 73 + n;
      pixels[i + 1] = 96 + n;
      pixels[i + 2] = 89 + Math.round(n * 0.85);
      pixels[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.4, 18);
  texture.needsUpdate = true;
  return texture;
}

type TreeSpot = { x: number; z: number; scale: number };

export function UrbanRiver({ gridSize, tod, weather }: { gridSize: number; tod: Tod; weather: Weather }) {
  const riverIndex = urbanRiverRoadIndex(gridSize);
  const centre = worldCentre(gridSize);
  const span = worldSize(gridSize);
  const x = riverIndex === null ? 0 : roadsV(gridSize)[riverIndex] - centre + ROAD_W / 2;
  const bridgeZ = useMemo(
    () => roadsH(gridSize).map((z) => z - centre + ROAD_W / 2),
    [gridSize, centre],
  );
  const waterMap = useMemo(makeWaterTexture, []);

  useEffect(() => () => waterMap.dispose(), [waterMap]);
  useFrame((_, dt) => {
    waterMap.offset.y -= Math.min(dt, 0.05) * (weather === "rain" ? 0.055 : 0.028);
  });

  const treeSpots = useMemo(() => {
    const out: TreeSpot[] = [];
    for (let i = 0; i + 1 < bridgeZ.length; i++) {
      // Mid-block planting leaves bridge approaches and sight lines clear.
      const z = (bridgeZ[i] + bridgeZ[i + 1]) / 2;
      const jitter = ((i * 37) % 17) - 8;
      out.push({ x: x - ROAD_W / 2 - 6, z: z + jitter, scale: 0.82 + (i % 4) * 0.07 });
      if (i % 2 === 0) out.push({ x: x + ROAD_W / 2 + 6, z: z - jitter, scale: 0.88 + (i % 3) * 0.08 });
    }
    return out;
  }, [bridgeZ, x]);

  if (riverIndex === null) return null;

  const glow = tod === "night" ? 0.18 : tod === "dusk" ? 0.07 : 0.015;
  return (
    <group>
      {/* Channel bed keeps the river grounded when seen at a low camera angle. */}
      <mesh position={[x, 0.22, 0]} receiveShadow>
        <boxGeometry args={[WATER_W + 3, 0.45, span]} />
        <meshStandardMaterial color="#263d36" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.72, 0]} receiveShadow>
        <planeGeometry args={[WATER_W, span]} />
        <meshPhysicalMaterial
          map={waterMap}
          color={weather === "rain" ? "#d5dfdc" : "#edf3ef"}
          emissive="#294f4a"
          emissiveIntensity={0.12 + glow}
          roughness={weather === "rain" ? 0.2 : 0.36}
          metalness={0.08}
          clearcoat={0.32}
          clearcoatRoughness={0.42}
          envMapIntensity={1.3}
        />
      </mesh>

      {/* Sloped-looking earth banks, stone retaining edges and paved towpaths. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[x + side * (WATER_W / 2 + 3), 0.48, 0]} receiveShadow>
            <boxGeometry args={[6, 0.72, span]} />
            <meshStandardMaterial color="#596147" roughness={0.98} />
          </mesh>
          <mesh position={[x + side * (WATER_W / 2 + 0.65), 0.56, 0]} receiveShadow>
            <boxGeometry args={[1.3, 1.1, span]} />
            <meshStandardMaterial color="#77776d" roughness={0.92} />
          </mesh>
          <mesh position={[x + side * (ROAD_W / 2 - 2.4), 0.92, 0]} receiveShadow>
            <boxGeometry args={[4.8, 0.22, span]} />
            <meshStandardMaterial color="#a19b86" roughness={0.88} />
          </mesh>
        </group>
      ))}

      <RiverBridges x={x} bridgeZ={bridgeZ} />
      <RiverTrees spots={treeSpots} />
    </group>
  );
}

function RiverBridges({ x, bridgeZ }: { x: number; bridgeZ: number[] }) {
  const deckRef = useRef<THREE.InstancedMesh>(null);
  const railRef = useRef<THREE.InstancedMesh>(null);
  const lineRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const deck = deckRef.current;
    const rails = railRef.current;
    const lines = lineRef.current;
    if (!deck || !rails || !lines) return;
    bridgeZ.forEach((z, i) => {
      dummy.position.set(x, BRIDGE_DECK_Y, z);
      dummy.scale.set(BRIDGE_SPAN, BRIDGE_DECK_H, ROAD_W - 4);
      dummy.updateMatrix();
      deck.setMatrixAt(i, dummy.matrix);

      for (let side = 0; side < 2; side++) {
        dummy.position.set(x, 2.35, z + (side ? 1 : -1) * (ROAD_W / 2 - 2.2));
        dummy.scale.set(BRIDGE_SPAN, 2.2, 0.72);
        dummy.updateMatrix();
        rails.setMatrixAt(i * 2 + side, dummy.matrix);
      }
      [-1, 0, 1].forEach((lane, laneIdx) => {
        dummy.position.set(x, BRIDGE_DECK_Y + BRIDGE_DECK_H / 2 + 0.06, z + lane * 10.5);
        dummy.scale.set(BRIDGE_SPAN - 5, 0.08, lane === 0 ? 0.48 : 0.34);
        dummy.updateMatrix();
        lines.setMatrixAt(i * 3 + laneIdx, dummy.matrix);
      });
    });
    [deck, rails, lines].forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [bridgeZ, dummy, x]);

  return (
    <group>
      <instancedMesh ref={deckRef} args={[undefined, undefined, bridgeZ.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#555d65" roughness={0.83} metalness={0.05} />
      </instancedMesh>
      <instancedMesh ref={railRef} args={[undefined, undefined, bridgeZ.length * 2]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c0c3bd" roughness={0.62} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={lineRef} args={[undefined, undefined, bridgeZ.length * 3]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#e4ddbc" roughness={0.72} />
      </instancedMesh>
    </group>
  );
}

function RiverTrees({ spots }: { spots: TreeSpot[] }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const trunks = trunkRef.current;
    const crowns = crownRef.current;
    if (!trunks || !crowns) return;
    spots.forEach((spot, i) => {
      const h = 16 * spot.scale;
      dummy.position.set(spot.x, 1 + h / 2, spot.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1.05 * spot.scale, h, 1.05 * spot.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(spot.x, 1 + h + 6.5 * spot.scale, spot.z);
      dummy.rotation.set(0, (i * 2.17) % Math.PI, 0);
      dummy.scale.set(7.5 * spot.scale, 8.4 * spot.scale, 7.5 * spot.scale);
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
      crowns.setColorAt(i, new THREE.Color(i % 3 === 0 ? "#3f6d42" : "#4f7a49"));
    });
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
  }, [spots, dummy]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, spots.length]} castShadow>
        <cylinderGeometry args={[1, 1.35, 1, 6]} />
        <meshStandardMaterial color="#685037" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, undefined, spots.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial vertexColors color="#ffffff" roughness={0.94} />
      </instancedMesh>
    </group>
  );
}
