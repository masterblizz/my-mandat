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
// reasonable price for a decorative touch.
//
// Realism without a reflection pass:
//   • an earth/grass bund rings every pond, so the water sits recessed in a
//     bank instead of being a flat sheet pasted on the ground;
//   • the body colour is a murky fish-pond green, darker over the deep
//     middle and lighter in the shallows (distance to bank, in world units);
//   • small analytic ripples perturb a normal, which drives a Fresnel sky
//     reflection (only strong at grazing angles) and tight sun glints —
//     instead of the old low-frequency sines that read as big white blobs;
//   • a wet dark shoreline band and a few lily pads near the banks.
// Everything stays inside ONE InstancedMesh per layer, so pond count is free.

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TOD_ENV, type Tod } from "./cityData";
import type { BuildingInstance } from "./models";

const WATER_Y = 0.45;   // water surface above the tile top
const BANK_H = 1.5;     // bund height above the tile top
const BANK_COLOR = "#59663f";

// No `precision` statement here: ShaderMaterial prepends one to BOTH stages.
// A fragment-only `precision mediump float` made uTime's precision differ
// between stages, which fails program validation on some drivers.
const VERT = /* glsl */ `
  attribute vec2 aSize;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying vec2 vSize;
  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vUv = uv;
    vSize = aSize;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyLow;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uPad;
  uniform float uLight;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying vec2 vSize;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    // distance to the nearest bank, in world units
    float edge = min(min(vUv.x, 1.0 - vUv.x) * vSize.x, min(vUv.y, 1.0 - vUv.y) * vSize.y);

    // ripple normal: gradient of a few small travelling waves
    vec2 p = vWorldPos.xz;
    vec2 g = vec2(0.0);
    vec2 d;
    d = normalize(vec2(1.0, 0.3));   g += d * cos(dot(p, d) * 0.9 + uTime * 1.6) * 0.9 * 0.05;
    d = normalize(vec2(-0.4, 1.0));  g += d * cos(dot(p, d) * 1.3 + uTime * 2.1) * 1.3 * 0.035;
    d = normalize(vec2(0.7, -0.8));  g += d * cos(dot(p, d) * 2.1 + uTime * 2.7) * 2.1 * 0.02;
    d = normalize(vec2(-1.0, -0.2)); g += d * cos(dot(p, d) * 0.45 + uTime * 0.9) * 0.45 * 0.06;
    vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 V = normalize(cameraPosition - vWorldPos);

    // murky body colour: deeper (darker) away from the banks
    float depth = smoothstep(0.0, 16.0, edge);
    vec3 body = mix(uShallow, uDeep, depth) * uLight;

    // Fresnel sky reflection — weak looking down, strong at grazing angles
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 R = reflect(-V, N);
    vec3 sky = mix(uSkyLow, uSkyTop, clamp(R.y, 0.0, 1.0));
    vec3 col = mix(body, sky, clamp(fres * 0.9, 0.0, 0.75));

    // tight sun / moon glints on ripple crests
    float spec = pow(max(dot(R, normalize(uSunDir)), 0.0), 220.0);
    col += uSunColor * spec * 1.6;

    // wet, darker shoreline band against the bund
    float shore = 1.0 - smoothstep(0.0, 3.0, edge);
    col *= 1.0 - shore * 0.45;

    // a few lily pads / algae mats floating near the banks
    vec2 cp = p / 6.0;
    vec2 cell = floor(cp);
    float h = hash(cell);
    vec2 off = vec2(hash(cell + 7.1), hash(cell + 3.7)) - 0.5;
    float pad = 1.0 - smoothstep(0.17, 0.21, length(fract(cp) - 0.5 - off * 0.4) / (0.7 + h * 0.6));
    pad *= step(0.78, h) * (1.0 - smoothstep(5.0, 14.0, edge)) * step(2.0, edge);
    col = mix(col, uPad * uLight, pad * 0.9);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// Bund width scales with the pond but stays a believable 3..6 units.
const bankW = (it: BuildingInstance) => THREE.MathUtils.clamp(Math.min(it.w, it.d) * 0.06, 3, 6);

function lightFor(tod: Tod) {
  const env = TOD_ENV[tod];
  return THREE.MathUtils.clamp(env.sunIntensity / 1.9 + env.ambientIntensity * 0.4, 0.35, 1.1);
}

export function WaterPatches({
  items, groundY, tod,
}: {
  items: BuildingInstance[];
  groundY: number;
  tod: Tod;
}) {
  const waterRef = useRef<THREE.InstancedMesh>(null);
  const bankRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const env = TOD_ENV[tod];

  // Re-tint (not re-allocate the mesh) when time-of-day changes.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSkyTop: { value: new THREE.Color() },
      uSkyLow: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uShallow: { value: new THREE.Color("#55704a") },
      uDeep: { value: new THREE.Color("#173d3b") },
      uPad: { value: new THREE.Color("#3f7a35") },
      uLight: { value: 1 },
    }),
    [],
  );
  useEffect(() => {
    uniforms.uSkyTop.value.set(env.skyTop);
    uniforms.uSkyLow.value.set(env.skyBottom);
    uniforms.uSunDir.value.set(env.sun[0], env.sun[1], env.sun[2]).normalize();
    uniforms.uSunColor.value.set(env.sunColor).multiplyScalar(Math.min(1, env.sunIntensity / 1.9));
    uniforms.uLight.value = lightFor(tod);
  }, [env, tod, uniforms]);

  const sizeAttr = useMemo(() => {
    const arr = new Float32Array(items.length * 2);
    items.forEach((it, i) => {
      const outerW = Math.max(it.w * 0.96, 1), outerD = Math.max(it.d * 0.96, 1);
      arr[i * 2] = Math.max(outerW - bankW(it) * 2, 1);
      arr[i * 2 + 1] = Math.max(outerD - bankW(it) * 2, 1);
    });
    return new THREE.InstancedBufferAttribute(arr, 2);
  }, [items]);

  useLayoutEffect(() => {
    const water = waterRef.current;
    const bank = bankRef.current;
    if (!water || !bank) return;
    water.geometry.setAttribute("aSize", sizeAttr);
    items.forEach((it, i) => {
      const outerW = Math.max(it.w * 0.96, 1), outerD = Math.max(it.d * 0.96, 1);
      const bw = bankW(it);
      dummy.position.set(it.x, groundY + WATER_Y, it.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(sizeAttr.getX(i), sizeAttr.getY(i), 1);
      dummy.updateMatrix();
      water.setMatrixAt(i, dummy.matrix);

      // four bund strips: north/south span the full width, east/west fill between
      dummy.rotation.set(0, 0, 0);
      const strips: [number, number, number, number][] = [
        [0, -(outerD - bw) / 2, outerW, bw],
        [0, (outerD - bw) / 2, outerW, bw],
        [-(outerW - bw) / 2, 0, bw, outerD - bw * 2],
        [(outerW - bw) / 2, 0, bw, outerD - bw * 2],
      ];
      strips.forEach(([dx, dz, sw, sd], n) => {
        dummy.position.set(it.x + dx, groundY + BANK_H / 2, it.z + dz);
        dummy.scale.set(sw, BANK_H, Math.max(sd, 0.1));
        dummy.updateMatrix();
        bank.setMatrixAt(i * 4 + n, dummy.matrix);
      });
    });
    water.instanceMatrix.needsUpdate = true;
    bank.instanceMatrix.needsUpdate = true;
  }, [items, groundY, dummy, sizeAttr]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
  });

  if (!items.length) return null;
  return (
    <group>
      <instancedMesh
        ref={waterRef}
        key={`water-${items.length}`}
        args={[undefined, undefined, items.length]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} />
      </instancedMesh>
      <instancedMesh
        ref={bankRef}
        key={`water-bank-${items.length}`}
        args={[undefined, undefined, items.length * 4]}
        frustumCulled={false}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={BANK_COLOR} roughness={1} />
      </instancedMesh>
    </group>
  );
}
