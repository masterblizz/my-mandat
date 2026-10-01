// Shared look for every instanced vehicle in the 3D city: chamfered body
// geometry and a lit "paint" material that still reads in the dark
// tactical scene.
//
// The fleet used to render with meshBasicMaterial, so every face of a car
// was the same flat colour and vehicles read as coloured stickers. A lit
// material gives top/side/front faces different shading plus a clear-coat
// highlight, while a small self-lit term (the instance colour fed into
// emissive) keeps red/blue/yellow paint legible under tall towers instead
// of collapsing toward black.
//
// Per-instance colour comes from InstancedMesh.instanceColor. Never set
// vertexColors on these materials: the geometries carry no `color`
// attribute, so WebGL would multiply every vehicle by (0,0,0).

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const geoCache = new Map<string, THREE.BufferGeometry>();

/** Chamfered box shared across mounts. One segment keeps the triangle count
 *  low for thousands of instances while the bevelled edges still catch
 *  light, which is most of what makes a box read as a car body. */
export function vehicleBox(w: number, h: number, d: number, radius = Math.min(w, h, d) * 0.22): THREE.BufferGeometry {
  const key = `${w}|${h}|${d}|${radius}`;
  let geo = geoCache.get(key);
  if (!geo) {
    geo = new RoundedBoxGeometry(w, h, d, 1, radius);
    geoCache.set(key, geo);
  }
  return geo;
}

function selfLit(material: THREE.MeshStandardMaterial, amount: number, cacheKey: string) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * ${amount.toFixed(3)};`,
    );
  };
  material.customProgramCacheKey = () => cacheKey;
  return material;
}

/** Glossy car paint: lit + clear-coat-ish highlight + a self-lit floor. */
export function makePaintMaterial(selfLitAmount = 0.38): THREE.MeshStandardMaterial {
  return selfLit(
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.34, metalness: 0.18 }),
    selfLitAmount,
    `vehicle-paint-${selfLitAmount}`,
  );
}

/** Tinted glass greenhouse: darker and shinier than paint. */
export function makeGlassMaterial(selfLitAmount = 0.22): THREE.MeshStandardMaterial {
  return selfLit(
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.12, metalness: 0.35 }),
    selfLitAmount,
    `vehicle-glass-${selfLitAmount}`,
  );
}

/** Tyre rubber with a faint sheen so wheels don't vanish into the asphalt. */
export function makeTyreMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: "#16191f", roughness: 0.82, metalness: 0.05 });
}
