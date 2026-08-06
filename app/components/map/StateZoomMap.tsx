"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { StateData } from "../../data/states";
import { generateConstituencies, type Constituency } from "../../data/constituencies";
import { useLang, t } from "../../i18n/useLang";
import LoadingSpinner from "../ui/LoadingSpinner";

interface Props {
  state: StateData;
  onSeatClick?: (seatId: string) => void;
}

// Same SVG path id → game state id map as MalaysiaMap.
const SVG_TO_GAME: Record<string, string> = {
  MY01: "johor", MY02: "kedah", MY03: "kelantan", MY04: "melaka",
  MY05: "ns", MY06: "pahang", MY07: "penang", MY08: "perak",
  MY09: "perlis", MY10: "selangor", MY11: "terengganu",
  MY12: "sabah", MY13: "sarawak", MY14: "wp",
};
const GAME_TO_SVG: Record<string, string> = Object.fromEntries(
  Object.entries(SVG_TO_GAME).map(([svgId, gameId]) => [gameId, svgId])
);

type Dot = { seat: Constituency; x: number; y: number };

// Deterministic hash so a seat's dot position is stable across re-renders/refreshes.
function seededFrac(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

export default function StateZoomMap({ state, onSeatClick }: Props) {
  const lang = useLang();
  const [pathD, setPathD] = useState<string | null>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [viewBox, setViewBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/malaysia.svg")
      .then((r) => r.text())
      .then((text) => {
        if (cancelled) return;
        const doc = new DOMParser().parseFromString(text, "image/svg+xml");
        const svgId = GAME_TO_SVG[state.id];
        const el = svgId ? doc.getElementById(svgId) : null;
        setPathD(el?.getAttribute("d") ?? null);
      })
      .catch(() => setPathD(null));
    return () => { cancelled = true; };
  }, [state.id]);

  useEffect(() => {
    if (!pathD || !pathRef.current) return;
    const bbox = pathRef.current.getBBox();
    const pad = Math.max(bbox.width, bbox.height) * 0.14;
    setViewBox({ x: bbox.x - pad, y: bbox.y - pad, w: bbox.width + pad * 2, h: bbox.height + pad * 2 });
  }, [pathD]);

  const seats = useMemo(() => generateConstituencies(state, "dun"), [state]);
  const [dots, setDots] = useState<Dot[]>([]);

  // Scatter seats across a jittered grid inside the bbox, but only ever place
  // a dot where it actually lands inside the state's real outline (tested via
  // isPointInFill against the rendered path) — falls back to whole-bbox
  // rejection sampling, then the grid cell centre, for oddly-shaped states
  // where a cell falls entirely outside the polygon (e.g. a coastal notch).
  useEffect(() => {
    const path = pathRef.current;
    if (!viewBox || !path || seats.length === 0) { setDots([]); return; }

    const canTestFill = typeof path.isPointInFill === "function";
    const isInside = (x: number, y: number) => {
      if (!canTestFill) return true;
      try { return path.isPointInFill(new DOMPoint(x, y)); } catch { return true; }
    };

    const cols = Math.max(1, Math.ceil(Math.sqrt(seats.length * (viewBox.w / viewBox.h))));
    const rows = Math.max(1, Math.ceil(seats.length / cols));
    const cellW = viewBox.w / cols;
    const cellH = viewBox.h / rows;

    const placed = seats.map((seat, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellCx = viewBox.x + cellW * (col + 0.5);
      const cellCy = viewBox.y + cellH * (row + 0.5);

      // Try the cell centre, then jittered offsets within the cell, before
      // giving up on the grid layout and sampling the whole shape.
      for (let attempt = -1; attempt < 14; attempt++) {
        const x = attempt < 0 ? cellCx : cellCx + (seededFrac(`${seat.id}-jx-${attempt}`) - 0.5) * cellW * 0.82;
        const y = attempt < 0 ? cellCy : cellCy + (seededFrac(`${seat.id}-jy-${attempt}`) - 0.5) * cellH * 0.82;
        if (isInside(x, y)) return { seat, x, y };
      }
      for (let attempt = 0; attempt < 80; attempt++) {
        const x = viewBox.x + seededFrac(`${seat.id}-rx-${attempt}`) * viewBox.w;
        const y = viewBox.y + seededFrac(`${seat.id}-ry-${attempt}`) * viewBox.h;
        if (isInside(x, y)) return { seat, x, y };
      }
      // Every sample missed (degenerate/very thin shape) — fall back to the
      // cell centre rather than dropping the seat off the map entirely.
      return { seat, x: cellCx, y: cellCy };
    });
    setDots(placed);
  }, [seats, viewBox]);

  const hoveredDot = dots.find((d) => d.seat.id === hoveredId) ?? null;

  if (!pathD) {
    return (
      <div className="flex items-center justify-center" style={{ height: 380 }}>
        <LoadingSpinner label={t(lang, "// MEMUATKAN PETA...", "// LOADING MAP...")} />
      </div>
    );
  }

  const dotColor = (seat: Constituency) =>
    seat.winner === "mandat" ? "var(--cyan)" : seat.winner === "lawan" ? "var(--neon-red)" : "var(--gold)";

  return (
    <div className="relative w-full select-none" style={{ fontFamily: "Space Mono, monospace" }}>
      <svg
        viewBox={viewBox ? `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}` : "0 0 100 100"}
        width="100%"
        style={{ display: "block", maxHeight: "420px", filter: "drop-shadow(0 0 6px rgb(var(--cyan-rgb) / 0.12))" }}
      >
        <defs>
          <filter id="szm-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path
          ref={pathRef}
          d={pathD}
          fill="rgb(var(--cyan-rgb) / 0.05)"
          stroke="rgb(var(--cyan-rgb) / 0.55)"
          strokeWidth={viewBox ? Math.max(viewBox.w, viewBox.h) * 0.004 : 1}
          strokeLinejoin="round"
        />
        {dots.map(({ seat, x, y }) => {
          const hovered = hoveredId === seat.id;
          const r = viewBox ? Math.max(viewBox.w, viewBox.h) * (hovered ? 0.014 : 0.01) : 3;
          return (
            <g key={seat.id} style={{ cursor: onSeatClick ? "pointer" : "default" }}>
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={dotColor(seat)}
                fillOpacity={hovered ? 0.95 : 0.8}
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={viewBox ? Math.max(viewBox.w, viewBox.h) * 0.0012 : 0.4}
                filter={hovered ? "url(#szm-glow)" : undefined}
                onMouseEnter={() => setHoveredId(seat.id)}
                onMouseLeave={() => setHoveredId((current) => (current === seat.id ? null : current))}
                onClick={() => onSeatClick?.(seat.id)}
              />
            </g>
          );
        })}
      </svg>

      {hoveredDot && viewBox && (
        <div
          className="pointer-events-none absolute z-[80]"
          style={{
            left: `${((hoveredDot.x - viewBox.x) / viewBox.w) * 100}%`,
            top: `${((hoveredDot.y - viewBox.y) / viewBox.h) * 100}%`,
            transform: "translate(-50%, -130%)",
            background: "#0d1117f2",
            border: "1px solid rgb(var(--cyan-rgb) / 0.35)",
            padding: "8px 10px",
            width: "180px",
            boxShadow: "0 0 16px rgb(var(--cyan-rgb) / 0.22)",
          }}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-bold text-white tracking-wider">{hoveredDot.seat.name}</span>
            <span className="shrink-0 text-[8px] text-text-muted">{hoveredDot.seat.code}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span style={{ color: dotColor(hoveredDot.seat) }}>{hoveredDot.seat.mandat}% {t(lang, "SOKONGAN", "SUPPORT")}</span>
            <span
              className="font-bold uppercase"
              style={{ color: hoveredDot.seat.safety === "safe" ? "var(--neon-green)" : hoveredDot.seat.safety === "marginal" ? "var(--gold)" : "var(--neon-red)" }}
            >
              {t(lang, hoveredDot.seat.safety === "safe" ? "SELAMAT" : hoveredDot.seat.safety === "marginal" ? "MARGINAL" : "BAHAYA", hoveredDot.seat.safety)}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-4 mt-1.5 justify-center">
        {[
          { color: "var(--cyan)", labelMS: "MENANG", labelEN: "WINNING" },
          { color: "var(--gold)", labelMS: "BERTANDING", labelEN: "CONTESTED" },
          { color: "var(--neon-red)", labelMS: "KETINGGALAN", labelEN: "TRAILING" },
        ].map((item) => (
          <div key={item.labelEN} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            <span className="text-[11px] text-text-muted tracking-wider">{t(lang, item.labelMS, item.labelEN)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
