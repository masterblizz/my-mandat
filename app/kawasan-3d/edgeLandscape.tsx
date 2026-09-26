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

import { useMemo, useRef } from "react";
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
  const shore = -120;
  return <group position={[village.cx, TILE_H, village.cz]}>
    <mesh position={[0, 1.1, shore / 2]} castShadow><boxGeometry args={[18, 2.2, 240]} /><meshStandardMaterial color="#8a6344" roughness={0.9} /></mesh>
    {[-1, 1].flatMap((side) => [-76, -20, 38, 94].map((z) => (
      <mesh key={`${side}-${z}`} position={[side * 7, -4.5, z]}><cylinderGeometry args={[1.1, 1.45, 13, 6]} /><meshStandardMaterial color="#5a402e" roughness={0.95} /></mesh>
    )))}
    {[-42, 34].map((x, index) => <group key={x} position={[x, 0, -44 - index * 30]}>
      <mesh position={[0, 9, 0]} castShadow><boxGeometry args={[31, 18, 24]} /><meshStandardMaterial color={index ? "#b98b62" : "#9d7655"} roughness={0.78} /></mesh>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <mesh key={`${sx}-${sz}`} position={[sx * 11, 3, sz * 8]}><cylinderGeometry args={[0.7, 0.9, 8, 6]} /><meshStandardMaterial color="#5a402e" roughness={0.9} /></mesh>))}
      <mesh position={[0, 20, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[23, 10, 4]} /><meshStandardMaterial color="#b84335" roughness={0.8} /></mesh>
    </group>)}
    {[-72, 62].map((x, index) => <group key={x} position={[x, 0.8, -132 - index * 18]} rotation={[0, index ? -0.45 : 0.35, 0]}>
      <mesh><boxGeometry args={[7, 3, 20]} /><meshStandardMaterial color={index ? "#2f7db4" : "#d05740"} roughness={0.65} /></mesh>
      <mesh position={[0, 7, 0]}><boxGeometry args={[0.6, 13, 0.6]} /><meshStandardMaterial color="#8a6344" /></mesh>
    </group>)}
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

// Mount Kinabalu's real silhouette: a broad forested shoulder rising to a
// bare granite massif, topped by a jagged crown of summit spires (Low's
// Peak, St John's, South Peak, the "Ugly Sisters"...) around the summit
// plateau's rim, usually half-wrapped in cloud by mid-morning.
const PEAK_TINT: Record<Tod, string> = { day: "#c7c3ba", dusk: "#e8a672", night: "#5b6270" };
const CLOUD_TINT: Record<Tod, string> = { day: "#f5f5f2", dusk: "#f0b98a", night: "#3d4552" };

function Kinabalu({ tod, span }: { tod: Tod; span: number }) {
  const edge = span / 2; // grid's +X edge — the one edge Coast/Paddy/Lake leave free
  const mx = edge + 300;
  const mz = 0;
  // Gentle size scaling across density presets, capped both ways so a
  // rural 6x6 doesn't get a toy pebble and a dense-metro 30x30 doesn't
  // get an absurd wall — real Kinabalu dwarfs any of these cities anyway.
  const s = Math.min(1.5, Math.max(0.75, span / 6000));

  const rnd = useMemo(() => {
    let seed = 20260913;
    return () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  }, []);
  const foothills = useMemo(
    () => Array.from({ length: 4 }, () => ({
      x: (rnd() - 0.5) * 620 * s,
      z: (rnd() - 0.5) * 420 * s + 140 * s,
      r: (130 + rnd() * 70) * s,
      h: (80 + rnd() * 60) * s,
    })),
    [rnd, s],
  );
  const spires = useMemo(
    () => Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + rnd() * 0.4;
      const r = (55 + rnd() * 35) * s;
      return {
        x: Math.cos(a) * r, z: Math.sin(a) * r,
        rad: (14 + rnd() * 12) * s, h: (70 + rnd() * 90) * s,
        tiltX: (rnd() - 0.5) * 0.25, tiltZ: (rnd() - 0.5) * 0.25,
      };
    }),
    [rnd, s],
  );

  const FOREST_H = 460 * s;
  const ROCK_BASE_Y = TILE_H + FOREST_H * 0.5;
  const ROCK_H = 520 * s;
  const summitY = ROCK_BASE_Y + ROCK_H;
  const peakColor = PEAK_TINT[tod];
  const cloudColor = CLOUD_TINT[tod];

  return (
    <group position={[mx, 0, mz]}>
      {/* forested foothills leading up to the massif */}
      {foothills.map((f, i) => (
        <mesh key={i} position={[f.x, TILE_H + f.h / 2, f.z]} castShadow>
          <coneGeometry args={[f.r, f.h, 8]} />
          <meshStandardMaterial color="#2f5a3a" roughness={0.95} />
        </mesh>
      ))}
      {/* forested lower slopes */}
      <mesh position={[0, TILE_H + FOREST_H / 2, 0]} castShadow>
        <coneGeometry args={[360 * s, FOREST_H, 10]} />
        <meshStandardMaterial color="#355f3f" roughness={0.95} />
      </mesh>
      {/* bare granite massif, rising out of the treeline */}
      <mesh position={[0, ROCK_BASE_Y + ROCK_H / 2, 0]} castShadow>
        <coneGeometry args={[210 * s, ROCK_H, 10]} />
        <meshStandardMaterial color={peakColor} roughness={0.85} />
      </mesh>
      {/* jagged summit spires around the plateau rim */}
      {spires.map((sp, i) => (
        <mesh
          key={i}
          position={[sp.x, summitY + sp.h / 2 - 10 * s, sp.z]}
          rotation={[sp.tiltX, 0, sp.tiltZ]}
          castShadow
        >
          <coneGeometry args={[sp.rad, sp.h, 6]} />
          <meshStandardMaterial color={peakColor} roughness={0.8} />
        </mesh>
      ))}
      {/* cloud band wrapping the upper slopes */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        const r = 200 * s;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * r, ROCK_BASE_Y + ROCK_H * 0.42, Math.sin(a) * r]}
            scale={[3.2 * s, 0.55 * s, 1.3 * s]}
            renderOrder={1}
          >
            <sphereGeometry args={[60, 10, 8]} />
            <meshBasicMaterial color={cloudColor} transparent opacity={0.55} depthWrite={false} fog={false} />
          </mesh>
        );
      })}
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
  if (!traits.coastal && !traits.paddy && !traits.lake && !traits.kinabalu) return null;
  return (
    <group>
      {traits.coastal && <Coast tod={tod} span={span} />}
      {traits.coastal && coastalVillage && <FishingVillageHarbour village={coastalVillage} />}
      {traits.paddy && <Paddy span={span} />}
      {traits.lake && <Lake tod={tod} span={span} />}
      {traits.kinabalu && <Kinabalu tod={tod} span={span} />}
    </group>
  );
}
