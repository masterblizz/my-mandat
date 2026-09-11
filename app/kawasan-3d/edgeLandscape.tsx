"use client";

// Place-based terrain skirt on the map edge, driven by SeatTraits:
//   traits.coastal  → a sea + sandy beach along the −Z edge, with palms
//                     and a couple of boats (e.g. Kuala Terengganu).
//   traits.paddy    → a terraced paddy belt along the −X edge, low earth
//                     bunds dividing the flooded fields (e.g. Sungai
//                     Petani / the rice-bowl states).
//   traits.lake     → a round recreational lake on the +Z edge (opposite
//                     the coast, so a seat with both never collides) with
//                     a grass park rim, a boardwalk + gazebo out over the
//                     water, paddle boats and shade trees (e.g. Tasik
//                     Kenyir / Putrajaya / Taman Tasik Shah Alam).
// All cheap: a handful of planes/boxes/cones + one animated water shader.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TOD_ENV, type Tod, type SeatTraits } from "./cityData";

const TILE_H = 4;

const SEA_VERT = /* glsl */ `
  varying vec3 vW;
  void main() { vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SEA_FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime; uniform vec3 uDeep; uniform vec3 uSky;
  varying vec3 vW;
  void main() {
    float r = sin(vW.x * 0.012 + uTime * 0.9)
            + sin(vW.y * 0.017 - uTime * 0.7)
            + sin((vW.x + vW.y) * 0.008 + uTime * 0.4) * 0.8;
    float n = r / 2.8 * 0.5 + 0.5;
    vec3 col = mix(uDeep, uSky, 0.28 + 0.34 * n);
    col += smoothstep(0.78, 0.97, n) * 0.28;
    gl_FragColor = vec4(col, 0.95);
  }
`;

function Sea({ tod, span }: { tod: Tod; span: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const env = TOD_ENV[tod];
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(env.skyBottom).multiplyScalar(0.35) },
      uSky: { value: new THREE.Color(env.skyBottom) },
    }),
    [env.skyBottom],
  );
  useFrame((_, dt) => { if (matRef.current) (matRef.current.uniforms.uTime.value as number) += dt; });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_H - 1.2, -span * 0.98]}>
      <planeGeometry args={[span * 3, span * 1.7, 1, 1]} />
      <shaderMaterial ref={matRef} vertexShader={SEA_VERT} fragmentShader={SEA_FRAG} uniforms={uniforms} transparent />
    </mesh>
  );
}

function Coast({ tod, span }: { tod: Tod; span: number }) {
  const edge = -span / 2; // grid's −Z edge (roughly)
  const rnd = useMemo(() => {
    let s = 20260910;
    return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  }, []);
  const palms = useMemo(
    () => Array.from({ length: 14 }, () => ({
      x: (rnd() - 0.5) * span * 1.4,
      z: edge + 20 + rnd() * 90,
      s: 0.9 + rnd() * 0.7,
    })),
    [span, edge, rnd],
  );
  const boats = useMemo(
    () => Array.from({ length: 3 }, () => ({ x: (rnd() - 0.5) * span * 0.9, z: edge - 120 - rnd() * 260 })),
    [span, edge, rnd],
  );
  return (
    <group>
      <Sea tod={tod} span={span} />
      {/* sandy beach strip between the city edge and the water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_H - 0.4, edge - 70]} receiveShadow>
        <planeGeometry args={[span * 1.5, 180]} />
        <meshStandardMaterial color="#dcc99f" roughness={1} />
      </mesh>
      {/* wet-sand line at the waterline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_H - 0.6, edge - 150]}>
        <planeGeometry args={[span * 1.5, 40]} />
        <meshStandardMaterial color="#b7a582" roughness={1} />
      </mesh>
      {palms.map((p, i) => (
        <group key={i} position={[p.x, TILE_H, p.z]} scale={p.s}>
          <mesh position={[0, 11, 0]} castShadow>
            <cylinderGeometry args={[1.1, 1.6, 22, 6]} />
            <meshStandardMaterial color="#7c6142" roughness={0.9} />
          </mesh>
          {[0, 1, 2, 3, 4].map((f) => (
            <mesh key={f} position={[Math.cos((f / 5) * 6.28) * 5, 22, Math.sin((f / 5) * 6.28) * 5]} rotation={[0.3, (f / 5) * 6.28, 0]} castShadow>
              <boxGeometry args={[13, 1, 3.4]} />
              <meshStandardMaterial color="#3f7a3a" roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}
      {boats.map((b, i) => (
        <group key={i} position={[b.x, TILE_H - 0.8, b.z]} rotation={[0, i * 1.3, 0]}>
          <mesh castShadow>
            <boxGeometry args={[6, 3, 18]} />
            <meshStandardMaterial color={["#c94c3c", "#3c6ec9", "#e6e2d6"][i % 3]} roughness={0.7} />
          </mesh>
          <mesh position={[0, 10, -1]}>
            <boxGeometry args={[0.8, 16, 0.8]} />
            <meshStandardMaterial color="#8a7a5a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Paddy({ span }: { span: number }) {
  const edge = -span / 2; // grid's −X edge
  const bunds = useMemo(() => {
    const out: { x: number; z: number; horiz: boolean }[] = [];
    for (let i = -6; i <= 6; i++) out.push({ x: edge - 40 + i * 0, z: i * (span * 0.11), horiz: true });
    for (let i = 0; i < 5; i++) out.push({ x: edge - 20 - i * 46, z: 0, horiz: false });
    return out;
  }, [span, edge]);
  return (
    <group>
      {/* flooded green field belt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[edge - 130, TILE_H - 0.5, 0]} receiveShadow>
        <planeGeometry args={[240, span * 1.5]} />
        <meshStandardMaterial color="#5f8a3c" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[edge - 130, TILE_H - 0.45, 0]}>
        <planeGeometry args={[240, span * 1.5]} />
        <meshStandardMaterial color="#7ba24a" roughness={0.9} transparent opacity={0.5} />
      </mesh>
      {/* low earth bunds dividing the fields */}
      {bunds.map((b, i) => (
        <mesh
          key={i}
          position={b.horiz ? [edge - 130, TILE_H + 1, b.z] : [b.x, TILE_H + 1, 0]}
          receiveShadow
        >
          <boxGeometry args={b.horiz ? [240, 2, 4] : [4, 2, span * 1.5]} />
          <meshStandardMaterial color="#8a7350" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

const LAKE_R = 105;     // water radius
const RIM_R = 155;      // grass park rim, outer edge
const BOARD_NEAR_D = 140; // boardwalk launch point — inside the grass rim
const BOARD_FAR_D = 55;   // boardwalk/gazebo end — well out past the shoreline (< LAKE_R)

function Lake({ tod, span }: { tod: Tod; span: number }) {
  const edge = span / 2;         // grid's +Z edge (opposite the coast)
  const cz = edge + 190;         // lake centre, out past the developed area
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const env = TOD_ENV[tod];
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color("#123b34") },
      uSky: { value: new THREE.Color(env.skyBottom).lerp(new THREE.Color("#3fae8c"), 0.55) },
    }),
    [env.skyBottom],
  );
  useFrame((_, dt) => { if (matRef.current) (matRef.current.uniforms.uTime.value as number) += dt; });

  const rnd = useMemo(() => {
    let s = 20260911;
    return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  }, []);
  const trees = useMemo(
    () => Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2 + rnd() * 0.15;
      const r = RIM_R - 14 - rnd() * 16;
      return { x: Math.sin(a) * r, z: cz + Math.cos(a) * r, s: 0.85 + rnd() * 0.5 };
    }),
    [rnd, cz],
  );
  const lamps = useMemo(
    () => Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      const r = RIM_R - 30;
      return { x: Math.sin(a) * r, z: cz + Math.cos(a) * r };
    }),
    [cz],
  );
  const boats = useMemo(
    () => Array.from({ length: 3 }, () => ({
      x: (rnd() - 0.5) * LAKE_R * 1.1,
      z: cz + (rnd() - 0.5) * LAKE_R * 1.1,
      rot: rnd() * Math.PI * 2,
      c: ["#ff5a5a", "#ffd23f", "#3fb8ff"][Math.floor(rnd() * 3)],
    })),
    [rnd, cz],
  );

  return (
    <group>
      {/* grass park rim (slightly proud) with the water basin recessed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_H + 0.25, cz]} receiveShadow>
        <circleGeometry args={[RIM_R, 48]} />
        <meshStandardMaterial color="#4f7a44" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_H - 0.35, cz]}>
        <circleGeometry args={[LAKE_R, 48]} />
        <shaderMaterial ref={matRef} vertexShader={SEA_VERT} fragmentShader={SEA_FRAG} uniforms={uniforms} transparent />
      </mesh>

      {/* boardwalk out to a lakeside gazebo — BOARD_NEAR_D sits on the
          grass rim, BOARD_FAR_D is out past the shoreline over open
          water (distances measured from the lake centre `cz`, along −Z) */}
      <mesh position={[0, TILE_H + 1.1, cz - (BOARD_NEAR_D + BOARD_FAR_D) / 2]} castShadow>
        <boxGeometry args={[14, 1.2, BOARD_NEAR_D - BOARD_FAR_D]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={`pile${i}`} position={[0, TILE_H - 3.5, cz - (BOARD_NEAR_D - (i * (BOARD_NEAR_D - BOARD_FAR_D)) / 4)]}>
          <cylinderGeometry args={[0.8, 0.8, 8, 6]} />
          <meshStandardMaterial color="#5c4632" roughness={0.95} />
        </mesh>
      ))}
      <group position={[0, 0, cz - BOARD_FAR_D]}>
        <mesh position={[0, TILE_H + 1.2, 0]} castShadow>
          <cylinderGeometry args={[10, 10, 1.2, 8]} />
          <meshStandardMaterial color="#8a6a48" roughness={0.9} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 8.6, TILE_H + 5.5, Math.sin(a) * 8.6]} castShadow>
              <cylinderGeometry args={[0.5, 0.5, 8.6, 6]} />
              <meshStandardMaterial color="#e6e2d6" roughness={0.7} />
            </mesh>
          );
        })}
        <mesh position={[0, TILE_H + 10.2, 0]} castShadow>
          <coneGeometry args={[11.5, 4.2, 6]} />
          <meshStandardMaterial color="#8a3f34" roughness={0.75} />
        </mesh>
      </group>

      {/* paddle boats bobbing near the shore */}
      {boats.map((b, i) => (
        <group key={i} position={[b.x, TILE_H - 0.2, b.z]} rotation={[0, b.rot, 0]}>
          <mesh castShadow>
            <boxGeometry args={[4.2, 1.6, 7.5]} />
            <meshStandardMaterial color={b.c} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[3.2, 1.2, 1.2]} />
            <meshStandardMaterial color="#e6e2d6" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* perimeter shade trees */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, TILE_H, t.z]} scale={t.s}>
          <mesh position={[0, 4, 0]} castShadow>
            <cylinderGeometry args={[0.7, 1.0, 8, 6]} />
            <meshStandardMaterial color="#6b5238" roughness={0.9} />
          </mesh>
          <mesh position={[0, 10, 0]} castShadow>
            <sphereGeometry args={[5.4, 7, 6]} />
            <meshStandardMaterial color={i % 2 ? "#3f7a3a" : "#4a8a42"} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* park lamp posts, lit from dusk */}
      {lamps.map((l, i) => (
        <group key={i} position={[l.x, TILE_H, l.z]}>
          <mesh position={[0, 6, 0]}>
            <cylinderGeometry args={[0.35, 0.4, 12, 6]} />
            <meshStandardMaterial color="#2a2f38" roughness={0.7} metalness={0.4} />
          </mesh>
          {tod !== "day" && (
            <mesh position={[0, 12.2, 0]}>
              <sphereGeometry args={[0.9, 6, 5]} />
              <meshBasicMaterial color="#ffdca0" toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

export function EdgeLandscape({
  traits, tod, span,
}: {
  traits: SeatTraits;
  tod: Tod;
  span: number;
}) {
  if (!traits.coastal && !traits.paddy && !traits.lake) return null;
  return (
    <group>
      {traits.coastal && <Coast tod={tod} span={span} />}
      {traits.paddy && <Paddy span={span} />}
      {traits.lake && <Lake tod={tod} span={span} />}
    </group>
  );
}
