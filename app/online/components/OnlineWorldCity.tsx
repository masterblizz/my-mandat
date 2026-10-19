"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { t, type Lang } from "../../i18n/useLang";

type OnlineWorldCityProps = { worldName: string; characterName: string; partyCount: number; lang: Lang };

type Tower = { x: number; z: number; height: number; colour: string };
const CITY_COLOURS = ["#0e7490", "#155e75", "#164e63", "#1e3a5f", "#365314"];

function seededValue(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function buildTowers(worldName: string): Tower[] {
  const base = Array.from(worldName).reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1;
  return Array.from({ length: 30 }, (_, index) => ({
    x: (index % 6 - 2.5) * 2.15 + (seededValue(base + index) - 0.5) * 0.35,
    z: (Math.floor(index / 6) - 2) * 2.15 + (seededValue(base + index * 7) - 0.5) * 0.35,
    height: 0.8 + seededValue(base + index * 17) * 3.8,
    colour: CITY_COLOURS[index % CITY_COLOURS.length],
  }));
}

function CityGeometry({ worldName }: { worldName: string }) {
  const towers = useMemo(() => buildTowers(worldName), [worldName]);
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[18, 18]} /><meshStandardMaterial color="#07131f" metalness={0.35} roughness={0.75} /></mesh>
    {[-6, -3, 0, 3, 6].map(position => <group key={position}><mesh position={[position, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.34, 18]} /><meshStandardMaterial color="#0f2533" emissive="#04384b" emissiveIntensity={0.45} /></mesh><mesh position={[0, 0.025, position]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[18, 0.34]} /><meshStandardMaterial color="#0f2533" emissive="#04384b" emissiveIntensity={0.45} /></mesh></group>)}
    {towers.map((tower, index) => <mesh castShadow receiveShadow key={index} position={[tower.x, tower.height / 2, tower.z]}><boxGeometry args={[1.15, tower.height, 1.15]} /><meshStandardMaterial color={tower.colour} emissive={tower.colour} emissiveIntensity={0.18} metalness={0.55} roughness={0.36} /></mesh>)}
    <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[1.2, 1.2, 0.28, 32]} /><meshStandardMaterial color="#f0a500" emissive="#f0a500" emissiveIntensity={0.6} /></mesh>
  </group>;
}

/**
 * A visual-only online city. It receives display values from the authenticated
 * world overview and intentionally has no dependency on the solo Zustand store,
 * local saves, journey state, or online mutation endpoints.
 */
export default function OnlineWorldCity({ worldName, characterName, partyCount, lang }: OnlineWorldCityProps) {
  return <section className="online-world-city relative mt-4 overflow-hidden border border-cyan-800/70 bg-[#050b13]" aria-label={t(lang, "Gambaran bandar dunia", "World city overview")}>
    <Canvas className="absolute inset-0" dpr={[1, 1.5]} shadows camera={{ position: [11, 10, 13], fov: 42 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
      <color attach="background" args={["#06101a"]} /><fog attach="fog" args={["#06101a", 13, 29]} />
      <ambientLight intensity={0.7} /><directionalLight castShadow position={[8, 12, 6]} intensity={1.35} color="#b9e7ff" /><pointLight position={[0, 4, 0]} intensity={7} color="#f0a500" distance={10} />
      <CityGeometry worldName={worldName} /><OrbitControls enablePan={false} minDistance={11} maxDistance={23} minPolarAngle={0.72} maxPolarAngle={1.25} autoRotate autoRotateSpeed={0.35} />
    </Canvas>
    <div className="pointer-events-none relative z-10 flex min-h-[250px] flex-col justify-between p-4" style={{ background: "linear-gradient(90deg, rgb(3 9 16 / .84), transparent 58%, rgb(3 9 16 / .52))" }}>
      <div><p className="text-[10px] font-black tracking-[.22em] text-cyan">{t(lang, "BANDAR DUNIA // BACAAN SAHAJA", "WORLD CITY // READ ONLY")}</p><h2 className="mt-1 text-xl font-black text-white">{worldName}</h2></div>
      <div className="max-w-[270px] border-l-2 border-gold bg-black/35 p-3 text-xs text-slate-200"><b>{characterName}</b><p className="mt-1 text-text-muted">{t(lang, `${partyCount} parti aktif dalam dunia ini. Bandar ini hanya visual—aksi politik dibuat melalui giliran dunia yang disahkan server.`, `${partyCount} active parties in this world. This city is visual-only—political actions use server-validated world turns.`)}</p></div>
    </div>
  </section>;
}
