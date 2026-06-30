"use client";
import { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import StatBar from "../components/ui/StatBar";
import TrendLine from "../components/charts/TrendLine";
import { nationalPollHistory } from "../data/parties";
import { useGameStore } from "../store/gameStore";
import { formatNumber, formatPercent, formatSignedPercent } from "../utils/format";

type Tab = "POLLING" | "DEMOGRAPHICS" | "SWING VOTERS" | "ISSUES" | "FORECAST";
const TABS: Tab[] = ["POLLING", "DEMOGRAPHICS", "SWING VOTERS", "ISSUES", "FORECAST"];

const DEMO_AGE = [
  { group: "18–25", value: 45 },
  { group: "26–35", value: 52 },
  { group: "36–45", value: 48 },
  { group: "46–55", value: 44 },
  { group: "56+",   value: 38 },
];

const DEMO_ETHNICITY = [
  { group: "Malay",   value: 52 },
  { group: "Chinese", value: 35 },
  { group: "Indian",  value: 48 },
  { group: "Others",  value: 55 },
];

const ISSUES_DATA = [
  { issue: "COST OF LIVING", importance: 78, mandat: 62 },
  { issue: "JOBS",           importance: 71, mandat: 55 },
  { issue: "HOUSING",        importance: 65, mandat: 48 },
  { issue: "HEALTHCARE",     importance: 62, mandat: 58 },
  { issue: "EDUCATION",      importance: 58, mandat: 52 },
  { issue: "CORRUPTION",     importance: 55, mandat: 71 },
];


export default function PollingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("POLLING");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { states: gameStates, getNationalSupport, getTotalProjectedSeats, leader } = useGameStore();

  const nationalSupport = getNationalSupport();
  const projectedSeats = getTotalProjectedSeats();

  const pieData = [
    { name: leader.partyAbbr, value: nationalSupport.mandat, color: leader.partyColor },
    { name: "PARTI LAWAN", value: nationalSupport.lawan, color: "var(--warn-orange)" },
    { name: "OTHERS", value: nationalSupport.others, color: "#4a5568" },
  ];

  const forecastScenarios = [
    { label: "BEST CASE",  seats: Math.min(222, projectedSeats + 34), color: "var(--neon-green)", desc: "High swing, strong turnout" },
    { label: "BASE CASE",  seats: projectedSeats,                      color: "var(--cyan)", desc: "Current trajectory" },
    { label: "WORST CASE", seats: Math.max(0,   projectedSeats - 22),  color: "var(--neon-red)", desc: "Low turnout, opposition surge" },
  ];

  const swingStates = useMemo(() => {
    return [...gameStates]
      .filter((s) => s.swingProbability >= 15)
      .sort((a, b) => b.swingProbability - a.swingProbability)
      .slice(0, 6)
      .map((s) => ({
        state: s.name,
        swing: s.swingProbability,
        direction: s.trend > 0.3 ? "toward" : s.trend < -0.3 ? "away" : "either",
        seats: Math.max(1, Math.round(s.seats * s.swingProbability / 100)),
      }));
  }, [gameStates]);

  const sortedStates = useMemo(() => {
    return [...gameStates].sort((a, b) =>
      sortDir === "desc"
        ? b.mandatSupport - a.mandatSupport
        : a.mandatSupport - b.mandatSupport
    );
  }, [sortDir, gameStates]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", fontFamily: "'Space Mono', monospace" }}>
      <Header />
      <StatusBar leftText="» POLLING & ANALYTICS · INTEL COMMAND" rightText="TAB: SWITCH PANEL · SORT: CLICK HEADER" />

      <main className="pt-[56px] pb-[52px] px-6 min-h-screen">

        {/* Tab Row */}
        <div className="flex gap-0 border-b mb-4" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.2)" }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-[13px] tracking-widest uppercase transition-colors"
              style={{
                color: activeTab === tab ? "#ffffff" : "var(--text-muted)",
                borderBottom: activeTab === tab ? "2px solid var(--gold)" : "2px solid transparent",
                background: "none",
                marginBottom: "-1px",
                cursor: "pointer",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* POLLING TAB */}
        {activeTab === "POLLING" && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              {/* Left: National Poll Pie */}
              <div style={{ flex: "0 0 28%" }}>
                <TacticalPanel title="NATIONAL POLL">
                  <div style={{ height: "200px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "var(--panel)",
                            border: "1px solid rgb(var(--cyan-rgb) / 0.3)",
                            fontFamily: "'Space Mono', monospace",
                            fontSize: "12px",
                            padding: "6px 10px",
                          }}
                          labelStyle={{ color: "var(--gold)" }}
                          formatter={(value, name) => [formatPercent(value as number), String(name)]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend */}
                  <div className="flex flex-col gap-2 mt-1">
                    {pieData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                          <span style={{ color: "var(--text-muted)" }}>{d.name}</span>
                        </div>
                        <span className="font-bold" style={{ color: d.color }}>{formatPercent(d.value)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2" style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
                    <div className="text-[11px] tracking-wider" style={{ color: "var(--text-muted)" }}>LATEST: 27 MAY 2024</div>
                    <div className="text-[12px] font-bold mt-1" style={{ color: "var(--neon-green)" }}>▲ +2.1% VS PREV POLL</div>
                  </div>
                </TacticalPanel>
              </div>

              {/* Center: Vote Share by State */}
              <div style={{ flex: "1" }}>
                <TacticalPanel title="VOTE SHARE BY STATE" noPadding={true}>
                  <div className="p-4 pb-0">
                    {/* Table header */}
                    <div className="grid text-[12px] tracking-widest pb-2" style={{
                      gridTemplateColumns: "1fr 60px 60px 60px 120px",
                      borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.3)",
                      color: "var(--gold)",
                    }}>
                      <div
                        className="cursor-pointer hover:text-white transition-colors"
                        onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
                      >
                        STATE
                      </div>
                      <div className="text-center">M%</div>
                      <div className="text-center">L%</div>
                      <div className="text-center">O%</div>
                      <div className="text-center">LEAD</div>
                    </div>
                  </div>
                  <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                    {sortedStates.map((s) => {
                      const maxVal = Math.max(s.mandatSupport, s.lawanSupport, s.othersSupport);
                      const leader = s.mandatSupport === maxVal ? "MANDAT" : s.lawanSupport === maxVal ? "LAWAN" : "OTHERS";
                      const margin = leader === "MANDAT"
                        ? s.mandatSupport - Math.max(s.lawanSupport, s.othersSupport)
                        : leader === "LAWAN"
                        ? s.lawanSupport - Math.max(s.mandatSupport, s.othersSupport)
                        : s.othersSupport - Math.max(s.mandatSupport, s.lawanSupport);
                      const leadColor = leader === "MANDAT" ? "var(--cyan)" : leader === "LAWAN" ? "var(--warn-orange)" : "var(--text-muted)";
                      return (
                        <div
                          key={s.id}
                          className="grid text-[12px] px-4 py-1.5 hover:bg-cyan/5 transition-colors"
                          style={{
                            gridTemplateColumns: "1fr 60px 60px 60px 120px",
                            borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.06)",
                          }}
                        >
                          <div className="text-white tracking-wider uppercase">{s.shortName}</div>
                          <div className="text-center font-bold" style={{ color: s.mandatSupport === maxVal ? "var(--cyan)" : "#ffffff" }}>
                            {formatNumber(s.mandatSupport)}
                          </div>
                          <div className="text-center" style={{ color: s.lawanSupport === maxVal ? "var(--warn-orange)" : "var(--text-muted)" }}>
                            {formatNumber(s.lawanSupport)}
                          </div>
                          <div className="text-center" style={{ color: "var(--text-muted)" }}>{formatNumber(s.othersSupport)}</div>
                          <div className="text-center font-bold" style={{ color: leadColor }}>
                            {leader} {formatSignedPercent(margin)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TacticalPanel>
              </div>

              {/* Right: Swing Voters */}
              <div style={{ flex: "0 0 22%" }}>
                <TacticalPanel title="SWING VOTERS">
                  <div className="text-center mb-3">
                    <div className="font-bold" style={{ color: "var(--gold)", fontSize: "77px", lineHeight: 1 }}>22%</div>
                    <div className="text-[11px] tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>UNDECIDED NATIONALLY</div>
                    <div className="text-[12px] font-bold mt-1" style={{ color: "var(--neon-green)" }}>+8% VS LAST POLL</div>
                  </div>

                  <div className="mt-3 pt-2" style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
                    <div className="text-[11px] tracking-widest mb-2" style={{ color: "var(--gold)" }}>KEY FACTORS</div>
                    <ul className="flex flex-col gap-1">
                      {["Cost of living", "Job opportunities", "Healthcare", "Education", "Corruption / Governance"].map((f) => (
                        <li key={f} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                          <span style={{ color: "var(--gold)" }}>•</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 pt-2" style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
                    <div className="text-[11px] tracking-widest" style={{ color: "var(--text-muted)" }}>POTENTIAL GAIN</div>
                    <div className="text-[22px] font-bold mt-1" style={{ color: "var(--cyan)" }}>8–15 SEATS</div>
                  </div>
                </TacticalPanel>
              </div>
            </div>

            {/* Bottom: Trend Chart */}
            <TacticalPanel title="SUPPORT TREND — 6 MONTHS">
              <TrendLine
                data={nationalPollHistory}
                lines={[
                  { key: "mandat", color: leader.partyColor, label: leader.partyAbbr },
                  { key: "lawan",  color: "var(--warn-orange)", label: "LAWAN" },
                  { key: "others", color: "var(--text-muted)", label: "OTHERS" },
                ]}
                xKey="month"
                height={180}
                showGrid={true}
                showLegend={true}
              />
            </TacticalPanel>
          </div>
        )}

        {/* DEMOGRAPHICS TAB */}
        {activeTab === "DEMOGRAPHICS" && (
          <div className="flex gap-4">
            <div style={{ flex: 1 }}>
              <TacticalPanel title="SUPPORT BY AGE GROUP">
                <div className="flex flex-col gap-3 mt-2">
                  {DEMO_AGE.map((d) => (
                    <StatBar key={d.group} label={d.group} value={d.value} max={100} color="var(--cyan)" animate={true} />
                  ))}
                </div>
                <div className="mt-3 text-[11px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                  MANDAT SUPPORT % BY AGE GROUP
                </div>
              </TacticalPanel>
            </div>
            <div style={{ flex: 1 }}>
              <TacticalPanel title="SUPPORT BY ETHNICITY">
                <div className="flex flex-col gap-3 mt-2">
                  {DEMO_ETHNICITY.map((d) => (
                    <StatBar key={d.group} label={d.group} value={d.value} max={100} color="var(--gold)" animate={true} />
                  ))}
                </div>
                <div className="mt-3 text-[11px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                  MANDAT SUPPORT % BY ETHNICITY
                </div>
              </TacticalPanel>
            </div>
            <div style={{ flex: 1 }}>
              <TacticalPanel title="URBAN VS RURAL">
                <div className="flex flex-col gap-4 mt-2">
                  <div>
                    <div className="flex justify-between text-[12px] mb-1" style={{ color: "var(--text-muted)" }}>
                      <span>URBAN</span><span style={{ color: "var(--cyan)" }}>54%</span>
                    </div>
                    <div className="h-2 w-full" style={{ background: "var(--bar-empty)" }}>
                      <div className="h-2" style={{ width: "54%", background: "var(--cyan)" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[12px] mb-1" style={{ color: "var(--text-muted)" }}>
                      <span>RURAL</span><span style={{ color: "var(--gold)" }}>41%</span>
                    </div>
                    <div className="h-2 w-full" style={{ background: "var(--bar-empty)" }}>
                      <div className="h-2" style={{ width: "41%", background: "var(--gold)" }} />
                    </div>
                  </div>
                  <div className="text-[11px] tracking-widest mt-2" style={{ color: "var(--text-muted)" }}>
                    MANDAT STRONGER IN URBAN AREAS.<br />RURAL OUTREACH NEEDED.
                  </div>
                </div>
              </TacticalPanel>
            </div>
          </div>
        )}

        {/* SWING VOTERS TAB */}
        {activeTab === "SWING VOTERS" && (
          <div className="flex flex-col gap-4">
            <TacticalPanel title="SWING VOTER ANALYSIS — STATE BREAKDOWN">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.3)" }}>
                      {["STATE", "SWING PROBABILITY", "DIRECTION", "SEATS AT RISK"].map((h) => (
                        <th key={h} className="py-2 px-3 text-left tracking-widest uppercase" style={{ color: "var(--gold)", fontWeight: "normal" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {swingStates.map((row, i) => {
                      const dirColor = row.direction === "toward" ? "var(--neon-green)" : row.direction === "away" ? "var(--neon-red)" : "var(--gold)";
                      const dirLabel = row.direction === "toward" ? "▲ TOWARD MANDAT" : row.direction === "away" ? "▼ AWAY FROM MANDAT" : "◆ UNCERTAIN";
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.08)" }} className="hover:bg-cyan/5">
                          <td className="py-2 px-3 text-white uppercase font-bold">{row.state}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5" style={{ width: `${row.swing * 2}px`, background: dirColor, opacity: 0.7 }} />
                              <span style={{ color: dirColor }}>{formatPercent(row.swing)}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 font-bold text-[12px]" style={{ color: dirColor }}>{dirLabel}</td>
                          <td className="py-2 px-3 font-bold" style={{ color: "var(--cyan)" }}>{row.seats} SEATS</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TacticalPanel>
            <div className="flex gap-4">
              <TacticalPanel title="NATIONAL SWING SUMMARY" className="flex-1">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: "var(--text-muted)" }}>TOTAL UNDECIDED</span>
                    <span className="font-bold" style={{ color: "var(--gold)" }}>22%</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: "var(--text-muted)" }}>POTENTIAL SEATS (GAIN)</span>
                    <span className="font-bold" style={{ color: "var(--neon-green)" }}>8–15</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: "var(--text-muted)" }}>POTENTIAL SEATS (LOSE)</span>
                    <span className="font-bold" style={{ color: "var(--neon-red)" }}>3–7</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: "var(--text-muted)" }}>NET SWING PROBABILITY</span>
                    <span className="font-bold" style={{ color: "var(--cyan)" }}>+5 TO +8 SEATS</span>
                  </div>
                </div>
              </TacticalPanel>
            </div>
          </div>
        )}

        {/* ISSUES TAB */}
        {activeTab === "ISSUES" && (
          <TacticalPanel title="KEY ISSUES — IMPORTANCE VS MANDAT STRENGTH">
            <div className="flex flex-col gap-4 mt-2">
              {ISSUES_DATA.map((d) => (
                <div key={d.issue} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[12px] tracking-widest">
                    <span className="text-white uppercase">{d.issue}</span>
                    <div className="flex gap-4">
                      <span style={{ color: "var(--text-muted)" }}>IMPORTANCE: <span className="text-white font-bold">{d.importance}%</span></span>
                      <span style={{ color: "var(--text-muted)" }}>MANDAT STR: <span className="font-bold" style={{ color: d.mandat >= 60 ? "var(--neon-green)" : d.mandat >= 50 ? "var(--gold)" : "var(--neon-red)" }}>{d.mandat}%</span></span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 h-2" style={{ background: "var(--bar-empty)", position: "relative" }}>
                      <div className="h-2" style={{ width: `${d.importance}%`, background: "var(--text-muted)", opacity: 0.5 }} />
                    </div>
                    <span className="text-[11px] w-8 text-right" style={{ color: "var(--text-muted)" }}>{d.importance}%</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 h-2" style={{ background: "var(--bar-empty)" }}>
                      <div className="h-2" style={{ width: `${d.mandat}%`, background: d.mandat >= 60 ? "var(--neon-green)" : d.mandat >= 50 ? "var(--gold)" : "var(--neon-red)" }} />
                    </div>
                    <span className="text-[11px] w-8 text-right font-bold" style={{ color: d.mandat >= 60 ? "var(--neon-green)" : d.mandat >= 50 ? "var(--gold)" : "var(--neon-red)" }}>{d.mandat}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-[11px] tracking-widest" style={{ color: "var(--text-muted)" }}>
              <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-1.5" style={{ background: "var(--text-muted)", opacity: 0.5 }} /> ISSUE IMPORTANCE</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-1.5" style={{ background: "var(--cyan)" }} /> MANDAT STRENGTH</div>
            </div>
          </TacticalPanel>
        )}

        {/* FORECAST TAB */}
        {activeTab === "FORECAST" && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              {forecastScenarios.map((sc) => (
                <TacticalPanel key={sc.label} title={sc.label} className="flex-1">
                  <div className="text-center py-4">
                    <div className="font-bold" style={{ color: sc.color, fontSize: "86px", lineHeight: 1 }}>{sc.seats}</div>
                    <div className="text-[12px] tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>PROJECTED SEATS</div>
                    <div className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>{sc.desc}</div>
                    <div className="mt-3 text-[11px] tracking-widest" style={{ color: sc.color }}>
                      {sc.seats >= 112 ? "▲ SUPERMAJORITY" : sc.seats >= 112 ? "▲ MAJORITY" : sc.seats >= 94 ? "▲ MAJORITY" : sc.seats >= 72 ? "◆ STRONG OPPOSITION" : "▼ OPPOSITION"}
                    </div>
                  </div>
                </TacticalPanel>
              ))}
            </div>
            <TacticalPanel title="PATH TO MAJORITY — SEAT TRACKER">
              <div className="flex items-center justify-between mb-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
                <span>CURRENT PROJECTION</span>
                <span className="font-bold" style={{ color: "var(--cyan)" }}>{projectedSeats} / 222 SEATS</span>
                <span>TARGET: 112 SEATS</span>
              </div>
              <div className="relative h-6 w-full" style={{ background: "var(--bar-empty)" }}>
                <div className="absolute left-0 top-0 h-6 flex items-center" style={{ width: `${(projectedSeats / 222) * 100}%`, background: "linear-gradient(90deg, var(--cyan), #0099bb)" }}>
                  <span className="text-[11px] font-bold text-black pl-2">{projectedSeats}</span>
                </div>
                <div
                  className="absolute top-0 h-6 w-px"
                  style={{ left: `${(112 / 222) * 100}%`, background: "var(--gold)", boxShadow: "0 0 6px var(--gold)" }}
                />
                <div
                  className="absolute text-[10px] tracking-wider"
                  style={{ left: `${(112 / 222) * 100}%`, top: "-16px", color: "var(--gold)", transform: "translateX(-50%)" }}
                >
                  112 MAJORITY
                </div>
              </div>
              <div className="flex justify-between mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                <span>0</span>
                <span style={{ color: projectedSeats >= 112 ? "var(--neon-green)" : "var(--neon-red)" }}>
                  {projectedSeats >= 112 ? `MAJORITY — +${projectedSeats - 112} ABOVE` : `NEED +${112 - projectedSeats} MORE SEATS`}
                </span>
                <span>222</span>
              </div>
            </TacticalPanel>
          </div>
        )}
      </main>
    </div>
  );
}
