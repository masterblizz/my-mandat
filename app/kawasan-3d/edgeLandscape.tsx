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
//   traits.kinabalu → Mount Kinabalu itself on the +X edge (the one still
//                     free): forested foothills, a granite massif, a
//                     jagged multi-peak summit cluster and a cloud band
//                     wrapping the upper slopes (Kota Kinabalu / Ranau /
//                     Kundasang) — a specific named mountain, not the
//                     generic `hilly` bucket.
// All cheap: a handful of planes/boxes/cones + one animated water shader.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TOD_ENV, type Tod, type SeatTraits, type CellPlacement } from "./cityData";

const TILE_H = 4;

const SEA_VERT = /* glsl */ `
  varying vec2 vSea;
  uniform float uTime;
  void main() {
    vSea = position.xy;
    vec3 p = position;
    p.z += sin(p.x * 0.032 + uTime * 0.75) * 1.15
         + sin(p.y * 0.046 - uTime * 0.58) * 0.72
         + sin((p.x + p.y) * 0.021 + uTime * 0.42) * 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const SEA_FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime; uniform vec3 uDeep; uniform vec3 uSky;
  varying vec2 vSea;
  void main() {
    float swell = sin(vSea.x * 0.009 + uTime * 0.34) * 0.5
                + sin(vSea.y * 0.013 - uTime * 0.28) * 0.5;
    float ripples = sin((vSea.x - vSea.y) * 0.065 + uTime * 1.35) * 0.5 + 0.5;
    float light = pow(max(0.0, sin((vSea.x + vSea.y) * 0.048 + uTime * 0.8)), 18.0);
    vec3 col = mix(uDeep, uSky, 0.28 + swell * 0.12 + ripples * 0.045);
    col += vec3(0.62, 0.83, 0.88) * light * 0.23;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Sea({ tod, span }: { tod: Tod; span: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const env = TOD_ENV[tod];
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(tod === "night" ? "#06213a" : "#07516c") },
      uSky: { value: new THREE.Color(tod === "night" ? "#17476b" : "#3b9bb3") },
    }),
    [env.skyBottom],
  );
  useFrame((_, dt) => { if (matRef.current) (matRef.current.uniforms.uTime.value as number) += dt; });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_H - 1.2, -span * 0.98]}>
      <planeGeometry args={[span * 3, span * 1.7, 140, 80]} />
      <shaderMaterial ref={matRef} vertexShader={SEA_VERT} fragmentShader={SEA_FRAG} uniforms={uniforms} side={THREE.DoubleSide} />
    </mesh>
  );
}

// The fishing-village zone itself is moved to the waterfront by
// assignZonePositions(). This harbour kit reaches from that exact tile into
// the sea, so the player can read a genuine kampung nelayan rather than a
// generic inland river plot.
function FishingVillageHarbour({ village }: { village: CellPlacement }) {
  const houses = [
    { x: -70, z: 50, color: "#9e7955", roof: "#a94737" },
    { x: -28, z: 25, color: "#b78d63", roof: "#6e7b79" },
    { x: 28, z: 45, color: "#987051", roof: "#b94f3d" },
    { x: 68, z: 6, color: "#b38a62", roof: "#73817b" },
  ];
  const planks = Array.from({ length: 19 }, (_, index) => 92 - index * 13);
  return <group position={[village.cx, TILE_H, village.cz]}>
    {/* A real boardwalk has visible planks, side fingers and piles rather
        than reading as a single brown strip. */}
    <mesh position={[0, 1.2, -24]} castShadow><boxGeometry args={[15, 2.4, 260]} /><meshStandardMaterial color="#825e3d" roughness={0.95} /></mesh>
    {planks.map((z) => <mesh key={z} position={[0, 2.65, z]}><boxGeometry args={[21, 1.1, 3.2]} /><meshStandardMaterial color="#b18961" roughness={1} /></mesh>)}
    {[-98, -55].map((z) => <mesh key={z} position={[36, 1.1, z]} castShadow><boxGeometry args={[78, 2.2, 13]} /><meshStandardMaterial color="#8a6344" roughness={0.94} /></mesh>)}
    {[-1, 1].flatMap((side) => [-142, -104, -62, -18, 28, 72].map((z) => (
      <mesh key={`${side}-${z}`} position={[side * 7, -5, z]}><cylinderGeometry args={[1.25, 1.7, 15, 6]} /><meshStandardMaterial color="#58402d" roughness={1} /></mesh>
    )))}

    {/* Compact stilt houses link back to the boardwalk by short bridges. */}
    {houses.map((house, index) => <group key={house.x} position={[house.x, 0, house.z]}>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <mesh key={`${sx}-${sz}`} position={[sx * 10, -2.5, sz * 8]}>
        <cylinderGeometry args={[0.85, 1.05, 15, 6]} /><meshStandardMaterial color="#60452f" roughness={1} />
      </mesh>))}
      <mesh position={[0, 4, 0]} castShadow><boxGeometry args={[29, 2, 23]} /><meshStandardMaterial color="#805d42" roughness={0.95} /></mesh>
      <mesh position={[0, 14, 0]} castShadow><boxGeometry args={[26, 18, 20]} /><meshStandardMaterial color={house.color} roughness={0.9} /></mesh>
      <mesh position={[0, 25, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[20, 10, 4]} /><meshStandardMaterial color={house.roof} roughness={0.9} /></mesh>
      <mesh position={[-16, 3.2, -index * 7]}><boxGeometry args={[17, 1.5, 4]} /><meshStandardMaterial color="#9f7852" roughness={1} /></mesh>
    </group>)}

    {/* Moored sampans, fishing nets and landed crates keep the harbour active
        even while the animated vessels are travelling offshore. */}
    {[-92, -48, -10].map((z, index) => <group key={z} position={[index === 1 ? 48 : -44, 3, z]} rotation={[0, index === 1 ? 0.24 : -0.2, 0]}>
      <mesh castShadow><boxGeometry args={[23, 3.5, 7]} /><meshStandardMaterial color={["#315f8e", "#c45a3c", "#d3a444"][index]} roughness={0.72} /></mesh>
      <mesh position={[4, 4.2, 0]}><boxGeometry args={[7, 4, 5]} /><meshStandardMaterial color="#e5dfcf" roughness={0.82} /></mesh>
      <mesh position={[9, 8, 0]}><boxGeometry args={[0.7, 11, 0.7]} /><meshStandardMaterial color="#654731" roughness={0.9} /></mesh>
    </group>)}
    {[-72, -28].map((z) => <group key={z} position={[-34, 5, z]}>
      <mesh position={[-11, 5, 0]}><boxGeometry args={[0.8, 13, 0.8]} /><meshStandardMaterial color="#6c5035" /></mesh>
      <mesh position={[11, 5, 0]}><boxGeometry args={[0.8, 13, 0.8]} /><meshStandardMaterial color="#6c5035" /></mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}><planeGeometry args={[18, 10]} /><meshBasicMaterial color="#527d6e" transparent opacity={0.55} side={THREE.DoubleSide} /></mesh>
    </group>)}
    {[[-18, 82], [10, 78], [38, 75], [-4, 64]].map(([x, z], index) => <mesh key={index} position={[x, 4.5, z]} castShadow>
      <boxGeometry args={[7, 5, 7]} /><meshStandardMaterial color={index % 2 ? "#c28a3e" : "#a96c35"} roughness={0.94} />
    </mesh>)}
  </group>;
}

type SeaVessel = {
  x: number;
  z: number;
  phase: number;
  range: number;
  speed: number;
  kind: "boat" | "trawler";
  color: string;
};

// A small number of independent vessels makes the coast feel lived-in. Their
// movement is calculated from elapsed time (rather than React state), so it
// costs one transform update per vessel and never triggers a UI re-render.
function MovingSeaVessel({ vessel }: { vessel: SeaVessel }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;
    const t = clock.getElapsedTime() * vessel.speed + vessel.phase;
    const travel = Math.sin(t) * vessel.range;
    const waveZ = Math.sin(t * 0.7) * 10;
    // The model's bow is local +X. Derive its yaw from the same path used
    // for position, so every vessel genuinely travels bow-first, including
    // the small Z drift that stops a route looking mechanically straight.
    const velocityX = Math.cos(t) * vessel.range;
    const velocityZ = Math.cos(t * 0.7) * 7;
    const yaw = Math.atan2(-velocityZ, velocityX);
    group.position.set(vessel.x + travel, TILE_H + 0.8 + Math.sin(t * 2.4) * 0.7, vessel.z + waveZ);
    group.rotation.set(0, yaw, Math.sin(t * 2.4) * 0.025);
  });

  const isTrawler = vessel.kind === "trawler";
  const length = isTrawler ? 34 : 19;
  return <group ref={ref}>
    {/* wake stays directly behind the moving hull */}
    <mesh position={[-length * 0.72, -1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[isTrawler ? 26 : 15, isTrawler ? 7 : 4]} />
      <meshBasicMaterial color="#d9f3f5" transparent opacity={0.3} depthWrite={false} />
    </mesh>
    <mesh castShadow><boxGeometry args={[length, isTrawler ? 5 : 3.2, isTrawler ? 9 : 6]} /><meshStandardMaterial color={vessel.color} roughness={0.62} /></mesh>
    <mesh position={[isTrawler ? 3 : 1.8, isTrawler ? 4.4 : 3.1, 0]} castShadow><boxGeometry args={[isTrawler ? 11 : 6, isTrawler ? 5 : 3.2, isTrawler ? 7 : 4.2]} /><meshStandardMaterial color="#e8e4d6" roughness={0.72} /></mesh>
    <mesh position={[isTrawler ? 8 : 4, isTrawler ? 9 : 7, 0]}><boxGeometry args={[0.8, isTrawler ? 12 : 9, 0.8]} /><meshStandardMaterial color="#6e5137" roughness={0.85} /></mesh>
    {isTrawler && <mesh position={[-7, 4.5, 0]}><boxGeometry args={[12, 0.7, 12]} /><meshStandardMaterial color="#c88d47" roughness={0.82} /></mesh>}
  </group>;
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
  const vessels = useMemo(
    () => Array.from({ length: 5 }, (_, index): SeaVessel => ({
      x: (rnd() - 0.5) * span * 0.72,
      z: edge - 170 - rnd() * 330,
      phase: rnd() * Math.PI * 2,
      range: span * (0.12 + rnd() * 0.1),
      speed: 0.07 + rnd() * 0.06,
      kind: index === 0 ? "trawler" : "boat",
      color: ["#c94c3c", "#3c6ec9", "#e6e2d6", "#e0a83b", "#3b8a78"][index],
    })),
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
      {vessels.map((vessel, index) => <MovingSeaVessel key={index} vessel={vessel} />)}
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

// Cloud tint for the Kinabalu cloud band, per time of day.
const CLOUD_TINT: Record<Tod, string> = { day: "#d7e3df", dusk: "#d8a889", night: "#59636e" };

// Interior and highland seats need terrain too, not just the named Kinabalu
// scene below. These layered, irregular slopes form a believable foothill
// range: distant blue-green ridges, forested mid-slopes, then a few trees at
// the base to make the transition into the town read naturally.
function HillRange({ tod, span }: { tod: Tod; span: number }) {
  const s = Math.min(1.25, Math.max(0.72, span / 5200));
  const edge = span / 2;
  const hills = useMemo(() => {
    let seed = 20260926;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    return Array.from({ length: 9 }, (_, index) => ({
      x: 80 + rnd() * 260,
      z: (-0.5 + index / 8) * span * 1.1 + (rnd() - 0.5) * 150,
      radius: (125 + rnd() * 115) * s,
      height: (105 + rnd() * 150) * s,
      back: index % 3 === 0,
      rotation: rnd() * Math.PI,
    }));
  }, [s, span]);
  const treeColor = tod === "night" ? "#183126" : "#28543a";
  return <group position={[edge, 0, 0]}>
    {hills.map((hill, index) => {
      const y = TILE_H + hill.height * 0.46;
      return <group key={index} position={[hill.x, y, hill.z]} rotation={[0, hill.rotation, 0]}>
        {/* faceted ground gives the slope contour instead of a smooth toy dome */}
        <mesh scale={[hill.radius, hill.height, hill.radius * 0.72]} castShadow>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={hill.back ? "#274750" : "#356143"} roughness={0.98} flatShading />
        </mesh>
        {!hill.back && <>
          <mesh position={[-hill.radius * 0.18, hill.height * 0.12, hill.radius * 0.16]} scale={[hill.radius * 0.73, hill.height * 0.7, hill.radius * 0.49]}>
            <dodecahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#3d7046" roughness={1} flatShading />
          </mesh>
          {[-0.38, -0.14, 0.12, 0.37].map((offset) => (
            <mesh key={offset} position={[offset * hill.radius, -hill.height * 0.2, hill.radius * 0.42]}>
              <coneGeometry args={[7 * s, 23 * s, 6]} />
              <meshStandardMaterial color={treeColor} roughness={0.95} />
            </mesh>
          ))}
        </>}
      </group>;
    })}
    {/* a thin atmospheric haze softens the distant ridge line in daytime */}
    {tod !== "night" && <mesh position={[250 * s, TILE_H + 105 * s, 0]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[span * 1.25, 125 * s]} />
      <meshBasicMaterial color={tod === "dusk" ? "#d8a477" : "#c8e1de"} transparent opacity={0.12} depthWrite={false} />
    </mesh>}
  </group>;
}

// ── Mount Kinabalu ──────────────────────────────────────────────────
// Built as one sculpted heightfield rather than stacked cones, so it reads
// like the real massif seen from Kota Kinabalu: long forested shoulders
// cut by ravines, a sheer granite block above the tree line, and a wide,
// ragged summit plateau crowned by named spires. Heights are authored in
// normalised units (a along the ridge, b across it; b < 0 faces the city)
// and scaled by `s` at build time.

// Deterministic value noise + fbm (no dependency, runs once per build).
function hash2(x: number, y: number) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x: number, y: number, oct = 5) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return sum;
}
// Ridged fbm: sharp creases — ravines on the forest, buttresses on granite.
function ridged(x: number, y: number, oct = 4) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(vnoise(x * f, y * f)); sum += amp * n * n; f *= 2.1; amp *= 0.5; }
  return sum;
}
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Summit crown: [a, b, height, radius] in normalised units. Roughly the
// real skyline from the west: South Peak's needle, the Donkey's Ears,
// Low's Peak as the high point, St John's, the Ugly Sisters, then Victoria
// / Alexandra / King Edward trailing east, Tunku Abdul Rahman to the west.
const CROWN: [number, number, number, number][] = [
  [-0.3, 0.02, 0.1, 0.06],    // Tunku Abdul Rahman
  [-0.2, -0.1, 0.13, 0.05],
  [-0.11, -0.2, 0.2, 0.035],  // South Peak
  [-0.03, -0.14, 0.15, 0.03],
  [0.02, -0.17, 0.17, 0.025], // Donkey's Ears
  [0.05, -0.16, 0.17, 0.025],
  [0.1, -0.04, 0.26, 0.06],   // Low's Peak
  [0.17, -0.1, 0.2, 0.045],   // St John's
  [0.23, -0.05, 0.16, 0.035], // Ugly Sisters
  [0.27, -0.02, 0.15, 0.03],
  [0.34, 0.06, 0.17, 0.05],   // Victoria
  [0.38, 0.14, 0.13, 0.05],   // Alexandra
  [0.43, 0.08, 0.12, 0.045],  // King Edward
];

const K_W = 3200; // along the ridge (world Z)
const K_D = 1700; // across it (world X)
const K_FOREST = 520;
const K_GRANITE = 250;

// Concave "volcano skirt" profile: long gentle foot, steepening upward.
const skirt = (e: number, k: number) => Math.max(0, (Math.exp(-k * e) - Math.exp(-k)) / (1 - Math.exp(-k)));

function kinabaluHeight(a: number, b: number): { h: number; rock: number } {
  // Broad massif + a western and eastern foothill spur for a long skyline.
  const warpA = a + fbm(a * 2.5 + 3, b * 2.5, 3) * 0.08;
  const warpB = b + fbm(a * 2.5 - 9, b * 2.5 + 4, 3) * 0.08;
  const e = warpA * warpA + (warpB * 1.15) ** 2;
  let body = skirt(e, 2.6);
  const spurW = 0.42 * skirt(((a + 0.6) / 0.4) ** 2 + ((b + 0.15) / 0.6) ** 2, 2.2);
  const spurE = 0.36 * skirt(((a - 0.64) / 0.36) ** 2 + ((b - 0.05) / 0.6) ** 2, 2.2);
  body = Math.max(body, spurW, spurE) + Math.min(body, spurW, spurE) * 0.3;
  let h = K_FOREST * body;
  // ravines and spurs running down the forested slopes
  const rav = ridged(a * 6 + 3, b * 4.5 - 1);
  h -= K_FOREST * 0.13 * rav * smooth(0.02, 0.3, body) * (1 - smooth(0.7, 0.95, body));
  h += K_FOREST * 0.035 * fbm(a * 16, b * 16, 4) * smooth(0, 0.2, body);

  // Granite massif: tapered walls from a ragged outline, cut by buttresses.
  const wob = fbm(a * 5 - 4, b * 5 + 2, 4) * 0.35;
  const eg = (a / 0.56) ** 2 + ((b + 0.03) / 0.28) ** 2 + wob;
  const blk = smooth(1.15, 0.35, eg);
  const butt = ridged(a * 11 + 5, b * 8, 4);
  // the summit plateau tilts down to the east, like the real one
  let g = K_GRANITE * Math.pow(blk, 1.25) * (0.75 + 0.5 * butt) * (1 - a * 0.25);
  // jagged skyline: a ridged crest plus the named spires
  g += K_GRANITE * 0.4 * Math.pow(ridged(a * 9 + 1, b * 7 - 3, 3), 2) * smooth(0.55, 0.95, blk);
  let crown = 0;
  for (const [pa, pb, ph, pr] of CROWN) {
    const d = Math.hypot((a - pa) * 1.2, b - pb) / (pr * 1.5);
    if (d < 1) crown = Math.max(crown, ph * Math.pow(1 - d, 1.8));
  }
  g += K_GRANITE * crown * 2.2 * smooth(0.4, 0.85, blk);
  h += g;
  if (body <= 0.002 && g < 1) h = -14; // sink the unused rim below the ground sheet
  return { h, rock: blk };
}

function buildKinabalu(s: number) {
  const segW = 240, segD = 130;
  const geo = new THREE.PlaneGeometry(K_D * s, K_W * s, segD, segW);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const rock = new Float32Array(pos.count);
  const hMax = (K_FOREST + K_GRANITE * 1.9) * s;
  for (let i = 0; i < pos.count; i++) {
    const b = pos.getX(i) / (K_D * s / 2);
    const a = pos.getZ(i) / (K_W * s / 2);
    const r = kinabaluHeight(a, b);
    pos.setY(i, r.h * s);
    rock[i] = r.rock;
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const forestDark = new THREE.Color("#1f4128"), forest = new THREE.Color("#2f5f35"), forestLight = new THREE.Color("#4a7a3f");
  const scrub = new THREE.Color("#6b7350"), granite = new THREE.Color("#9a9d9f"), graniteDark = new THREE.Color("#6c7074");
  const graniteLight = new THREE.Color("#b4b6b4");
  const c = new THREE.Color(), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = y / hMax + fbm(x * 0.012 / s, z * 0.012 / s, 3) * 0.07; // ragged tree line
    const up = nrm.getY(i);
    const n = fbm(x * 0.007 / s, z * 0.007 / s, 3);
    // forest: darker in ravines and lower down, lighter on sunlit crests
    c.copy(forestDark).lerp(forest, 0.35 + smooth(-0.4, 0.5, n) * 0.4 + 0.25 * smooth(0, 0.35, t));
    c.lerp(forestLight, smooth(0, 0.6, n) * 0.25 * up * up);
    // montane scrub band just under the rock
    c.lerp(scrub, smooth(0.4, 0.52, t) * 0.75);
    // granite where the block rises, or wherever high ground is steep
    const rockAmt = Math.max(smooth(0.3, 0.6, rock[i]) * smooth(0.42, 0.58, t), smooth(0.7, 0.4, up) * smooth(0.42, 0.55, t));
    tmp.copy(graniteDark).lerp(granite, smooth(-0.4, 0.5, n));
    // vertical streaks down the cliffs + pale bare slabs on the plateau
    tmp.lerp(graniteDark, 0.35 * smooth(0.2, 0.8, Math.abs(Math.sin(z * 0.09 / s + n * 4))) * (1 - up));
    tmp.lerp(graniteLight, smooth(0.7, 0.95, up) * smooth(0.6, 0.85, t) * 0.7);
    c.lerp(tmp, Math.min(1, rockAmt));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return { geo, hMax };
}

// Soft cumulus puff, drawn once.
let cloudTex: THREE.CanvasTexture | null = null;
function getCloudTexture() {
  if (cloudTex) return cloudTex;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  for (let k = 0; k < 7; k++) {
    const x = 40 + k * 8, y = 66 + ((k * 37) % 13) - 6, r = 20 + ((k * 13) % 8); // stays inside the canvas: no hard edges
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  cloudTex = new THREE.CanvasTexture(cv);
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  return cloudTex;
}

function Kinabalu({ tod, span }: { tod: Tod; span: number }) {
  const edge = span / 2; // grid's +X edge — the one edge Coast/Paddy/Lake leave free
  // It belongs on the horizon behind Kota Kinabalu, not immediately beside
  // the last city block. Keeping it distant also preserves the skyline.
  const s = Math.min(0.95, Math.max(0.6, span / 8000));
  const mx = edge + (K_D / 2 + 380) * s;

  const { geo, hMax } = useMemo(() => buildKinabalu(s), [s]);
  useEffect(() => () => geo.dispose(), [geo]);

  const clouds = useMemo(() => {
    let seed = 20260926;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    return Array.from({ length: 16 }, (_, i) => {
      const a = -0.75 + (i / 15) * 1.5 + (rnd() - 0.5) * 0.08;
      return {
        z: a * K_W * s / 2,
        x: (-0.55 + rnd() * 0.5) * K_D * s / 2,
        y: hMax * (0.4 + rnd() * 0.14) * (1 - Math.abs(a) * 0.5),
        w: (520 + rnd() * 420) * s,
        h: (210 + rnd() * 120) * s,
        drift: 0.6 + rnd() * 0.8,
        phase: rnd() * Math.PI * 2,
      };
    });
  }, [s, hMax]);
  const cloudRefs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    clouds.forEach((cl, i) => {
      const sp = cloudRefs.current[i];
      if (sp) sp.position.z = cl.z + Math.sin(t * 0.03 * cl.drift + cl.phase) * 60 * s;
    });
  });
  const cloudColor = CLOUD_TINT[tod];
  const cloudOpacity = tod === "night" ? 0.3 : tod === "dusk" ? 0.55 : 0.65;

  return (
    <group position={[mx, TILE_H - 2, 0]}>
      <mesh geometry={geo}>
        <meshStandardMaterial vertexColors roughness={0.96} metalness={0} />
      </mesh>
      {/* the famous mid-morning cloud band wrapping the upper slopes */}
      {clouds.map((cl, i) => (
        <sprite key={i} ref={(el) => { cloudRefs.current[i] = el; }} position={[cl.x, cl.y, cl.z]} scale={[cl.w, cl.h, 1]}>
          <spriteMaterial map={getCloudTexture()} color={cloudColor} transparent opacity={cloudOpacity} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

export function EdgeLandscape({
  traits, tod, span, coastalVillage,
}: {
  traits: SeatTraits;
  tod: Tod;
  span: number;
  coastalVillage?: CellPlacement;
}) {
  if (!traits.coastal && !traits.paddy && !traits.lake && !traits.hilly && !traits.kinabalu) return null;
  return (
    <group>
      {traits.coastal && <Coast tod={tod} span={span} />}
      {traits.coastal && coastalVillage && <FishingVillageHarbour village={coastalVillage} />}
      {traits.paddy && <Paddy span={span} />}
      {traits.lake && <Lake tod={tod} span={span} />}
      {traits.hilly && !traits.kinabalu && <HillRange tod={tod} span={span} />}
      {traits.kinabalu && <Kinabalu tod={tod} span={span} />}
    </group>
  );
}
