"use client";

// Phase E: post-processing pipeline.
//
// - Bloom: explicit day/dusk/night values keep daylight crisp and give
//   lamps a narrow halo without washing luminous windows across a façade.
// - ToneMapping: ACES Filmic with per-TOD renderer exposure. Night has
//   enough headroom to preserve lit-window colour and deep building mass.
// - SSAO (N8AO): quality-tier gated (only at "high") — see
//   docs/webgl-migration-log.md's Phase E section for the measured
//   Dense-metro cost that led to gating it instead of shipping it
//   unconditionally, and quality.ts for the tier scaffold.

import { useEffect } from "react";
import {
  EffectComposer, Bloom, BrightnessContrast, HueSaturation, ToneMapping, N8AO,
} from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import { ToneMappingMode } from "postprocessing";
import type { Tod } from "./cityData";
import { QUALITY_SETTINGS, type QualityTier } from "./quality";

export function PostFX({ tod, quality }: { tod: Tod; quality: QualityTier }) {
  const gl = useThree((state) => state.gl);
  const settings = QUALITY_SETTINGS[quality];
  const exposure = tod === "night" ? 0.82 : tod === "dusk" ? 0.9 : 1;
  // Digital-twin night needs clear light trails and data markers, not a
  // washed-out haze. Threshold stays high so only intentional emissive
  // surfaces bloom; ordinary facade texture remains crisp.
  const bloomIntensity = tod === "night" ? 0.48 : tod === "dusk" ? 0.14 : 0.05;
  const bloomThreshold = tod === "night" ? 1.22 : tod === "dusk" ? 1.05 : 1.15;
  const saturation = tod === "night" ? 0.14 : tod === "day" ? 0.045 : tod === "dusk" ? 0.02 : 0;
  const contrast = tod === "night" ? 0.1 : tod === "day" ? 0.06 : tod === "dusk" ? 0.025 : 0;
  const brightness = tod === "day" ? -0.01 : 0;

  useEffect(() => {
    gl.toneMappingExposure = exposure;
    return () => { gl.toneMappingExposure = 1.08; };
  }, [gl, exposure]);

  // EffectComposer's children type is JSX.Element | JSX.Element[] (no
  // booleans), so the SSAO gate has to be an array push rather than `&&`.
  const effects: JSX.Element[] = [
    <Bloom
      key="bloom"
      intensity={bloomIntensity}
      luminanceThreshold={bloomThreshold}
      luminanceSmoothing={0.22}
      mipmapBlur={settings.bloomMipmapBlur}
    />,
    <HueSaturation key="colour-saturation" saturation={saturation} />,
    <BrightnessContrast key="colour-contrast" brightness={brightness} contrast={contrast} />,
    <ToneMapping key="tonemap" mode={ToneMappingMode.ACES_FILMIC} />,
  ];
  if (settings.ssao) {
    effects.push(
      <N8AO
        key="ssao"
        aoRadius={36}
        intensity={1.2}
        distanceFalloff={1}
        quality="performance"
        halfRes
      />,
    );
  }

  return <EffectComposer multisampling={0}>{effects}</EffectComposer>;
}
