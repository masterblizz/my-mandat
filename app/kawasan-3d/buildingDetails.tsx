"use client";

// Lightweight architectural detail pass for the procedural city.  The base
// shapes remain instanced in procedural.tsx; this adds a small, fixed set of
// instanced overlays per building family so the skyline gets façade rhythm,
// entrances and rooftop services without changing any placement data.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useHeightTween, type BuildingInstance } from "./models";
import type { BType } from "./cityData";
import { MallSign } from "./mallDetails";

const TALL = new Set<BType>(["tower", "skyscraper", "antenna"]);
const RESIDENTIAL = new Set<BType>(["tower", "house", "terrace", "kampung", "shophouse"]);
const RETAIL = new Set<BType>(["shop", "stall", "shophouse", "mall", "clinic", "terminal"]);
const INDUSTRIAL = new Set<BType>(["factory", "warehouse"]);
const SHOPFRONT = new Set<BType>(["shop", "shophouse", "mall"]);
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
  const glazingRef = useRef<THREE.InstancedMesh>(null);
  const fasciaRef = useRef<THREE.InstancedMesh>(null);
  const frameRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const isTall = TALL.has(type);
  const isResidential = RESIDENTIAL.has(type);
  const isRetail = RETAIL.has(type);
  const isIndustrial = INDUSTRIAL.has(type);
  const hasShopfront = SHOPFRONT.has(type);
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
    if (hasShopfront) {
      const entranceH = Math.min(hh * 0.25, 10);
      const front = it.z + it.d * 0.5;
      const setPart = (mesh: THREE.InstancedMesh | null, index: number,
        x: number, y: number, z: number, w: number, height: number, depth: number) => {
        if (!mesh) return;
        dummy.position.set(x, groundY + y, z);
        dummy.scale.set(w, height, depth);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      };
      // Three large display bays, with a shorter central door. All details
      // follow the same height tween as the shell during construction.
      for (let bay = 0; bay < 3; bay++) {
        setPart(glazingRef.current, i * 3 + bay,
          it.x + (bay - 1) * it.w * 0.25, entranceH * 0.46, front + 0.3,
          it.w * 0.23, entranceH * (bay === 1 ? 0.76 : 0.82), 0.45);
      }
      setPart(fasciaRef.current, i, it.x, entranceH + 1.8, front + 0.55,
        it.w * 0.86, 2.4, 0.8);
      for (let post = 0; post < 4; post++) {
        setPart(frameRef.current, i * 4 + post,
          it.x + (post - 1.5) * it.w * 0.25, entranceH * 0.46, front + 0.65,
          Math.max(0.45, it.w * 0.018), entranceH * 0.92, 0.6);
      }
    }
  };

  const commit = () => {
    [roofRef.current, plantRef.current, facadeRef.current, balconyRef.current, canopyRef.current,
      glazingRef.current, fasciaRef.current, frameRef.current].forEach((mesh) => {
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
      {hasShopfront && <>
        <instancedMesh ref={glazingRef} args={[undefined, undefined, items.length * 3]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#456c78" metalness={0.3} roughness={0.22}
            emissive="#f6d5a0" emissiveIntensity={winLit * 0.55} />
        </instancedMesh>
        <instancedMesh ref={fasciaRef} args={[undefined, undefined, items.length]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={type === "mall" ? "#b69a61" : "#327e79"}
            roughness={0.5} metalness={0.12} emissive={type === "mall" ? "#e8bd72" : "#67b8aa"}
            emissiveIntensity={winLit * 0.35} />
        </instancedMesh>
        <instancedMesh ref={frameRef} args={[undefined, undefined, items.length * 4]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#d8d1bc" roughness={0.65} metalness={0.15} />
        </instancedMesh>
      </>}
    </group>
  );
}

// Player-built facilities need a stronger identity than their base building
// family alone: an education-zone can already contain a school, for example.
// These small, non-instanced landmark kits only render for approved projects,
// so they stay cheap while making a close camera view immediately legible.
const PROJECT_ACCENT: Record<string, string> = {
  road: "#fbbf24", clinic: "#ef4444", internet: "#38bdf8", flood: "#0ea5e9",
  market: "#f97316", school: "#2563eb", park: "#22c55e", bus: "#facc15",
  mall: "#a855f7", stadium: "#f8fafc", surau: "#34d399", office: "#60a5fa",
  demolish: "#fb923c", hotel: "#ec4899", police: "#3b82f6", firestation: "#ef4444",
  library: "#a16207", museum: "#d4a574",
};

function FacilityKit({ item, groundY }: { item: BuildingInstance; groundY: number }) {
  const project = item.projectId!;
  const accent = PROJECT_ACCENT[project] ?? "#facc15";
  const roofY = groundY + Math.max(item.h, 4) + 1.1;
  const frontZ = item.d * 0.54;
  const signY = groundY + Math.min(Math.max(item.h * 0.48, 7), 19);
  const signW = Math.min(Math.max(item.w * 0.52, 14), 34);

  return (
    <group position={[item.x, 0, item.z]}>
      {/* A bright fascia is shared by every facility. It is deliberately
          geometric rather than text-based so it remains readable at range
          and does not need a font texture. */}
      <mesh position={[0, signY, frontZ]} castShadow>
        <boxGeometry args={[signW, 4.2, 0.9]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.22} roughness={0.35} />
      </mesh>

      {project === "school" && (
        <group>
          {/* School: blue clock-tower beacon, flagpole and a marked court. */}
          <mesh position={[0, roofY + 7, 0]} castShadow><boxGeometry args={[7, 14, 7]} /><meshStandardMaterial color="#e8eef5" roughness={0.55} /></mesh>
          <mesh position={[0, roofY + 14.2, frontZ * 0.15]}><sphereGeometry args={[2.35, 12, 8]} /><meshBasicMaterial color="#f8fafc" /></mesh>
          <mesh position={[-item.w * 0.33, groundY + 13, frontZ * 0.72]} castShadow><cylinderGeometry args={[0.45, 0.55, 26, 8]} /><meshStandardMaterial color="#94a3b8" metalness={0.7} /></mesh>
          <mesh position={[-item.w * 0.27, groundY + 21, frontZ * 0.72]}><boxGeometry args={[11, 6, 0.45]} /><meshBasicMaterial color="#2563eb" /></mesh>
          <mesh position={[item.w * 0.28, groundY + 0.7, frontZ * 0.72]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[Math.min(item.w * 0.34, 22), Math.min(item.d * 0.34, 18)]} /><meshBasicMaterial color="#60a5fa" /></mesh>
        </group>
      )}
      {project === "clinic" && (
        <group position={[0, roofY + 3, 0]}>
          {/* Clinic: highly visible medical cross above the roofline. */}
          <mesh><boxGeometry args={[4, 13, 1.3]} /><meshBasicMaterial color="#f8fafc" /></mesh>
          <mesh><boxGeometry args={[13, 4, 1.35]} /><meshBasicMaterial color="#f8fafc" /></mesh>
        </group>
      )}
      {project === "internet" && (
        <group position={[0, roofY + 15, 0]}>
          <mesh><cylinderGeometry args={[0.7, 1.2, 30, 6]} /><meshStandardMaterial color="#64748b" metalness={0.7} /></mesh>
          {[7, 13].map((y) => <mesh key={y} position={[0, y - 15, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[6, 0.45, 6, 18]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.75} /></mesh>)}
        </group>
      )}
      {project === "park" && (
        <group>
          {[[-0.26, -0.18], [0.25, -0.12], [0.04, 0.28]].map(([x, z], i) => <group key={i} position={[item.w * x, groundY + 7, item.d * z]}><mesh><cylinderGeometry args={[1.1, 1.5, 14, 7]} /><meshStandardMaterial color="#7c4a28" /></mesh><mesh position={[0, 10, 0]}><sphereGeometry args={[7, 8, 6]} /><meshStandardMaterial color="#22c55e" /></mesh></group>)}
        </group>
      )}
      {project === "bus" && (
        <group position={[0, groundY + 4.5, frontZ * 0.76]}>
          <mesh castShadow><boxGeometry args={[Math.min(item.w * 0.6, 26), 7, 7]} /><meshStandardMaterial color="#facc15" roughness={0.45} /></mesh>
          <mesh position={[0, 1.1, 3.65]}><boxGeometry args={[Math.min(item.w * 0.42, 18), 2.4, 0.3]} /><meshBasicMaterial color="#172554" /></mesh>
        </group>
      )}
      {project === "road" && (
        <group position={[item.w * 0.3, groundY + 13, frontZ * 0.68]}>
          <mesh castShadow><cylinderGeometry args={[0.5, 0.7, 26, 8]} /><meshStandardMaterial color="#475569" metalness={0.65} /></mesh>
          <mesh position={[0, 12, 0]}><boxGeometry args={[7, 1.4, 2]} /><meshBasicMaterial color="#fbbf24" /></mesh>
          <mesh position={[0, 10, 0]}><sphereGeometry args={[2.2, 8, 6]} /><meshBasicMaterial color="#fff3b0" /></mesh>
        </group>
      )}
      {project === "flood" && (
        <group position={[0, groundY + 2.2, 0]}>
          <mesh><cylinderGeometry args={[5.5, 5.5, 4.4, 12]} /><meshStandardMaterial color="#64748b" roughness={0.75} /></mesh>
          <mesh position={[0, 2.35, 0]}><cylinderGeometry args={[3.8, 3.8, 0.3, 18]} /><meshBasicMaterial color="#38bdf8" /></mesh>
        </group>
      )}
      {project === "market" && (
        <group position={[0, roofY + 2, 0]}>{[-0.28, 0, 0.28].map((x, i) => <mesh key={x} position={[item.w * x, 0, 0]}><coneGeometry args={[5.4, 6, 4]} /><meshStandardMaterial color={["#ef4444", "#fbbf24", "#2563eb"][i]} /></mesh>)}</group>
      )}
      {project === "mall" && <group position={[0, roofY + 5, 0]}>
        <mesh><boxGeometry args={[item.w * 0.9, 9, 2.2]} /><meshStandardMaterial color="#132e36" roughness={0.6} /></mesh>
        <group position={[0, 0, 1.2]}><MallSign width={item.w * 0.86} height={7} /></group>
      </group>}
      {project === "office" && <mesh position={[0, roofY + 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[item.w * 0.16, item.w * 0.2, 24]} /><meshBasicMaterial color="#f8fafc" /></mesh>}
      {project === "hotel" && <mesh position={[0, roofY + 5, 0]}><boxGeometry args={[item.w * 0.55, 8, 1.2]} /><meshBasicMaterial color="#ec4899" /></mesh>}
      {project === "police" && <group position={[0, roofY + 4, 0]}><mesh><boxGeometry args={[10, 2.4, 3]} /><meshBasicMaterial color="#2563eb" /></mesh><mesh position={[0, 1.8, 0]}><sphereGeometry args={[1.2, 8, 6]} /><meshBasicMaterial color="#ef4444" /></mesh></group>}
      {project === "stadium" && (
        <group>{[-1, 1].map((s) => <group key={s} position={[s * item.w * 0.34, roofY + 12, 0]}><mesh><cylinderGeometry args={[0.65, 0.9, 24, 8]} /><meshStandardMaterial color="#cbd5e1" /></mesh><mesh position={[0, 12, 0]}><boxGeometry args={[10, 4, 2]} /><meshBasicMaterial color="#f8fafc" /></mesh></group>)}</group>
      )}
      {project === "surau" && <mesh position={[0, roofY + 5, 0]}><sphereGeometry args={[7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#34d399" metalness={0.15} /></mesh>}
      {project === "firestation" && <mesh position={[item.w * 0.3, roofY + 10, 0]} castShadow><boxGeometry args={[7, 20, 7]} /><meshStandardMaterial color="#dc2626" roughness={0.55} /></mesh>}
      {project === "library" && <group position={[0, roofY + 2, 0]}>{[-5, 0, 5].map((x, i) => <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[3.6, 8 + i * 2, 5]} /><meshStandardMaterial color={["#b45309", "#0f766e", "#7c2d12"][i]} /></mesh>)}</group>}
      {project === "museum" && <mesh position={[0, roofY + 5, 0]}><coneGeometry args={[item.w * 0.28, 12, 4]} /><meshStandardMaterial color="#d4a574" roughness={0.7} /></mesh>}
    </group>
  );
}

export function ProjectLandmarks({ items, groundY }: { items: BuildingInstance[]; groundY: number }) {
  if (!items.length) return null;
  return <group>{items.map((item) => <FacilityKit key={`facility-${item.key}`} item={item} groundY={groundY} />)}</group>;
}

// Public buildings need to be recognisable before the player clicks them.
// These are small, low-poly civic kits (plus a roof label) rather than a
// generic coloured box: a clinic has a medical cross, a hall has a broad
// entrance, a school has a flag, and emergency/cultural buildings carry
// their own roofline cues.  We cap each type in dense cities so the readable
// landmarks do not become a performance cost or label clutter.
const FUNCTIONAL_LABEL: Partial<Record<BType, string>> = {
  hall: "DEWAN", clinic: "KLINIK", hospital: "HOSPITAL", school: "SEKOLAH",
  police: "POLIS", fire: "BOMBA", library: "PERPUSTAKAAN", museum: "MUZIUM",
  terminal: "TERMINAL", mall: "MALL", masjid: "MASJID", factory: "KILANG",
  warehouse: "GUDANG", stall: "PASAR", shop: "KEDAI", shophouse: "KEDAI",
  hotel: "HOTEL", stadium: "STADIUM",
};

function FunctionalBuilding({ type, item, groundY }: { type: BType; item: BuildingInstance; groundY: number }) {
  const label = FUNCTIONAL_LABEL[type];
  if (!label) return null;
  const roofY = groundY + Math.max(item.h, 6) + 0.65;
  const frontZ = item.d * 0.54;
  const signY = groundY + Math.min(Math.max(item.h * 0.5, 8), 19);
  const accent = type === "clinic" || type === "hospital" || type === "fire" ? "#ef4444"
    : type === "police" ? "#3b82f6"
    : type === "school" ? "#2563eb"
    : type === "masjid" ? "#34d399"
    : type === "factory" || type === "warehouse" ? "#f59e0b"
    : "#f0b429";

  return <group position={[item.x, 0, item.z]}>
    {/* Roof text stays readable from the isometric camera without becoming a HUD label. */}
    <Text position={[0, roofY, 0]} rotation={[-Math.PI / 2, 0, 0]}
      fontSize={Math.min(8, Math.max(4.5, item.w * 0.11))} color="#f8fafc"
      outlineWidth={0.13} outlineColor="#07111c" anchorX="center" anchorY="middle">
      {label}
    </Text>
    <mesh position={[0, signY, frontZ]} castShadow>
      <boxGeometry args={[Math.min(item.w * 0.78, 42), 3.3, 1.1]} />
      <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.18} roughness={0.38} />
    </mesh>

    {(type === "clinic" || type === "hospital") && <group position={[0, roofY + 3.3, 0]}>
      <mesh><boxGeometry args={[3.4, 13, 1.35]} /><meshBasicMaterial color="#f8fafc" /></mesh>
      <mesh><boxGeometry args={[13, 3.4, 1.4]} /><meshBasicMaterial color="#f8fafc" /></mesh>
    </group>}
    {type === "hall" && <group>
      {/* A wide covered porch and stage-like gable distinguish a dewan from a clinic. */}
      <mesh position={[0, groundY + 7, frontZ * 1.12]} castShadow><boxGeometry args={[item.w * 0.78, 1.5, item.d * 0.22]} /><meshStandardMaterial color="#8b6e4d" roughness={0.65} /></mesh>
      {[-0.3, 0.3].map((x) => <mesh key={x} position={[item.w * x, groundY + 9, frontZ * 1.12]} castShadow><boxGeometry args={[2.2, 14, 2.2]} /><meshStandardMaterial color="#eee6d4" roughness={0.55} /></mesh>)}
    </group>}
    {type === "school" && <group>
      <mesh position={[-item.w * 0.34, groundY + 16, frontZ * 0.72]} castShadow><cylinderGeometry args={[0.45, 0.6, 30, 8]} /><meshStandardMaterial color="#94a3b8" metalness={0.65} /></mesh>
      <mesh position={[-item.w * 0.27, groundY + 24, frontZ * 0.72]}><boxGeometry args={[10, 5, 0.4]} /><meshBasicMaterial color="#2563eb" /></mesh>
    </group>}
    {type === "police" && <mesh position={[0, roofY + 2.2, 0]}><cylinderGeometry args={[2.4, 2.4, 1.4, 16]} /><meshBasicMaterial color="#2563eb" /></mesh>}
    {type === "fire" && <group position={[item.w * 0.28, roofY + 8, 0]}><mesh castShadow><boxGeometry args={[6, 18, 6]} /><meshStandardMaterial color="#c9372c" roughness={0.5} /></mesh><mesh position={[0, 10, 0]}><boxGeometry args={[8, 2, 2]} /><meshBasicMaterial color="#f8fafc" /></mesh></group>}
    {type === "library" && <group position={[0, roofY + 3, 0]}>{[-1, 0, 1].map((x, i) => <mesh key={x} position={[x * 5, 0, 0]}><boxGeometry args={[3.4, 7 + i * 2, 4.4]} /><meshStandardMaterial color={["#a16207", "#0f766e", "#7c2d12"][i]} /></mesh>)}</group>}
    {type === "museum" && <group position={[0, roofY + 4, 0]}>{[-0.24, 0, 0.24].map((x) => <mesh key={x} position={[item.w * x, 0, 0]}><cylinderGeometry args={[1.3, 1.5, 9, 8]} /><meshStandardMaterial color="#ded2b5" roughness={0.6} /></mesh>)}<mesh position={[0, 7, 0]}><coneGeometry args={[item.w * 0.29, 10, 4]} /><meshStandardMaterial color="#c8b18a" /></mesh></group>}
    {type === "terminal" && <group position={[0, groundY + 6, frontZ * 0.72]}><mesh castShadow><boxGeometry args={[item.w * 0.86, 1.3, item.d * 0.32]} /><meshStandardMaterial color="#f8fafc" metalness={0.25} /></mesh><mesh position={[0, -2.8, 0]}><boxGeometry args={[item.w * 0.5, 5, 6]} /><meshStandardMaterial color="#f6c51c" roughness={0.45} /></mesh></group>}
    {type === "masjid" && <mesh position={[item.w * 0.32, roofY + 10, 0]} castShadow><cylinderGeometry args={[1.1, 1.7, 22, 8]} /><meshStandardMaterial color="#d8d0b7" roughness={0.5} /></mesh>}
    {(type === "factory" || type === "warehouse") && <group position={[item.w * 0.28, roofY + 7, -item.d * 0.18]}><mesh castShadow><cylinderGeometry args={[2.7, 3.5, 18, 10]} /><meshStandardMaterial color="#737b82" roughness={0.72} /></mesh><mesh position={[0, 11, 0]}><cylinderGeometry args={[2.1, 2.7, 7, 10]} /><meshStandardMaterial color="#9a9fa5" roughness={0.7} /></mesh></group>}
  </group>;
}

export function FunctionalBuildingDetails({
  groups, groundY,
}: {
  groups: [BType, BuildingInstance[]][];
  groundY: number;
}) {
  return <group>{groups.flatMap(([type, items]) => {
    if (!FUNCTIONAL_LABEL[type]) return [];
    // An anchor is the visual promise made by the zone name, so it cannot
    // lose its school flag / clinic cross simply because earlier cells used
    // the same building type. Keep a small supporting sample for texture in
    // dense maps without creating labels on every ordinary filler building.
    const anchors = items.filter((item) => item.anchor);
    const supporting = items.filter((item) => !item.anchor).slice(0, Math.max(0, 8 - anchors.length));
    return [...anchors, ...supporting].map((item) => <FunctionalBuilding key={`identity-${item.key}`} type={type} item={item} groundY={groundY} />);
  })}</group>;
}
