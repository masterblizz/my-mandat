"use client";
import { useState } from "react";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t, type Lang } from "../i18n/useLang";
import calendarStrings from "../i18n/strings/calendar_page";

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = "WEEK" | "MONTH" | "LIST";
type EventType = "event" | "media" | "operation";

interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  day: number; // 0=Mon … 6=Sun
  date: string;
  time: string;
  location: string;
  description?: string; // live ops only; static events use the dictionary
  operatives: number;
  status: "CONFIRMED" | "PENDING";
}

// ─── Dummy Data ───────────────────────────────────────────────────────────────

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAYS_MS = ["ISN", "SEL", "RAB", "KHA", "JUM", "SAB", "AHD"];
const DAY_DATES = ["16 JUN", "17 JUN", "18 JUN", "19 JUN", "20 JUN", "21 JUN", "22 JUN"];

// Titles are kept as stable English keys (used to match events across the
// week/month/list views and the click-to-open lookup) — the displayed text
// comes from the calendar_page dictionary, keyed by the slugified title.
// Live ops carry runtime titles that have no dictionary entry — show them as-is.
function eventTitle(lang: Lang, title: string): string {
  const key = `eventTitle_${title.replace(/[^A-Za-z0-9]+/g, "_")}`;
  return key in calendarStrings ? t(lang, `calendar_page.${key}`) : title;
}

function eventDescription(lang: Lang, ev: CalendarEvent): string {
  return ev.description ?? t(lang, `calendar_page.eventDesc_${ev.id}`);
}

const calendarEvents: CalendarEvent[] = [
  // Events
  { id: "e1", title: "JOHOR RALLY", type: "event", day: 0, date: "MON 16 JUN 2025", time: "19:00", location: "Johor Bahru Stadium", operatives: 80, status: "CONFIRMED" },
  { id: "e2", title: "KL CERAMAH", type: "event", day: 2, date: "WED 18 JUN 2025", time: "20:00", location: "Dataran Merdeka, KL", operatives: 60, status: "CONFIRMED" },
  { id: "e3", title: "PRESS CONF", type: "event", day: 2, date: "WED 18 JUN 2025", time: "10:00", location: "Menara Mandat HQ", operatives: 12, status: "CONFIRMED" },
  { id: "e4", title: "PAHANG TOUR", type: "event", day: 3, date: "THU 19 JUN 2025", time: "09:00", location: "Kuantan & Temerloh", operatives: 45, status: "CONFIRMED" },
  { id: "e5", title: "SELANGOR RALLY", type: "event", day: 4, date: "FRI 20 JUN 2025", time: "20:30", location: "Shah Alam Stadium", operatives: 120, status: "CONFIRMED" },
  { id: "e6", title: "JOHOR MEGA RALLY", type: "event", day: 5, date: "SAT 21 JUN 2025", time: "18:00", location: "Iskandar Puteri Arena", operatives: 200, status: "CONFIRMED" },
  { id: "e7", title: "REST DAY", type: "event", day: 6, date: "SUN 22 JUN 2025", time: "—", location: "—", operatives: 0, status: "CONFIRMED" },
  // Media
  { id: "m1", title: "TV3 INTERVIEW", type: "media", day: 0, date: "MON 16 JUN 2025", time: "14:00", location: "TV3 Studios, PJ", operatives: 4, status: "CONFIRMED" },
  { id: "m2", title: "RADIO RTM", type: "media", day: 1, date: "TUE 17 JUN 2025", time: "08:00", location: "RTM Angkasapuri", operatives: 2, status: "CONFIRMED" },
  { id: "m3", title: "ASTRO AWANI", type: "media", day: 3, date: "THU 19 JUN 2025", time: "21:00", location: "Astro Studios", operatives: 3, status: "PENDING" },
  { id: "m4", title: "TV3", type: "media", day: 4, date: "FRI 20 JUN 2025", time: "07:30", location: "TV3 Studios, PJ", operatives: 2, status: "CONFIRMED" },
  { id: "m5", title: "TV9", type: "media", day: 4, date: "FRI 20 JUN 2025", time: "12:00", location: "TV9 Studios", operatives: 2, status: "CONFIRMED" },
  { id: "m6", title: "LIVE STREAM", type: "media", day: 5, date: "SAT 21 JUN 2025", time: "18:00", location: "Online", operatives: 8, status: "CONFIRMED" },
  // Operations
  { id: "o1", title: "DOOR TO DOOR", type: "operation", day: 0, date: "MON 16 JUN 2025", time: "09:00", location: "Selangor & Johor", operatives: 120, status: "ACTIVE" as unknown as "CONFIRMED" },
  { id: "o2", title: "YOUTH OUTREACH", type: "operation", day: 1, date: "TUE 17 JUN 2025", time: "14:00", location: "Klang Valley Universities", operatives: 60, status: "CONFIRMED" },
  { id: "o3", title: "DIGITAL", type: "operation", day: 1, date: "TUE 17 JUN 2025", time: "All Day", location: "Nationwide", operatives: 30, status: "CONFIRMED" },
  { id: "o4", title: "RURAL ENGAGEMENT", type: "operation", day: 2, date: "WED 18 JUN 2025", time: "08:00", location: "Perak & Kedah", operatives: 100, status: "CONFIRMED" },
  { id: "o5", title: "DOOR TO DOOR", type: "operation", day: 3, date: "THU 19 JUN 2025", time: "09:00", location: "Pahang", operatives: 80, status: "PENDING" },
  { id: "o6", title: "CERAMAH MEGA", type: "operation", day: 4, date: "FRI 20 JUN 2025", time: "20:30", location: "Shah Alam", operatives: 150, status: "CONFIRMED" },
  { id: "o7", title: "ALL TEAMS", type: "operation", day: 5, date: "SAT 21 JUN 2025", time: "All Day", location: "Johor", operatives: 200, status: "CONFIRMED" },
];

// ─── Month View Data (June 2025, 30 days) ────────────────────────────────────

const MONTH_DATES = Array.from({ length: 30 }, (_, i) => i + 1);
const CURRENT_WEEK_START = 16;
const CURRENT_WEEK_END = 22;

interface MonthEvent { title: string; type: EventType }

const MONTH_EVENTS: Record<number, MonthEvent[]> = {
  2:  [{ title: "CERAMAH JOHOR", type: "event" }],
  3:  [{ title: "CANVASSING OPS", type: "operation" }],
  5:  [{ title: "RTM INTERVIEW", type: "media" }, { title: "PAHANG RALLY", type: "event" }],
  7:  [{ title: "DIGITAL PUSH", type: "operation" }],
  8:  [{ title: "KEDAH TOUR", type: "event" }, { title: "ASTRO AWANI", type: "media" }, { title: "RURAL OPS", type: "operation" }],
  9:  [{ title: "DOOR TO DOOR", type: "operation" }],
  10: [{ title: "TV3 SEGMENT", type: "media" }],
  11: [{ title: "PERAK CERAMAH", type: "event" }],
  12: [{ title: "GROUND OPS", type: "operation" }, { title: "RADIO RTM", type: "media" }],
  13: [{ title: "YOUTH OUTREACH", type: "operation" }],
  14: [{ title: "SELANGOR RALLY", type: "event" }, { title: "LIVE STREAM", type: "media" }],
  15: [{ title: "REST & DEBRIEF", type: "event" }],
  16: [{ title: "JOHOR RALLY", type: "event" }, { title: "TV3 INTERVIEW", type: "media" }, { title: "DOOR TO DOOR", type: "operation" }],
  17: [{ title: "RADIO RTM", type: "media" }, { title: "CERAMAH MEGA", type: "operation" }],
  18: [{ title: "KL CERAMAH", type: "event" }, { title: "PRESS CONF", type: "event" }, { title: "YOUTH OUTREACH", type: "operation" }],
  19: [{ title: "PAHANG TOUR", type: "event" }, { title: "ASTRO AWANI", type: "media" }, { title: "RURAL ENGAGEMENT", type: "operation" }],
  20: [{ title: "SELANGOR RALLY", type: "event" }, { title: "TV3", type: "media" }, { title: "TV9", type: "media" }, { title: "DIGITAL CAMPAIGN", type: "operation" }],
  21: [{ title: "JOHOR MEGA RALLY", type: "event" }, { title: "LIVE STREAM", type: "media" }, { title: "ALL TEAMS", type: "operation" }],
  22: [{ title: "REST DAY", type: "event" }],
  23: [{ title: "SABAH TOUR", type: "event" }, { title: "DOOR TO DOOR", type: "operation" }],
  24: [{ title: "CANVASSING OPS", type: "operation" }, { title: "RADIO INTERVIEW", type: "media" }],
  25: [{ title: "SARAWAK CERAMAH", type: "event" }],
  26: [{ title: "MEGA RALLY KL", type: "event" }, { title: "TV3 SPECIAL", type: "media" }, { title: "GROUND OPS", type: "operation" }],
  27: [{ title: "DIGITAL BLITZ", type: "operation" }],
  28: [{ title: "FINAL CANVASS", type: "operation" }, { title: "MEDIA BLITZ", type: "media" }],
  29: [{ title: "HARI TENANG", type: "event" }],
  30: [{ title: "HARI MENGUNDI", type: "event" }],
};

// ─── List View Data ───────────────────────────────────────────────────────────

const LIST_EVENTS = [
  ...calendarEvents
    .filter((e) => e.id !== "e7") // exclude rest day from list
    .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id)),
];

// ─── Chip Styles ─────────────────────────────────────────────────────────────

function chipStyle(type: EventType) {
  if (type === "event")
    return { background: "rgb(var(--gold-rgb) / 0.18)", border: "1px solid var(--gold)", color: "var(--gold)" };
  if (type === "media")
    return { background: "#002a3a", border: "1px solid var(--cyan)", color: "var(--cyan)" };
  return { background: "#00280a", border: "1px solid var(--neon-green)", color: "var(--neon-green)" };
}

function typeBadgeColor(type: EventType) {
  if (type === "event") return "var(--gold)";
  if (type === "media") return "var(--cyan)";
  return "var(--neon-green)";
}

function typeBadgeBg(type: EventType) {
  if (type === "event") return "rgb(var(--gold-rgb) / 0.18)";
  if (type === "media") return "#002a3a";
  return "#00280a";
}

function typeLabel(lang: Lang, type: EventType) {
  if (type === "event") return t(lang, "calendar_page.event");
  if (type === "media") return t(lang, "calendar_page.media");
  return t(lang, "calendar_page.operation");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventChip({
  ev,
  lang,
  onClick,
}: {
  ev: CalendarEvent;
  lang: Lang;
  onClick: (ev: CalendarEvent) => void;
}) {
  const s = chipStyle(ev.type);
  return (
    <button
      onClick={() => onClick(ev)}
      className="block w-full text-left rounded px-1.5 py-0.5 mb-0.5 cursor-pointer transition-all hover:brightness-125"
      style={{
        fontSize: "12px",
        fontFamily: "'Space Mono', monospace",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        ...s,
      }}
    >
      {eventTitle(lang, ev.title)}
    </button>
  );
}

function DetailPanel({
  ev,
  lang,
  onClose,
}: {
  ev: CalendarEvent;
  lang: Lang;
  onClose: () => void;
}) {
  const color = typeBadgeColor(ev.type);
  const bg = typeBadgeBg(ev.type);
  return (
    <div
      className="fixed top-10 right-0 bottom-9 z-40 flex flex-col"
      style={{ width: "340px", background: "var(--panel)", borderLeft: "1px solid rgb(var(--cyan-rgb) / 0.4)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.2)" }}
      >
        <span className="panel-header" style={{ fontSize: "12px" }}>{t(lang, "calendar_page.eventDetail")}</span>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-cyan text-xs"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          [{t(lang, "calendar_page.close")}]
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Type badge */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded uppercase tracking-wider"
            style={{
              background: bg,
              color,
              border: `1px solid ${color}`,
              fontSize: "12px",
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {typeLabel(lang, ev.type)}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded uppercase tracking-wider"
            style={{
              background: ev.status === "CONFIRMED" ? "#00280a" : "#2a1a00",
              color: ev.status === "CONFIRMED" ? "var(--neon-green)" : "var(--warn-orange)",
              border: `1px solid ${ev.status === "CONFIRMED" ? "var(--neon-green)" : "var(--warn-orange)"}`,
              fontSize: "12px",
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {t(lang, ev.status === "CONFIRMED" ? "calendar_page.statusConfirmed" : (ev.status as string) === "ACTIVE" ? "calendar_page.statusActive" : "calendar_page.statusPending")}
          </span>
        </div>

        {/* Title */}
        <div>
          <div
            className="text-white font-bold uppercase tracking-wider"
            style={{ fontSize: "19px", fontFamily: "'Space Mono', monospace" }}
          >
            {eventTitle(lang, ev.title)}
          </div>
        </div>

        {/* Info rows */}
        <div className="space-y-2">
          {[
            [t(lang, "calendar_page.date"), ev.date],
            [t(lang, "calendar_page.time"), ev.time],
            [t(lang, "calendar_page.location"), ev.location],
            [t(lang, "calendar_page.operatives"), ev.operatives > 0 ? t(lang, "calendar_page.deployed", { evOperatives: ev.operatives }) : "—"],
          ].map(([label, val]) => (
            <div key={label} className="flex gap-2">
              <span
                className="text-text-muted uppercase shrink-0"
                style={{ fontSize: "12px", fontFamily: "'Space Mono', monospace", minWidth: "80px" }}
              >
                {label}
              </span>
              <span
                className="text-white"
                style={{ fontSize: "13px", fontFamily: "'Space Mono', monospace" }}
              >
                {val}
              </span>
            </div>
          ))}
        </div>

        {/* Description */}
        <div
          style={{
            background: "var(--bg)",
            border: "1px solid rgb(var(--cyan-rgb) / 0.2)",
            padding: "10px",
          }}
        >
          <div
            className="text-text-muted mb-1 uppercase"
            style={{ fontSize: "12px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em" }}
          >
            {t(lang, "calendar_page.briefing")}
          </div>
          <div
            className="text-white"
            style={{ fontSize: "13px", fontFamily: "'Space Mono', monospace", lineHeight: "1.6" }}
          >
            {eventDescription(lang, ev)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const lang = useLang();
  const [view, setView] = useState<ViewMode>("WEEK");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const { day: gameDay, totalDays, operations } = useGameStore();

  // Map game day to a calendar date in June 2025 (Day 1 = Jun 1)
  const currentCalendarDate = gameDay; // Day 1 → June 1, Day 27 → June 27

  // Build live operation events from store (mapped to current game week, day 0=Mon)
  const liveOpEvents: CalendarEvent[] = operations
    .filter((op) => op.status !== "completed")
    .map((op, idx) => ({
      id: `live-${op.id}`,
      title: op.name,
      type: "operation" as EventType,
      day: idx % 7,
      date: `${DAY_DATES[idx % 7]} 2025`,
      time: "All Day",
      location: op.location.toUpperCase(),
      description: t(lang, "calendar_page.operationStateSTargetedSupportGain", { opType: op.type.toUpperCase(), opStateIdsLength: op.stateIds.length, opSupportGain: op.supportGain }),
      operatives: op.manpowerCost,
      status: (op.status === "active" ? "CONFIRMED" : op.status === "planned" ? "PENDING" : "CONFIRMED") as "CONFIRMED" | "PENDING",
    }));

  // Merge static + live events (live ops override the operation row)
  const allEvents: CalendarEvent[] = [
    ...calendarEvents.filter((e) => e.type !== "operation"),
    ...liveOpEvents,
  ];

  // Weekly data grouped by row type and day index (empty for non-current weeks)
  const eventsByDayAndType = (type: EventType, dayIdx: number) =>
    weekOffset === 0 ? allEvents.filter((e) => e.type === type && e.day === dayIdx) : [];

  // Row labels
  const ROWS: { labelKey: string; type: EventType }[] = [
    { labelKey: "calendar_page.rowEvents", type: "event" },
    { labelKey: "calendar_page.rowMedia", type: "media" },
    { labelKey: "calendar_page.rowOperations", type: "operation" },
  ];

  // Stat totals
  const totalEvents = allEvents.filter((e) => e.type === "event" && e.id !== "e7").length;
  const totalMedia = allEvents.filter((e) => e.type === "media").length;
  const totalOps = liveOpEvents.length;
  const totalOperatives = allEvents.reduce((sum, e) => sum + e.operatives, 0);

  const viewLabel = (v: ViewMode) => t(lang, v === "WEEK" ? "calendar_page.viewWeek" : v === "MONTH" ? "calendar_page.viewMonth" : "calendar_page.viewList");
  const dayLabels = lang === "ms" ? DAYS_MS : DAYS;

  return (
    <div
      className="min-h-screen font-mono"
      style={{ background: "var(--bg)", paddingTop: "40px", paddingBottom: "36px" }}
    >
      <Header />

      {/* Sub-header bar */}
      <div
        className="flex items-center justify-between px-6"
        style={{
          height: "48px",
          background: "var(--panel)",
          borderBottom: "1px solid rgb(var(--gold-rgb) / 0.3)",
          fontFamily: "'Space Mono', monospace",
        }}
      >
        {/* Title */}
        <div
          className="text-gold font-bold uppercase tracking-widest"
          style={{ fontSize: "13px" }}
        >
          {t(lang, "calendar_page.calendarSchedulePlanExecuteWin")}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* View toggles */}
          <div className="flex" style={{ border: "1px solid rgb(var(--cyan-rgb) / 0.3)" }}>
            {(["WEEK", "MONTH", "LIST"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  padding: "4px 12px",
                  cursor: "pointer",
                  background: view === v ? "var(--gold)" : "transparent",
                  color: view === v ? "#000" : "var(--text-muted)",
                  border: "none",
                  transition: "all 0.15s",
                }}
              >
                {viewLabel(v)}
              </button>
            ))}
          </div>

          {/* Today button */}
          <button
            className="btn-primary"
            style={{ padding: "4px 12px", fontSize: "12px", opacity: weekOffset === 0 ? 0.5 : 1 }}
            onClick={() => setWeekOffset(0)}
          >
            {t(lang, "calendar_page.today")}
          </button>

          {/* Nav arrows */}
          <div className="flex items-center gap-1">
            <button
              className="text-cyan hover:text-white transition-colors"
              style={{ fontFamily: "'Space Mono', monospace", fontSize: "17px", padding: "2px 6px", background: "transparent", border: "none", cursor: "pointer" }}
              onClick={() => setWeekOffset((o) => o - 1)}
            >
              &lt;
            </button>
            <span
              className="text-white uppercase tracking-widest"
              style={{ fontSize: "12px", minWidth: "140px", textAlign: "center" }}
            >
              {(() => {
                const base = new Date(2025, 5, 16 + weekOffset * 7);
                const end = new Date(2025, 5, 22 + weekOffset * 7);
                const fmt = (d: Date) => `${d.getDate()} ${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getMonth()]}`;
                return t(lang, "calendar_page.wk", { weekOffset: 23 + weekOffset, fmtBase: fmt(base), fmtEnd: fmt(end) });
              })()}
            </span>
            <button
              className="text-cyan hover:text-white transition-colors"
              style={{ fontFamily: "'Space Mono', monospace", fontSize: "17px", padding: "2px 6px", background: "transparent", border: "none", cursor: "pointer" }}
              onClick={() => setWeekOffset((o) => o + 1)}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div
        className="flex flex-col"
        style={{
          minHeight: "calc(100vh - 40px - 36px - 48px - 48px)",
          padding: "16px 24px",
          paddingRight: selectedEvent ? "364px" : "24px",
          transition: "padding-right 0.25s ease",
        }}
      >
        {/* ─── WEEK VIEW ──────────────────────────────────────── */}
        {view === "WEEK" && (
          <div className="flex flex-col gap-0 flex-1">
            {/* Day header row */}
            <div className="flex" style={{ marginLeft: "80px", marginBottom: "4px" }}>
              {dayLabels.map((d, i) => (
                <div
                  key={d}
                  className="flex-1 text-center text-text-muted uppercase"
                  style={{ fontSize: "12px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em" }}
                >
                  <div>{d}</div>
                  <div className="text-white" style={{ fontSize: "11px", opacity: 0.5 }}>
                    {DAY_DATES[i]}
                  </div>
                </div>
              ))}
            </div>

            {/* Section rows */}
            {ROWS.map((row, ri) => {
              const rowBorderColor =
                row.type === "event" ? "var(--gold)" : row.type === "media" ? "var(--cyan)" : "var(--neon-green)";
              return (
                <div
                  key={row.type}
                  className="flex"
                  style={{
                    borderTop: ri === 0 ? `1px solid rgb(var(--cyan-rgb) / 0.2)` : "none",
                    borderBottom: `1px solid rgb(var(--cyan-rgb) / 0.1)`,
                    minHeight: "90px",
                  }}
                >
                  {/* Row label */}
                  <div
                    className="flex items-center justify-end shrink-0 pr-3"
                    style={{
                      width: "80px",
                      borderRight: `2px solid ${rowBorderColor}`,
                    }}
                  >
                    <span
                      className="uppercase font-bold"
                      style={{
                        fontSize: "11px",
                        fontFamily: "'Space Mono', monospace",
                        color: rowBorderColor,
                        letterSpacing: "0.12em",
                        writingMode: "vertical-rl",
                        textOrientation: "mixed",
                        transform: "rotate(180deg)",
                      }}
                    >
                      {t(lang, row.labelKey)}
                    </span>
                  </div>

                  {/* 7 day cells */}
                  {DAYS.map((_, di) => {
                    const cellEvents = eventsByDayAndType(row.type, di);
                    return (
                      <div
                        key={di}
                        className="flex-1 p-1"
                        style={{
                          borderRight: di < 6 ? "1px solid rgb(var(--cyan-rgb) / 0.1)" : "none",
                          background: di === 6 ? "rgba(255,255,255,0.01)" : "transparent",
                        }}
                      >
                        {cellEvents.map((ev) => (
                          <EventChip key={ev.id} ev={ev} lang={lang} onClick={setSelectedEvent} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── MONTH VIEW ─────────────────────────────────────── */}
        {view === "MONTH" && (
          <TacticalPanel title={t(lang, "calendar_page.june2025")} className="flex-1">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {dayLabels.map((d) => (
                <div
                  key={d}
                  className="text-center text-text-muted uppercase"
                  style={{ fontSize: "12px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em" }}
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Date grid — Jun 2025 starts Sunday (col 6 in Mon-first grid) */}
            <div className="grid grid-cols-7 border-t border-l" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.12)" }}>
              {/* 6 empty cells before Jun 1 */}
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`empty-${i}`} className="border-r border-b p-1" style={{ minHeight: "90px", borderColor: "rgb(var(--cyan-rgb) / 0.08)", background: "rgba(0,0,0,0.2)" }} />
              ))}
              {MONTH_DATES.map((date) => {
                const isCurrentWeek = date >= CURRENT_WEEK_START && date <= CURRENT_WEEK_END;
                const isToday = date === currentCalendarDate;
                const evs = MONTH_EVENTS[date] || [];
                const visible = evs.slice(0, 2);
                const overflow = evs.length - visible.length;
                return (
                  <div
                    key={date}
                    className="border-r border-b flex flex-col p-1"
                    style={{
                      minHeight: "90px",
                      borderColor: "rgb(var(--cyan-rgb) / 0.08)",
                      background: isToday
                        ? "rgb(var(--cyan-rgb) / 0.10)"
                        : isCurrentWeek
                        ? "rgb(var(--gold-rgb) / 0.055)"
                        : "transparent",
                    }}
                  >
                    {/* Date number */}
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        style={{
                          fontSize: "11px",
                          fontFamily: "'Space Mono', monospace",
                          fontWeight: "bold",
                          color: isToday ? "var(--cyan)" : isCurrentWeek ? "var(--gold)" : "#8899aa",
                          lineHeight: 1,
                        }}
                      >
                        {date}
                      </span>
                      {isToday && (
                        <span style={{ fontSize: "8px", fontFamily: "'Space Mono', monospace", color: "var(--cyan)", letterSpacing: "0.1em" }}>{t(lang, "calendar_page.today")}</span>
                      )}
                    </div>
                    {/* Event chips */}
                    {visible.map((ev, i) => {
                      const color = ev.type === "event" ? "var(--gold)" : ev.type === "media" ? "var(--cyan)" : "var(--neon-green)";
                      const bg = ev.type === "event" ? "rgb(var(--gold-rgb) / 0.14)" : ev.type === "media" ? "rgba(0,212,255,0.10)" : "rgba(0,255,136,0.10)";
                      const border = ev.type === "event" ? "rgb(var(--gold-rgb) / 0.35)" : ev.type === "media" ? "rgb(var(--cyan-rgb) / 0.35)" : "rgba(0,255,136,0.3)";
                      return (
                        <div
                          key={i}
                          className="mb-0.5 truncate cursor-pointer"
                          style={{ fontSize: "9px", fontFamily: "'Space Mono', monospace", color, background: bg, border: `1px solid ${border}`, padding: "1px 4px", letterSpacing: "0.04em" }}
                          onClick={() => {
                            const match = allEvents.find(e => {
                              const d = e.date.match(/(\d+) JUN/);
                              return d && parseInt(d[1]) === date && e.type === ev.type && e.title === ev.title;
                            });
                            if (match) setSelectedEvent(match);
                          }}
                        >
                          {eventTitle(lang, ev.title)}
                        </div>
                      );
                    })}
                    {overflow > 0 && (
                      <div style={{ fontSize: "9px", fontFamily: "'Space Mono', monospace", color: "#4a5e72", paddingLeft: "2px" }}>
                        {t(lang, "calendar_page.more", { overflow: overflow })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex gap-4 mt-4 pt-4" style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
              {[
                { labelKey: "calendar_page.rowEvents", color: "var(--gold)" },
                { labelKey: "calendar_page.rowMedia", color: "var(--cyan)" },
                { labelKey: "calendar_page.rowOperations", color: "var(--neon-green)" },
              ].map(({ labelKey, color }) => (
                <div key={labelKey} className="flex items-center gap-2">
                  <span className="rounded-full" style={{ width: "8px", height: "8px", background: color, display: "inline-block" }} />
                  <span className="text-text-muted uppercase" style={{ fontSize: "12px", fontFamily: "'Space Mono', monospace" }}>
                    {t(lang, labelKey)}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 ml-auto">
                <span
                  className="rounded px-2 py-0.5"
                  style={{ background: "rgb(var(--gold-rgb) / 0.08)", border: "1px solid rgb(var(--gold-rgb) / 0.25)", color: "var(--gold)", fontSize: "11px", fontFamily: "'Space Mono', monospace" }}
                >
                  {t(lang, "calendar_page.currentWeek")}
                </span>
              </div>
            </div>
          </TacticalPanel>
        )}

        {/* ─── LIST VIEW ──────────────────────────────────────── */}
        {view === "LIST" && (
          <TacticalPanel title={t(lang, "calendar_page.allScheduledEvents")} noPadding className="flex-1">
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
              {/* Table header */}
              <div
                className="grid sticky top-0 px-4 py-2"
                style={{
                  gridTemplateColumns: "90px 80px 1fr 160px 90px",
                  gap: "8px",
                  background: "var(--bg)",
                  borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.3)",
                }}
              >
                {[t(lang, "calendar_page.date"), t(lang, "calendar_page.type"), t(lang, "calendar_page.title"), t(lang, "calendar_page.location"), t(lang, "calendar_page.status")].map((h) => (
                  <span
                    key={h}
                    className="text-text-muted uppercase"
                    style={{ fontSize: "12px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em" }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              {LIST_EVENTS.map((ev) => {
                const color = typeBadgeColor(ev.type);
                const bg = typeBadgeBg(ev.type);
                return (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="grid w-full text-left px-4 py-2 hover:brightness-125 transition-all"
                    style={{
                      gridTemplateColumns: "90px 80px 1fr 160px 90px",
                      gap: "8px",
                      borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.08)",
                      background: selectedEvent?.id === ev.id ? "rgb(var(--cyan-rgb) / 0.05)" : "transparent",
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    <span className="text-text-muted" style={{ fontSize: "12px" }}>
                      {DAY_DATES[ev.day]}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded self-start"
                      style={{ background: bg, color, border: `1px solid ${color}`, fontSize: "11px" }}
                    >
                      {typeLabel(lang, ev.type)}
                    </span>
                    <span className="text-white uppercase font-bold" style={{ fontSize: "13px" }}>
                      {eventTitle(lang, ev.title)}
                    </span>
                    <span className="text-text-muted" style={{ fontSize: "12px" }}>
                      {ev.location}
                    </span>
                    <span
                      className="text-xs"
                      style={{
                        fontSize: "11px",
                        color: ev.status === "CONFIRMED" ? "var(--neon-green)" : "var(--warn-orange)",
                      }}
                    >
                      {t(lang, ev.status === "CONFIRMED" ? "calendar_page.statusConfirmed" : (ev.status as string) === "ACTIVE" ? "calendar_page.statusActive" : "calendar_page.statusPending")}
                    </span>
                  </button>
                );
              })}
            </div>
          </TacticalPanel>
        )}
      </div>

      {/* ─── Bottom Stats Bar ─────────────────────────────────── */}
      <div
        className="fixed left-0 right-0 flex items-center justify-center gap-0"
        style={{
          bottom: "36px",
          height: "48px",
          background: "var(--panel)",
          borderTop: "1px solid rgb(var(--cyan-rgb) / 0.2)",
          fontFamily: "'Space Mono', monospace",
          zIndex: 30,
        }}
      >
        {[
          { value: totalEvents, labelKey: "calendar_page.rowEvents" },
          { value: totalMedia, labelKey: "calendar_page.statMediaAppearances" },
          { value: totalOps, labelKey: "calendar_page.rowOperations" },
          { value: totalOperatives, labelKey: "calendar_page.statOperativesDeployed" },
        ].map(({ value, labelKey }, i, arr) => (
          <div key={labelKey} className="flex items-center">
            <div className="flex items-center gap-2 px-6">
              <span
                className="text-gold font-bold"
                style={{ fontSize: "22px", lineHeight: 1 }}
              >
                {value}
              </span>
              <span
                className="text-text-muted uppercase"
                style={{ fontSize: "12px", letterSpacing: "0.1em" }}
              >
                {t(lang, labelKey)}
              </span>
            </div>
            {i < arr.length - 1 && (
              <div style={{ width: "1px", height: "24px", background: "rgb(var(--cyan-rgb) / 0.3)" }} />
            )}
          </div>
        ))}
      </div>

      {/* ─── Detail Panel ─────────────────────────────────────── */}
      {selectedEvent && (
        <DetailPanel ev={selectedEvent} lang={lang} onClose={() => setSelectedEvent(null)} />
      )}

      <StatusBar
        leftText={t(lang, "calendar_page.calendarScheduleDayDaysToElection", { gameDay: gameDay, totalDays: totalDays, totalDaysGameDay: totalDays - gameDay })}
        rightText={t(lang, "calendar_page.clickEventForDetailsEscTo")}
      />
    </div>
  );
}
