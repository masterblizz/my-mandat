"use client";

// Civitas-style city-builder dock for the term: a persistent strip (agenda
// and build toggles, treasury, the term clock) that expands into either the
// YB agenda (supplied by the page) or a categorised build toolbar, a
// problems list and the construction queue. Pure view: /kawasan computes
// every card and owns all state changes, so gameplay rules stay in one place.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { t, type Lang } from "../i18n/useLang";
import { formatNumber } from "../utils/format";
import type { CityLedger } from "../data/cityEconomy";

export type DockStat = "infra" | "welfare" | "economy";
export type DockTab = "all" | DockStat | "issues" | "works";
export type DockMode = "agenda" | "build" | null;

export type DockCard = {
  id: string; icon: string; title: string; cost: number;
  target: DockStat; targetLabel: string; boost: number;
  status: "ready" | "locked" | "budget" | "built" | "building";
  note: string;
};
export type DockProblem = {
  zoneId: string; zoneLabel: string; zoneIcon: string; statLabel: string; value: number; stat: DockStat;
  suggestion?: { id: string; icon: string; title: string; cost: number; affordable: boolean };
};
export type PlaceOption = { zoneId: string; label: string; icon: string; from: number; gain: number };
export type DockPlacement = {
  icon: string; title: string; cost: number; statLabel: string;
  /** the best zones for this project, best first */
  options: PlaceOption[];
  /** the zone being aimed at; `blocked` says why it cannot take the project */
  target: (PlaceOption & { blocked: string | null }) | null;
  /** empty land picked in the city instead of a zone */
  land: { label: string; from: number; gain: number; prep: number; blocked: string | null } | null;
  /** this project can found a new zone on empty land */
  landOk: boolean;
};
export type DockWork = { key: string; zoneId: string; zoneLabel: string; icon: string; title: string; remaining: number; progress: number };

const mono = { fontFamily: "'Space Mono', monospace" } as const;
const box = { background: "rgb(var(--bg-rgb) / .94)", backdropFilter: "blur(14px)" } as const;

function signedRM(value: number) {
  return `${value >= 0 ? "+" : "−"}RM ${formatNumber(Math.abs(value))}`;
}

function scoreColor(value: number) {
  return value >= 70 ? "var(--neon-green)" : value >= 45 ? "var(--gold)" : "var(--neon-red)";
}

export default function BuildDock({
  lang, mode, onMode, tab, onTab, budget, forecast, month, termEnded, cards, problems, works,
  selectedZone, pending, onPickProject, onCancelPlacement, onPlacementTarget, onConfirmPlacement, onBuildSuggested, onFocusZone, onAdvanceQuarter,
  clock, agenda, agendaBadge,
}: {
  lang: Lang;
  mode: DockMode;
  onMode: (mode: DockMode) => void;
  /** Term clock controls; replaces the advance-quarter button when given. */
  clock?: ReactNode;
  /** YB agenda panel; enables the AGENDA toggle when given. */
  agenda?: ReactNode;
  agendaBadge?: string;
  tab: DockTab;
  onTab: (tab: DockTab) => void;
  budget: number;
  forecast: CityLedger;
  month: number;
  termEnded: boolean;
  cards: DockCard[];
  problems: DockProblem[];
  works: DockWork[];
  selectedZone: { label: string; icon: string; sentiment: number; stats: { key: DockStat; label: string; value: number }[] } | null;
  pending: DockPlacement | null;
  onPickProject: (id: string) => void;
  onCancelPlacement: () => void;
  onPlacementTarget: (zoneId: string) => void;
  onConfirmPlacement: () => void;
  onBuildSuggested: (zoneId: string, projectId: string) => void;
  onFocusZone: (zoneId: string) => void;
  onAdvanceQuarter: () => void;
}) {
  const quarter = Math.min(20, Math.floor((month - 1) / 3) + 1);
  const tabs: { id: DockTab; label: string }[] = [
    { id: "all", label: t(lang, "SEMUA", "ALL") },
    { id: "infra", label: "INFRA" },
    { id: "welfare", label: t(lang, "RAKYAT", "WELFARE") },
    { id: "economy", label: t(lang, "EKONOMI", "ECONOMY") },
    { id: "issues", label: `⚠ ${t(lang, "MASALAH", "ISSUES")} ${problems.length}` },
    { id: "works", label: `🚧 ${t(lang, "PEMBINAAN", "WORKS")} ${works.length}` },
  ];
  const visibleCards = tab === "all" ? cards : cards.filter((card) => card.target === tab);
  const open = mode === "build";
  const toggle = (next: Exclude<DockMode, null>) => onMode(mode === next ? null : next);

  return (
    <div className="city-build-dock city-hud-box absolute bottom-3 left-1/2 z-30 w-[min(780px,calc(100%-300px))] -translate-x-1/2" style={mono}>
      {pending && (
        <section role="status" aria-label={t(lang, "Mod penempatan", "Placement mode")} className="city-placement mb-2 border px-3 py-2 shadow-xl" style={{ ...box, borderColor: "rgb(var(--gold-rgb) / .75)", boxShadow: "0 0 22px rgb(var(--gold-rgb) / .18)" }}>
          <div className="flex items-center gap-2 text-[10px] font-black tracking-wider text-gold">
            <span className="animate-pulse" aria-hidden>◎</span>
            <span className="min-w-0 flex-1 truncate">{pending.icon} {pending.title} · RM {formatNumber(pending.cost)} · <span className="text-white">{pending.landOk ? t(lang, "pilih zon ★ atau ketik tanah kosong", "pick a ★ zone or tap empty land") : t(lang, "pilih zon (★ = paling perlu)", "pick a zone (★ = most need)")}</span></span>
            <button type="button" onClick={onCancelPlacement} className="nhud-btn nhud-btn--cream shrink-0 border px-2 py-1 text-cyan" style={{ borderColor: "rgb(var(--cyan-rgb) / .45)" }}>{t(lang, "Batal", "Cancel")}</button>
          </div>
          {pending.options.length > 0 && (
            <div className="city-placement__options mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
              {pending.options.map((option, index) => {
                const on = pending.target?.zoneId === option.zoneId;
                return (
                  <button key={option.zoneId} type="button" onClick={() => onPlacementTarget(option.zoneId)} aria-pressed={on}
                    className="city-placement__option shrink-0 border px-2 py-1 text-left"
                    style={{ borderColor: on ? "var(--gold)" : "rgb(var(--cyan-rgb) / .28)", background: on ? "rgb(var(--gold-rgb) / .16)" : "rgb(var(--bg-rgb) / .6)" }}>
                    <div className="max-w-[150px] truncate text-[9px] font-black text-white">{index === 0 ? "★ " : ""}{option.icon} {option.label}</div>
                    <div className="text-[8px] font-bold" style={{ color: scoreColor(option.from) }}>{pending.statLabel} {option.from} → <span className="text-neon-green">{Math.min(100, option.from + option.gain)}</span> <span className="text-text-muted">(+{option.gain})</span></div>
                  </button>
                );
              })}
            </div>
          )}
          {pending.land ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-black text-white">🟩 {pending.land.label}</div>
                {pending.land.blocked
                  ? <div className="truncate text-[9px] font-bold text-warn-orange">⚠ {pending.land.blocked}</div>
                  : <div className="truncate text-[9px] font-bold text-text-muted">{pending.statLabel} <b style={{ color: scoreColor(pending.land.from) }}>{pending.land.from}</b> → <b className="text-neon-green">{Math.min(100, pending.land.from + pending.land.gain)}</b> · {t(lang, "penyediaan tapak", "site prep")} +RM {formatNumber(pending.land.prep)}</div>}
              </div>
              <button type="button" onClick={onConfirmPlacement} disabled={!!pending.land.blocked}
                className="nhud-btn nhud-btn--gold shrink-0 border px-3 py-1.5 text-[10px] font-black disabled:cursor-not-allowed disabled:opacity-45"
                style={{ borderColor: "rgb(var(--gold-rgb) / .6)", color: "var(--gold)" }}>
                🏗 {t(lang, "Bina di sini", "Build here")}
              </button>
            </div>
          ) : pending.target ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-black text-white">{pending.target.icon} {pending.target.label}</div>
                {pending.target.blocked
                  ? <div className="truncate text-[9px] font-bold text-warn-orange">⚠ {pending.target.blocked}</div>
                  : <div className="truncate text-[9px] font-bold text-text-muted">{pending.statLabel} <b style={{ color: scoreColor(pending.target.from) }}>{pending.target.from}</b> → <b className="text-neon-green">{Math.min(100, pending.target.from + pending.target.gain)}</b> · {t(lang, "siap dalam 2 suku", "ready in 2 quarters")}</div>}
              </div>
              <button type="button" onClick={onConfirmPlacement} disabled={!!pending.target.blocked}
                className="nhud-btn nhud-btn--gold shrink-0 border px-3 py-1.5 text-[10px] font-black disabled:cursor-not-allowed disabled:opacity-45"
                style={{ borderColor: "rgb(var(--gold-rgb) / .6)", color: "var(--gold)" }}>
                🏗 {t(lang, "Bina di sini", "Build here")}
              </button>
            </div>
          ) : <div className="mt-1 text-[9px] text-text-muted">{pending.options.length ? t(lang, "Ketik zon pada bandar atau pilih cadangan di atas.", "Tap a zone in the city or pick a suggestion above.") : t(lang, "Tiada zon yang layak untuk projek ini sekarang.", "No zone can take this project right now.")}</div>}
        </section>
      )}

      {mode === "agenda" && agenda && (
        <section aria-label={t(lang, "Agenda YB", "YB agenda")} className="mb-2 border shadow-2xl" style={{ ...box, borderColor: "rgb(var(--cyan-rgb) / .5)" }}>
          {agenda}
        </section>
      )}

      {open && (
        <section aria-label={t(lang, "Bina bandar", "Build the city")} className="mb-2 border shadow-2xl" style={{ ...box, borderColor: "rgb(var(--gold-rgb) / .5)" }}>
          {selectedZone && (
            <div className="flex items-center gap-3 border-b px-3 py-2" style={{ borderColor: "rgb(var(--cyan-rgb) / .15)" }}>
              <span className="text-lg">{selectedZone.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[9px] font-black tracking-widest text-white">{selectedZone.label}</div>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {selectedZone.stats.map((stat) => (
                    <div key={stat.key} className="text-[8px] font-bold tracking-wider text-text-muted">
                      <div className="flex justify-between"><span>{stat.label}</span><span style={{ color: scoreColor(stat.value) }}>{stat.value}</span></div>
                      <div className="mt-0.5 h-1" style={{ background: "var(--bar-empty)" }}><div className="h-full" style={{ width: `${stat.value}%`, background: scoreColor(stat.value), transition: "width .6s" }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-2xl font-black" style={{ color: scoreColor(selectedZone.sentiment) }}>{selectedZone.sentiment}</div>
            </div>
          )}
          <div role="tablist" className="flex gap-1 overflow-x-auto border-b px-2 pt-2" style={{ borderColor: "rgb(var(--cyan-rgb) / .15)" }}>
            {tabs.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => onTab(item.id)}
                className="shrink-0 border-b-2 px-2 pb-1.5 text-[8px] font-black tracking-widest"
                style={{ borderColor: tab === item.id ? "var(--gold)" : "transparent", color: tab === item.id ? "var(--gold)" : "var(--text-muted)" }}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="city-build-dock__body max-h-[min(38vh,300px)] overflow-y-auto p-2">
            {(tab === "all" || tab === "infra" || tab === "welfare" || tab === "economy") && (
              <SwipeRow lang={lang} resetKey={tab}>
                {visibleCards.map((card) => {
                  const disabled = card.status === "budget" || termEnded;
                  const accent = card.status === "ready" ? "var(--gold)" : card.status === "built" ? "var(--neon-green)" : card.status === "building" ? "var(--cyan)" : card.status === "locked" ? "var(--warn-orange)" : "var(--neon-red)";
                  return (
                    <button key={card.id} type="button" disabled={disabled} onClick={() => onPickProject(card.id)}
                      className="city-build-card w-[46%] shrink-0 snap-start border p-2 text-left sm:w-[31%] lg:w-[23.5%] transition enabled:hover:-translate-y-0.5 enabled:hover:border-gold/70 disabled:cursor-not-allowed disabled:opacity-45"
                      style={{ borderColor: pending?.title === card.title ? "rgb(var(--gold-rgb) / .8)" : "rgb(var(--cyan-rgb) / .2)", background: "rgb(var(--bg-rgb) / .7)" }}>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-lg leading-none">{card.status === "locked" ? "🔒" : card.icon}</span>
                        <span className="text-[8px] font-black" style={{ color: accent }}>RM {formatNumber(card.cost)}</span>
                      </div>
                      <div className="mt-1 line-clamp-2 min-h-[24px] text-[9px] font-black leading-tight text-white">{card.title}</div>
                      <div className="mt-0.5 flex justify-between gap-1 text-[8px] font-bold">
                        <span className="text-cyan">+{card.boost} {card.targetLabel}</span>
                      </div>
                      <div className="mt-0.5 line-clamp-2 min-h-[20px] text-[8px] leading-tight" style={{ color: accent }}>{card.note}</div>
                    </button>
                  );
                })}
              </SwipeRow>
            )}

            {tab === "issues" && (problems.length ? (
              <ul className="space-y-1.5">
                {problems.map((problem) => (
                  <li key={problem.zoneId} className="flex flex-col items-stretch gap-2 border p-2 sm:flex-row sm:items-center" style={{ borderColor: "rgb(255 68 68 / .3)", background: "rgb(255 68 68 / .05)" }}>
                    <button type="button" onClick={() => onFocusZone(problem.zoneId)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-[9px] font-black text-white">{problem.zoneIcon} {problem.zoneLabel}</div>
                      <div className="text-[8px] font-bold tracking-wider" style={{ color: scoreColor(problem.value) }}>{problem.statLabel} {problem.value} · {t(lang, "lihat pada peta ›", "show on map ›")}</div>
                    </button>
                    {problem.suggestion && (
                      <button type="button" disabled={!problem.suggestion.affordable || termEnded} onClick={() => onBuildSuggested(problem.zoneId, problem.suggestion!.id)}
                        className="max-w-full truncate border px-2 py-1.5 text-left text-[8px] font-black tracking-wider disabled:cursor-not-allowed disabled:opacity-40 sm:max-w-[60%] sm:shrink-0"
                        style={{ borderColor: "rgb(var(--gold-rgb) / .55)", color: "var(--gold)", background: "rgb(var(--gold-rgb) / .08)" }}>
                        {problem.suggestion.icon} {t(lang, "BINA", "BUILD")} {problem.suggestion.title} · RM {formatNumber(problem.suggestion.cost)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="p-3 text-center text-[9px] text-text-muted">{t(lang, "Tiada zon kritikal. Penduduk berpuas hati buat masa ini.", "No critical zones. Residents are satisfied for now.")}</p>)}

            {tab === "works" && (works.length ? (
              <ul className="space-y-1.5">
                {works.map((work) => (
                  <li key={work.key}>
                    <button type="button" onClick={() => onFocusZone(work.zoneId)} className="w-full border p-2 text-left" style={{ borderColor: "rgb(var(--cyan-rgb) / .22)", background: "rgb(var(--bg-rgb) / .6)" }}>
                      <div className="flex justify-between gap-2 text-[9px] font-black">
                        <span className="truncate text-white">🚧 {work.icon} {work.title} · <span className="text-text-muted">{work.zoneLabel}</span></span>
                        <span className="shrink-0 text-gold">{t(lang, `${work.remaining} SUKU LAGI`, `${work.remaining}Q LEFT`)}</span>
                      </div>
                      <div className="mt-1 h-1.5" style={{ background: "var(--bar-empty)" }}><div className="h-full" style={{ width: `${Math.round(work.progress * 100)}%`, background: "var(--gold)" }} /></div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="p-3 text-center text-[9px] text-text-muted">{t(lang, "Tiada pembinaan aktif. Pilih projek untuk mula membina.", "No active construction. Pick a project to start building.")}</p>)}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-stretch gap-1.5 border p-1.5 shadow-2xl" style={{ ...box, borderColor: "rgb(var(--cyan-rgb) / .45)" }}>
        {agenda && (
          <button type="button" onClick={() => toggle("agenda")} aria-expanded={mode === "agenda"}
            className="nhud-btn nhud-btn--cream shrink-0 border px-2.5 py-1.5 text-[10px] font-black tracking-widest"
            style={{ borderColor: "rgb(var(--cyan-rgb) / .65)", color: mode === "agenda" ? "var(--bg)" : "var(--cyan)", background: mode === "agenda" ? "var(--cyan)" : "rgb(var(--cyan-rgb) / .1)" }}>
            📋 <span className="hidden sm:inline">{t(lang, "AGENDA", "AGENDA")}</span>{agendaBadge ? <span className="ml-1 opacity-80">{agendaBadge}</span> : null}
          </button>
        )}
        <button type="button" onClick={() => toggle("build")} aria-expanded={open}
          className="nhud-btn nhud-btn--gold shrink-0 border px-2.5 py-1.5 text-[10px] font-black tracking-widest"
          style={{ borderColor: "rgb(var(--gold-rgb) / .65)", color: open ? "var(--bg)" : "var(--gold)", background: open ? "var(--gold)" : "rgb(var(--gold-rgb) / .1)" }}>
          🏗 <span className={agenda ? "hidden sm:inline" : undefined}>{t(lang, "BINA", "BUILD")}</span> {open ? "▾" : "▴"}
        </button>
        <div className={`grid min-w-0 flex-1 grid-cols-1 gap-1.5 text-[8px] font-bold tracking-wider ${clock ? "lg:grid-cols-2" : "sm:grid-cols-3"}`}>
          <div className="min-w-0 px-1">
            <div className="hidden truncate text-text-muted sm:block">{t(lang, "BAJET AWAM", "PUBLIC BUDGET")}</div>
            <div className="truncate text-[11px] font-black text-gold">RM {formatNumber(budget)}</div>
            <div className="truncate text-[8px] sm:hidden" style={{ color: forecast.net >= 0 ? "var(--neon-green)" : "var(--neon-red)" }}>{signedRM(forecast.net)} / {t(lang, "suku", "qtr")}</div>
          </div>
          <div className={`hidden min-w-0 px-1 ${clock ? "lg:block" : "sm:block"}`} title={`${t(lang, "Geran", "Grant")} RM ${formatNumber(forecast.grant)} · ${t(lang, "Cukai", "Tax")} RM ${formatNumber(forecast.tax)} · ${t(lang, "Senggaraan", "Upkeep")} −RM ${formatNumber(forecast.upkeep)}`}>
            <div className="truncate text-text-muted">{t(lang, "SUKU SETERUSNYA", "NEXT QUARTER")}</div>
            <div className="truncate text-[11px] font-black" style={{ color: forecast.net >= 0 ? "var(--neon-green)" : "var(--neon-red)" }}>{signedRM(forecast.net)}</div>
          </div>
          <div className={`hidden min-w-0 px-1 ${clock ? "" : "sm:block"}`}>
            <div className="truncate text-text-muted">{t(lang, "SENTIMEN", "SENTIMENT")} · 🚧 {works.length}</div>
            <div className="truncate text-[11px] font-black" style={{ color: scoreColor(forecast.avgSentiment) }}>{forecast.avgSentiment}% · {forecast.built} {t(lang, "kemudahan", "facilities")}</div>
          </div>
        </div>
        {clock ?? <button type="button" onClick={onAdvanceQuarter}
          className="shrink-0 border px-2 text-[9px] font-black tracking-widest"
          style={{ borderColor: "rgb(var(--cyan-rgb) / .55)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / .08)" }}>
          {termEnded ? t(lang, "KAD LAPORAN →", "REPORT CARD →") : <>{t(lang, `S${quarter}/20`, `Q${quarter}/20`)}<span className="hidden sm:inline"> · {t(lang, "MAJU", "NEXT")}</span> →</>}
        </button>}
      </div>
    </div>
  );
}

/** One row of build cards: swipe left/right (or the ◀ ▶ buttons), with
 *  a "1–4 / 12" counter, so the panel stays one card tall over the city. */
function SwipeRow({ lang, resetKey, children }: { lang: Lang; resetKey: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ first: 1, last: 1, total: 0, start: true, end: true });
  const measure = () => {
    const el = track.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    const left = el.scrollLeft, right = left + el.clientWidth;
    const shown = cards.map((card, i) => ({ i, a: card.offsetLeft, b: card.offsetLeft + card.offsetWidth })).filter((c) => (c.a + c.b) / 2 > left && (c.a + c.b) / 2 < right);
    setView({ first: (shown[0]?.i ?? 0) + 1, last: (shown[shown.length - 1]?.i ?? 0) + 1, total: cards.length, start: left <= 2, end: right >= el.scrollWidth - 2 });
  };
  useEffect(() => {
    if (track.current) track.current.scrollLeft = 0;
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const page = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.92, behavior: "smooth" });
  return (
    <div className="city-swipe relative">
      <div ref={track} onScroll={measure} className="city-swipe__track flex snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-smooth pb-1" style={{ scrollbarWidth: "none", touchAction: "pan-x" }}>
        {children}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[8px] font-black tracking-widest text-text-muted">
        <button type="button" onClick={() => page(-1)} disabled={view.start} aria-label={t(lang, "Sebelum", "Previous")} className="city-swipe__arrow px-2 py-0.5 disabled:opacity-30">◀</button>
        <span>{view.total ? `${view.first}–${view.last} / ${view.total}` : ""} · {t(lang, "leret kiri / kanan", "swipe left / right")}</span>
        <button type="button" onClick={() => page(1)} disabled={view.end} aria-label={t(lang, "Seterusnya", "Next")} className="city-swipe__arrow px-2 py-0.5 disabled:opacity-30">▶</button>
      </div>
    </div>
  );
}
