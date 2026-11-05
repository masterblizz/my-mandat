"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import ScenarioStart from "../components/career/ScenarioStart";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import Toggle from "../components/ui/Toggle";
import UpgradeButton from "../components/ui/UpgradeButton";

import { useGameStore } from "../store/gameStore";
import { setActiveSaveSlot } from "../store/saveGame";
import { REP_OPENING_ALLOCATION, REP_QUARTER_GRANT, STARTING_SIDES, type StartingSide } from "../store/representative";
import { GAME_SPEEDS, SPEED_DAYS, SPEED_LABEL, type GameSpeed } from "../data/ybService";
import { formatNumber } from "../utils/format";
import { states } from "../data/states";
import { isRulerState } from "../utils/governmentTerms";
import { generateConstituencies } from "../data/constituencies";
import { type DatasetKind, availableDatasets, getDatasetById } from "../data/datasets";
import { usePendingNav } from "../hooks/usePendingNav";
import { usePremiumStatus } from "../hooks/usePremiumStatus";
import { useLang, t } from "../i18n/useLang";
import { PREMIUM_PRICE_IDS } from "../config/premiumProducts";
import { FREE_PRN_STATE, prnStateUnlocked } from "../config/freeTier";
import { PRN_CANDIDATES, getPrnCandidate, prnCandidateStateImpact, type PrnCandidateId } from "../data/prnCandidates";

const POSITIONS = [
  { id: "PRESIDENT" },
  { id: "SECRETARY GENERAL" },
  { id: "CHAIRMAN" },
  { id: "DEPUTY PRESIDENT" },
];
const EXPERIENCE_OPTIONS = [
  { id: "veteran" },
  { id: "moderate" },
  { id: "rookie" },
] as const;
const DIFFICULTIES = [
  { id: "easy", opp: 40, media: 30 },
  { id: "normal", opp: 60, media: 50 },
  { id: "hard", opp: 80, media: 70 },
  { id: "nightmare", opp: 95, media: 90 },
] as const;
const MEDIA_OPTIONS = [
  { id: "PRO-MANDAT" },
  { id: "BALANCED" },
  { id: "HOSTILE" },
] as const;
const TOTAL_POINTS = 450;
const AVATARS = [
  { src: "/avatars/player-standing-01.png" },
  { src: "/avatars/player-standing-02.png" },
  { src: "/avatars/player-standing-03.png" },
  { src: "/avatars/player-standing-04.png" },
  { src: "/avatars/player-standing-05.png" },
];

// One icon + one short word per step: the wizard reads like a game menu,
// not a form.
const STEPS = [
  { icon: "🗂️", ms: "MOD", en: "MODE", titleMs: "Pilih dunia permainan", titleEn: "Choose your world" },
  { icon: "👤", ms: "WATAK", en: "LEADER", titleMs: "Siapa anda?", titleEn: "Who are you?" },
  { icon: "🗳️", ms: "UNDI", en: "ELECTION", titleMs: "Pilih medan pertempuran", titleEn: "Pick your battlefield" },
  { icon: "📍", ms: "KERUSI", en: "SEAT", titleMs: "Kerusi yang anda menangi", titleEn: "The seat you won" },
  { icon: "⚔️", ms: "CABARAN", en: "CHALLENGE", titleMs: "Tahap cabaran", titleEn: "Challenge level" },
  { icon: "🚀", ms: "MULA", en: "START", titleMs: "Sedia untuk mula?", titleEn: "Ready to start?" },
] as const;

const DIFFICULTY_ICON = { easy: "🙂", normal: "😐", hard: "😠", nightmare: "💀" } as const;

/** A big tappable choice: icon on top, a word or two, nothing to read. */
function Tile({ active, onClick, disabled, accent = "var(--gold)", badge, className = "", children }: {
  active: boolean; onClick: () => void; disabled?: boolean; accent?: string;
  badge?: { text: string; color: string }; className?: string; children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      className={`setup-tile relative flex min-w-0 flex-col items-start rounded-md p-3 text-left transition-all active:scale-[.97] disabled:cursor-not-allowed ${className}`}
      style={{
        border: `1.5px solid ${active ? accent : "rgb(var(--cyan-rgb) / 0.16)"}`,
        background: active ? `linear-gradient(160deg, color-mix(in srgb, ${accent} 16%, transparent), rgb(var(--bg-rgb) / 0.6))` : "rgba(255,255,255,0.025)",
        boxShadow: active ? `0 0 18px color-mix(in srgb, ${accent} 22%, transparent)` : "none",
        opacity: disabled ? 0.5 : 1,
      }}>
      {badge && <span className="absolute right-2 top-2 text-[9px] font-black tracking-widest" style={{ color: badge.color }}>{badge.text}</span>}
      {active && !badge && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black text-black" style={{ background: accent }}>✓</span>}
      {children}
    </button>
  );
}

/** A small pill toggle for minor choices. */
function Chip({ active, onClick, color = "var(--gold)", children, title }: { active: boolean; onClick: () => void; color?: string; children: ReactNode; title?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} title={title}
      className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wider transition-all active:scale-95"
      style={{ border: `1px solid ${active ? color : "rgb(var(--cyan-rgb) / 0.2)"}`, background: active ? color : "transparent", color: active ? "#000" : "var(--text-muted)" }}>
      {children}
    </button>
  );
}

/** Section label: an icon and a word, optional note on the right. */
function Label({ icon, children, right }: { icon: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.18em]" style={{ color: "var(--cyan)" }}><span aria-hidden>{icon}</span>{children}</div>
      {right}
    </div>
  );
}

/** Optional detail, folded away so the main choice stays simple. */
function More({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="setup-more group rounded-md border" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.16)", background: "rgba(255,255,255,0.02)" }}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[11px] font-black tracking-[0.18em] text-text-muted">
        <span>⚙ {label}</span><span className="transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-4 px-3 pb-3">{children}</div>
    </details>
  );
}

function Slider({ label, value, min = 0, max = 100, onChange, left, right, color = "var(--cyan)" }: {
  label: string; value: number; min?: number; max?: number; onChange: (v: number) => void; left?: string; right?: string; color?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]"><span className="font-bold tracking-wider text-text-muted">{label}</span><span className="font-black" style={{ color }}>{value}</span></div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}
        className="h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{ accentColor: color, background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, var(--bar-empty) ${pct}%, var(--bar-empty) 100%)` }} />
      {(left || right) && <div className="mt-1 flex justify-between text-[10px] text-text-muted"><span>{left}</span><span>{right}</span></div>}
    </div>
  );
}

function UltimateStrip({ hasUltimate, isLoading }: { hasUltimate: boolean; isLoading: boolean }) {
  const lang = useLang();
  if (hasUltimate || isLoading) return null;
  return (
    <div className="setup-ultimate mb-3 flex w-full max-w-[1100px] items-center justify-between gap-3 rounded-md border px-3 py-2" style={{ borderColor: "rgb(var(--gold-rgb) / 0.4)", background: "linear-gradient(90deg, rgb(var(--gold-rgb) / 0.12), transparent)" }}>
      <div className="min-w-0 truncate text-[11px] font-black tracking-[0.16em]" style={{ color: "var(--gold)" }}>✦ ULTIMATE · <span className="text-white">{t(lang, "Arkib Senario", "Scenario Archive")}</span></div>
      <UpgradeButton priceId={PREMIUM_PRICE_IDS.ultimateMonthly} mode="subscription" label={t(lang, "setup_page.getUltimate")} className="shrink-0 rounded border border-gold bg-gold px-3 py-1.5 text-[10px] font-black tracking-wider text-black disabled:opacity-50" />
    </div>
  );
}

/** One-line upsell for a locked option. */
function LockedNote({ text, priceId, label }: { text: string; priceId: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2" style={{ borderColor: "rgb(var(--gold-rgb) / 0.3)", background: "rgb(var(--gold-rgb) / 0.05)" }}>
      <span className="text-[11px] font-bold text-text-muted">🔒 {text}</span>
      <UpgradeButton priceId={priceId} mode="subscription" label={label} className="shrink-0 rounded border border-gold px-3 py-1.5 text-[10px] font-black tracking-wider text-gold disabled:opacity-50" />
    </div>
  );
}

export default function SetupPage() {
  const lang = useLang();
  const { isPending: isLaunching, navigate } = usePendingNav();
  const { setLeader, setNomination, setPhase, updateSettings, setDataset, setSelectedState, resetGame, settings } = useGameStore();
  const { hasPremium, hasUltimate, isLoading: premiumLoading } = usePremiumStatus();
  const [notice, setNotice] = useState<string | null>(null);

  // /api/checkout's cancel_url sends the user back here with ?purchase=
  // cancelled if they abandoned Stripe Checkout — read via window.location
  // rather than useSearchParams() so this doesn't need to wrap the entire
  // (already large) page in a Suspense boundary just for one query param.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchase") === "cancelled") {
      setNotice(t(lang, "setup_page.purchaseCancelled"));
      // Plain History API, NOT router.replace(): router.replace() re-enters
      // Next's App Router and was re-rendering this page in the same tick,
      // wiping the setNotice() call above before it ever painted — the
      // toast never appeared. history.replaceState only rewrites the
      // visible URL, no navigation/re-render involved.
      window.history.replaceState(null, "", "/setup");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const [step, setStep] = useState(0);


  // Step 0 state
  const [selectedDataset, setSelectedDataset] = useState<DatasetKind>("dummy");
  const currentDataset = useMemo(() => getDatasetById(selectedDataset), [selectedDataset]);

  // Step 1 state
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [leaderName, setLeaderName] = useState("");
  const [position, setPosition] = useState("PRESIDENT");
  const [experience, setExperience] = useState<"veteran" | "moderate" | "rookie">("veteran");
  const [homeState, setHomeState] = useState("selangor");
  const [influence, setInfluence] = useState(85);
  const [charisma, setCharisma] = useState(72);
  const [credibility, setCredibility] = useState(91);
  const [negotiation, setNegotiation] = useState(88);
  const [strategy, setStrategy] = useState(84);

  // Election scope is decided one step before nomination (see STEPS below —
  // campaign settings now comes before "contest your own seat") so the
  // nomination list already knows whether to offer parliament seats or DUN
  // kawasan before the player has to pick one.
  const [electionScope, setElectionScope] = useState<"pru" | "prn">(settings.electionScope ?? "pru");
  const [prnStateId, setPrnStateId] = useState(settings.prnStateId ?? "selangor");
  const [prnCandidateId, setPrnCandidateId] = useState<PrnCandidateId | null>(null);
  // Which bench the newly won seat sits on — decides the opening allocation
  // and quarterly grant of the representative career.
  const [side, setSide] = useState<StartingSide>(settings.side ?? "government");
  // How many game days pass per real second while the term clock runs.
  const [gameSpeed, setGameSpeed] = useState<GameSpeed>(settings.gameSpeed ?? "week");

  // Nomination state — as party president, the player must contest a seat too.
  // In PRN mode this must be a DUN seat in the chosen PRN negeri, not a
  // parliamentary seat in the (separate) "home state" flavor field — otherwise
  // /kawasan can never match leader.homeConstituencyId against its DUN-scoped
  // constituency list and silently falls back to the first DUN seat.
  const homeStateData = useMemo(() => states.find((s) => s.id === homeState) ?? states[0], [homeState]);
  const prnStateData = useMemo(() => states.find((s) => s.id === prnStateId) ?? states[0], [prnStateId]);
  // Head-of-government badge for the PRN negeri: MB in ruler states, KM (CM) elsewhere.
  const prnHeadAbbr = isRulerState(prnStateId) ? "MB" : t(lang, "KM", "CM");
  const homeConstituencies = useMemo(
    () => electionScope === "prn" ? generateConstituencies(prnStateData, "dun") : generateConstituencies(homeStateData),
    [electionScope, prnStateData, homeStateData]
  );
  const [contestConstituencyId, setContestConstituencyId] = useState(homeConstituencies[0]?.id ?? "");

  useEffect(() => {
    if (!homeConstituencies.some((c) => c.id === contestConstituencyId)) {
      setContestConstituencyId(homeConstituencies[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeConstituencies]);

  const contestConstituency = homeConstituencies.find((c) => c.id === contestConstituencyId) ?? null;

  const [selectedPartyId, setSelectedPartyId] = useState(currentDataset.parties[0]?.id ?? "");
  const selectedParty = useMemo(
    () => currentDataset.parties.find((party) => party.id === selectedPartyId) ?? currentDataset.parties[0],
    [currentDataset, selectedPartyId]
  );
  const partyName = selectedParty?.name ?? "";
  const partyAbbr = selectedParty?.abbreviation ?? "";
  const partyColor = selectedParty?.color ?? "var(--cyan)";

  // Step 2 state (campaign settings — electionScope/prnStateId now declared
  // earlier, alongside the nomination state that depends on them)
  const [economicIdeology, setEconomicIdeology] = useState(45);
  const [socialIdeology, setSocialIdeology] = useState(40);
  const [partyDesc, setPartyDesc] = useState("");
  const [regionPeninsular, setRegionPeninsular] = useState(true);
  const [regionSabah, setRegionSabah] = useState(true);
  const [regionSarawak, setRegionSarawak] = useState(true);

  // Step 3 state
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard" | "nightmare">(settings.difficulty);
  const [oppStrength, setOppStrength] = useState(settings.oppositionStrength);
  const [mediaBias, setMediaBias] = useState<"PRO-MANDAT" | "BALANCED" | "HOSTILE">(
    settings.mediaBias === "pro" ? "PRO-MANDAT" : settings.mediaBias === "hostile" ? "HOSTILE" : "BALANCED"
  );
  const [eventRandomness, setEventRandomness] = useState(settings.eventRandomness);
  const [permanentConsequences, setPermanentConsequences] = useState(settings.permanentConsequences);

  const pointsUsed = influence + charisma + credibility + negotiation + strategy;
  const pointsRemaining = TOTAL_POINTS - pointsUsed;

  function handleAttributeChange(newVal: number, currentVal: number, setter: (v: number) => void) {
    // Cap increases so pointsRemaining never drops below 0; decreases are always allowed.
    const clamped = newVal > currentVal ? Math.min(newVal, currentVal + pointsRemaining) : newVal;
    setter(Math.max(1, clamped));
  }

  useEffect(() => {
    setDifficulty(settings.difficulty);
    setOppStrength(settings.oppositionStrength);
    setMediaBias(settings.mediaBias === "pro" ? "PRO-MANDAT" : settings.mediaBias === "hostile" ? "HOSTILE" : "BALANCED");
    setElectionScope(settings.electionScope ?? "pru");
    setPrnStateId(settings.prnStateId ?? "selangor");
    setEventRandomness(settings.eventRandomness);
    setPermanentConsequences(settings.permanentConsequences);
  }, [settings.difficulty, settings.electionScope, settings.eventRandomness, settings.mediaBias, settings.oppositionStrength, settings.permanentConsequences, settings.prnStateId]);

  useEffect(() => {
    // free: PRU, and PRN in Perlis only
    if (!premiumLoading && !hasPremium && electionScope === "prn" && prnStateId !== FREE_PRN_STATE) setPrnStateId(FREE_PRN_STATE);
  }, [electionScope, hasPremium, premiumLoading, prnStateId]);

  useEffect(() => {
    if (!currentDataset.parties.some((party) => party.id === selectedPartyId)) {
      setSelectedPartyId(currentDataset.parties[0]?.id ?? "");
    }
  }, [currentDataset, selectedPartyId]);

  function handleDatasetSelect(datasetId: DatasetKind) {
    const dataset = getDatasetById(datasetId);
    setSelectedDataset(datasetId);
    setSelectedPartyId(dataset.parties[0]?.id ?? "");
  }

  function handleDifficultySelect(d: typeof DIFFICULTIES[number]) {
    setDifficulty(d.id);
    setOppStrength(d.opp);
  }

  function handleNext() {
    if (step === 1 && !leaderName.trim()) return;
    if (step === 2 && electionScope === "prn" && !prnCandidateId) return;
    if (step === 3 && !contestConstituencyId) return;
    if (step < 5) setStep(step + 1);
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  function handleLaunch() {
    if (premiumLoading) {
      setNotice(t(lang, "Menyemak akses akaun. Sila tunggu sebentar.", "Checking account access. Please wait a moment."));
      return;
    }
    // A launch always starts a fresh run from the setup choices. Clearing the
    // active slot makes the autosave subscriber create a new slot instead of
    // rewriting a previously loaded one.
    const campaignScope = electionScope === "prn" && !prnStateUnlocked(prnStateId, hasPremium) ? "pru" : electionScope;
    resetGame();
    setActiveSaveSlot(null);
    setDataset(selectedDataset);
    setLeader({
      name: leaderName,
      position,
      party: partyName,
      partyAbbr,
      partyColor,
      avatarIndex,
      influence,
      charisma,
      credibility,
      negotiation,
      strategy,
      experience,
      // PRN: the seat is an N.xxx in the PRN negeri, so that negeri is home.
      homeState: campaignScope === "prn" ? prnStateId : homeState,
      homeConstituencyId: contestConstituencyId,
      homeConstituencyName: contestConstituency?.name ?? "",
      ideology: { economic: economicIdeology, social: socialIdeology },
      manifesto: partyDesc,
    });
    if (contestConstituencyId) setNomination(contestConstituencyId, { type: "leader" });
    updateSettings({
      electionScope: campaignScope,
      prnStateId,
      difficulty,
      oppositionStrength: oppStrength,
      mediaBias: mediaBias === "PRO-MANDAT" ? "pro" : mediaBias === "HOSTILE" ? "hostile" : "balanced",
      eventRandomness,
      permanentConsequences,
      side,
      gameSpeed,
    });
    if (campaignScope === "prn" && prnCandidateId) {
      useGameStore.getState().journeyAction({ type: "prn-candidate", id: prnCandidateId });
    }
    setSelectedState(campaignScope === "prn" ? prnStateId : null);
    setPhase("playing");
    // Day one as the seat's elected representative; the election is settled
    // to match the chosen bench (see store/representative.ts).
    const started = useGameStore.getState().startAsRepresentative();
    navigate(started ? "/elected" : "/kawasan");
  }

  const meta = STEPS[step];
  const nextDisabled = (step === 1 && !leaderName.trim()) || (step === 2 && electionScope === "prn" && !prnCandidateId) || (step === 3 && !contestConstituencyId);
  const nextHint = step === 1 && !leaderName.trim()
    ? t(lang, "Masukkan nama", "Enter a name")
    : step === 2 && electionScope === "prn" && !prnCandidateId
      ? t(lang, `Pilih calon ${prnHeadAbbr}`, `Pick a${prnHeadAbbr === "MB" ? "n" : ""} ${prnHeadAbbr} candidate`)
      : null;
  const safetyColor = (safety: string) => safety === "safe" ? "var(--neon-green)" : safety === "marginal" ? "var(--gold)" : "var(--neon-red)";
  const attributes = [
    { id: "influence", val: influence, set: setInfluence, color: "var(--cyan)" },
    { id: "charisma", val: charisma, set: setCharisma, color: "var(--gold)" },
    { id: "credibility", val: credibility, set: setCredibility, color: "var(--neon-green)" },
    { id: "negotiation", val: negotiation, set: setNegotiation, color: "var(--warn-orange)" },
    { id: "strategy", val: strategy, set: setStrategy, color: "#8b5cf6" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      {notice && (
        <div role="status" className="fixed right-6 top-[58px] z-[80] border px-5 py-3 text-[11px] font-black tracking-[0.2em] uppercase" style={{ borderColor: "rgb(var(--cyan-rgb)/0.45)", background: "linear-gradient(135deg, rgb(var(--cyan-rgb)/0.14), rgb(var(--bg-rgb) / 0.96))", color: "var(--cyan)", fontFamily: "Space Mono, monospace" }}>
          {notice}
        </div>
      )}
      <main className="setup-screen pt-[40px] pb-[96px] min-h-screen flex flex-col items-center px-4">
        {step === 0 && <UltimateStrip hasUltimate={hasUltimate} isLoading={premiumLoading} />}
        {/* Scenario Archive is deliberately invisible unless Ultimate access
            is verified; standard Premium users continue to the custom builder. */}
        {step === 0 && hasUltimate && !premiumLoading && <ScenarioStart />}
        {step === 0 && hasUltimate && !premiumLoading && (
          <div className="mt-2 flex w-full max-w-[1100px] items-center gap-3 text-[10px] font-black tracking-[0.28em] text-text-muted">
            <span className="h-px flex-1 bg-white/10" />
            {t(lang, "ATAU BINA KEMPEN TERSUAI", "OR BUILD A CUSTOM CAMPAIGN")}
            <span className="h-px flex-1 bg-white/10" />
          </div>
        )}
        <div className="w-full max-w-[1100px] mt-2">
          {/* Step track: icon + one word each, tap to go back */}
          <div className="setup-steps mb-3 flex items-center gap-1">
            {STEPS.map((s, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <button key={s.en} type="button" onClick={() => done && setStep(i)} aria-current={current ? "step" : undefined}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1 py-1"
                  style={{ cursor: done ? "pointer" : "default" }}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full text-[15px] transition-all"
                    style={{
                      border: `1.5px solid ${current ? "var(--gold)" : done ? "var(--cyan)" : "var(--bar-empty)"}`,
                      background: current ? "rgb(var(--gold-rgb) / 0.18)" : done ? "rgb(var(--cyan-rgb) / 0.12)" : "transparent",
                      boxShadow: current ? "0 0 14px rgb(var(--gold-rgb) / 0.45)" : "none",
                      filter: current || done ? "none" : "grayscale(1) opacity(.55)",
                    }}>{done ? "✓" : s.icon}</span>
                  <span className="hidden truncate text-[9px] font-black tracking-[0.14em] sm:block" style={{ color: current ? "var(--gold)" : done ? "var(--cyan)" : "var(--text-muted)" }}>{t(lang, s.ms, s.en)}</span>
                </button>
              );
            })}
          </div>
          <h1 className="setup-title mb-4 text-center text-[18px] font-black tracking-wide text-white sm:text-[22px]">{t(lang, meta.titleMs, meta.titleEn)}</h1>

          {/* Step 0: world / data mode */}
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              {availableDatasets.map((ds) => {
                const isReal = ds.id === "real-malaysia";
                const accent = isReal ? "var(--gold)" : "var(--cyan)";
                return (
                  <Tile key={ds.id} active={selectedDataset === ds.id} onClick={() => handleDatasetSelect(ds.id as DatasetKind)} accent={accent} className="items-center p-4 text-center">
                    <span className="setup-tile-icon text-[40px] leading-none sm:text-[52px]">{isReal ? "🇲🇾" : "🎮"}</span>
                    <span className="mt-2 w-full text-center text-[14px] font-black tracking-wider" style={{ color: selectedDataset === ds.id ? accent : "var(--text-primary)" }}>
                      {t(lang, isReal ? "setup_page.dataModeReal" : "setup_page.dataModeFictional")}
                    </span>
                    <span className="mt-1 w-full text-center text-[11px] text-text-muted">
                      {isReal ? t(lang, "Parti sebenar · angka simulasi", "Real parties · simulated numbers") : t(lang, "Parti rekaan · bebas", "Made-up parties · no politics")}
                    </span>
                    <span className="mt-3 flex w-full flex-wrap justify-center gap-1">
                      {ds.parties.slice(0, 6).map((party) => (
                        <span key={party.id} className="rounded-full px-1.5 py-0.5 text-[9px] font-black" style={{ border: `1px solid ${party.color}`, color: party.color }}>{party.abbreviation}</span>
                      ))}
                      {ds.parties.length > 6 && <span className="text-[9px] text-text-muted">+{ds.parties.length - 6}</span>}
                    </span>
                  </Tile>
                );
              })}
            </div>
          )}

          {/* Step 1: leader */}
          {step === 1 && (
            <div className="setup-leader flex flex-col gap-4 sm:flex-row">
              <div className="flex shrink-0 flex-col items-center gap-2 sm:w-[220px]">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setAvatarIndex((avatarIndex + AVATARS.length - 1) % AVATARS.length)} aria-label={t(lang, "Avatar sebelum", "Previous avatar")}
                    className="flex h-9 w-9 items-center justify-center rounded-full border text-lg text-cyan active:scale-90" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.4)" }}>‹</button>
                  <div className="setup-avatar-preview relative overflow-hidden rounded-md"
                    style={{ width: "170px", height: "250px", border: `1.5px solid ${partyColor}`, background: `radial-gradient(ellipse at 50% 34%, color-mix(in srgb, ${partyColor} 20%, transparent), rgba(8,12,20,.6) 60%)`, boxShadow: `0 0 24px color-mix(in srgb, ${partyColor} 20%, transparent)` }}>
                    <Image src={AVATARS[avatarIndex].src} alt={t(lang, "setup_page.avatar2", { avatarName: t(lang, `setup_page.avatar_${avatarIndex}`) })} fill sizes="170px" style={{ objectFit: "contain", objectPosition: "center bottom" }} />
                  </div>
                  <button type="button" onClick={() => setAvatarIndex((avatarIndex + 1) % AVATARS.length)} aria-label={t(lang, "Avatar seterusnya", "Next avatar")}
                    className="flex h-9 w-9 items-center justify-center rounded-full border text-lg text-cyan active:scale-90" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.4)" }}>›</button>
                </div>
                <div className="text-[10px] font-black tracking-[0.18em] text-gold">{t(lang, `setup_page.avatar_${avatarIndex}`)}</div>
                <div className="flex gap-1.5" aria-label={t(lang, "setup_page.chooseAvatar")}>
                  {AVATARS.map((avatar, i) => (
                    <button key={avatar.src} type="button" onClick={() => setAvatarIndex(i)} aria-label={t(lang, "setup_page.select", { avatarName: t(lang, `setup_page.avatar_${i}`) })} aria-pressed={avatarIndex === i}
                      className="h-2.5 rounded-full transition-all" style={{ width: avatarIndex === i ? 22 : 10, background: avatarIndex === i ? "var(--gold)" : "var(--bar-empty)" }} />
                  ))}
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <Label icon="✏️">{t(lang, "setup_page.name")}</Label>
                  <input type="text" value={leaderName} onChange={(e) => setLeaderName(e.target.value.toUpperCase())}
                    className="w-full rounded-md text-[16px] font-black uppercase tracking-wider" placeholder={t(lang, "NAMA ANDA", "YOUR NAME")} aria-label={t(lang, "setup_page.name")} />
                </div>
                <div>
                  <Label icon="🚩" right={<span className="truncate text-[10px] font-bold" style={{ color: partyColor }}>{partyName}</span>}>{t(lang, "PARTI", "PARTY")}</Label>
                  <div className="setup-chip-row flex flex-wrap gap-1.5">
                    {currentDataset.parties.map((party) => (
                      <Chip key={party.id} active={selectedPartyId === party.id} onClick={() => setSelectedPartyId(party.id)} color={party.color} title={party.name}>{party.abbreviation}</Chip>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label icon="🎖️">{t(lang, "setup_page.position")}</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {POSITIONS.map((p) => <Chip key={p.id} active={position === p.id} onClick={() => setPosition(p.id)}>{t(lang, `setup_page.position_${p.id}`)}</Chip>)}
                    </div>
                  </div>
                  <div>
                    <Label icon="⭐">{t(lang, "setup_page.experience")}</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {EXPERIENCE_OPTIONS.map((opt) => <Chip key={opt.id} active={experience === opt.id} onClick={() => setExperience(opt.id)}>{t(lang, `setup_page.experience_${opt.id}`)}</Chip>)}
                    </div>
                  </div>
                </div>
                <More label={`${t(lang, "ATRIBUT", "ATTRIBUTES")} · ${t(lang, "setup_page.ptsRemaining", { pointsRemaining })}`}>
                  {attributes.map(({ id, val, set, color }) => (
                    <Slider key={id} label={t(lang, `setup_page.attr_${id}`)} value={val} min={1} max={100} color={color} onChange={(v) => handleAttributeChange(v, val, set)} />
                  ))}
                </More>
              </div>
            </div>
          )}

          {/* Step 2: election mode */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: "pru" as const, icon: "🇲🇾", title: "PRU", sub: t(lang, "Seluruh negara · Parlimen", "Nationwide · Parliament"), state: "unlocked" },
                  { id: "prn" as const, icon: "🏛️", title: "PRN", sub: hasPremium || premiumLoading ? t(lang, "Satu negeri · DUN", "One state · DUN") : t(lang, "Perlis percuma · DUN", "Perlis free · DUN"), state: "unlocked" },
                ]).map((mode) => (
                  <Tile key={mode.id} active={electionScope === mode.id} disabled={mode.state !== "unlocked"} onClick={() => setElectionScope(mode.id)} className="items-center p-4 text-center"
                    badge={mode.state === "locked" ? { text: `🔒 ${t(lang, "setup_page.premium")}`, color: "var(--gold)" } : undefined}>
                    <span className="setup-tile-icon text-[36px] leading-none">{mode.icon}</span>
                    <span className="mt-2 w-full text-center text-[20px] font-black tracking-[0.2em]" style={{ color: electionScope === mode.id ? "var(--gold)" : "var(--cyan)" }}>{mode.title}</span>
                    <span className="mt-0.5 w-full text-center text-[11px] text-text-muted">{mode.sub}</span>
                  </Tile>
                ))}
              </div>
              {!premiumLoading && !hasPremium && (
                <LockedNote text={t(lang, "PRN negeri lain dibuka dengan Premium", "PRN in other states unlocks with Premium")} priceId={PREMIUM_PRICE_IDS.premiumMonthly} label={t(lang, "setup_page.getPremium")} />
              )}

              {electionScope === "prn" && (
                <>
                  <div>
                    <Label icon="📍">{t(lang, "NEGERI", "STATE")}</Label>
                    <select value={prnStateId} onChange={(e) => setPrnStateId(e.target.value)} className="w-full rounded-md text-[14px] font-bold" aria-label={t(lang, "setup_page.selectPrnState")}>
                      {states.filter((state) => state.dunSeats > 0).map((state) => { const open = prnStateUnlocked(state.id, hasPremium); return <option key={state.id} value={state.id} disabled={!open}>{state.name} · {state.dunSeats} DUN{open ? (!hasPremium && state.id === FREE_PRN_STATE ? ` · ${t(lang, "PERCUMA", "FREE")}` : "") : " · 🔒 PREMIUM"}</option>; })}
                    </select>
                  </div>
                  <div>
                    <Label icon="👔" right={!prnCandidateId ? <span className="text-[10px] font-black text-amber-300">{t(lang, "WAJIB PILIH", "REQUIRED")}</span> : undefined}>{t(lang, `CALON ${prnHeadAbbr}`, `${prnHeadAbbr} CANDIDATE`)}</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      {PRN_CANDIDATES.map((candidate) => {
                        const active = prnCandidateId === candidate.id;
                        const impact = prnCandidateStateImpact(candidate.id, prnStateData);
                        const fit = impact >= 1 ? { c: "var(--neon-green)", w: t(lang, "SESUAI", "STRONG FIT") } : impact >= 0.5 ? { c: "var(--gold)", w: t(lang, "OK", "OK") } : { c: "var(--warn-orange)", w: t(lang, "LEMAH", "WEAK") };
                        return (
                          <Tile key={candidate.id} active={active} onClick={() => setPrnCandidateId(candidate.id)} accent={candidate.color} badge={{ text: fit.w, color: fit.c }}>
                            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-[13px] font-black" style={{ borderColor: candidate.color, color: candidate.color }}>
                              {candidate.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                            </span>
                            <span className="mt-2 w-full truncate text-[12px] font-black text-white">{candidate.name}</span>
                            <span className="w-full truncate text-[10px] font-bold" style={{ color: candidate.color }}>{candidate.archetype[lang]}</span>
                            {active && <span className="mt-1.5 text-[10px] leading-snug text-cyan">↑ {candidate.strength[lang]}</span>}
                          </Tile>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <More label={t(lang, "IDEOLOGI & MANIFESTO", "IDEOLOGY & MANIFESTO")}>
                <Slider label={t(lang, "setup_page.economicPolicy")} value={economicIdeology} onChange={setEconomicIdeology} left={t(lang, "setup_page.progressive")} right={t(lang, "setup_page.conservative")} />
                <Slider label={t(lang, "setup_page.socialStance")} value={socialIdeology} onChange={setSocialIdeology} left={t(lang, "setup_page.progressive")} right={t(lang, "setup_page.traditional")} />
                <textarea value={partyDesc} onChange={(e) => setPartyDesc(e.target.value)} placeholder={t(lang, "Manifesto ringkas (pilihan)…", "Short manifesto (optional)…")} rows={2} className="w-full resize-none rounded-md text-[13px]" aria-label={t(lang, "setup_page.partyDescription")} />
                {electionScope !== "prn" && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-bold tracking-wider text-text-muted">{t(lang, "setup_page.startingRegionFocus")}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "peninsular", val: regionPeninsular, set: setRegionPeninsular },
                        { id: "sabah", val: regionSabah, set: setRegionSabah },
                        { id: "sarawak", val: regionSarawak, set: setRegionSarawak },
                      ].map(({ id, val, set }) => <Chip key={id} active={val} onClick={() => set(!val)} color="var(--cyan)">{t(lang, `setup_page.region_${id}`)}</Chip>)}
                    </div>
                  </div>
                )}
              </More>
            </div>
          )}

          {/* Step 3: seat + bench */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label icon="📍" right={<span className="text-[10px] font-black text-cyan">{electionScope === "prn" ? `DUN · ${prnStateData.name}` : t(lang, "PARLIMEN", "PARLIAMENT")}</span>}>
                  {electionScope === "prn" ? t(lang, "NEGERI PRN", "PRN STATE") : t(lang, "NEGERI", "STATE")}
                </Label>
                {electionScope === "prn" ? (
                  <div className="rounded-md border px-3 py-2 text-[14px] font-black text-white" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.25)" }}>{prnStateData.name}</div>
                ) : (
                  <select value={homeState} onChange={(e) => setHomeState(e.target.value)} className="w-full rounded-md text-[14px] font-bold" aria-label={t(lang, "setup_page.homeState")}>
                    {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <Label icon="🗺️" right={<span className="text-[10px] text-text-muted">{homeConstituencies.length} {t(lang, "kerusi", "seats")}</span>}>{t(lang, "KERUSI", "SEAT")}</Label>
                <div className="setup-seat-grid grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" style={{ maxHeight: "260px", overflowY: "auto" }}>
                  {homeConstituencies.map((c) => {
                    const active = contestConstituencyId === c.id;
                    return (
                      <button key={c.id} type="button" onClick={() => setContestConstituencyId(c.id)} aria-pressed={active}
                        className="rounded-md p-2.5 text-left transition-all active:scale-[.97]"
                        style={{ border: `1.5px solid ${active ? "var(--gold)" : "rgb(var(--cyan-rgb) / 0.14)"}`, background: active ? "rgb(var(--gold-rgb) / 0.1)" : "rgba(255,255,255,0.02)" }}>
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-[12px] font-black" style={{ color: active ? "var(--gold)" : "var(--text-primary)" }}>{c.name}</span>
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: safetyColor(c.safety) }} aria-label={t(lang, c.safety === "safe" ? "setup_page.safetySafe" : c.safety === "marginal" ? "setup_page.safetyMarginal" : "setup_page.safetyDanger")} />
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-[10px]">
                          <span className="text-text-muted">{c.code}</span>
                          <span className="font-bold text-cyan">{c.mandat}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex gap-3 text-[9px] font-bold tracking-wider text-text-muted">
                  <span><span style={{ color: "var(--neon-green)" }}>●</span> {t(lang, "setup_page.safetySafe")}</span>
                  <span><span style={{ color: "var(--gold)" }}>●</span> {t(lang, "setup_page.safetyMarginal")}</span>
                  <span><span style={{ color: "var(--neon-red)" }}>●</span> {t(lang, "setup_page.safetyDanger")}</span>
                  <span className="ml-auto">% = {t(lang, "sokongan", "support")}</span>
                </div>
              </div>
              <div>
                <Label icon="🪑">{t(lang, "PIHAK ANDA", "YOUR BENCH")}</Label>
                <div role="radiogroup" aria-label={t(lang, "Pihak", "Side")} className="grid grid-cols-2 gap-3">
                  {STARTING_SIDES.map((option) => {
                    const government = option === "government";
                    return (
                      <Tile key={option} active={side === option} onClick={() => setSide(option)} accent={government ? "var(--gold)" : "var(--cyan)"} className="items-center text-center">
                        <span className="setup-tile-icon text-[30px] leading-none">{government ? "🏛️" : "⚖️"}</span>
                        <span className="mt-1.5 w-full text-center text-[13px] font-black tracking-wider text-white">{government ? t(lang, "KERAJAAN", "GOVERNMENT") : t(lang, "PEMBANGKANG", "OPPOSITION")}</span>
                        <span className="mt-1 w-full text-center text-[10px] font-bold text-gold">💰 RM {formatNumber(REP_OPENING_ALLOCATION[option])}</span>
                        <span className="w-full text-center text-[10px] text-text-muted">+RM {formatNumber(REP_QUARTER_GRANT[option])} / {t(lang, "suku", "quarter")}</span>
                      </Tile>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: challenge */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DIFFICULTIES.map((d) => {
                  const isNightmare = d.id === "nightmare";
                  const state = !isNightmare ? "unlocked" : premiumLoading ? "checking" : hasPremium ? "unlocked" : "locked";
                  return (
                    <Tile key={d.id} active={difficulty === d.id} disabled={state !== "unlocked"} onClick={() => handleDifficultySelect(d)} accent={isNightmare ? "var(--neon-red)" : "var(--gold)"} className="items-center text-center"
                      badge={state === "locked" ? { text: "🔒", color: "var(--gold)" } : undefined}>
                      <span className="setup-tile-icon text-[30px] leading-none">{DIFFICULTY_ICON[d.id]}</span>
                      <span className="mt-1.5 w-full text-center text-[12px] font-black tracking-wider text-white">{t(lang, `setup_page.difficulty_${d.id}_label`)}</span>
                      <span className="mt-2 flex w-full items-center gap-1.5 text-[9px] text-text-muted" title={t(lang, "setup_page.oppositionStr")}>⚔️
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bar-empty)]"><span className="block h-full rounded-full" style={{ width: `${d.opp}%`, background: "var(--neon-red)" }} /></span>
                      </span>
                      <span className="mt-1 flex w-full items-center gap-1.5 text-[9px] text-text-muted" title={t(lang, "setup_page.mediaChallenge")}>📰
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bar-empty)]"><span className="block h-full rounded-full" style={{ width: `${d.media}%`, background: "var(--warn-orange)" }} /></span>
                      </span>
                    </Tile>
                  );
                })}
              </div>
              {!premiumLoading && !hasPremium && (
                <LockedNote text={t(lang, "Mimpi Ngeri = Premium", "Nightmare = Premium")} priceId={PREMIUM_PRICE_IDS.premiumMonthly} label={t(lang, "setup_page.getPremium")} />
              )}
              <div>
                <Label icon="⏩">{t(lang, "KELAJUAN", "SPEED")}</Label>
                <div role="radiogroup" aria-label={t(lang, "Kelajuan permainan", "Game speed")} className="grid grid-cols-4 gap-2">
                  {GAME_SPEEDS.map((option) => (
                    <button key={option} type="button" role="radio" aria-checked={gameSpeed === option} onClick={() => setGameSpeed(option)}
                      className="rounded-md px-1 py-2 text-center transition-all active:scale-95"
                      style={{ border: `1.5px solid ${gameSpeed === option ? "var(--gold)" : "rgb(var(--cyan-rgb) / 0.16)"}`, background: gameSpeed === option ? "rgb(var(--gold-rgb) / 0.1)" : "rgba(255,255,255,0.02)" }}>
                      <div className="truncate text-[11px] font-black" style={{ color: gameSpeed === option ? "var(--gold)" : "var(--text-primary)" }}>{SPEED_LABEL[option][lang].toUpperCase()}</div>
                      <div className="text-[9px] text-text-muted">{t(lang, `${SPEED_DAYS[option]} hari/s`, `${SPEED_DAYS[option]} d/s`)}</div>
                    </button>
                  ))}
                </div>
              </div>
              <More label={t(lang, "PENALAAN HALUS", "FINE TUNING")}>
                <Slider label={t(lang, "setup_page.oppositionStrength")} value={oppStrength} min={20} max={99} onChange={setOppStrength} color="var(--neon-red)" />
                <div>
                  <div className="mb-1.5 text-[11px] font-bold tracking-wider text-text-muted">{t(lang, "setup_page.mediaBias")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {MEDIA_OPTIONS.map((m) => (
                      <Chip key={m.id} active={mediaBias === m.id} onClick={() => setMediaBias(m.id)} color={m.id === "PRO-MANDAT" ? "var(--neon-green)" : m.id === "HOSTILE" ? "var(--neon-red)" : "var(--cyan)"}>{t(lang, `setup_page.media_${m.id}`)}</Chip>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  <Toggle value={eventRandomness} onChange={setEventRandomness} label={t(lang, "setup_page.eventRandomness")} />
                  <Toggle value={permanentConsequences} onChange={setPermanentConsequences} label={t(lang, "setup_page.permanentConsequences")} />
                </div>
              </More>
            </div>
          )}

          {/* Step 5: confirm — one player card and a big start button */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="setup-card flex gap-4 rounded-lg border p-4" style={{ borderColor: partyColor, background: `linear-gradient(135deg, color-mix(in srgb, ${partyColor} 13%, transparent), rgb(var(--bg-rgb) / 0.7))`, boxShadow: `0 0 26px color-mix(in srgb, ${partyColor} 15%, transparent)` }}>
                <div className="relative h-[150px] w-[100px] shrink-0 overflow-hidden rounded-md" style={{ border: `1.5px solid ${partyColor}` }}>
                  <Image src={AVATARS[avatarIndex].src} alt={t(lang, "setup_page.avatar3")} fill sizes="100px" style={{ objectFit: "contain", objectPosition: "center bottom" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[20px] font-black tracking-wide text-white">{leaderName || "—"}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                    <span className="rounded-full px-2 py-0.5 text-black" style={{ background: partyColor }}>{partyAbbr}</span>
                    <span className="text-text-muted">{t(lang, `setup_page.position_${position}`)} · {t(lang, `setup_page.experience_${experience}`)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-3">
                    {[
                      { icon: "📍", v: contestConstituency ? `${contestConstituency.code} ${contestConstituency.name}` : "—" },
                      { icon: "🗳️", v: electionScope === "prn" ? `PRN · ${prnStateData.name}` : t(lang, "PRU · Kebangsaan", "PRU · National") },
                      { icon: side === "government" ? "🏛️" : "⚖️", v: side === "government" ? t(lang, "Kerajaan", "Government") : t(lang, "Pembangkang", "Opposition") },
                      { icon: DIFFICULTY_ICON[difficulty], v: t(lang, `setup_page.difficulty_${difficulty}_label`) },
                      { icon: "⏩", v: SPEED_LABEL[gameSpeed][lang] },
                      ...(electionScope === "prn" ? [{ icon: "👔", v: getPrnCandidate(prnCandidateId)?.name ?? "—" }] : []),
                    ].map((row, i) => (
                      <div key={i} className="flex min-w-0 items-center gap-1.5 rounded border px-2 py-1" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.14)" }}>
                        <span aria-hidden>{row.icon}</span><span className="truncate font-bold text-white">{row.v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-3">
                    {attributes.map(({ id, val, color }) => (
                      <div key={id} className="text-center" title={t(lang, `setup_page.attr_${id}`)}>
                        <div className="text-[15px] font-black" style={{ color }}>{val}</div>
                        <div className="text-[8px] tracking-wider text-text-muted">{t(lang, `setup_page.attr_${id}`).slice(0, 4)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={handleLaunch} disabled={isLaunching}
                className="w-full rounded-md py-4 text-[15px] font-black tracking-[0.2em] uppercase transition-all active:scale-[.98] disabled:opacity-60 disabled:cursor-wait"
                style={{ background: "var(--gold)", color: "#000000", fontFamily: "Space Mono, monospace", boxShadow: "0 0 24px rgb(var(--gold-rgb) / 0.45)" }}>
                {isLaunching ? t(lang, "setup_page.loading") : t(lang, "setup_page.launchCampaign")}
              </button>
            </div>
          )}
        </div>
      </main>
      {/* Navigation — fixed above HUD so bottom controls are never hidden by the status/music overlays.
          Kept outside <main>: in landscape <main> is itself a fixed scroll container,
          and iOS Safari clips fixed children of such a scroller (the buttons vanished). */}
      <div
        className="setup-nav fixed left-0 right-0 z-[70] px-4 py-3"
        style={{
          bottom: "36px",
          background: "linear-gradient(180deg, rgba(8,12,20,0.82), var(--bg))",
          borderTop: "1px solid rgb(var(--cyan-rgb) / 0.18)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-2">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="whitespace-nowrap rounded-md px-4 py-2 text-[12px] font-bold tracking-wider uppercase transition-all disabled:opacity-30"
            style={{ border: "1px solid var(--gold)", color: "var(--gold)", background: "transparent", fontFamily: "Space Mono, monospace", cursor: step === 0 ? "not-allowed" : "pointer" }}
          >
            {t(lang, "setup_page.back")}
          </button>

          <div className="flex min-w-0 flex-col items-center gap-1">
            <div className="flex gap-1">
              {STEPS.map((s, i) => <span key={s.en} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? 18 : 6, background: i <= step ? "var(--gold)" : "var(--bar-empty)" }} />)}
            </div>
            {nextHint && <span className="truncate text-[10px] font-bold text-amber-300">{nextHint}</span>}
          </div>

          {step < 5 ? (
            <button
              onClick={handleNext}
              disabled={nextDisabled}
              className="whitespace-nowrap rounded-md px-5 py-2 text-[12px] font-black tracking-wider uppercase transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "var(--gold)", color: "#000000", fontFamily: "Space Mono, monospace" }}
            >
              {t(lang, "setup_page.next")}
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              disabled={isLaunching}
              className="whitespace-nowrap rounded-md px-5 py-2 text-[12px] font-black tracking-wider uppercase transition-all disabled:opacity-60 disabled:cursor-wait"
              style={{ background: "var(--gold)", color: "#000000", fontFamily: "Space Mono, monospace", boxShadow: "0 0 16px rgb(var(--gold-rgb) / 0.35)" }}
            >
              {isLaunching ? t(lang, "setup_page.loading") : t(lang, "setup_page.launch")}
            </button>
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}

