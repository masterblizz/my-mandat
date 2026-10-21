"use client";

// Civitas-style city-builder dock for the government term: a persistent
// treasury strip (budget, next-quarter forecast, works in progress, advance
// quarter) that expands into a categorised build toolbar, a problems list
// and the construction queue. Pure view: /kawasan computes every card and
// owns all state changes, so gameplay rules stay in one place.

import { t, type Lang } from "../i18n/useLang";
import { formatNumber } from "../utils/format";
import type { CityLedger } from "../data/cityEconomy";

export type DockStat = "infra" | "welfare" | "economy";
export type DockTab = "all" | DockStat | "issues" | "works";

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
  lang, open, onToggle, tab, onTab, budget, forecast, month, termEnded, cards, problems, works,
  selectedZone, pending, onPickProject, onCancelPlacement, onBuildSuggested, onFocusZone, onAdvanceQuarter,
}: {
  lang: Lang;
  open: boolean;
  onToggle: () => void;
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
  pending: { icon: string; title: string } | null;
  onPickProject: (id: string) => void;
  onCancelPlacement: () => void;
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

  return (
    <div className="city-build-dock city-hud-box absolute bottom-3 left-1/2 z-30 w-[min(780px,calc(100%-300px))] -translate-x-1/2" style={mono}>
      {pending && (
        <div role="status" className="mb-2 flex items-center gap-2 border px-3 py-2 text-[9px] font-black tracking-widest shadow-xl" style={{ ...box, borderColor: "rgb(var(--gold-rgb) / .75)", color: "var(--gold)", boxShadow: "0 0 22px rgb(var(--gold-rgb) / .18)" }}>
          <span className="animate-pulse">◎</span>
          <span className="min-w-0 flex-1 truncate">{t(lang, "MOD PENEMPATAN", "PLACEMENT MODE")}: {pending.icon} {pending.title} — {t(lang, "klik zon pada bandar", "click a zone in the city")}</span>
          <button type="button" onClick={onCancelPlacement} className="border px-2 py-1 text-cyan" style={{ borderColor: "rgb(var(--cyan-rgb) / .45)" }}>{t(lang, "BATAL", "CANCEL")}</button>
        </div>
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
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {visibleCards.map((card) => {
                  const disabled = card.status === "budget" || termEnded;
                  const accent = card.status === "ready" ? "var(--gold)" : card.status === "built" ? "var(--neon-green)" : card.status === "building" ? "var(--cyan)" : card.status === "locked" ? "var(--warn-orange)" : "var(--neon-red)";
                  return (
                    <button key={card.id} type="button" disabled={disabled} onClick={() => onPickProject(card.id)}
                      className="border p-2 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-gold/70 disabled:cursor-not-allowed disabled:opacity-45"
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
              </div>
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

      <div className="flex items-stretch gap-1.5 border p-1.5 shadow-2xl" style={{ ...box, borderColor: "rgb(var(--cyan-rgb) / .45)" }}>
        <button type="button" onClick={onToggle} aria-expanded={open}
          className="shrink-0 border px-3 text-[10px] font-black tracking-widest"
          style={{ borderColor: "rgb(var(--gold-rgb) / .65)", color: open ? "var(--bg)" : "var(--gold)", background: open ? "var(--gold)" : "rgb(var(--gold-rgb) / .1)" }}>
          🏗 {t(lang, "BINA", "BUILD")} {open ? "▾" : "▴"}
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 text-[8px] font-bold tracking-wider sm:grid-cols-3">
          <div className="min-w-0 px-1">
            <div className="hidden truncate text-text-muted sm:block">{t(lang, "BAJET AWAM", "PUBLIC BUDGET")}</div>
            <div className="truncate text-[11px] font-black text-gold">RM {formatNumber(budget)}</div>
            <div className="truncate text-[8px] sm:hidden" style={{ color: forecast.net >= 0 ? "var(--neon-green)" : "var(--neon-red)" }}>{signedRM(forecast.net)} / {t(lang, "suku", "qtr")}</div>
          </div>
          <div className="hidden min-w-0 px-1 sm:block" title={`${t(lang, "Geran", "Grant")} RM ${formatNumber(forecast.grant)} · ${t(lang, "Cukai", "Tax")} RM ${formatNumber(forecast.tax)} · ${t(lang, "Senggaraan", "Upkeep")} −RM ${formatNumber(forecast.upkeep)}`}>
            <div className="truncate text-text-muted">{t(lang, "SUKU SETERUSNYA", "NEXT QUARTER")}</div>
            <div className="truncate text-[11px] font-black" style={{ color: forecast.net >= 0 ? "var(--neon-green)" : "var(--neon-red)" }}>{signedRM(forecast.net)}</div>
          </div>
          <div className="hidden min-w-0 px-1 sm:block">
            <div className="truncate text-text-muted">{t(lang, "SENTIMEN", "SENTIMENT")} · 🚧 {works.length}</div>
            <div className="truncate text-[11px] font-black" style={{ color: scoreColor(forecast.avgSentiment) }}>{forecast.avgSentiment}% · {forecast.built} {t(lang, "kemudahan", "facilities")}</div>
          </div>
        </div>
        <button type="button" onClick={onAdvanceQuarter}
          className="shrink-0 border px-2 text-[9px] font-black tracking-widest"
          style={{ borderColor: "rgb(var(--cyan-rgb) / .55)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / .08)" }}>
          {termEnded ? t(lang, "KAD LAPORAN →", "REPORT CARD →") : <>{t(lang, `S${quarter}/20`, `Q${quarter}/20`)}<span className="hidden sm:inline"> · {t(lang, "MAJU", "NEXT")}</span> →</>}
        </button>
      </div>
    </div>
  );
}
