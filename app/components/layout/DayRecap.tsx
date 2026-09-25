"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGameStore, type GameState } from "../../store/gameStore";
import { useLang, t } from "../../i18n/useLang";
import { CAMPAIGN_EVENTS, campaignEventUnlockDay } from "../../data/campaignEvents";

type Snapshot = {
  day: number; term: number; month: number; chapter: string;
  home: number; seats: number; funds: number; decisionsLeft: number; actionsToday: string[];
  trust: number; stability: number;
  lawan: Record<string, number>;
  stateSeats: Record<string, number>;
};

type Recap = {
  kind: "day" | "quarter" | "election";
  title: string;
  rows: { label: string; value: string; delta: number; format: "points" | "seats" | "money" }[];
  notes: string[];
  teaser: string;
  cta?: { label: string; href: string };
};

function scopeOf(s: GameState) {
  const isPrn = s.settings.electionScope === "prn";
  const scoped = isPrn ? s.states.filter(state => state.id === s.settings.prnStateId) : s.states;
  const totalSeats = isPrn ? scoped.reduce((n, state) => n + state.dunSeats, 0) : scoped.reduce((n, state) => n + state.seats, 0);
  const homeId = isPrn ? s.settings.prnStateId : s.leader.homeState;
  return { scoped, totalSeats, homeId };
}

function snapshot(s: GameState): Snapshot {
  const { scoped, homeId } = scopeOf(s);
  return {
    day: s.day, term: s.careerProgress.term, month: s.careerProgress.month, chapter: s.journey.chapter,
    home: s.states.find(state => state.id === homeId)?.mandatSupport ?? 0,
    seats: scoped.reduce((n, state) => n + state.projectedSeats, 0),
    funds: s.resources.funds, decisionsLeft: s.journey.decisions, actionsToday: s.journey.actionsToday,
    trust: s.journey.trust, stability: s.journey.stability,
    lawan: Object.fromEntries(scoped.map(state => [state.id, state.lawanSupport])),
    stateSeats: Object.fromEntries(scoped.map(state => [state.id, state.projectedSeats])),
  };
}

const signed = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(digits)}`;
const money = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}RM${Math.abs(Math.round(n / 1000)).toLocaleString()}k`;

/**
 * End-of-turn feedback: whenever a campaign day or governing quarter resolves
 * (from any screen), summarise what actually moved and what is coming next.
 */
export default function DayRecap() {
  const lang = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const [recap, setRecap] = useState<Recap | null>(null);
  const prev = useRef<Snapshot | null>(null);
  const mountedAt = useRef(0);

  useEffect(() => {
    mountedAt.current = Date.now();
    prev.current = snapshot(useGameStore.getState());
    return useGameStore.subscribe((state) => {
      const before = prev.current;
      const after = snapshot(state);
      prev.current = after;
      // Save hydration/loading also changes these fields — only react to a single live tick.
      if (!before || Date.now() - mountedAt.current < 2000 || after.term !== before.term) return;
      const { totalSeats } = scopeOf(state);
      const majority = Math.floor(totalSeats / 2) + 1;

      if (after.day === before.day + 1 && before.chapter === "campaign") {
        const daysLeft = state.totalDays - after.day;
        const rows = [
          { label: t(lang, "Kawasan anda", "Your seat"), value: `${after.home.toFixed(1)}%`, delta: after.home - before.home, format: "points" as const },
          { label: t(lang, "Unjuran kerusi", "Projected seats"), value: `${after.seats}/${majority}`, delta: after.seats - before.seats, format: "seats" as const },
          { label: t(lang, "Dana", "Funds"), value: `RM${(after.funds / 1_000_000).toFixed(2)}m`, delta: after.funds - before.funds, format: "money" as const },
        ];
        const notes: string[] = [];
        if (before.decisionsLeft > 0) notes.push(t(lang, `${before.decisionsLeft} keputusan tidak digunakan semalam — tenaga itu hilang.`, `${before.decisionsLeft} decision${before.decisionsLeft > 1 ? "s" : ""} went unused — that energy is gone.`));
        const tired = Object.entries(state.journey.streaks ?? {}).filter(([key, streak]) => ["visit", "fundraise", "organise"].includes(key) && streak >= 2).map(([key]) => key);
        if (tired.length) notes.push(t(lang, `Pengundi mula jemu: ${tired.map(k => ({ visit: "lawatan", fundraise: "kutipan dana", organise: "latihan" } as Record<string, string>)[k]).join(", ")} berulang. Tukar rentak.`, `Voters are tiring of repeated ${tired.join(", ")}. Change the rhythm.`));
        // Opponent pushes into swing states are the main cause of late seat slides — name where seats fell.
        const loss = state.states.filter(item => item.id in after.stateSeats && item.id in before.stateSeats).map(item => ({ item, lost: before.stateSeats[item.id] - after.stateSeats[item.id], gain: after.lawan[item.id] - before.lawan[item.id] })).sort((a, b) => b.lost - a.lost)[0];
        if (loss && loss.lost > 0) notes.push(t(lang, `Lawan merampas ${loss.lost} kerusi unjuran di ${loss.item.name} (sokongan mereka ${loss.gain >= 0 ? "+" : ""}${loss.gain.toFixed(1)}). Pertahankan negeri ini.`, `Opposition took ${loss.lost} projected seat${loss.lost > 1 ? "s" : ""} in ${loss.item.name} (their support ${loss.gain >= 0 ? "+" : ""}${loss.gain.toFixed(1)}). Defend it.`));
        if (after.seats >= majority && before.seats < majority) notes.push(t(lang, "Unjuran kini melepasi majoriti! Pertahankannya.", "Projection just crossed the majority line! Hold it."));
        if (after.seats < majority && before.seats >= majority) notes.push(t(lang, "Unjuran jatuh di bawah majoriti. Lawan sedang mengejar.", "Projection slipped below majority. The opposition is closing in."));
        if (after.chapter === "results" || daysLeft <= 0) {
          setRecap({ kind: "election", title: t(lang, "HARI MENGUNDI TIBA", "POLLING DAY HAS ARRIVED"), rows, notes, teaser: t(lang, "Peti undi ditutup. Setiap keputusan anda kini dikira kerusi demi kerusi.", "The polls are closed. Every decision you made is now counted seat by seat."), cta: { label: t(lang, "Malam keputusan →", "Election night →"), href: "/results" } });
          return;
        }
        const tomorrowEvent = CAMPAIGN_EVENTS.find(event => campaignEventUnlockDay(event, state.totalDays) === after.day);
        const upcoming = CAMPAIGN_EVENTS.map(event => ({ event, day: campaignEventUnlockDay(event, state.totalDays) })).filter(item => item.day > after.day).sort((a, b) => a.day - b.day)[0];
        const eventTitle = (event: typeof CAMPAIGN_EVENTS[number]) => (state.settings.electionScope === "prn" && event.prnTitle ? event.prnTitle : event.title)[lang];
        const teaser = tomorrowEvent
          ? t(lang, `Hari ini dibuka: ${eventTitle(tomorrowEvent)}. Satu peluang sahaja.`, `Unlocked today: ${eventTitle(tomorrowEvent)}. One shot only.`)
          : daysLeft <= 3
            ? t(lang, `Minggu akhir — ${daysLeft} hari lagi ke hari mengundi.`, `Final stretch — ${daysLeft} day${daysLeft > 1 ? "s" : ""} to polling day.`)
            : upcoming
              ? t(lang, `${eventTitle(upcoming.event)} dalam ${upcoming.day - after.day} hari · ${daysLeft} hari ke hari mengundi.`, `${eventTitle(upcoming.event)} in ${upcoming.day - after.day} day${upcoming.day - after.day > 1 ? "s" : ""} · ${daysLeft} days to polling day.`)
              : t(lang, `${daysLeft} hari ke hari mengundi.`, `${daysLeft} days to polling day.`);
        setRecap({ kind: "day", title: t(lang, `HARI ${before.day} SELESAI`, `DAY ${before.day} COMPLETE`), rows, notes, teaser, cta: tomorrowEvent ? { label: t(lang, "Ambil pentas →", "Take the stage →"), href: "/campaign?tab=MINI-GAMES" } : undefined });
        return;
      }

      if (after.month > before.month && ["government", "opposition", "rebuilding"].includes(after.chapter)) {
        const quarter = Math.ceil(after.month / 3);
        const rows = [
          { label: t(lang, "Kepercayaan", "Trust"), value: `${after.trust}/100`, delta: after.trust - before.trust, format: "points" as const },
          { label: t(lang, "Kestabilan", "Stability"), value: `${Math.round(after.stability)}/100`, delta: after.stability - before.stability, format: "points" as const },
        ];
        const notes = state.journey.journal[0] ? [state.journey.journal[0][lang]] : [];
        const teaser = after.month >= 60
          ? t(lang, "Penggal tamat. Kad laporan anda sedia — rakyat akan menilai.", "The term is over. Your report card is ready — voters will judge it.")
          : t(lang, `Suku ${quarter}/20 · ${60 - after.month} bulan ke pilihan raya seterusnya.`, `Quarter ${quarter}/20 · ${60 - after.month} months to the next election.`);
        setRecap({ kind: "quarter", title: t(lang, "SUKU TAHUN SELESAI", "QUARTER COMPLETE"), rows, notes, teaser, cta: after.month >= 60 ? { label: t(lang, "Buka kad laporan →", "Open report card →"), href: "/report-card" } : undefined });
      }
    });
  }, [lang]);

  // A recap belongs to the screen where the turn ended; never let it cover the next one (e.g. election night).
  useEffect(() => setRecap(null), [pathname]);

  useEffect(() => {
    if (!recap || recap.cta) return;
    const timer = setTimeout(() => setRecap(null), 7000);
    return () => clearTimeout(timer);
  }, [recap]);

  if (!recap) return null;
  const accent = recap.kind === "election" ? "var(--gold)" : "var(--cyan)";
  return (
    <div role="status" aria-live="polite" className="fixed bottom-14 left-1/2 z-[90] w-[min(440px,calc(100%-32px))] -translate-x-1/2 border p-4 shadow-2xl"
      style={{ borderColor: accent, background: "rgb(var(--bg-rgb) / .96)", backdropFilter: "blur(12px)", boxShadow: `0 0 28px ${recap.kind === "election" ? "rgb(var(--gold-rgb) / .35)" : "rgb(var(--cyan-rgb) / .25)"}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-black tracking-[0.28em]" style={{ color: accent }}>{recap.title}</div>
        <button type="button" onClick={() => setRecap(null)} aria-label={t(lang, "Tutup", "Close")} className="text-text-muted hover:text-white">×</button>
      </div>
      <div className={`mt-3 grid gap-2 ${recap.rows.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {recap.rows.map(row => {
          const color = Math.abs(row.delta) < (row.format === "money" ? 1 : 0.05) ? "var(--text-muted)" : row.delta > 0 ? "var(--neon-green)" : "var(--neon-red)";
          return <div key={row.label} className="border border-white/10 p-2">
            <div className="text-[8px] font-black tracking-widest text-text-muted">{row.label.toUpperCase()}</div>
            <div className="mt-1 text-sm font-black text-white">{row.value}</div>
            <div className="text-[10px] font-bold" style={{ color }}>{row.format === "money" ? money(row.delta) : row.format === "seats" ? signed(row.delta, 0) : signed(row.delta)}</div>
          </div>;
        })}
      </div>
      {recap.notes.map(note => <p key={note} className="mt-2 text-[11px] leading-relaxed text-amber-300">• {note}</p>)}
      <p className="mt-2 text-[11px] leading-relaxed text-text-muted">▸ {recap.teaser}</p>
      {recap.cta && <button type="button" onClick={() => { const href = recap.cta!.href; setRecap(null); router.push(href); }} className="mt-3 w-full py-2 text-[11px] font-black tracking-widest text-[#07111c]" style={{ background: accent }}>{recap.cta.label}</button>}
    </div>
  );
}
