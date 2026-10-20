"use client";

// Player avatars for the multiplayer city hub, rendered inside the
// <City3DMapGL> canvas. Each online player is a walking figure in their
// party colour with a floating name tag. The local player walks wherever
// they tap on the map (snapped to the nearest road) and the camera follows.

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { advance, roadPath, snapToRoad, type RoadGrid, type Vec2 } from "../lib/hubRoads";
import type { HubIdentity, HubPeer, MoveOrder } from "../lib/useWorldPresence";

const GROUND_Y = 4;            // top of the zone tiles / road surface
const WALK_SPEED = 75;         // world units per second
const TAP_MAX_MOVE_PX = 6;     // same threshold CameraRig uses to tell a tap from a drag
const TAP_MAX_MS = 1500;
const RESYNC_SNAP = 90;        // reuse our own displayed position if the sender's is this close
const SKIN = "#c89a74";

type AvatarProps = { identity: HubIdentity; order: MoveOrder | null; grid: RoadGrid; isMe?: boolean; onFrame?: (position: Vec2, destination: Vec2) => void };

const Avatar = memo(function Avatar({ identity, order, grid, isMe = false, onFrame }: AvatarProps) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null); const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null); const armR = useRef<THREE.Group>(null);
  const state = useRef<{ position: Vec2 | null; path: Vec2[]; heading: number; phase: number; destination: Vec2 | null }>({ position: null, path: [], heading: 0, phase: 0, destination: null });
  const colour = useMemo(() => new THREE.Color(identity.colour), [identity.colour]);

  // A new walk order: route from where we are showing the avatar (if close to the sender's view) to the new destination.
  useEffect(() => {
    if (!order) return;
    const s = state.current;
    const from = s.position && Math.hypot(s.position[0] - order.from[0], s.position[1] - order.from[1]) < RESYNC_SNAP ? s.position : order.from;
    s.position = from;
    s.destination = order.to;
    s.path = roadPath(grid, from, order.to);
  }, [order, grid]);

  useFrame((_, dt) => {
    const s = state.current;
    const g = group.current;
    if (!g || !s.position) return;
    const step = WALK_SPEED * Math.min(dt, 0.1);
    const moving = s.path.length > 0;
    if (moving) {
      const next = advance(s.position, s.path, step);
      s.position = next.position; s.path = next.path;
      if (next.heading !== null) s.heading = next.heading;
      s.phase += step * 0.16;
    } else {
      s.phase *= 0.85;
    }
    g.position.set(s.position[0], GROUND_Y, s.position[1]);
    if (body.current) {
      // Ease the turn so corners don't snap.
      const current = body.current.rotation.y;
      const delta = Math.atan2(Math.sin(s.heading - current), Math.cos(s.heading - current));
      body.current.rotation.y = current + delta * Math.min(1, dt * 12);
      body.current.position.y = moving ? Math.abs(Math.sin(s.phase)) * 0.9 : 0;
    }
    const swing = moving ? Math.sin(s.phase) * 0.7 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.8;
    if (armR.current) armR.current.rotation.x = swing * 0.8;
    onFrame?.(s.position, s.destination ?? s.position);
  });

  // Draw avatars on top of the city so a tower between the camera and a player never hides them.
  useEffect(() => {
    group.current?.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.renderOrder = isMe ? 12 : 10;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => { material.depthTest = false; });
    });
  }, [isMe, colour]);

  return <group ref={group}>
    {/* Ground ring keeps a player findable from a zoomed-out view. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.4, 0]}>
      <ringGeometry args={[isMe ? 12 : 9, isMe ? 16 : 12, 32]} />
      <meshBasicMaterial color={isMe ? "#f0a500" : colour} transparent opacity={0.85} depthWrite={false} />
    </mesh>
    {/* Larger than the ambient pedestrians (~10 units) so players stand out in the crowd. */}
    <group ref={body} scale={2.4}>
      {/* Limbs are wrapped in groups at the hip/shoulder so the walk swing pivots there. */}
      <group ref={legL} position={[-0.75, 4.4, 0]}><mesh position={[0, -2.2, 0]}><boxGeometry args={[0.95, 4.4, 1]} /><meshStandardMaterial color="#1f2937" /></mesh></group>
      <group ref={legR} position={[0.75, 4.4, 0]}><mesh position={[0, -2.2, 0]}><boxGeometry args={[0.95, 4.4, 1]} /><meshStandardMaterial color="#1f2937" /></mesh></group>
      <mesh position={[0, 6.2, 0]}><boxGeometry args={[2.6, 3.6, 1.5]} /><meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.25} /></mesh>
      <group ref={armL} position={[-1.65, 7.8, 0]}><mesh position={[0, -1.5, 0]}><boxGeometry args={[0.7, 3, 0.8]} /><meshStandardMaterial color={colour} /></mesh></group>
      <group ref={armR} position={[1.65, 7.8, 0]}><mesh position={[0, -1.5, 0]}><boxGeometry args={[0.7, 3, 0.8]} /><meshStandardMaterial color={colour} /></mesh></group>
      <mesh position={[0, 9.1, 0]}><sphereGeometry args={[1.05, 16, 12]} /><meshStandardMaterial color={SKIN} /></mesh>
    </group>
    <Html position={[0, 31, 0]} center zIndexRange={[isMe ? 30 : 20, 0]} style={{ pointerEvents: "none" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", padding: "2px 7px 2px 2px", borderRadius: 999,
        background: "rgba(5, 10, 18, 0.82)", border: `1px solid ${isMe ? "#f0a500" : identity.colour}`,
        color: "#f8fafc", font: "700 10px/1.2 'Space Mono', monospace", letterSpacing: "0.04em", boxShadow: "0 2px 8px rgba(0,0,0,.45)",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/avatars/${identity.avatarRef}`} alt="" width={16} height={16} style={{ width: 16, height: 16, borderRadius: 999, objectFit: "cover", objectPosition: "center 18%" }} />
        <span>{identity.name}</span>
        {identity.partyTag && <span style={{ color: identity.colour }}>· {identity.partyTag}</span>}
      </div>
    </Html>
  </group>;
});

type HubAvatarsProps = {
  grid: RoadGrid;
  me: HubIdentity;
  myOrder: MoveOrder;
  onWalk: (destination: Vec2) => void;
  myStateRef: MutableRefObject<MoveOrder | null>;
  peers: HubPeer[];
  cameraTargetRef: MutableRefObject<[number, number]>;
};

export default function HubAvatars({ grid, me, myOrder, onWalk, myStateRef, peers, cameraTargetRef }: HubAvatarsProps) {
  const { gl, camera } = useThree();

  // Tap (not drag, not pinch) on the map → walk there along the roads.
  useEffect(() => {
    const element = gl.domElement;
    const pointers = new Map<number, { x: number; y: number; at: number }>();
    let multiTouch = false;
    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);
    const hit = new THREE.Vector3();
    const down = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, at: performance.now() });
      if (pointers.size > 1) multiTouch = true;
    };
    const up = (event: PointerEvent) => {
      const start = pointers.get(event.pointerId);
      pointers.delete(event.pointerId);
      const wasMulti = multiTouch;
      if (pointers.size === 0) multiTouch = false;
      if (!start || wasMulti) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MAX_MOVE_PX || performance.now() - start.at > TAP_MAX_MS) return;
      const rect = element.getBoundingClientRect();
      const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(ground, hit)) return;
      onWalk(snapToRoad(grid, [hit.x, hit.z]));
    };
    const cancel = (event: PointerEvent) => { pointers.delete(event.pointerId); if (pointers.size === 0) multiTouch = false; };
    element.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      element.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [gl, camera, grid, onWalk]);

  const followMe = useMemo(() => (position: Vec2, destination: Vec2) => {
    // Keep the shared "where am I" up to date for heartbeats, and orbit the camera around me.
    myStateRef.current = { from: position, to: destination, at: Date.now() };
    cameraTargetRef.current = [position[0], position[1]];
  }, [myStateRef, cameraTargetRef]);

  return <group>
    <Avatar identity={me} order={myOrder} grid={grid} isMe onFrame={followMe} />
    {peers.map((peer) => peer.order && <Avatar key={peer.characterId} identity={peer} order={peer.order} grid={grid} />)}
  </group>;
}
