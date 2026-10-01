"use client";

// Malaysian office landmark kit. It favours recognisable KL office cues over
// anonymous low-poly imports: curtain wall, concrete core, sun-shading,
// retail podium and paired corporate towers.

import * as THREE from "three";
import { useMemo } from "react";

export type LandmarkKind = "hq" | "civic" | "transit";
export type LandmarkModelPlacement = { id: string; kind: LandmarkKind; x: number; z: number; rotation?: number };

const GLASS = "#0b6f98";
const GLASS_LIT = "#38bdf8";
const CONCRETE = "#d8dde0";

function Box({ position, size, color, roughness = 0.65, metalness = 0.08, emissive, emissiveIntensity = 0 }: {
  position: [number, number, number]; size: [number, number, number]; color: string;
  roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number;
}) {
  return <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} emissive={emissive ?? "#000000"} emissiveIntensity={emissiveIntensity} />
  </mesh>;
}

function CurtainWall({ width, height, depth, y, winLit }: { width: number; height: number; depth: number; y: number; winLit: number }) {
  const rows = Math.max(5, Math.floor(height / 14));
  return <group>
    <Box position={[0, y, 0]} size={[width, height, depth]} color={GLASS} roughness={0.16} metalness={0.56} emissive={GLASS_LIT} emissiveIntensity={winLit * 0.11} />
    {Array.from({ length: rows - 1 }, (_, index) => <Box key={`floor-${index}`} position={[0, y - height / 2 + (index + 1) * height / rows, depth / 2 + 0.45]} size={[width + 1.8, 1.15, 1.1]} color="#d8e6e7" roughness={0.35} metalness={0.42} />)}
    {[-1, 1].flatMap((side) => [-0.34, 0, 0.34].map((fraction) => <Box key={`${side}-${fraction}`} position={[width * fraction, y, side * (depth / 2 + 0.55)]} size={[1.1, height + 2, 1.2]} color="#d7e2e4" roughness={0.28} metalness={0.52} />))}
  </group>;
}

// A faceted corporate tower shell: the chamfered crown and asymmetric upper
// shoulders reference the KL office tower in the supplied image, while the
// single extruded volume remains cheap enough for the interactive city.
function FacetedCurtainTower({ winLit }: { winLit: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-55, 0);
    shape.lineTo(55, 0);
    shape.lineTo(55, 208);
    shape.lineTo(28, 246);
    shape.lineTo(-14, 246);
    shape.lineTo(-55, 214);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 82, bevelEnabled: false });
    g.translate(0, 0, -41);
    g.computeVertexNormals();
    return g;
  }, []);
  return <group position={[34, 39, 0]}>
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={GLASS} roughness={0.14} metalness={0.62} emissive={GLASS_LIT} emissiveIntensity={winLit * 0.12} />
    </mesh>
    {Array.from({ length: 13 }, (_, index) => <Box key={index} position={[0, 18 + index * 15.2, 42]} size={[116 - Math.max(0, index - 11) * 14, 2.15, 4]} color="#d7e1df" roughness={0.28} metalness={0.46} />)}
    <Box position={[-55.5, 108, 0]} size={[4.2, 205, 84]} color="#b9c6c8" roughness={0.36} metalness={0.48} />
    <Box position={[55.5, 103, 0]} size={[4.2, 196, 84]} color="#b9c6c8" roughness={0.36} metalness={0.48} />
  </group>;
}

// A compact KL boutique office: blue glass beside a pale service core,
// deep canopy and horizontal sun-louvers on the warm facade.
function BoutiqueOffice({ winLit }: { winLit: number }) {
  return <group>
    <Box position={[0, 8, 0]} size={[148, 16, 118]} color="#d7d5cf" roughness={0.78} />
    <Box position={[0, 21, 0]} size={[132, 10, 102]} color="#f4f1e9" roughness={0.55} />
    <group position={[20, 0, 0]}><CurtainWall width={84} height={146} depth={72} y={98} winLit={winLit} /></group>
    <Box position={[-48, 94, 0]} size={[30, 172, 84]} color={CONCRETE} roughness={0.7} />
    <Box position={[-48, 98, 43]} size={[8, 132, 2]} color="#56656b" roughness={0.6} />
    {Array.from({ length: 10 }, (_, index) => <Box key={index} position={[-22, 48 + index * 11.2, 39]} size={[38, 2.7, 11]} color="#e4e5df" roughness={0.46} metalness={0.28} />)}
    <Box position={[18, 177, 0]} size={[104, 8, 90]} color="#d8d9d2" roughness={0.52} />
    <Box position={[-49, 187, 0]} size={[34, 18, 88]} color="#66747a" roughness={0.62} metalness={0.25} />
    <Box position={[20, 30, 42]} size={[96, 7, 14]} color="#f4f2ea" roughness={0.45} metalness={0.22} />
  </group>;
}

// Older KL commercial block: white vertical ribs, compact window bays and a
// shaded retail arcade at the street level.
function RibbedOffice({ winLit }: { winLit: number }) {
  return <group>
    <Box position={[0, 8, 0]} size={[130, 16, 94]} color="#d0d4d3" roughness={0.8} />
    <Box position={[0, 28, 0]} size={[118, 24, 82]} color="#33444d" roughness={0.42} metalness={0.26} emissive="#173f54" emissiveIntensity={winLit * 0.22} />
    <Box position={[0, 112, 0]} size={[104, 150, 72]} color="#e8e9e5" roughness={0.58} />
    {Array.from({ length: 8 }, (_, column) => <Box key={`rib-${column}`} position={[-45 + column * 12.8, 112, 37]} size={[3.4, 154, 3]} color="#bec7c9" roughness={0.48} metalness={0.16} />)}
    {Array.from({ length: 10 }, (_, floor) => <Box key={`window-${floor}`} position={[0, 52 + floor * 13.2, 37.2]} size={[92, 7.2, 2]} color="#17465f" roughness={0.18} metalness={0.48} emissive={GLASS_LIT} emissiveIntensity={winLit * 0.1} />)}
    <Box position={[0, 190, 0]} size={[116, 10, 82]} color="#f4f1e8" roughness={0.52} />
    <Box position={[0, 204, 0]} size={[78, 16, 54]} color="#d6dad8" roughness={0.62} />
    {[-38, 0, 38].map((x) => <Box key={x} position={[x, 20, 44]} size={[5, 28, 5]} color="#e4e4dd" roughness={0.5} />)}
  </group>;
}

// Corporate precinct: one broad glazed tower, a secondary slim tower and a
// connected podium, inspired by KL office districts rather than a game tower.
function CorporateTwinTowers({ winLit }: { winLit: number }) {
  return <group>
    <Box position={[0, 9, 0]} size={[226, 18, 150]} color="#c4c9c8" roughness={0.72} />
    <Box position={[0, 28, 0]} size={[204, 22, 134]} color="#e1e1da" roughness={0.54} metalness={0.18} />
    <FacetedCurtainTower winLit={winLit} />
    <group position={[-76, 0, -12]}><CurtainWall width={56} height={178} depth={64} y={118} winLit={winLit} /></group>
    <Box position={[-76, 208, -12]} size={[68, 12, 76]} color="#e5e8e2" roughness={0.48} />
    <Box position={[34, 268, 0]} size={[122, 12, 94]} color="#d6dedb" roughness={0.44} metalness={0.22} />
    <Box position={[34, 280, 0]} size={[8, 24, 8]} color="#85a2aa" roughness={0.42} metalness={0.52} emissive="#38bdf8" emissiveIntensity={winLit * 0.35} />
  </group>;
}

function LandmarkBuilding({ placement, winLit, onSelect }: { placement: LandmarkModelPlacement; winLit: number; onSelect: (id: string) => void }) {
  const glow = placement.kind === "hq" ? "#22d3ee" : placement.kind === "civic" ? "#60a5fa" : "#f472b6";
  return <group position={[placement.x, 4, placement.z]} rotation={[0, placement.rotation ?? 0, 0]} onClick={(event) => { event.stopPropagation(); onSelect(placement.id); }} onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = "auto"; }}>
    {placement.kind === "hq" ? <BoutiqueOffice winLit={winLit} /> : placement.kind === "civic" ? <RibbedOffice winLit={winLit} /> : <CorporateTwinTowers winLit={winLit} />}
    <pointLight color={glow} intensity={winLit * 3.6} distance={260} decay={2} position={[0, 116, 0]} />
    <mesh position={[0, 2, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[52, 57, 48]} /><meshBasicMaterial color={glow} transparent opacity={winLit * 0.5} depthWrite={false} toneMapped={false} /></mesh>
  </group>;
}

export function LandmarkModels({ placements, winLit, onSelect }: { placements: LandmarkModelPlacement[]; winLit: number; onSelect: (id: string) => void }) {
  return <group>{placements.map((placement) => <LandmarkBuilding key={`${placement.kind}:${placement.id}`} placement={placement} winLit={winLit} onSelect={onSelect} />)}</group>;
}
