"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RED, CYAN, GOLD, TEXT_DIM, TEXT_FAINT, PANEL, BORDER } from "./theme";
import { plexMono } from "./fonts";
import { useLang, t } from "../../i18n/useLang";
import { states } from "../../data/states";
import { generateConstituencies } from "../../data/constituencies";
import { formatNumber } from "../../utils/format";

// Full-bleed decorative backdrop for /login and /register — ported from the
// Claude Design canvas "Login Page.dc.html", variant 5a ("Peta taktikal +
// kad tengah"): a radial cyan/gold wash, the real /malaysia.svg state
// outlines (fetched and parsed the same way MalaysiaMap.tsx does — see
// SVG_TO_GAME below — so this needs no per-capital coordinate calibration
// at all, unlike the point-marker version this replaced), a drifting
// grid, faint scanlines, and a spinning radar dial. Hovering a state
// highlights it and shows its real facts (area, seats, population) in a
// cursor-following tooltip. Animations are the only motion on the
// non-interactive layers — all disabled under prefers-reduced-motion via
// the mm-auth- classes in globals.css.

// SVG path id → game state id (same mapping as MalaysiaMap.tsx).
const SVG_TO_GAME: Record<string, string> = {
  MY01: "johor", MY02: "kedah", MY03: "kelantan", MY04: "melaka",
  MY05: "ns", MY06: "pahang", MY07: "penang", MY08: "perak",
  MY09: "perlis", MY10: "selangor", MY11: "terengganu",
  MY12: "sabah", MY13: "sarawak", MY14: "wp",
};

// East Malaysia states shifted left by EM_SHIFT to close the sea gap —
// same trick and same value MalaysiaMap.tsx uses, so both maps agree on
// what "closed up" Malaysia looks like.
const EAST_MALAYSIA = new Set(["sabah", "sarawak"]);
const EM_SHIFT = -230;

const STATE_CAPITALS: Record<string, string> = {
  perlis: "Kangar", kedah: "Alor Setar", penang: "George Town", perak: "Ipoh",
  kelantan: "Kota Bharu", terengganu: "Kuala Terengganu", selangor: "Shah Alam",
  wp: "Kuala Lumpur", ns: "Seremban", pahang: "Kuantan", melaka: "Melaka",
  johor: "Johor Bahru", sabah: "Kota Kinabalu", sarawak: "Kuching",
};

// Same center as MalaysiaMap.tsx's own viewBox (x:40,y:30,w:700,h:280),
// zoomed out to 60% of its original on-screen scale (50% smaller, then
// bumped back up 20%) — a smaller, less dominant map accent rather than
// filling the whole backdrop edge-to-edge.
const MAP_VIEWBOX = { x: -193, y: -63, width: 1167, height: 467 };

// Idle "scanning" order for the auto-highlight cycle — starts Sabah →
// Sarawak → Johor → Melaka per request, then sweeps the rest of the
// peninsula before looping back to Sabah.
const AUTO_CYCLE_ORDER = [
  "sabah", "sarawak", "johor", "melaka", "ns", "selangor", "wp",
  "perak", "penang", "kedah", "perlis", "kelantan", "terengganu", "pahang",
];
const AUTO_CYCLE_MS = 2200;

interface PathData {
  svgId: string;
  gameId: string;
  d: string;
}

const stateById = Object.fromEntries(states.map((s) => [s.id, s]));

// State flag artwork isn't part of this repo yet — drop files in here as
// public/flags/<id>.svg (or .png) and this starts rendering them
// automatically; until then the corner panel just quietly shows nothing
// where the flag would go (onError below), no broken-image icon.
function StateFlag({ stateId }: { stateId: string }) {
  // "loading" renders the img at opacity 0 (not display:none — a hidden
  // img still fires load/error, an unrendered one wouldn't) so neither a
  // slow load nor a 404 ever flashes a broken-image icon; only flips
  // visible once the browser confirms the file actually decoded.
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setStatus("loading");
    // A cached or same-origin/local image can finish loading (and fire its
    // native 'load' event) before React has attached the onLoad handler
    // below, which otherwise leaves the flag stuck invisible forever —
    // .complete here catches that case on the next tick.
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setStatus("loaded");
    }
  }, [stateId]);

  if (status === "error") return null;
  return (
    <img
      ref={imgRef}
      src={`/flags/${stateId}.svg`}
      alt=""
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("error")}
      style={{
        width: 384,
        height: 240,
        objectFit: "cover",
        border: `1px solid ${BORDER}`,
        boxShadow: "0 0 12px rgba(85,220,255,0.15)",
        opacity: status === "loaded" ? 1 : 0,
        transition: "opacity 0.2s",
      }}
    />
  );
}

export default function AuthBackground() {
  const lang = useLang();
  const [pathData, setPathData] = useState<PathData[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [autoIndex, setAutoIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = setInterval(() => {
      setAutoIndex((i) => (i + 1) % AUTO_CYCLE_ORDER.length);
    }, AUTO_CYCLE_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch("/malaysia.svg")
      .then((r) => r.text())
      .then((text) => {
        const doc = new DOMParser().parseFromString(text, "image/svg+xml");
        const paths: PathData[] = [];
        doc.querySelectorAll("path").forEach((el) => {
          const svgId = el.getAttribute("id") || "";
          const gameId = SVG_TO_GAME[svgId];
          const d = el.getAttribute("d") || "";
          if (gameId && d.length > 10) paths.push({ svgId, gameId, d });
        });
        setPathData(paths);
      })
      .catch(() => setPathData([]));
  }, []);

  const peninsularPaths = pathData.filter((p) => !EAST_MALAYSIA.has(p.gameId));
  const eastMalaysiaPaths = pathData.filter((p) => EAST_MALAYSIA.has(p.gameId));

  const handleEnter = (gameId: string, e: React.MouseEvent) => {
    setHoveredId(gameId);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };
  const handleMove = (e: React.MouseEvent) => setTooltipPos({ x: e.clientX, y: e.clientY });
  const handleLeave = () => setHoveredId(null);

  // Manual hover always wins over the ambient auto-cycle; tooltip only
  // ever shows for an actual hover, never for the auto-highlight alone.
  const activeId = hoveredId ?? AUTO_CYCLE_ORDER[autoIndex];
  const activeState = stateById[activeId];
  const hoveredState = hoveredId ? stateById[hoveredId] : null;
  const openLeft = tooltipPos.x > (typeof window !== "undefined" ? window.innerWidth : 1440) - 230;
  const openUp = tooltipPos.y > (typeof window !== "undefined" ? window.innerHeight : 900) - 210;

  // Real seat names (PARLIAMENT_NAMES/DUN_NAMES) + a deterministic
  // per-seat voter figure derived from the state's real population —
  // deliberately NOT reading generateConstituencies()'s mandat/lawan/
  // winner/safety fields here, since those are seeded from the same
  // "flavor" support numbers MalaysiaMap.tsx's own pre-game tooltip mode
  // already avoids for exactly this reason: showing them here would read
  // as a fake in-progress campaign before the player has even logged in.
  const seatLists = useMemo(() => {
    if (!activeState) return { parlimen: [], dun: [] };
    return {
      parlimen: generateConstituencies(activeState, "parliament").map((c) => ({ code: c.code, name: c.name, voters: c.voters })),
      dun: generateConstituencies(activeState, "dun").map((c) => ({ code: c.code, name: c.name, voters: c.voters })),
    };
  }, [activeState]);

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 1100px 800px at 60% 46%, rgba(0,212,255,0.20), transparent 62%), radial-gradient(ellipse 700px 600px at 20% 85%, rgba(255,178,44,0.08), transparent 60%), #04060c",
        }}
      />

      <svg
        className="absolute inset-0"
        style={{ pointerEvents: pathData.length ? "auto" : "none" }}
        width="100%"
        height="100%"
        viewBox={`${MAP_VIEWBOX.x} ${MAP_VIEWBOX.y} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="mm-auth-state-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g>
          {peninsularPaths.map(({ svgId, gameId, d }) => (
            <path
              key={svgId}
              d={d}
              fill={activeId === gameId ? "rgba(85,220,255,0.22)" : "rgba(85,220,255,0.06)"}
              stroke={activeId === gameId ? CYAN : "rgba(85,220,255,0.22)"}
              strokeWidth={activeId === gameId ? 1.2 : 0.6}
              filter={activeId === gameId ? "url(#mm-auth-state-glow)" : undefined}
              style={{ cursor: "pointer", transition: "fill 0.2s, stroke 0.2s" }}
              onMouseEnter={(e) => handleEnter(gameId, e)}
              onMouseMove={handleMove}
              onMouseLeave={handleLeave}
            />
          ))}
        </g>
        <g transform={`translate(${EM_SHIFT}, 0)`}>
          {eastMalaysiaPaths.map(({ svgId, gameId, d }) => (
            <path
              key={svgId}
              d={d}
              fill={activeId === gameId ? "rgba(85,220,255,0.22)" : "rgba(85,220,255,0.06)"}
              stroke={activeId === gameId ? CYAN : "rgba(85,220,255,0.22)"}
              strokeWidth={activeId === gameId ? 1.2 : 0.6}
              filter={activeId === gameId ? "url(#mm-auth-state-glow)" : undefined}
              style={{ cursor: "pointer", transition: "fill 0.2s, stroke 0.2s" }}
              onMouseEnter={(e) => handleEnter(gameId, e)}
              onMouseMove={handleMove}
              onMouseLeave={handleLeave}
            />
          ))}
        </g>
      </svg>

      <div
        className="mm-auth-grid-drift pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(148,163,184,0.05) 0px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(148,163,184,0.05) 0px, transparent 1px 40px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.014), rgba(255,255,255,0.014) 1px, transparent 1px, transparent 4px)",
        }}
      />

      <svg
        className="mm-auth-radar-spin pointer-events-none absolute"
        style={{ right: 40, top: 40, opacity: 0.4, transformOrigin: "50% 50%" }}
        width="760"
        height="760"
        viewBox="0 0 760 760"
      >
        <circle cx="380" cy="380" r="350" fill="none" stroke={RED} strokeWidth="1" />
        <circle cx="380" cy="380" r="260" fill="none" stroke={RED} strokeWidth="1" strokeDasharray="2 6" />
        <circle cx="380" cy="380" r="170" fill="none" stroke={RED} strokeWidth="1" />
        <circle cx="380" cy="380" r="80" fill="none" stroke={RED} strokeWidth="1" strokeDasharray="2 6" />
        <line x1="380" y1="30" x2="380" y2="730" stroke={RED} strokeWidth="1" />
        <line x1="30" y1="380" x2="730" y2="380" stroke={RED} strokeWidth="1" />
        <path d="M 380 380 L 380 30 A 350 350 0 0 1 627 133 Z" fill="rgba(193,31,44,0.12)" />
      </svg>

      {hoveredState && (
        <div
          className={`${plexMono.className} pointer-events-none fixed z-20`}
          style={{
            left: openLeft ? "auto" : tooltipPos.x + 16,
            right: openLeft ? window.innerWidth - tooltipPos.x + 16 : "auto",
            top: openUp ? "auto" : tooltipPos.y + 16,
            bottom: openUp ? window.innerHeight - tooltipPos.y + 16 : "auto",
            width: 205,
            background: PANEL,
            backdropFilter: "blur(6px)",
            border: `1px solid ${BORDER}`,
            borderLeft: `2px solid ${CYAN}`,
            padding: "10px 12px",
            boxShadow: "0 0 24px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f2f4f8", marginBottom: 2 }}>
            {STATE_CAPITALS[hoveredState.id] ?? hoveredState.name}
          </div>
          <div style={{ fontSize: 9, color: GOLD, letterSpacing: 1, marginBottom: 8 }}>
            {t(lang, "IBU NEGERI ", "STATE CAPITAL OF ").toUpperCase()}
            {hoveredState.name.toUpperCase()}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: CYAN }}>
                {formatNumber(hoveredState.population / 1000000)}M
              </div>
              <div style={{ fontSize: 7, color: TEXT_FAINT, letterSpacing: 0.5 }}>{t(lang, "PENDUDUK", "POPULATION")}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{hoveredState.seats}</div>
              <div style={{ fontSize: 7, color: TEXT_FAINT, letterSpacing: 0.5 }}>{t(lang, "KERUSI PARLIMEN", "PARL. SEATS")}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_DIM }}>
                {hoveredState.dunSeats > 0 ? hoveredState.dunSeats : "—"}
              </div>
              <div style={{ fontSize: 7, color: TEXT_FAINT, letterSpacing: 0.5 }}>{t(lang, "KERUSI DUN", "DUN SEATS")}</div>
            </div>
          </div>
          <div style={{ paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 7, color: TEXT_FAINT, letterSpacing: 0.5, marginBottom: 4 }}>
              {t(lang, "PECAHAN KAUM", "ETHNIC BREAKDOWN")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 3, fontSize: 9, color: TEXT_DIM }}>
              <span>{t(lang, "Melayu", "Malay")} {hoveredState.demographics.malay}%</span>
              <span>{t(lang, "Cina", "Chinese")} {hoveredState.demographics.chinese}%</span>
              <span>{t(lang, "India", "Indian")} {hoveredState.demographics.indian}%</span>
              <span>{t(lang, "Lain-lain", "Others")} {hoveredState.demographics.others}%</span>
            </div>
          </div>
        </div>
      )}

      {/* State flag, bottom-right — tracks whichever state is currently
          highlighted (auto-cycle, or hover overriding it). */}
      {activeState && (
        <div
          className={`${plexMono.className} fixed z-10`}
          style={{
            bottom: 74,
            right: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            pointerEvents: "none",
          }}
        >
          <StateFlag stateId={activeState.id} />
          <div style={{ fontSize: 9, color: GOLD, letterSpacing: 1 }}>{activeState.name.toUpperCase()}</div>
        </div>
      )}

      {/* DUN & Parlimen seat list + voter counts, bottom-left — same
          "currently highlighted state" source as the flag above. */}
      {activeState && (
        <div
          className={`${plexMono.className} fixed z-10`}
          style={{
            bottom: 74,
            left: 24,
            width: 230,
            background: PANEL,
            backdropFilter: "blur(6px)",
            border: `1px solid ${BORDER}`,
            borderLeft: `2px solid ${GOLD}`,
            padding: "10px 12px",
            boxShadow: "0 0 24px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f2f4f8", marginBottom: 2 }}>{activeState.name}</div>
          <div style={{ fontSize: 9, color: CYAN, marginBottom: 8 }}>
            {formatNumber(activeState.registeredVoters)} {t(lang, "JUMLAH PENGUNDI", "TOTAL VOTERS")}
          </div>
          <div style={{ maxHeight: 190, overflowY: "auto" }}>
            {seatLists.parlimen.length > 0 && (
              <>
                <div style={{ fontSize: 7, color: TEXT_FAINT, letterSpacing: 0.5, marginTop: 2 }}>
                  {t(lang, "PARLIMEN", "PARLIAMENT")}
                </div>
                {seatLists.parlimen.map((s) => (
                  <div key={s.code} style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 9, color: TEXT_DIM, padding: "1px 0" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {s.code} {s.name}
                    </span>
                    <span style={{ color: GOLD, flexShrink: 0 }}>{formatNumber(s.voters)}</span>
                  </div>
                ))}
              </>
            )}
            {seatLists.dun.length > 0 && (
              <>
                <div style={{ fontSize: 7, color: TEXT_FAINT, letterSpacing: 0.5, marginTop: 6 }}>
                  {t(lang, "DUN", "DUN")}
                </div>
                {seatLists.dun.map((s) => (
                  <div key={s.code} style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 9, color: TEXT_DIM, padding: "1px 0" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {s.code} {s.name}
                    </span>
                    <span style={{ color: GOLD, flexShrink: 0 }}>{formatNumber(s.voters)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
