"use client";

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLOT, type CellPlacement } from './cityData';
import { type Festival } from './festivals';
import { getFlagTexture } from './flags';
import type { Lang } from '../i18n/useLang';

type Site = { x: number; z: number };

function FestivalBatch({ festival, sites, glow, lang }: {
  festival: Festival; sites: Site[]; glow: number; lang: Lang;
}) {
  const poles = useRef<THREE.InstancedMesh>(null);
  const cords = useRef<THREE.InstancedMesh>(null);
  const ornaments = useRef<THREE.InstancedMesh>(null);
  const banners = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const banner = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = festival.colors[0]; ctx.fillRect(0, 0, 1024, 128);
    ctx.strokeStyle = '#f9df96'; ctx.lineWidth = 5; ctx.strokeRect(7, 7, 1010, 114);
    ctx.fillStyle = '#fff7df'; ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((lang === 'ms' ? festival.ms : festival.en).toUpperCase(), 512, 67, 960);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return tex;
  }, [festival, lang]);
  const geometry = useMemo(() => {
    switch (festival.motif) {
      case 'flag': return new THREE.PlaneGeometry(14, 7, 4, 1);
      case 'ketupat': {
        const g = new THREE.BoxGeometry(6, 6, 2.5); g.rotateZ(Math.PI / 4); return g;
      }
      case 'tree': return new THREE.ConeGeometry(5, 11, 7);
      case 'harvest': return new THREE.OctahedronGeometry(4);
      case 'light': return new THREE.SphereGeometry(3.2, 8, 6);
      default: {
        const g = new THREE.SphereGeometry(4.5, 10, 8); g.scale(1, 1.3, 1); return g;
      }
    }
  }, [festival]);
  useEffect(() => () => { banner.dispose(); }, [banner]);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);

  useEffect(() => {
    if (!poles.current || !cords.current || !banners.current || !ornaments.current) return;
    const write = (mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number,
      sx: number, sy: number, sz: number, yaw = 0) => {
      dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
    };
    sites.forEach((site, i) => {
      for (let side = 0; side < 2; side++) {
        write(poles.current!, i * 2 + side, site.x + (side ? 90 : -90), 26, site.z, 1.3, 44, 1.3);
        write(banners.current!, i * 2 + side, site.x, 42, site.z + (side ? -0.2 : 0.2), 104, 13, 1, side ? Math.PI : 0);
      }
      write(cords.current!, i, site.x, 32, site.z, 180, 0.5, 0.5);
      for (let j = 0; j < 7; j++) ornaments.current!.setColorAt(i * 7 + j,
        new THREE.Color(festival.motif === 'flag' ? '#ffffff' : festival.colors[j % festival.colors.length]));
    });
    for (const mesh of [poles.current, cords.current, banners.current]) {
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    }
    if (ornaments.current.instanceColor) ornaments.current.instanceColor.needsUpdate = true;
  }, [sites, festival, dummy]);

  useFrame(({ clock }) => {
    if (!ornaments.current) return;
    const time = clock.elapsedTime;
    sites.forEach((site, i) => {
      for (let j = 0; j < 7; j++) {
        const sway = Math.sin(time * 1.4 + i + j * 0.6) * 0.08;
        dummy.position.set(site.x + (j - 3) * 25, 26 - Math.sin(j / 6 * Math.PI) * 3, site.z);
        dummy.scale.set(1, 1, 1); dummy.rotation.set(0, sway, sway);
        dummy.updateMatrix(); ornaments.current!.setMatrixAt(i * 7 + j, dummy.matrix);
      }
    });
    ornaments.current.instanceMatrix.needsUpdate = true;
  });
  if (!sites.length) return null;
  return <group>
    <instancedMesh ref={poles} args={[undefined, undefined, sites.length * 2]} frustumCulled={false}>
      <boxGeometry /><meshStandardMaterial color="#d0b777" metalness={0.4} roughness={0.55} />
    </instancedMesh>
    <instancedMesh ref={cords} args={[undefined, undefined, sites.length]} frustumCulled={false}>
      <boxGeometry /><meshStandardMaterial color="#efda9d" emissive="#ffe4a6" emissiveIntensity={glow * 0.7} />
    </instancedMesh>
    <instancedMesh ref={banners} args={[undefined, undefined, sites.length * 2]} frustumCulled={false}>
      <planeGeometry /><meshStandardMaterial map={banner} emissiveMap={banner} emissive="#ffffff" emissiveIntensity={0.15 + glow * 0.45} roughness={0.8} />
    </instancedMesh>
    <instancedMesh ref={ornaments} geometry={geometry} args={[undefined, undefined, sites.length * 7]} frustumCulled={false}>
      <meshStandardMaterial map={festival.motif === 'flag' ? getFlagTexture() : null}
        side={THREE.DoubleSide} roughness={0.6} emissive={festival.colors[1]}
        emissiveIntensity={glow * (festival.motif === 'flag' ? 0.06 : 0.4)} />
    </instancedMesh>
  </group>;
}

export function FestivalDecorations({ festivals, placed, claimed, avoidCentre, detail, glow, lang }: {
  festivals: Festival[]; placed: CellPlacement[]; claimed: Set<string>;
  avoidCentre: [number, number] | null; detail: number; glow: number; lang: Lang;
}) {
  const sites = useMemo(() => placed.filter(p => !claimed.has(`${p.col},${p.row}`))
    .map(p => ({ x: p.cx, z: p.cz + PLOT / 2 - 5 }))
    .filter(p => !avoidCentre || Math.hypot(p.x - avoidCentre[0], p.z - avoidCentre[1]) > 230)
    .slice(0, Math.max(8, Math.round(32 * detail))), [placed, claimed, avoidCentre, detail]);
  return <group>{festivals.map((festival, index) => <FestivalBatch key={festival.id}
    festival={festival} sites={sites.filter((_, i) => i % festivals.length === index)} glow={glow} lang={lang} />)}</group>;
}
