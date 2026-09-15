"use client";

// One shared image-based-lighting environment for the whole scene, so the
// glassy building materials (metalness + low roughness in procedural.tsx /
// largeBuildings.tsx) have a sky to reflect. It is a PMREM-filtered
// gradient built from the current time-of-day's own sky colours
// (TOD_ENV), so the reflections shift day -> dusk -> night with the
// scene rather than being a fixed studio probe. Regenerated only when
// `tod` changes (≤ 3 times), never per frame; a single 256² equirect
// PMREM shared by every material via `scene.environment` — zero
// per-building cost, no extra draw calls.

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TOD_ENV, type Tod } from "./cityData";

function gradientEquirect(top: string, ground: string, horizon: string): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(0.46, horizon);
  g.addColorStop(0.5, horizon);
  g.addColorStop(0.58, ground);
  g.addColorStop(1, ground);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function SceneEnvironment({ tod }: { tod: Tod }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const env = TOD_ENV[tod];
    // The lower hemisphere reflects terrain, not another bright sky.
    // This grounds glass facades and gives upper/lower panes a believable
    // contrast without adding lights or per-building reflection probes.
    const src = gradientEquirect(env.skyTop, env.ground, env.skyBottom);
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const rt = pmrem.fromEquirectangular(src);
    const prev = scene.environment;
    scene.environment = rt.texture;

    return () => {
      if (scene.environment === rt.texture) scene.environment = prev ?? null;
      rt.dispose();
      pmrem.dispose();
      src.dispose();
    };
  }, [gl, scene, tod]);

  return null;
}
