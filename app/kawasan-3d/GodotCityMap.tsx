"use client";

// Godot build of the Kawasan city (the separate KawasanGodot project:
// organic street network, LRT, skyline). Its web engine is ~40 MB, so it
// is hosted on its own and embedded in an iframe rather than bundled.
//
// Contract (window.postMessage):
//   page -> city  { type: "kawasan-state", state: { profile, zones, selected } }
//   city -> page  { type: "kawasan-godot-ready" } once the engine is up
//                 { type: "kawasan-zone-click", id } when the player taps a zone
// The profile (seat code, density, traits) decides what city is built:
// only Bukit Bintang gets the KL landmarks, coastal / paddy / hilly seats
// get their own landscape, and the code seeds a distinct street layout.
// The city only draws what it is sent; all game state stays here.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { SeatTraits, Zone } from "./cityData";
import { t, type Lang } from "../i18n/useLang";
import CitySkyLife from "./CitySkyLife";
import CityIntro from "./CityIntro";
import CityLoading from "./CityLoading";
import type { SeatGeo } from "../data/seatGeo";
import { resolveColor } from "../utils/color";

export type CityIntroInfo = { geo: SeatGeo; stateId: string; stateName: string; seatCode: string; seatName: string; density?: number };

export const GODOT_CITY_URL = process.env.NEXT_PUBLIC_GODOT_CITY_URL ?? "/godot/kawasan-city/index.html";

/** popDensity: approximate real people per km² (see data/seatDensity.ts). */
export type GodotSeatProfile = { code: string; name: string; density: number; popDensity?: number; partyColor?: string; partyAbbr?: string; traits: SeatTraits };

export type GodotCityMapProps = {
  profile: GodotSeatProfile;
  zones: Zone[];
  selectedZoneId: string;
  /** Localised zone names shown over each lot in the city. */
  zoneNames?: Record<string, string>;
  /** Project placement mode: zone names turn gold and larger. */
  placing?: boolean;
  /** Map → zoom → 3D intro to play over the city (null: none). */
  intro?: CityIntroInfo | null;
  onIntroDone?: () => void;
  /** true while the aerial establishing shot runs (the page hides its HUD) */
  onAerial?: (on: boolean) => void;
  setSelectedZoneId: (id: string) => void;
  lang: Lang;
  height?: CSSProperties["height"];
};

export default function GodotCityMap({ profile, zones, selectedZoneId, setSelectedZoneId, lang, height = "100%", zoneNames, placing = false, intro = null, onIntroDone, onAerial }: GodotCityMapProps) {
  // the aerial shot: Godot holds overhead then descends (camera_rig.gd,
  // INTRO_HOLD + INTRO_DESCENT = 5.2 s); the frame gets film letterbox bars
  const [aerial, setAerial] = useState<{ code: string; name: string; place: string } | null>(null);
  useEffect(() => { onAerial?.(!!aerial); }, [aerial]); // eslint-disable-line react-hooks/exhaustive-deps
  const [built, setBuilt] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const origin = useMemo(() => typeof window === "undefined" ? "" : new URL(GODOT_CITY_URL, window.location.href).origin, []);

  // Only the fields the city draws; projects/building lists stay page-side.
  const state = useMemo(() => ({
    // Godot parses only hex: resolve var(--x) party colours first
    profile: profile.partyColor ? { ...profile, partyColor: resolveColor(profile.partyColor) } : profile,
    zones: zones.map((z) => ({
      id: z.id, kind: z.kind, archetype: z.archetype, name: zoneNames?.[z.id] ?? "",
      sentiment: z.sentiment, infra: z.infra, welfare: z.welfare, economy: z.economy,
      projects: z.projects.length, building: z.building?.length ?? 0,
    })),
    selected: selectedZoneId,
    placing,
  }), [profile, zones, selectedZoneId, zoneNames, placing]);

  const send = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ type: "kawasan-state", state }, origin);
  }, [state, origin]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frameRef.current?.contentWindow) return;
      const data = e.data as { type?: string; id?: unknown } | null;
      if (data?.type === "kawasan-godot-ready") setReady(true);
      else if (data?.type === "kawasan-city-built") setBuilt(true);
      else if (data?.type === "kawasan-intro-done") setAerial(null);
      else if (data?.type === "kawasan-view") window.dispatchEvent(new CustomEvent("kawasan-view", { detail: data }));
      else if (data?.type === "kawasan-zone-click" && typeof data.id === "string") setSelectedZoneId(data.id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, setSelectedZoneId]);

  useEffect(() => {
    if (ready) send();
  }, [ready, send]);
  // mini-map zoom buttons → the 3D camera
  useEffect(() => {
    const onCam = (e: Event) => {
      const detail = (e as CustomEvent<{ zoom?: number }>).detail;
      frameRef.current?.contentWindow?.postMessage({ type: "kawasan-camera", zoom: detail?.zoom ?? 0 }, origin);
    };
    window.addEventListener("kawasan-camera", onCam);
    return () => window.removeEventListener("kawasan-camera", onCam);
  }, [origin]);
  const flyIn = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ type: "kawasan-intro" }, origin);
    if (intro) {
      setAerial({ code: intro.seatCode, name: intro.seatName, place: intro.stateName });
      // ends on Godot's kawasan-intro-done; this is only a fallback
      window.setTimeout(() => setAerial(null), 15000);
    }
  }, [origin, intro]);

  return (
    <div className="relative h-full w-full" style={{ height, background: "rgb(var(--bg-rgb))" }}>
      <iframe
        ref={frameRef}
        src={GODOT_CITY_URL}
        title={t(lang, "Bandar 3D Kawasan (Godot)", "Kawasan 3D city (Godot)")}
        className="absolute inset-0 h-full w-full border-0"
        allow="fullscreen"
        // The hosted Godot city renders a flat, over-bright daylight; grade it
        // here (its source is a separate project) so it sits with the HUD.
        style={{ filter: "brightness(0.9) contrast(1.12) saturate(1.06)" }}
      />
      {/* deepen the pale sky and darken the frame edges for depth; never takes input */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgb(96 150 214) 0%, rgb(132 178 228) 14%, rgb(184 212 240) 26%, rgb(226 238 250) 36%, rgb(255 255 255) 46%)", mixBlendMode: "multiply", opacity: 0.45 }} />
      <CitySkyLife />
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 80% 85% at 50% 48%, transparent 62%, rgb(6 14 26 / .18) 82%, rgb(6 14 26 / .42) 100%)" }} />
      {!intro && !built && <CityLoading lang={lang} engineReady={ready} built={built} compact />}
      {aerial && (
        <div aria-hidden className="city-aerial-film pointer-events-none absolute inset-0 z-[140]">
          <div className="city-aerial-film__bar city-aerial-film__bar--top" />
          <div className="city-aerial-film__bar city-aerial-film__bar--bottom" />
          <div className="city-aerial-film__title"><b>{aerial.code}</b> {aerial.name}<small>{aerial.place}</small></div>
        </div>
      )}
      {intro && <CityIntro lang={lang} geo={intro.geo} stateId={intro.stateId} stateName={intro.stateName} seatCode={intro.seatCode} seatName={intro.seatName} density={intro.density}
        ready={built} engineReady={ready} onFlyIn={flyIn} onDone={() => onIntroDone?.()} />}
    </div>
  );
}
