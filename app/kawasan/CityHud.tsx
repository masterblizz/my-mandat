"use client";

// City HUD in a navy-glass city-builder style: a top bar (logo, district
// mood meters, resource chips), a labelled tool rail on the left, the seat
// card with its real boundary outline, and a mini-map with zoom buttons.
// Pure view: /kawasan passes the numbers and the actions.

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { t, type Lang } from "../i18n/useLang";
import { formatNumber } from "../utils/format";
import { boundaryCityFrame, loadSeatBoundary, type Boundary } from "../data/seatGeo";

type ZoneLike = { kind: string; sentiment: number };

const GROUPS: { id: string; icon: string; ms: string; en: string; kinds: string[] }[] = [
  { id: "home", icon: "🏠", ms: "Perumahan", en: "Housing", kinds: ["housing", "village"] },
  { id: "trade", icon: "🏪", ms: "Niaga", en: "Business", kinds: ["commercial", "urban", "market"] },
  { id: "work", icon: "🏭", ms: "Industri", en: "Industry", kinds: ["industry"] },
  { id: "people", icon: "👥", ms: "Komuniti", en: "Community", kinds: ["education", "community", "river"] },
];

export type HudChip = { icon: string; value: string; title: string };

export function CityTopBar({ lang, zones, chips }: { lang: Lang; zones: ZoneLike[]; chips: HudChip[] }) {
  const rows = GROUPS.map((group) => {
    const list = zones.filter((zone) => group.kinds.includes(zone.kind));
    const value = list.length ? Math.round(list.reduce((sum, zone) => sum + zone.sentiment, 0) / list.length) : null;
    return { ...group, value };
  }).filter((row) => row.value !== null).slice(0, 3) as (typeof GROUPS[number] & { value: number })[];
  return (
    <div className="nhud-top city-hud-box pointer-events-none" aria-label={t(lang, "Status bandar", "City status")}>
      <div className="nhud-top__band">
        <div className="nhud-logo" aria-hidden><span>MY</span><b>MANDAT</b></div>
        {rows.map((row) => (
          <div key={row.id} className="nhud-meter" title={`${t(lang, row.ms, row.en)} ${row.value}`}>
            <span className="nhud-meter__icon" aria-hidden>{row.icon}</span>
            <div className="nhud-meter__body">
              <span className="nhud-meter__label">{t(lang, row.ms, row.en)}</span>
              <span className="nhud-meter__track"><span style={{ width: `${row.value}%` }} /></span>
            </div>
            <b>{row.value}</b>
          </div>
        ))}
      </div>
      <div className="nhud-chips">
        {chips.map((chip) => (
          <div key={chip.title} className="nhud-chip" title={chip.title}><span aria-hidden>{chip.icon}</span>{chip.value}</div>
        ))}
      </div>
    </div>
  );
}

export type RailItem = { id: string; icon: string; label: string; active?: boolean; run: () => void };

export function CityRail({ items, label }: { items: RailItem[]; label?: string }) {
  return (
    <nav className="nhud-rail" aria-label={label ?? "City tools"}>
      {items.map((item) => (
        <button key={item.id} type="button" onClick={item.run} aria-pressed={item.active ?? undefined} className={`nhud-rail__item ${item.active ? "is-active" : ""}`}>
          <span aria-hidden className="nhud-rail__icon">{item.icon}</span>
          <span className="nhud-rail__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** Boundary rings → an SVG path fitted into a w×h box. */
function useBoundaryPath(code: string, stateId: string, name: string, w: number, h: number) {
  const [rings, setRings] = useState<Boundary | null>(null);
  useEffect(() => {
    let alive = true;
    if (code && stateId && name) loadSeatBoundary(code, stateId, name).then((b) => { if (alive) setRings(b); });
    return () => { alive = false; };
  }, [code, stateId, name]);
  return useMemo(() => {
    if (!rings?.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const k = Math.min((w - 8) / (x1 - x0 || 1), (h - 8) / (y1 - y0 || 1));
    const ox = (w - (x1 - x0) * k) / 2, oy = (h - (y1 - y0) * k) / 2;
    const d = rings.map((r) => `M${r.map(([x, y]) => `${(ox + (x - x0) * k).toFixed(1)},${(oy + (y1 - y) * k).toFixed(1)}`).join("L")}Z`).join("");
    // the 3D city's centre and scale on this drawing (see boundaryCityFrame)
    const f = boundaryCityFrame(rings);
    return { d, cx: ox + (f.lon - x0) * k, cy: oy + (y1 - f.lat) * k, rPx: f.meanDeg * k };
  }, [rings, w, h]);
}

/** What the 3D city reported it built (GodotCityMap relays it on build). */
type CitySummary = { homes: number; commercial: number; industrial: number; tourism: number; agriculture: number; bridges: number; junctions: number; hills: number; tier: string };

function useCitySummary() {
  const [sum, setSum] = useState<CitySummary | null>(null);
  useEffect(() => {
    const on = (e: Event) => setSum((e as CustomEvent<CitySummary>).detail);
    window.addEventListener("kawasan-city-summary", on);
    return () => window.removeEventListener("kawasan-city-summary", on);
  }, []);
  return sum;
}

/** 25,608 -> "25.6k" for the tight HUD line. */
function compact(n: number) {
  return n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : formatNumber(n);
}

export function CitySeatCard({ lang, code, name, stateId, sentiment, density, onToggle }: {
  lang: Lang; code: string; name: string; stateId: string; sentiment: number; density: number; onToggle: () => void;
}) {
  const path = useBoundaryPath(code, stateId, name, 96, 70)?.d;
  const city = useCitySummary();
  return (
    <button type="button" onClick={onToggle} className="nhud-seat city-hud-box" title={t(lang, "Panel zon", "Zone panel")}>
      <div className="nhud-seat__head"><span aria-hidden>📍</span><b>{code}</b><span className="nhud-seat__name">{name}</span><span aria-hidden>▾</span></div>
      <div className="nhud-seat__body">
        {path ? <svg viewBox="0 0 96 70" className="nhud-seat__shape" aria-hidden><path d={path} /></svg> : <div className="nhud-seat__shape" />}
        <div className="nhud-seat__stats"><span>😊 {sentiment}%</span><span>👥 {formatNumber(density)}/km²</span>
          {city && <span className="nhud-seat__city" title={t(lang,
            `${formatNumber(city.homes)} rumah · ${city.commercial} lot niaga · ${city.industrial} lot industri · ${city.bridges} jambatan · ${city.junctions} simpang`,
            `${formatNumber(city.homes)} homes · ${city.commercial} shop lots · ${city.industrial} industrial lots · ${city.bridges} bridges · ${city.junctions} junctions`)}>
            <span>🏠 {compact(city.homes)} · 🏪 {city.commercial}</span>
            {(city.industrial > 0 || city.bridges > 0) && <span>{city.industrial > 0 ? `🏭 ${city.industrial}` : ""}{city.industrial > 0 && city.bridges > 0 ? " · " : ""}{city.bridges > 0 ? `🌉 ${city.bridges}` : ""}</span>}
          </span>}
        </div>
      </div>
    </button>
  );
}

/** The 3D camera, as the city reports it (GodotCityMap relays kawasan-view). */
type CityView = { yaw: number; x: number; z: number; dist: number; ground: number; rCity: number };

/** Mini-map: the seat's real outline, a view cone that follows the 3D
 *  camera (position and heading), and zoom buttons for it. */
export function CityMiniMap({ lang, code, name, stateId, onZoom }: { lang: Lang; code: string; name: string; stateId: string; onZoom: (dir: 1 | -1) => void }) {
  const frame = useBoundaryPath(code, stateId, name, 150, 110);
  const [view, setView] = useState<CityView | null>(null);
  useEffect(() => {
    const on = (e: Event) => setView((e as CustomEvent<CityView>).detail);
    window.addEventListener("kawasan-view", on);
    return () => window.removeEventListener("kawasan-view", on);
  }, []);
  // world (x east, z south) -> mini-map px: r_city world units = rPx
  const cx = frame?.cx ?? 75, cy = frame?.cy ?? 55;
  const s = frame && view?.rCity ? frame.rPx / view.rCity : 0.05;
  const yawRad = ((view?.yaw ?? 25) * Math.PI) / 180;
  // the camera stands behind its target, opposite the way it looks
  const back = view?.ground ?? 300;
  const camX = cx + ((view?.x ?? 0) + Math.sin(yawRad) * back) * s;
  const camY = cy + ((view?.z ?? 0) + Math.cos(yawRad) * back) * s;
  const ax = Math.min(146, Math.max(4, camX)), ay = Math.min(106, Math.max(4, camY));
  const len = Math.min(60, Math.max(22, back * s * 1.3));
  const half = 0.42;
  const tip = (side: number) => [Math.sin(side * half) * len, -Math.cos(half) * len] as const;
  const [lx, ly] = tip(-1), [rx, ry] = tip(1);
  // a tap on the map moves the 3D view to that spot of the seat
  const goto = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!frame?.rPx || r.width <= 0) return;
    const px = ((e.clientX - r.left) / r.width) * 150, py = ((e.clientY - r.top) / r.height) * 110;
    // in units of the city radius: the 3D side scales it to its world
    window.dispatchEvent(new CustomEvent("kawasan-camera", { detail: { zoom: 0, gx: (px - cx) / frame.rPx, gz: (py - cy) / frame.rPx } }));
  };
  return (
    <div className="nhud-minimap city-hud-box">
      <svg viewBox="0 0 150 110" aria-hidden onClick={goto} className="nhud-minimap__map">
        <defs><pattern id="nhud-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0L0 0 0 10" fill="none" stroke="rgb(255 255 255 / .06)" strokeWidth="0.6" /></pattern></defs>
        <rect width="150" height="110" fill="url(#nhud-grid)" />
        {frame && <path d={frame.d} className="nhud-minimap__seat" />}
        <g transform={`translate(${ax.toFixed(1)} ${ay.toFixed(1)}) rotate(${(-(view?.yaw ?? 25)).toFixed(1)})`}>
          <path d={`M0 0 L${lx.toFixed(1)} ${ly.toFixed(1)} A${len.toFixed(1)} ${len.toFixed(1)} 0 0 1 ${rx.toFixed(1)} ${ry.toFixed(1)} Z`} className="nhud-minimap__cone" />
        </g>
        <circle cx={ax.toFixed(1)} cy={ay.toFixed(1)} r="3.5" className="nhud-minimap__me" />
      </svg>
      <span className="nhud-minimap__n" aria-hidden>N</span>
      <div className="nhud-minimap__zoom">
        <button type="button" onClick={() => onZoom(1)} aria-label={t(lang, "Zum masuk", "Zoom in")}>+</button>
        <button type="button" onClick={() => onZoom(-1)} aria-label={t(lang, "Zum keluar", "Zoom out")}>−</button>
      </div>
    </div>
  );
}
