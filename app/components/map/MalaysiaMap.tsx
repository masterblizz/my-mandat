"use client";
import { useEffect, useRef, useState } from "react";
import { StateData } from "../../data/states";
import { formatNumber, formatPercent } from "../../utils/format";

interface Props {
  states: StateData[];
  onStateClick?: (id: string) => void;
  selectedStateId?: string | null;
  showLabels?: boolean;
  showHotspots?: boolean;
  compact?: boolean;
  tooltipPlacement?: "cursor" | "menu-static";
}

interface PathData {
  svgId: string;
  gameId: string;
  d: string;
  name: string;
}

// SVG path id → game state id
const SVG_TO_GAME: Record<string, string> = {
  MY01: "johor", MY02: "kedah", MY03: "kelantan", MY04: "melaka",
  MY05: "ns", MY06: "pahang", MY07: "penang", MY08: "perak",
  MY09: "perlis", MY10: "selangor", MY11: "terengganu",
  MY12: "sabah", MY13: "sarawak", MY14: "wp",
};

const STATE_LABELS: Record<string, string> = {
  johor: "JHR", kedah: "KDH", kelantan: "KTN", melaka: "MLK",
  ns: "N9", pahang: "PHG", penang: "PNG", perak: "PRK",
  perlis: "PLS", selangor: "SGR", terengganu: "TRG",
  sabah: "SBH", sarawak: "SWK", wp: "KL",
};

// East Malaysia states shifted left by EM_SHIFT to close the sea gap
const EAST_MALAYSIA = new Set(["sabah", "sarawak"]);
const EM_SHIFT = -230;

// Label positions in original viewBox coords (East Malaysia adjusted after shift)
const LABEL_POS: Record<string, [number, number]> = {
  perlis: [73, 55], kedah: [94, 81], penang: [83, 106],
  perak: [109, 129], kelantan: [157, 119], terengganu: [197, 122],
  pahang: [175, 184], selangor: [132, 198], wp: [140, 213],
  ns: [165, 226], melaka: [170, 249], johor: [219, 262],
  // These coords are pre-shifted (original - 230)
  sarawak: [469, 240], sabah: [610, 112],
};

const MAP_VIEWBOX = { x: 40, y: 30, width: 700, height: 280 } as const;
const MALAYSIA_GEO_BOUNDS = {
  minLng: 99.6,
  maxLng: 119.3,
  minLat: 0.8,
  maxLat: 7.4,
} as const;

function projectCoord(lat: number, lng: number) {
  const x = MAP_VIEWBOX.x + ((lng - MALAYSIA_GEO_BOUNDS.minLng) / (MALAYSIA_GEO_BOUNDS.maxLng - MALAYSIA_GEO_BOUNDS.minLng)) * MAP_VIEWBOX.width;
  const y = MAP_VIEWBOX.y + ((MALAYSIA_GEO_BOUNDS.maxLat - lat) / (MALAYSIA_GEO_BOUNDS.maxLat - MALAYSIA_GEO_BOUNDS.minLat)) * MAP_VIEWBOX.height;
  return { x, y };
}

const HOTSPOT_REFERENCE_POINTS = [
  { label: "KUALA LUMPUR", lat: 3.1390, lng: 101.6869 },
  { label: "TAMBUN", lat: 4.3716, lng: 101.5501 },
  { label: "GOMBAK", lat: 3.5500, lng: 102.2500 },
  { label: "BERA", lat: 3.6667, lng: 102.8833 },
  { label: "KOTA BELUD", lat: 6.0500, lng: 116.2333 },
  { label: "PUNCAK BORNEO", lat: 1.6800, lng: 110.0500 },
];

const PARLIAMENT_HOTSPOTS = [
  { ...HOTSPOT_REFERENCE_POINTS[1], delay: "0s" },
  { ...HOTSPOT_REFERENCE_POINTS[2], delay: "0.35s" },
  { ...HOTSPOT_REFERENCE_POINTS[3], delay: "0.7s" },
  { ...HOTSPOT_REFERENCE_POINTS[4], delay: "1.05s" },
  { ...HOTSPOT_REFERENCE_POINTS[5], delay: "1.4s" },
].map((hotspot) => ({ ...hotspot, ...projectCoord(hotspot.lat, hotspot.lng) }));

function getStatusColors(status: string, hovered: boolean, selected: boolean) {
  const active = hovered || selected;
  if (selected) return { fill: "rgb(var(--gold-rgb) / 0.13)", stroke: "var(--gold)", strokeW: "1.5" };
  switch (status) {
    case "winning":
      return { fill: active ? "rgb(var(--cyan-rgb) / 0.13)" : "#003a5299", stroke: active ? "rgb(var(--cyan-rgb) / 0.8)" : "rgb(var(--cyan-rgb) / 0.53)", strokeW: active ? "1.2" : "0.7" };
    case "losing":
      return { fill: active ? "rgb(255 68 68 / 0.13)" : "#3a000099", stroke: active ? "rgb(255 68 68 / 0.8)" : "rgb(255 68 68 / 0.53)", strokeW: active ? "1.2" : "0.7" };
    case "contested":
      return { fill: active ? "rgb(var(--gold-rgb) / 0.13)" : "#2a200099", stroke: active ? "rgb(var(--gold-rgb) / 0.8)" : "rgb(var(--gold-rgb) / 0.53)", strokeW: active ? "1.2" : "0.7" };
    default:
      return { fill: "#0d111766", stroke: "#ffffff22", strokeW: "0.5" };
  }
}

function PathGroup({
  paths,
  stateMap,
  hoveredId,
  selectedStateId,
  onHoverEnter,
  onHoverMove,
  onHoverLeave,
  onStateClick,
}: {
  paths: PathData[];
  stateMap: Record<string, StateData>;
  hoveredId: string | null;
  selectedStateId?: string | null;
  onHoverEnter: (gameId: string, e: React.MouseEvent | React.PointerEvent) => void;
  onHoverMove: (gameId: string, e: React.MouseEvent | React.PointerEvent) => void;
  onHoverLeave: () => void;
  onStateClick?: (id: string) => void;
}) {
  return (
    <>
      {paths.map(({ svgId, gameId, d }) => {
        const stateData = stateMap[gameId];
        const hovered = hoveredId === gameId;
        const selected = selectedStateId === gameId;
        const { fill, stroke, strokeW } = stateData
          ? getStatusColors(stateData.status, hovered, selected)
          : { fill: "#0d111755", stroke: "#ffffff18", strokeW: "0.5" };
        const glowFilter =
          hovered || selected
            ? stateData?.status === "winning" ? "url(#mm-glow-blue)"
              : stateData?.status === "losing" ? "url(#mm-glow-red)"
              : "url(#mm-glow-gold)"
            : undefined;
        return (
          <path
            key={svgId}
            d={d}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeW}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{
              cursor: stateData && onStateClick ? "pointer" : "default",
              transition: "fill 0.25s, stroke 0.2s, stroke-width 0.15s",
              filter: glowFilter,
            }}
            onMouseEnter={(e) => { if (stateData) onHoverEnter(gameId, e); }}
            onMouseMove={(e) => { if (stateData) onHoverMove(gameId, e); }}
            onPointerEnter={(e) => { if (stateData) onHoverEnter(gameId, e); }}
            onPointerMove={(e) => { if (stateData) onHoverMove(gameId, e); }}
            onMouseLeave={onHoverLeave}
            onPointerLeave={onHoverLeave}
            onClick={(e) => { if (stateData) { onHoverEnter(gameId, e); onStateClick?.(gameId); } }}
          >
          </path>
        );
      })}
    </>
  );
}

export default function MalaysiaMap({ states, onStateClick, selectedStateId, showLabels = true, showHotspots = false, compact = false }: Props) {
  const [pathData, setPathData] = useState<PathData[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; state: StateData } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stateMap = Object.fromEntries(states.map((s) => [s.id, s]));

  useEffect(() => {
    fetch("/malaysia.svg")
      .then((r) => r.text())
      .then((text) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const paths: PathData[] = [];
        doc.querySelectorAll("path").forEach((el) => {
          const svgId = el.getAttribute("id") || "";
          const gameId = SVG_TO_GAME[svgId];
          const d = el.getAttribute("d") || "";
          const name = el.getAttribute("name") || svgId;
          if (gameId && d.length > 10) paths.push({ svgId, gameId, d, name });
        });
        setPathData(paths);
      })
      .catch(() => setPathData([]));
  }, []);

  const peninsularPaths = pathData.filter((p) => !EAST_MALAYSIA.has(p.gameId));
  const eastMalaysiaPaths = pathData.filter((p) => EAST_MALAYSIA.has(p.gameId));

  const handleHoverEnter = (gameId: string, e: React.MouseEvent | React.PointerEvent) => {
    setHoveredId(gameId);
    const stateData = stateMap[gameId];
    if (stateData) setTooltip({ x: e.clientX, y: e.clientY, state: stateData });
  };
  const handleHoverMove = (gameId: string, e: React.MouseEvent | React.PointerEvent) => {
    setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  };
  const handleHoverLeave = () => { setHoveredId(null); setTooltip(null); };

  if (pathData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-muted"
        style={{ height: compact ? 380 : 280, fontSize: 12, fontFamily: "Space Mono, monospace" }}
      >
        {"// LOADING MAP..."}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      style={{ fontFamily: "Space Mono, monospace" }}
    >
      <svg
        viewBox={`${MAP_VIEWBOX.x} ${MAP_VIEWBOX.y} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        width="100%"
        style={{
          display: "block",
          maxHeight: compact ? "420px" : undefined,
          filter: "drop-shadow(0 0 6px rgb(var(--cyan-rgb) / 0.12))",
        }}
      >
        <defs>
          <filter id="mm-glow-blue" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="mm-glow-gold" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="mm-glow-red" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes mm-hotspot-core {
            0%, 100% { opacity: 0.62; transform: scale(0.78); }
            45% { opacity: 1; transform: scale(1.24); }
          }
          @keyframes mm-hotspot-ring {
            0% { opacity: 0.72; transform: scale(0.25); }
            100% { opacity: 0; transform: scale(3.2); }
          }
          .mm-hotspot-core { transform-box: fill-box; transform-origin: center; animation: mm-hotspot-core 1.35s ease-in-out infinite; }
          .mm-hotspot-ring { transform-box: fill-box; transform-origin: center; animation: mm-hotspot-ring 1.9s ease-out infinite; }
        `}</style>

        {/* Region divider */}
        {!compact && (
          <>
            <line x1="315" y1="35" x2="315" y2="305" stroke="rgb(var(--cyan-rgb) / 0.09)" strokeWidth="0.8" strokeDasharray="4,6" />
            <text x="175" y="42" textAnchor="middle" fill="rgb(var(--cyan-rgb) / 0.2)" fontSize="7" fontFamily="Space Mono, monospace" letterSpacing="3">PENINSULAR</text>
            <text x="530" y="42" textAnchor="middle" fill="rgb(var(--cyan-rgb) / 0.2)" fontSize="7" fontFamily="Space Mono, monospace" letterSpacing="3">EAST MALAYSIA</text>
          </>
        )}

        {/* Peninsular Malaysia */}
        <g>
          <PathGroup
            paths={peninsularPaths}
            stateMap={stateMap}
            hoveredId={hoveredId}
            selectedStateId={selectedStateId}
            onHoverEnter={handleHoverEnter}
            onHoverMove={handleHoverMove}
            onHoverLeave={handleHoverLeave}
            onStateClick={onStateClick}
          />
        </g>

        {/* East Malaysia — shifted left to close sea gap */}
        <g transform={`translate(${EM_SHIFT}, 0)`}>
          <PathGroup
            paths={eastMalaysiaPaths}
            stateMap={stateMap}
            hoveredId={hoveredId}
            selectedStateId={selectedStateId}
            onHoverEnter={handleHoverEnter}
            onHoverMove={handleHoverMove}
            onHoverLeave={handleHoverLeave}
            onStateClick={onStateClick}
          />
        </g>

        {/* State labels */}
        {showLabels && pathData.map(({ gameId }) => {
          const pos = LABEL_POS[gameId];
          const stateData = stateMap[gameId];
          if (!pos || !stateData) return null;
          const label = STATE_LABELS[gameId] || gameId.toUpperCase();
          const hovered = hoveredId === gameId;
          const selected = selectedStateId === gameId;
          const labelColor =
            selected ? "var(--gold)" :
            hovered ? "#ffffff" :
            stateData.status === "winning" ? "rgb(var(--cyan-rgb) / 0.67)" :
            stateData.status === "losing" ? "rgb(255 68 68 / 0.67)" :
            stateData.status === "contested" ? "rgb(var(--gold-rgb) / 0.67)" : "#ffffff44";

          return (
            <text
              key={`lbl-${gameId}`}
              x={pos[0]}
              y={pos[1]}
              textAnchor="middle"
              fontSize={gameId === "wp" || gameId === "penang" || gameId === "perlis" || gameId === "melaka" ? 6 : 8}
              fontFamily="Space Mono, monospace"
              fontWeight="bold"
              fill={labelColor}
              style={{ pointerEvents: "none", userSelect: "none", transition: "fill 0.2s" }}
            >
              {label}
            </text>
          );
        })}

        {showHotspots && PARLIAMENT_HOTSPOTS.map((hotspot) => (
          <g key={hotspot.label} style={{ pointerEvents: "none" }}>
            <circle
              className="mm-hotspot-ring"
              cx={hotspot.x}
              cy={hotspot.y}
              r="5"
              fill="none"
              stroke="rgb(var(--gold-rgb) / 0.65)"
              strokeWidth="1.1"
              style={{ animationDelay: hotspot.delay }}
            />
            <circle
              className="mm-hotspot-core"
              cx={hotspot.x}
              cy={hotspot.y}
              r="3.2"
              fill="var(--gold)"
              stroke="rgba(255,255,255,0.86)"
              strokeWidth="0.7"
              filter="url(#mm-glow-gold)"
              style={{ animationDelay: hotspot.delay }}
            />
            <text
              x={hotspot.x + 9}
              y={hotspot.y + 4}
              fill="var(--gold)"
              fontSize="7"
              fontFamily="Space Mono, monospace"
              fontWeight="900"
              letterSpacing="1.4"
              style={{ textShadow: "0 0 8px rgb(var(--gold-rgb) / 0.75)" }}
            >
              {hotspot.label}
            </text>
          </g>
        ))}
      </svg>


      {/* HTML Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-[80]"
          style={{
            left: "52%",
            top: "43%",
            transform: "translate(-50%, -50%)",
            background: "#0d1117f2",
            border: "1px solid rgb(var(--cyan-rgb) / 0.35)",
            padding: "10px 12px",
            width: "210px",
            boxShadow: "0 0 18px rgb(var(--cyan-rgb) / 0.22)",
          }}
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-bold text-white tracking-wider">{tooltip.state.name.toUpperCase()}</div>
              <div className="text-[9px] text-text-muted tracking-[0.18em]">{tooltip.state.region.toUpperCase()} REGION</div>
            </div>
            <div
              className="text-[9px] font-bold tracking-[0.14em]"
              style={{
                color: tooltip.state.status === "winning" ? "var(--neon-green)"
                  : tooltip.state.status === "losing" ? "var(--neon-red)" : "var(--gold)",
              }}
            >
              {tooltip.state.status.toUpperCase()}
            </div>
          </div>

          <div className="mb-2 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[14px] font-bold" style={{ color: "var(--cyan)" }}>{formatPercent(tooltip.state.mandatSupport)}</div>
              <div className="text-[8px] text-text-muted tracking-[0.12em]">MANDAT</div>
            </div>
            <div>
              <div className="text-[14px] font-bold" style={{ color: "var(--neon-red)" }}>{formatPercent(tooltip.state.lawanSupport)}</div>
              <div className="text-[8px] text-text-muted tracking-[0.12em]">LAWAN</div>
            </div>
            <div>
              <div className="text-[14px] font-bold" style={{ color: "var(--gold)" }}>{tooltip.state.projectedSeats}/{tooltip.state.seats}</div>
              <div className="text-[8px] text-text-muted tracking-[0.12em]">SEATS</div>
            </div>
          </div>

          <div className="space-y-1 border-t pt-2" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.14)" }}>
            <div className="flex justify-between"><span className="text-[10px] text-text-muted">WIN PROBABILITY</span><span className="text-[10px] font-bold text-white">{formatPercent(tooltip.state.winProbability)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] text-text-muted">SWING RISK</span><span className="text-[10px] font-bold" style={{ color: "var(--gold)" }}>{formatPercent(tooltip.state.swingProbability)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] text-text-muted">TURNOUT TARGET</span><span className="text-[10px] font-bold text-white">{formatPercent(tooltip.state.turnoutTarget)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] text-text-muted">REGISTERED VOTERS</span><span className="text-[10px] font-bold text-white">{formatNumber(tooltip.state.registeredVoters / 1000000)}M</span></div>
          </div>

          <div className="mt-2 text-[9px] leading-4 text-text-muted">
            KEY ISSUE: <span style={{ color: "var(--gold)" }}>{tooltip.state.keyIssues[0]}</span>
          </div>
        </div>
      )}

      {/* Legend */}
      {!compact && (
        <div className="flex gap-4 mt-1.5 justify-center">
          {[
            { color: "var(--cyan)", label: "WINNING", bg: "rgb(var(--cyan-rgb) / 0.12)" },
            { color: "var(--gold)", label: "CONTESTED", bg: "rgb(var(--gold-rgb) / 0.12)" },
            { color: "var(--neon-red)", label: "TRAILING", bg: "#3a0000" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 border" style={{ background: item.bg, borderColor: item.color }} />
              <span className="text-[11px] text-text-muted tracking-wider">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
