"use client";

// Live construction sites for player-approved projects that are still being
// built (journey.construction). The site sits on the exact lot the finished
// facility will occupy (see zoneBuildings' facility reservation), and its
// structural frame rises with progress, so each quarter visibly advances
// the build. Site count is tiny (a handful of active works), so these are
// plain meshes rather than instanced.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { BuildingInstance } from "./models";

export type ConstructionSite = BuildingInstance & { progress: number; label?: string };

const HOARDING = "#e2b33b";
const STEEL = "#d1a538";
const CONCRETE = "#9aa3ab";

function Site({ site, groundY, winLit }: { site: ConstructionSite; groundY: number; winLit: number }) {
  const jib = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.MeshBasicMaterial>(null);
  // Stable per-site phase so neighbouring cranes never slew in lockstep.
  const phase = (site.key.length * 37 + Math.round(site.x)) % 628 / 100;

  const fullH = Math.max(site.h, 16);
  const frameH = Math.max(3, fullH * Math.min(1, Math.max(0.08, site.progress)));
  const floors = Math.max(1, Math.floor(frameH / 7));
  const w = site.w * 0.86;
  const d = site.d * 0.86;
  const fenceW = site.w + 8;
  const fenceD = site.d + 8;
  const mastH = fullH + 26;
  const jibLen = Math.max(site.w, site.d) * 0.9 + 12;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    if (jib.current) jib.current.rotation.y = Math.sin(t * 0.22) * 1.1 + phase;
    if (hook.current) hook.current.position.y = -10 - (Math.sin(t * 0.5) * 0.5 + 0.5) * Math.min(18, mastH * 0.4);
    if (beacon.current) beacon.current.opacity = 0.35 + 0.65 * (Math.sin(t * 4) > 0.2 ? 1 : 0.15);
  });

  return (
    <group position={[site.x, groundY, site.z]}>
      {/* Site hoarding with a dark kick-board stripe. */}
      {([
        [0, -fenceD / 2, fenceW, 1.2], [0, fenceD / 2, fenceW, 1.2],
        [-fenceW / 2, 0, 1.2, fenceD], [fenceW / 2, 0, 1.2, fenceD],
      ] as const).map(([x, z, fw, fd], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2.6, 0]} castShadow><boxGeometry args={[fw, 5.2, fd]} /><meshStandardMaterial color={HOARDING} roughness={0.7} /></mesh>
          <mesh position={[0, 0.6, 0]}><boxGeometry args={[fw + 0.05, 1.2, fd + 0.05]} /><meshStandardMaterial color="#1f2937" roughness={0.8} /></mesh>
        </group>
      ))}
      {/* Raft foundation. */}
      <mesh position={[0, 0.9, 0]} receiveShadow><boxGeometry args={[w + 2, 1.8, d + 2]} /><meshStandardMaterial color={CONCRETE} roughness={0.95} /></mesh>
      {/* Structural frame: corner + mid columns and floor plates up to the current height. */}
      {[-1, 0, 1].flatMap((ix) => [-1, 0, 1].map((iz) => (ix === 0 && iz === 0) ? null : (
        <mesh key={`c${ix}${iz}`} position={[ix * w / 2, 1.8 + frameH / 2, iz * d / 2]} castShadow>
          <boxGeometry args={[1.6, frameH, 1.6]} />
          <meshStandardMaterial color={CONCRETE} roughness={0.85} />
        </mesh>
      )))}
      {Array.from({ length: floors }, (_, i) => (
        <mesh key={`f${i}`} position={[0, 1.8 + (i + 1) * (frameH / floors), 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.9, d]} />
          <meshStandardMaterial color="#b4bcc3" roughness={0.9} />
        </mesh>
      ))}
      {/* Safety netting on the street face. */}
      <mesh position={[0, 1.8 + frameH / 2, d / 2 + 1.2]}>
        <planeGeometry args={[w + 2, frameH]} />
        <meshStandardMaterial color="#22c55e" transparent opacity={0.32} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Material stacks. */}
      <mesh position={[-fenceW / 2 + 6, 1.5, -fenceD / 2 + 6]} castShadow><boxGeometry args={[7, 3, 5]} /><meshStandardMaterial color="#8b5e34" roughness={1} /></mesh>
      <mesh position={[-fenceW / 2 + 6, 1.1, fenceD / 2 - 6]} rotation={[0, 0.3, 0]}><cylinderGeometry args={[1, 1, 9, 6]} /><meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.5} /></mesh>
      {/* Tower crane: lattice mast, slewing jib + counter-jib, hook. */}
      <group position={[fenceW / 2 - 4, 0, -fenceD / 2 + 4]}>
        <mesh position={[0, mastH / 2, 0]} castShadow><boxGeometry args={[2.4, mastH, 2.4]} /><meshStandardMaterial color={STEEL} metalness={0.35} roughness={0.55} /></mesh>
        <group ref={jib} position={[0, mastH, 0]}>
          <mesh position={[-jibLen / 2 + 3, 0, 0]} castShadow><boxGeometry args={[jibLen, 1.6, 1.6]} /><meshStandardMaterial color={STEEL} metalness={0.35} roughness={0.55} /></mesh>
          <mesh position={[9, 0, 0]}><boxGeometry args={[14, 1.4, 1.4]} /><meshStandardMaterial color={STEEL} metalness={0.35} roughness={0.55} /></mesh>
          <mesh position={[14, -1.8, 0]} castShadow><boxGeometry args={[4, 3.6, 3]} /><meshStandardMaterial color="#475569" roughness={0.7} /></mesh>
          <mesh position={[0, 2.2, 0]}><boxGeometry args={[3, 3, 3]} /><meshStandardMaterial color="#e5e7eb" roughness={0.5} /></mesh>
          <group position={[-jibLen + 8, 0, 0]}>
            <mesh ref={hook} position={[0, -10, 0]}><boxGeometry args={[1.8, 1.8, 1.8]} /><meshStandardMaterial color="#334155" /></mesh>
          </group>
          <mesh position={[0, 4.2, 0]}>
            <sphereGeometry args={[0.9, 8, 6]} />
            <meshBasicMaterial ref={beacon} color="#ef4444" transparent opacity={0.8} toneMapped={false} />
          </mesh>
        </group>
      </group>
      {/* Work lights after dark. */}
      {winLit > 0.3 && <pointLight position={[0, frameH + 8, 0]} color="#ffd8a0" intensity={winLit * 1.6} distance={site.w * 1.6} decay={2} />}
      {site.label && (
        <Html position={[0, mastH + 10, 0]} center zIndexRange={[90, 0]} style={{ pointerEvents: "none" }}>
          <div style={{
            display: "flex", flexDirection: "column", gap: 3, minWidth: 128, padding: "5px 8px",
            border: "1px solid rgba(250,204,21,.75)", borderRadius: 3, background: "rgba(2,10,20,.92)",
            boxShadow: "0 0 14px rgba(250,204,21,.35)", color: "#fef3c7",
            fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 900, letterSpacing: ".06em", whiteSpace: "nowrap",
          }}>
            <span>🚧 {site.label}</span>
            <span style={{ display: "block", height: 4, background: "rgba(148,163,184,.25)" }}>
              <span style={{ display: "block", height: "100%", width: `${Math.round(site.progress * 100)}%`, background: "#facc15" }} />
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

export function ConstructionSites({ sites, groundY, winLit }: { sites: ConstructionSite[]; groundY: number; winLit: number }) {
  if (!sites.length) return null;
  return <group>{sites.map((site) => <Site key={`site-${site.key}`} site={site} groundY={groundY} winLit={winLit} />)}</group>;
}
