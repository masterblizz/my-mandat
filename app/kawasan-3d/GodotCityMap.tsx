"use client";

// Godot build of the Kawasan city (the separate KawasanGodot project:
// organic street network, LRT, skyline). Its web engine is ~40 MB, so it
// is hosted on its own and embedded in an iframe rather than bundled.
//
// Contract (window.postMessage):
//   page -> city  { type: "kawasan-state", state: { zones, selected, overlay } }
//   city -> page  { type: "kawasan-godot-ready" } once the engine is up
//                 { type: "kawasan-zone-click", id } when a zone marker is tapped
// The city only draws what it is sent; all game state stays here.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { CityOverlay, Zone } from "./cityData";
import { t, type Lang } from "../i18n/useLang";

export const GODOT_CITY_URL = process.env.NEXT_PUBLIC_GODOT_CITY_URL ?? "https://kawasan-3d-city.surge.sh/";

export type GodotCityMapProps = {
  zones: Zone[];
  selectedZoneId: string;
  setSelectedZoneId: (id: string) => void;
  overlay: CityOverlay;
  lang: Lang;
  height?: CSSProperties["height"];
};

export default function GodotCityMap({ zones, selectedZoneId, setSelectedZoneId, overlay, lang, height = "100%" }: GodotCityMapProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const origin = useMemo(() => new URL(GODOT_CITY_URL).origin, []);

  // Only the fields the city draws; projects/building lists stay page-side.
  const state = useMemo(() => ({
    zones: zones.map((z) => ({
      id: z.id, kind: z.kind, archetype: z.archetype,
      sentiment: z.sentiment, infra: z.infra, welfare: z.welfare, economy: z.economy,
      projects: z.projects.length, building: z.building?.length ?? 0,
    })),
    selected: selectedZoneId,
    overlay: overlay === "none" ? "sentiment" : overlay,
  }), [zones, selectedZoneId, overlay]);

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
      />
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
