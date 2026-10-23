"use client";

// The YB's working week on /kawasan: the running term clock (pause/play,
// speed, date, Dewan sitting) and the agenda panel (activities limited by
// weekly slots and stamina, plus open constituent complaints). Pure view —
// rules live in store/termClock.ts; /kawasan wires state and handlers.

import { t, type Lang } from "../i18n/useLang";
import { formatNumber } from "../utils/format";
import {
  GAME_SPEEDS, SPEED_LABEL, STAMINA_MAX, TERM_DAYS, WEEK_SLOTS, YB_ISSUES, termCalendar,
  type GameSpeed, type YbActivity, type YbIssue, type YbService,
} from "../data/ybService";

type Bilingual = { ms: string; en: string };

const SPEED_SHORT: Record<GameSpeed, Bilingual> = {
  day: { ms: "H", en: "D" }, week: { ms: "M", en: "W" }, month: { ms: "B", en: "M" }, quarter: { ms: "S", en: "Q" },
};

export function TermClockControls({ lang, running, onToggle, speed, onSpeed, onStep, termDay, sitting, ended, onReport }: {
  lang: Lang; running: boolean; onToggle: () => void; speed: GameSpeed; onSpeed: (speed: GameSpeed) => void;
  onStep: () => void; termDay: number; sitting: boolean; ended: boolean; onReport: () => void;
}) {
  const cal = termCalendar(termDay);
  if (ended) {
    return (
      <button type="button" onClick={onReport} className="shrink-0 border px-3 py-1.5 text-[9px] font-black tracking-widest"
        style={{ borderColor: "rgb(var(--gold-rgb) / .7)", color: "var(--gold)", background: "rgb(var(--gold-rgb) / .1)" }}>
        {t(lang, "PENGGAL TAMAT · KAD LAPORAN →", "TERM OVER · REPORT CARD →")}
      </button>
    );
  }
  return (
    <div className="term-clock flex min-w-0 shrink-0 items-stretch gap-1" aria-label={t(lang, "Jam penggal", "Term clock")}>
      <button type="button" onClick={onToggle} aria-pressed={running} aria-label={running ? t(lang, "Jeda", "Pause") : t(lang, "Main", "Play")}
        className="w-9 border text-[13px] font-black"
        style={{ borderColor: running ? "rgb(var(--gold-rgb) / .7)" : "rgb(var(--cyan-rgb) / .6)", color: running ? "var(--gold)" : "var(--cyan)", background: running ? "rgb(var(--gold-rgb) / .12)" : "rgb(var(--cyan-rgb) / .1)" }}>
        {running ? "⏸" : "▶"}
      </button>
      <div role="radiogroup" aria-label={t(lang, "Kelajuan", "Speed")} className="flex border" style={{ borderColor: "rgb(var(--cyan-rgb) / .35)" }}>
        {GAME_SPEEDS.map((option) => (
          <button key={option} type="button" role="radio" aria-checked={speed === option} title={SPEED_LABEL[option][lang]} onClick={() => onSpeed(option)}
            className="w-6 text-[9px] font-black" style={{ color: speed === option ? "var(--bg)" : "var(--text-muted)", background: speed === option ? "var(--cyan)" : "transparent" }}>
            {SPEED_SHORT[option][lang]}
          </button>
        ))}
      </div>
      {!running && (
        <button type="button" onClick={onStep} title={t(lang, `Maju satu langkah (${SPEED_LABEL[speed].ms.toLowerCase()})`, `Step once (${SPEED_LABEL[speed].en.toLowerCase()})`)}
          className="w-7 border text-[10px] font-black text-cyan" style={{ borderColor: "rgb(var(--cyan-rgb) / .35)" }}>⏭</button>
      )}
      <div className="min-w-0 px-1 text-[8px] font-bold leading-tight tracking-wider">
        <div className="whitespace-nowrap text-white">{t(lang, `HARI ${cal.day} · MGG ${cal.week}`, `DAY ${cal.day} · WK ${cal.week}`)}</div>
        <div className="whitespace-nowrap" style={{ color: sitting ? "var(--gold)" : "var(--text-muted)" }}>
          {t(lang, `S${cal.quarter}/20`, `Q${cal.quarter}/20`)}{sitting ? ` · 🏛️ ${t(lang, "DEWAN", "DEWAN")}` : ""}
        </div>
        <div className="mt-0.5 h-0.5 w-full" style={{ background: "var(--bar-empty)" }}><div className="h-full" style={{ width: `${(termDay / TERM_DAYS) * 100}%`, background: "var(--cyan)" }} /></div>
      </div>
    </div>
  );
}

function Meter({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="min-w-0 flex-1 text-[8px] font-bold tracking-wider text-text-muted">
      <div className="flex justify-between gap-2"><span className="truncate">{label}</span><span style={{ color }}>{Math.round(value)}</span></div>
      <div className="mt-0.5 h-1" style={{ background: "var(--bar-empty)" }}><div className="h-full" style={{ width: `${(value / max) * 100}%`, background: color, transition: "width .4s" }} /></div>
    </div>
  );
}

export type AgendaActivity = { activity: YbActivity; blocker: Bilingual | null };
export type AgendaIssue = YbIssue & { zoneLabel: string; daysLeft: number };

export function YbAgendaPanel({ lang, service, activities, issues, zoneLabel, onActivity, onIssueVisit, onIssueFocus }: {
  lang: Lang; service: YbService; activities: AgendaActivity[]; issues: AgendaIssue[]; zoneLabel: string | null;
  onActivity: (id: YbActivity["id"]) => void; onIssueVisit: (issue: AgendaIssue) => void; onIssueFocus: (issue: AgendaIssue) => void;
}) {
  return (
    <div className="max-h-[min(44vh,340px)] overflow-y-auto p-2" style={{ fontFamily: "'Space Mono', monospace" }}>
      <div className="flex flex-wrap items-center gap-3 border-b pb-2" style={{ borderColor: "rgb(var(--cyan-rgb) / .15)" }}>
        <div className="text-[8px] font-bold tracking-wider text-text-muted">
          {t(lang, "SLOT MINGGU INI", "SLOTS THIS WEEK")}
          <div className="mt-0.5 flex gap-1">{Array.from({ length: WEEK_SLOTS }, (_, i) => <span key={i} className="h-2.5 w-4 border" style={{ borderColor: "rgb(var(--cyan-rgb) / .6)", background: i < service.slots ? "var(--cyan)" : "transparent" }} />)}</div>
        </div>
        <Meter label={t(lang, "TENAGA", "STAMINA")} value={service.stamina} max={STAMINA_MAX} color="var(--neon-green)" />
        <Meter label={t(lang, "KEHADIRAN", "PRESENCE")} value={service.presence} max={100} color="var(--gold)" />
        <div className="text-[8px] font-bold tracking-wider text-text-muted">
          {t(lang, "ADUAN", "COMPLAINTS")}
          <div className="text-[10px] font-black"><span className="text-neon-green">✓{service.resolved}</span> <span style={{ color: "var(--neon-red)" }}>✗{service.missed}</span></div>
        </div>
      </div>

      {issues.length > 0 && (
        <ul className="mt-2 space-y-1">
          {issues.map((issue) => {
            const info = YB_ISSUES[issue.type];
            const urgent = issue.daysLeft <= 7;
            return (
              <li key={issue.id} className="flex items-center gap-2 border px-2 py-1.5" style={{ borderColor: urgent ? "rgb(255 68 68 / .5)" : "rgb(var(--gold-rgb) / .35)", background: urgent ? "rgb(255 68 68 / .06)" : "rgb(var(--gold-rgb) / .05)" }}>
                <button type="button" onClick={() => onIssueFocus(issue)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[9px] font-black text-white">{info.icon} {info.title[lang]}</div>
                  <div className="truncate text-[8px] font-bold" style={{ color: urgent ? "var(--neon-red)" : "var(--gold)" }}>{issue.zoneLabel} · {t(lang, `${issue.daysLeft} hari lagi`, `${issue.daysLeft} days left`)}</div>
                </button>
                <button type="button" onClick={() => onIssueVisit(issue)} className="shrink-0 border px-2 py-1 text-[8px] font-black tracking-wider text-cyan" style={{ borderColor: "rgb(var(--cyan-rgb) / .5)" }}>
                  🚶 {t(lang, "TURUN PADANG", "VISIT")}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {activities.map(({ activity, blocker }) => (
          <button key={activity.id} type="button" disabled={!!blocker} onClick={() => onActivity(activity.id)}
            title={blocker ? blocker[lang] : activity.detail[lang]}
            className="border p-2 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-cyan/70 disabled:cursor-not-allowed disabled:opacity-45"
            style={{ borderColor: "rgb(var(--cyan-rgb) / .22)", background: "rgb(var(--bg-rgb) / .7)" }}>
            <div className="flex items-start justify-between gap-1">
              <span className="text-lg leading-none">{activity.icon}</span>
              <span className="text-right text-[8px] font-black leading-tight text-cyan">{activity.slots} {t(lang, "slot", "slot")}<br /><span className="text-neon-green">⚡{activity.stamina}</span></span>
            </div>
            <div className="mt-1 line-clamp-2 min-h-[24px] text-[9px] font-black leading-tight text-white">{activity.title[lang]}</div>
            <div className="mt-0.5 text-[8px] font-bold text-gold">{activity.cost ? `RM ${formatNumber(activity.cost)}` : t(lang, "Percuma", "Free")}{activity.zone && zoneLabel ? ` · ${zoneLabel}` : ""}</div>
            <div className="mt-0.5 line-clamp-2 min-h-[20px] text-[8px] leading-tight" style={{ color: blocker ? "var(--warn-orange)" : "var(--text-muted)" }}>{blocker ? blocker[lang] : activity.detail[lang]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
