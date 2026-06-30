"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useHistoryStore, type Outcome } from "../store/historyStore";
import { generateConstituencies, type Constituency } from "../data/constituencies";
import { formatNumber, formatPercent } from "../utils/format";

const TOTAL_SEATS = 222;
const MAJORITY = 112;

type Verdict = "WIN" | "KINGMAKER" | "LOSS";

type SeatDetail = {
  constituency: Constituency;
  result: "WIN" | "LOSS" | "OTHERS";
  winnerLabel: string;
  runnerUpLabel: string;
  majorityVotes: number;
  majorityPct: number;
  turnoutPct: number;
  votesCast: number;
  registeredVoters: number;
  mandatVotes: number;
  lawanVotes: number;
  othersVotes: number;
};

function getVerdict(mandatSeats: number): Verdict {
  if (mandatSeats >= MAJORITY) return "WIN";
  if (mandatSeats >= 89) return "KINGMAKER";
  return "LOSS";
}

const VERDICT_CONFIG = {
  WIN: {
    label: "GOVERNMENT FORMED",
    color: "var(--neon-green)",
    borderColor: "rgb(0 255 136 / 0.27)",
    bgColor: "rgb(var(--neon-green-rgb,21 128 61) / 0.06)",
    badge: "MAJORITY GOVERNMENT",
  },
  KINGMAKER: {
    label: "HUNG PARLIAMENT",
    color: "var(--gold)",
    borderColor: "rgb(var(--gold-rgb) / 0.27)",
    bgColor: "rgb(var(--gold-rgb) / 0.06)",
    badge: "KINGMAKER POSITION",
  },
  LOSS: {
    label: "OPPOSITION",
    color: "var(--neon-red)",
    borderColor: "rgb(255 68 68 / 0.27)",
    bgColor: "rgb(255 68 68 / 0.06)",
    badge: "IN OPPOSITION",
  },
};

function SeatBar({ mandat, lawan, others, partyName, partyColor }: { mandat: number; lawan: number; others: number; partyName: string; partyColor: string }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  const mPct = (mandat / TOTAL_SEATS) * 100;
  const lPct = (lawan / TOTAL_SEATS) * 100;
  const oPct = (others / TOTAL_SEATS) * 100;

  return (
    <div>
      <div className="flex h-8 w-full overflow-hidden" style={{ border: "1px solid rgb(var(--cyan-rgb) / 0.2)" }}>
        <div
          className="flex items-center justify-center text-[12px] font-bold text-white transition-all duration-1000 ease-out overflow-hidden"
          style={{ width: animated ? `${mPct}%` : "0%", background: partyColor, transitionDelay: "100ms" }}
        >
          {mandat > 12 ? mandat : ""}
        </div>
        <div
          className="flex items-center justify-center text-[12px] font-bold text-white transition-all duration-1000 ease-out overflow-hidden"
          style={{ width: animated ? `${oPct}%` : "0%", background: "#4a5568", transitionDelay: "200ms" }}
        >
          {others > 12 ? others : ""}
        </div>
        <div
          className="flex items-center justify-center text-[12px] font-bold text-white transition-all duration-1000 ease-out overflow-hidden"
          style={{ width: animated ? `${lPct}%` : "0%", background: "var(--warn-orange)", transitionDelay: "150ms" }}
        >
          {lawan > 12 ? lawan : ""}
        </div>
      </div>
      {/* Majority line */}
      <div className="relative h-3">
        <div
          className="absolute top-0 w-px h-3"
          style={{ left: `${(MAJORITY / TOTAL_SEATS) * 100}%`, background: "#ffffff66" }}
        />
        <div
          className="absolute top-1 text-[10px] text-text-muted tracking-wider"
          style={{ left: `${(MAJORITY / TOTAL_SEATS) * 100}%`, transform: "translateX(-50%)" }}
        >
          112
        </div>
      </div>
      <div className="flex gap-4 mt-1 text-[11px]">
        <span><span style={{ color: partyColor }}>■</span> {partyName} {mandat}</span>
        <span><span style={{ color: "#4a5568" }}>■</span> OTHERS {others}</span>
        <span><span style={{ color: "var(--warn-orange)" }}>■</span> LAWAN {lawan}</span>
      </div>
    </div>
  );
}

function resultColor(result: SeatDetail["result"]) {
  return result === "WIN" ? "var(--cyan)" : result === "LOSS" ? "var(--warn-orange)" : "var(--text-muted)";
}

function computeSeatDetails(state: ReturnType<typeof useGameStore.getState>["states"][number], partyLabel: string): SeatDetail[] {
  const constituencies = generateConstituencies(state);
  const avgRegistered = Math.max(1, Math.round(state.registeredVoters / Math.max(1, state.seats)));

  return constituencies.map((constituency, index) => {
    const seed = constituency.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) + index * 13;
    const turnoutPct = Math.max(55, Math.min(88, state.turnoutTarget + ((seed % 17) - 8) * 0.55));
    const registeredVoters = Math.round(avgRegistered * (0.88 + (seed % 25) / 100));
    const votesCast = Math.round(registeredVoters * (turnoutPct / 100));
    const mandatVotes = Math.round(votesCast * (constituency.mandat / 100));
    const lawanVotes = Math.round(votesCast * (constituency.lawan / 100));
    const othersVotes = Math.max(0, votesCast - mandatVotes - lawanVotes);
    const entries = [
      { label: partyLabel, votes: mandatVotes, pct: constituency.mandat, result: "WIN" as const },
      { label: "LAWAN", votes: lawanVotes, pct: constituency.lawan, result: "LOSS" as const },
      { label: "OTHERS", votes: othersVotes, pct: constituency.others, result: "OTHERS" as const },
    ].sort((a, b) => b.votes - a.votes);
    const winner = entries[0];
    const runnerUp = entries[1];

    return {
      constituency,
      result: winner.result,
      winnerLabel: winner.label,
      runnerUpLabel: runnerUp.label,
      majorityVotes: Math.max(0, winner.votes - runnerUp.votes),
      majorityPct: Math.max(0, winner.pct - runnerUp.pct),
      turnoutPct,
      votesCast,
      registeredVoters,
      mandatVotes,
      lawanVotes,
      othersVotes,
    };
  });
}

export default function ResultsPage() {
  const router = useRouter();
  const { states, resources, day, totalDays, leader, operations, difficulty, resetGame } = useGameStore();
  const addRecord = useHistoryStore((state) => state.addRecord);
  const recordedResultRef = useRef(false);
  const [reveal, setReveal] = useState(false);
  const [selectedStateId, setSelectedStateId] = useState(states[0]?.id ?? "johor");

  useEffect(() => {
    const t = setTimeout(() => setReveal(true), 150);
    return () => clearTimeout(t);
  }, []);

  const partyDisplay = leader.partyAbbr || leader.party || "PLAYER";
  const allSeatDetailsByState = useMemo(() => {
    return states.reduce<Record<string, SeatDetail[]>>((acc, state) => {
      acc[state.id] = computeSeatDetails(state, partyDisplay);
      return acc;
    }, {});
  }, [states, partyDisplay]);
  const stateSeatSummaries = useMemo(() => {
    return states.reduce<Record<string, { wins: number; losses: number; others: number; totalVotes: number; avgTurnout: number }>>((acc, state) => {
      const details = allSeatDetailsByState[state.id] ?? [];
      const wins = details.filter((seat) => seat.result === "WIN").length;
      const losses = details.filter((seat) => seat.result === "LOSS").length;
      const others = details.length - wins - losses;
      const totalVotes = details.reduce((sum, seat) => sum + seat.votesCast, 0);
      const avgTurnout = details.length ? details.reduce((sum, seat) => sum + seat.turnoutPct, 0) / details.length : 0;
      acc[state.id] = { wins, losses, others, totalVotes, avgTurnout };
      return acc;
    }, {});
  }, [allSeatDetailsByState, states]);

  // Compute final tallies from the seat-by-seat result table so totals match detailed kawasan results.
  const mandatSeats = states.reduce((sum, state) => sum + (stateSeatSummaries[state.id]?.wins ?? 0), 0);
  const lawanSeats = states.reduce((sum, state) => sum + (stateSeatSummaries[state.id]?.losses ?? 0), 0);
  const othersSeats = TOTAL_SEATS - mandatSeats - lawanSeats;

  const verdict = getVerdict(mandatSeats);
  const cfg = VERDICT_CONFIG[verdict];
  const selectedState = states.find((state) => state.id === selectedStateId) ?? states[0];
  const selectedSeatDetails = selectedState ? allSeatDetailsByState[selectedState.id] ?? [] : [];
  const selectedSeatSummary = selectedState ? stateSeatSummaries[selectedState.id] ?? { wins: 0, losses: 0, others: 0, avgTurnout: 0, totalVotes: 0 } : { wins: 0, losses: 0, others: 0, avgTurnout: 0, totalVotes: 0 };
  const verdictSub = verdict === "WIN"
    ? `${partyDisplay} has secured a parliamentary majority.`
    : verdict === "KINGMAKER"
      ? `No single party holds majority. ${partyDisplay} enters coalition negotiations.`
      : `${partyDisplay} finished in opposition. LAWAN will form the next government.`;

  const nationalSupport = Math.round(
    states.reduce((sum, s) => sum + s.mandatSupport * (s.seats / TOTAL_SEATS), 0)
  );

  const statesWon = states.filter((s) => (stateSeatSummaries[s.id]?.wins ?? 0) > Math.max((stateSeatSummaries[s.id]?.losses ?? 0), (stateSeatSummaries[s.id]?.others ?? 0))).length;
  const statesLost = states.filter((s) => (stateSeatSummaries[s.id]?.losses ?? 0) > Math.max((stateSeatSummaries[s.id]?.wins ?? 0), (stateSeatSummaries[s.id]?.others ?? 0))).length;
  const statesContested = states.length - statesWon - statesLost;

  useEffect(() => {
    if (recordedResultRef.current) return;
    recordedResultRef.current = true;

    const sortedBySupport = [...states].sort((a, b) => b.mandatSupport - a.mandatSupport);
    const outcome: Outcome = verdict === "WIN" ? "WIN" : "LOSE";

    addRecord({
      date: new Date().toISOString().slice(0, 10),
      electionName: "GE16",
      leaderName: leader.name,
      party: leader.party,
      difficulty,
      outcome,
      seatsWon: mandatSeats,
      totalSeats: TOTAL_SEATS,
      majorityTarget: MAJORITY,
      nationalSupport,
      daysPlayed: day,
      totalDays,
      statesWon,
      totalStates: states.length,
      topState: sortedBySupport[0]?.name ?? "-",
      worstState: sortedBySupport.at(-1)?.name ?? "-",
      notes: verdict === "WIN"
        ? `${leader.partyAbbr} formed government with ${mandatSeats} seats.`
        : `${leader.partyAbbr} finished short of majority with ${mandatSeats} seats.`,
    });
  }, [addRecord, day, difficulty, leader.name, leader.party, leader.partyAbbr, mandatSeats, nationalSupport, states, statesWon, totalDays, verdict]);

  const totalOpsCost = operations
    .filter((op) => op.status !== "planned")
    .reduce((sum, op) => sum + op.fundsCost, 0);
  const fundsSpent = 2_300_000 - resources.funds + totalOpsCost;

  const borneoWon =
    states.find((s) => s.id === "sabah")?.status === "winning" &&
    states.find((s) => s.id === "sarawak")?.status === "winning";
  const klWon = states.find((s) => s.id === "wp")?.status !== "losing";
  const selangorWon = states.find((s) => s.id === "selangor")?.status === "winning";

  const achievements: { label: string; achieved: boolean }[] = [
    { label: "MAJORITY GOVERNMENT", achieved: mandatSeats >= MAJORITY },
    { label: "BORNEO SECURED", achieved: !!borneoWon },
    { label: "KLANG VALLEY HELD", achieved: !!klWon && !!selangorWon },
    { label: "ABOVE 50% SUPPORT", achieved: nationalSupport >= 50 },
    { label: "FISCAL DISCIPLINE", achieved: resources.funds > 500_000 },
    { label: "FULL 14-DAY CAMPAIGN", achieved: day >= totalDays },
  ];

  function handleRestart() {
    resetGame();
    router.push("/menu");
  }

  function handleNewCampaign() {
    resetGame();
    router.push("/setup");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      <main
        className="pt-[56px] pb-[52px] px-8 w-full"
        style={{
          opacity: reveal ? 1 : 0,
          transform: reveal ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        {/* Page title */}
        <div className="flex items-center justify-between mb-5 mt-2">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ MALAM KEPUTUSAN — KIRAAN SEAT DEMI SEAT</div>
            <h1
              className="text-2xl font-bold tracking-widest"
              style={{ fontFamily: "Space Mono, monospace", color: "var(--text-primary)" }}
            >
              KEPUTUSAN RASMI
            </h1>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-text-muted tracking-wider">CAMPAIGN LEADER</div>
            <div className="text-sm font-bold text-white tracking-widest mt-0.5">{leader.name}</div>
            <div className="text-[12px] text-gold tracking-wider">{leader.position} · {leader.partyAbbr}</div>
          </div>
        </div>

        {/* Verdict banner */}
        <div
          className="px-6 py-5 mb-5"
          style={{
            background: cfg.bgColor,
            border: `1px solid ${cfg.borderColor}`,
            borderLeft: `4px solid ${cfg.color}`,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-2xl font-bold tracking-widest"
                style={{ color: cfg.color, fontFamily: "Space Mono, monospace", textShadow: `0 0 20px ${cfg.color}55` }}
              >
                {cfg.label}
              </div>
              <div className="text-[13px] text-text-muted mt-1.5 tracking-wide">{verdictSub}</div>
            </div>
            <div
              className="text-[12px] font-bold tracking-widest px-4 py-2"
              style={{ border: `1px solid ${cfg.color}66`, color: cfg.color, background: `${cfg.color}11` }}
            >
              {cfg.badge}
            </div>
          </div>
        </div>

        {/* Seat counts + bar */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { party: partyDisplay, seats: mandatSeats, color: leader.partyColor, target: `/ ${MAJORITY} TARGET` },
            { party: "LAWAN", seats: lawanSeats, color: "var(--warn-orange)", target: "seats" },
            { party: "OTHERS", seats: othersSeats, color: "var(--text-muted)", target: "seats" },
          ].map(({ party, seats, color, target }) => (
            <TacticalPanel key={party}>
              <div className="flex flex-col items-center py-3">
                <div
                  className="font-bold leading-none"
                  style={{ fontSize: "62px", color, fontFamily: "Space Mono, monospace", textShadow: `0 0 16px ${color}44` }}
                >
                  {seats}
                </div>
                <div className="text-[11px] text-text-muted tracking-widest mt-2">{party} {target}</div>
              </div>
            </TacticalPanel>
          ))}
        </div>

        <TacticalPanel title="PARLIAMENT SEAT DISTRIBUTION — 222 SEATS" className="mb-4">
          <div className="mt-2">
            <SeatBar mandat={mandatSeats} lawan={lawanSeats} others={othersSeats} partyName={partyDisplay} partyColor={leader.partyColor} />
          </div>
        </TacticalPanel>

        {/* State results + Campaign stats side by side */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* State Results */}
          <TacticalPanel title="STATE RESULTS · CLICK STATE FOR SEAT DETAILS" noPadding>
            <div className="overflow-y-auto" style={{ maxHeight: "210px" }}>
              <table className="w-full text-[12px]" style={{ fontFamily: "Space Mono, monospace" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
                    {["STATE", "SEATS", "SUPPORT", "RESULT"].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-text-muted font-normal text-[11px] tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {states.map((s) => {
                    const summary = stateSeatSummaries[s.id] ?? { wins: 0, losses: 0, others: 0, totalVotes: 0, avgTurnout: 0 };
                    const stateWinner = summary.wins > Math.max(summary.losses, summary.others)
                      ? "WIN"
                      : summary.losses > Math.max(summary.wins, summary.others)
                        ? "LOSS"
                        : "FIGHT";
                    const resColor = stateWinner === "WIN" ? "var(--cyan)" : stateWinner === "LOSS" ? "var(--neon-red)" : "var(--gold)";
                    const resLabel = stateWinner;
                    const isSelected = selectedState?.id === s.id;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedStateId(s.id)}
                        className="cursor-pointer transition-colors"
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          background: isSelected ? "rgb(var(--cyan-rgb) / 0.10)" : "transparent",
                          outline: isSelected ? "1px solid rgb(var(--cyan-rgb) / 0.25)" : "none",
                        }}
                      >
                        <td className="py-2 px-3 text-white font-bold">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedStateId(s.id);
                            }}
                            className="text-left font-bold tracking-wider hover:underline"
                            style={{ color: isSelected ? "var(--cyan)" : "#ffffff" }}
                          >
                            {s.shortName}
                          </button>
                        </td>
                        <td className="py-2 px-3 text-text-muted">{summary.wins}/{s.seats}</td>
                        <td className="py-2 px-3" style={{ color: s.mandatSupport >= 50 ? "var(--cyan)" : "var(--gold)" }}>
                          {formatPercent(s.mandatSupport)}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className="px-1.5 py-0.5 text-[11px] font-bold tracking-wider"
                            style={{
                              color: resColor,
                              background: `${resColor}18`,
                              border: `1px solid ${resColor}44`,
                            }}
                          >
                            {resLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-3 py-3" style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-[11px] text-text-muted tracking-widest">DETAIL KAWASAN PARLIMEN</div>
                  <div className="text-lg font-black text-white tracking-widest">{selectedState?.name ?? "-"}</div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "WIN", value: selectedSeatSummary.wins, color: "var(--cyan)" },
                    { label: "LOSS", value: selectedSeatSummary.losses, color: "var(--warn-orange)" },
                    { label: "OTH", value: selectedSeatSummary.others, color: "var(--text-muted)" },
                    { label: "TURNOUT", value: formatPercent(selectedSeatSummary.avgTurnout), color: "var(--neon-green)" },
                  ].map((item) => (
                    <div key={item.label} className="px-2 py-1" style={{ border: `1px solid ${item.color}33`, background: `${item.color}0f` }}>
                      <div className="text-[10px] text-text-muted tracking-wider">{item.label}</div>
                      <div className="text-[12px] font-bold" style={{ color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "280px" }}>
                <table className="w-full text-[11px]" style={{ fontFamily: "Space Mono, monospace" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
                      {["KAWASAN", "RESULT", "MAJORITI", "TURNOUT", partyDisplay, "LAWAN", "OTH"].map((h) => (
                        <th key={h} className="text-left py-2 pr-2 text-text-muted font-normal text-[10px] tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSeatDetails.map((seat) => {
                      const color = resultColor(seat.result);
                      return (
                        <tr key={seat.constituency.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td className="py-2 pr-2 text-white font-bold">
                            <div>{seat.constituency.name}</div>
                            <div className="text-[9px] text-text-muted">{seat.constituency.code} · {formatNumber(seat.registeredVoters)} PENGUNDI</div>
                          </td>
                          <td className="py-2 pr-2">
                            <span className="px-1.5 py-0.5 font-bold" style={{ color, border: `1px solid ${color}44`, background: `${color}16` }}>{seat.result}</span>
                            <div className="text-[9px] text-text-muted mt-1">{seat.winnerLabel} vs {seat.runnerUpLabel}</div>
                          </td>
                          <td className="py-2 pr-2 text-white">
                            <div>{formatNumber(seat.majorityVotes)}</div>
                            <div className="text-[9px]" style={{ color }}>{formatPercent(seat.majorityPct)} pts</div>
                          </td>
                          <td className="py-2 pr-2" style={{ color: seat.turnoutPct >= 75 ? "var(--neon-green)" : "var(--gold)" }}>
                            <div>{formatPercent(seat.turnoutPct)}</div>
                            <div className="text-[9px] text-text-muted">{formatNumber(seat.votesCast)} undi</div>
                          </td>
                          <td className="py-2 pr-2" style={{ color: leader.partyColor }}>{formatPercent(seat.constituency.mandat)}</td>
                          <td className="py-2 pr-2" style={{ color: "var(--warn-orange)" }}>{formatPercent(seat.constituency.lawan)}</td>
                          <td className="py-2 pr-2 text-text-muted">{formatPercent(seat.constituency.others)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-[10px] text-text-muted tracking-wider">
                JUMLAH UNDI SAH TERPILIH: {formatNumber(selectedSeatSummary.totalVotes)} · klik negeri lain untuk tukar detail kawasan.
              </div>
            </div>
          </TacticalPanel>

          {/* Campaign Stats + Achievements */}
          <div className="flex flex-col gap-4">
            <TacticalPanel title="CAMPAIGN STATISTICS">
              <div className="space-y-3 mt-1">
                {[
                  { label: "NATIONAL SUPPORT", value: `${nationalSupport}%`, color: nationalSupport >= 50 ? "var(--neon-green)" : "var(--gold)" },
                  { label: "DAYS CAMPAIGNED", value: `${day} / ${totalDays}`, color: "var(--text-primary)" },
                  { label: "STATES WON", value: `${statesWon} / 14`, color: "var(--cyan)" },
                  { label: "STATES CONTESTED", value: `${statesContested}`, color: "var(--gold)" },
                  { label: "STATES LOST", value: `${statesLost}`, color: "var(--neon-red)" },
                  { label: "FUNDS SPENT", value: `RM ${(fundsSpent / 1_000_000).toFixed(2)}M`, color: "var(--text-muted)" },
                  { label: "FUNDS REMAINING", value: `RM ${(resources.funds / 1_000_000).toFixed(2)}M`, color: "var(--gold)" },
                  { label: "GROUND STRENGTH", value: `${resources.manpower} WORKERS`, color: "var(--text-primary)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "6px" }}>
                    <span className="text-[12px] text-text-muted tracking-wider">{label}</span>
                    <span className="text-[12px] font-bold" style={{ color, fontFamily: "Space Mono, monospace" }}>{value}</span>
                  </div>
                ))}
              </div>
            </TacticalPanel>

            <TacticalPanel title="ACHIEVEMENTS">
              <div className="space-y-2 mt-1">
                {achievements.map(({ label, achieved }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div
                      className="w-4 h-4 shrink-0 flex items-center justify-center text-[12px] font-bold"
                      style={{
                        background: achieved ? "rgb(var(--neon-green-rgb,21 128 61) / 0.15)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${achieved ? "rgb(0 255 136 / 0.4)" : "rgba(255,255,255,0.1)"}`,
                        color: achieved ? "var(--neon-green)" : "#4a5568",
                      }}
                    >
                      {achieved ? "✓" : "✗"}
                    </div>
                    <span
                      className="text-[12px] tracking-wider"
                      style={{ color: achieved ? "#ffffff" : "#4a5568" }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </TacticalPanel>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleRestart}
            className="px-6 py-3 text-[12px] font-bold tracking-widest uppercase transition-all hover:opacity-80"
            style={{
              background: "transparent",
              border: "1px solid rgb(var(--cyan-rgb) / 0.3)",
              color: "var(--text-muted)",
              fontFamily: "Space Mono, monospace",
            }}
          >
            RETURN TO MENU
          </button>
          {verdict === "WIN" && (
            <button
              onClick={() => router.push("/cabinet")}
              className="px-8 py-3 text-[12px] font-bold tracking-widest uppercase transition-all hover:opacity-80"
              style={{
                background: "rgb(var(--gold-rgb) / 0.13)",
                border: "1px solid rgb(var(--gold-rgb) / 0.55)",
                color: "var(--gold)",
                fontFamily: "Space Mono, monospace",
                boxShadow: "0 0 18px rgb(var(--gold-rgb) / 0.16)",
              }}
            >
              ♛ FORM CABINET
            </button>
          )}
          <button
            onClick={handleNewCampaign}
            className="px-8 py-3 text-[12px] font-bold tracking-widest uppercase transition-all hover:opacity-80"
            style={{
              background: "rgb(var(--cyan-rgb) / 0.12)",
              border: "1px solid rgb(var(--cyan-rgb) / 0.5)",
              color: "var(--cyan)",
              fontFamily: "Space Mono, monospace",
              boxShadow: "0 0 16px rgb(var(--cyan-rgb) / 0.15)",
            }}
          >
            » NEW CAMPAIGN
          </button>
        </div>
      </main>

      <StatusBar leftText={`ELECTION COMPLETE · DAY ${day}/${totalDays}`} rightText={`${partyDisplay} ${mandatSeats} SEATS · ${verdict}`} />
    </div>
  );
}
