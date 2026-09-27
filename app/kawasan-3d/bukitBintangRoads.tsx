"use client";

// A compact, hand-composed approximation of Bukit Bintang's road structure.
// It deliberately models the district's long diagonals and curving arterials
// instead of projecting an external map tile into the game world. Coordinates
// are normalised around the playable city footprint so the pattern survives
// the 16×16 and 30×30 metro quality presets.

import { useMemo } from "react";
import * as THREE from "three";
import { worldCentre, plotXY } from "./cityData";

type Route = { width: number; points: Array<[number, number]> };

// West/east is X; north/south is Z. Routes represent, respectively, the
// Sultan Ismail/Ampang arc, P. Ramlee, Raja Chulan, Bukit Bintang, Imbi,
// Tun Razak and the short Jalan Kia Peng/KLCC connectors.
const ROUTES: Route[] = [
  { width: 92, points: [[-0.98, -0.42], [-0.62, -0.34], [-0.28, -0.30], [0.10, -0.34], [0.52, -0.48], [0.98, -0.58]] },
  { width: 72, points: [[0.12, -0.86], [0.08, -0.52], [0.02, -0.18], [-0.04, 0.15], [-0.08, 0.54]] },
  { width: 78, points: [[-0.50, 0.96], [-0.34, 0.60], [-0.16, 0.30], [0.02, -0.02], [0.14, -0.34]] },
  { width: 84, points: [[-0.70, 0.46], [-0.35, 0.34], [0.02, 0.25], [0.36, 0.20], [0.78, 0.30], [0.98, 0.38]] },
  { width: 68, points: [[0.58, 0.96], [0.50, 0.66], [0.40, 0.36], [0.30, 0.12], [0.26, -0.22]] },
  { width: 96, points: [[0.98, -0.92], [0.78, -0.64], [0.64, -0.40], [0.54, -0.12], [0.48, 0.18], [0.46, 0.52]] },
  { width: 54, points: [[0.20, -0.10], [0.42, -0.08], [0.68, -0.16], [0.90, -0.32]] },
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

export function bukitBintangRoadClaims(gridSize: number): Set<string> {
  const centre = worldCentre(gridSize);
  const xy = plotXY(gridSize);
  const halfSpan = (gridSize * 280 + 40) / 2;
  const claims = new Set<string>();
  for (let row = 0; row < gridSize; row++) for (let col = 0; col < gridSize; col++) {
    // Keep the nine curated landmark/activity parcels intact; roads bend
    // around them rather than deleting a selectable destination.
    if (col >= Math.floor(gridSize / 2) - 4 && col <= Math.floor(gridSize / 2) + 3 && row >= Math.floor(gridSize / 2) - 3 && row <= Math.floor(gridSize / 2) + 5) continue;
    const p = new THREE.Vector2(xy[col] + 120 - centre, xy[row] + 120 - centre);
    const crossed = ROUTES.some((route) => {
      const pts = routePoints(route, halfSpan);
      return pts.slice(0, -1).some((a, i) => {
        const b = pts[i + 1], ab = b.clone().sub(a), ap = p.clone().sub(a);
        const t = THREE.MathUtils.clamp(ap.dot(ab) / Math.max(ab.lengthSq(), 1), 0, 1);
        return p.distanceTo(a.clone().addScaledVector(ab, t)) < route.width * 0.58;
      });
    });
    if (crossed) claims.add(`${col},${row}`);
  }
  return claims;
}

export function BukitBintangRoadNetwork({ gridSize, night = 0 }: { gridSize: number; night?: number }) {
  const geometry = useMemo(() => roadGeometry(gridSize), [gridSize]);
  const span = gridSize * 280 + 40;
  return <group>
    {/* A continuous city paving bed removes the old green 40-unit grid gaps. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 4.1, 0]} receiveShadow>
      <planeGeometry args={[span, span]} />
      <meshStandardMaterial color="#263039" roughness={0.88} metalness={0.04} />
    </mesh>
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#53616c" roughness={night > 0.25 ? 0.35 : 0.72} metalness={night > 0.25 ? 0.16 : 0.02}
        emissive="#1b2731" emissiveIntensity={0.12 + night * 0.35} />
    </mesh>
  </group>;
}
