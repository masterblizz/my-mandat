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
  { width: 58, points: [[0.12, -0.98], [0.08, -0.52], [0.02, -0.18], [-0.04, 0.15], [-0.08, 0.54], [-0.15, 0.98]] },
  { width: 64, points: [[-0.50, 0.96], [-0.34, 0.60], [-0.16, 0.30], [0.02, -0.02], [0.14, -0.34]] },
  { width: 70, points: [[-0.70, 0.46], [-0.35, 0.34], [0.02, 0.25], [0.36, 0.20], [0.78, 0.30], [0.98, 0.38]] },
  { width: 54, points: [[0.58, 0.96], [0.50, 0.66], [0.40, 0.36], [0.30, 0.12], [0.14, -0.34]] },
  { width: 78, points: [[0.98, -0.92], [0.78, -0.64], [0.64, -0.40], [0.54, -0.12], [0.48, 0.18], [0.46, 0.52], [0.44, 0.98]] },
  { width: 44, points: [[-0.04, -0.14], [0.20, -0.10], [0.42, -0.08], [0.68, -0.16], [0.90, -0.32]] },
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

function segmentIntersection(a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2, d: THREE.Vector2) {
  const r = b.clone().sub(a);
  const s = d.clone().sub(c);
  const cross = r.x * s.y - r.y * s.x;
  if (Math.abs(cross) < 0.001) return null;
  const q = c.clone().sub(a);
  const t = (q.x * s.y - q.y * s.x) / cross;
  const u = (q.x * r.y - q.y * r.x) / cross;
  // Avoid treating shared end-points as a separate junction. The extended
  // arterial lines still meet at the city boundary, but only real crossings
  // receive signal equipment.
  if (t < 0.08 || t > 0.92 || u < 0.08 || u > 0.92) return null;
  return a.clone().addScaledVector(r, t);
}

function roadIntersections(gridSize: number) {
  const halfSpan = (gridSize * 280 + 40) / 2;
  const intersections: THREE.Vector2[] = [];
  ROUTES.forEach((route, ri) => {
    const points = routePoints(route, halfSpan);
    ROUTES.slice(ri + 1).forEach((other) => {
      const otherPoints = routePoints(other, halfSpan);
      points.slice(0, -1).forEach((a, ai) => otherPoints.slice(0, -1).forEach((c, ci) => {
        const hit = segmentIntersection(a, points[ai + 1], c, otherPoints[ci + 1]);
        if (hit && !intersections.some((known) => known.distanceTo(hit) < 92)) intersections.push(hit);
      }));
    });
  });
  return intersections.slice(0, 10);
}

function BukitBintangTrafficLights({ intersections, night }: { intersections: THREE.Vector2[]; night: number }) {
  const active = night > 0.25;
  return <group>
    {intersections.map((at, i) => (
      <group key={`${Math.round(at.x)}-${Math.round(at.y)}`} position={[at.x, 0, at.y]}>
        {([-1, 1] as const).flatMap((x) => ([-1, 1] as const).map((z) => [x, z] as const)).map(([x, z], signal) => {
          const green = (signal + i) % 3 !== 0;
          return <group key={`${x}-${z}`} position={[x * 29, 0, z * 29]} rotation={[0, Math.atan2(z, x), 0]}>
            <mesh position={[0, 17, 0]} castShadow><boxGeometry args={[2.8, 28, 2.8]} /><meshStandardMaterial color="#28323a" roughness={0.72} metalness={0.35} /></mesh>
            <mesh position={[0, 30, 0]} castShadow><boxGeometry args={[7.5, 12, 5.5]} /><meshStandardMaterial color="#10171d" roughness={0.65} metalness={0.45} /></mesh>
            <mesh position={[0, 33.2, 2.9]}><sphereGeometry args={[1.45, 8, 8]} /><meshBasicMaterial color={green ? "#ef4444" : "#ffcf4a"} toneMapped={false} /></mesh>
            <mesh position={[0, 29.1, 2.9]}><sphereGeometry args={[1.45, 8, 8]} /><meshBasicMaterial color={green ? "#2be680" : "#9f2f2f"} toneMapped={false} transparent opacity={active ? 1 : 0.72} /></mesh>
          </group>;
        })}
      </group>
    ))}
  </group>;
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
  const intersections = useMemo(() => roadIntersections(gridSize), [gridSize]);
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
    <BukitBintangTrafficLights intersections={intersections} night={night} />
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

// Low-poly city traffic. Each part is instanced, so the moving cars read as
// actual vehicles (body, dark cabin, wheels and lamps) without one React tree
// per car or a large draw-call cost.
export function BukitBintangTraffic({ gridSize, trafficLevel = 0.55 }: { gridSize: number; trafficLevel?: number }) {
  // Bukit Bintang is the dense KL profile: keep a genuinely busy network at
  // every supported map size. All vehicle categories below remain instanced
  // meshes, so 200+ visible vehicles cost a handful of draw calls rather than
  // hundreds of React/Three objects.
  const count = Math.max(200, Math.min(260, Math.round(gridSize * 12 * Math.max(0.7, trafficLevel))));
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const cargoRef = useRef<THREE.InstancedMesh>(null);
  const riderRef = useRef<THREE.InstancedMesh>(null);
  const helmetRef = useRef<THREE.InstancedMesh>(null);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const headlightRef = useRef<THREE.InstancedMesh>(null);
  const tailLightRef = useRef<THREE.InstancedMesh>(null);
  const cars = useMemo(() => {
    const kinds = ["car", "car", "suv", "van", "car", "motorcycle", "bus", "car", "truck", "motorcycle"] as const;
    return Array.from({ length: count }, (_, i) => ({
      kind: kinds[i % kinds.length],
      route: i % ROUTES.length,
      progress: ((i * 0.173) % 1),
      speed: 0.012 + (i % 5) * 0.0025,
      lane: i % 2 ? 1 : -1,
      direction: i % 3 === 0 ? -1 : 1,
    }));
  }, [count]);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const cabin = cabinRef.current;
    if (!body || !cabin) return;
    // High-contrast KL traffic palette: blue, red and yellow stay visible
    // against the dark glass towers even from the tactical camera.
    const colours = ["#f8fafc", "#1677d2", "#e53935", "#f5c518", "#12a76d", "#ff7a18", "#8b5cf6", "#26b9d8"];
    const glassBase = new THREE.Color("#0b1724");
    cars.forEach((_, i) => {
      const paint = new THREE.Color(colours[i % colours.length]);
      body.setColorAt(i, paint);
      // Keep windows visibly glassy, but tint them with the vehicle paint so
      // buses and vans do not collapse into an all-black silhouette.
      cabin.setColorAt(i, paint.clone().lerp(glassBase, 0.58));
    });
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    if (cabin.instanceColor) cabin.instanceColor.needsUpdate = true;
  }, [cars]);
  useFrame(({ clock }) => {
    const body = bodyRef.current;
    const cabin = cabinRef.current;
    const cargo = cargoRef.current;
    const rider = riderRef.current;
    const helmet = helmetRef.current;
    const wheels = wheelRef.current;
    const headlights = headlightRef.current;
    const tailLights = tailLightRef.current;
    if (!body || !cabin || !cargo || !rider || !helmet || !wheels || !headlights || !tailLights) return;
    const halfSpan = (gridSize * 280 + 40) / 2;
    const carRoot = new THREE.Object3D();
    const part = new THREE.Object3D();
    const put = (
      mesh: THREE.InstancedMesh, index: number,
      x: number, y: number, z: number,
      sx: number, sy: number, sz: number,
    ) => {
      part.position.set(x, y, z);
      part.rotation.set(0, 0, 0);
      part.scale.set(sx, sy, sz);
      part.updateMatrix();
      part.matrix.premultiply(carRoot.matrix);
      mesh.setMatrixAt(index, part.matrix);
    };
    cars.forEach((car, i) => {
      const travel = car.progress + clock.getElapsedTime() * car.speed;
      const state = pointOnRoute(ROUTES[car.route], halfSpan, car.direction > 0 ? travel : 1 - travel);
      const heading = state.angle + (car.direction > 0 ? 0 : Math.PI);
      const side = new THREE.Vector2(-Math.sin(state.angle), Math.cos(state.angle)).multiplyScalar(car.lane * (car.kind === "motorcycle" ? 8 : 14));
      carRoot.position.set(state.point.x + side.x, 7.1, state.point.y + side.y);
      carRoot.rotation.set(0, -heading, 0);
      carRoot.scale.set(1, 1, 1);
      carRoot.updateMatrix();

      const spec = car.kind === "bus" ? { body: [26, 4.8, 8.8], cabin: [-1, 3.5, 22, 3.1, 7.9], cargo: [0, 0, 0, 0.001, 0.001, 0.001], axle: 9.2, wheelZ: 4.3 }
        : car.kind === "truck" ? { body: [9, 4.9, 8.2], cabin: [5.9, 3.7, 6.2, 3.1, 6.9], cargo: [-5.4, 1.2, 0, 14, 5.4, 8.5], axle: 8.4, wheelZ: 4.0 }
        : car.kind === "van" ? { body: [20, 4.2, 7.8], cabin: [1.4, 2.8, 14.2, 3, 6.6], cargo: [-5, 0.6, 0, 8, 2.6, 7], axle: 6.7, wheelZ: 3.7 }
        : car.kind === "suv" ? { body: [18, 3.7, 8], cabin: [-0.5, 2.8, 10.3, 2.8, 6.6], cargo: [0, 0, 0, 0.001, 0.001, 0.001], axle: 6, wheelZ: 3.8 }
        : car.kind === "motorcycle" ? { body: [8.5, 1.6, 2.8], cabin: [2.8, 1.65, 1.1, 2.7, 3.3], cargo: [0, 0, 0, 0.001, 0.001, 0.001], axle: 3.2, wheelZ: 1.4 }
        : { body: [16, 3.1, 7.4], cabin: [-0.8, 2.35, 8.8, 2.35, 6.1], cargo: [0, 0, 0, 0.001, 0.001, 0.001], axle: 5.4, wheelZ: 3.55 };
      put(body, i, 0, 0, 0, spec.body[0], spec.body[1], spec.body[2]);
      put(cabin, i, spec.cabin[0], spec.cabin[1], 0, spec.cabin[2], spec.cabin[3], spec.cabin[4]);
      put(cargo, i, spec.cargo[0], spec.cargo[1], spec.cargo[2], spec.cargo[3], spec.cargo[4], spec.cargo[5]);
      // Each motorcycle gets one rider and helmet only. For every other
      // vehicle these instances collapse to near-zero: no passenger model
      // is generated behind the rider.
      const bike = car.kind === "motorcycle";
      put(rider, i, bike ? -0.3 : 0, bike ? 3.1 : 0, 0, bike ? 2.5 : 0.001, bike ? 4.7 : 0.001, bike ? 2.25 : 0.001);
      put(helmet, i, bike ? 1.25 : 0, bike ? 6.4 : 0, 0, bike ? 2.45 : 0.001, bike ? 2.45 : 0.001, bike ? 2.45 : 0.001);
      // Four wheels for road vehicles; the close paired wheels on a bike
      // collapse visually into its two-wheel profile from the city camera.
      put(wheels, i * 4, -spec.axle, -1.45, -spec.wheelZ, 3.1, 1.55, 1.45);
      put(wheels, i * 4 + 1, -spec.axle, -1.45, spec.wheelZ, 3.1, 1.55, 1.45);
      put(wheels, i * 4 + 2, spec.axle, -1.45, -spec.wheelZ, 3.1, 1.55, 1.45);
      put(wheels, i * 4 + 3, spec.axle, -1.45, spec.wheelZ, 3.1, 1.55, 1.45);
      const nose = spec.body[0] / 2 + 0.15;
      put(headlights, i * 2, nose, 0.15, -Math.min(2.15, spec.wheelZ * 0.62), 0.8, 0.62, 1.25);
      put(headlights, i * 2 + 1, nose, 0.15, Math.min(2.15, spec.wheelZ * 0.62), 0.8, 0.62, 1.25);
      put(tailLights, i * 2, -nose, 0.15, -Math.min(2.15, spec.wheelZ * 0.62), 0.65, 0.58, 1.2);
      put(tailLights, i * 2 + 1, -nose, 0.15, Math.min(2.15, spec.wheelZ * 0.62), 0.65, 0.58, 1.2);
    });
    body.instanceMatrix.needsUpdate = true;
    cabin.instanceMatrix.needsUpdate = true;
    cargo.instanceMatrix.needsUpdate = true;
    rider.instanceMatrix.needsUpdate = true;
    helmet.instanceMatrix.needsUpdate = true;
    wheels.instanceMatrix.needsUpdate = true;
    headlights.instanceMatrix.needsUpdate = true;
    tailLights.instanceMatrix.needsUpdate = true;
  });
  return <group>
    <instancedMesh ref={bodyRef} args={[undefined, undefined, count]} castShadow frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      {/* Tactical camera views are intentionally dark. Basic material keeps
          the fleet's instance paint readable instead of turning it black. */}
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={cabinRef} args={[undefined, undefined, count]} castShadow frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={cargoRef} args={[undefined, undefined, count]} castShadow frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#bcc7cd" roughness={0.52} metalness={0.35} />
    </instancedMesh>
    <instancedMesh ref={riderRef} args={[undefined, undefined, count]} castShadow frustumCulled={false}>
      <cylinderGeometry args={[0.5, 0.62, 1, 8]} />
      <meshStandardMaterial color="#27364a" roughness={0.82} />
    </instancedMesh>
    <instancedMesh ref={helmetRef} args={[undefined, undefined, count]} castShadow frustumCulled={false}>
      <sphereGeometry args={[0.5, 10, 8]} />
      <meshStandardMaterial color="#f4f7fb" metalness={0.38} roughness={0.25} />
    </instancedMesh>
    <instancedMesh ref={wheelRef} args={[undefined, undefined, count * 4]} castShadow frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#10151a" roughness={0.9} metalness={0.06} />
    </instancedMesh>
    <instancedMesh ref={headlightRef} args={[undefined, undefined, count * 2]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#fff0af" emissive="#ffd45a" emissiveIntensity={1.1} toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={tailLightRef} args={[undefined, undefined, count * 2]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ff5b4c" emissive="#df271f" emissiveIntensity={1.25} toneMapped={false} />
    </instancedMesh>
  </group>;
}
