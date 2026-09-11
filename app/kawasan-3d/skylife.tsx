"use client";

// Ambient sky life, keyed to time of day:
//   day   — a couple of hot-air balloons drifting + a high bird or two
//   dusk  — a flock of birds crossing in a loose V (+ balloons fading)
//   night — an airliner crossing high with blinking red/green/strobe
//           navigation lights
// Cheap: birds are one InstancedMesh (chevrons with a wing-flap), the
// plane and balloons are a handful of plain meshes each.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Tod } from "./cityData";

// ── birds ───────────────────────────────────────────────────────────
function Birds({ span, count, y }: { span: number; count: number; y: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const flock = useRef({ x: -span * 0.8, z: -span * 0.3, dir: 1 });
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // loose V: leader at 0, pairs trailing back and out
  const offs = useMemo(() => {
    const o: [number, number][] = [[0, 0]];
    for (let k = 1; k <= Math.ceil(count / 2); k++) {
      o.push([-k * 9, -k * 7]);
      o.push([-k * 9, k * 7]);
    }
    return o.slice(0, count);
  }, [count]);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const f = flock.current;
    f.x += f.dir * span * 0.05 * dt;
    f.z += Math.sin(performance.now() / 4000) * span * 0.006 * dt * 60;
    if (f.x > span * 0.85) { f.x = span * 0.85; f.dir = -1; }
    else if (f.x < -span * 0.85) { f.x = -span * 0.85; f.dir = 1; }
    const t = performance.now() / 1000;
    for (let i = 0; i < offs.length; i++) {
      const flap = Math.sin(t * 9 + i * 1.3) * 0.5;
      dummy.position.set(f.x + f.dir * offs[i][0], y + Math.sin(t + i) * 3, f.z + offs[i][1]);
      dummy.rotation.set(flap, f.dir > 0 ? 0 : Math.PI, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false} key={`birds-${count}`}>
      {/* a shallow chevron */}
      <coneGeometry args={[5, 1.4, 3]} />
      <meshBasicMaterial color="#2b3038" toneMapped={false} />
    </instancedMesh>
  );
}

// ── airliner with nav lights ────────────────────────────────────────
// Local axes: +Z = nose (fore/aft), X = wingspan (left/right), Y = up —
// matching the group's yaw (`rotation.y = ±90°` maps local +Z onto the
// world +X/−X direction of travel). Cylinder/cone primitives default to
// a Y-axis, so every fuselage/nacelle piece is rotated +90° about X to
// lay it along Z instead — the previous version skipped that rotation
// entirely, so the "fuselage" capsule stood on end (vertical) rather
// than running nose-to-tail: it read as a floating pill towing wings,
// not a plane. Rebuilt as a tapered nose + cylindrical body + tapered
// tail, a proper cross-tail (fin + stabilizer), two podded underwing
// engines, a cheatline stripe, a window band (lit warm at night), and a
// slow-pulsing top beacon alongside the wingtip nav lights + tail strobe.
const LAY_FLAT = Math.PI / 2;
function Plane({ span, seed = 1, tod }: { span: number; seed?: number; tod?: Tod }) {
  const grp = useRef<THREE.Group>(null);
  const strobeRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const blink = useRef(0);
  const cfg = useMemo(() => {
    let s = seed * 2654435761;
    const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    return {
      y: span * (0.24 + r() * 0.14),
      lane: (r() - 0.5) * span * 0.8,
      speed: span * (0.045 + r() * 0.035),
      dir: r() < 0.5 ? 1 : -1,
    };
  }, [span, seed]);
  useFrame((_, dt) => {
    const p = grp.current;
    if (!p) return;
    p.position.x += cfg.dir * cfg.speed * dt;
    if (cfg.dir > 0 && p.position.x > span) p.position.x = -span;
    else if (cfg.dir < 0 && p.position.x < -span) p.position.x = span;
    blink.current += dt;
    if (strobeRef.current) strobeRef.current.visible = blink.current % 1.1 < 0.06;
    if (beaconRef.current) beaconRef.current.visible = blink.current % 1.0 < 0.5;
  });
  const lit = tod === "night";
  const hullMat = { color: "#d9dee6", roughness: 0.45, metalness: 0.35 } as const;
  const trimMat = { color: "#c7ccd4", roughness: 0.5, metalness: 0.3 } as const;
  return (
    <group ref={grp} position={[cfg.dir > 0 ? -span : span, cfg.y, cfg.lane]} rotation={[0, cfg.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
      {/* fuselage: nose cone + cylindrical body + tapered tail cone */}
      <mesh position={[0, 0, 13]} rotation={[LAY_FLAT, 0, 0]} castShadow>
        <coneGeometry args={[2.6, 6, 12]} />
        <meshStandardMaterial {...hullMat} />
      </mesh>
      <mesh rotation={[LAY_FLAT, 0, 0]} castShadow>
        <cylinderGeometry args={[2.6, 2.6, 20, 12]} />
        <meshStandardMaterial {...hullMat} />
      </mesh>
      <mesh position={[0, 0, -15]} rotation={[-LAY_FLAT, 0, 0]} castShadow>
        <coneGeometry args={[2.6, 10, 12]} />
        <meshStandardMaterial {...trimMat} />
      </mesh>

      {/* cheatline stripe + cabin window band, one on each side */}
      {[-1, 1].map((s) => (
        <group key={`side${s}`}>
          <mesh position={[s * 2.62, 0.15, 0]}>
            <boxGeometry args={[0.15, 0.85, 18]} />
            <meshBasicMaterial color={lit ? "#ffd699" : "#0b1220"} toneMapped={false} />
          </mesh>
          <mesh position={[s * 2.62, -0.9, 0]}>
            <boxGeometry args={[0.12, 0.4, 26]} />
            <meshStandardMaterial color="#3b6fd6" roughness={0.5} metalness={0.2} />
          </mesh>
        </group>
      ))}

      {/* wings — a slight dihedral tilt per side, plus a podded engine
          hanging under each */}
      {[-1, 1].map((s) => (
        <group key={`wing${s}`} rotation={[0, 0, -s * 0.07]}>
          <mesh position={[s * 12, -0.6, 0.5]} castShadow>
            <boxGeometry args={[19, 0.9, 5.2]} />
            <meshStandardMaterial {...trimMat} />
          </mesh>
          <mesh position={[s * 8.5, -2.6, 2.2]} rotation={[LAY_FLAT, 0, 0]} castShadow>
            <cylinderGeometry args={[1.3, 1.1, 5.5, 10]} />
            <meshStandardMaterial color="#9aa2ad" roughness={0.4} metalness={0.5} />
          </mesh>
        </group>
      ))}

      {/* tail: vertical fin + horizontal stabilizer */}
      <mesh position={[0, 4.2, -16]} castShadow>
        <boxGeometry args={[0.9, 7, 4.6]} />
        <meshStandardMaterial {...trimMat} />
      </mesh>
      <mesh position={[0, 1.2, -17]} castShadow>
        <boxGeometry args={[10, 0.7, 3]} />
        <meshStandardMaterial {...trimMat} />
      </mesh>

      {/* lights: red/green wingtip nav lights, white tail strobe, a
          slow-pulsing red top beacon */}
      <mesh position={[-21.5, -1.2, 0.5]}>
        <sphereGeometry args={[0.85, 6, 5]} />
        <meshBasicMaterial color="#ff3020" toneMapped={false} />
      </mesh>
      <mesh position={[21.5, -1.2, 0.5]}>
        <sphereGeometry args={[0.85, 6, 5]} />
        <meshBasicMaterial color="#20ff50" toneMapped={false} />
      </mesh>
      <mesh ref={strobeRef} position={[0, 4.2, -18.4]}>
        <sphereGeometry args={[1.1, 6, 5]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh ref={beaconRef} position={[0, 3.1, 0]}>
        <sphereGeometry args={[0.6, 6, 5]} />
        <meshBasicMaterial color="#ff2020" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function SkyLife({ tod, span }: { tod: Tod; span: number }) {
  return (
    <group renderOrder={-1}>
      {tod === "day" && <Birds span={span} count={7} y={span * 0.34} />}
      {tod === "dusk" && <Birds span={span} count={15} y={span * 0.3} />}
      {/* aeroplanes at every time of day (was: balloons by day) — the
          night sky just makes their nav lights (and lit cabin windows)
          pop via bloom */}
      <Plane span={span} seed={3} tod={tod} />
      {tod === "day" && <Plane span={span} seed={91} tod={tod} />}
      {(tod === "night" || tod === "dusk") && <Plane span={span} seed={57} tod={tod} />}
    </group>
  );
}
