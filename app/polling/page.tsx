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
import { nationalPollHistory, getStatePollHistory } from "../data/parties";
import { useGameStore } from "../store/gameStore";
import { formatNumber, formatPercent, formatSignedPercent } from "../utils/format";
import { useLang, t } from "../i18n/useLang";

type Tab = "POLLING" | "DEMOGRAPHICS" | "SWING VOTERS" | "ISSUES" | "FORECAST";
const TABS: Tab[] = ["POLLING", "DEMOGRAPHICS", "SWING VOTERS", "ISSUES", "FORECAST"];
const TAB_LABEL_KEYS: Record<Tab, string> = {
  "POLLING": "polling_page.tabPolling",
  "DEMOGRAPHICS": "polling_page.tabDemographics",
  "SWING VOTERS": "polling_page.tabSwingVoters",
  "ISSUES": "polling_page.tabIssues",
  "FORECAST": "polling_page.tabForecast",
};

const DEMO_AGE = [
  { group: "18–25", value: 45 },
  { group: "26–35", value: 52 },
  { group: "36–45", value: 48 },
  { group: "46–55", value: 44 },
  { group: "56+",   value: 38 },
];

const DEMO_ETHNICITY = [
  { labelKey: "polling_page.ethnicityMalay", value: 52 },
  { labelKey: "polling_page.ethnicityChinese", value: 35 },
  { labelKey: "polling_page.ethnicityIndian", value: 48 },
  { labelKey: "polling_page.ethnicityOthers", value: 55 },
];

const ISSUES_DATA = [
  { labelKey: "polling_page.issueCostOfLiving", importance: 78, mandat: 62 },
  { labelKey: "polling_page.issueJobs", importance: 71, mandat: 55 },
  { labelKey: "polling_page.issueHousing", importance: 65, mandat: 48 },
  { labelKey: "polling_page.issueHealthcare", importance: 62, mandat: 58 },
  { labelKey: "polling_page.issueEducation", importance: 58, mandat: 52 },
  { labelKey: "polling_page.issueCorruption", importance: 55, mandat: 71 },
];

const KEY_FACTORS: string[] = [
  "polling_page.factorCostOfLiving",
  "polling_page.factorJobOpportunities",
  "polling_page.factorHealthcare",
  "polling_page.factorEducation",
  "polling_page.factorCorruptionGovernance",
];


export default function PollingPage() {
  const lang = useLang();
  const [activeTab, setActiveTab] = useState<Tab>("POLLING");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { states: gameStates, getNationalSupport, getTotalProjectedSeats, leader, settings } = useGameStore();

  const isPrn = settings.electionScope === "prn";
  const prnState = gameStates.find((state) => state.id === settings.prnStateId) ?? gameStates[0];
  const scopedStates = useMemo(() => (isPrn && prnState ? [prnState] : gameStates), [isPrn, prnState, gameStates]);
  const seatTotal = isPrn ? (prnState?.dunSeats ?? 0) : 222;
  const majorityTarget = Math.floor(seatTotal / 2) + 1;
  const supermajorityTarget = Math.ceil(seatTotal * (2 / 3));
  const strongOppositionTarget = Math.round(seatTotal * 0.32);
  const projectedSeats = isPrn ? (prnState?.projectedSeats ?? 0) : getTotalProjectedSeats();
  const nationalSupport = isPrn && prnState
    ? { mandat: prnState.mandatSupport, lawan: prnState.lawanSupport, others: prnState.othersSupport }
    : getNationalSupport();
  const pollHistory = useMemo(
    () => (isPrn && prnState ? getStatePollHistory(prnState) : nationalPollHistory),
    [isPrn, prnState]
  );

  const pieData = [
    { name: leader.partyAbbr, value: nationalSupport.mandat, color: leader.partyColor },
    { name: t(lang, "polling_page.oppositionParty"), value: nationalSupport.lawan, color: "var(--warn-orange)" },
    { name: t(lang, "polling_page.others"), value: nationalSupport.others, color: "#4a5568" },
  ];

  const forecastScenarios = [
    { label: t(lang, "polling_page.bestCase"), seats: Math.min(seatTotal, projectedSeats + Math.ceil(seatTotal * 0.15)), color: "var(--neon-green)", desc: t(lang, "polling_page.highSwingStrongTurnout") },
    { label: t(lang, "polling_page.baseCase"), seats: projectedSeats, color: "var(--cyan)", desc: t(lang, "polling_page.currentTrajectory") },
    { label: t(lang, "polling_page.worstCase"), seats: Math.max(0, projectedSeats - Math.ceil(seatTotal * 0.10)), color: "var(--neon-red)", desc: t(lang, "polling_page.lowTurnoutOppositionSurge") },
  ];

  const swingStates = useMemo(() => {
    return [...scopedStates]
      .filter((s) => s.swingProbability >= 15)
      .sort((a, b) => b.swingProbability - a.swingProbability)
      .slice(0, 6)
      .map((s) => ({
        state: s.name,
        swing: s.swingProbability,
        direction: s.trend > 0.3 ? "toward" : s.trend < -0.3 ? "away" : "either",
        seats: Math.max(1, Math.round((isPrn ? s.dunSeats : s.seats) * s.swingProbability / 100)),
      }));
  }, [scopedStates, isPrn]);

  const sortedStates = useMemo(() => {
    return [...scopedStates].sort((a, b) =>
      sortDir === "desc"
        ? b.mandatSupport - a.mandatSupport
        : a.mandatSupport - b.mandatSupport
    );
  }, [sortDir, scopedStates]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", fontFamily: "'Space Mono', monospace" }}>
      <Header />
      <StatusBar leftText={t(lang, "polling_page.pollingAnalyticsIntelCommand")} rightText={t(lang, "polling_page.tabSwitchPanelSortClickHeader")} />

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
              {t(lang, TAB_LABEL_KEYS[tab])}
            </button>
          ))}
        </div>

        {/* POLLING TAB */}
        {activeTab === "POLLING" && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              {/* Left: National Poll Pie */}
              <div style={{ flex: "0 0 28%" }}>
                <TacticalPanel title={isPrn ? t(lang, "polling_page.prnStatePoll") : t(lang, "polling_page.nationalPoll")}>
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
                    <div className="text-[11px] tracking-wider" style={{ color: "var(--text-muted)" }}>{t(lang, "polling_page.latest27May2024")}</div>
                    <div className="text-[12px] font-bold mt-1" style={{ color: "var(--neon-green)" }}>{t(lang, "polling_page._21VsPrevPoll")}</div>
                  </div>
                </TacticalPanel>
              </div>

              {/* Center: Vote Share by State */}
              <div style={{ flex: "1" }}>
                <TacticalPanel title={isPrn ? t(lang, "polling_page.voteShareByPrnState") : t(lang, "polling_page.voteShareByState")} noPadding={true}>
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
                        {isPrn ? "NEGERI" : t(lang, "polling_page.state")}
                      </div>
                      <div className="text-center">M%</div>
                      <div className="text-center">L%</div>
                      <div className="text-center">O%</div>
                      <div className="text-center">{t(lang, "polling_page.lead")}</div>
                    </div>
                  </div>
                  <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                    {sortedStates.map((s) => {
                      const maxVal = Math.max(s.mandatSupport, s.lawanSupport, s.othersSupport);
                      const leaderParty = s.mandatSupport === maxVal ? "MANDAT" : s.lawanSupport === maxVal ? "LAWAN" : t(lang, "polling_page.others");
                      const margin = s.mandatSupport === maxVal
                        ? s.mandatSupport - Math.max(s.lawanSupport, s.othersSupport)
                        : s.lawanSupport === maxVal
                        ? s.lawanSupport - Math.max(s.mandatSupport, s.othersSupport)
                        : s.othersSupport - Math.max(s.mandatSupport, s.lawanSupport);
                      const leadColor = s.mandatSupport === maxVal ? "var(--cyan)" : s.lawanSupport === maxVal ? "var(--warn-orange)" : "var(--text-muted)";
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
                            {leaderParty} {formatSignedPercent(margin)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TacticalPanel>
              </div>

              {/* Right: Swing Voters */}
              <div style={{ flex: "0 0 22%" }}>
                <TacticalPanel title={t(lang, "polling_page.swingVoters")}>
                  <div className="text-center mb-3">
                    <div className="font-bold" style={{ color: "var(--gold)", fontSize: "77px", lineHeight: 1 }}>22%</div>
                    <div className="text-[11px] tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>{isPrn ? t(lang, "polling_page.undecidedInState") : t(lang, "polling_page.undecidedNationally")}</div>
                    <div className="text-[12px] font-bold mt-1" style={{ color: "var(--neon-green)" }}>{t(lang, "polling_page._8VsLastPoll")}</div>
                  </div>

                  <div className="mt-3 pt-2" style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
                    <div className="text-[11px] tracking-widest mb-2" style={{ color: "var(--gold)" }}>{t(lang, "polling_page.keyFactors")}</div>
                    <ul className="flex flex-col gap-1">
                      {KEY_FACTORS.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                          <span style={{ color: "var(--gold)" }}>•</span>
                          {t(lang, f)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 pt-2" style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
                    <div className="text-[11px] tracking-widest" style={{ color: "var(--text-muted)" }}>{t(lang, "polling_page.potentialGain")}</div>
                    <div className="text-[22px] font-bold mt-1" style={{ color: "var(--cyan)" }}>{isPrn ? t(lang, "polling_page._25Dun") : t(lang, "polling_page._815Seats")}</div>
                  </div>
                </TacticalPanel>
              </div>
            </div>

            {/* Bottom: Trend Chart */}
            <TacticalPanel
              title={
                isPrn && prnState
                  ? t(lang, "polling_page.supportTrend6Months", { prnStateName: prnState.name.toUpperCase() })
                  : t(lang, "polling_page.supportTrend6Months2")
              }
            >
              <TrendLine
                data={pollHistory}
                lines={[
                  { key: "mandat", color: leader.partyColor, label: leader.partyAbbr },
                  { key: "lawan",  color: "var(--warn-orange)", label: "LAWAN" },
                  { key: "others", color: "var(--text-muted)", label: t(lang, "polling_page.others") },
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
              <TacticalPanel title={t(lang, "polling_page.supportByAgeGroup")}>
                <div className="flex flex-col gap-3 mt-2">
                  {DEMO_AGE.map((d) => (
                    <StatBar key={d.group} label={d.group} value={d.value} max={100} color="var(--cyan)" animate={true} />
                  ))}
                </div>
                <div className="mt-3 text-[11px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                  {t(lang, "polling_page.mandatSupportByAgeGroup")}
                </div>
              </TacticalPanel>
            </div>
            <div style={{ flex: 1 }}>
              <TacticalPanel title={t(lang, "polling_page.supportByEthnicity")}>
                <div className="flex flex-col gap-3 mt-2">
                  {DEMO_ETHNICITY.map((d) => (
                    <StatBar key={d.labelKey} label={t(lang, d.labelKey)} value={d.value} max={100} color="var(--gold)" animate={true} />
                  ))}
                </div>
                <div className="mt-3 text-[11px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                  {t(lang, "polling_page.mandatSupportByEthnicity")}
                </div>
              </TacticalPanel>
            </div>
            <div style={{ flex: 1 }}>
              <TacticalPanel title={t(lang, "polling_page.urbanVsRural")}>
                <div className="flex flex-col gap-4 mt-2">
                  <div>
                    <div className="flex justify-between text-[12px] mb-1" style={{ color: "var(--text-muted)" }}>
                      <span>{t(lang, "polling_page.urban")}</span><span style={{ color: "var(--cyan)" }}>54%</span>
                    </div>
                    <div className="h-2 w-full" style={{ background: "var(--bar-empty)" }}>
                      <div className="mm-bar h-2" style={{ width: "54%", background: "var(--cyan)" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[12px] mb-1" style={{ color: "var(--text-muted)" }}>
                      <span>{t(lang, "polling_page.rural")}</span><span style={{ color: "var(--gold)" }}>41%</span>
                    </div>
                    <div className="h-2 w-full" style={{ background: "var(--bar-empty)" }}>
                      <div className="mm-bar h-2" style={{ width: "41%", background: "var(--gold)" }} />
                    </div>
                  </div>
                  <div className="text-[11px] tracking-widest mt-2" style={{ color: "var(--text-muted)" }}>
                    {t(lang, "polling_page.mandatStrongerInUrbanAreas")}<br />{t(lang, "polling_page.ruralOutreachNeeded")}
                  </div>
                </div>
              </TacticalPanel>
            </div>
          </div>
        )}

        {/* SWING VOTERS TAB */}
        {activeTab === "SWING VOTERS" && (
          <div className="flex flex-col gap-4">
            <TacticalPanel title={isPrn ? t(lang, "polling_page.swingVoterAnalysisDunBreakdown") : t(lang, "polling_page.swingVoterAnalysisStateBreakdown")}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.3)" }}>
                      {[isPrn ? "NEGERI" : t(lang, "polling_page.state"), t(lang, "polling_page.swingProbability"), t(lang, "polling_page.direction"), isPrn ? t(lang, "polling_page.dunAtRisk") : t(lang, "polling_page.seatsAtRisk")].map((h) => (
                        <th key={h} className="py-2 px-3 text-left tracking-widest uppercase" style={{ color: "var(--gold)", fontWeight: "normal" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {swingStates.map((row, i) => {
                      const dirColor = row.direction === "toward" ? "var(--neon-green)" : row.direction === "away" ? "var(--neon-red)" : "var(--gold)";
                      const dirLabel = t(lang,
                        row.direction === "toward" ? "polling_page.directionToward" : row.direction === "away" ? "polling_page.directionAway" : "polling_page.directionUncertain");
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
                          <td className="py-2 px-3 font-bold" style={{ color: "var(--cyan)" }}>{row.seats} {isPrn ? "DUN" : t(lang, "polling_page.seats")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TacticalPanel>
            <div className="flex gap-4">
              <TacticalPanel title={isPrn ? t(lang, "polling_page.prnSwingSummary") : t(lang, "polling_page.nationalSwingSummary")} className="flex-1">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: "var(--text-muted)" }}>{t(lang, "polling_page.totalUndecided")}</span>
                    <span className="font-bold" style={{ color: "var(--gold)" }}>22%</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: "var(--text-muted)" }}>{t(lang, "polling_page.potentialSeatsGain")}</span>
                    <span className="font-bold" style={{ color: "var(--neon-green)" }}>8–15</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: "var(--text-muted)" }}>{t(lang, "polling_page.potentialSeatsLose")}</span>
                    <span className="font-bold" style={{ color: "var(--neon-red)" }}>3–7</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: "var(--text-muted)" }}>{t(lang, "polling_page.netSwingProbability")}</span>
                    <span className="font-bold" style={{ color: "var(--cyan)" }}>{t(lang, "polling_page._5To8Seats")}</span>
                  </div>
                </div>
              </TacticalPanel>
            </div>
          </div>
        )}

        {/* ISSUES TAB */}
        {activeTab === "ISSUES" && (
          <TacticalPanel title={t(lang, "polling_page.keyIssuesImportanceVsMandatStrength")}>
            <div className="flex flex-col gap-4 mt-2">
              {ISSUES_DATA.map((d) => (
                <div key={d.labelKey} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[12px] tracking-widest">
                    <span className="text-white uppercase">{t(lang, d.labelKey)}</span>
                    <div className="flex gap-4">
                      <span style={{ color: "var(--text-muted)" }}>{t(lang, "polling_page.importance")}: <span className="text-white font-bold">{d.importance}%</span></span>
                      <span style={{ color: "var(--text-muted)" }}>{t(lang, "polling_page.mandatStr")}: <span className="font-bold" style={{ color: d.mandat >= 60 ? "var(--neon-green)" : d.mandat >= 50 ? "var(--gold)" : "var(--neon-red)" }}>{d.mandat}%</span></span>
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
              <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-1.5" style={{ background: "var(--text-muted)", opacity: 0.5 }} /> {t(lang, "polling_page.issueImportance")}</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-1.5" style={{ background: "var(--cyan)" }} /> {t(lang, "polling_page.mandatStrength")}</div>
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
                    <div className="text-[12px] tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>{isPrn ? t(lang, "polling_page.projectedDun") : t(lang, "polling_page.projectedSeats")}</div>
                    <div className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>{sc.desc}</div>
                    <div className="mt-3 text-[11px] tracking-widest" style={{ color: sc.color }}>
                      {sc.seats >= supermajorityTarget
                        ? t(lang, "polling_page.supermajority")
                        : sc.seats >= majorityTarget
                        ? t(lang, "polling_page.majority")
                        : sc.seats >= strongOppositionTarget
                        ? t(lang, "polling_page.strongOpposition")
                        : t(lang, "polling_page.opposition")}
                    </div>
                  </div>
                </TacticalPanel>
              ))}
            </div>
            <TacticalPanel title={isPrn ? t(lang, "polling_page.pathToStateMajorityDunTracker") : t(lang, "polling_page.pathToMajoritySeatTracker")}>
              <div className="flex items-center justify-between mb-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
                <span>{t(lang, "polling_page.currentProjection")}</span>
                <span className="font-bold" style={{ color: "var(--cyan)" }}>{projectedSeats} / {seatTotal} {isPrn ? "DUN" : t(lang, "polling_page.seats")}</span>
                <span>{t(lang, "polling_page.target")}: {majorityTarget} {isPrn ? "DUN" : t(lang, "polling_page.seats")}</span>
              </div>
              <div className="relative h-6 w-full" style={{ background: "var(--bar-empty)" }}>
                <div className="absolute left-0 top-0 h-6 flex items-center" style={{ width: `${seatTotal > 0 ? (projectedSeats / seatTotal) * 100 : 0}%`, background: "linear-gradient(90deg, var(--cyan), #0099bb)" }}>
                  <span className="text-[11px] font-bold text-black pl-2">{projectedSeats}</span>
                </div>
                <div
                  className="absolute top-0 h-6 w-px"
                  style={{ left: `${seatTotal > 0 ? (majorityTarget / seatTotal) * 100 : 0}%`, background: "var(--gold)", boxShadow: "0 0 6px var(--gold)" }}
                />
                <div
                  className="absolute text-[10px] tracking-wider"
                  style={{ left: `${seatTotal > 0 ? (majorityTarget / seatTotal) * 100 : 0}%`, top: "-16px", color: "var(--gold)", transform: "translateX(-50%)" }}
                >
                  {t(lang, "polling_page.majority2", { majorityTarget: majorityTarget })}
                </div>
              </div>
              <div className="flex justify-between mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                <span>0</span>
                <span style={{ color: projectedSeats >= majorityTarget ? "var(--neon-green)" : "var(--neon-red)" }}>
                  {projectedSeats >= majorityTarget
                    ? t(lang, "polling_page.majorityAbove", { projectedSeatsMajorityTarget: projectedSeats - majorityTarget })
                    : t(lang, "polling_page.needMoreSeats", { majorityTargetProjectedSeats: majorityTarget - projectedSeats })}
                </span>
                <span>{seatTotal}</span>
              </div>
            </TacticalPanel>
          </div>
        )}
      </main>
    </div>
  );
}
