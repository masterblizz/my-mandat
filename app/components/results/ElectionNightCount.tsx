"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ElectionNightUpdate } from "../../data/electionNight";
import { useLang, t } from "../../i18n/useLang";

type Tallies = { mandat: number; lawan: number; others: number };
type Dot = { x: number; y: number; angle: number };

// Parliament-style hemicycle: rows of seats whose count grows with radius,
// ordered left→right by angle so blocs fill in from either side.
function hemicycleLayout(total: number) {
  const n = Math.max(1, total);
  const rows = Math.min(9, Math.max(2, Math.round(Math.sqrt(n / 4.2))));
  const inner = rows <= 3 ? 0.5 : 0.36;
  const radii = Array.from({ length: rows }, (_, i) => rows === 1 ? 1 : inner + (1 - inner) * i / (rows - 1));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map(r => Math.max(1, Math.round(n * r / sum)));
  let diff = n - counts.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; diff !== 0; i = (i - 1 + rows) % rows) { const step = diff > 0 ? 1 : -1; if (counts[i] + step >= 1) { counts[i] += step; diff -= step; } }
  const R = 94, cx = 100, cy = 100;
  const dots: Dot[] = [];
  radii.forEach((r, i) => {
    const k = counts[i];
    for (let j = 0; j < k; j++) {
      const angle = k === 1 ? Math.PI / 2 : Math.PI - Math.PI * j / (k - 1);
      dots.push({ x: Math.round((cx + Math.cos(angle) * r * R) * 100) / 100, y: Math.round((cy - Math.sin(angle) * r * R) * 100) / 100, angle });
    }
  });
  dots.sort((a, b) => b.angle - a.angle || a.y - b.y);
  const rowGap = rows > 1 ? (1 - inner) * R / (rows - 1) : R * 0.3;
  const arcGap = counts[0] > 1 ? Math.PI * radii[0] * R / (counts[0] - 1) : rowGap;
  return { dots, dotR: Math.max(1.1, Math.min(rowGap, arcGap, 9) * 0.4) };
}

function Hemicycle({ total, tallies, partyColor, majorityTarget, lastIndex }: { total: number; tallies: Tallies; partyColor: string; majorityTarget: number; lastIndex: number | null }) {
  const { dots, dotR } = useMemo(() => hemicycleLayout(total), [total]);
  const majorityAngle = Math.PI - Math.PI * (Math.min(total, majorityTarget) - 0.5) / Math.max(1, total);
  const colorAt = (i: number) => {
    if (i < tallies.mandat) return partyColor;
    if (i >= total - tallies.lawan) return "var(--warn-orange)";
    if (i < tallies.mandat + tallies.others) return "#8b9bb0";
    return null;
  };
  return <svg viewBox="0 0 200 104" className="w-full max-w-[560px]" role="img" aria-label="Hemicycle">
    <line x1={100} y1={100} x2={(100 + Math.cos(majorityAngle) * 99).toFixed(2)} y2={(100 - Math.sin(majorityAngle) * 99).toFixed(2)} stroke="var(--gold)" strokeWidth={0.6} strokeDasharray="2 2" opacity={0.75} />
    {dots.map((dot, i) => { const fill = colorAt(i); return <circle key={i} cx={dot.x} cy={dot.y} r={dotR.toFixed(2)} fill={fill ?? "rgba(255,255,255,0.06)"} stroke={fill ? "none" : "rgba(255,255,255,0.12)"} strokeWidth={0.35} style={{ transition: "fill 260ms ease-out", filter: fill && i === lastIndex ? `drop-shadow(0 0 3px ${fill})` : undefined }} />; })}
  </svg>;
}

export default function ElectionNightCount({ timeline, partyName, partyColor, totalSeats, majorityTarget, scopeLabel, onComplete }: {
  timeline: ElectionNightUpdate[];
  partyName: string;
  partyColor: string;
  totalSeats: number;
  majorityTarget: number;
  scopeLabel: string;
  onComplete: () => void;
}) {
  const lang = useLang();
  const reduceMotion = useReducedMotion();
  const [cursor, setCursor] = useState(0);
  const [tallies, setTallies] = useState<Tallies>({ mandat: 0, lawan: 0, others: 0 });
  const [feed, setFeed] = useState<ElectionNightUpdate[]>([]);
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const [finished, setFinished] = useState(false);
  const declared = tallies.mandat + tallies.lawan + tallies.others;
  const current = feed[0];
  const [majorityCall, setMajorityCall] = useState<"mandat" | "lawan" | null>(null);
  const calledRef = useRef(false);
  const [lastIndex, setLastIndex] = useState<number | null>(null);

  // The moment a bloc crosses the majority line is the night's climax:
  // hold the broadcast briefly on a full-width call before counting on.
  useEffect(() => {
    if (calledRef.current) return;
    const winner = tallies.mandat >= majorityTarget ? "mandat" : tallies.lawan >= majorityTarget ? "lawan" : null;
    if (!winner) return;
    calledRef.current = true;
    setMajorityCall(winner);
    const timer = window.setTimeout(() => setMajorityCall(null), fast ? 1400 : 2600);
    return () => window.clearTimeout(timer);
  }, [fast, majorityTarget, tallies.lawan, tallies.mandat]);

  useEffect(() => {
    if (reduceMotion) onComplete();
  }, [onComplete, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || paused || finished || majorityCall || cursor >= timeline.length) return;
    const update = timeline[cursor];
    const delay = update.kind === "bulletin" ? (fast ? 280 : 760) : (fast ? 18 : 58);
    const timer = window.setTimeout(() => {
      if (update.kind === "seat") {
        const bloc = update.result === "WIN" ? "mandat" : update.result === "LOSS" ? "lawan" : "others";
        setTallies(value => {
          const next = { ...value, [bloc]: value[bloc] + 1 };
          setLastIndex(bloc === "mandat" ? next.mandat - 1 : bloc === "lawan" ? totalSeats - next.lawan : next.mandat + next.others - 1);
          return next;
        });
      }
      setFeed(items => [update, ...items].slice(0, 8));
      if (cursor >= timeline.length - 1) setFinished(true);
      else setCursor(index => index + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [cursor, fast, finished, majorityCall, paused, reduceMotion, timeline, totalSeats]);

  const progress = totalSeats ? Math.min(100, declared / totalSeats * 100) : 0;
  const leader = useMemo(() => {
    const entries = [{ name: partyName, value: tallies.mandat }, { name: "LAWAN", value: tallies.lawan }, { name: t(lang, "LAIN-LAIN", "OTHERS"), value: tallies.others }].sort((a, b) => b.value - a.value);
    return entries[0];
  }, [lang, partyName, tallies]);

  if (reduceMotion) return null;

  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#03070d] p-4 pb-[calc(16px+env(safe-area-inset-bottom))] sm:p-8" style={{ fontFamily: "Space Mono, monospace" }}>
    <div className="mx-auto flex min-h-full max-w-6xl flex-col">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-cyan/25 pb-4">
        <div><div className="text-[10px] font-bold tracking-[0.3em] text-gold">{t(lang, "SIARAN LANGSUNG", "LIVE COUNT")}</div><h1 className="mt-1 text-2xl font-black tracking-widest text-white">{t(lang, "MALAM KEPUTUSAN", "ELECTION NIGHT")}</h1><p className="mt-1 text-xs text-text-muted">{scopeLabel} · {t(lang, "keputusan kerusi demi kerusi", "seat-by-seat declarations")}</p></div>
        <div className="flex flex-wrap gap-2"><button className="border border-cyan/30 px-3 py-2 text-[10px] font-bold tracking-wider text-cyan" onClick={() => setPaused(value => !value)} disabled={finished}>{paused ? t(lang, "SAMBUNG", "RESUME") : t(lang, "JEDA", "PAUSE")}</button><button className="border border-gold/30 px-3 py-2 text-[10px] font-bold tracking-wider text-gold" onClick={() => setFast(value => !value)}>{fast ? "1×" : "3×"}</button><button className="border border-white/15 px-3 py-2 text-[10px] font-bold tracking-wider text-text-muted" onClick={onComplete}>{t(lang, "LANGKAU", "SKIP")}</button></div>
      </header>

      <div className="mt-5 grid flex-1 gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <section className="flex flex-col border border-cyan/20 bg-cyan/[0.025] p-5">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            {[{ label: partyName, value: tallies.mandat, color: partyColor }, { label: "LAWAN", value: tallies.lawan, color: "var(--warn-orange)" }, { label: t(lang, "LAIN-LAIN", "OTHERS"), value: tallies.others, color: "var(--text-muted)" }].map(item => <div key={item.label} className="border border-white/10 p-2 text-center sm:p-3"><motion.div key={item.value} initial={{ scale: 1.22 }} animate={{ scale: 1 }} className="text-3xl font-black sm:text-6xl" style={{ color: item.color, textShadow: `0 0 18px ${item.color}44` }}>{item.value}</motion.div><div className="mt-2 truncate text-[8px] font-bold tracking-wider text-text-muted sm:text-[10px]">{item.label}</div></div>)}
          </div>
          <div className="mt-4"><div className="flex justify-between text-[10px] text-text-muted"><span>{declared}/{totalSeats} {t(lang, "DIUMUMKAN", "DECLARED")}</span><span>{t(lang, "MAJORITI", "MAJORITY")} {majorityTarget}</span></div><div className="relative mt-2 flex h-3 border border-white/10 bg-black/50">{[{ v: tallies.mandat, c: partyColor }, { v: tallies.others, c: "#8b9bb0" }].map((seg, i) => <div key={i} className="h-full transition-all duration-300" style={{ width: `${seg.v / Math.max(1, totalSeats) * 100}%`, background: seg.c, boxShadow: i === 0 ? `0 0 10px ${partyColor}66` : undefined }} />)}<div className="ml-auto h-full transition-all duration-300" style={{ width: `${tallies.lawan / Math.max(1, totalSeats) * 100}%`, background: "var(--warn-orange)" }} /><div className="absolute inset-y-[-4px] w-0.5 bg-gold" style={{ left: `${majorityTarget / Math.max(1, totalSeats) * 100}%`, boxShadow: "0 0 6px var(--gold)" }} /></div></div>

          <div className="relative mt-5 flex min-h-[210px] flex-1 flex-col items-center justify-center gap-4 overflow-hidden border border-white/10 bg-black/25 p-6 text-center" style={{ background: "radial-gradient(ellipse at 50% 100%, rgb(var(--cyan-rgb) / .07), transparent 65%)" }}>
            <Hemicycle total={totalSeats} tallies={tallies} partyColor={partyColor} majorityTarget={majorityTarget} lastIndex={lastIndex} />
            <AnimatePresence>{majorityCall && <motion.div key="call" initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 1, scaleX: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 border-y-2 py-5" style={{ borderColor: majorityCall === "mandat" ? partyColor : "var(--warn-orange)", background: "rgb(var(--bg-rgb) / .98)", boxShadow: `0 0 40px ${majorityCall === "mandat" ? partyColor : "#ff8a3d"}55` }}><div className="text-[10px] font-bold tracking-[0.35em] text-gold">{t(lang, "UNJURAN RASMI", "PROJECTION")}</div><div className="mt-2 px-4 text-2xl font-black tracking-widest sm:text-3xl" style={{ color: majorityCall === "mandat" ? partyColor : "var(--warn-orange)" }}>{majorityCall === "mandat" ? partyName : "LAWAN"} · {t(lang, "MAJORITI DICAPAI", "MAJORITY REACHED")}</div><div className="mt-1 text-xs text-text-muted">{majorityTarget}/{totalSeats} {t(lang, "kerusi dimenangi", "seats secured")}</div></motion.div>}</AnimatePresence>
            {current?.kind === "bulletin" ? <motion.div key={current.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}><div className="text-[10px] font-bold tracking-[0.25em] text-gold">{t(lang, "BULETIN TERKINI", "BREAKING BULLETIN")}</div><h2 className="mt-3 text-2xl font-black uppercase tracking-wider text-white">{current.title[lang]}</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted">{current.detail[lang]}</p></motion.div> : current?.kind === "seat" ? <motion.div key={current.id} initial={{ opacity: 0.6, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="min-w-[260px] border-t-2 px-6 pt-3" style={{ borderColor: current.result === "WIN" ? partyColor : current.result === "LOSS" ? "var(--warn-orange)" : "#8b9bb0" }}><div className="text-[10px] tracking-[0.25em] text-text-muted">{current.stateName} · {current.seatCode}</div><h2 className="mt-1 text-2xl font-black uppercase text-white sm:text-3xl">{current.seatName}</h2><div className="mt-2 text-lg font-bold" style={{ color: current.result === "WIN" ? partyColor : current.result === "LOSS" ? "var(--warn-orange)" : "var(--text-muted)" }}>{current.winnerLabel}</div>{current.majorityVotes > 0 && <p className="mt-1 text-xs text-text-muted">{t(lang, "Majoriti", "Majority")} {current.majorityVotes.toLocaleString()} · {current.majorityPct.toFixed(1)} pts{current.majorityPct <= 2 && <span className="ml-2 font-bold text-gold">{t(lang, "· SENGIT", "· KNIFE-EDGE")}</span>}</p>}</motion.div> : <div className="text-sm tracking-widest text-text-muted">{t(lang, "Menunggu peti pertama…", "Waiting for the first box…")}</div>}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="text-[10px] text-text-muted">{finished ? t(lang, "Semua kerusi telah diumumkan.", "All seats have been declared.") : `${t(lang, "Pendahulu", "Leader")}: ${leader.name} · ${leader.value}`}</div>{finished && <button className="border border-gold/60 bg-gold/10 px-6 py-3 text-xs font-bold tracking-widest text-gold hover:bg-gold/20" onClick={onComplete}>{t(lang, "LIHAT KEPUTUSAN RASMI →", "VIEW OFFICIAL RESULT →")}</button>}</div>
        </section>

        <aside className="border border-gold/20 bg-black/20 p-4"><div className="mb-3 flex items-center justify-between"><strong className="text-[11px] tracking-widest text-gold">{t(lang, "LOG PENGUMUMAN", "DECLARATION LOG")}</strong><span className="text-[9px] text-text-muted">{Math.round(progress)}%</span></div><div className="space-y-2">{feed.map((update, index) => update.kind === "bulletin" ? <div key={`${update.id}-${index}`} className="border-l-2 border-gold bg-gold/5 px-3 py-2"><div className="text-[9px] font-bold tracking-wider text-gold">{t(lang, "BULETIN", "BULLETIN")}</div><div className="mt-1 text-[11px] text-white">{update.title[lang]}</div></div> : <div key={update.id} className="flex items-center justify-between gap-2 border-b border-white/5 px-1 py-2"><div className="min-w-0"><div className="truncate text-[11px] font-bold text-white">{update.seatName}</div><div className="text-[9px] text-text-muted">{update.stateShortName} · {update.seatCode}</div></div><span className="shrink-0 text-[10px] font-bold" style={{ color: update.result === "WIN" ? partyColor : update.result === "LOSS" ? "var(--warn-orange)" : "var(--text-muted)" }}>{update.winnerLabel}</span></div>)}</div></aside>
      </div>
    </div>
  </div>;
}
