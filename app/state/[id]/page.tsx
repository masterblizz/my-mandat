"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../components/layout/Header";
import StatusBar from "../../components/layout/StatusBar";
import TacticalPanel from "../../components/layout/TacticalPanel";
import StatBar from "../../components/ui/StatBar";
import TrendLine from "../../components/charts/TrendLine";
import { StateData } from "../../data/states";
import { generateConstituencies, Constituency } from "../../data/constituencies";
import { useGameStore } from "../../store/gameStore";

type TabId = "OVERVIEW" | "PARLIAMENT SEATS" | "DEMOGRAPHICS" | "SUPPORT ANALYSIS" | "GROUND REPORT" | "MEDIA LANDSCAPE";

const TABS: TabId[] = [
  "OVERVIEW",
  "PARLIAMENT SEATS",
  "DEMOGRAPHICS",
  "SUPPORT ANALYSIS",
  "GROUND REPORT",
  "MEDIA LANDSCAPE",
];

function generateTrendData(mandatBase: number, lawanBase: number) {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"];
  return months.map((month, i) => ({
    month,
    mandat: Math.max(20, Math.min(75, mandatBase - 6 + i * 1.5 + (Math.sin(i) * 2))),
    lawan: Math.max(20, Math.min(75, lawanBase + 4 - i * 1.2 + (Math.cos(i) * 1.5))),
  }));
}

function getWinDesc(prob: number) {
  if (prob >= 75) return "VERY HIGH";
  if (prob >= 60) return "HIGH";
  if (prob >= 40) return "MODERATE";
  return "LOW";
}

function getWinColor(prob: number) {
  if (prob >= 60) return "var(--neon-green)";
  if (prob >= 40) return "var(--gold)";
  return "var(--neon-red)";
}

function ConstituencyCard({ c }: { c: Constituency }) {
  const winnerColor = c.winner === "mandat" ? "var(--cyan)" : c.winner === "lawan" ? "var(--warn-orange)" : "var(--text-muted)";
  const safetyColor = c.safety === "safe" ? "var(--neon-green)" : c.safety === "marginal" ? "var(--gold)" : "var(--neon-red)";
  const safetyLabel = c.safety === "safe" ? "SAFE" : c.safety === "marginal" ? "MARG" : "DANGER";

  return (
    <div
      className="p-3"
      style={{
        background: "var(--panel)",
        border: `1px solid ${winnerColor}33`,
        borderLeft: `3px solid ${winnerColor}`,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[11px] text-text-muted tracking-wider">{c.code}</div>
          <div className="text-[13px] text-white font-bold truncate" style={{ maxWidth: "130px" }}>{c.name}</div>
        </div>
        <span
          className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 shrink-0"
          style={{ background: `${safetyColor}18`, color: safetyColor, border: `1px solid ${safetyColor}44` }}
        >
          {safetyLabel}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-cyan w-10 shrink-0">MDT</span>
          <div className="flex-1 h-2 bg-bar-empty overflow-hidden">
            <div className="h-2 transition-all" style={{ width: `${c.mandat}%`, background: "var(--cyan)" }} />
          </div>
          <span className="text-[10px] font-bold text-cyan w-6 text-right">{c.mandat}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-warn-orange w-10 shrink-0">LWN</span>
          <div className="flex-1 h-2 bg-bar-empty overflow-hidden">
            <div className="h-2 transition-all" style={{ width: `${c.lawan}%`, background: "var(--warn-orange)" }} />
          </div>
          <span className="text-[10px] font-bold text-warn-orange w-6 text-right">{c.lawan}</span>
        </div>
      </div>
      <div className="mt-1.5 text-[10px] text-text-muted tracking-wider">
        MARGIN: <span className="font-bold" style={{ color: winnerColor }}>{c.margin}%</span>
      </div>
    </div>
  );
}

function MediaLandscapeTab({ state }: { state: StateData }) {
  const coverageScore = Math.round(40 + state.groundStrength * 0.4);
  const positiveSentiment = Math.round(state.mandatSupport * 0.7);
  const negativeSentiment = Math.round(state.lawanSupport * 0.55);
  const neutralSentiment = Math.max(0, 100 - positiveSentiment - negativeSentiment);

  const platforms = [
    { label: "MAINSTREAM TV", reach: Math.round(55 + state.demographics.urban * 0.2), bias: state.mandatSupport >= 45 ? "PRO-MANDAT" : "NEUTRAL", biasColor: state.mandatSupport >= 45 ? "var(--neon-green)" : "var(--text-muted)" },
    { label: "SOCIAL MEDIA", reach: Math.round(40 + state.demographics.youth * 1.2), bias: state.demographics.youth >= 32 ? "CONTESTED" : "NEUTRAL", biasColor: "var(--gold)" },
    { label: "PRINT / ONLINE", reach: Math.round(30 + state.demographics.urban * 0.15), bias: "MIXED", biasColor: "var(--text-muted)" },
    { label: "RADIO", reach: Math.round(20 + state.demographics.rural * 0.25), bias: state.mandatSupport >= 50 ? "PRO-MANDAT" : "NEUTRAL", biasColor: state.mandatSupport >= 50 ? "var(--neon-green)" : "var(--text-muted)" },
  ];

  const keyOutlets = [
    { name: "UTUSAN MELAYU", slant: state.mandatSupport >= 50 ? "FAVOURABLE" : "HOSTILE", color: state.mandatSupport >= 50 ? "var(--neon-green)" : "var(--neon-red)" },
    { name: "THE STAR", slant: state.demographics.chinese >= 30 ? "CRITICAL" : "NEUTRAL", color: state.demographics.chinese >= 30 ? "var(--gold)" : "var(--text-muted)" },
    { name: "MALAYSIAKINI", slant: "CRITICAL", color: "var(--neon-red)" },
    { name: "FREE MALAYSIA TODAY", slant: "NEUTRAL", color: "var(--text-muted)" },
    { name: "ASTRO AWANI", slant: "BALANCED", color: "var(--cyan)" },
  ];

  return (
    <div className="space-y-4">
      {/* Coverage + Sentiment row */}
      <div className="grid grid-cols-3 gap-4">
        <TacticalPanel title="MEDIA COVERAGE">
          <div className="flex flex-col items-center py-4">
            <div
              className="text-5xl font-bold"
              style={{ color: "var(--cyan)", fontFamily: "Space Mono, monospace", textShadow: "0 0 12px rgb(var(--cyan-rgb) / 0.27)" }}
            >
              {coverageScore}%
            </div>
            <div className="text-[12px] text-text-muted mt-2 tracking-wider">COVERAGE SCORE</div>
            <div className="mt-3 w-full h-2 bg-bar-empty overflow-hidden">
              <div className="h-2" style={{ width: `${coverageScore}%`, background: "var(--cyan)" }} />
            </div>
            <div className="text-[11px] text-text-muted mt-1.5">
              {coverageScore >= 70 ? "STRONG PRESENCE" : coverageScore >= 50 ? "MODERATE COVERAGE" : "WEAK COVERAGE"}
            </div>
          </div>
        </TacticalPanel>

        <TacticalPanel title="SENTIMENT BREAKDOWN">
          <div className="space-y-3 mt-1">
            {[
              { label: "POSITIVE", value: positiveSentiment, color: "var(--neon-green)" },
              { label: "NEUTRAL", value: neutralSentiment, color: "var(--text-muted)" },
              { label: "NEGATIVE", value: negativeSentiment, color: "var(--neon-red)" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color }}>{label}</span>
                  <span className="font-bold" style={{ color }}>{value}%</span>
                </div>
                <div className="h-2 bg-bar-empty overflow-hidden">
                  <div className="h-2" style={{ width: `${value}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </TacticalPanel>

        <TacticalPanel title="NARRATIVE CONTROL">
          <div className="space-y-2 mt-1">
            {[
              { topic: "Economy", control: state.mandatSupport >= 50 ? "WINNING" : "LOSING", color: state.mandatSupport >= 50 ? "var(--neon-green)" : "var(--neon-red)" },
              { topic: "Governance", control: state.mandatSupport >= 48 ? "WINNING" : "CONTESTED", color: state.mandatSupport >= 48 ? "var(--neon-green)" : "var(--gold)" },
              { topic: "Security", control: "NEUTRAL", color: "var(--text-muted)" },
              { topic: "Welfare", control: state.demographics.rural >= 50 ? "LOSING" : "WINNING", color: state.demographics.rural >= 50 ? "var(--neon-red)" : "var(--neon-green)" },
            ].map(({ topic, control, color }) => (
              <div key={topic} className="flex justify-between items-center">
                <span className="text-[12px] text-text-muted">{topic}</span>
                <span className="text-[11px] font-bold tracking-wider" style={{ color }}>{control}</span>
              </div>
            ))}
          </div>
        </TacticalPanel>
      </div>

      {/* Platform reach */}
      <TacticalPanel title="PLATFORM REACH">
        <div className="grid grid-cols-2 gap-3 mt-1">
          {platforms.map(({ label, reach, bias, biasColor }) => (
            <div
              key={label}
              className="flex items-center justify-between px-3 py-2.5"
              style={{ background: "rgb(var(--cyan-rgb) / 0.04)", border: "1px solid rgb(var(--cyan-rgb) / 0.1)" }}
            >
              <div>
                <div className="text-[12px] text-white font-bold">{label}</div>
                <div className="text-[11px] font-bold mt-0.5" style={{ color: biasColor }}>{bias}</div>
              </div>
              <div className="text-right">
                <div className="text-[17px] font-bold" style={{ color: "var(--cyan)", fontFamily: "Space Mono, monospace" }}>
                  {reach}%
                </div>
                <div className="text-[10px] text-text-muted">REACH</div>
              </div>
            </div>
          ))}
        </div>
      </TacticalPanel>

      {/* Key Outlets */}
      <TacticalPanel title="KEY OUTLETS">
        <div className="space-y-2 mt-1">
          {keyOutlets.map(({ name, slant, color }) => (
            <div
              key={name}
              className="flex items-center justify-between px-3 py-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span className="text-[12px] text-white">{name}</span>
              <span className="text-[11px] font-bold tracking-wider" style={{ color }}>{slant}</span>
            </div>
          ))}
        </div>
      </TacticalPanel>
    </div>
  );
}

export default function StatePage() {
  const params = useParams();
  const router = useRouter();
  const stateId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const { states: gameStates, operations, leader } = useGameStore();
  const state = gameStates.find((s) => s.id === stateId);
  const [activeTab, setActiveTab] = useState<TabId>("OVERVIEW");
  const [constFilter, setConstFilter] = useState<"all" | "mandat" | "lawan" | "marginal">("all");

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <Header />
        <div className="text-text-muted text-sm">{"// STATE NOT FOUND: "}{stateId}</div>
        <StatusBar />
      </div>
    );
  }

  // Prev / Next state navigation
  const stateIndex = gameStates.findIndex((s) => s.id === stateId);
  const prevState = stateIndex > 0 ? gameStates[stateIndex - 1] : null;
  const nextState = stateIndex < gameStates.length - 1 ? gameStates[stateIndex + 1] : null;

  const trendData = generateTrendData(state.mandatSupport, state.lawanSupport);
  const winColor = getWinColor(state.winProbability);
  const winDesc = getWinDesc(state.winProbability);
  const constituencies = generateConstituencies(state);
  const filteredConst = constituencies.filter((c) => {
    if (constFilter === "all") return true;
    if (constFilter === "mandat") return c.winner === "mandat";
    if (constFilter === "lawan") return c.winner === "lawan";
    if (constFilter === "marginal") return c.safety === "marginal" || c.safety === "danger";
    return true;
  });

  const stateOperations = operations.filter((op) => op.stateIds.includes(stateId));

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      <div className="flex pt-[40px] pb-[36px] min-h-screen">
        {/* Left Sidebar */}
        <div
          className="fixed left-0 top-[40px] bottom-[36px] flex flex-col"
          style={{
            width: "180px",
            background: "var(--panel)",
            borderRight: "1px solid rgb(var(--cyan-rgb) / 0.2)",
          }}
        >
          {/* State header */}
          <div className="px-4 py-4" style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
            <div className="text-white font-bold text-sm tracking-wide">{state.name}</div>
            <div className="text-[12px] text-text-muted mt-0.5 tracking-widest">{state.shortName}</div>
            <div
              className="text-[11px] mt-1 tracking-wider"
              style={{ color: state.region === "borneo" ? "var(--gold)" : "var(--cyan)" }}
            >
              {state.region.toUpperCase()}
            </div>
          </div>

          {/* Nav tabs */}
          <nav className="flex-1 py-2 overflow-y-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="w-full text-left px-4 py-2.5 text-[12px] tracking-wider uppercase transition-all"
                style={{
                  color: activeTab === tab ? "#ffffff" : "var(--text-muted)",
                  borderLeft: activeTab === tab ? "3px solid var(--gold)" : "3px solid transparent",
                  background: activeTab === tab ? "rgb(var(--gold-rgb) / 0.06)" : "transparent",
                }}
              >
                {tab}
              </button>
            ))}
          </nav>

          {/* Back link */}
          <div style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
            <button
              onClick={() => router.push("/warroom")}
              className="w-full text-left px-4 py-3 text-[12px] tracking-wider text-text-muted hover:text-cyan transition-colors"
            >
              ← BACK TO WAR ROOM
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 pl-[180px] pr-6 py-4">
          {/* Top row: state name + key stats */}
          <div className="flex items-start justify-between mb-4 px-2">
            <div>
              <h1
                className="font-bold uppercase tracking-wide"
                style={{ fontSize: "34px", color: "var(--text-primary)", fontFamily: "Space Mono, monospace" }}
              >
                {state.name}
              </h1>
              <div className="text-[12px] text-text-muted tracking-widest mt-1">
                {state.seats} PARLIAMENT SEATS · {state.region.toUpperCase()}
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Win probability */}
              <div className="text-center">
                <div
                  className="text-4xl font-bold"
                  style={{ color: winColor, fontFamily: "Space Mono, monospace", textShadow: `0 0 12px ${winColor}66` }}
                >
                  {state.winProbability}%
                </div>
                <div className="text-[11px] text-text-muted tracking-widest mt-0.5">WIN PROBABILITY</div>
                <div className="text-[12px] font-bold mt-0.5" style={{ color: winColor }}>
                  {winDesc}
                </div>
              </div>

              {/* Seats */}
              <div className="text-center">
                <div
                  className="text-3xl font-bold"
                  style={{ color: "var(--cyan)", fontFamily: "Space Mono, monospace" }}
                >
                  {state.projectedSeats}/{state.seats}
                </div>
                <div className="text-[11px] text-text-muted tracking-widest mt-0.5">SEATS PROJECTED</div>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "OVERVIEW" && (
            <div className="space-y-4">
              {/* 3-col top row */}
              <div className="grid grid-cols-3 gap-4">
                {/* Party Support */}
                <TacticalPanel title="PARTY SUPPORT">
                  <div className="space-y-3 mt-1">
                    {[
                      { label: leader.partyAbbr, value: state.mandatSupport, color: leader.partyColor },
                      { label: "LAWAN", value: state.lawanSupport, color: "var(--warn-orange)" },
                      { label: "OTHERS", value: state.othersSupport, color: "#4a5568" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-[12px] text-text-muted w-14 shrink-0">{label}</span>
                        <div className="flex-1 h-3 bg-bar-empty relative overflow-hidden">
                          <div
                            className="absolute left-0 top-0 h-3 transition-all duration-1000"
                            style={{ width: `${value}%`, background: color }}
                          />
                        </div>
                        <span className="text-[12px] font-bold shrink-0 w-8 text-right" style={{ color }}>
                          {value}%
                        </span>
                      </div>
                    ))}
                  </div>
                </TacticalPanel>

                {/* Key Issues */}
                <TacticalPanel title="KEY ISSUES">
                  <ul className="space-y-1.5 mt-1">
                    {state.keyIssues.map((issue) => (
                      <li key={issue} className="flex items-center gap-2">
                        <span className="text-cyan text-[12px]">▸</span>
                        <span className="text-[13px] text-white">{issue}</span>
                      </li>
                    ))}
                  </ul>
                </TacticalPanel>

                {/* Demographics mini */}
                <TacticalPanel title="DEMOGRAPHICS">
                  <div className="space-y-2 mt-1">
                    <div className="text-[11px] text-text-muted tracking-wider mb-1">URBAN / RURAL</div>
                    <div className="flex h-4 overflow-hidden">
                      <div
                        className="flex items-center justify-center text-[10px] text-white font-bold"
                        style={{ width: `${state.demographics.urban}%`, background: "var(--cyan)", minWidth: "2px" }}
                      >
                        {state.demographics.urban > 15 ? `${state.demographics.urban}%` : ""}
                      </div>
                      <div
                        className="flex items-center justify-center text-[10px] text-white font-bold"
                        style={{ width: `${state.demographics.rural}%`, background: "#4a5568" }}
                      >
                        {state.demographics.rural > 15 ? `${state.demographics.rural}%` : ""}
                      </div>
                    </div>
                    <div className="flex gap-3 text-[11px]">
                      <span><span style={{ color: "var(--cyan)" }}>■</span> Urban {state.demographics.urban}%</span>
                      <span><span className="text-text-muted">■</span> Rural {state.demographics.rural}%</span>
                    </div>

                    <div className="text-[11px] text-text-muted tracking-wider mt-2 mb-1">ETHNICITY</div>
                    <div className="space-y-1">
                      {[
                        { label: "MALAY", val: state.demographics.malay, color: "var(--cyan)" },
                        { label: "CHINESE", val: state.demographics.chinese, color: "var(--gold)" },
                        { label: "INDIAN", val: state.demographics.indian, color: "var(--neon-green)" },
                        { label: "OTHERS", val: state.demographics.others, color: "#4a5568" },
                      ].map(({ label, val, color }) => (
                        <StatBar key={label} label={label} value={val} color={color} animate size="sm" />
                      ))}
                    </div>
                  </div>
                </TacticalPanel>
              </div>

              {/* Vote Share Over Time */}
              <TacticalPanel title="VOTE SHARE TREND — 6 MONTHS">
                <TrendLine
                  data={trendData}
                  lines={[
                    { key: "mandat", color: leader.partyColor, label: leader.partyAbbr },
                    { key: "lawan", color: "var(--warn-orange)", label: "LAWAN" },
                  ]}
                  xKey="month"
                  height={180}
                  showGrid
                  showLegend
                />
              </TacticalPanel>
            </div>
          )}

          {activeTab === "DEMOGRAPHICS" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <TacticalPanel title="URBAN VS RURAL">
                  <div className="space-y-3 mt-2">
                    <StatBar label="URBAN" value={state.demographics.urban} color="var(--cyan)" animate />
                    <StatBar label="RURAL" value={state.demographics.rural} color="#4a5568" animate />
                  </div>
                </TacticalPanel>

                <TacticalPanel title="YOUTH VOTERS">
                  <div className="flex flex-col items-center justify-center py-4">
                    <div
                      className="text-5xl font-bold"
                      style={{ color: "var(--neon-green)", fontFamily: "Space Mono, monospace" }}
                    >
                      {state.demographics.youth}%
                    </div>
                    <div className="text-[12px] text-text-muted mt-2 tracking-wider">YOUTH VOTER SHARE (18-35)</div>
                    <div
                      className="text-[12px] mt-1"
                      style={{ color: state.demographics.youth >= 30 ? "var(--neon-green)" : "var(--gold)" }}
                    >
                      {state.demographics.youth >= 30 ? "HIGH YOUTH ENGAGEMENT" : "MODERATE YOUTH ENGAGEMENT"}
                    </div>
                  </div>
                </TacticalPanel>
              </div>

              <TacticalPanel title="ETHNIC BREAKDOWN">
                <div className="space-y-3 mt-2">
                  {[
                    { label: "MALAY", val: state.demographics.malay, color: "var(--cyan)" },
                    { label: "CHINESE", val: state.demographics.chinese, color: "var(--gold)" },
                    { label: "INDIAN", val: state.demographics.indian, color: "var(--neon-green)" },
                    { label: "OTHERS", val: state.demographics.others, color: "#8b5cf6" },
                  ].map(({ label, val, color }) => (
                    <StatBar key={label} label={label} value={val} color={color} animate />
                  ))}
                </div>
              </TacticalPanel>
            </div>
          )}

          {activeTab === "SUPPORT ANALYSIS" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: `${leader.partyAbbr} SUPPORT`, value: state.mandatSupport, color: leader.partyColor },
                  { label: "LAWAN SUPPORT", value: state.lawanSupport, color: "var(--warn-orange)" },
                  { label: "OTHERS", value: state.othersSupport, color: "var(--text-muted)" },
                ].map(({ label, value, color }) => (
                  <TacticalPanel key={label}>
                    <div className="flex flex-col items-center py-4">
                      <div
                        className="text-5xl font-bold"
                        style={{ color, fontFamily: "Space Mono, monospace", textShadow: `0 0 12px ${color}44` }}
                      >
                        {value}%
                      </div>
                      <div className="text-[12px] text-text-muted mt-2 tracking-wider text-center">{label}</div>
                    </div>
                  </TacticalPanel>
                ))}
              </div>

              <TacticalPanel title="SWING PROBABILITY">
                <div className="flex items-center gap-4 mt-2">
                  <div
                    className="text-3xl font-bold"
                    style={{
                      color: state.swingProbability >= 25 ? "var(--warn-orange)" : "var(--neon-green)",
                      fontFamily: "Space Mono, monospace",
                    }}
                  >
                    {state.swingProbability}%
                  </div>
                  <div>
                    <div className="text-[13px] text-white">
                      {state.swingProbability >= 25 ? "HIGH SWING RISK" : state.swingProbability >= 15 ? "MODERATE SWING RISK" : "LOW SWING RISK"}
                    </div>
                    <div className="text-[12px] text-text-muted mt-0.5">Probability of seat changing hands</div>
                  </div>
                </div>
              </TacticalPanel>

              <TacticalPanel title="KEY SWING FACTORS">
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { factor: "Cost of Living", impact: "HIGH", color: "var(--neon-red)" },
                    { factor: "Employment", impact: "HIGH", color: "var(--neon-red)" },
                    { factor: "Infrastructure", impact: "MODERATE", color: "var(--gold)" },
                    { factor: "Education", impact: "MODERATE", color: "var(--gold)" },
                    { factor: "Healthcare", impact: "LOW", color: "var(--neon-green)" },
                    { factor: "Security", impact: "LOW", color: "var(--neon-green)" },
                  ].map(({ factor, impact, color }) => (
                    <div
                      key={factor}
                      className="flex items-center justify-between px-3 py-2"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <span className="text-[12px] text-white">{factor}</span>
                      <span className="text-[11px] font-bold tracking-wider" style={{ color }}>{impact}</span>
                    </div>
                  ))}
                </div>
              </TacticalPanel>
            </div>
          )}

          {activeTab === "GROUND REPORT" && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "POPULATION", value: (state.population / 1_000_000).toFixed(1) + "M", color: "var(--text-primary)" },
                  { label: "REG. VOTERS", value: (state.registeredVoters / 1_000).toFixed(0) + "K", color: "var(--cyan)" },
                  { label: "TURNOUT TARGET", value: `${state.turnoutTarget}%`, color: "var(--gold)" },
                  { label: "GROUND STRENGTH", value: state.groundStrength.toString(), color: "var(--neon-green)" },
                ].map(({ label, value, color }) => (
                  <TacticalPanel key={label}>
                    <div className="flex flex-col items-center py-3">
                      <div
                        className="text-2xl font-bold"
                        style={{ color, fontFamily: "Space Mono, monospace" }}
                      >
                        {value}
                      </div>
                      <div className="text-[11px] text-text-muted mt-1.5 tracking-wider text-center">{label}</div>
                    </div>
                  </TacticalPanel>
                ))}
              </div>

              <TacticalPanel title="ACTIVE OPERATIONS">
                <div className="space-y-2 mt-2">
                  {stateOperations.length === 0 && (
                    <div className="text-center py-4 text-[12px] tracking-widest" style={{ color: "#4a5568" }}>
                      NO OPERATIONS IN {state.name.toUpperCase()} — DEPLOY FROM CAMPAIGN HQ
                    </div>
                  )}
                  {stateOperations.map((op) => {
                    const statusColor = op.status === "active" ? "var(--neon-green)" : op.status === "ongoing" ? "var(--cyan)" : "var(--gold)";
                    return (
                      <div
                        key={op.id}
                        className="flex items-center justify-between px-3 py-2.5"
                        style={{ background: "rgb(var(--cyan-rgb) / 0.04)", border: "1px solid rgb(var(--cyan-rgb) / 0.1)" }}
                      >
                        <div>
                          <div className="text-[13px] text-white font-bold">{op.name}</div>
                          <div className="text-[12px] text-text-muted mt-0.5">{op.location}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-[12px] text-cyan font-bold">+{op.supportGain}%</div>
                            <div className="text-[11px] text-text-muted">GAIN/DAY</div>
                          </div>
                          <span
                            className="text-[11px] px-2 py-0.5 font-bold tracking-wider uppercase"
                            style={{
                              background: `${statusColor}18`,
                              color: statusColor,
                              border: `1px solid ${statusColor}44`,
                            }}
                          >
                            {op.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TacticalPanel>
            </div>
          )}

          {activeTab === "PARLIAMENT SEATS" && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  {
                    label: `${leader.partyAbbr} WINS`,
                    value: constituencies.filter((c) => c.winner === "mandat").length,
                    color: leader.partyColor,
                  },
                  {
                    label: "LAWAN WINS",
                    value: constituencies.filter((c) => c.winner === "lawan").length,
                    color: "var(--warn-orange)",
                  },
                  {
                    label: "MARGINAL",
                    value: constituencies.filter((c) => c.safety === "marginal").length,
                    color: "var(--gold)",
                  },
                  {
                    label: "DANGER SEATS",
                    value: constituencies.filter((c) => c.safety === "danger" && c.winner === "mandat").length,
                    color: "var(--neon-red)",
                  },
                ].map(({ label, value, color }) => (
                  <TacticalPanel key={label}>
                    <div className="flex flex-col items-center py-2">
                      <div
                        className="text-3xl font-bold"
                        style={{ color, fontFamily: "Space Mono, monospace", textShadow: `0 0 10px ${color}44` }}
                      >
                        {value}
                      </div>
                      <div className="text-[11px] text-text-muted mt-1.5 tracking-wider text-center">{label}</div>
                    </div>
                  </TacticalPanel>
                ))}
              </div>

              {/* Filter */}
              <div className="flex gap-2">
                {(["all", "mandat", "lawan", "marginal"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setConstFilter(f)}
                    className="px-3 py-1 text-[11px] tracking-widest uppercase transition-all"
                    style={{
                      background: constFilter === f ? "rgb(var(--cyan-rgb) / 0.15)" : "transparent",
                      border: `1px solid ${constFilter === f ? "rgb(var(--cyan-rgb) / 0.5)" : "rgba(255,255,255,0.1)"}`,
                      color: constFilter === f ? "var(--cyan)" : "var(--text-muted)",
                      fontFamily: "Space Mono, monospace",
                    }}
                  >
                    {f === "all" ? `ALL (${constituencies.length})` : f === "mandat" ? `${leader.partyAbbr} (${constituencies.filter(c => c.winner === "mandat").length})` : f === "lawan" ? `LAWAN (${constituencies.filter(c => c.winner === "lawan").length})` : `AT RISK (${constituencies.filter(c => c.safety !== "safe").length})`}
                  </button>
                ))}
              </div>

              {/* Constituency Grid */}
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
              >
                {filteredConst.map((c) => (
                  <ConstituencyCard key={c.id} c={c} />
                ))}
              </div>
            </div>
          )}

          {activeTab === "MEDIA LANDSCAPE" && (
            <MediaLandscapeTab state={state} />
          )}

          {/* Bottom navigation: prev / next state */}
          <div className="flex items-center justify-between mt-6 px-2">
            {prevState ? (
              <button
                onClick={() => router.push(`/state/${prevState.id}`)}
                className="flex items-center gap-2 px-4 py-2 text-[12px] tracking-widest uppercase transition-all"
                style={{
                  border: "1px solid rgb(var(--cyan-rgb) / 0.3)",
                  color: "var(--cyan)",
                  background: "transparent",
                  fontFamily: "Space Mono, monospace",
                }}
              >
                ← {prevState.name}
              </button>
            ) : (
              <div />
            )}

            <div className="text-[12px] text-text-muted tracking-wider">
              {stateIndex + 1} / {gameStates.length} STATES
            </div>

            {nextState ? (
              <button
                onClick={() => router.push(`/state/${nextState.id}`)}
                className="flex items-center gap-2 px-4 py-2 text-[12px] tracking-widest uppercase transition-all"
                style={{
                  border: "1px solid rgb(var(--cyan-rgb) / 0.3)",
                  color: "var(--cyan)",
                  background: "transparent",
                  fontFamily: "Space Mono, monospace",
                }}
              >
                {nextState.name} →
              </button>
            ) : (
              <div />
            )}
          </div>
        </main>
      </div>

      <StatusBar />
    </div>
  );
}
