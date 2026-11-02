"use client";

// Custom camera controller — the WebGL equivalent of the CSS version's
// cam.rz / cam.rx / cam.zoom model in app/kawasan/page.tsx. NOT drei's
// OrbitControls: the camera pivots around a look point (the grid centre by
// default), tilt is clamped, and there is no free-fly. The look point pans
// (right / shift drag, WASD / arrows, two-finger touch) but stays inside
// the city footprint. See cityData.ts for the ported interaction constants.
//
// The CSS version needed rAF-coalesced writes because each camera change
// forced a full style recalc over its preserve-3d tree. Here the camera is
// three floats applied once per frame in useFrame, so the raw pointer /
// wheel handlers can mutate the cam ref synchronously with no coalescing.

import { useEffect, useRef, type MutableRefObject } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import {
  clampCam, DRAG_RZ_PER_PX, DRAG_RX_PER_PX, WHEEL_IN, WHEEL_OUT,
  DRAG_CLICK_SUPPRESS_PX, CAM_MIN_DISTANCE, CAM_MAX_OUT, CAM_NEAR_MIN, CAM_NEAR_K,
} from "./cityData";

export type CamState = { rz: number; rx: number; zoom: number };

const CAM_KEYS = new Set(["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright"]);

export function CameraRig({
  camRef,
  movedRef,
  distance,
  hudRef,
  targetRef,
}: {
  camRef: MutableRefObject<CamState>;
  /** Set true mid-drag so zone onClick can ignore the drag-release click. */
  movedRef: MutableRefObject<boolean>;
  /** Base framing distance for this preset. The live orbit radius is
   * `distance / cam.zoom`, clamped to [CAM_MIN_DISTANCE, distance × CAM_MAX_OUT]. */
  distance: number;
  /** Optional DOM node to receive the live `--kw3d-rz` var (compass wedge). */
  hudRef?: MutableRefObject<HTMLDivElement | null>;
  /** Optional [worldX, worldZ] the camera orbits / looks at. Defaults to
   * the grid centre (0,0); the minimap sets it to a clicked cell so the
   * view recentres there. The rig eases the actual look point toward it. */
  targetRef?: MutableRefObject<[number, number]>;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const drag = useRef<{ x: number; y: number; rz: number; rx: number; pan: boolean } | null>(null);
  const look = useRef<[number, number]>([0, 0]); // eased look point
  const ownTarget = useRef<[number, number]>([0, 0]);
  const target = targetRef ?? ownTarget;
  // Displayed camera, eased toward camRef each frame. camRef stays the
  // source of truth (HUD buttons, reset, sound all read/write it); this
  // only smooths how the lens gets there.
  const view = useRef<{ rz: number; rx: number; eff: number } | null>(null);
  const keys = useRef(new Set<string>());
  // Live orbit radius, mirrored out of useFrame so a pan can scale
  // screen pixels to world units.
  const effRef = useRef(distance);
  const panRef = useRef<(dxPx: number, dyPx: number) => void>(() => {});
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mx: number; my: number } | null>(null);

  useEffect(() => {
    const el = gl.domElement;
    const panLimit = distance * 0.5;

    // Screen-space drag -> ground-plane move of the look point. Dragging
    // the map right moves the city right, i.e. the look point left.
    panRef.current = (dxPx, dyPx) => {
      const h = el.clientHeight || 1;
      const fov = ((camera as unknown as PerspectiveCamera).fov ?? 35) * (Math.PI / 180);
      const wpp = (2 * effRef.current * Math.tan(fov / 2)) / h;
      const az = (camRef.current.rz * Math.PI) / 180;
      const po = (camRef.current.rx * Math.PI) / 180;
      // ground foreshortens with tilt: a screen-vertical pixel covers more ground
      const fwdScale = 1 / Math.max(0.35, Math.cos(po));
      const rX = Math.cos(az), rZ = -Math.sin(az); // screen-right on the ground
      const fX = -Math.sin(az), fZ = -Math.cos(az); // screen-up on the ground
      const t = target.current;
      const nx = t[0] - rX * dxPx * wpp + fX * dyPx * wpp * fwdScale;
      const nz = t[1] - rZ * dxPx * wpp + fZ * dyPx * wpp * fwdScale;
      target.current = [
        Math.max(-panLimit, Math.min(panLimit, nx)),
        Math.max(-panLimit, Math.min(panLimit, nz)),
      ];
    };
    const panBy = (dx: number, dy: number) => panRef.current(dx, dy);

    // pointerdown on the canvas, but move/up on window — same as the CSS
    // version, and avoids setPointerCapture stealing events from R3F's
    // raycaster (which needs the canvas pointerup to synthesise onClick).
    // Left drag orbits; right / middle / shift+left drag pans; two
    // touches pinch-zoom and pan together.
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
          const [a, b] = Array.from(pointers.current.values());
          pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
          drag.current = null;
          movedRef.current = true;
          return;
        }
        if (pointers.current.size > 2) return;
      } else if (e.button > 2) return;
      const pan = e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey);
      drag.current = { x: e.clientX, y: e.clientY, rz: camRef.current.rz, rx: camRef.current.rx, pan };
      movedRef.current = false;
      el.style.cursor = pan ? "move" : "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (pointers.current.has(e.pointerId)) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const p = pinch.current;
        if (p && pointers.current.size >= 2) {
          const [a, b] = Array.from(pointers.current.values());
          const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          camRef.current.zoom *= dist / p.dist;
          clampCam(camRef.current);
          panBy(mx - p.mx, my - p.my);
          pinch.current = { dist, mx, my };
          return;
        }
      }
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_CLICK_SUPPRESS_PX) movedRef.current = true;
      if (d.pan) {
        panBy(dx, dy);
        d.x = e.clientX;
        d.y = e.clientY;
        return;
      }
      // Same mapping/sensitivity as the CSS version's onMove.
      camRef.current.rz = d.rz - dx * DRAG_RZ_PER_PX;
      camRef.current.rx = d.rx + dy * DRAG_RX_PER_PX;
      clampCam(camRef.current);
    };
    const endDrag = (e: PointerEvent) => {
      if (pointers.current.delete(e.pointerId) && pointers.current.size < 2) pinch.current = null;
      if (!drag.current) return;
      drag.current = null;
      el.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camRef.current.zoom *= e.deltaY > 0 ? WHEEL_OUT : WHEEL_IN;
      clampCam(camRef.current);
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    // WASD / arrows pan, Q/E rotate — only while nothing editable has focus.
    const typing = (t: EventTarget | null) => {
      const n = t as HTMLElement | null;
      return !!n && (n.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName ?? ""));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      const k = e.key.toLowerCase();
      if (!CAM_KEYS.has(k)) return;
      keys.current.add(k);
      if (k.startsWith("arrow")) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); };
    const clearKeys = () => keys.current.clear();

    el.style.cursor = "grab";
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      el.style.cursor = "";
    };
  }, [gl, camera, camRef, movedRef, target, distance]);

  useFrame((_, dt) => {
    const cam = camera as unknown as PerspectiveCamera;
    const step = Math.min(dt, 0.05);
    // zoom is a DISTANCE multiplier — the camera physically orbits closer
    // as it rises, so close-ups get real perspective / parallax. Clamp the
    // effective radius to a street-level floor and a "don't fly to space"
    // ceiling, then write the clamp back so the ref can't run away.
    const maxD = distance * CAM_MAX_OUT;
    let eff = distance / camRef.current.zoom;
    if (eff < CAM_MIN_DISTANCE) eff = CAM_MIN_DISTANCE;
    else if (eff > maxD) eff = maxD;
    camRef.current.zoom = distance / eff;

    // keyboard: pan in screen pixels, so speed scales with the orbit
    // radius and feels the same at street level and whole-city framing
    const ks = keys.current;
    if (ks.size) {
      const px = 900 * step;
      const kx = (ks.has("d") || ks.has("arrowright") ? 1 : 0) - (ks.has("a") || ks.has("arrowleft") ? 1 : 0);
      const ky = (ks.has("s") || ks.has("arrowdown") ? 1 : 0) - (ks.has("w") || ks.has("arrowup") ? 1 : 0);
      if (kx || ky) panRef.current(-kx * px, -ky * px);
      const kr = (ks.has("e") ? 1 : 0) - (ks.has("q") ? 1 : 0);
      if (kr) { camRef.current.rz += kr * 75 * step; clampCam(camRef.current); }
    }

    // ease the displayed camera toward camRef: orbit snappy enough to
    // track a drag, zoom a touch softer so wheel notches glide
    const { rz, rx } = camRef.current;
    if (!view.current) view.current = { rz, rx, eff };
    const v = view.current;
    const kRot = 1 - Math.pow(0.00002, step);
    const kZoom = 1 - Math.pow(0.0008, step);
    let drz = rz - v.rz;
    if (drz > 180) drz -= 360; else if (drz < -180) drz += 360; // shortest arc
    v.rz = (v.rz + drz * kRot + 360) % 360;
    v.rx += (rx - v.rx) * kRot;
    v.eff = Math.exp(Math.log(v.eff) + (Math.log(eff) - Math.log(v.eff)) * kZoom);
    effRef.current = v.eff;

    // ease the orbit / look point toward the requested target (minimap
    // click re-centres the view without a jump-cut)
    const [tx, tz] = target.current;
    const k = 1 - Math.pow(0.0016, step); // ~frame-rate independent
    look.current[0] += (tx - look.current[0]) * k;
    look.current[1] += (tz - look.current[1]) * k;
    const [lx, lz] = look.current;

    const az = (v.rz * Math.PI) / 180;
    const po = (v.rx * Math.PI) / 180; // polar angle from +Y (0 = top-down)
    const s = Math.sin(po);
    camera.position.set(
      lx + Math.sin(az) * s * v.eff,
      Math.cos(po) * v.eff,
      lz + Math.cos(az) * s * v.eff,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(lx, 0, lz);
    // no post-projection scale any more — the distance IS the zoom
    let dirtyProj = false;
    if (cam.zoom !== 1) { cam.zoom = 1; dirtyProj = true; }
    // `near` tracks the live orbit radius `eff` instead of staying pinned
    // at a fixed tiny value: with `far` in the tens of thousands (needed
    // for the sky dome / background ground sheet), a fixed near of ~0.5
    // gives an 80,000:1+ ratio that starves the depth buffer of precision
    // everywhere the city's near-coplanar road/tile/building-base surfaces
    // actually sit — invisible up close, but a z-fighting "torn" mess at
    // max zoom-out. Nothing is ever close to the lens when zoomed far out,
    // so pushing `near` out with `eff` reclaims precision right where it's
    // needed at that zoom level (see farPlaneFor() in cityData.ts).
    const newNear = Math.max(CAM_NEAR_MIN, v.eff * CAM_NEAR_K);
    if (Math.abs(cam.near - newNear) > 0.05) { cam.near = newNear; dirtyProj = true; }
    if (dirtyProj) cam.updateProjectionMatrix();
    // Feed the live azimuth to the DOM compass wedge (no React re-render),
    // mirroring the CSS version's --kw-rz on .kw-scene.
    hudRef?.current?.style.setProperty("--kw3d-rz", `${v.rz}deg`);
  });

  return null;
}
