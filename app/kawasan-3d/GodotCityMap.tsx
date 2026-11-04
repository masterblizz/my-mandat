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

export const GODOT_CITY_URL = process.env.NEXT_PUBLIC_GODOT_CITY_URL ?? "/godot/kawasan-city/index.html";

export type GodotSeatProfile = { code: string; name: string; density: number; traits: SeatTraits };

export type GodotCityMapProps = {
  profile: GodotSeatProfile;
  zones: Zone[];
  selectedZoneId: string;
  /** Localised zone names shown over each lot in the city. */
  zoneNames?: Record<string, string>;
  /** Project placement mode: zone names turn gold and larger. */
  placing?: boolean;
  setSelectedZoneId: (id: string) => void;
  lang: Lang;
  height?: CSSProperties["height"];
};

export default function GodotCityMap({ profile, zones, selectedZoneId, setSelectedZoneId, lang, height = "100%", zoneNames, placing = false }: GodotCityMapProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const origin = useMemo(() => typeof window === "undefined" ? "" : new URL(GODOT_CITY_URL, window.location.href).origin, []);

  // Only the fields the city draws; projects/building lists stay page-side.
  const state = useMemo(() => ({
    profile,
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
      else if (data?.type === "kawasan-zone-click" && typeof data.id === "string") setSelectedZoneId(data.id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, setSelectedZoneId]);

  useEffect(() => {
    if (ready) send();
  }, [ready, send]);

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
      {!ready && (
        <div
          className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 border px-3 py-1.5 text-[9px] font-black tracking-[.2em] text-cyan"
          style={{ borderColor: "rgb(var(--cyan-rgb) / .4)", background: "rgb(var(--bg-rgb) / .82)", fontFamily: "'Space Mono', monospace" }}
        >
          {t(lang, "MEMUATKAN ENJIN GODOT…", "LOADING GODOT ENGINE…")}
        </div>
      )}
    </div>
  );
}
