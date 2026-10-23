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
  useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode,
} from "react";
import { Canvas } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import * as THREE from "three";
import { CityScene, type CityAlert, type PerfSample } from "./CityScene";
import { type CamState } from "./CameraRig";
import {
  CAM_DEFAULT, BTN_ZOOM_IN, BTN_ZOOM_OUT, clampCam, fitZoom, farPlaneFor,
  worldSize, assignZonePositions, plotXY, PLOT, worldCentre,
  TOD_ENV, TOD_ICON, TOD_SEQUENCE, todFromClientHour, trafficProfile,
  CITY_OVERLAYS, scoreTintRGB,
  type Zone, type SeatTraits, type Tod, type CityOverlay,
} from "./cityData";
import { PostFX } from "./postfx";
import { activeFestivals, malaysiaDateKey } from "./festivals";
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
  focusZoneId?: string | null;
  onEnterFocusedZone?: (id: string) => void;
  /** Lets the city own the whole game viewport instead of behaving like a widget. */
  height?: CSSProperties["height"];
  /** Named buildings that can be entered directly from a floating 3D tag. */
  destinationTags?: Record<string, { label: string; destinationId: string; originLabel?: string }>;
  /** Activity Locations panel deliberately reveals every label; otherwise the map stays decluttered. */
  showAllDestinationTags?: boolean;
  onEnterDestination?: (destinationId: string, originLabel?: string) => void;
  /** Extra 3D content rendered inside the city canvas (e.g. multiplayer avatars). */
  children?: ReactNode;
  /** Externally driven camera look point [worldX, worldZ]; lets a host make the camera follow something. */
  cameraTargetRef?: MutableRefObject<[number, number]>;
  /** Start the camera at this orbit distance (world units) instead of the whole-city framing. */
  initialCameraDistance?: number;
  /** Start the camera at this pitch (degrees from straight down; clamped like a drag). */
  initialCameraPitch?: number;
  /** Stat overlay (controlled). Omit both to let the map own it via its ▦ button. */
  overlay?: CityOverlay;
  onOverlayChange?: (overlay: CityOverlay) => void;
  /** Recentre the camera on a zone without the focus/enter semantics of focusZoneId. */
  panToZone?: { id: string; at: number } | null;
  /** Complaints pinned over zones (zone id -> marker). */
  alerts?: Record<string, CityAlert>;
};

const OVERLAY_LABEL: Record<CityOverlay, [string, string]> = {
  none: ["TIADA", "OFF"],
  sentiment: ["SENTIMEN", "SENTIMENT"],
  infra: ["INFRA", "INFRA"],
  welfare: ["RAKYAT", "WELFARE"],
  economy: ["EKONOMI", "ECONOMY"],
};


type TrafficMode = "auto" | "peak" | "normal" | "light";
const TRAFFIC_MODES: TrafficMode[] = ["auto", "peak", "normal", "light"];
const TRAFFIC_FIXED: Record<Exclude<TrafficMode, "auto">, number> = { peak: 1, normal: 0.5, light: 0.12 };

function scoreTint(value: number): string {
  return scoreTintRGB(value).join(",");
}

export default function City3DMapGL({
  zones, selectedZoneId, setSelectedZoneId, lang,
  gridSize, density, densityLabel, traits, celebration, overall, focusZoneId, onEnterFocusedZone, height, destinationTags, showAllDestinationTags = false, onEnterDestination,
  children, cameraTargetRef, initialCameraDistance, initialCameraPitch, overlay: overlayProp, onOverlayChange, panToZone, alerts,
}: City3DMapGLProps) {
  const [ownOverlay, setOwnOverlay] = useState<CityOverlay>("none");
  const overlay = overlayProp ?? ownOverlay;
  const cycleOverlay = useCallback(() => {
    const next = CITY_OVERLAYS[(CITY_OVERLAYS.indexOf(overlay) + 1) % CITY_OVERLAYS.length];
    if (onOverlayChange) onOverlayChange(next); else setOwnOverlay(next);
  }, [overlay, onOverlayChange]);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef<CamState>(clampCam({ ...CAM_DEFAULT, rx: initialCameraPitch ?? CAM_DEFAULT.rx }));
  const movedRef = useRef(false);

  // The city follows the player's local clock by default. This keeps the
  // tactical map honest: a morning visit is daylight, after sunset it is
  // dusk/night. Initialising with a stable value avoids an SSR mismatch;
  // the effect synchronises immediately on the client.
  const [tod, setTod] = useState<Tod>("day");
  const [timeMode, setTimeMode] = useState<"auto" | "manual">("auto");
  useEffect(() => {
    if (timeMode !== "auto") return;
    const sync = () => setTod(todFromClientHour(new Date().getHours()));
    sync();
    const timer = window.setInterval(sync, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [timeMode]);
  const cycleTod = useCallback(
    () => {
      setTimeMode("manual");
      setTod((c) => TOD_SEQUENCE[(TOD_SEQUENCE.indexOf(c) + 1) % TOD_SEQUENCE.length]);
    },
    [],
  );
  const [weather, setWeather] = useState<"clear" | "rain">("clear");
  // Real Malaysia date, independent of the game's turn and visual day/night.
  // Refresh after midnight and when returning to a suspended browser tab.
  const [festivalDate, setFestivalDate] = useState("");
  useEffect(() => {
    const refresh = () => setFestivalDate(malaysiaDateKey(new Date()));
    refresh();
    const timer = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const festivals = useMemo(() => activeFestivals(festivalDate), [festivalDate]);
  const [showPerf, setShowPerf] = useState(false);
  // Procedural traffic/LRT/ambient soundscape (citySound.ts) — on by
  // default so the city reads as alive (horns, LRT rumble, traffic) as
  // soon as the map loads, instead of relying on the player to find the
  // 🔊 button. citySound.ts arms its own first-gesture listener to
  // satisfy the browser autoplay policy, same pattern as AmbientMusic.
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [perf, setPerf] = useState<PerfSample>({ fps: 0, calls: 0, tris: 0 });
  const [hintVisible, setHintVisible] = useState(true);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const noteMapInteraction = useCallback(() => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHintVisible(false), 6000);
  }, []);
  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current); }, []);

  // Traffic density. "auto" tracks the real system clock (weekday rush
  // spikes / weekend gentle); the other modes pin it for demos. Kept
  // fully independent of the day/night visual toggle above.
  const [trafficMode, setTrafficMode] = useState<TrafficMode>("auto");
  const [autoLevel, setAutoLevel] = useState(() => trafficProfile(new Date()));
  useEffect(() => {
    const id = setInterval(() => setAutoLevel(trafficProfile(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);
  const trafficLevel = trafficMode === "auto" ? autoLevel : TRAFFIC_FIXED[trafficMode];
  const cycleTraffic = useCallback(
    () => setTrafficMode((m) => TRAFFIC_MODES[(TRAFFIC_MODES.indexOf(m) + 1) % TRAFFIC_MODES.length]),
    [],
  );
  const trafficWord =
    trafficMode !== "auto" ? trafficMode.toUpperCase()
      : trafficLevel >= 0.8 ? "PEAK" : trafficLevel >= 0.55 ? "BUSY" : trafficLevel >= 0.3 ? "NORMAL" : "LIGHT";
  const isPeakNow = trafficMode === "auto" && autoLevel >= 0.8;

  // Narrow-container layout (embedded on a phone-width column).
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = hudRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 620));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Minimap: a compact fixed-size thumbnail by default (it used to be
  // `gridSize × 12` px, i.e. 360 px on a 30×30 grid). The ⤢ button blows
  // it up to a larger inspection overlay; ✕ or a click on the backdrop
  // collapses it.
  const [mapExpanded, setMapExpanded] = useState(false);
  const mmPx = mapExpanded ? 300 : compact ? 62 : 100;
  const mmCell = Math.max(2, Math.floor(mmPx / gridSize));
  const mmGridPx = mmCell * gridSize;

  const span = worldSize(gridSize);
  // Base framing distance at zoom = 1 (≈ the old default view). The live
  // orbit radius is distance / cam.zoom, clamped in CameraRig down to a
  // fixed street-level floor (CAM_MIN_DISTANCE) — so every preset, Dense
  // Metro included, can zoom all the way in to building detail.
  const distance = span * 1.0;
  const quality = defaultQualityForGridSize(gridSize);

  const applyFitZoom = useCallback(() => {
    if (initialCameraDistance) { camRef.current.zoom = distance / initialCameraDistance; return; }
    const w = hudRef.current?.clientWidth ?? 900;
    camRef.current.zoom = fitZoom(w);
  }, [initialCameraDistance, distance]);
  useEffect(() => { applyFitZoom(); }, [applyFitZoom, gridSize]);

  const zoomBy = useCallback((f: number) => {
    camRef.current.zoom *= f;
    clampCam(camRef.current);
  }, []);
  // [worldX, worldZ] the camera orbits / looks at — the minimap sets it.
  const ownCamTargetRef = useRef<[number, number]>([0, 0]);
  const camTargetRef = cameraTargetRef ?? ownCamTargetRef;
  const resetCam = useCallback(() => {
    const w = hudRef.current?.clientWidth ?? 900;
    camRef.current = clampCam({ ...CAM_DEFAULT, rx: initialCameraPitch ?? CAM_DEFAULT.rx, zoom: initialCameraDistance ? distance / initialCameraDistance : fitZoom(w) });
    camTargetRef.current = [0, 0];
  }, [camTargetRef, initialCameraDistance, initialCameraPitch, distance]);
  // Recentre the 3D view on a grid cell (minimap click / building click).
  // Same world-space formula as placeZones() in cityData.ts.
  const panToCell = useCallback((col: number, row: number) => {
    const XY = plotXY(gridSize);
    const c = worldCentre(gridSize);
    camTargetRef.current = [XY[col] + PLOT / 2 - c, XY[row] + PLOT / 2 - c];
  }, [gridSize, camTargetRef]);

  const zoneByCell = useMemo(() => {
    const m = new Map<string, Zone>();
    assignZonePositions(gridSize, zones.length, zones, traits).forEach((p, i) => {
      if (zones[i]) m.set(`${p.col},${p.row}`, zones[i]);
    });
    return m;
  }, [gridSize, zones, traits]);

  // Reverse lookup (zone id -> grid cell) so clicking a building's plot in
  // the 3D scene itself recentres the camera on it, the same way a minimap
  // click already does — not just picking the zone for the side panel.
  const cellByZoneId = useMemo(() => {
    const m = new Map<string, { col: number; row: number }>();
    assignZonePositions(gridSize, zones.length, zones, traits).forEach((p, i) => {
      if (zones[i]) m.set(zones[i].id, p);
    });
    return m;
  }, [gridSize, zones, traits]);

  const onSelect = useCallback(
    (id: string) => {
      if (movedRef.current) return;
      if (id === focusZoneId && onEnterFocusedZone) {
        onEnterFocusedZone(id);
        return;
      }
      setSelectedZoneId(id);
      const cell = cellByZoneId.get(id);
      if (cell) panToCell(cell.col, cell.row);
    },
    [setSelectedZoneId, cellByZoneId, panToCell, focusZoneId, onEnterFocusedZone],
  );

  // City destination cards request a cinematic focus before the player
  // enters a building. This keeps the route grounded in a physical place.
  useEffect(() => {
    if (!focusZoneId) return;
    const cell = cellByZoneId.get(focusZoneId);
    if (!cell) return;
    panToCell(cell.col, cell.row);
    camRef.current.zoom = Math.max(camRef.current.zoom, 2.15);
    clampCam(camRef.current);
  }, [focusZoneId, cellByZoneId, panToCell]);

  useEffect(() => {
    if (!panToZone) return;
    const cell = cellByZoneId.get(panToZone.id);
    if (cell) panToCell(cell.col, cell.row);
  }, [panToZone, cellByZoneId, panToCell]);

  // zone-0 is always the Pusat Bandar flagship in makeZones() — mark it
  // with a steady landmark beacon (mirrors the CSS isPrimary beacon).
  const landmarkZoneId = zones.some((z) => z.id === "zone-0") ? "zone-0" : zones[0]?.id;
  const moodDim = overall > 0 && overall < 54;

  return (
    <div
      className="city3d-map"
      ref={hudRef}
      onPointerDown={noteMapInteraction}
      onWheel={noteMapInteraction}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientY >= rect.bottom - 56) setHintVisible(true);
      }}
      style={{
        position: "relative",
        height: height ?? "clamp(520px, 74vh, 760px)",
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
      {/* Phone-size canvases use a lower pixel density and no shadows to
          keep pan/zoom responsive on mid-range devices. */}
      <Canvas
        shadows={!compact}
        dpr={compact ? [1, 1.25] : [1, 2]}
        gl={{ antialias: true, toneMappingExposure: 1.08, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
        camera={{ position: [distance, distance, distance], fov: 35, near: 0.5, far: farPlaneFor(span) }}
        onCreated={({ camera, gl }) => {
          // Keep albedo textures and the procedural facade canvases in the
          // same display space.  r186 is stricter about colour management;
          // explicitly selecting sRGB prevents the pale concrete and glass
          // materials from collapsing into the dark blue, game-like mass
          // visible under a high city camera.
          gl.outputColorSpace = THREE.SRGBColorSpace;
          // Soft PCF filtering gives towers a grounded contact shadow rather
          // than the hard, miniature-looking shadow edge of the default map.
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
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
          trafficLevel={trafficLevel}
          camTargetRef={camTargetRef}
          soundEnabled={soundEnabled}
          festivals={festivals}
          lang={lang}
          destinationTags={destinationTags}
          showAllDestinationTags={showAllDestinationTags}
          onEnterDestination={onEnterDestination}
          overlay={overlay}
          alerts={alerts}
        />
        {children}
        <PostFX tod={tod} quality={quality} />
      </Canvas>

      {/* score legend (top-left) — hidden when the container is phone-narrow */}
      {overlay !== "none" ? (
        <div style={{ ...css.legend, ...css.overlayLegend, ...(compact ? { top: 50, left: 8, width: 92 } : null) }}>
          <span style={{ color: "#facc15" }}>▦ {t(lang, "LAPISAN", "OVERLAY")} · {t(lang, ...OVERLAY_LABEL[overlay])}</span>
          <span style={css.overlayRamp} />
          <span style={{ display: "flex", justifyContent: "space-between" }}><span>0</span><span>54</span><span>100</span></span>
        </div>
      ) : !compact && (
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
        className="city3d-controls"
        style={{ ...css.controls, ...(compact ? css.controlsCompact : null) }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Zoom in" style={compact ? css.btnSm : css.btn} onClick={() => zoomBy(BTN_ZOOM_IN)}>+</button>
        <button type="button" aria-label="Zoom out" style={compact ? css.btnSm : css.btn} onClick={() => zoomBy(BTN_ZOOM_OUT)}>−</button>
        <button type="button" aria-label="Reset camera" style={compact ? css.btnSm : css.btn} onClick={resetCam}>R</button>
        <button type="button" aria-label={timeMode === "auto" ? "City time follows local clock" : "Cycle time of day"} style={compact ? css.btnSm : css.btnWide} onClick={cycleTod}>
          {TOD_ICON[tod]}{compact ? "" : ` ${t(lang, `kawasan_page.tod_${tod}`)}${timeMode === "auto" ? " · AUTO" : ""}`}
        </button>
        <button type="button" aria-label="Toggle weather" style={compact ? css.btnSm : css.btnWide} onClick={() => setWeather((w) => (w === "rain" ? "clear" : "rain"))}>
          {weather === "rain" ? "🌧" : "☀"}{compact ? "" : ` ${weather === "rain" ? t(lang, "kawasan_page.rain") : t(lang, "kawasan_page.clear")}`}
        </button>
        <button type="button" aria-label="Cycle traffic density" style={compact ? css.btnSm : css.btnWide} onClick={cycleTraffic}>
          🚗{compact ? "" : ` ${trafficMode === "auto" ? `AUTO·${trafficWord}` : trafficWord}`}
        </button>
        <button type="button" aria-label={t(lang, "Tukar lapisan data", "Cycle data overlay")} aria-pressed={overlay !== "none"} style={{ ...(compact ? css.btnSm : css.btnWide), ...(overlay !== "none" ? css.btnActive : null) }} onClick={cycleOverlay}>
          ▦{compact ? "" : ` ${t(lang, ...OVERLAY_LABEL[overlay])}`}
        </button>
        <button type="button" aria-label="Toggle city sound" style={compact ? css.btnSm : css.btn} onClick={() => setSoundEnabled((v) => !v)}>
          {soundEnabled ? "🔊" : "🔇"}
        </button>
        <button type="button" aria-label="Toggle perf readout" style={compact ? css.btnSm : css.btn} onClick={() => setShowPerf((v) => !v)}>ᐧ</button>
      </div>

      {/* scene label + perf (bottom-left) */}
      <div style={css.footL}>
        {festivals.length > 0 && <span style={{ ...css.label, color: "#ffe3a0", maxWidth: compact ? 150 : 320,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={`${t(lang, "Tarikh Malaysia", "Malaysia date")}: ${festivalDate} · ${festivals.map(f => lang === "ms" ? f.ms : f.en).join(" / ")} · ${t(lang, "Hiasan: 7 hari sebelum hingga 2 hari selepas", "Decorations: 7 days before through 2 days after")}`}>
          {festivals.map(f => lang === "ms" ? f.ms : f.en).join(" / ")}
        </span>}
        <span style={css.label}>{densityLabel}</span>
        {isPeakNow && (
          <span style={css.peakTag}>{t(lang, "Waktu Puncak Trafik", "Peak Hour Traffic")}</span>
        )}
        {showPerf && (
          <span style={css.perf}>{perf.fps} fps · {perf.calls} draws · {(perf.tris / 1000).toFixed(1)}k tris</span>
        )}
      </div>

      {/* hint (bottom, centred) — dropped on phone-narrow to avoid clutter */}
      {!compact && (
        <div style={{ ...css.hint, opacity: hintVisible ? 1 : 0, transition: "opacity 260ms ease" }}>
          {t(lang, "kawasan_page.dragRotateMap")} / {t(lang, "kawasan_page.scrollZoom")} · {t(lang, "kawasan_page.clickAZoneToPickA")}
          {moodDim ? " · ⚠" : ""}
        </div>
      )}

      {/* click-away backdrop for the expanded minimap */}
      {mapExpanded && (
        <div
          onClick={() => setMapExpanded(false)}
          style={{ position: "absolute", inset: 0, background: "rgba(3,8,15,0.3)", zIndex: 4 }}
        />
      )}

      {/* minimap (bottom-right) — compact thumbnail, ⤢ to enlarge */}
      <div
        className="city3d-minimap"
        style={{
          ...css.minimap,
          zIndex: 5,
          ...(mapExpanded ? { padding: 10 } : compact ? { bottom: 30, padding: 4 } : null),
        }}
      >
        {(() => {
          const showTitle = mapExpanded || !compact;
          return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: showTitle ? "space-between" : "flex-end", gap: 6, marginBottom: showTitle ? 4 : 2 }}>
              {showTitle && <span style={css.minimapTitle}>{t(lang, "kawasan_page.map")}</span>}
              <button
                type="button"
                aria-label={mapExpanded ? "Collapse map" : "Expand map"}
                onClick={(e) => { e.stopPropagation(); setMapExpanded((v) => !v); }}
                style={css.mmToggle}
              >
                {mapExpanded ? "✕" : "⤢"}
              </button>
            </div>
          );
        })()}
        <div style={{ position: "relative", width: mmGridPx, height: mmGridPx, background: "#07131f", boxShadow: "inset 0 0 0 1px rgba(125,211,252,.18)" }}>
          {/* Major road grid sits below the zone tiles so the map reads as a city plan, not a dot matrix. */}
          {Array.from({ length: gridSize + 1 }, (_, i) => <div key={`road-v-${i}`} style={{ position: "absolute", left: i * mmCell - 1, top: 0, width: 2, height: mmGridPx, background: "rgba(100,160,190,.4)", pointerEvents: "none" }} />)}
          {Array.from({ length: gridSize + 1 }, (_, i) => <div key={`road-h-${i}`} style={{ position: "absolute", left: 0, top: i * mmCell - 1, width: mmGridPx, height: 2, background: "rgba(100,160,190,.4)", pointerEvents: "none" }} />)}
          {Array.from({ length: gridSize * gridSize }, (_, index) => {
            const col = index % gridSize;
            const row = Math.floor(index / gridSize);
            const zone = zoneByCell.get(`${col},${row}`);
            const isSel = !!zone && zone.id === selectedZoneId;
            return (
              <div
                key={`mm-${col}-${row}`}
                onClick={() => { panToCell(col, row); if (zone) setSelectedZoneId(zone.id); }}
                style={{
                  position: "absolute",
                  left: col * mmCell,
                  top: row * mmCell,
                  width: Math.max(1, mmCell - 1),
                  height: Math.max(1, mmCell - 1),
                  background: zone ? `rgba(${scoreTint(zone.sentiment)},0.85)` : "rgba(148,163,184,0.12)",
                  border: isSel ? `${mapExpanded ? 2 : 1}px solid #facc15` : "1px solid rgba(3,8,15,.35)",
                  boxShadow: isSel ? "0 0 8px rgba(34,211,238,.85)" : undefined,
                  cursor: "pointer",
                }}
              />
            );
          })}
          {Object.entries(destinationTags ?? {}).map(([zoneId, tag]) => {
            const cell = cellByZoneId.get(zoneId);
            if (!cell) return null;
            return <span key={`mm-destination-${zoneId}`} title={tag.label} style={{ position: "absolute", left: cell.col * mmCell + mmCell / 2 - 2, top: cell.row * mmCell + mmCell / 2 - 2, width: 4, height: 4, borderRadius: "50%", background: "#22d3ee", boxShadow: "0 0 4px #22d3ee", pointerEvents: "none" }} />;
          })}
          <div
            style={{
              position: "absolute", left: "50%", top: "50%", width: 0, height: 0,
              transform: "translate(-50%,-50%) rotate(var(--kw3d-rz, 45deg))",
              pointerEvents: "none",
            }}
          >
            <div style={{
              width: 0, height: 0, marginTop: -mmGridPx * 0.5,
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
  overlayLegend: { width: 150, padding: "6px 8px", background: "rgba(3,8,15,0.86)", border: "1px solid rgba(250,204,21,0.45)", color: "#cbd5e1" },
  overlayRamp: { display: "block", height: 6, background: "linear-gradient(90deg, rgb(255,68,68), rgb(240,165,0) 54%, rgb(0,255,136))" },
  btnActive: { borderColor: "rgba(250,204,21,0.8)", color: "#facc15", boxShadow: "0 0 12px rgba(250,204,21,0.25)" },
  legendRow: { display: "flex", alignItems: "center", gap: 5 },
  legendSwatch: { display: "block", width: 14, height: 6 },
  controls: { position: "absolute", right: 12, top: 12, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" },
  controlsCompact: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", left: 8, right: 8, maxWidth: "none" },
  btn: { ...ctrlBox, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", font: "900 13px system-ui, sans-serif", cursor: "pointer" },
  btnSm: { ...ctrlBox, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", font: "900 12px system-ui, sans-serif", cursor: "pointer" },
  btnWide: { ...ctrlBox, padding: "6px 8px", font: "900 9px system-ui, sans-serif", letterSpacing: "0.14em", cursor: "pointer" },
  footL: { position: "absolute", left: 12, bottom: 10, display: "flex", flexDirection: "column", gap: 4, pointerEvents: "none" },
  label: { font: "900 9px system-ui, sans-serif", letterSpacing: "0.16em", color: "#7dd3fc", background: "rgba(3,8,15,0.8)", padding: "3px 7px", borderRadius: 3, alignSelf: "flex-start" },
  peakTag: { font: "900 9px system-ui, sans-serif", letterSpacing: "0.16em", color: "#fca5a5", background: "rgba(60,10,10,0.82)", border: "1px solid rgba(248,113,113,0.5)", padding: "3px 7px", borderRadius: 3, alignSelf: "flex-start" },
  perf: { font: "12px ui-monospace, monospace", color: "#7dd3fc", background: "rgba(3,8,15,0.8)", padding: "3px 7px", borderRadius: 3, alignSelf: "flex-start" },
  hint: { position: "absolute", left: 12, right: 12, bottom: 10, textAlign: "center", font: "700 9px system-ui, sans-serif", letterSpacing: "0.18em", color: "rgba(148,163,184,0.95)", pointerEvents: "none" },
  minimap: { position: "absolute", right: 12, bottom: 44, padding: 6, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(125,211,252,0.3)", background: "rgba(3,8,15,0.85)" },
  minimapTitle: { textAlign: "center", font: "900 7px system-ui, sans-serif", letterSpacing: "0.2em", color: "#7dd3fc" },
  mmToggle: { ...ctrlBox, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", font: "700 10px system-ui, sans-serif", lineHeight: 1, cursor: "pointer", padding: 0, borderRadius: 2 },
};
