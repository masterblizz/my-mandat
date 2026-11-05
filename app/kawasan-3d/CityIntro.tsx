"use client";

// City intro over the 3D city while it loads: Malaysia → the seat's state
// → the seat itself (pin, nearby towns, name card) → zoom through the pin
// into the 3D city, whose camera then flies in from high above.
// Drawn from public/malaysia.svg (state outlines, lon/lat plate); the
// overlay only covers the map frame and can be skipped.

import { useEffect, useRef, useState } from "react";
import { t, type Lang } from "../i18n/useLang";
import { geoToSvg, type SeatGeo } from "../data/seatGeo";

const SVG_TO_STATE: Record<string, string> = {
  MY01: "johor", MY02: "kedah", MY03: "kelantan", MY04: "melaka", MY05: "ns",
  MY06: "pahang", MY07: "penang", MY08: "perak", MY09: "perlis", MY10: "selangor",
  MY11: "terengganu", MY12: "sabah", MY13: "sarawak", MY14: "wp", MY15: "labuan", MY16: "putrajaya",
};

type Box = [number, number, number]; // centre x, centre y, width (height follows the frame)
type Path = { id: string; d: string };

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export default function CityIntro({ lang, geo, stateId, stateName, seatCode, seatName, density, ready, onFlyIn, onDone }: {
  lang: Lang; geo: SeatGeo; stateId: string; stateName: string; seatCode: string; seatName: string; density?: number;
  /** the 3D city has loaded; the last zoom waits for it */
  ready: boolean;
  /** start the 3D camera fly-in (fired as the map zooms through the pin) */
  onFlyIn: () => void;
  onDone: () => void;
}) {
  const [paths, setPaths] = useState<Path[]>([]);
  const [stage, setStage] = useState(0); // 0 country, 1 state, 2 seat, 3 dive
  const [box, setBox] = useState<Box>([500, 166, 1000]);
  const [gone, setGone] = useState(false);
  const from = useRef<Box>([500, 166, 1000]);
  const startedAt = useRef(0);
  const [px, py] = geoToSvg(geo.lat, geo.lon);

  useEffect(() => {
    fetch("/malaysia.svg").then((r) => r.text()).then((text) => {
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const out: Path[] = [];
      doc.querySelectorAll("path").forEach((el) => { const id = el.getAttribute("id") ?? ""; const d = el.getAttribute("d") ?? ""; if (SVG_TO_STATE[id] && d) out.push({ id: SVG_TO_STATE[id], d }); });
      setPaths(out);
    }).catch(() => setPaths([]));
  }, []);

  // stage timeline: the country map holds while the 3D city builds (its
  // generation blocks the page's main thread, which would freeze any zoom
  // in progress), then state 1.9 s → seat 2.4 s → dive 1.4 s
  useEffect(() => {
    if (stage === 0 && ready) { const id = window.setTimeout(() => setStage(1), 700); return () => window.clearTimeout(id); }
    if (stage === 1) { const id = window.setTimeout(() => setStage(2), 1900); return () => window.clearTimeout(id); }
    if (stage === 2) { const id = window.setTimeout(() => setStage(3), 2400); return () => window.clearTimeout(id); }
    if (stage === 3) {
      onFlyIn();
      const id = window.setTimeout(() => { setGone(true); window.setTimeout(onDone, 700); }, 1300);
      return () => window.clearTimeout(id);
    }
  }, [stage, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // camera: glide the viewBox between stage boxes (log-scaled width)
  useEffect(() => {
    const target: Box = stage === 0 ? [500, 166, 1000] : stage === 1 ? [px + 30, py + 18, 120] : stage === 2 ? [px + 2.5, py - 1, 22] : [px, py, 1.6];
    const dur = stage === 3 ? 1400 : 1500;
    from.current = box;
    startedAt.current = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = ease(Math.min(1, (now - startedAt.current) / dur));
      const a = from.current;
      const w = Math.exp(Math.log(a[2]) + (Math.log(target[2]) - Math.log(a[2])) * k);
      setBox([a[0] + (target[0] - a[0]) * k, a[1] + (target[1] - a[1]) * k, w]);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const h = box[2] * 0.46; // frame is landscape; keep the map's aspect
  const viewBox = `${box[0] - box[2] / 2} ${box[1] - h / 2} ${box[2]} ${h}`;
  const s = box[2] / 1000; // stroke / label scale with the zoom

  return (
    <div className="pointer-events-auto absolute inset-0 z-[150] overflow-hidden transition-opacity duration-700"
      style={{ opacity: gone ? 0 : 1, background: "radial-gradient(ellipse at 50% 45%, #0d2a3c, #04101b 75%)", fontFamily: "'Space Mono', monospace" }}>
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id="intro-grid" width={20 * s} height={20 * s} patternUnits="userSpaceOnUse">
            <path d={`M ${20 * s} 0 L 0 0 0 ${20 * s}`} fill="none" stroke="rgb(25 211 242 / .10)" strokeWidth={0.6 * s} />
          </pattern>
        </defs>
        <rect x="-500" y="-500" width="2000" height="1400" fill="#0a2a3e" />
        <rect x="-500" y="-500" width="2000" height="1400" fill="url(#intro-grid)" />
        {paths.map((p, i) => {
          const home = p.id === stateId;
          return <path key={i} d={p.d} fill={home ? "#2f6b4a" : "#1d4636"} stroke={home ? "#f2b01e" : "#5fb6a8"} strokeWidth={(home ? 1.4 : 0.6) * s} strokeLinejoin="round" />;
        })}
        {/* the seat: a dotted boundary ring and a pin */}
        {stage >= 1 && (
          <g>
            {/* ~8 km across: a real-size ring round the seat */}
            <circle cx={px} cy={py} r={1.7} fill="rgb(242 176 30 / .12)" stroke="#ff5a4e" strokeWidth={Math.max(0.06, 2.2 * s)} strokeDasharray={`${Math.max(0.2, 6 * s)} ${Math.max(0.15, 4 * s)}`} />
            <g transform={`translate(${px} ${py}) scale(${box[2] * 0.011})`}>
              <path d="M0 0 C -1.3 -1.6 -2 -2.6 -2 -3.6 A 2 2 0 1 1 2 -3.6 C 2 -2.6 1.3 -1.6 0 0 Z" fill="#e8463c" stroke="#fff" strokeWidth="0.25" />
              <circle cx="0" cy="-3.6" r="0.75" fill="#7a1410" />
            </g>
          </g>
        )}
        {stage >= 2 && geo.towns.map((town) => {
          const [tx, ty] = geoToSvg(town.lat, town.lon);
          return <g key={town.name}><circle cx={tx} cy={ty} r={0.12} fill="#cfe9f2" /><text x={tx + 0.2} y={ty - 0.15} fontSize={0.42} fill="#cfe9f2" stroke="#04101b" strokeWidth={0.06} paintOrder="stroke">{town.name}</text></g>;
        })}
      </svg>

      {/* caption: country → state → seat */}
      <div className="city-intro-caption absolute left-1/2 top-[8%] -translate-x-1/2 text-center">
        <div className="text-[10px] font-black tracking-[.32em] text-cyan">{stage === 0 ? "MALAYSIA" : stateName.toUpperCase()}</div>
        {stage >= 2 && (
          <div className="mt-2 rounded-md border px-4 py-2 shadow-2xl" style={{ borderColor: "rgb(var(--gold-rgb) / .7)", background: "rgb(4 16 27 / .82)", animation: "mm-goal-in .4s ease-out" }}>
            <div className="text-[18px] font-black tracking-wide text-white"><span className="text-cyan">{seatCode}</span> {seatName}</div>
            <div className="mt-0.5 text-[10px] font-bold tracking-[.18em] text-gold">📍 {geo.district}, {stateName}{density ? ` · 👥 ${density.toLocaleString("en-US")}/km²` : ""}</div>
          </div>
        )}
      </div>
      {stage === 0 && !ready && <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 text-[9px] font-black tracking-[.24em] text-cyan">{t(lang, "MEMBINA BANDAR 3D…", "BUILDING THE 3D CITY…")}</div>}
      <button type="button" onClick={() => { onFlyIn(); setGone(true); window.setTimeout(onDone, 400); }}
        className="absolute right-4 top-3 rounded border px-3 py-1.5 text-[10px] font-black tracking-widest text-text-muted"
        style={{ borderColor: "rgb(var(--cyan-rgb) / .35)", background: "rgb(4 16 27 / .7)" }}>
        {t(lang, "LANGKAU", "SKIP")} ▸▸
      </button>
    </div>
  );
}
