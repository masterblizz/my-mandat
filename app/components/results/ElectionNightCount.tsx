"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ElectionNightUpdate } from "../../data/electionNight";
import { useLang, t } from "../../i18n/useLang";

type Tallies = { mandat: number; lawan: number; others: number };

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

  useEffect(() => {
    if (reduceMotion) onComplete();
  }, [onComplete, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || paused || finished || cursor >= timeline.length) return;
    const update = timeline[cursor];
    const delay = update.kind === "bulletin" ? (fast ? 280 : 760) : (fast ? 18 : 58);
    const timer = window.setTimeout(() => {
      if (update.kind === "seat") {
        setTallies(value => ({ ...value, [update.result === "WIN" ? "mandat" : update.result === "LOSS" ? "lawan" : "others"]: value[update.result === "WIN" ? "mandat" : update.result === "LOSS" ? "lawan" : "others"] + 1 }));
      }
      setFeed(items => [update, ...items].slice(0, 8));
      if (cursor >= timeline.length - 1) setFinished(true);
      else setCursor(index => index + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [cursor, fast, finished, paused, reduceMotion, timeline]);

  const progress = totalSeats ? Math.min(100, declared / totalSeats * 100) : 0;
  const leader = useMemo(() => {
    const entries = [{ name: partyName, value: tallies.mandat }, { name: "LAWAN", value: tallies.lawan }, { name: t(lang, "LAIN-LAIN", "OTHERS"), value: tallies.others }].sort((a, b) => b.value - a.value);
    return entries[0];
  }, [lang, partyName, tallies]);

  if (reduceMotion) return null;

  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#03070d] p-4 sm:p-8" style={{ fontFamily: "Space Mono, monospace" }}>
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
          <div className="mt-4"><div className="flex justify-between text-[10px] text-text-muted"><span>{declared}/{totalSeats} {t(lang, "DIUMUMKAN", "DECLARED")}</span><span>{t(lang, "MAJORITI", "MAJORITY")} {majorityTarget}</span></div><div className="relative mt-2 h-3 border border-white/10 bg-black/50"><div className="h-full bg-cyan transition-all" style={{ width: `${progress}%` }} /><div className="absolute inset-y-[-3px] w-px bg-gold" style={{ left: `${majorityTarget / Math.max(1, totalSeats) * 100}%` }} /></div></div>

          <div className="mt-5 flex min-h-[210px] flex-1 items-center justify-center border border-white/10 bg-black/25 p-6 text-center">
            {current?.kind === "bulletin" ? <motion.div key={current.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}><div className="text-[10px] font-bold tracking-[0.25em] text-gold">{t(lang, "BULETIN TERKINI", "BREAKING BULLETIN")}</div><h2 className="mt-3 text-2xl font-black uppercase tracking-wider text-white">{current.title[lang]}</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted">{current.detail[lang]}</p></motion.div> : current?.kind === "seat" ? <motion.div key={current.id} initial={{ opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }}><div className="text-[10px] tracking-[0.25em] text-text-muted">{current.stateName} · {current.seatCode}</div><h2 className="mt-2 text-3xl font-black uppercase text-white">{current.seatName}</h2><div className="mt-3 text-lg font-bold" style={{ color: current.result === "WIN" ? partyColor : current.result === "LOSS" ? "var(--warn-orange)" : "var(--text-muted)" }}>{current.winnerLabel}</div><p className="mt-1 text-xs text-text-muted">{t(lang, "Majoriti", "Majority")} {current.majorityVotes.toLocaleString()} · {current.majorityPct.toFixed(1)} pts</p></motion.div> : <div className="text-sm tracking-widest text-text-muted">{t(lang, "Menunggu peti pertama…", "Waiting for the first box…")}</div>}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="text-[10px] text-text-muted">{finished ? t(lang, "Semua kerusi telah diumumkan.", "All seats have been declared.") : `${t(lang, "Pendahulu", "Leader")}: ${leader.name} · ${leader.value}`}</div>{finished && <button className="border border-gold/60 bg-gold/10 px-6 py-3 text-xs font-bold tracking-widest text-gold hover:bg-gold/20" onClick={onComplete}>{t(lang, "LIHAT KEPUTUSAN RASMI →", "VIEW OFFICIAL RESULT →")}</button>}</div>
        </section>

        <aside className="border border-gold/20 bg-black/20 p-4"><div className="mb-3 flex items-center justify-between"><strong className="text-[11px] tracking-widest text-gold">{t(lang, "LOG PENGUMUMAN", "DECLARATION LOG")}</strong><span className="text-[9px] text-text-muted">{Math.round(progress)}%</span></div><div className="space-y-2">{feed.map((update, index) => update.kind === "bulletin" ? <div key={`${update.id}-${index}`} className="border-l-2 border-gold bg-gold/5 px-3 py-2"><div className="text-[9px] font-bold tracking-wider text-gold">{t(lang, "BULETIN", "BULLETIN")}</div><div className="mt-1 text-[11px] text-white">{update.title[lang]}</div></div> : <div key={update.id} className="flex items-center justify-between gap-2 border-b border-white/5 px-1 py-2"><div className="min-w-0"><div className="truncate text-[11px] font-bold text-white">{update.seatName}</div><div className="text-[9px] text-text-muted">{update.stateShortName} · {update.seatCode}</div></div><span className="shrink-0 text-[10px] font-bold" style={{ color: update.result === "WIN" ? partyColor : update.result === "LOSS" ? "var(--warn-orange)" : "var(--text-muted)" }}>{update.winnerLabel}</span></div>)}</div></aside>
      </div>
    </div>
  </div>;
}
