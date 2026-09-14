"use client";

// Bridges the procedural <CitySound> engine to the live scene: reads the
// camera's current effective distance every frame (the exact same
// eff = distance / zoom formula CameraRig uses, so "sound gets louder
// when you zoom in" tracks the real zoom, not an approximation of it)
// and the live trafficLevel, and pushes both into the sound engine.
// Renders nothing — a pure side-effect component, same shape as the
// other scene-dressing pieces that drive a ref off useFrame.

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import { CitySound } from "./citySound";
import type { CamState } from "./CameraRig";
import { CAM_MIN_DISTANCE, CAM_MAX_OUT } from "./cityData";

export function CitySoundController({
  enabled, camRef, distance, trafficLevel, hasLrt,
}: {
  enabled: boolean;
  camRef: MutableRefObject<CamState>;
  distance: number;
  trafficLevel: number;
  hasLrt: boolean;
}) {
  const soundRef = useRef<CitySound | null>(null);
  if (!soundRef.current) soundRef.current = new CitySound();

  useEffect(() => {
    soundRef.current?.setEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    const sound = soundRef.current;
    return () => sound?.dispose();
  }, []);

  useFrame(() => {
    if (!enabled) return;
    const maxD = distance * CAM_MAX_OUT;
    let eff = distance / camRef.current.zoom;
    if (eff < CAM_MIN_DISTANCE) eff = CAM_MIN_DISTANCE;
    else if (eff > maxD) eff = maxD;
    const span = Math.max(1, maxD - CAM_MIN_DISTANCE);
    const closeness = 1 - Math.min(1, Math.max(0, (eff - CAM_MIN_DISTANCE) / span));
    soundRef.current?.update({ closeness, trafficLevel, hasLrt });
  });

  return null;
}
