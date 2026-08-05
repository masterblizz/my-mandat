"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import ConfettiCanvas from "../components/ui/ConfettiCanvas";
import CountUpNumber from "../components/ui/CountUpNumber";
import ShareResultModal from "../components/ui/ShareResultModal";
import { useGameStore } from "../store/gameStore";
import { useHistoryStore, type Outcome } from "../store/historyStore";
import { formatNumber, formatPercent } from "../utils/format";
import { usePendingNav } from "../hooks/usePendingNav";
import { computeSeatDetails, type SeatDetail } from "../utils/seatDetails";
import { computeElectionOutcome } from "../utils/electionOutcome";
import { useLang, t, type Lang } from "../i18n/useLang";

const TOTAL_SEATS = 222;
const MAJORITY = 112;

type Verdict = "WIN" | "KINGMAKER" | "LOSS";

function getVerdict(mandatSeats: number, majorityTarget = MAJORITY): Verdict {
  if (mandatSeats >= majorityTarget) return "WIN";
  if (mandatSeats >= Math.ceil(majorityTarget * 0.8)) return "KINGMAKER";
  return "LOSS";
}

const VERDICT_CONFIG: Record<Verdict, { labelMS: string; labelEN: string; color: string; borderColor: string; bgColor: string; badgeMS: string; badgeEN: string }> = {
  WIN: {
    labelMS: "KERAJAAN DIBENTUK",
    labelEN: "GOVERNMENT FORMED",
    color: "var(--neon-green)",
    borderColor: "rgb(0 255 136 / 0.27)",
    bgColor: "rgb(var(--neon-green-rgb,21 128 61) / 0.06)",
    badgeMS: "KERAJAAN MAJORITI",
    badgeEN: "MAJORITY GOVERNMENT",
  },
  KINGMAKER: {
    labelMS: "PARLIMEN TERGANTUNG",
    labelEN: "HUNG PARLIAMENT",
    color: "var(--gold)",
    borderColor: "rgb(var(--gold-rgb) / 0.27)",
    bgColor: "rgb(var(--gold-rgb) / 0.06)",
    badgeMS: "KEDUDUKAN PENENTU",
    badgeEN: "KINGMAKER POSITION",
  },
  LOSS: {
    labelMS: "PEMBANGKANG",
    labelEN: "OPPOSITION",
    color: "var(--neon-red)",
    borderColor: "rgb(255 68 68 / 0.27)",
    bgColor: "rgb(255 68 68 / 0.06)",
    badgeMS: "DI PIHAK PEMBANGKANG",
    badgeEN: "IN OPPOSITION",
  },
};

// Reveal animation phases: "pending" until the mount effect fires, then
// "play" (full animation) or "skip" (prefers-reduced-motion — jump to final).
type AnimPhase = "pending" | "play" | "skip";

function SeatBar({ mandat, lawan, others, partyName, partyColor, animPhase, totalSeats = TOTAL_SEATS, majorityTarget = MAJORITY, lang }: { mandat: number; lawan: number; others: number; partyName: string; partyColor: string; animPhase: AnimPhase; totalSeats?: number; majorityTarget?: number; lang: Lang }) {
  const mPct = totalSeats > 0 ? (mandat / totalSeats) * 100 : 0;
  const lPct = totalSeats > 0 ? (lawan / totalSeats) * 100 : 0;
  const oPct = totalSeats > 0 ? (others / totalSeats) * 100 : 0;

  const show = animPhase !== "pending";
  const skip = animPhase === "skip";
  // MANDAT fills first; LAWAN starts 200ms later; OTHERS trails last.
  const segTransition = (delay: number) =>
    skip ? { duration: 0 } : { duration: 1, ease: "easeOut" as const, delay };

  return (
    <div>
      <div className="flex h-8 w-full overflow-hidden" style={{ border: "1px solid rgb(var(--cyan-rgb) / 0.2)" }}>
        <motion.div
          className="flex items-center justify-center text-[12px] font-bold text-white overflow-hidden"
          style={{ background: partyColor }}
          initial={{ width: "0%" }}
          animate={{ width: show ? `${mPct}%` : "0%" }}
          transition={segTransition(0)}
        >
          {mandat > 12 ? mandat : ""}
        </motion.div>
        <motion.div
          className="flex items-center justify-center text-[12px] font-bold text-white overflow-hidden"
          style={{ background: "#4a5568" }}
          initial={{ width: "0%" }}
          animate={{ width: show ? `${oPct}%` : "0%" }}
          transition={segTransition(0.4)}
        >
          {others > 12 ? others : ""}
        </motion.div>
        <motion.div
          className="flex items-center justify-center text-[12px] font-bold text-white overflow-hidden"
          style={{ background: "var(--warn-orange)" }}
          initial={{ width: "0%" }}
          animate={{ width: show ? `${lPct}%` : "0%" }}
          transition={segTransition(0.2)}
        >
          {lawan > 12 ? lawan : ""}
        </motion.div>
      </div>
      {/* Majority line — static reference, fades in once the bar has filled */}
      <motion.div
        className="relative h-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: show ? 1 : 0 }}
        transition={skip ? { duration: 0 } : { duration: 0.4, delay: 1.4 }}
      >
        <div
          className="absolute top-0 w-px h-3"
          style={{ left: `${(majorityTarget / totalSeats) * 100}%`, background: "#ffffff66" }}
        />
        <div
          className="absolute top-1 text-[10px] text-text-muted tracking-wider"
          style={{ left: `${(majorityTarget / totalSeats) * 100}%`, transform: "translateX(-50%)" }}
        >
          {majorityTarget}
        </div>
      </motion.div>
      <div className="flex gap-4 mt-1 text-[11px]">
        <span><span style={{ color: partyColor }}>■</span> {partyName} {mandat}</span>
        <span><span style={{ color: "#4a5568" }}>■</span> {t(lang, "LAIN-LAIN", "OTHERS")} {others}</span>
        <span><span style={{ color: "var(--warn-orange)" }}>■</span> LAWAN {lawan}</span>
      </div>
    </div>
  );
}

function resultColor(result: SeatDetail["result"]) {
  return result === "WIN" ? "var(--cyan)" : result === "LOSS" ? "var(--warn-orange)" : "var(--text-muted)";
}

function resultLabel(lang: Lang, result: SeatDetail["result"]) {
  return t(lang, result === "WIN" ? "MENANG" : result === "LOSS" ? "KALAH" : result, result);
}

export default function ResultsPage() {
  const lang = useLang();
  const { isPending, navigate } = usePendingNav();
  const { states, resources, day, totalDays, leader, operations, difficulty, settings, resetGame, dailyChallengeDate } = useGameStore();
  const addRecord = useHistoryStore((state) => state.addRecord);
  const recordedResultRef = useRef(false);
  const animPlayedRef = useRef(false);
  const [reveal, setReveal] = useState(false);
  const [animPhase, setAnimPhase] = useState<AnimPhase>("pending");
  const [selectedStateId, setSelectedStateId] = useState(settings.electionScope === "prn" ? settings.prnStateId : (states[0]?.id ?? "johor"));
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    // Run-once flag so the reveal never replays on re-renders (state clicks
    // etc.); reset in cleanup so a StrictMode dev remount still plays it.
    if (animPlayedRef.current) return;
    animPlayedRef.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAnimPhase("skip");
      setReveal(true);
      return () => {
        animPlayedRef.current = false;
      };
    }
    const timer = setTimeout(() => {
      setAnimPhase("play");
      setReveal(true);
    }, 150);
    return () => {
      clearTimeout(timer);
      animPlayedRef.current = false;
    };
  }, []);

  const showAnim = animPhase !== "pending";
  const skipAnim = animPhase === "skip";

  const partyDisplay = leader.partyAbbr || leader.party || "PLAYER";
  const isPrn = settings.electionScope === "prn";
  const electionOutcome = useMemo(
    () => computeElectionOutcome(states, { electionScope: settings.electionScope, prnStateId: settings.prnStateId }),
    [states, settings.electionScope, settings.prnStateId]
  );
  const resultStates = electionOutcome.contestedStates;
  const resultStateIds = useMemo(() => new Set(resultStates.map((state) => state.id)), [resultStates]);
  const seatScope = electionOutcome.seatScope;
  const seatTypeLabel = isPrn ? "DUN" : t(lang, "PARLIMEN", "PARLIAMENT");
  const chamberLabel = isPrn ? "DUN" : t(lang, "PARLIMEN", "PARLIAMENT");
  const governmentLabel = isPrn ? t(lang, "KERAJAAN NEGERI DIBENTUK", "STATE GOVERNMENT FORMED") : t(lang, "KERAJAAN DIBENTUK", "GOVERNMENT FORMED");
  const hungLabel = isPrn ? t(lang, "DEWAN NEGERI TERGANTUNG", "HUNG STATE ASSEMBLY") : t(lang, "PARLIMEN TERGANTUNG", "HUNG PARLIAMENT");
  const resultScopeLabel = dailyChallengeDate
    ? t(lang, `CABARAN HARIAN · ${dailyChallengeDate}`, `DAILY CHALLENGE · ${dailyChallengeDate}`)
    : isPrn ? `PRN ${resultStates[0]?.name ?? "NEGERI"}` : t(lang, "PRU16 NASIONAL", "GE16 NATIONAL");
  const stateResultsTitle = isPrn ? t(lang, "KEPUTUSAN NEGERI PRN · BUTIRAN DUN", "PRN STATE RESULT · DUN DETAILS") : t(lang, "KEPUTUSAN NEGERI · KLIK NEGERI UNTUK BUTIRAN KERUSI", "STATE RESULTS · CLICK STATE FOR SEAT DETAILS");
  const detailTitle = isPrn ? "DETAIL KAWASAN DUN" : "DETAIL KAWASAN PARLIMEN";
  const supportLabel = isPrn ? t(lang, "SOKONGAN NEGERI", "STATE SUPPORT") : t(lang, "SOKONGAN KEBANGSAAN", "NATIONAL SUPPORT");
  const statesWonLabel = isPrn ? t(lang, "NEGERI PRN DIMENANGI", "PRN STATE WON") : t(lang, "NEGERI DIMENANGI", "STATES WON");
  const statesLostLabel = isPrn ? t(lang, "NEGERI PRN HILANG", "PRN STATE LOST") : t(lang, "NEGERI HILANG", "STATES LOST");
  const majorityText = isPrn ? t(lang, "majoriti dewan negeri", "state assembly majority") : t(lang, "majoriti parlimen", "parliamentary majority");
  const totalSeats = electionOutcome.totalSeats;
  const majorityTarget = electionOutcome.majorityTarget;
  const allSeatDetailsByState = useMemo(() => {
    return resultStates.reduce<Record<string, SeatDetail[]>>((acc, state) => {
      acc[state.id] = computeSeatDetails(state, partyDisplay, seatScope);
      return acc;
    }, {});
  }, [resultStates, partyDisplay, seatScope]);
  const stateSeatSummaries = useMemo(() => {
    return resultStates.reduce<Record<string, { wins: number; losses: number; others: number; totalVotes: number; avgTurnout: number }>>((acc, state) => {
      const details = allSeatDetailsByState[state.id] ?? [];
      const wins = details.filter((seat) => seat.result === "WIN").length;
      const losses = details.filter((seat) => seat.result === "LOSS").length;
      const others = details.length - wins - losses;
      const totalVotes = details.reduce((sum, seat) => sum + seat.votesCast, 0);
      const avgTurnout = details.length ? details.reduce((sum, seat) => sum + seat.turnoutPct, 0) / details.length : 0;
      acc[state.id] = { wins, losses, others, totalVotes, avgTurnout };
      return acc;
    }, {});
  }, [allSeatDetailsByState, resultStates]);

  // Compute final tallies from the scoped seat-by-seat table so PRN uses the selected state's DUN only.
  const mandatSeats = electionOutcome.seatsWon;
  const lawanSeats = electionOutcome.lawanSeats;
  const othersSeats = electionOutcome.othersSeats;

  const verdict = getVerdict(mandatSeats, majorityTarget);
  const verdictConfig = VERDICT_CONFIG[verdict];
  const cfg = {
    ...verdictConfig,
    label: verdict === "WIN" ? governmentLabel : verdict === "KINGMAKER" ? hungLabel : t(lang, verdictConfig.labelMS, verdictConfig.labelEN),
    badge: verdict === "WIN" ? t(lang, isPrn ? "KERAJAAN NEGERI MAJORITI" : "KERAJAAN MAJORITI", isPrn ? "MAJORITY STATE GOVERNMENT" : "MAJORITY GOVERNMENT") : t(lang, verdictConfig.badgeMS, verdictConfig.badgeEN),
  };
  const selectedState = resultStates.find((state) => state.id === selectedStateId) ?? resultStates[0];
  const selectedSeatDetails = selectedState ? allSeatDetailsByState[selectedState.id] ?? [] : [];
  const selectedSeatSummary = selectedState ? stateSeatSummaries[selectedState.id] ?? { wins: 0, losses: 0, others: 0, avgTurnout: 0, totalVotes: 0 } : { wins: 0, losses: 0, others: 0, avgTurnout: 0, totalVotes: 0 };
  const verdictSub = verdict === "WIN"
    ? t(lang, `${partyDisplay} telah memperoleh ${majorityText}.`, `${partyDisplay} has secured a ${majorityText}.`)
    : verdict === "KINGMAKER"
      ? t(lang,
          `Tiada mana-mana parti memperoleh majoriti ${isPrn ? "Dewan Negeri" : "Parlimen"}. ${partyDisplay} memasuki rundingan gabungan.`,
          `No single party holds a ${isPrn ? "DUN" : "Parliament"} majority. ${partyDisplay} enters coalition negotiations.`)
      : t(lang,
          `${partyDisplay} tamat di pihak pembangkang. LAWAN akan membentuk kerajaan ${isPrn ? "negeri" : "persekutuan"} seterusnya.`,
          `${partyDisplay} finished in opposition. LAWAN will form the next ${isPrn ? "state" : "federal"} government.`);

  const nationalSupport = electionOutcome.nationalSupport;

  const statesWon = resultStates.filter((s) => (stateSeatSummaries[s.id]?.wins ?? 0) > Math.max((stateSeatSummaries[s.id]?.losses ?? 0), (stateSeatSummaries[s.id]?.others ?? 0))).length;
  const statesLost = resultStates.filter((s) => (stateSeatSummaries[s.id]?.losses ?? 0) > Math.max((stateSeatSummaries[s.id]?.wins ?? 0), (stateSeatSummaries[s.id]?.others ?? 0))).length;
  const statesContested = resultStates.length - statesWon - statesLost;

  const ownSeatDetail = (resultStateIds.has(leader.homeState) ? allSeatDetailsByState[leader.homeState] : allSeatDetailsByState[resultStates[0]?.id ?? ""])?.find(
    (seat) => seat.constituency.id === leader.homeConstituencyId
  );
  const wonOwnSeat = ownSeatDetail?.result === "WIN";

  useEffect(() => {
    if (recordedResultRef.current) return;
    recordedResultRef.current = true;

    const sortedBySupport = [...resultStates].sort((a, b) => b.mandatSupport - a.mandatSupport);
    const outcome: Outcome = verdict === "WIN" ? "WIN" : "LOSE";

    addRecord({
      date: new Date().toISOString().slice(0, 10),
      electionName: isPrn ? `PRN ${resultStates[0]?.name ?? "Negeri"}` : "GE16",
      leaderName: leader.name,
      party: leader.party,
      difficulty,
      outcome,
      seatsWon: mandatSeats,
      totalSeats,
      majorityTarget,
      nationalSupport,
      daysPlayed: day,
      totalDays,
      statesWon,
      totalStates: resultStates.length,
      topState: sortedBySupport[0]?.name ?? "-",
      worstState: sortedBySupport.at(-1)?.name ?? "-",
      notes: verdict === "WIN"
        ? t(lang, `${leader.partyAbbr} membentuk kerajaan ${isPrn ? "negeri" : "persekutuan"} dengan ${mandatSeats} kerusi.`, `${leader.partyAbbr} formed ${isPrn ? "state" : "federal"} government with ${mandatSeats} seats.`)
        : t(lang, `${leader.partyAbbr} tamat kurang daripada majoriti dengan ${mandatSeats} kerusi.`, `${leader.partyAbbr} finished short of majority with ${mandatSeats} seats.`),
    });
    // Snapshot the active language at record time; re-running on lang change
    // would just rewrite an already-saved history record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addRecord, day, difficulty, isPrn, leader.name, leader.party, leader.partyAbbr, majorityTarget, mandatSeats, nationalSupport, resultStates, statesWon, totalDays, totalSeats, verdict]);

  const totalOpsCost = operations
    .filter((op) => op.status !== "planned")
    .reduce((sum, op) => sum + op.fundsCost, 0);
  const fundsSpent = 2_300_000 - resources.funds + totalOpsCost;

  const borneoWon = !isPrn &&
    states.find((s) => s.id === "sabah")?.status === "winning" &&
    states.find((s) => s.id === "sarawak")?.status === "winning";
  const klWon = !isPrn && states.find((s) => s.id === "wp")?.status !== "losing";
  const selangorWon = !isPrn && states.find((s) => s.id === "selangor")?.status === "winning";

  const achievements: { labelMS: string; labelEN: string; achieved: boolean }[] = [
    { labelMS: isPrn ? "KERAJAAN NEGERI" : "KERAJAAN MAJORITI", labelEN: isPrn ? "STATE GOVERNMENT" : "MAJORITY GOVERNMENT", achieved: mandatSeats >= majorityTarget },
    { labelMS: "BORNEO DIKUASAI", labelEN: "BORNEO SECURED", achieved: !!borneoWon },
    { labelMS: "LEMBAH KLANG DIKEKALKAN", labelEN: "KLANG VALLEY HELD", achieved: !!klWon && !!selangorWon },
    { labelMS: "SOKONGAN MELEBIHI 50%", labelEN: "ABOVE 50% SUPPORT", achieved: nationalSupport >= 50 },
    { labelMS: "DISIPLIN FISKAL", labelEN: "FISCAL DISCIPLINE", achieved: resources.funds > 500_000 },
    { labelMS: isPrn ? "KEMPEN PRN SELESAI" : "KEMPEN PENUH SELESAI", labelEN: isPrn ? "PRN CAMPAIGN COMPLETE" : "FULL CAMPAIGN COMPLETE", achieved: day >= totalDays },
  ];

  function handleRestart() {
    navigate("/menu", () => resetGame());
  }

  function handleNewCampaign() {
    navigate("/setup", () => resetGame());
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      {/* WIN celebration — one-shot confetti burst in the winning party's
          colors plus neutral white/gray (canvas particles only, auto-stops).
          Not rendered at all when prefers-reduced-motion is set. */}
      {verdict === "WIN" && animPhase === "play" && (
        <ConfettiCanvas colors={[leader.partyColor, "#ffffff", "#9ca3af"]} duration={2500} />
      )}

      {/* LOSS mood — subtle dark vignette easing in at the screen edges.
          Transparent center keeps content legible in both themes. */}
      {verdict === "LOSS" && showAnim && (
        <motion.div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 40, background: "radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.32) 100%)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={skipAnim ? { duration: 0 } : { duration: 1.4, ease: "easeOut" }}
        />
      )}

      <main
        className="pt-[56px] pb-[52px] px-8 w-full"
        style={{
          opacity: reveal ? 1 : 0,
          transform: reveal ? "translateY(0)" : "translateY(12px)",
          transition: skipAnim ? "none" : "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        {/* Page title */}
        <div className="flex items-center justify-between mb-5 mt-2">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {isPrn ? t(lang, "MALAM KEPUTUSAN PRN — KIRAAN DUN DEMI DUN", "PRN RESULTS NIGHT — DUN-BY-DUN COUNT") : t(lang, "MALAM KEPUTUSAN — KIRAAN KERUSI DEMI KERUSI", "RESULTS NIGHT — SEAT-BY-SEAT COUNT")}</div>
            <h1
              className="text-2xl font-bold tracking-widest"
              style={{ fontFamily: "Space Mono, monospace", color: "var(--text-primary)" }}
            >
              {t(lang, "KEPUTUSAN RASMI", "OFFICIAL RESULTS")}
            </h1>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-text-muted tracking-wider">{t(lang, "PEMIMPIN KEMPEN", "CAMPAIGN LEADER")}</div>
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
              {/* WIN: spring in with a slight overshoot. Otherwise: plain muted fade. */}
              <motion.div
                className="text-2xl font-bold tracking-widest"
                style={{ color: cfg.color, fontFamily: "Space Mono, monospace", textShadow: `0 0 20px ${cfg.color}55` }}
                initial={verdict === "WIN" ? { opacity: 0, scale: 0.8 } : { opacity: 0 }}
                animate={showAnim ? (verdict === "WIN" ? { opacity: 1, scale: 1 } : { opacity: 1 }) : undefined}
                transition={
                  skipAnim
                    ? { duration: 0 }
                    : verdict === "WIN"
                      ? { type: "spring", stiffness: 320, damping: 14, delay: 0.15 }
                      : { duration: 0.8, ease: "easeOut" }
                }
              >
                {cfg.label}
              </motion.div>
              <div className="text-[13px] text-text-muted mt-1.5 tracking-wide">{verdictSub}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div
                className="text-[12px] font-bold tracking-widest px-4 py-2"
                style={{ border: `1px solid ${cfg.color}66`, color: cfg.color, background: `${cfg.color}11` }}
              >
                {cfg.badge}
              </div>
              <button
                onClick={() => setShowShare(true)}
                className="text-[11px] font-bold tracking-widest px-3 py-1.5 uppercase"
                style={{ border: "1px solid rgb(var(--gold-rgb) / 0.5)", color: "var(--gold)", background: "rgb(var(--gold-rgb) / 0.08)" }}
              >
                {t(lang, "↗ KONGSI KEPUTUSAN", "↗ SHARE RESULT")}
              </button>
            </div>
          </div>
        </div>

        {/* Seat counts + bar */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { party: partyDisplay, seats: mandatSeats, color: leader.partyColor, target: t(lang, `/ ${majorityTarget} SASARAN`, `/ ${majorityTarget} TARGET`) },
            { party: "LAWAN", seats: lawanSeats, color: "var(--warn-orange)", target: t(lang, "kerusi", "seats") },
            { party: t(lang, "LAIN-LAIN", "OTHERS"), seats: othersSeats, color: "var(--text-muted)", target: t(lang, "kerusi", "seats") },
          ].map(({ party, seats, color, target }) => (
            <TacticalPanel key={party}>
              <div className="flex flex-col items-center py-3">
                <div
                  className="font-bold leading-none"
                  style={{ fontSize: "62px", color, fontFamily: "Space Mono, monospace", textShadow: `0 0 16px ${color}44` }}
                >
                  <CountUpNumber value={seats} duration={1200} />
                </div>
                <div className="text-[11px] text-text-muted tracking-widest mt-2">{party} {target}</div>
              </div>
            </TacticalPanel>
          ))}
        </div>

        <TacticalPanel title={t(lang, `PENGAGIHAN KERUSI ${chamberLabel} — ${totalSeats} KERUSI ${seatTypeLabel}`, `${chamberLabel} SEAT DISTRIBUTION — ${totalSeats} ${seatTypeLabel} SEATS`)} className="mb-4">
          <div className="mt-2">
            <SeatBar mandat={mandatSeats} lawan={lawanSeats} others={othersSeats} partyName={partyDisplay} partyColor={leader.partyColor} animPhase={animPhase} totalSeats={totalSeats} majorityTarget={majorityTarget} lang={lang} />
          </div>
        </TacticalPanel>

        {/* State results + Campaign stats side by side */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* State Results */}
          <TacticalPanel title={stateResultsTitle} noPadding>
            <div className="overflow-y-auto" style={{ maxHeight: "210px" }}>
              <table className="w-full text-[12px]" style={{ fontFamily: "Space Mono, monospace" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
                    {(isPrn ? ["NEGERI", "DUN", t(lang, "SOKONGAN", "SUPPORT"), t(lang, "KEPUTUSAN", "RESULT")] : [t(lang, "NEGERI", "STATE"), t(lang, "KERUSI", "SEATS"), t(lang, "SOKONGAN", "SUPPORT"), t(lang, "KEPUTUSAN", "RESULT")]).map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-text-muted font-normal text-[11px] tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultStates.map((s, idx) => {
                    const summary = stateSeatSummaries[s.id] ?? { wins: 0, losses: 0, others: 0, totalVotes: 0, avgTurnout: 0 };
                    const stateWinner = summary.wins > Math.max(summary.losses, summary.others)
                      ? "WIN"
                      : summary.losses > Math.max(summary.wins, summary.others)
                        ? "LOSS"
                        : "FIGHT";
                    const resColor = stateWinner === "WIN" ? "var(--cyan)" : stateWinner === "LOSS" ? "var(--neon-red)" : "var(--gold)";
                    const resLabel = t(lang, stateWinner === "WIN" ? "MENANG" : stateWinner === "LOSS" ? "KALAH" : "BERTANDING", stateWinner);
                    const isSelected = selectedState?.id === s.id;
                    return (
                      <motion.tr
                        key={s.id}
                        onClick={() => setSelectedStateId(s.id)}
                        className="cursor-pointer transition-colors"
                        initial={{ opacity: 0, y: 8 }}
                        animate={showAnim ? { opacity: 1, y: 0 } : undefined}
                        transition={skipAnim ? { duration: 0 } : { duration: 0.3, ease: "easeOut", delay: idx * 0.05 }}
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
                        <td className="py-2 px-3 text-text-muted">{summary.wins}/{isPrn ? s.dunSeats : s.seats}</td>
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
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-3 py-3" style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-[11px] text-text-muted tracking-widest">{detailTitle}</div>
                  <div className="text-lg font-black text-white tracking-widest">{selectedState?.name ?? "-"}</div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: t(lang, "MENANG", "WIN"), value: selectedSeatSummary.wins, color: "var(--cyan)" },
                    { label: t(lang, "KALAH", "LOSS"), value: selectedSeatSummary.losses, color: "var(--warn-orange)" },
                    { label: t(lang, "LAIN", "OTH"), value: selectedSeatSummary.others, color: "var(--text-muted)" },
                    { label: t(lang, "KELUAR MENGUNDI", "TURNOUT"), value: formatPercent(selectedSeatSummary.avgTurnout), color: "var(--neon-green)" },
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
                      {["KAWASAN", t(lang, "KEPUTUSAN", "RESULT"), "MAJORITI", t(lang, "KELUAR MENGUNDI", "TURNOUT"), partyDisplay, "LAWAN", t(lang, "LAIN", "OTH")].map((h) => (
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
                            <div className="text-[9px] text-text-muted">{seat.constituency.code} · {formatNumber(seat.registeredVoters)} {t(lang, "PENGUNDI", "VOTERS")}</div>
                          </td>
                          <td className="py-2 pr-2">
                            <span className="px-1.5 py-0.5 font-bold" style={{ color, border: `1px solid ${color}44`, background: `${color}16` }}>{resultLabel(lang, seat.result)}</span>
                            <div className="text-[9px] text-text-muted mt-1">{seat.winnerLabel} {t(lang, "lwn", "vs")} {seat.runnerUpLabel}</div>
                          </td>
                          <td className="py-2 pr-2 text-white">
                            <div>{formatNumber(seat.majorityVotes)}</div>
                            <div className="text-[9px]" style={{ color }}>{formatPercent(seat.majorityPct)} pts</div>
                          </td>
                          <td className="py-2 pr-2" style={{ color: seat.turnoutPct >= 75 ? "var(--neon-green)" : "var(--gold)" }}>
                            <div>{formatPercent(seat.turnoutPct)}</div>
                            <div className="text-[9px] text-text-muted">{t(lang, `${formatNumber(seat.votesCast)} undi`, `${formatNumber(seat.votesCast)} votes`)}</div>
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
                {t(lang, "JUMLAH UNDI SAH TERPILIH", "TOTAL VALID VOTES COUNTED")}: {formatNumber(selectedSeatSummary.totalVotes)} · {isPrn ? t(lang, "fokus PRN negeri terpilih.", "focused on the selected PRN state.") : t(lang, "klik negeri lain untuk tukar detail kawasan.", "click another state to switch constituency detail.")}
              </div>
            </div>
          </TacticalPanel>

          {/* Campaign Stats + Achievements */}
          <div className="flex flex-col gap-4">
            <TacticalPanel title={isPrn ? t(lang, "STATISTIK KEMPEN PRN", "PRN CAMPAIGN STATISTICS") : t(lang, "STATISTIK KEMPEN", "CAMPAIGN STATISTICS")}>
              <div className="space-y-3 mt-1">
                {[
                  { label: supportLabel, value: <CountUpNumber value={nationalSupport} duration={1200} format={(n) => `${n}%`} />, color: nationalSupport >= 50 ? "var(--neon-green)" : "var(--gold)" },
                  { label: t(lang, "HARI BERKEMPEN", "DAYS CAMPAIGNED"), value: `${day} / ${totalDays}`, color: "var(--text-primary)" },
                  { label: statesWonLabel, value: isPrn ? `${statesWon} / 1` : `${statesWon} / 14`, color: "var(--cyan)" },
                  { label: t(lang, "NEGERI DIPERTANDINGKAN", "STATES CONTESTED"), value: `${statesContested}`, color: "var(--gold)" },
                  { label: statesLostLabel, value: `${statesLost}`, color: "var(--neon-red)" },
                  { label: t(lang, "DANA DIBELANJA", "FUNDS SPENT"), value: `RM ${(fundsSpent / 1_000_000).toFixed(2)}M`, color: "var(--text-muted)" },
                  { label: t(lang, "DANA BERBAKI", "FUNDS REMAINING"), value: `RM ${(resources.funds / 1_000_000).toFixed(2)}M`, color: "var(--gold)" },
                  { label: t(lang, "KEKUATAN LAPANGAN", "GROUND STRENGTH"), value: t(lang, `${resources.manpower} PEKERJA`, `${resources.manpower} WORKERS`), color: "var(--text-primary)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "6px" }}>
                    <span className="text-[12px] text-text-muted tracking-wider">{label}</span>
                    <span className="text-[12px] font-bold" style={{ color, fontFamily: "Space Mono, monospace" }}>{value}</span>
                  </div>
                ))}
              </div>
            </TacticalPanel>

            <TacticalPanel title={t(lang, "PENCAPAIAN", "ACHIEVEMENTS")}>
              <div className="space-y-2 mt-1">
                {achievements.map(({ labelMS, labelEN, achieved }) => (
                  <div key={labelEN} className="flex items-center gap-2.5">
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
                      {t(lang, labelMS, labelEN)}
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
            disabled={isPending}
            className="px-6 py-3 text-[12px] font-bold tracking-widest uppercase transition-all hover:opacity-80 disabled:opacity-50 disabled:cursor-wait"
            style={{
              background: "transparent",
              border: "1px solid rgb(var(--cyan-rgb) / 0.3)",
              color: "var(--text-muted)",
              fontFamily: "Space Mono, monospace",
            }}
          >
            {isPending ? t(lang, "⟳ MEMUATKAN...", "⟳ LOADING...") : t(lang, "KEMBALI KE MENU", "RETURN TO MENU")}
          </button>
          <button
            onClick={() => navigate(wonOwnSeat ? "/elected" : "/mandate")}
            disabled={isPending}
            className="px-8 py-3 text-[12px] font-bold tracking-widest uppercase transition-all hover:opacity-80 disabled:opacity-50 disabled:cursor-wait"
            style={{
              background: "rgb(var(--gold-rgb) / 0.13)",
              border: "1px solid rgb(var(--gold-rgb) / 0.55)",
              color: "var(--gold)",
              fontFamily: "Space Mono, monospace",
              boxShadow: "0 0 18px rgb(var(--gold-rgb) / 0.16)",
            }}
          >
            {isPending ? t(lang, "⟳ MEMUATKAN...", "⟳ LOADING...") : "♛ SAHKAN MANDAT"}
          </button>
          <button
            onClick={handleNewCampaign}
            disabled={isPending}
            className="px-8 py-3 text-[12px] font-bold tracking-widest uppercase transition-all hover:opacity-80 disabled:opacity-50 disabled:cursor-wait"
            style={{
              background: "rgb(var(--cyan-rgb) / 0.12)",
              border: "1px solid rgb(var(--cyan-rgb) / 0.5)",
              color: "var(--cyan)",
              fontFamily: "Space Mono, monospace",
              boxShadow: "0 0 16px rgb(var(--cyan-rgb) / 0.15)",
            }}
          >
            {isPending ? t(lang, "⟳ MEMUATKAN...", "⟳ LOADING...") : t(lang, "» KEMPEN BAHARU", "» NEW CAMPAIGN")}
          </button>
        </div>
      </main>

      <StatusBar leftText={t(lang, `${isPrn ? "PRN SELESAI" : "PILIHAN RAYA SELESAI"} · ${resultScopeLabel} · HARI ${day}/${totalDays}`, `${isPrn ? "PRN COMPLETE" : "ELECTION COMPLETE"} · ${resultScopeLabel} · DAY ${day}/${totalDays}`)} rightText={`${partyDisplay} ${mandatSeats}/${totalSeats} ${seatTypeLabel} · ${t(lang, verdict === "WIN" ? "MENANG" : verdict === "KINGMAKER" ? "PENENTU" : "KALAH", verdict)}`} />

      {showShare && (
        <ShareResultModal
          onClose={() => setShowShare(false)}
          data={{
            scopeLabel: resultScopeLabel,
            partyDisplay,
            leaderName: leader.name,
            verdictLabel: cfg.label,
            verdictColor: cfg.color,
            partyColor: leader.partyColor,
            mandatSeats,
            lawanSeats,
            othersSeats,
            totalSeats,
            majorityTarget,
            nationalSupport,
            day,
            totalDays,
            achievedCount: achievements.filter((item) => item.achieved).length,
            totalAchievements: achievements.length,
          }}
        />
      )}
    </div>
  );
}
