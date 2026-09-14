"use client";

// Overhead utility poles + sagging power lines along the roads — one of
// the most recognisable signatures of a real Malaysian streetscape, and
// conspicuously missing from an otherwise-detailed road (kerb, lamps,
// signals, crossings, but bare sky above). Poles are instanced; the
// wires are ONE merged line-segments draw regardless of pole count (a
// handful of sagged sample points per span — not physically simulated,
// just enough droop to read as a real cable, not a taut wire).

import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import { roadsV, roadsH, worldCentre, ROAD_GAP, PLOT } from "./cityData";

const ROAD_W = ROAD_GAP - PLOT;
const POLE_H = 16;
const SAG = 5.5;
const SPAN_SEGMENTS = 8;

function sagPoint(
  a: [number, number, number], b: [number, number, number], t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * SAG,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function UtilityLines({ gridSize }: { gridSize: number }) {
  const centre = worldCentre(gridSize);

  const { poles, wireGeo } = useMemo(() => {
    const xs = roadsV(gridSize).map((x) => x - centre + ROAD_W / 2);
    const zs = roadsH(gridSize).map((z) => z - centre + ROAD_W / 2);
    // opposite side of the road from the street lamps (which sit at
    // ROAD_W*0.42 — see StreetLamps in scenery.tsx), one pole per block
    // down every vertical road. Thinned out on huge grids to keep the
    // wire mesh and pole count bounded.
    const off = -ROAD_W * 0.46;
    const skip = gridSize >= 22 ? 2 : 1;

    const columns: [number, number][][] = [];
    for (let i = 0; i < xs.length; i += skip) {
      const col: [number, number][] = [];
      for (let j = 0; j < zs.length - 1; j++) col.push([xs[i] + off, (zs[j] + zs[j + 1]) / 2]);
      columns.push(col);
    }
    const poles = columns.flat();

    const positions: number[] = [];
    for (const col of columns) {
      for (let k = 0; k + 1 < col.length; k++) {
        const a: [number, number, number] = [col[k][0], POLE_H, col[k][1]];
        const b: [number, number, number] = [col[k + 1][0], POLE_H, col[k + 1][1]];
        let prev = a;
        for (let s = 1; s <= SPAN_SEGMENTS; s++) {
          const p = sagPoint(a, b, s / SPAN_SEGMENTS);
          positions.push(prev[0], prev[1], prev[2], p[0], p[1], p[2]);
          prev = p;
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return { poles, wireGeo: geo };
  }, [gridSize, centre]);

  const poleRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const pole = poleRef.current;
    const arm = armRef.current;
    if (!pole || !arm) return;
    poles.forEach(([x, z], i) => {
      dummy.position.set(x, POLE_H / 2, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pole.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, POLE_H - 1, z);
      dummy.updateMatrix();
      arm.setMatrixAt(i, dummy.matrix);
    });
    pole.instanceMatrix.needsUpdate = true;
    pole.computeBoundingSphere();
    arm.instanceMatrix.needsUpdate = true;
    arm.computeBoundingSphere();
  }, [poles, dummy]);

  useLayoutEffect(() => () => wireGeo.dispose(), [wireGeo]);

  if (!poles.length) return null;
  return (
    <group>
      <instancedMesh ref={poleRef} args={[undefined, undefined, poles.length]} key={`util-pole-${poles.length}`} castShadow>
        <cylinderGeometry args={[0.4, 0.55, POLE_H, 7]} />
        <meshStandardMaterial color="#5c5347" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={armRef} args={[undefined, undefined, poles.length]} key={`util-arm-${poles.length}`}>
        <boxGeometry args={[3.6, 0.35, 0.35]} />
        <meshStandardMaterial color="#454038" roughness={0.85} />
      </instancedMesh>
      <lineSegments geometry={wireGeo} frustumCulled={false}>
        <lineBasicMaterial color="#1c1f24" transparent opacity={0.75} />
      </lineSegments>
    </group>
  );
}
