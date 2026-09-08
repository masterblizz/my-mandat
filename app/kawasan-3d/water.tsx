"use client";

// Phase C: water shader for the "pond" BType.
//
// DECISION (see docs/webgl-migration-log.md for the full write-up): this is
// a bespoke, cheap animated ShaderMaterial rather than three's Water.js
// addon (examples/jsm/objects/Water.js). Water.js looks great but renders a
// full mirror-reflection pass PER INSTANCE it's attached to, and "pond" is
// not rare here — every river-kind zone's filler pool includes it, and
// riverside zones recur repeatedly once the developed-zone count passes the
// base archetype pool (see ZONE_FILLER.river / the cycling logic in
// makeDemoZones). At Dense metro that's potentially dozens of pond tiles;
// dozens of extra scene-to-texture reflection passes per frame is not a
// reasonable price for a decorative touch. This shader fakes the
// "reflects its surroundings" read by tinting toward the current TOD sky
// colour instead of a real reflection, and animates ripples analytically
// (layered sines in the fragment shader — no normal-map texture, no extra
// render target), all inside ONE InstancedMesh so pond count is free.

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TOD_ENV, type Tod } from "./cityData";
import type { BuildingInstance } from "./models";

const VERT = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 world = instanceMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform float uOpacity;
  varying vec3 vWorldPos;
  void main() {
    // three overlapping travelling sine sets -> a non-repeating-looking
    // ripple field without any texture sampling.
    float r =
      sin(vWorldPos.x * 0.18 + uTime * 1.1) +
      sin(vWorldPos.z * 0.22 - uTime * 0.85) +
      sin((vWorldPos.x + vWorldPos.z) * 0.12 + uTime * 0.5) * 0.8;
    float n = r / 2.8 * 0.5 + 0.5; // normalise roughly into 0..1
    vec3 col = mix(uDeep, uSky, 0.3 + 0.3 * n);
    float glint = smoothstep(0.72, 0.95, n);
    col += glint * 0.3;
    gl_FragColor = vec4(col, uOpacity);
  }
`;

export function WaterPatches({
  items, groundY, tod,
}: {
  items: BuildingInstance[];
  groundY: number;
  tod: Tod;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const env = TOD_ENV[tod];

  // Re-tint (not re-allocate the mesh) when time-of-day changes.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(env.skyBottom).multiplyScalar(0.22) },
      uSky: { value: new THREE.Color(env.skyBottom) },
      uOpacity: { value: 0.88 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    uniforms.uDeep.value.set(env.skyBottom).multiplyScalar(0.22);
    uniforms.uSky.value.set(env.skyBottom);
  }, [env.skyBottom, uniforms]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      dummy.position.set(it.x, groundY + 0.5, it.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      // slightly inset from the tile's footprint so a bank of "shore" still
      // reads at the edge, matching how the box fallback used to look.
      dummy.scale.set(Math.max(it.w * 0.94, 1), Math.max(it.d * 0.94, 1), 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [items, groundY, dummy]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
  });

  if (!items.length) return null;
  return (
    <instancedMesh
      ref={ref}
      key={`water-${items.length}`}
      args={[undefined, undefined, items.length]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </instancedMesh>
  );
}
