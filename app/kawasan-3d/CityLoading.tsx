"use client";

// Loading panel while the 3D city comes up: a big title, a progress bar
// driven by the real Godot signals (engine loaded → city built) and a
// rotating gameplay tip. Between signals the bar eases forward on its own;
// a shimmer runs on the compositor, so it keeps moving even while the
// city build blocks the page.

import { useEffect, useRef, useState } from "react";
import { t, type Lang } from "../i18n/useLang";

const TIPS: { ms: string; en: string }[] = [
  { ms: "Zon bertanda ★ paling memerlukan projek — kesannya lebih besar di situ.", en: "Zones marked ★ need a project most — it does more there." },
  { ms: "Jawab aduan penduduk sebelum tamat tempoh untuk kekalkan sokongan.", en: "Answer residents' complaints before they expire to keep support." },
  { ms: "Leret kad binaan ke kiri dan kanan untuk lihat semua projek.", en: "Swipe the build cards left and right to see every project." },
  { ms: "Butang + / − pada peta mini mengezum kamera bandar.", en: "The mini-map + / − buttons zoom the city camera." },
  { ms: "Bajet awam bertambah setiap suku tahun — rancang projek besar awal.", en: "The public budget grows every quarter — plan big projects early." },
];

export default function CityLoading({ lang, engineReady, built, progress = null, compact = false }: { lang: Lang; engineReady: boolean; built: boolean; progress?: number | null; compact?: boolean }) {
  const [pct, setPct] = useState(0);
  const [tip, setTip] = useState(0);
  const start = useRef(performance.now());
  const engineAt = useRef<number | null>(null);
  useEffect(() => { if (engineReady && engineAt.current === null) engineAt.current = performance.now(); }, [engineReady]);
  const real = useRef<number | null>(null);
  useEffect(() => { real.current = progress; }, [progress]);
  useEffect(() => {
    let raf = 0;
    const step = (now: number) => {
      // engine download/compile fills to 55 %, the city build to 95 %, done = 100 %
      // the city reports its real build progress while it builds
      const p = built ? 100
        : real.current !== null ? 55 + 43 * Math.min(1, Math.max(0, real.current))
        : engineReady || engineAt.current !== null ? 55 + 40 * (1 - Math.exp(-(now - (engineAt.current ?? now)) / 6000))
        : 55 * (1 - Math.exp(-(now - start.current) / 5000));
      setPct((old) => Math.max(old, p));
      if (!built) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [built, engineReady]);
  useEffect(() => { const id = window.setInterval(() => setTip((i) => (i + 1) % TIPS.length), 3500); return () => window.clearInterval(id); }, []);
  // once built, show the full bar at once (the frame loop may still be catching up)
  const shown = built ? 100 : pct;
  const stage = built ? t(lang, "Siap! Terbang masuk…", "Ready! Flying in…")
    : engineReady ? t(lang, "Menjana jalan, bangunan & pokok", "Laying roads, buildings & trees")
    : t(lang, "Memuatkan enjin 3D", "Loading the 3D engine");
  return (
    <div className={`city-loading pointer-events-none ${compact ? "city-loading--compact" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown)} aria-label={t(lang, "Membina bandar 3D", "Building the 3D city")}>
      <div className="city-loading__title">{built ? "✔ " : ""}{t(lang, "MEMBINA BANDAR 3D", "BUILDING THE 3D CITY")}{built ? "" : "…"}</div>
      <div className="city-loading__row"><span>{stage}</span><b>{Math.round(shown)}%</b></div>
      <div className="city-loading__track"><div className="city-loading__fill" style={{ width: `${shown}%` }} /><div className="city-loading__shine" /></div>
      {!compact && <div key={tip} className="city-loading__tip">💡 {TIPS[tip][lang]}</div>}
    </div>
  );
}
