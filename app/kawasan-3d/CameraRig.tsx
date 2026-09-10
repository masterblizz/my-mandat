"use client";

// Custom camera controller — the WebGL equivalent of the CSS version's
// cam.rz / cam.rx / cam.zoom model in app/kawasan/page.tsx. NOT drei's
// OrbitControls: the camera pivots around a FIXED point (the grid centre,
// world origin here), tilt and azimuth are clamped, and there is no pan
// and no free-fly. See cityData.ts for the ported interaction constants.
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
  DRAG_CLICK_SUPPRESS_PX, CAM_MIN_DISTANCE, CAM_MAX_OUT,
} from "./cityData";

export type CamState = { rz: number; rx: number; zoom: number };

export function CameraRig({
  camRef,
  movedRef,
  distance,
  hudRef,
}: {
  camRef: MutableRefObject<CamState>;
  /** Set true mid-drag so zone onClick can ignore the drag-release click. */
  movedRef: MutableRefObject<boolean>;
  /** Base framing distance for this preset. The live orbit radius is
   * `distance / cam.zoom`, clamped to [CAM_MIN_DISTANCE, distance × CAM_MAX_OUT]. */
  distance: number;
  /** Optional DOM node to receive the live `--kw3d-rz` var (compass wedge). */
  hudRef?: MutableRefObject<HTMLDivElement | null>;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const drag = useRef<{ x: number; y: number; rz: number; rx: number } | null>(null);

  useEffect(() => {
    const el = gl.domElement;

    // pointerdown on the canvas, but move/up on window — same as the CSS
    // version, and avoids setPointerCapture stealing events from R3F's
    // raycaster (which needs the canvas pointerup to synthesise onClick).
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag.current = { x: e.clientX, y: e.clientY, rz: camRef.current.rz, rx: camRef.current.rx };
      movedRef.current = false;
      el.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_CLICK_SUPPRESS_PX) movedRef.current = true;
      // Same mapping/sensitivity as the CSS version's onMove.
      camRef.current.rz = d.rz - dx * DRAG_RZ_PER_PX;
      camRef.current.rx = d.rx + dy * DRAG_RX_PER_PX;
      clampCam(camRef.current);
    };
    const endDrag = () => {
      if (!drag.current) return;
      drag.current = null;
      el.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camRef.current.zoom *= e.deltaY > 0 ? WHEEL_OUT : WHEEL_IN;
      clampCam(camRef.current);
    };

    el.style.cursor = "grab";
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("wheel", onWheel);
      el.style.cursor = "";
    };
  }, [gl, camRef, movedRef]);

  useFrame(() => {
    const cam = camera as unknown as PerspectiveCamera;
    // zoom is a DISTANCE multiplier — the camera physically orbits closer
    // as it rises, so close-ups get real perspective / parallax. Clamp the
    // effective radius to a street-level floor and a "don't fly to space"
    // ceiling, then write the clamp back so the ref can't run away.
    const maxD = distance * CAM_MAX_OUT;
    let eff = distance / camRef.current.zoom;
    if (eff < CAM_MIN_DISTANCE) eff = CAM_MIN_DISTANCE;
    else if (eff > maxD) eff = maxD;
    camRef.current.zoom = distance / eff;

    const { rz, rx } = camRef.current;
    const az = (rz * Math.PI) / 180;
    const po = (rx * Math.PI) / 180; // polar angle from +Y (0 = top-down)
    const s = Math.sin(po);
    camera.position.set(
      Math.sin(az) * s * eff,
      Math.cos(po) * eff,
      Math.cos(az) * s * eff,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    // no post-projection scale any more — the distance IS the zoom
    if (cam.zoom !== 1) { cam.zoom = 1; cam.updateProjectionMatrix(); }
    // Feed the live azimuth to the DOM compass wedge (no React re-render),
    // mirroring the CSS version's --kw-rz on .kw-scene.
    hudRef?.current?.style.setProperty("--kw3d-rz", `${rz}deg`);
  });

  return null;
}
