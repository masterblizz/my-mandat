"use client";

// City intro over the 3D city while it loads: Malaysia → the seat's state
// → the seat itself (pin, nearby towns, name card) → zoom through the pin
// into the 3D city, whose camera then flies in from high above.
// Drawn from public/malaysia.svg (state outlines, lon/lat plate); the
// overlay only covers the map frame and can be skipped.

import { useEffect, useMemo, useRef, useState } from "react";
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
  // fly-in fires once, whether from the dive or from SKIP
  const flown = useRef(false);
  const flyOnce = () => { if (!flown.current) { flown.current = true; onFlyIn(); } };
  const [px, py] = geoToSvg(geo.lat, geo.lon);
  // the seat's official boundary in SVG units, and a close-up box that fits it
  const ring = useMemo(() => (geo.boundary ?? []).map((r) => r.map(([lon, lat]) => geoToSvg(lat, lon))), [geo.boundary]);
  const seatBox = useMemo<Box>(() => {
    if (!ring.length) return [px + 2.5, py - 1, 22];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of ring) for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const w = Math.max((x1 - x0) * 2.2, ((y1 - y0) * 2.4) / 0.46, 6);
    return [(x0 + x1) / 2, (y0 + y1) / 2 - w * 0.04, w];
  }, [ring, px, py]);

  useEffect(() => {
    fetch("/malaysia.svg").then((r) => r.text()).then((text) => {
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const out: Path[] = [];
      doc.querySelectorAll("path").forEach((el) => { const id = el.getAttribute("id") ?? ""; const d = el.getAttribute("d") ?? ""; if (SVG_TO_STATE[id] && d) out.push({ id: SVG_TO_STATE[id], d }); });
      setPaths(out);
    }).catch(() => setPaths([]));
  }, []);

  // stage timeline, 0.5 s a step: Malaysia → state zoom (then holds while
  // the 3D city builds — generation blocks the page, so no zoom runs then)
  // → seat zoom + 0.5 s on the name card → dive → fade
  useEffect(() => {
    // the state zoom runs straight away (before the 3D build starts and
    // blocks the page); the state view then holds until the city is ready
    if (stage === 0) { const id = window.setTimeout(() => setStage(1), 500); return () => window.clearTimeout(id); }
    if (stage === 1 && ready) { const id = window.setTimeout(() => setStage(2), 500); return () => window.clearTimeout(id); }
    if (stage === 2) { const id = window.setTimeout(() => setStage(3), 1000); return () => window.clearTimeout(id); }
    if (stage === 3) {
      flyOnce();
      const id = window.setTimeout(() => { setGone(true); window.setTimeout(onDone, 500); }, 500);
      return () => window.clearTimeout(id);
    }
  }, [stage, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // camera: glide the viewBox between stage boxes (log-scaled width)
  useEffect(() => {
    const target: Box = stage === 0 ? [500, 166, 1000] : stage === 1 ? [px + 30, py + 18, 120] : stage === 2 ? seatBox : [px, py, Math.max(0.8, seatBox[2] * 0.08)];
    const dur = 500; // every zoom 0.5 s
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
    <div className="pointer-events-auto absolute inset-0 z-[150] overflow-hidden transition-opacity duration-500"
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
            {/* the seat's official electoral boundary (DOSM), or a ~8 km ring */}
            {ring.length ? ring.map((r, i) => (
              <path key={i} d={`M${r.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join("L")}Z`} fill="rgb(242 176 30 / .16)" stroke="#ff5a4e"
                strokeWidth={Math.max(0.05, 2.2 * s)} strokeDasharray={`${Math.max(0.16, 6 * s)} ${Math.max(0.12, 4 * s)}`} strokeLinejoin="round"
                style={{ animation: "mm-goal-in .6s ease-out" }} />
            )) : <circle cx={px} cy={py} r={1.7} fill="rgb(242 176 30 / .12)" stroke="#ff5a4e" strokeWidth={Math.max(0.06, 2.2 * s)} strokeDasharray={`${Math.max(0.2, 6 * s)} ${Math.max(0.15, 4 * s)}`} />}
            <g transform={`translate(${px} ${py}) scale(${box[2] * 0.011})`}>
              <path d="M0 0 C -1.3 -1.6 -2 -2.6 -2 -3.6 A 2 2 0 1 1 2 -3.6 C 2 -2.6 1.3 -1.6 0 0 Z" fill="#e8463c" stroke="#fff" strokeWidth="0.25" />
              <circle cx="0" cy="-3.6" r="0.75" fill="#7a1410" />
            </g>
          </g>
        )}
        {stage >= 2 && geo.towns.map((town) => {
          const [tx, ty] = geoToSvg(town.lat, town.lon);
          return <g key={town.name}><circle cx={tx} cy={ty} r={seatBox[2] * 0.006} fill="#cfe9f2" /><text x={tx + seatBox[2] * 0.01} y={ty - seatBox[2] * 0.007} fontSize={seatBox[2] * 0.022} fill="#cfe9f2" stroke="#04101b" strokeWidth={seatBox[2] * 0.003} paintOrder="stroke">{town.name}</text></g>;
        })}
      </svg>

      {/* caption: country → state → seat */}
      <div className="city-intro-caption absolute left-1/2 top-[8%] -translate-x-1/2 text-center">
        <div className="text-[10px] font-black tracking-[.32em] text-cyan">{stage === 0 ? "MALAYSIA" : stateName.toUpperCase()}</div>
        {stage >= 2 && (
          <div className="mt-2 rounded-md border px-4 py-2 shadow-2xl" style={{ borderColor: "rgb(var(--gold-rgb) / .7)", background: "rgb(4 16 27 / .82)", animation: "mm-goal-in .4s ease-out" }}>
            <div className="text-[18px] font-black tracking-wide text-white"><span className="text-cyan">{seatCode}</span> {seatName}</div>
            <div className="mt-0.5 text-[10px] font-bold tracking-[.18em] text-gold">📍 {geo.district ? `${geo.district}, ` : ""}{stateName}{density ? ` · 👥 ${density.toLocaleString("en-US")}/km²` : ""}</div>
          </div>
        )}
      </div>
      {stage <= 1 && !ready && <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 text-[9px] font-black tracking-[.24em] text-cyan">{t(lang, "MEMBINA BANDAR 3D…", "BUILDING THE 3D CITY…")}</div>}
      {stage >= 2 && ring.length > 0 && <div className="absolute bottom-2 left-3 text-[8px] tracking-wider text-text-muted">{t(lang, "Sempadan: DOSM, data terbuka (CC BY 4.0)", "Boundary: DOSM open data (CC BY 4.0)")}</div>}
      <button type="button" onClick={() => { flyOnce(); setGone(true); window.setTimeout(onDone, 400); }}
        className="absolute right-4 top-3 rounded border px-3 py-1.5 text-[10px] font-black tracking-widest text-text-muted"
        style={{ borderColor: "rgb(var(--cyan-rgb) / .35)", background: "rgb(4 16 27 / .7)" }}>
        {t(lang, "LANGKAU", "SKIP")} ▸▸
      </button>
    </div>
  );
}
