"use client";

// Drop-in WebGL replacement for <City3DMap> in app/kawasan/page.tsx.
// IDENTICAL prop signature, so the live page's right-side panel / projects
// / manifesto (all driven off selectedZoneId) keep working untouched.
//
// Not yet wired into the live route — exercised from the /kawasan-3d
// sandbox (Scene.tsx). When cutting over: swap <City3DMap .../> for
// <City3DMapGL .../> behind a ?gl=1 + localStorage flag, load via
// dynamic(ssr:false), and keep the CSS component importable for one
// release.

import {
  useCallback, useEffect, useMemo, useRef, useState, type CSSProperties,
} from "react";
import { Canvas } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { CityScene, type PerfSample } from "./CityScene";
import { type CamState } from "./CameraRig";
import {
  CAM_DEFAULT, BTN_ZOOM_IN, BTN_ZOOM_OUT, clampCam, fitZoom,
  worldSize, assignZonePositions,
  TOD_ENV, TOD_ICON, TOD_SEQUENCE, todFromClientHour,
  type Zone, type SeatTraits, type Tod,
} from "./cityData";
import { PostFX } from "./postfx";
import { defaultQualityForGridSize } from "./quality";
import { t, type Lang } from "../i18n/useLang";

export type City3DMapGLProps = {
  zones: Zone[];
  selectedZoneId: string;
  setSelectedZoneId: (id: string) => void;
  lang: Lang;
  gridSize: number;
  density: number;
  densityLabel: string;
  traits: SeatTraits;
  celebration: { zoneId: string; at: number } | null;
  overall: number;
};

const MINIMAP_CELL = 12;

// Ported from scoreTintRGB() in app/kawasan/page.tsx — smooth red->gold->green.
const TINT_RED = [255, 68, 68] as const;
const TINT_GOLD = [240, 165, 0] as const;
const TINT_GREEN = [0, 255, 136] as const;
function scoreTint(value: number): string {
  const v = Math.max(0, Math.min(100, value));
  const [from, to, p] = v <= 54 ? [TINT_RED, TINT_GOLD, v / 54] : [TINT_GOLD, TINT_GREEN, (v - 54) / 46];
  const c = (i: number) => Math.round(from[i] + (to[i] - from[i]) * p);
  return `${c(0)},${c(1)},${c(2)}`;
}

export default function City3DMapGL({
  zones, selectedZoneId, setSelectedZoneId, lang,
  gridSize, density, densityLabel, traits, celebration, overall,
}: City3DMapGLProps) {
  const hudRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef<CamState>({ ...CAM_DEFAULT });
  const movedRef = useRef(false);

  const [tod, setTod] = useState<Tod>("day");
  useEffect(() => setTod(todFromClientHour(new Date().getHours())), []);
  const cycleTod = useCallback(
    () => setTod((c) => TOD_SEQUENCE[(TOD_SEQUENCE.indexOf(c) + 1) % TOD_SEQUENCE.length]),
    [],
  );
  const [weather, setWeather] = useState<"clear" | "rain">("clear");
  const [showPerf, setShowPerf] = useState(false);
  const [perf, setPerf] = useState<PerfSample>({ fps: 0, calls: 0, tris: 0 });

  // Narrow-container layout (embedded on a phone-width column).
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = hudRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 620));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mmCell = compact ? 8 : MINIMAP_CELL;

  const span = worldSize(gridSize);
  const distance = span * 0.95;
  const quality = defaultQualityForGridSize(gridSize);

  const applyFitZoom = useCallback(() => {
    const w = hudRef.current?.clientWidth ?? 900;
    camRef.current.zoom = fitZoom(w);
  }, []);
  useEffect(() => { applyFitZoom(); }, [applyFitZoom, gridSize]);

  const zoomBy = useCallback((f: number) => {
    camRef.current.zoom *= f;
    clampCam(camRef.current);
  }, []);
  const resetCam = useCallback(() => {
    const w = hudRef.current?.clientWidth ?? 900;
    camRef.current = { ...CAM_DEFAULT, zoom: fitZoom(w) };
  }, []);
  const onSelect = useCallback(
    (id: string) => { if (!movedRef.current) setSelectedZoneId(id); },
    [setSelectedZoneId],
  );

  const zoneByCell = useMemo(() => {
    const m = new Map<string, Zone>();
    assignZonePositions(gridSize, zones.length).forEach((p, i) => {
      if (zones[i]) m.set(`${p.col},${p.row}`, zones[i]);
    });
    return m;
  }, [gridSize, zones]);

  // zone-0 is always the Pusat Bandar flagship in makeZones() — mark it
  // with a steady landmark beacon (mirrors the CSS isPrimary beacon).
  const landmarkZoneId = zones.some((z) => z.id === "zone-0") ? "zone-0" : zones[0]?.id;
  const moodDim = overall > 0 && overall < 54;

  return (
    <div
      ref={hudRef}
      style={{
        position: "relative",
        height: "clamp(520px, 74vh, 760px)",
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid rgb(186 230 253 / 0.28)",
        background: TOD_ENV[tod].skyBottom,
        boxShadow: "0 24px 70px rgba(2, 6, 23, 0.42), inset 0 1px 0 rgba(255,255,255,0.1)",
        userSelect: "none",
        touchAction: "none",
        // consumed by the minimap compass wedge; written every frame by
        // CameraRig via hudRef.
        ["--kw3d-rz" as string]: "45deg",
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, toneMappingExposure: 1.08, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
        camera={{ position: [distance, distance, distance], fov: 35, near: 1, far: 40000 }}
        onCreated={({ camera }) => {
          applyFitZoom();
          const cam = camera as unknown as PerspectiveCamera;
          cam.zoom = camRef.current.zoom;
          cam.updateProjectionMatrix();
        }}
      >
        <CityScene
          zones={zones}
          gridSize={gridSize}
          density={density}
          traits={traits}
          tod={tod}
          weather={weather}
          overall={overall}
          selectedId={selectedZoneId}
          onSelect={onSelect}
          celebration={celebration}
          landmarkZoneId={landmarkZoneId}
          camRef={camRef}
          movedRef={movedRef}
          distance={distance}
          hudRef={hudRef}
          onPerf={showPerf ? setPerf : undefined}
          quality={quality}
        />
        <PostFX tod={tod} quality={quality} />
      </Canvas>

      {/* score legend (top-left) — hidden when the container is phone-narrow */}
      {!compact && (
        <div style={css.legend}>
          {([
            ["#22c55e", "kawasan_page.scoreLegendGood"],
            ["#f0a500", "kawasan_page.scoreLegendFair"],
            ["#ff4444", "kawasan_page.scoreLegendCritical"],
          ] as const).map(([color, key]) => (
            <div key={key} style={css.legendRow}>
              <span style={{ ...css.legendSwatch, background: color }} />
              <span>{t(lang, key)}</span>
            </div>
          ))}
        </div>
      )}

      {/* control cluster (top-right; a single wrapping row when compact) */}
      <div
        style={{ ...css.controls, ...(compact ? css.controlsCompact : null) }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Zoom in" style={compact ? css.btnSm : css.btn} onClick={() => zoomBy(BTN_ZOOM_IN)}>+</button>
        <button type="button" aria-label="Zoom out" style={compact ? css.btnSm : css.btn} onClick={() => zoomBy(BTN_ZOOM_OUT)}>−</button>
        <button type="button" aria-label="Reset camera" style={compact ? css.btnSm : css.btn} onClick={resetCam}>R</button>
        <button type="button" aria-label="Cycle time of day" style={compact ? css.btnSm : css.btnWide} onClick={cycleTod}>
          {TOD_ICON[tod]}{compact ? "" : ` ${t(lang, `kawasan_page.tod_${tod}`)}`}
        </button>
        <button type="button" aria-label="Toggle weather" style={compact ? css.btnSm : css.btnWide} onClick={() => setWeather((w) => (w === "rain" ? "clear" : "rain"))}>
          {weather === "rain" ? "🌧" : "☀"}{compact ? "" : ` ${weather === "rain" ? t(lang, "kawasan_page.rain") : t(lang, "kawasan_page.clear")}`}
        </button>
        <button type="button" aria-label="Toggle perf readout" style={compact ? css.btnSm : css.btn} onClick={() => setShowPerf((v) => !v)}>ᐧ</button>
      </div>

      {/* scene label + perf (bottom-left) */}
      <div style={css.footL}>
        <span style={css.label}>{densityLabel}</span>
        {showPerf && (
          <span style={css.perf}>{perf.fps} fps · {perf.calls} draws · {(perf.tris / 1000).toFixed(1)}k tris</span>
        )}
      </div>

      {/* hint (bottom, centred) — dropped on phone-narrow to avoid clutter */}
      {!compact && (
        <div style={css.hint}>
          {t(lang, "kawasan_page.dragRotateMap")} / {t(lang, "kawasan_page.scrollZoom")} · {t(lang, "kawasan_page.clickAZoneToPickA")}
          {moodDim ? " · ⚠" : ""}
        </div>
      )}

      {/* minimap (bottom-right) */}
      <div style={{ ...css.minimap, ...(compact ? { bottom: 30, padding: 4 } : null) }}>
        {!compact && <div style={css.minimapTitle}>{t(lang, "kawasan_page.map")}</div>}
        <div style={{ position: "relative", width: gridSize * mmCell, height: gridSize * mmCell }}>
          {Array.from({ length: gridSize * gridSize }, (_, index) => {
            const col = index % gridSize;
            const row = Math.floor(index / gridSize);
            const zone = zoneByCell.get(`${col},${row}`);
            const isSel = !!zone && zone.id === selectedZoneId;
            return (
              <div
                key={`mm-${col}-${row}`}
                onClick={zone ? () => setSelectedZoneId(zone.id) : undefined}
                style={{
                  position: "absolute",
                  left: col * mmCell,
                  top: row * mmCell,
                  width: mmCell - 1,
                  height: mmCell - 1,
                  background: zone ? `rgba(${scoreTint(zone.sentiment)},0.85)` : "rgba(148,163,184,0.12)",
                  outline: isSel ? "1px solid #facc15" : undefined,
                  cursor: zone ? "pointer" : undefined,
                }}
              />
            );
          })}
          <div
            style={{
              position: "absolute", left: "50%", top: "50%", width: 0, height: 0,
              transform: "translate(-50%,-50%) rotate(var(--kw3d-rz, 45deg))",
              pointerEvents: "none",
            }}
          >
            <div style={{
              width: 0, height: 0, marginTop: -gridSize * mmCell * 0.5,
              borderLeft: "3.5px solid transparent", borderRight: "3.5px solid transparent",
              borderBottom: "8px solid #facc15", filter: "drop-shadow(0 0 2px rgba(250,204,21,0.8))",
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const ctrlBox: CSSProperties = {
  borderWidth: 1, borderStyle: "solid", borderColor: "rgba(186,230,253,0.36)",
  background: "rgba(5,12,23,0.74)", color: "#e0f2fe",
  backdropFilter: "blur(10px)", boxShadow: "0 6px 16px rgba(2,6,23,0.2)",
};
const css: Record<string, CSSProperties> = {
  legend: { position: "absolute", left: 12, top: 12, display: "flex", flexDirection: "column", gap: 3, font: "700 9px system-ui, sans-serif", letterSpacing: "0.12em", color: "rgba(148,163,184,0.95)", pointerEvents: "none" },
  legendRow: { display: "flex", alignItems: "center", gap: 5 },
  legendSwatch: { display: "block", width: 14, height: 6 },
  controls: { position: "absolute", right: 12, top: 12, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" },
  controlsCompact: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", left: 8, right: 8, maxWidth: "none" },
  btn: { ...ctrlBox, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", font: "900 13px system-ui, sans-serif", cursor: "pointer" },
  btnSm: { ...ctrlBox, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", font: "900 12px system-ui, sans-serif", cursor: "pointer" },
  btnWide: { ...ctrlBox, padding: "6px 8px", font: "900 9px system-ui, sans-serif", letterSpacing: "0.14em", cursor: "pointer" },
  footL: { position: "absolute", left: 12, bottom: 10, display: "flex", flexDirection: "column", gap: 4, pointerEvents: "none" },
  label: { font: "900 9px system-ui, sans-serif", letterSpacing: "0.16em", color: "#7dd3fc", background: "rgba(3,8,15,0.8)", padding: "3px 7px", borderRadius: 3, alignSelf: "flex-start" },
  perf: { font: "12px ui-monospace, monospace", color: "#7dd3fc", background: "rgba(3,8,15,0.8)", padding: "3px 7px", borderRadius: 3, alignSelf: "flex-start" },
  hint: { position: "absolute", left: 12, right: 12, bottom: 10, textAlign: "center", font: "700 9px system-ui, sans-serif", letterSpacing: "0.18em", color: "rgba(148,163,184,0.95)", pointerEvents: "none" },
  minimap: { position: "absolute", right: 12, bottom: 44, padding: 6, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(125,211,252,0.3)", background: "rgba(3,8,15,0.8)" },
  minimapTitle: { marginBottom: 4, textAlign: "center", font: "900 7px system-ui, sans-serif", letterSpacing: "0.2em", color: "#7dd3fc" },
};
