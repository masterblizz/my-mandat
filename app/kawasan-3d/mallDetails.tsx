"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getFacadeTexture, getWindowTexture } from "./windows";

// Fictional property name, kept identical on the landmark and built mall.
const MALL_NAME = "SERI IMPIAN MALL";

export function MallSign({ width, height, winLit = 0 }: {
  width: number; height: number; winLit?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#132e36";
    ctx.fillRect(0, 0, 1024, 128);
    ctx.strokeStyle = "#c9aa70";
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, 1008, 112);
    ctx.font = "600 76px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff0cb";
    ctx.fillText(MALL_NAME, 512, 66, 940);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} roughness={0.55} metalness={0.1}
        emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.25 + winLit * 0.7} />
    </mesh>
  );
}

// Separate wall planes leave roofs unglazed. Shared cached textures keep
// the floor grid crisp without adding geometry for each individual pane.
export function MallGlazing({ width, height, depth, winLit, tower = false }: {
  width: number; height: number; depth: number; winLit: number; tower?: boolean;
}) {
  const type = tower ? "tower" : "mall";
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#b9d2d8", map: getFacadeTexture(type, 0),
    emissive: "#fff3da", emissiveMap: getWindowTexture(type, 0),
    roughness: 0.3, metalness: 0.2,
  }), [type]);
  useEffect(() => { material.emissiveIntensity = winLit * 0.85; }, [material, winLit]);
  useEffect(() => () => material.dispose(), [material]);
  return <group>
    {[1, -1].map(side => <group key={side}>
      <mesh position={[0, 0, side * (depth / 2 + 0.2)]}
        rotation={[0, side === 1 ? 0 : Math.PI, 0]} material={material}>
        <planeGeometry args={[width, height]} />
      </mesh>
      <mesh position={[side * (width / 2 + 0.2), 0, 0]}
        rotation={[0, side * Math.PI / 2, 0]} material={material}>
        <planeGeometry args={[depth, height]} />
      </mesh>
    </group>)}
  </group>;
}
