"use client";

// Phase E: post-processing pipeline.
//
// - Bloom: day/night-aware intensity. The lit-window / street-lamp
//   emissive gates already computed per TOD (TOD_ENV.winLit / .lamp,
//   consumed by scenery.tsx/models.tsx) double as the bloom driver here —
//   daylight uses an HDR threshold to keep ordinary surfaces crisp;
//   dusk/night lower the
//   threshold and raise intensity so the same lit windows/lamps that
//   already glow via emissive materials pick up an actual bloom halo.
// - ToneMapping: ACES Filmic, replacing the plain Canvas `toneMappingExposure`
//   tweak that was the only tone control before this phase.
// - SSAO (N8AO): quality-tier gated (only at "high") — see
//   docs/webgl-migration-log.md's Phase E section for the measured
//   Dense-metro cost that led to gating it instead of shipping it
//   unconditionally, and quality.ts for the tier scaffold.

import { EffectComposer, Bloom, ToneMapping, N8AO } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { TOD_ENV, type Tod } from "./cityData";
import { QUALITY_SETTINGS, type QualityTier } from "./quality";

export function PostFX({ tod, quality }: { tod: Tod; quality: QualityTier }) {
  const env = TOD_ENV[tod];
  const settings = QUALITY_SETTINGS[quality];
  const glow = env.winLit + env.lamp; // 0 (day) .. ~1.9 (night)
  // Keep halos on luminous windows and lamps. Blooming ordinary daylight
  // surfaces washes out concrete edges and makes the city look miniature.
  const bloomIntensity = 0.08 + glow * 0.22;
  const bloomThreshold = tod === "day" ? 1.1 : 0.85;

  // EffectComposer's children type is JSX.Element | JSX.Element[] (no
  // booleans), so the SSAO gate has to be an array push rather than `&&`.
  const effects: JSX.Element[] = [
    <Bloom
      key="bloom"
      intensity={bloomIntensity}
      luminanceThreshold={bloomThreshold}
      luminanceSmoothing={0.3}
      mipmapBlur={settings.bloomMipmapBlur}
    />,
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
