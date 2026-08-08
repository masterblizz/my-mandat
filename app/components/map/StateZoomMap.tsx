"use client";
import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, MultiPolygon } from "geojson";
import { StateData } from "../../data/states";
import { generateConstituencies, type Constituency } from "../../data/constituencies";
import { useLang, t } from "../../i18n/useLang";
import LoadingSpinner from "../ui/LoadingSpinner";

interface Props {
  state: StateData;
  onSeatClick?: (seatId: string) => void;
}

type StateProps = { id: string; name: string };
type StateFeatureCollection = FeatureCollection<MultiPolygon, StateProps>;

interface DunPoint {
  code: string;
  name: string;
  lng: number;
  lat: number;
}

type Dot = { seat: Constituency; x: number; y: number };

// Fixed logical canvas — d3-geo's fitSize scales every state's real
// boundary to fill it, so a tiny state (Perlis) and a huge one (Sarawak)
// both render proportionally within the same frame, no per-state tuning.
const WIDTH = 600;
const HEIGHT = 420;

// Real Malaysian state boundaries and DUN constituency centroids, sourced
// from DOSM's (Department of Statistics Malaysia) official open data —
// see scripts/build-geo-data.mjs. Module-level cache: these two small
// files are shared across every state the player views this session, no
// need to refetch on each mount.
let stateGeoPromise: Promise<StateFeatureCollection> | null = null;
let dunPointsPromise: Promise<Record<string, DunPoint[]>> | null = null;

function loadStateGeo(): Promise<StateFeatureCollection> {
  stateGeoPromise ??= fetch("/data/geo/malaysia-states.geojson").then((r) => r.json());
  return stateGeoPromise;
}

function loadDunPoints(): Promise<Record<string, DunPoint[]>> {
  dunPointsPromise ??= fetch("/data/geo/dun-points.json").then((r) => r.json());
  return dunPointsPromise;
}

export default function StateZoomMap({ state, onSeatClick }: Props) {
  const lang = useLang();
  const [pathD, setPathD] = useState<string | null>(null);
  const [dots, setDots] = useState<Dot[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Real DUN centroids are indexed positionally (N.01, N.02, ...) and
  // confirmed to match this array's order exactly — see the plan doc for
  // the Selangor/Perlis cross-check that established this.
  const seats = useMemo(() => generateConstituencies(state, "dun"), [state]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    Promise.all([loadStateGeo(), loadDunPoints()]).then(([stateGeo, dunPoints]) => {
      if (cancelled) return;

      const feature = stateGeo.features.find((f) => f.properties.id === state.id);
      if (!feature) {
        setPathD(null);
        setDots([]);
        setReady(true);
        return;
      }

      const projection = geoMercator().fitSize([WIDTH, HEIGHT], feature);
      const pathGenerator = geoPath(projection);
      setPathD(pathGenerator(feature));

      const points = dunPoints[state.id] ?? [];
      const placed: Dot[] = [];
      seats.forEach((seat, i) => {
        const point = points[i];
        if (!point) return;
        const projected = projection([point.lng, point.lat]);
        if (!projected) return;
        placed.push({ seat, x: projected[0], y: projected[1] });
      });
      setDots(placed);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [state.id, seats]);

  const hoveredDot = dots.find((d) => d.seat.id === hoveredId) ?? null;

  if (!ready) {
    return (
      <div className="flex items-center justify-center" style={{ height: 380 }}>
        <LoadingSpinner label={t(lang, "components_map_StateZoomMap.loadingMap")} />
      </div>
    );
  }

  // Keyed off safety (not winner) — matches what the legend/tooltip badge
  // already say: MENANG/BERTANDING/KETINGGALAN describe how comfortably
  // MANDAT is doing in that seat (safe/marginal/danger), not simply who's
  // numerically ahead.
  const dotColor = (seat: Constituency) =>
    seat.safety === "safe" ? "var(--cyan)" : seat.safety === "marginal" ? "var(--gold)" : "var(--neon-red)";

  return (
    <div className="relative w-full select-none" style={{ fontFamily: "Space Mono, monospace" }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        style={{ display: "block", maxHeight: "420px", filter: "drop-shadow(0 0 6px rgb(var(--cyan-rgb) / 0.12))" }}
      >
        <defs>
          <filter id="szm-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {pathD && (
          <path
            d={pathD}
            fill="rgb(var(--cyan-rgb) / 0.05)"
            stroke="rgb(var(--cyan-rgb) / 0.55)"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        )}
        {dots.map(({ seat, x, y }) => {
          const hovered = hoveredId === seat.id;
          const r = hovered ? 6 : 4.2;
          return (
            <g key={seat.id} style={{ cursor: onSeatClick ? "pointer" : "default" }}>
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={dotColor(seat)}
                fillOpacity={hovered ? 0.95 : 0.8}
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={0.8}
                filter={hovered ? "url(#szm-glow)" : undefined}
                onMouseEnter={() => setHoveredId(seat.id)}
                onMouseLeave={() => setHoveredId((current) => (current === seat.id ? null : current))}
                onClick={() => onSeatClick?.(seat.id)}
              />
            </g>
          );
        })}
      </svg>

      {hoveredDot && (
        <div
          className="pointer-events-none absolute z-[80]"
          style={{
            left: `${(hoveredDot.x / WIDTH) * 100}%`,
            top: `${(hoveredDot.y / HEIGHT) * 100}%`,
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
            <span style={{ color: dotColor(hoveredDot.seat) }}>{hoveredDot.seat.mandat}% {t(lang, "components_map_StateZoomMap.support")}</span>
            <span
              className="font-bold uppercase"
              style={{ color: hoveredDot.seat.safety === "safe" ? "var(--neon-green)" : hoveredDot.seat.safety === "marginal" ? "var(--gold)" : "var(--neon-red)" }}
            >
              {t(lang, hoveredDot.seat.safety === "safe" ? "components_map_StateZoomMap.safetySafe" : hoveredDot.seat.safety === "marginal" ? "components_map_StateZoomMap.safetyMarginal" : "components_map_StateZoomMap.safetyDanger")}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-4 mt-1.5 justify-center">
        {[
          { color: "var(--cyan)", key: "legendWinning" },
          { color: "var(--gold)", key: "legendContested" },
          { color: "var(--neon-red)", key: "legendTrailing" },
        ].map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            <span className="text-[11px] text-text-muted tracking-wider">{t(lang, `components_map_StateZoomMap.${item.key}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
