"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import MalaysiaMap from "../components/map/MalaysiaMap";
import SeatDonut from "../components/charts/SeatDonut";
import { useGameStore } from "../store/gameStore";
import type { GameEvent } from "../data/events";
import { electionFlowSteps, getCampaignFlowStatus } from "../data/electionFlow";
import { getLiveNewsForDay, getLatestLiveNews } from "../data/liveNews";
import { useLang, t } from "../i18n/useLang";
import { computeThreatLevel } from "../store/opponentAI";
import type { OpponentAction } from "../store/opponentAI";
import type { PoliticalReaction } from "../data/politicalReactions";

function isPoliticalReaction(news: unknown): news is PoliticalReaction {
  return typeof news === "object" && news !== null && "opponentAttack" in news && "advisorWarning" in news;
}

const EVENT_TYPE_COLOR: Record<string, { border: string; tag: string; glow: string }> = {
  political: { border: "var(--cyan)", tag: "var(--cyan)", glow: "rgb(var(--cyan-rgb) / 0.15)" },
  economic:  { border: "var(--gold)", tag: "var(--gold)", glow: "rgb(var(--gold-rgb) / 0.15)" },
  social:    { border: "var(--neon-green)", tag: "var(--neon-green)", glow: "rgb(var(--neon-green-rgb,21 128 61) / 0.15)" },
  media:     { border: "#8b5cf6", tag: "#8b5cf6", glow: "rgba(139,92,246,0.15)" },
  ground:    { border: "var(--warn-orange)", tag: "var(--warn-orange)", glow: "rgb(255 136 0 / 0.15)" },
};

function EventModal({ event, onAck }: { event: GameEvent; onAck: () => void }) {
  const colors = EVENT_TYPE_COLOR[event.type] ?? EVENT_TYPE_COLOR.political;
  const isPositive = (event.impact.national ?? 0) >= 0 && (event.impact.stateImpact ?? 0) >= 0;
  const impactColor = isPositive ? "var(--neon-green)" : "var(--neon-red)";
  const impactPrefix = isPositive ? "▲" : "▼";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.62)" }}
    >
      <div
        className="pointer-events-auto w-full max-w-lg"
        style={{
          background: "var(--panel)",
          border: `1px solid ${colors.border}`,
          borderTop: `3px solid ${colors.border}`,
          boxShadow: `0 0 40px ${colors.glow}`,
        }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <span
              className="text-[11px] font-bold tracking-widest px-2 py-0.5 uppercase"
              style={{ color: colors.tag, background: `${colors.glow}`, border: `1px solid ${colors.border}44` }}
            >
              {event.type}
            </span>
            <span className="text-[11px] tracking-widest" style={{ color: "#4a5568" }}>
              INCOMING EVENT
            </span>
          </div>
          <span className="text-[11px] tracking-widest font-bold" style={{ color: "#4a5568" }}>
            DAY {event.day}
          </span>
        </div>

        {/* Title */}
        <div className="px-6 pb-4" style={{ borderBottom: `1px solid ${colors.border}22` }}>
          <h2
            className="font-bold tracking-wide uppercase"
            style={{ fontSize: "24px", color: "var(--text-primary)", fontFamily: "Space Mono, monospace", textShadow: `0 0 16px ${colors.border}66` }}
          >
            {event.title}
          </h2>
        </div>

        {/* Description */}
        <div className="px-6 py-4">
          <p className="text-[14px] leading-relaxed" style={{ color: "#aabbcc" }}>
            {event.description}
          </p>
        </div>

        {/* Impact */}
        <div className="px-6 pb-4">
          <div className="text-[11px] tracking-widest mb-2" style={{ color: "#4a5568" }}>IMPACT</div>
          <div className="flex flex-col gap-1.5">
            {event.impact.national !== undefined && (
              <div className="flex items-center gap-2 text-[13px]">
                <span style={{ color: impactColor }}>{impactPrefix}</span>
                <span style={{ color: "var(--text-muted)" }}>NATIONAL SUPPORT:</span>
                <span className="font-bold" style={{ color: impactColor }}>
                  {event.impact.national > 0 ? "+" : ""}{event.impact.national}%
                </span>
              </div>
            )}
            {event.impact.states && event.impact.stateImpact !== undefined && (
              <div className="flex items-center gap-2 text-[13px]">
                <span style={{ color: impactColor }}>{impactPrefix}</span>
                <span style={{ color: "var(--text-muted)" }}>
                  {event.impact.states.map(s => s.toUpperCase()).join(", ")}:
                </span>
                <span className="font-bold" style={{ color: impactColor }}>
                  {event.impact.stateImpact > 0 ? "+" : ""}{event.impact.stateImpact}%
                </span>
              </div>
            )}
            {event.impact.resource === "funds" && event.impact.resourceChange !== undefined && (
              <div className="flex items-center gap-2 text-[13px]">
                <span style={{ color: "var(--neon-red)" }}>▼</span>
                <span style={{ color: "var(--text-muted)" }}>CAMPAIGN FUNDS:</span>
                <span className="font-bold" style={{ color: "var(--neon-red)" }}>
                  RM {Math.abs(event.impact.resourceChange).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Acknowledge button */}
        <div className="px-6 pb-6 flex justify-end">
          <button
            onClick={onAck}
            className="px-8 py-2.5 text-[13px] font-bold tracking-widest uppercase transition-opacity hover:opacity-80 active:scale-95"
            style={{
              background: colors.glow,
              border: `1px solid ${colors.border}`,
              color: colors.tag,
              fontFamily: "Space Mono, monospace",
              boxShadow: `0 0 12px ${colors.glow}`,
              cursor: "pointer",
            }}
          >
            ACKNOWLEDGED →
          </button>
        </div>
      </div>
    </div>
  );
}

function formatFunds(n: number) {
  if (n >= 1_000_000) return `RM ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `RM ${(n / 1_000).toFixed(0)}K`;
  return `RM ${n}`;
}

const FLOW_TONE: Record<string, { bg: string; border: string; color: string }> = {
  purple: { bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.45)", color: "#a78bfa" },
  mint: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.42)", color: "#34d399" },
  gold: { bg: "rgb(var(--gold-rgb) / 0.10)", border: "rgb(var(--gold-rgb) / 0.42)", color: "var(--gold)" },
  neutral: { bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.36)", color: "#cbd5e1" },
  red: { bg: "rgba(255,68,68,0.10)", border: "rgba(255,68,68,0.42)", color: "var(--neon-red)" },
  green: { bg: "rgba(0,255,136,0.10)", border: "rgba(0,255,136,0.42)", color: "var(--neon-green)" },
  blue: { bg: "rgb(var(--cyan-rgb) / 0.10)", border: "rgb(var(--cyan-rgb) / 0.42)", color: "var(--cyan)" },
};

function ElectionFlowPanel({ day, totalDays, lang }: { day: number; totalDays: number; lang: "en" | "ms" }) {
  const status = getCampaignFlowStatus(day, totalDays);
  const label = lang === "ms" ? status.label : status.labelEN;
  const description = lang === "ms" ? status.current.description : status.current.descriptionEN;
  const nextTitle = lang === "ms" ? status.next.title : status.next.titleEN;
  const panelTitle = lang === "ms" ? "ALIRAN PRU MALAYSIA — 30 HARI BERKEMPEN" : "MALAYSIA ELECTION FLOW — 30-DAY CAMPAIGN";

  return (
    <TacticalPanel title={panelTitle} noPadding>
      <div className="grid grid-cols-[1.2fr_2fr] gap-0">
        <div className="p-4" style={{ borderRight: "1px solid rgb(var(--cyan-rgb) / 0.14)" }}>
          <div className="text-[10px] font-bold tracking-[0.24em]" style={{ color: "var(--gold)" }}>{lang === "ms" ? "FASA SEMASA" : "CURRENT PHASE"}</div>
          <div className="mt-2 text-lg font-black tracking-widest" style={{ color: "var(--cyan)", fontFamily: "Space Mono, monospace" }}>
            {label}
          </div>
          <div className="mt-2 text-[12px] leading-relaxed" style={{ color: "#9fb0c2" }}>
            {description}
          </div>
          <div className="mt-4 h-2 overflow-hidden" style={{ background: "rgb(var(--cyan-rgb) / 0.10)", border: "1px solid rgb(var(--cyan-rgb) / 0.18)" }}>
            <div className="h-full" style={{ width: `${status.progress}%`, background: "linear-gradient(90deg, var(--cyan), var(--gold))" }} />
          </div>
          <div className="mt-2 flex justify-between text-[10px] tracking-widest" style={{ color: "#718397" }}>
            <span>{lang === "ms" ? "KEMPEN 30 HARI" : "30-DAY CAMPAIGN"}</span>
            <span style={{ color: "var(--gold)" }}>{status.progress}%</span>
          </div>
          <div className="mt-3 text-[10px] tracking-widest" style={{ color: "#718397" }}>
            NEXT: <span style={{ color: "var(--text-primary)" }}>{nextTitle}</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 p-3">
          {electionFlowSteps.map((step) => {
            const tone = FLOW_TONE[step.tone];
            const active = step.id === "campaign";
            const stepTitle = lang === "ms" ? step.title : step.titleEN;
            const stepDesc = lang === "ms" ? step.description : step.descriptionEN;
            const stepPeriod = lang === "ms" ? step.period : step.periodEN;
            const stepGameplay = lang === "ms" ? step.gameplay : step.gameplayEN;
            return (
              <div
                key={step.id}
                className="min-h-[92px] p-2.5"
                style={{
                  background: active ? "rgb(var(--cyan-rgb) / 0.14)" : tone.bg,
                  border: `1px solid ${active ? "var(--cyan)" : tone.border}`,
                  boxShadow: active ? "0 0 18px rgb(var(--cyan-rgb) / 0.16)" : "none",
                }}
              >
                <div className="text-[8px] font-bold tracking-[0.16em]" style={{ color: tone.color }}>{stepPeriod.toUpperCase()}</div>
                <div className="mt-1 text-[10px] font-bold leading-snug text-white">{stepTitle}</div>
                <div className="mt-1 text-[8px] leading-snug" style={{ color: "#8495a8" }}>{stepDesc}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {stepGameplay.slice(0, 2).map((item) => (
                    <span key={item} className="px-1.5 py-0.5 text-[7px] font-bold" style={{ color: tone.color, border: `1px solid ${tone.border}`, background: "rgba(0,0,0,0.18)" }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TacticalPanel>
  );
}

const ACTION_ICON: Record<string, string> = {
  pressure: "◉",
  scandal: "▲",
  counter_narrative: "◆",
  media_blitz: "■",
};

const ACTION_COLOR: Record<string, string> = {
  pressure: "var(--gold)",
  scandal: "var(--neon-red)",
  counter_narrative: "var(--warn-orange)",
  media_blitz: "var(--neon-red)",
};

function OppositionIntelPanel({ log, lang, day }: { log: OpponentAction[]; lang: "en" | "ms"; day: number }) {
  const threat = computeThreatLevel(log, 3);
  const todayActions = log.filter((a) => a.day === day);
  const seen = new Set<string>();
  const targetedStateNames = log
    .filter((a) => a.stateName && a.day >= day - 2)
    .map((a) => a.stateName!)
    .filter((n) => { if (seen.has(n)) return false; seen.add(n); return true; })
    .slice(0, 3);

  const title = t(lang, "INTEL PEMBANGKANG", "OPPOSITION INTEL");

  return (
    <TacticalPanel title={title} noPadding>
      <div className="overflow-y-auto" style={{ maxHeight: "300px" }}>
        {/* Threat Level */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-[10px] tracking-widest" style={{ color: "var(--text-muted)" }}>
            {t(lang, "TAHAP ANCAMAN", "THREAT LEVEL")}
          </span>
          <span
            className="text-[11px] font-black tracking-widest px-2 py-0.5"
            style={{
              color: threat.color,
              border: `1px solid ${threat.color}44`,
              background: `${threat.color}14`,
            }}
          >
            {lang === "ms" ? threat.labelMS : threat.label}
          </span>
        </div>

        {/* Current targets */}
        {targetedStateNames.length > 0 && (
          <div
            className="px-3 py-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="mb-1 text-[9px] font-bold tracking-[0.22em]" style={{ color: "var(--warn-orange)" }}>
              {t(lang, "NEGERI DISASARKAN", "TARGETED STATES")}
            </div>
            <div className="flex flex-wrap gap-1">
              {targetedStateNames.map((name) => (
                <span
                  key={name}
                  className="text-[9px] font-bold tracking-[0.12em] px-1.5 py-0.5"
                  style={{
                    color: "var(--warn-orange)",
                    border: "1px solid rgb(255 136 0 / 0.35)",
                    background: "rgb(255 136 0 / 0.08)",
                  }}
                >
                  {name.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Today's activity count */}
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>
            {t(lang, "TINDAKAN HARI INI", "TODAY'S ACTIONS")}
          </span>
          <span
            className="text-[11px] font-black"
            style={{ color: todayActions.length > 0 ? "var(--neon-red)" : "var(--neon-green)" }}
          >
            {todayActions.length}
          </span>
        </div>

        {/* Intel feed */}
        <div className="px-3 pb-3 pt-1">
          {log.length === 0 ? (
            <div className="py-4 text-center text-[10px] tracking-widest" style={{ color: "var(--text-muted)" }}>
              {t(lang, "TIADA AKTIVITI DIKESAN", "NO ACTIVITY DETECTED")}
            </div>
          ) : (
            log.slice(0, 10).map((action) => {
              const icon = ACTION_ICON[action.type] ?? "◇";
              const color = ACTION_COLOR[action.type] ?? "var(--text-muted)";
              const narrative = lang === "ms" ? action.narrativeMS : action.narrativeEN;
              const isToday = action.day === day;
              return (
                <div
                  key={action.id}
                  className="py-2 flex gap-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: isToday ? 1 : 0.62 }}
                >
                  <span className="text-[10px] mt-px shrink-0" style={{ color }}>{icon}</span>
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold tracking-[0.16em] mb-0.5" style={{ color }}>
                      {action.type.replace("_", " ").toUpperCase()}
                      {action.stateName && (
                        <span style={{ color: "var(--text-muted)", fontWeight: "normal" }}> · {action.stateName}</span>
                      )}
                      <span className="ml-1" style={{ color: "var(--text-muted)", fontWeight: "normal" }}>D{action.day}</span>
                    </div>
                    <div className="text-[9px] leading-snug" style={{ color: "#93a6b8" }}>{narrative}</div>
                    {action.lawanBoost > 0 && (
                      <div className="mt-0.5 text-[8px] font-bold" style={{ color: "var(--neon-red)" }}>
                        ▲ LAWAN +{action.lawanBoost}%
                      </div>
                    )}
                    {action.nationalDamage > 0 && (
                      <div className="mt-0.5 text-[8px] font-bold" style={{ color: "var(--neon-red)" }}>
                        ▼ NATIONAL −{action.nationalDamage}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </TacticalPanel>
  );
}

export default function WarroomPage() {
  const router = useRouter();
  const lang = useLang();
  const [advancing, setAdvancing] = useState(false);
  const { states: gameStates, resources, day, totalDays, lastEvent, getTotalProjectedSeats, getNationalSupport, advanceDay, clearLastEvent, leader, nationalSupportDelta, opponentLog, politicalReactions } = useGameStore();
  const staticTodaysNews = getLiveNewsForDay(day);
  const todaysNews = [...politicalReactions.filter((item) => item.day === day), ...staticTodaysNews];
  const latestNews = [...politicalReactions, ...getLatestLiveNews(day, 5)]
    .filter((item) => item.day <= day)
    .sort((a, b) => b.day - a.day || b.time.localeCompare(a.time))
    .slice(0, 8);

  const projectedSeats = getTotalProjectedSeats();
  const nationalSupport = getNationalSupport();
  const daysLeft = totalDays - day + 1;

  function handleAdvanceDay() {
    setAdvancing(true);
    advanceDay();
    setTimeout(() => setAdvancing(false), 700);
  }

  const safeSeats = gameStates.filter((s) => s.status === "winning").reduce((sum, s) => sum + s.projectedSeats, 0);
  const trailingSeats = gameStates.filter((s) => s.status === "losing").reduce((sum, s) => sum + s.projectedSeats, 0);
  const contestedSeats = gameStates.filter((s) => s.status === "contested").reduce((sum, s) => sum + s.projectedSeats, 0);

  function getStatusBadge(status: string) {
    switch (status) {
      case "winning":  return { label: "WIN",   bg: "rgb(var(--cyan-rgb) / 0.13)", color: "var(--cyan)", border: "rgb(var(--cyan-rgb) / 0.27)" };
      case "losing":   return { label: "LOSS",  bg: "rgb(255 68 68 / 0.13)", color: "var(--neon-red)", border: "rgb(255 68 68 / 0.27)" };
      case "contested":return { label: "FIGHT", bg: "rgb(var(--gold-rgb) / 0.13)", color: "var(--gold)", border: "rgb(var(--gold-rgb) / 0.27)" };
      default:         return { label: "—",     bg: "transparent", color: "var(--text-muted)", border: "transparent" };
    }
  }


  const NAV_ITEMS = [
    {
      icon: (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="1" width="4.5" height="4.5"/><rect x="7.5" y="1" width="4.5" height="4.5"/>
          <rect x="1" y="7.5" width="4.5" height="4.5"/><rect x="7.5" y="7.5" width="4.5" height="4.5"/>
        </svg>
      ),
      label: t(lang, "MENU UTAMA", "MAIN MENU"), path: "/menu",
    },
    {
      icon: (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 4.5h2v4h-2z"/><path d="M3.5 4.5L10 1.5v10l-6.5-3"/>
          <path d="M3.5 8.5l.8 3"/>
        </svg>
      ),
      label: t(lang, "OPS KEMPEN", "CAMPAIGN OPS"), path: "/campaign",
    },
    {
      icon: (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12V8M4.25 12V5M7.5 12V2M10.75 12V8"/>
          <path d="M1 12h10"/>
        </svg>
      ),
      label: t(lang, "TINJAUAN", "POLLING"), path: "/polling",
    },
    {
      icon: (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1H1v8.5h3.5L6.5 12l2-2.5H12V1z"/>
          <path d="M4 5h5M4 7h3"/>
        </svg>
      ),
      label: t(lang, "PESANAN", "MESSAGING"), path: "/messaging",
    },
    {
      icon: (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="2.5" width="11" height="9.5"/><path d="M1 6h11M4.5 1v3M8.5 1v3"/>
        </svg>
      ),
      label: t(lang, "KALENDAR", "CALENDAR"), path: "/calendar",
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {lastEvent && <EventModal event={lastEvent} onAck={clearLastEvent} />}
      <Header />

      {/* Top Stats Bar */}
      <div
        className="fixed top-[40px] left-0 right-0 z-40 flex items-stretch"
        style={{
          height: "60px",
          background: "var(--panel)",
          borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.2)",
        }}
      >
        {[
          {
            icon: "🏛",
            value: `${projectedSeats}/222`,
            label: "SEATS PROJECTED",
            color: "var(--cyan)",
          },
          {
            icon: "👥",
            value: `${nationalSupport.mandat}%`,
            suffix: nationalSupportDelta !== 0 ? `${nationalSupportDelta > 0 ? "+" : ""}${nationalSupportDelta.toFixed(1)}%` : undefined,
            suffixColor: nationalSupportDelta >= 0 ? "var(--neon-green)" : "var(--neon-red)",
            label: "PARTY SUPPORT",
            color: "var(--text-primary)",
          },
          {
            icon: "💰",
            value: formatFunds(resources.funds),
            label: "CAMPAIGN FUND",
            color: "var(--gold)",
          },
          {
            icon: "📅",
            value: `${daysLeft}`,
            label: "DAYS TO POLL",
            color: "var(--text-primary)",
          },
          {
            icon: "💪",
            value: `${resources.manpower}`,
            label: "GROUND STRENGTH",
            color: "var(--text-primary)",
          },
        ].map((item, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center justify-center px-2"
            style={{
              borderRight: i < 4 ? "1px solid rgb(var(--cyan-rgb) / 0.15)" : "none",
            }}
          >
            {(
              <>
                <div className="flex items-center gap-1.5">
                  {item.icon && <span className="text-sm">{item.icon}</span>}
                  <span className="text-sm font-bold" style={{ color: item.color, fontFamily: "Space Mono, monospace" }}>
                    {item.value}
                  </span>
                  {item.suffix && (
                    <span className="text-[12px] font-bold" style={{ color: item.suffixColor }}>
                      {item.suffix}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-text-muted tracking-wider mt-0.5">{item.label}</div>
              </>
            )}
          </div>
        ))}

        {/* ADVANCE DAY button */}
        <div
          className="flex flex-col items-center justify-center px-4 shrink-0"
          style={{ borderLeft: "1px solid rgb(var(--cyan-rgb) / 0.2)" }}
        >
          {day < totalDays ? (
            <button
              onClick={handleAdvanceDay}
              disabled={advancing}
              className="px-5 py-2 text-[12px] font-bold tracking-widest uppercase transition-all hover:opacity-80 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: advancing ? "rgb(var(--gold-rgb) / 0.12)" : "rgb(var(--cyan-rgb) / 0.12)",
                border: `1px solid ${advancing ? "rgb(var(--gold-rgb) / 0.5)" : "rgb(var(--cyan-rgb) / 0.5)"}`,
                color: advancing ? "var(--gold)" : "var(--cyan)",
                fontFamily: "Space Mono, monospace",
                boxShadow: advancing ? "0 0 12px rgb(var(--gold-rgb) / 0.2)" : "0 0 12px rgb(var(--cyan-rgb) / 0.2)",
                minWidth: "120px",
              }}
            >
              {advancing ? "⟳ PROCESSING" : "» NEXT DAY"}
            </button>
          ) : (
            <button
              onClick={() => router.push("/results")}
              className="px-5 py-2 text-[12px] font-bold tracking-widest uppercase transition-all hover:opacity-80 active:scale-95 animate-pulse"
              style={{
                background: "rgb(255 68 68 / 0.12)",
                border: "1px solid rgb(255 68 68 / 0.6)",
                color: "var(--neon-red)",
                fontFamily: "Space Mono, monospace",
                boxShadow: "0 0 12px rgb(255 68 68 / 0.2)",
                minWidth: "120px",
              }}
            >
              ◇ VIEW RESULTS
            </button>
          )}
          <div className="text-[11px] text-text-muted tracking-wider mt-1">DAY {day}/{totalDays}</div>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-[152px] pb-[56px] px-6">
        <div className="flex flex-col gap-4 w-full">

          {/* PRU Timeline — atas peta supaya terus kelihatan */}
          <TacticalPanel title={t(lang, "TIMELINE PRU16 — JADUAL PILIHAN RAYA UMUM", "GE16 TIMELINE — ELECTION SCHEDULE")}>
            <div className="relative">
              <div className="absolute top-[22px] left-[calc(100%/12)] right-[calc(100%/12)] h-[2px]" style={{ background: "rgb(var(--cyan-rgb) / 0.15)" }} />
              <div className="grid grid-cols-6 gap-3">
                {[
                  { day: "T-30", tarikh: "12 JUN 2025", labelMS: "PARLIMEN DIBUBAR",   labelEN: "PARLIAMENT DISSOLVED",  subMS: "SPR terima notis pembubaran",             subEN: "EC receives dissolution notice",            done: true,       active: false      },
                  { day: "T-25", tarikh: "17 JUN 2025", labelMS: "HARI PENAMAAN",       labelEN: "NOMINATION DAY",        subMS: "Calon didaftarkan di pusat PRU",           subEN: "Candidates registered at PRU centres",      done: day >= 5,   active: false      },
                  { day: "T-24", tarikh: "18 JUN 2025", labelMS: "KEMPEN BERMULA",      labelEN: "CAMPAIGN BEGINS",       subMS: `Hari ${day} drpd ${totalDays} — kempen aktif`,  subEN: `Day ${day} of ${totalDays} — campaign active`, done: true, active: day === 1  },
                  { day: "T-4",  tarikh: "8 JUL 2025",  labelMS: "PENGUNDIAN AWAL",     labelEN: "EARLY VOTING",          subMS: "Anggota polis & tentera mengundi",         subEN: "Police & military personnel vote",          done: day >= 27,  active: day >= 26  },
                  { day: "T-1",  tarikh: "11 JUL 2025", labelMS: "HARI TENANG",         labelEN: "COOLING-OFF DAY",       subMS: "Kempen dihentikan sepenuhnya",             subEN: "All campaigning must stop",                 done: false,      active: day >= 29  },
                  { day: "T-0",  tarikh: "12 JUL 2025", labelMS: "HARI MENGUNDI",       labelEN: "POLLING DAY",           subMS: "Rakyat ke peti undi — 8pg hingga 5ptg",   subEN: "Voters to the polls — 8am to 5:30pm",      done: false,      active: day >= 30  },
                ].map((ev, i) => {
                  const dotColor = ev.done ? "var(--neon-green)" : ev.active ? "var(--gold)" : "rgb(var(--cyan-rgb) / 0.35)";
                  const labelColor = ev.done ? "var(--neon-green)" : ev.active ? "var(--gold)" : "#8899aa";
                  const bgColor = ev.done ? "rgba(0,255,136,0.06)" : ev.active ? "rgba(240,165,0,0.06)" : "rgba(0,212,255,0.03)";
                  const borderColor = ev.done ? "rgba(0,255,136,0.25)" : ev.active ? "rgba(240,165,0,0.25)" : "rgb(var(--cyan-rgb) / 0.10)";
                  return (
                    <div key={i} className="flex flex-col items-center text-center gap-2">
                      <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full"
                        style={{ background: bgColor, border: `2px solid ${borderColor}`, boxShadow: ev.done || ev.active ? `0 0 14px ${dotColor}44` : "none" }}>
                        {ev.done ? (
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <polyline points="3,9 7,13 15,5" stroke="var(--neon-green)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : ev.active ? (
                          <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: "var(--gold)" }} />
                        ) : (
                          <div className="h-2 w-2 rounded-full" style={{ background: "rgb(var(--cyan-rgb) / 0.3)" }} />
                        )}
                      </div>
                      <div className="w-full rounded-sm p-2.5" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                        <div className="text-[10px] font-black tracking-[0.22em] mb-0.5" style={{ color: dotColor }}>{ev.day}</div>
                        <div className="text-[11px] font-bold tracking-[0.10em] leading-tight" style={{ color: labelColor }}>{t(lang, ev.labelMS, ev.labelEN)}</div>
                        <div className="mt-1 text-[9px] leading-[1.4]" style={{ color: "#4a6070" }}>{t(lang, ev.subMS, ev.subEN)}</div>
                        <div className="mt-2 text-[8px] font-bold tracking-[0.14em]" style={{ color: ev.done ? "var(--neon-green)" : "#3d5166" }}>{ev.tarikh}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-5 justify-end">
                {[
                  { color: "var(--neon-green)", labelMS: "SELESAI",      labelEN: "DONE"     },
                  { color: "var(--gold)",        labelMS: "SEMASA",       labelEN: "CURRENT"  },
                  { color: "rgb(var(--cyan-rgb) / 0.35)", labelMS: "AKAN DATANG", labelEN: "UPCOMING" },
                ].map((l) => (
                  <div key={l.labelMS} className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                    <span className="text-[9px] tracking-[0.14em]" style={{ color: "#4a5e72" }}>{t(lang, l.labelMS, l.labelEN)}</span>
                  </div>
                ))}
              </div>
            </div>
          </TacticalPanel>

          {/* Full-width Map Panel */}
          <TacticalPanel title="ELECTORAL MAP — MALAYSIA" noPadding>
            <div style={{ minHeight: "420px" }}>
              <MalaysiaMap
                states={gameStates}
                onStateClick={(id) => router.push(`/state/${id}`)}
                showLabels
              />
            </div>
            {/* Map Summary */}
            <div className="grid grid-cols-3 gap-0 border-t border-cyan/20">
              {[
                { label: "SAFE SEATS", value: safeSeats, color: "var(--cyan)" },
                { label: "CONTESTED", value: contestedSeats, color: "var(--gold)" },
                { label: "TRAILING", value: trailingSeats, color: "var(--neon-red)" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center py-3"
                  style={{ borderRight: i < 2 ? "1px solid rgb(var(--cyan-rgb) / 0.15)" : "none" }}
                >
                  <div className="text-xl font-bold" style={{ color: item.color, fontFamily: "Space Mono, monospace" }}>
                    {item.value}
                  </div>
                  <div className="text-[11px] text-text-muted tracking-wider mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
          </TacticalPanel>

          {/* Persistent Navigation Buttons */}
          <div
            className="fixed left-0 right-0 top-[100px] z-40 grid grid-cols-5 gap-2 px-6 py-2"
            style={{
              background: "linear-gradient(180deg, var(--bg), rgba(8,12,20,0.90))",
              borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.18)",
            }}
          >
            {NAV_ITEMS.map(({ icon, label, path }) => (
              <button
                key={path}
                onClick={() => router.push(path)}
                className="py-2.5 text-[12px] tracking-widest uppercase transition-all hover:opacity-80 flex items-center justify-center gap-2"
                style={{
                  background: "rgb(var(--cyan-rgb) / 0.06)",
                  border: "1px solid rgb(var(--cyan-rgb) / 0.2)",
                  color: "var(--cyan)",
                  fontFamily: "Space Mono, monospace",
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          <ElectionFlowPanel day={day} totalDays={totalDays} lang={lang} />

          {/* Bottom Row — 4 panels side by side */}
          <div className="flex gap-4">
            {/* State Summary Table */}
            <div style={{ flex: "0 0 42%" }}>
              <TacticalPanel title="STATE SUMMARY" noPadding>
                <div className="overflow-y-auto" style={{ maxHeight: "300px" }}>
                  <table className="w-full text-[12px]" style={{ fontFamily: "Space Mono, monospace" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.2)" }}>
                        {["STATE", "SEATS", "SUPPORT", "TREND", "STATUS"].map((h) => (
                          <th
                            key={h}
                            className="text-left py-2 px-3 text-text-muted tracking-wider font-normal text-[11px]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gameStates.map((s) => {
                        const badge = getStatusBadge(s.status);
                        const trendColor = s.trend >= 0 ? "var(--neon-green)" : "var(--neon-red)";
                        const trendPrefix = s.trend >= 0 ? "+" : "";
                        const supportColor =
                          s.mandatSupport >= 50 ? "var(--cyan)" : s.mandatSupport >= 40 ? "var(--gold)" : "var(--neon-red)";
                        return (
                          <tr
                            key={s.id}
                            onClick={() => router.push(`/state/${s.id}`)}
                            className="cursor-pointer transition-colors hover:bg-white/5"
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                          >
                            <td className="py-2 px-3 text-white font-bold">{s.shortName}</td>
                            <td className="py-2 px-3 text-text-muted">{s.seats}</td>
                            <td className="py-2 px-3 font-bold" style={{ color: supportColor }}>
                              {s.mandatSupport}%
                            </td>
                            <td className="py-2 px-3 font-bold" style={{ color: trendColor }}>
                              {trendPrefix}{s.trend.toFixed(1)}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className="px-1.5 py-0.5 text-[11px] font-bold tracking-wider"
                                style={{
                                  background: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.border}`,
                                }}
                              >
                                {badge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TacticalPanel>
            </div>

            {/* Seat Distribution */}
            <div style={{ flex: "0 0 20%" }}>
              <TacticalPanel title="SEAT DISTRIBUTION — 222 TOTAL">
                <SeatDonut
                  mandat={projectedSeats}
                  lawan={222 - projectedSeats - 28}
                  others={28}
                  winTarget={112}
                  size="md"
                  partyName={leader.partyAbbr}
                  partyColor={leader.partyColor}
                />
              </TacticalPanel>
            </div>

            {/* Opposition Intel */}
            <div style={{ flex: "0 0 20%" }}>
              <OppositionIntelPanel log={opponentLog} lang={lang} day={day} />
            </div>

            {/* Live News */}
            <div style={{ flex: "0 0 18%" }}>
              <TacticalPanel title={t(lang, `BERITA LIVE — HARI ${day}`, `LIVE NEWS — DAY ${day}`)} noPadding>
                <div className="overflow-y-auto px-4 pb-3" style={{ maxHeight: "300px" }}>
                  {todaysNews.map((news) => {
                    const toneColor = news.tone === "positive" ? "var(--neon-green)"
                      : news.tone === "negative" ? "var(--neon-red)"
                      : news.tone === "warning" ? "var(--gold)"
                      : news.tone === "breaking" ? "var(--cyan)" : "var(--text-muted)";
                    const newsHeadline = lang === "ms" ? news.headline : news.headlineEN;
                    const newsSummary = lang === "ms" ? news.summary : news.summaryEN;
                    return (
                      <div key={news.id} className="py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold tracking-widest" style={{ color: toneColor }}>{news.time}</span>
                          <span className="text-[8px] font-bold tracking-[0.16em]" style={{ color: "#718397" }}>{news.outlet.toUpperCase()}</span>
                        </div>
                        <div className="text-[12px] font-bold leading-snug text-white">{newsHeadline}</div>
                        <div className="mt-1 text-[10px] leading-relaxed" style={{ color: "#93a6b8" }}>{newsSummary}</div>
                        {isPoliticalReaction(news) && (
                          <div className="mt-2 space-y-1 border-l pl-2" style={{ borderColor: "rgb(var(--gold-rgb) / 0.28)" }}>
                            <div className="text-[9px] leading-snug" style={{ color: "var(--neon-red)" }}>
                              OPP: {lang === "ms" ? news.opponentAttack : news.opponentAttackEN}
                            </div>
                            <div className="text-[9px] leading-snug" style={{ color: "var(--cyan)" }}>
                              AI: {lang === "ms" ? news.advisorWarning : news.advisorWarningEN}
                            </div>
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="text-[8px] tracking-widest" style={{ color: "#718397" }}>{news.state ?? (lang === "ms" ? "NASIONAL" : "NATIONAL")}</span>
                          <span className="text-[8px] font-bold tracking-widest" style={{ color: toneColor }}>{news.impact}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2">
                    <div className="mb-1 text-[9px] font-bold tracking-[0.22em]" style={{ color: "var(--gold)" }}>{t(lang, "WAYAR TERKINI", "LATEST WIRES")}</div>
                    {latestNews.filter((item) => item.day !== day).slice(0, 3).map((news) => (
                      <div key={`wire-${news.id}`} className="flex items-start gap-2 py-1.5 text-[10px]" style={{ color: "#7f90a3" }}>
                        <span className="font-bold" style={{ color: "var(--gold)" }}>D{news.day}</span>
                        <span>{lang === "ms" ? news.headline : news.headlineEN}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TacticalPanel>
            </div>
          </div>

        </div>
      </main>

      <StatusBar
        leftText={`${t(lang, "BERITA LIVE", "LIVE NEWS")} · DAY ${day}/${totalDays} · ${lang === "ms" ? (todaysNews[0]?.headline ?? "War room memantau nasional") : (todaysNews[0]?.headlineEN ?? "War room monitoring national wires")}`}
        rightText={`LATEST: ${todaysNews[0]?.impact ?? "No impact"}`}
      />
    </div>
  );
}
