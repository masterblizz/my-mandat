"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import StatBar from "../components/ui/StatBar";
import Toggle from "../components/ui/Toggle";
import UpgradeButton from "../components/ui/UpgradeButton";

import { useGameStore } from "../store/gameStore";
import { setActiveSaveSlot } from "../store/saveGame";
import { states } from "../data/states";
import { generateConstituencies } from "../data/constituencies";
import { type DatasetKind, availableDatasets, getDatasetById } from "../data/datasets";
import { usePendingNav } from "../hooks/usePendingNav";
import { usePremiumStatus } from "../hooks/usePremiumStatus";
import { useLang, t } from "../i18n/useLang";
import { PREMIUM_PRICE_IDS } from "../config/premiumProducts";

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
  { src: "/avatars/leader-01.png" },
  { src: "/avatars/leader-02.png" },
  { src: "/avatars/leader-03.png" },
  { src: "/avatars/leader-04.png" },
  { src: "/avatars/leader-05.png" },
];

const STEPS = [
  { num: "00" },
  { num: "01" },
  { num: "02" },
  { num: "03" },
  { num: "04" },
  { num: "05" },
];

export default function SetupPage() {
  const lang = useLang();
  const { isPending: isLaunching, navigate } = usePendingNav();
  const { setLeader, setNomination, setPhase, updateSettings, setDataset, setSelectedState, resetGame, settings } = useGameStore();
  const { hasPremium, isLoading: premiumLoading } = usePremiumStatus();
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

  // Nomination state — as party president, the player must contest a seat too.
  // In PRN mode this must be a DUN seat in the chosen PRN negeri, not a
  // parliamentary seat in the (separate) "home state" flavor field — otherwise
  // /kawasan can never match leader.homeConstituencyId against its DUN-scoped
  // constituency list and silently falls back to the first DUN seat.
  const homeStateData = useMemo(() => states.find((s) => s.id === homeState) ?? states[0], [homeState]);
  const prnStateData = useMemo(() => states.find((s) => s.id === prnStateId) ?? states[0], [prnStateId]);
  const positionLabelLower = t(lang, `setup_page.position_${position}`).toLowerCase();
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
  const oppSliderPct = ((oppStrength - 20) / (99 - 20)) * 100;

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
    if (step === 3 && !contestConstituencyId) return;
    if (step < 5) setStep(step + 1);
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  function handleLaunch() {
    // LAUNCH CAMPAIGN must always start a fresh run from the setup choices.
    // If the player previously loaded an old slot, clear that active slot first
    // so the autosave subscriber creates a new slot instead of rewriting/resuming it.
    // Lands on /kawasan (the player's home constituency) rather than jumping
    // straight into /warroom — kawasan now carries an ENTER WAR ROOM button.
    navigate("/kawasan", () => {
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
        homeState,
        homeConstituencyId: contestConstituencyId,
        homeConstituencyName: contestConstituency?.name ?? "",
        ideology: { economic: economicIdeology, social: socialIdeology },
        manifesto: partyDesc,
      });
      if (contestConstituencyId) setNomination(contestConstituencyId, { type: "leader" });
      updateSettings({
        electionScope,
        prnStateId,
        difficulty,
        oppositionStrength: oppStrength,
        mediaBias: mediaBias === "PRO-MANDAT" ? "pro" : mediaBias === "HOSTILE" ? "hostile" : "balanced",
        eventRandomness,
        permanentConsequences,
      });
      setSelectedState(electionScope === "prn" ? prnStateId : null);
      setPhase("playing");
    });
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      {notice && (
        <div role="status" className="fixed right-6 top-[58px] z-[80] border px-5 py-3 text-[11px] font-black tracking-[0.2em] uppercase" style={{ borderColor: "rgb(var(--cyan-rgb)/0.45)", background: "linear-gradient(135deg, rgb(var(--cyan-rgb)/0.14), rgba(3,8,15,0.96))", color: "var(--cyan)", fontFamily: "Space Mono, monospace" }}>
          {notice}
        </div>
      )}
      <main className="pt-[40px] pb-[96px] min-h-screen flex flex-col items-center px-4">
        <div className="w-full max-w-[1100px] mt-6">
          {/* Step Indicator */}
          <div className="flex gap-0 mb-8">
            {STEPS.map((s, i) => (
              <button
                key={i}
                onClick={() => i < step && setStep(i)}
                className="flex-1 py-3 text-center border-b-2 transition-all"
                style={{
                  borderColor: i === step ? "var(--gold)" : "var(--bar-empty)",
                  cursor: i < step ? "pointer" : "default",
                }}
              >
                <div
                  className="text-[12px] font-bold tracking-widest"
                  style={{ color: i === step ? "var(--gold)" : "var(--text-muted)" }}
                >
                  {s.num}
                </div>
                <div
                  className="text-[11px] tracking-wider mt-0.5"
                  style={{ color: i === step ? "var(--gold)" : "var(--text-muted)" }}
                >
                  {t(lang, `setup_page.step_${s.num}_label`)}
                </div>
              </button>
            ))}
          </div>

          {/* Step 0: Data Mode */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <div className="text-[13px] text-text-muted tracking-widest uppercase">
                  {t(lang, "setup_page.chooseWhichPoliticalNamesPartiesAppear")}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {availableDatasets.map((ds) => {
                  const selected = selectedDataset === ds.id;
                  const isReal = ds.id === "real-malaysia";
                  const accentColor = isReal ? "var(--gold)" : "var(--cyan)";
                  return (
                    <button
                      key={ds.id}
                      onClick={() => handleDatasetSelect(ds.id as DatasetKind)}
                      className="relative text-left p-6 transition-all"
                      style={{
                        background: selected ? (isReal ? "rgb(var(--gold-rgb) / 0.07)" : "rgb(var(--cyan-rgb) / 0.07)") : "rgba(255,255,255,0.02)",
                        border: `1px solid ${selected ? accentColor : "var(--bar-empty)"}`,
                        boxShadow: selected ? `0 0 18px ${accentColor}33` : "none",
                      }}
                    >
                      {selected && (
                        <div
                          className="absolute top-3 right-3 text-[10px] font-bold tracking-widest px-2 py-0.5"
                          style={{ background: accentColor, color: "#000" }}
                        >
                          {t(lang, "setup_page.selected")}
                        </div>
                      )}
                      <div className="text-[22px] mb-3">{isReal ? "🇲🇾" : "🎮"}</div>
                      <div
                        className="text-[15px] font-bold tracking-wider mb-2 uppercase"
                        style={{ color: selected ? accentColor : "#fff" }}
                      >
                        {t(lang, ds.labelMS ?? ds.label, ds.label)}
                      </div>
                      <div className="text-[13px] text-text-muted leading-relaxed mb-4">
                        {t(lang, ds.descriptionMS ?? ds.description, ds.description)}
                      </div>
                      <div
                        className="text-[11px] px-3 py-2 leading-relaxed"
                        style={{
                          background: isReal ? "rgb(var(--gold-rgb) / 0.08)" : "rgb(var(--cyan-rgb) / 0.08)",
                          border: `1px solid ${isReal ? "rgb(var(--gold-rgb) / 0.25)" : "rgb(var(--cyan-rgb) / 0.25)"}`,
                          color: "var(--text-muted)",
                        }}
                      >
                        ℹ {t(lang, ds.dataNoteMS ?? ds.dataNote, ds.dataNote)}
                      </div>
                      <div className="mt-4 space-y-1">
                        {ds.parties.slice(0, 4).map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                            <span className="text-[12px] text-text-muted">{p.abbreviation} — {p.name}</span>
                          </div>
                        ))}
                        {ds.parties.length > 4 && (
                          <div className="text-[11px] text-text-muted pl-4">
                            {t(lang, "setup_page.moreParties", { dsPartiesLength: ds.parties.length - 4 })}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 1: Avatar & Party */}
          {step === 1 && (
            <div className="flex gap-4">
              {/* Left: Avatar Selector */}
              <TacticalPanel title={t(lang, "setup_page.avatar")} className="w-[220px] shrink-0">
                <div className="flex flex-col items-center gap-3 mt-1">
                  <div
                    className="relative flex items-center justify-center rounded-full"
                    style={{
                      width: "154px",
                      height: "154px",
                      background: "radial-gradient(circle at 50% 38%, rgb(var(--cyan-rgb) / 0.32), rgba(8,12,20,0.1) 54%, rgb(var(--gold-rgb) / 0.2) 78%, rgb(var(--cyan-rgb) / 0.35))",
                      boxShadow: "0 0 28px rgb(var(--cyan-rgb) / 0.24), inset 0 0 22px rgb(var(--gold-rgb) / 0.12)",
                    }}
                  >
                    <div
                      className="relative overflow-hidden rounded-full"
                      style={{
                        width: "136px",
                        height: "136px",
                        border: "2px solid var(--cyan)",
                        outline: "1px solid rgb(var(--gold-rgb) / 0.65)",
                        outlineOffset: "5px",
                        background: "var(--bg)",
                        boxShadow: "0 0 18px rgb(var(--cyan-rgb) / 0.45)",
                      }}
                    >
                      <Image
                        src={AVATARS[avatarIndex].src}
                        alt={t(lang, "setup_page.avatar2", { avatarName: t(lang, `setup_page.avatar_${avatarIndex}`) })}
                        fill
                        sizes="136px"
                        style={{ objectFit: "cover", transform: "scale(1.06)" }}
                      />
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[11px] tracking-[0.28em]" style={{ color: "var(--cyan)" }}>
                      {t(lang, "setup_page.selectedAvatar")}
                    </div>
                    <div
                      className="mt-1 inline-flex px-2 py-1 text-[10px] font-bold tracking-wider"
                      style={{
                        color: "var(--gold)",
                        border: "1px solid rgb(var(--gold-rgb) / 0.35)",
                        background: "rgb(var(--gold-rgb) / 0.08)",
                      }}
                    >
                      {t(lang, `setup_page.avatar_${avatarIndex}`)}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2.5 w-full pt-1" aria-label={t(lang, "setup_page.chooseAvatar")}>
                    {AVATARS.map((avatar, i) => {
                      const selected = avatarIndex === i;
                      return (
                        <button
                          key={avatar.src}
                          type="button"
                          onClick={() => setAvatarIndex(i)}
                          aria-label={t(lang, "setup_page.select", { avatarName: t(lang, `setup_page.avatar_${i}`) })}
                          aria-pressed={selected}
                          className="group relative flex items-center justify-center overflow-hidden rounded-full transition-all hover:scale-105"
                          style={{
                            width: "52px",
                            height: "52px",
                            border: `2px solid ${selected ? "var(--gold)" : "#12445f"}`,
                            boxShadow: selected ? "0 0 18px rgb(var(--gold-rgb) / 0.55), 0 0 10px rgb(var(--cyan-rgb) / 0.25)" : "0 0 10px rgb(var(--cyan-rgb) / 0.14)",
                            background: "var(--bg)",
                            opacity: selected ? 1 : 0.78,
                          }}
                        >
                          <Image
                            src={avatar.src}
                            alt=""
                            aria-hidden="true"
                            fill
                            sizes="52px"
                            style={{ objectFit: "cover", transform: "scale(1.08)" }}
                          />
                          <span
                            className="absolute inset-0 rounded-full"
                            style={{ boxShadow: selected ? "inset 0 0 0 2px rgba(255,255,255,0.18)" : "inset 0 0 18px rgba(0,0,0,0.2)" }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </TacticalPanel>

              {/* Center: Leader Details */}
              <TacticalPanel title={t(lang, "setup_page.leaderDetails")} className="flex-1">
                <div className="space-y-3">
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">{t(lang, "setup_page.name")}</div>
                    <input
                      type="text"
                      value={leaderName}
                      onChange={(e) => setLeaderName(e.target.value.toUpperCase())}
                      className="w-full uppercase"
                      placeholder={t(lang, "setup_page.enterName")}
                    />
                  </div>
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">{t(lang, "setup_page.position")}</div>
                    <select
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="w-full"
                    >
                      {POSITIONS.map((p) => (
                        <option key={p.id} value={p.id}>{t(lang, `setup_page.position_${p.id}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">{t(lang, "setup_page.experience")}</div>
                    <div className="flex gap-2">
                      {EXPERIENCE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setExperience(opt.id)}
                          className="flex-1 py-1.5 text-[12px] tracking-wider transition-all"
                          style={{
                            background: experience === opt.id ? "var(--gold)" : "transparent",
                            color: experience === opt.id ? "#000" : "var(--text-muted)",
                            border: "1px solid",
                            borderColor: experience === opt.id ? "var(--gold)" : "var(--bar-empty)",
                          }}
                        >
                          {t(lang, `setup_page.experience_${opt.id}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">{t(lang, "setup_page.homeState")}</div>
                    <select
                      value={homeState}
                      onChange={(e) => setHomeState(e.target.value)}
                      className="w-full"
                    >
                      {states.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Leader Attributes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[12px] text-text-muted tracking-wider">{t(lang, "setup_page.leaderAttributes")}</div>
                      <div
                        className="text-[12px] font-bold"
                        style={{ color: pointsRemaining < 0 ? "var(--neon-red)" : "var(--neon-green)" }}
                      >
                        {t(lang, "setup_page.ptsRemaining", { pointsRemaining: pointsRemaining })}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { id: "influence", val: influence, set: setInfluence },
                        { id: "charisma", val: charisma, set: setCharisma },
                        { id: "credibility", val: credibility, set: setCredibility },
                        { id: "negotiation", val: negotiation, set: setNegotiation },
                        { id: "strategy", val: strategy, set: setStrategy },
                      ].map(({ id, val, set }) => (
                        <div key={id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-text-muted">{t(lang, `setup_page.attr_${id}`)}</span>
                            <span className="text-[12px] text-cyan font-bold">{val}</span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={100}
                            value={val}
                            onChange={(e) => handleAttributeChange(Number(e.target.value), val, set)}
                            className="w-full h-1.5 appearance-none cursor-pointer rounded-none"
                            style={{
                              accentColor: "var(--cyan)",
                              background: `linear-gradient(to right, rgba(0,200,255,0.45) 0%, rgba(0,200,255,0.45) ${val}%, rgba(26,35,51,0.8) ${val}%, rgba(26,35,51,0.8) 100%)`,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TacticalPanel>

              {/* Right: Party Identity */}
              <TacticalPanel title={t(lang, "setup_page.partyIdentity")} className="w-[200px] shrink-0">
                <div className="space-y-3">
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">{t(lang, "setup_page.datasetParty")}</div>
                    <select
                      value={selectedPartyId}
                      onChange={(e) => setSelectedPartyId(e.target.value)}
                      className="w-full text-[12px]"
                      style={{ color: partyColor, borderColor: partyColor }}
                    >
                      {currentDataset.parties.map((party) => (
                        <option key={party.id} value={party.id}>
                          {party.abbreviation} — {party.name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-[9px] leading-4 tracking-[0.12em]" style={{ color: "#6f8092" }}>
                      {t(lang, "setup_page.partyIdentityLockedToSelectedDataset", { currentDatasetLabelMSCurrentDataset: currentDataset.labelMS ?? currentDataset.label, currentDatasetLabel: currentDataset.label })}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <div className="border px-3 py-2" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.14)", background: "rgba(255,255,255,0.025)" }}>
                      <div className="text-[9px] text-text-muted tracking-[0.18em]">{t(lang, "setup_page.partyName")}</div>
                      <div className="mt-1 text-[11px] font-bold leading-4 text-white">{partyName}</div>
                    </div>
                    <div className="border px-3 py-2" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.14)", background: "rgba(255,255,255,0.025)" }}>
                      <div className="text-[9px] text-text-muted tracking-[0.18em]">{t(lang, "setup_page.abbreviation")}</div>
                      <div className="mt-1 text-[13px] font-black" style={{ color: partyColor }}>{partyAbbr}</div>
                    </div>
                  </div>
                  {/* Logo Preview */}
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-2">{t(lang, "setup_page.logoPreview")}</div>
                    <div
                      className="flex items-center justify-center h-20 text-4xl font-bold"
                      style={{
                        background: "var(--bg)",
                        border: `2px solid ${partyColor}`,
                        color: partyColor,
                        boxShadow: `0 0 12px ${partyColor}44`,
                        fontFamily: "Space Mono, monospace",
                      }}
                    >
                      {partyAbbr[0] || "M"}
                    </div>
                    <div className="text-center text-[11px] mt-1" style={{ color: partyColor }}>
                      {partyAbbr}
                    </div>
                  </div>
                </div>
              </TacticalPanel>
            </div>
          )}

          {/* Step 3: Nomination — as party president, the leader must also contest a seat.
              Runs after campaign settings so it already knows PRU vs PRN. */}
          {step === 3 && (
            <div className="space-y-3">
              <TacticalPanel title={electionScope === "prn" ? t(lang, "setup_page.contestYourDunSeat") : t(lang, "setup_page.contestYourOwnSeat")}>
                <div className="text-[13px] text-text-muted leading-relaxed mb-3">
                  {electionScope === "prn"
                    ? t(lang, "setup_page.asOfYouMustBeNominated", { pOSITIONSFindP: positionLabelLower, partyName: partyName || "parti anda", prnStateDataNamePrnStateId: prnStateData?.name ?? prnStateId.toUpperCase(), position: positionLabelLower, partyName2: partyName || "your party" })
                    : t(lang, "setup_page.asOfYouMustBeNominated2", { pOSITIONSFindP: positionLabelLower, partyName: partyName || "parti anda", homeStateDataNameHomeState: homeStateData?.name ?? homeState.toUpperCase(), position: positionLabelLower, partyName2: partyName || "your party" })}
                </div>
                <div className="grid grid-cols-3 gap-3" style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {homeConstituencies.map((c) => {
                    const active = contestConstituencyId === c.id;
                    const safetyColor = c.safety === "safe" ? "var(--neon-green)" : c.safety === "marginal" ? "var(--gold)" : "var(--neon-red)";
                    const winColor = c.winner === "mandat" ? "var(--cyan)" : c.winner === "lawan" ? "var(--warn-orange)" : "var(--text-muted)";
                    return (
                      <button
                        key={c.id}
                        onClick={() => setContestConstituencyId(c.id)}
                        className="p-3 text-left transition-all"
                        style={{
                          border: `1px solid ${active ? "var(--gold)" : "rgb(var(--cyan-rgb) / 0.18)"}`,
                          background: active ? "rgb(var(--gold-rgb) / 0.08)" : "rgba(255,255,255,0.02)",
                          boxShadow: active ? "0 0 14px rgb(var(--gold-rgb) / 0.2)" : "none",
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[13px] font-bold truncate" style={{ color: active ? "var(--gold)" : "#fff" }}>{c.name}</span>
                          <span className="text-[9px] shrink-0" style={{ color: "#4a5568" }}>{c.code}</span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px]">
                          <span style={{ color: winColor }}>{c.mandat}% {t(lang, "setup_page.support")}</span>
                          <span className="uppercase font-bold" style={{ color: safetyColor }}>{t(lang, c.safety === "safe" ? "setup_page.safetySafe" : c.safety === "marginal" ? "setup_page.safetyMarginal" : "setup_page.safetyDanger")}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </TacticalPanel>

              {contestConstituency && (
                <TacticalPanel title={t(lang, "setup_page.yourCandidacy")} noPadding>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-[10px] text-text-muted tracking-widest">{t(lang, "setup_page.contestingSeat")}</div>
                      <div className="text-[14px] font-bold text-white">{contestConstituency.name} ({contestConstituency.code})</div>
                    </div>
                    <div className="flex gap-6">
                      <div className="text-right">
                        <div className="text-[10px] text-text-muted tracking-widest">{t(lang, "setup_page.support")}</div>
                        <div className="text-[14px] font-bold" style={{ color: "var(--cyan)" }}>{contestConstituency.mandat}%</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-text-muted tracking-widest">{t(lang, "setup_page.safety")}</div>
                        <div
                          className="text-[14px] font-bold"
                          style={{ color: contestConstituency.safety === "safe" ? "var(--neon-green)" : contestConstituency.safety === "marginal" ? "var(--gold)" : "var(--neon-red)" }}
                        >
                          {t(lang, contestConstituency.safety === "safe" ? "setup_page.safetySafe" : contestConstituency.safety === "marginal" ? "setup_page.safetyMarginal" : "setup_page.safetyDanger")}
                        </div>
                      </div>
                    </div>
                  </div>
                </TacticalPanel>
              )}
            </div>
          )}

          {/* Step 2: Campaign Settings */}
          {step === 2 && (
            <div className="space-y-4">
              <TacticalPanel title={t(lang, "setup_page.ideologyPositioning")}>
                <div className="space-y-6">
                  <div className="rounded-sm border border-cyan/15 bg-[var(--bg)]/45 px-3 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[12px] text-text-muted tracking-wider">{t(lang, "setup_page.economicPolicy")}</span>
                      <span className="min-w-9 rounded-sm border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-right text-[12px] text-cyan font-bold">{economicIdeology}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={economicIdeology}
                      onChange={(e) => setEconomicIdeology(Number(e.target.value))}
                      className="w-full h-2 appearance-none cursor-pointer rounded-full"
                      style={{
                        accentColor: "var(--cyan)",
                        background: `linear-gradient(to right, var(--neon-green) 0%, #c7d12e ${economicIdeology}%, var(--bar-empty) ${economicIdeology}%, var(--bar-empty) 100%)`,
                        boxShadow: "0 0 12px rgb(var(--neon-green-rgb,21 128 61) / 0.16)",
                      }}
                    />
                    <div className="mt-2 flex items-center justify-between text-[11px] tracking-wider">
                      <span className="text-neon-green">{t(lang, "setup_page.progressive")}</span>
                      <span className="text-warn-orange">{t(lang, "setup_page.conservative")}</span>
                    </div>
                  </div>

                  <div className="rounded-sm border border-cyan/15 bg-[var(--bg)]/45 px-3 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[12px] text-text-muted tracking-wider">{t(lang, "setup_page.socialStance")}</span>
                      <span className="min-w-9 rounded-sm border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-right text-[12px] text-cyan font-bold">{socialIdeology}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={socialIdeology}
                      onChange={(e) => setSocialIdeology(Number(e.target.value))}
                      className="w-full h-2 appearance-none cursor-pointer rounded-full"
                      style={{
                        accentColor: "var(--cyan)",
                        background: `linear-gradient(to right, var(--neon-green) 0%, #c7d12e ${socialIdeology}%, var(--bar-empty) ${socialIdeology}%, var(--bar-empty) 100%)`,
                        boxShadow: "0 0 12px rgb(var(--neon-green-rgb,21 128 61) / 0.16)",
                      }}
                    />
                    <div className="mt-2 flex items-center justify-between text-[11px] tracking-wider">
                      <span className="text-neon-green">{t(lang, "setup_page.progressive")}</span>
                      <span className="text-warn-orange">{t(lang, "setup_page.traditional")}</span>
                    </div>
                  </div>
                </div>
              </TacticalPanel>

              <TacticalPanel title={t(lang, "setup_page.partyDescription")}>
                <textarea
                  value={partyDesc}
                  onChange={(e) => setPartyDesc(e.target.value)}
                  placeholder={t(lang, "setup_page.describeYourPartySCoreMission")}
                  rows={4}
                  className="w-full resize-none text-[13px]"
                />
              </TacticalPanel>

              <TacticalPanel title={t(lang, "setup_page.electionModePruPrn")}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "pru" as const, state: "unlocked" as const },
                    // "checking" while usePremiumStatus() is still loading —
                    // deliberately distinct from "locked" so this card
                    // doesn't flash 🔒 PREMIUM for an instant before
                    // possibly flipping to unlocked once the real answer
                    // comes back (see the constraint about not flashing the
                    // wrong state).
                    { id: "prn" as const, state: premiumLoading ? "checking" as const : hasPremium ? "unlocked" as const : "locked" as const },
                  ].map((mode) => {
                    const active = electionScope === mode.id;
                    const interactive = mode.state === "unlocked";
                    return (
                      <button
                        key={mode.id}
                        onClick={() => { if (interactive) setElectionScope(mode.id); }}
                        disabled={!interactive}
                        className="relative p-4 text-left transition-all disabled:cursor-not-allowed"
                        style={{
                          border: `1px solid ${active ? "var(--gold)" : "rgb(var(--cyan-rgb) / 0.18)"}`,
                          background: active ? "rgb(var(--gold-rgb) / 0.08)" : "rgba(255,255,255,0.025)",
                          boxShadow: active ? "0 0 16px rgb(var(--gold-rgb) / 0.18)" : "none",
                          opacity: mode.state === "locked" ? 0.55 : mode.state === "checking" ? 0.75 : 1,
                        }}
                      >
                        {mode.state === "locked" && (
                          <span className="absolute right-3 top-3 text-[9px] font-black tracking-widest" style={{ color: "var(--gold)" }}>
                            🔒 {t(lang, "setup_page.premium")}
                          </span>
                        )}
                        {mode.id === "prn" && mode.state === "unlocked" && (
                          <span className="absolute right-3 top-3 text-[9px] font-black tracking-widest" style={{ color: "var(--neon-green)" }}>
                            ✓ {t(lang, "setup_page.unlocked")}
                          </span>
                        )}
                        <div className="text-[13px] font-black tracking-widest" style={{ color: active ? "var(--gold)" : "var(--cyan)" }}>{t(lang, `setup_page.mode_${mode.id}_title`)}</div>
                        <div className="mt-2 text-[11px] leading-relaxed text-text-muted">{t(lang, `setup_page.mode_${mode.id}_sub`)}</div>
                      </button>
                    );
                  })}
                </div>
                {!premiumLoading && !hasPremium && (
                  <div className="mt-3 flex items-center justify-between gap-3 border p-3" style={{ borderColor: "rgb(var(--gold-rgb) / 0.3)", background: "rgb(var(--gold-rgb) / 0.05)" }}>
                    <div className="text-[11px] leading-relaxed text-text-muted">
                      {t(lang, "setup_page.prnModeIsAPremiumFeature")}
                    </div>
                    <UpgradeButton
                      priceId={PREMIUM_PRICE_IDS.prnMode}
                      mode="payment"
                      label={t(lang, "setup_page.unlockPrnMode")}
                    />
                  </div>
                )}
                {electionScope === "prn" && (
                  <div className="mt-4 rounded-sm border border-cyan/15 bg-[var(--bg)]/45 p-3">
                    <div className="mb-2 text-[11px] font-bold tracking-widest text-text-muted">{t(lang, "setup_page.selectPrnState")}</div>
                    <select value={prnStateId} onChange={(e) => setPrnStateId(e.target.value)} className="w-full text-[13px]">
                      {states.filter((state) => state.dunSeats > 0).map((state) => <option key={state.id} value={state.id}>{state.name} · {state.dunSeats} kerusi</option>)}
                    </select>
                    <div className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--gold)" }}>{t(lang, "setup_page.prnModeWillSpotlightThisNegeri")}</div>
                  </div>
                )}
              </TacticalPanel>

              {electionScope !== "prn" && (
                <TacticalPanel title={t(lang, "setup_page.startingRegionFocus")}>
                  <div className="flex gap-6 mt-2">
                    {[
                      { id: "peninsular", val: regionPeninsular, set: setRegionPeninsular },
                      { id: "sabah", val: regionSabah, set: setRegionSabah },
                      { id: "sarawak", val: regionSarawak, set: setRegionSarawak },
                    ].map(({ id, val, set }) => (
                      <label key={id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={val}
                          onChange={(e) => set(e.target.checked)}
                          className="w-4 h-4"
                          style={{ accentColor: "var(--cyan)" }}
                        />
                        <span className="text-[13px] text-text-muted tracking-wider">{t(lang, `setup_page.region_${id}`)}</span>
                      </label>
                    ))}
                  </div>
                </TacticalPanel>
              )}
            </div>
          )}

          {/* Step 4: Difficulty */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {DIFFICULTIES.map((d) => {
                  const isNightmare = d.id === "nightmare";
                  const state = !isNightmare ? "unlocked" : premiumLoading ? "checking" : hasPremium ? "unlocked" : "locked";
                  const interactive = state === "unlocked";
                  return (
                    <button
                      key={d.id}
                      onClick={() => { if (interactive) handleDifficultySelect(d); }}
                      disabled={!interactive}
                      className="relative p-4 text-left transition-all disabled:cursor-not-allowed"
                      style={{
                        background: difficulty === d.id ? "rgb(var(--gold-rgb) / 0.08)" : "rgba(255,255,255,0.02)",
                        border: difficulty === d.id ? "1px solid var(--gold)" : "1px solid var(--bar-empty)",
                        boxShadow: difficulty === d.id ? "0 0 12px rgb(var(--gold-rgb) / 0.2)" : "none",
                        opacity: state === "locked" ? 0.55 : state === "checking" ? 0.75 : 1,
                      }}
                    >
                      {state === "locked" && (
                        <span className="absolute right-3 top-3 text-[9px] font-black tracking-widest" style={{ color: "var(--gold)" }}>
                          🔒 {t(lang, "setup_page.premium")}
                        </span>
                      )}
                      {isNightmare && state === "unlocked" && (
                        <span className="absolute right-3 top-3 text-[9px] font-black tracking-widest" style={{ color: "var(--neon-green)" }}>
                          ✓ {t(lang, "setup_page.unlocked")}
                        </span>
                      )}
                      <div
                        className="text-sm font-bold tracking-widest mb-2"
                        style={{ color: difficulty === d.id ? "var(--gold)" : "#ffffff" }}
                      >
                        {t(lang, `setup_page.difficulty_${d.id}_label`)}
                      </div>
                      <div className="text-[12px] text-text-muted mb-3 leading-relaxed">{t(lang, `setup_page.difficulty_${d.id}_desc`)}</div>
                      <div className="space-y-1.5">
                        <div>
                          <div className="text-[11px] text-text-muted mb-0.5">{t(lang, "setup_page.oppositionStr")}</div>
                          <StatBar label="" value={d.opp} color="var(--neon-red)" animate={false} size="sm" />
                        </div>
                        <div>
                          <div className="text-[11px] text-text-muted mb-0.5">{t(lang, "setup_page.mediaChallenge")}</div>
                          <StatBar label="" value={d.media} color="var(--warn-orange)" animate={false} size="sm" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {!premiumLoading && !hasPremium && (
                <div className="flex items-center justify-between gap-3 border p-3" style={{ borderColor: "rgb(var(--gold-rgb) / 0.3)", background: "rgb(var(--gold-rgb) / 0.05)" }}>
                  <div className="text-[11px] leading-relaxed text-text-muted">
                    {t(lang, "setup_page.nightmareDifficultyIsAPremiumFeature")}
                  </div>
                  <UpgradeButton
                    priceId={PREMIUM_PRICE_IDS.premiumMonthly}
                    mode="subscription"
                    label={t(lang, "setup_page.getPremium")}
                  />
                </div>
              )}

              <TacticalPanel title={t(lang, "setup_page.fineTuning")}>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] text-text-muted tracking-wider">{t(lang, "setup_page.oppositionStrength")}</span>
                      <span className="text-[12px] text-neon-red font-bold">{oppStrength}%</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={99}
                      value={oppStrength}
                      onChange={(e) => setOppStrength(Number(e.target.value))}
                      className="range-red w-full h-2 appearance-none cursor-pointer rounded-full"
                      style={{
                        accentColor: "var(--neon-red)",
                        background: `linear-gradient(to right, var(--neon-red) 0%, var(--neon-red) ${oppSliderPct}%, var(--bar-empty) ${oppSliderPct}%, var(--bar-empty) 100%)`,
                        boxShadow: "0 0 14px rgb(255 68 68 / 0.22)",
                      }}
                    />
                  </div>

                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-2">{t(lang, "setup_page.mediaBias")}</div>
                    <div className="flex gap-2">
                      {MEDIA_OPTIONS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setMediaBias(m.id)}
                          className="flex-1 py-1.5 text-[12px] tracking-wider transition-all"
                          style={{
                            background: mediaBias === m.id ? (m.id === "PRO-MANDAT" ? "rgb(var(--neon-green-rgb,21 128 61) / 0.15)" : m.id === "HOSTILE" ? "rgb(255 68 68 / 0.15)" : "rgb(var(--cyan-rgb) / 0.15)") : "transparent",
                            color: mediaBias === m.id ? (m.id === "PRO-MANDAT" ? "var(--neon-green)" : m.id === "HOSTILE" ? "var(--neon-red)" : "var(--cyan)") : "var(--text-muted)",
                            border: "1px solid",
                            borderColor: mediaBias === m.id ? (m.id === "PRO-MANDAT" ? "var(--neon-green)" : m.id === "HOSTILE" ? "var(--neon-red)" : "var(--cyan)") : "var(--bar-empty)",
                          }}
                        >
                          {t(lang, `setup_page.media_${m.id}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-8 pt-2">
                    <Toggle value={eventRandomness} onChange={setEventRandomness} label={t(lang, "setup_page.eventRandomness")} />
                    <Toggle value={permanentConsequences} onChange={setPermanentConsequences} label={t(lang, "setup_page.permanentConsequences")} />
                  </div>
                </div>
              </TacticalPanel>
            </div>
          )}

          {/* Step 5: Confirm */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <TacticalPanel title={t(lang, "setup_page.leaderProfile")}>
                  <div className="space-y-2">
                    <div className="flex justify-center mb-3">
                      <div style={{ position: "relative", width: "80px", height: "80px", border: "2px solid var(--cyan)", overflow: "hidden", background: "var(--bg)" }}>
                        <Image src={AVATARS[avatarIndex].src} alt={t(lang, "setup_page.avatar3")} fill sizes="80px" style={{ objectFit: "cover" }} />
                      </div>
                    </div>
                    <SummaryRow label={t(lang, "setup_page.name")} value={leaderName} />
                    <SummaryRow label={t(lang, "setup_page.position")} value={t(lang, `setup_page.position_${position}`)} />
                    <SummaryRow label={t(lang, "setup_page.experience")} value={t(lang, `setup_page.experience_${experience}`)} />
                    <SummaryRow label={t(lang, "setup_page.homeState")} value={states.find((s) => s.id === homeState)?.name || homeState} />
                    <SummaryRow label={t(lang, "setup_page.contestingSeat")} value={contestConstituency ? `${contestConstituency.name} (${contestConstituency.code})` : "—"} />
                  </div>
                </TacticalPanel>

                <TacticalPanel title={t(lang, "setup_page.partyIdentity")}>
                  <div className="space-y-2">
                    <div
                      className="flex items-center justify-center h-12 text-2xl font-bold mb-3"
                      style={{ background: "var(--bg)", border: `2px solid ${partyColor}`, color: partyColor }}
                    >
                      {partyAbbr[0] || "M"}
                    </div>
                    <SummaryRow label={t(lang, "setup_page.name")} value={partyName} />
                    <SummaryRow label={t(lang, "setup_page.abbr")} value={partyAbbr} />
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-text-muted tracking-wider">{t(lang, "setup_page.color")}</span>
                      <div className="w-5 h-5" style={{ background: partyColor }} />
                    </div>
                  </div>
                </TacticalPanel>

                <TacticalPanel title={t(lang, "setup_page.gameSettings")}>
                  <div className="space-y-2">
                    <SummaryRow label={t(lang, "setup_page.dataMode")} value={t(lang, selectedDataset === "real-malaysia" ? "setup_page.dataModeReal" : "setup_page.dataModeFictional")} />
                    <SummaryRow label={t(lang, "setup_page.electionMode")} value={electionScope === "prn" ? `PRN · ${states.find((s) => s.id === prnStateId)?.name ?? prnStateId}` : t(lang, "setup_page.pruNational")} />
                    <SummaryRow label={t(lang, "setup_page.difficulty")} value={t(lang, `setup_page.difficulty_${difficulty}_label`)} />
                    <SummaryRow label={t(lang, "setup_page.oppStrength")} value={`${oppStrength}%`} />
                    <SummaryRow label={t(lang, "setup_page.mediaBias")} value={t(lang, `setup_page.media_${mediaBias}`)} />
                    <SummaryRow label={t(lang, "setup_page.randomness")} value={t(lang, eventRandomness ? "setup_page.toggleOn" : "setup_page.toggleOff")} />
                    <SummaryRow label={t(lang, "setup_page.permEffects")} value={t(lang, permanentConsequences ? "setup_page.toggleOn" : "setup_page.toggleOff")} />
                  </div>
                </TacticalPanel>
              </div>

              <TacticalPanel title={t(lang, "setup_page.attributeSummary")}>
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { id: "influence", val: influence, color: "var(--cyan)" },
                    { id: "charisma", val: charisma, color: "var(--gold)" },
                    { id: "credibility", val: credibility, color: "var(--neon-green)" },
                    { id: "negotiation", val: negotiation, color: "var(--warn-orange)" },
                    { id: "strategy", val: strategy, color: "#8b5cf6" },
                  ].map(({ id, val, color }) => (
                    <div key={id} className="text-center">
                      <div className="text-2xl font-bold" style={{ color }}>{val}</div>
                      <div className="text-[11px] text-text-muted mt-1">{t(lang, `setup_page.attr_${id}`)}</div>
                    </div>
                  ))}
                </div>
              </TacticalPanel>

              <button
                onClick={handleLaunch}
                disabled={isLaunching}
                className="w-full py-4 text-sm font-bold tracking-[0.2em] uppercase transition-all disabled:opacity-60 disabled:cursor-wait"
                style={{
                  background: "var(--gold)",
                  color: "#000000",
                  fontFamily: "Space Mono, monospace",
                  boxShadow: "0 0 20px rgb(var(--gold-rgb) / 0.4)",
                }}
              >
                {isLaunching ? t(lang, "setup_page.loading") : t(lang, "setup_page.launchCampaign")}
              </button>
            </div>
          )}

          {/* Navigation — fixed above HUD so bottom controls are never hidden by the status/music overlays */}
          <div
            className="fixed left-0 right-0 z-[70] px-4 py-3"
            style={{
              bottom: "36px",
              background: "linear-gradient(180deg, rgba(8,12,20,0.82), var(--bg))",
              borderTop: "1px solid rgb(var(--cyan-rgb) / 0.18)",
            }}
          >
            <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between">
              <button
                onClick={handleBack}
                disabled={step === 0}
                className="px-6 py-2 text-[13px] tracking-widest uppercase transition-all disabled:opacity-30"
                style={{
                  border: "1px solid var(--gold)",
                  color: "var(--gold)",
                  background: "transparent",
                  fontFamily: "Space Mono, monospace",
                  cursor: step === 0 ? "not-allowed" : "pointer",
                }}
              >
                {t(lang, "setup_page.back")}
              </button>

              <div className="text-[12px] text-text-muted tracking-wider">
                {t(lang, "setup_page.step6", { step: step + 1 })}
              </div>

              {step < 5 ? (
                <button
                  onClick={handleNext}
                  className="px-6 py-2 text-[13px] tracking-widest uppercase transition-all"
                  style={{
                    background: "var(--gold)",
                    color: "#000000",
                    fontFamily: "Space Mono, monospace",
                  }}
                >
                  {t(lang, "setup_page.next")}
                </button>
              ) : (
                <button
                  onClick={handleLaunch}
                  disabled={isLaunching}
                  className="px-6 py-2 text-[13px] font-bold tracking-widest uppercase transition-all disabled:opacity-60 disabled:cursor-wait"
                  style={{
                    background: "var(--gold)",
                    color: "#000000",
                    fontFamily: "Space Mono, monospace",
                    boxShadow: "0 0 16px rgb(var(--gold-rgb) / 0.35)",
                  }}
                >
                  {isLaunching ? t(lang, "setup_page.loading") : t(lang, "setup_page.launch")}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
      <StatusBar />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 border-b border-white/5">
      <span className="text-[12px] text-text-muted tracking-wider">{label}</span>
      <span className="text-[12px] text-white font-bold">{value}</span>
    </div>
  );
}
