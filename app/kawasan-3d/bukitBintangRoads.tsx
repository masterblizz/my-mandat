"use client";

// A compact, hand-composed approximation of Bukit Bintang's road structure.
// It deliberately models the district's long diagonals and curving arterials
// instead of projecting an external map tile into the game world. Coordinates
// are normalised around the playable city footprint so the pattern survives
// the 16×16 and 30×30 metro quality presets.

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { worldCentre, plotXY } from "./cityData";

type Route = { width: number; points: Array<[number, number]> };

// West/east is X; north/south is Z. Routes represent, respectively, the
// Sultan Ismail/Ampang arc, P. Ramlee, Raja Chulan, Bukit Bintang, Imbi,
// Tun Razak and the short Jalan Kia Peng/KLCC connectors.
const ROUTES: Route[] = [
  { width: 76, points: [[-0.98, -0.42], [-0.62, -0.34], [-0.28, -0.30], [0.10, -0.34], [0.52, -0.48], [0.98, -0.58]] },
  { width: 58, points: [[0.12, -0.86], [0.08, -0.52], [0.02, -0.18], [-0.04, 0.15], [-0.08, 0.54]] },
  { width: 64, points: [[-0.50, 0.96], [-0.34, 0.60], [-0.16, 0.30], [0.02, -0.02], [0.14, -0.34]] },
  { width: 70, points: [[-0.70, 0.46], [-0.35, 0.34], [0.02, 0.25], [0.36, 0.20], [0.78, 0.30], [0.98, 0.38]] },
  { width: 54, points: [[0.58, 0.96], [0.50, 0.66], [0.40, 0.36], [0.30, 0.12], [0.26, -0.22]] },
  { width: 78, points: [[0.98, -0.92], [0.78, -0.64], [0.64, -0.40], [0.54, -0.12], [0.48, 0.18], [0.46, 0.52]] },
  { width: 44, points: [[0.20, -0.10], [0.42, -0.08], [0.68, -0.16], [0.90, -0.32]] },
];

function routePoints(route: Route, halfSpan: number) {
  return route.points.map(([x, z]) => new THREE.Vector2(x * halfSpan, z * halfSpan));
}

function roadGeometry(gridSize: number) {
  const halfSpan = (gridSize * 280 + 40) / 2;
  const pos: number[] = [];
  for (const route of ROUTES) {
    const pts = routePoints(route, halfSpan);
    const offsets = pts.map((point, i) => {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      return new THREE.Vector2(-(next.y - prev.y), next.x - prev.x).normalize().multiplyScalar(route.width / 2);
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i].clone().add(offsets[i]);
      const b = pts[i].clone().sub(offsets[i]);
      const c = pts[i + 1].clone().add(offsets[i + 1]);
      const d = pts[i + 1].clone().sub(offsets[i + 1]);
      // Ground is XZ; winding faces upward.
      pos.push(a.x, 4.72, a.y, c.x, 4.72, c.y, b.x, 4.72, b.y);
      pos.push(b.x, 4.72, b.y, c.x, 4.72, c.y, d.x, 4.72, d.y);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function laneMarkingGeometry(gridSize: number) {
  const halfSpan = (gridSize * 280 + 40) / 2;
  const pos: number[] = [];
  for (const route of ROUTES) {
    const pts = routePoints(route, halfSpan);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const direction = b.clone().sub(a);
      const length = direction.length();
      direction.normalize();
      const normal = new THREE.Vector2(-direction.y, direction.x).multiplyScalar(2.2);
      // Broken centre lines: visually legible at city scale, but not a
      // continuous glowing stripe that would make the roads look toy-like.
      for (let at = 24; at < length - 12; at += 58) {
        const start = a.clone().addScaledVector(direction, at);
        const end = a.clone().addScaledVector(direction, Math.min(at + 22, length - 4));
        const p1 = start.clone().add(normal), p2 = start.clone().sub(normal);
        const p3 = end.clone().add(normal), p4 = end.clone().sub(normal);
        pos.push(p1.x, 4.79, p1.y, p3.x, 4.79, p3.y, p2.x, 4.79, p2.y);
        pos.push(p2.x, 4.79, p2.y, p3.x, 4.79, p3.y, p4.x, 4.79, p4.y);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return geometry;
}

export function bukitBintangRoadClaims(gridSize: number): Set<string> {
  const centre = worldCentre(gridSize);
  const xy = plotXY(gridSize);
  const halfSpan = (gridSize * 280 + 40) / 2;
  const claims = new Set<string>();
  for (let row = 0; row < gridSize; row++) for (let col = 0; col < gridSize; col++) {
    const p = new THREE.Vector2(xy[col] + 120 - centre, xy[row] + 120 - centre);
    const crossed = ROUTES.some((route) => {
      const pts = routePoints(route, halfSpan);
      return pts.slice(0, -1).some((a, i) => {
        const b = pts[i + 1], ab = b.clone().sub(a), ap = p.clone().sub(a);
        const t = THREE.MathUtils.clamp(ap.dot(ab) / Math.max(ab.lengthSq(), 1), 0, 1);
        // A building can fill most of its 240-unit parcel. Clear the whole
        // footprint rather than only a cell-centre dot, otherwise facades
        // visibly sit on top of a diagonal road.
        return p.distanceTo(a.clone().addScaledVector(ab, t)) < route.width * 0.5 + 126;
      });
    });
    if (crossed) claims.add(`${col},${row}`);
  }
  return claims;
}

export function bukitBintangRoadIntersects(gridSize: number, x: number, z: number, w: number, d: number): boolean {
  const halfSpan = (gridSize * 280 + 40) / 2;
  const footprintRadius = Math.hypot(w, d) * 0.5;
  const point = new THREE.Vector2(x, z);
  return ROUTES.some((route) => {
    const pts = routePoints(route, halfSpan);
    return pts.slice(0, -1).some((a, i) => {
      const b = pts[i + 1];
      const ab = b.clone().sub(a);
      const t = THREE.MathUtils.clamp(point.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1), 0, 1);
      return point.distanceTo(a.clone().addScaledVector(ab, t)) < route.width * 0.5 + footprintRadius;
    });
  });
}

export function BukitBintangRoadNetwork({ gridSize, night = 0 }: { gridSize: number; night?: number }) {
  const geometry = useMemo(() => roadGeometry(gridSize), [gridSize]);
  const markings = useMemo(() => laneMarkingGeometry(gridSize), [gridSize]);
  const span = gridSize * 280 + 40;
  return <group>
    {/* A continuous city paving bed removes the old green 40-unit grid gaps. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} receiveShadow>
      <planeGeometry args={[span, span]} />
      <meshStandardMaterial color="#2c573f" roughness={0.95} metalness={0.01} />
    </mesh>
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#53616c" roughness={night > 0.25 ? 0.35 : 0.72} metalness={night > 0.25 ? 0.16 : 0.02}
        emissive="#1b2731" emissiveIntensity={0.12 + night * 0.35} />
    </mesh>
    <mesh geometry={markings} renderOrder={2}>
      <meshBasicMaterial color="#e7eef2" toneMapped={false} transparent opacity={night > 0.25 ? 0.88 : 0.72} />
    </mesh>
  </group>;
}

function pointOnRoute(route: Route, halfSpan: number, progress: number) {
  const points = routePoints(route, halfSpan);
  const lengths = points.slice(0, -1).map((point, i) => point.distanceTo(points[i + 1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let travel = (progress % 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (travel <= lengths[i]) {
      const t = travel / Math.max(lengths[i], 1);
      const a = points[i], b = points[i + 1];
      return { point: a.clone().lerp(b, t), angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    travel -= lengths[i];
  }
  const a = points[points.length - 2], b = points[points.length - 1];
  return { point: b, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

// One instanced moving-vehicle mesh gives the custom roads obvious life
// without restoring the old grid-bound traffic system.
export function BukitBintangTraffic({ gridSize, trafficLevel = 0.55 }: { gridSize: number; trafficLevel?: number }) {
  const count = Math.max(18, Math.min(42, Math.round(gridSize * 1.15 * Math.max(0.5, trafficLevel))));
  const ref = useRef<THREE.InstancedMesh>(null);
  const cars = useMemo(() => Array.from({ length: count }, (_, i) => ({
    route: i % ROUTES.length,
    progress: ((i * 0.173) % 1),
    speed: 0.012 + (i % 5) * 0.0025,
    lane: i % 2 ? 1 : -1,
  })), [count]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const colours = ["#38bdf8", "#f8fafc", "#ef4444", "#facc15", "#22c55e", "#a855f7"];
    cars.forEach((_, i) => mesh.setColorAt(i, new THREE.Color(colours[i % colours.length])));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cars]);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const halfSpan = (gridSize * 280 + 40) / 2;
    const dummy = new THREE.Object3D();
    cars.forEach((car, i) => {
      const state = pointOnRoute(ROUTES[car.route], halfSpan, car.progress + clock.getElapsedTime() * car.speed);
      const side = new THREE.Vector2(-Math.sin(state.angle), Math.cos(state.angle)).multiplyScalar(car.lane * 14);
      dummy.position.set(state.point.x + side.x, 7.3, state.point.y + side.y);
      dummy.rotation.set(0, -state.angle, 0);
      dummy.scale.set(15, 3.2, 7.2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow frustumCulled={false}>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="#e8f1f5" vertexColors roughness={0.32} metalness={0.32} emissive="#35546a" emissiveIntensity={0.28} />
  </instancedMesh>;
}
