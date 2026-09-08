"use client";

// Everything that lives INSIDE the <Canvas>: the zone grid, buildings,
// environment (sky/lights/shadows), street lamps, cars, LRT, the camera
// rig, and an optional dev perf probe. Shared by the /kawasan-3d sandbox
// harness (Scene.tsx) and the drop-in City3DMapGL.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraRig, type CamState } from "./CameraRig";
import {
  InstancedBoxes, InstancedModel, useModelAvailability, type BuildingInstance,
} from "./models";
import {
  CityEnvironment, StreetLamps, Traffic, Lrt, ZoneBeacon, type Weather,
} from "./scenery";
import { WaterPatches } from "./water";
import { Vegetation } from "./vegetation";
import {
  placeZones, emptyCells, roadsV, roadsH, worldCentre, worldSize,
  zoneGroundColor, zoneBuildings, slotPos, BUILDING_COLOR, FLAT_TYPES,
  PLOT, ROAD_GAP, TOD_ENV, pickVariantIndex,
  type Zone, type BType, type CellPlacement, type SeatTraits, type Tod,
} from "./cityData";
import type { MutableRefObject } from "react";

const TILE_H = 4;
const ROAD_W = ROAD_GAP - PLOT;
const GROUND_Y = TILE_H;
const FLAT_BOX_H = 3;

export type PerfSample = { fps: number; calls: number; tris: number };

function ZoneTile({
  zone, cx, cz, selected, onSelect,
}: {
  zone: Zone; cx: number; cz: number; selected: boolean; onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const gl = useThree((s) => s.gl);
  const setCursor = (c: string) => { gl.domElement.style.cursor = c; };
  return (
    <mesh
      position={[cx, TILE_H / 2, cz]}
      receiveShadow
      onClick={(e) => { e.stopPropagation(); onSelect(zone.id); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); setCursor("pointer"); }}
      onPointerOut={() => { setHovered(false); setCursor("grab"); }}
    >
      <boxGeometry args={[PLOT, TILE_H, PLOT]} />
      <meshStandardMaterial
        color={zoneGroundColor(zone.kind)}
        emissive={selected ? "#7dd3fc" : hovered ? "#1e293b" : "#000000"}
        emissiveIntensity={selected ? 0.5 : hovered ? 0.6 : 0}
      />
    </mesh>
  );
}

function Buildings({
  placed, density, traits, winLit, tod,
}: {
  placed: CellPlacement[]; density: number; traits: SeatTraits; winLit: number; tod: Tod;
}) {
  const { available } = useModelAvailability();

  const groups = useMemo(() => {
    const byType = new Map<BType, BuildingInstance[]>();
    for (const { zone, cx, cz } of placed) {
      for (const spec of zoneBuildings(zone, density, traits)) {
        const sp = slotPos(spec.slot);
        const flat = FLAT_TYPES.includes(spec.type);
        const inst: BuildingInstance = {
          key: `${zone.id}:${spec.slot}:${spec.type}`,
          x: cx - PLOT / 2 + sp.x + spec.w / 2,
          z: cz - PLOT / 2 + sp.y + spec.d / 2,
          w: spec.w,
          d: spec.d,
          h: flat ? FLAT_BOX_H : Math.max(spec.h, 6),
        };
        const arr = byType.get(spec.type);
        if (arr) arr.push(inst);
        else byType.set(spec.type, [inst]);
      }
    }
    return Array.from(byType.entries());
  }, [placed, density, traits]);

  return (
    <group>
      {groups.map(([type, items]) => {
        if (type === "pond") {
          return <WaterPatches key="pond-water" items={items} groundY={GROUND_Y} tod={tod} />;
        }
        const color = BUILDING_COLOR[type];
        const variantUrls = available.get(type);
        if (!variantUrls?.length) {
          const box = <InstancedBoxes key={`${type}-box`} items={items} groundY={GROUND_Y} color={color} winLit={winLit} />;
          if (type === "sawah" || type === "field") {
            // Blades sit ON TOP of the flat ground box (still the paddy
            // floor / turf colour underneath), not instead of it.
            return (
              <group key={`${type}-group`}>
                {box}
                <Vegetation items={items} groundY={GROUND_Y + FLAT_BOX_H} type={type} />
              </group>
            );
          }
          return box;
        }
        // Split into one bucket per variant — InstancedMesh needs a single
        // geometry, so each (type, variant) pair gets its own instanced
        // mesh. pickVariantIndex is deterministic per instance key, so an
        // instance never jumps variants across re-layouts.
        const buckets = new Map<number, BuildingInstance[]>();
        for (const it of items) {
          const vi = pickVariantIndex(it.key, variantUrls.length);
          const bucket = buckets.get(vi);
          if (bucket) bucket.push(it);
          else buckets.set(vi, [it]);
        }
        return Array.from(buckets.entries()).map(([vi, vItems]) => (
          <Suspense
            key={`${type}-model-${vi}`}
            fallback={<InstancedBoxes items={vItems} groundY={GROUND_Y} color={color} winLit={winLit} />}
          >
            <InstancedModel url={variantUrls[vi]} items={vItems} groundY={GROUND_Y} fallbackColor={color} />
          </Suspense>
        ));
      })}
    </group>
  );
}

function PerfProbe({ onSample }: { onSample: (s: PerfSample) => void }) {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ frames: 0, t: performance.now(), calls: 0, tris: 0 });

  // Phase E note: once PostFX's <EffectComposer> is mounted (r3f render
  // priority 1), it becomes the thing calling gl.render() each frame —
  // possibly several times, once per internal pass (scene pass, each
  // effect pass, ...). Three resets gl.info.render at the START of every
  // individual render() call, so by default this probe would only ever
  // see the LAST pass's tiny numbers (a full-screen composite quad: 1
  // draw, ~0 triangles) instead of the frame's real cost. Fix: disable
  // autoReset once, run this probe at a HIGHER priority so it executes
  // after the composer has finished all of this frame's passes, read the
  // now-accumulated totals, then reset manually for the next frame.
  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame(() => {
    acc.current.calls += gl.info.render.calls;
    acc.current.tris += gl.info.render.triangles;
    gl.info.reset();
    acc.current.frames++;
    const now = performance.now();
    const dt = now - acc.current.t;
    if (dt >= 500) {
      onSample({
        fps: Math.round((acc.current.frames * 1000) / dt),
        calls: Math.round(acc.current.calls / acc.current.frames),
        tris: Math.round(acc.current.tris / acc.current.frames),
      });
      acc.current.frames = 0;
      acc.current.calls = 0;
      acc.current.tris = 0;
      acc.current.t = now;
    }
  }, 2); // after PostFX's EffectComposer (priority 1)
  return null;
}

function Grid({
  placed, zones, gridSize, density, traits, winLit, selectedId, onSelect, tod,
}: {
  placed: CellPlacement[]; zones: Zone[]; gridSize: number; density: number;
  traits: SeatTraits; winLit: number; selectedId: string; onSelect: (id: string) => void; tod: Tod;
}) {
  const empties = useMemo(() => emptyCells(zones, gridSize), [zones, gridSize]);
  const centre = worldCentre(gridSize);
  const span = worldSize(gridSize);
  const vRoads = useMemo(() => roadsV(gridSize).map((x) => x - centre + ROAD_W / 2), [gridSize, centre]);
  const hRoads = useMemo(() => roadsH(gridSize).map((y) => y - centre + ROAD_W / 2), [gridSize, centre]);

  return (
    <group>
      {empties.map(({ col, row, cx, cz }) => (
        <mesh key={`e${col}-${row}`} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.4, cz]}>
          <planeGeometry args={[PLOT - 16, PLOT - 16]} />
          <meshStandardMaterial color="#141b26" />
        </mesh>
      ))}
      {vRoads.map((x, i) => (
        <mesh key={`v${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.8, 0]} receiveShadow>
          <planeGeometry args={[ROAD_W, span]} />
          <meshStandardMaterial color="#1b2331" />
        </mesh>
      ))}
      {hRoads.map((z, i) => (
        <mesh key={`h${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.8, z]} receiveShadow>
          <planeGeometry args={[span, ROAD_W]} />
          <meshStandardMaterial color="#1b2331" />
        </mesh>
      ))}
      {placed.map(({ zone, cx, cz }) => (
        <ZoneTile
          key={zone.id}
          zone={zone}
          cx={cx}
          cz={cz}
          selected={zone.id === selectedId}
          onSelect={onSelect}
        />
      ))}
      <Buildings placed={placed} density={density} traits={traits} winLit={winLit} tod={tod} />
    </group>
  );
}

export function CityScene({
  zones, gridSize, density, traits, tod, weather = "clear", overall = 100,
  selectedId, onSelect, celebration, landmarkZoneId,
  camRef, movedRef, distance, hudRef, onPerf,
}: {
  zones: Zone[];
  gridSize: number;
  density: number;
  traits: SeatTraits;
  tod: Tod;
  weather?: Weather;
  overall?: number;
  selectedId: string;
  onSelect: (id: string) => void;
  celebration?: { zoneId: string; at: number } | null;
  landmarkZoneId?: string;
  camRef: MutableRefObject<CamState>;
  movedRef: MutableRefObject<boolean>;
  distance: number;
  hudRef?: MutableRefObject<HTMLDivElement | null>;
  onPerf?: (s: PerfSample) => void;
}) {
  const span = worldSize(gridSize);
  const placed = useMemo(() => placeZones(zones, gridSize), [zones, gridSize]);
  const byId = useMemo(() => {
    const m = new Map<string, CellPlacement>();
    placed.forEach((p) => m.set(p.zone.id, p));
    return m;
  }, [placed]);

  // Low overall sentiment dims the lit-city feel (CSS: data-mood="low").
  const mood = overall > 0 && overall < 54 ? 0.4 : 1;

  const landmark = landmarkZoneId ? byId.get(landmarkZoneId) : undefined;
  const celebrate = celebration ? byId.get(celebration.zoneId) : undefined;

  return (
    <>
      <CityEnvironment tod={tod} span={span} weather={weather} />
      <Grid
        placed={placed}
        zones={zones}
        gridSize={gridSize}
        density={density}
        traits={traits}
        winLit={TOD_ENV[tod].winLit * mood}
        selectedId={selectedId}
        onSelect={onSelect}
        tod={tod}
      />
      <StreetLamps gridSize={gridSize} lamp={TOD_ENV[tod].lamp * mood} />
      <Traffic gridSize={gridSize} />
      <Lrt gridSize={gridSize} />

      {landmark && (
        <ZoneBeacon position={[landmark.cx, 0, landmark.cz]} color="#7dd3fc" height={300} />
      )}
      {celebrate && celebration && (
        <ZoneBeacon
          key={celebration.at}
          position={[celebrate.cx, 0, celebrate.cz]}
          color="#facc15"
          height={240}
          celebrate
          until={celebration.at + 2600}
        />
      )}

      <CameraRig camRef={camRef} movedRef={movedRef} distance={distance} hudRef={hudRef} />
      {onPerf && <PerfProbe onSample={onPerf} />}
    </>
  );
}
