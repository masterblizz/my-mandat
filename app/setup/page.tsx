"use client";
import { useEffect, useMemo, useState } from "react";
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
  { id: "PRESIDENT", ms: "PRESIDEN", en: "PRESIDENT" },
  { id: "SECRETARY GENERAL", ms: "SETIAUSAHA AGUNG", en: "SECRETARY GENERAL" },
  { id: "CHAIRMAN", ms: "PENGERUSI", en: "CHAIRMAN" },
  { id: "DEPUTY PRESIDENT", ms: "TIMBALAN PRESIDEN", en: "DEPUTY PRESIDENT" },
];
const EXPERIENCE_OPTIONS = [
  { id: "veteran", ms: "VETERAN", en: "VETERAN" },
  { id: "moderate", ms: "SEDERHANA", en: "MODERATE" },
  { id: "rookie", ms: "PEMULA", en: "ROOKIE" },
] as const;
const DIFFICULTIES = [
  { id: "easy", labelMS: "MUDAH", labelEN: "EASY", descMS: "Untuk pemula. Pembangkang lembut, media memihak.", descEN: "For first-timers. Relaxed opposition, favorable media.", opp: 40, media: 30 },
  { id: "normal", labelMS: "NORMAL", labelEN: "NORMAL", descMS: "Cabaran seimbang. Persaingan adil.", descEN: "Balanced challenge. Fair competition.", opp: 60, media: 50 },
  { id: "hard", labelMS: "SUKAR", labelEN: "HARD", descMS: "Pembangkang tangguh, media berat sebelah.", descEN: "Tough opposition, biased media.", opp: 80, media: 70 },
  { id: "nightmare", labelMS: "MIMPI NGERI", labelEN: "NIGHTMARE", descMS: "Cabaran maksimum. Semua menentang anda.", descEN: "Maximum challenge. Everything against you.", opp: 95, media: 90 },
] as const;
const MEDIA_OPTIONS = [
  { id: "PRO-MANDAT", ms: "PRO-MANDAT", en: "PRO-MANDAT" },
  { id: "BALANCED", ms: "SEIMBANG", en: "BALANCED" },
  { id: "HOSTILE", ms: "BERMUSUHAN", en: "HOSTILE" },
] as const;
const TOTAL_POINTS = 450;
const AVATARS = [
  { src: "/avatars/leader-01.png", ms: "AHLI STRATEGI BANDAR", en: "URBAN STRATEGIST" },
  { src: "/avatars/leader-02.png", ms: "DIPLOMAT REFORMASI", en: "REFORM DIPLOMAT" },
  { src: "/avatars/leader-03.png", ms: "TEKNOKRAT DASAR", en: "POLICY TECHNOCRAT" },
  { src: "/avatars/leader-04.png", ms: "PENGANJUR AKAR UMBI", en: "GRASSROOTS ORGANISER" },
  { src: "/avatars/leader-05.png", ms: "NEGARAWAN KANAN", en: "SENIOR STATESMAN" },
];

const STEPS = [
  { num: "00", labelMS: "MOD DATA", labelEN: "DATA MODE" },
  { num: "01", labelMS: "AVATAR & PARTI", labelEN: "AVATAR & PARTY" },
  { num: "02", labelMS: "TETAPAN KEMPEN", labelEN: "CAMPAIGN SETTINGS" },
  { num: "03", labelMS: "PENCALONAN", labelEN: "NOMINATION" },
  { num: "04", labelMS: "KESUKARAN", labelEN: "DIFFICULTY" },
  { num: "05", labelMS: "SAHKAN", labelEN: "CONFIRM" },
];

export default function SetupPage() {
  const lang = useLang();
  const { isPending: isLaunching, navigate } = usePendingNav();
  const { setLeader, setNomination, setPhase, updateSettings, setDataset, setSelectedState, resetGame, settings } = useGameStore();
  const { hasPremium } = usePremiumStatus();

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
                  {t(lang, s.labelMS, s.labelEN)}
                </div>
              </button>
            ))}
          </div>

          {/* Step 0: Data Mode */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <div className="text-[13px] text-text-muted tracking-widest uppercase">
                  {t(lang, "Pilih nama dan parti politik yang muncul dalam kempen anda", "Choose which political names & parties appear in your campaign")}
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
                          {t(lang, "DIPILIH", "SELECTED")}
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
                            {t(lang, `+ ${ds.parties.length - 4} parti lagi`, `+ ${ds.parties.length - 4} more parties`)}
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
              <TacticalPanel title={t(lang, "AVATAR", "AVATAR")} className="w-[220px] shrink-0">
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
                      className="overflow-hidden rounded-full"
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
                      <img
                        src={AVATARS[avatarIndex].src}
                        alt={t(lang, `Avatar ${AVATARS[avatarIndex].ms}`, `${AVATARS[avatarIndex].en} avatar`)}
                        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.06)" }}
                      />
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[11px] tracking-[0.28em]" style={{ color: "var(--cyan)" }}>
                      {t(lang, "AVATAR DIPILIH", "SELECTED AVATAR")}
                    </div>
                    <div
                      className="mt-1 inline-flex px-2 py-1 text-[10px] font-bold tracking-wider"
                      style={{
                        color: "var(--gold)",
                        border: "1px solid rgb(var(--gold-rgb) / 0.35)",
                        background: "rgb(var(--gold-rgb) / 0.08)",
                      }}
                    >
                      {t(lang, AVATARS[avatarIndex].ms, AVATARS[avatarIndex].en)}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2.5 w-full pt-1" aria-label={t(lang, "Pilih avatar", "Choose avatar")}>
                    {AVATARS.map((avatar, i) => {
                      const selected = avatarIndex === i;
                      return (
                        <button
                          key={avatar.src}
                          type="button"
                          onClick={() => setAvatarIndex(i)}
                          aria-label={t(lang, `Pilih ${avatar.ms}`, `Select ${avatar.en}`)}
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
                          <img
                            src={avatar.src}
                            alt=""
                            aria-hidden="true"
                            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.08)" }}
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
              <TacticalPanel title={t(lang, "BUTIRAN PEMIMPIN", "LEADER DETAILS")} className="flex-1">
                <div className="space-y-3">
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">{t(lang, "NAMA", "NAME")}</div>
                    <input
                      type="text"
                      value={leaderName}
                      onChange={(e) => setLeaderName(e.target.value.toUpperCase())}
                      className="w-full uppercase"
                      placeholder={t(lang, "MASUKKAN NAMA", "ENTER NAME")}
                    />
                  </div>
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">{t(lang, "JAWATAN", "POSITION")}</div>
                    <select
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="w-full"
                    >
                      {POSITIONS.map((p) => (
                        <option key={p.id} value={p.id}>{t(lang, p.ms, p.en)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">{t(lang, "PENGALAMAN", "EXPERIENCE")}</div>
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
                          {t(lang, opt.ms, opt.en)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">{t(lang, "NEGERI ASAL", "HOME STATE")}</div>
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
                      <div className="text-[12px] text-text-muted tracking-wider">{t(lang, "ATRIBUT PEMIMPIN", "LEADER ATTRIBUTES")}</div>
                      <div
                        className="text-[12px] font-bold"
                        style={{ color: pointsRemaining < 0 ? "var(--neon-red)" : "var(--neon-green)" }}
                      >
                        {t(lang, `${pointsRemaining} MATA BERBAKI`, `${pointsRemaining} PTS REMAINING`)}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { labelMS: "PENGARUH", labelEN: "INFLUENCE", val: influence, set: setInfluence },
                        { labelMS: "KARISMA", labelEN: "CHARISMA", val: charisma, set: setCharisma },
                        { labelMS: "KREDIBILITI", labelEN: "CREDIBILITY", val: credibility, set: setCredibility },
                        { labelMS: "RUNDINGAN", labelEN: "NEGOTIATION", val: negotiation, set: setNegotiation },
                        { labelMS: "STRATEGI", labelEN: "STRATEGY", val: strategy, set: setStrategy },
                      ].map(({ labelMS, labelEN, val, set }) => (
                        <div key={labelEN} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-text-muted">{t(lang, labelMS, labelEN)}</span>
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
              <TacticalPanel title={t(lang, "IDENTITI PARTI", "PARTY IDENTITY")} className="w-[200px] shrink-0">
                <div className="space-y-3">
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">{t(lang, "PARTI SET DATA", "DATASET PARTY")}</div>
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
                      {t(lang, `Identiti parti dikunci pada set data dipilih: ${currentDataset.labelMS ?? currentDataset.label}`, `Party identity locked to selected dataset: ${currentDataset.label}`)}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <div className="border px-3 py-2" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.14)", background: "rgba(255,255,255,0.025)" }}>
                      <div className="text-[9px] text-text-muted tracking-[0.18em]">{t(lang, "NAMA PARTI", "PARTY NAME")}</div>
                      <div className="mt-1 text-[11px] font-bold leading-4 text-white">{partyName}</div>
                    </div>
                    <div className="border px-3 py-2" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.14)", background: "rgba(255,255,255,0.025)" }}>
                      <div className="text-[9px] text-text-muted tracking-[0.18em]">{t(lang, "SINGKATAN", "ABBREVIATION")}</div>
                      <div className="mt-1 text-[13px] font-black" style={{ color: partyColor }}>{partyAbbr}</div>
                    </div>
                  </div>
                  {/* Logo Preview */}
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-2">{t(lang, "PRATONTON LOGO", "LOGO PREVIEW")}</div>
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
              <TacticalPanel title={electionScope === "prn" ? t(lang, "BERTANDING KERUSI DUN", "CONTEST YOUR DUN SEAT") : t(lang, "BERTANDING KERUSI SENDIRI", "CONTEST YOUR OWN SEAT")}>
                <div className="text-[13px] text-text-muted leading-relaxed mb-3">
                  {electionScope === "prn"
                    ? t(lang,
                        `Sebagai ${POSITIONS.find((p) => p.id === position)?.ms.toLowerCase() ?? position.toLowerCase()} ${partyName || "parti anda"}, anda juga perlu dicalonkan untuk kerusi DUN seperti calon lain. Pilih kawasan DUN mana di ${prnStateData?.name ?? prnStateId.toUpperCase()} yang anda akan bertanding secara peribadi — ini akan menjadi kawasan anda di Peta Bandar 3D.`,
                        `As ${position.toLowerCase()} of ${partyName || "your party"}, you must be nominated for a DUN seat like any other candidate. Choose which DUN constituency in ${prnStateData?.name ?? prnStateId.toUpperCase()} you will personally contest — this becomes your kawasan in the 3D City Map.`)
                    : t(lang,
                        `Sebagai ${POSITIONS.find((p) => p.id === position)?.ms.toLowerCase() ?? position.toLowerCase()} ${partyName || "parti anda"}, anda juga perlu dicalonkan untuk kerusi seperti calon lain. Pilih kawasan mana di ${homeStateData?.name ?? homeState.toUpperCase()} yang anda akan bertanding secara peribadi.`,
                        `As ${position.toLowerCase()} of ${partyName || "your party"}, you must be nominated for a parliamentary seat like any other candidate. Choose which constituency in ${homeStateData?.name ?? homeState.toUpperCase()} you will personally contest.`)}
                </div>
                <div className="grid grid-cols-3 gap-3" style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {homeConstituencies.map((c) => {
                    const active = contestConstituencyId === c.id;
                    const safetyColor = c.safety === "safe" ? "var(--neon-green)" : c.safety === "marginal" ? "var(--gold)" : "var(--neon-red)";
                    const winColor = c.winner === "mandat" ? "var(--cyan)" : c.winner === "lawan" ? "var(--warn-orange)" : "var(--text-muted)";
                    const safetyMS = c.safety === "safe" ? "SELAMAT" : c.safety === "marginal" ? "MARGINAL" : "BAHAYA";
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
                          <span style={{ color: winColor }}>{c.mandat}% {t(lang, "SOKONGAN", "SUPPORT")}</span>
                          <span className="uppercase font-bold" style={{ color: safetyColor }}>{t(lang, safetyMS, c.safety)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </TacticalPanel>

              {contestConstituency && (
                <TacticalPanel title={t(lang, "PENCALONAN ANDA", "YOUR CANDIDACY")} noPadding>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-[10px] text-text-muted tracking-widest">{t(lang, "KERUSI DIPERTANDINGKAN", "CONTESTING SEAT")}</div>
                      <div className="text-[14px] font-bold text-white">{contestConstituency.name} ({contestConstituency.code})</div>
                    </div>
                    <div className="flex gap-6">
                      <div className="text-right">
                        <div className="text-[10px] text-text-muted tracking-widest">{t(lang, "SOKONGAN", "SUPPORT")}</div>
                        <div className="text-[14px] font-bold" style={{ color: "var(--cyan)" }}>{contestConstituency.mandat}%</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-text-muted tracking-widest">{t(lang, "KESELAMATAN", "SAFETY")}</div>
                        <div
                          className="text-[14px] font-bold"
                          style={{ color: contestConstituency.safety === "safe" ? "var(--neon-green)" : contestConstituency.safety === "marginal" ? "var(--gold)" : "var(--neon-red)" }}
                        >
                          {t(lang, contestConstituency.safety === "safe" ? "SELAMAT" : contestConstituency.safety === "marginal" ? "MARGINAL" : "BAHAYA", contestConstituency.safety.toUpperCase())}
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
              <TacticalPanel title={t(lang, "KEDUDUKAN IDEOLOGI", "IDEOLOGY POSITIONING")}>
                <div className="space-y-6">
                  <div className="rounded-sm border border-cyan/15 bg-[var(--bg)]/45 px-3 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[12px] text-text-muted tracking-wider">{t(lang, "DASAR EKONOMI", "ECONOMIC POLICY")}</span>
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
                      <span className="text-neon-green">{t(lang, "← PROGRESIF", "← PROGRESSIVE")}</span>
                      <span className="text-warn-orange">{t(lang, "KONSERVATIF →", "CONSERVATIVE →")}</span>
                    </div>
                  </div>

                  <div className="rounded-sm border border-cyan/15 bg-[var(--bg)]/45 px-3 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[12px] text-text-muted tracking-wider">{t(lang, "PENDIRIAN SOSIAL", "SOCIAL STANCE")}</span>
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
                      <span className="text-neon-green">{t(lang, "← PROGRESIF", "← PROGRESSIVE")}</span>
                      <span className="text-warn-orange">{t(lang, "TRADISIONAL →", "TRADITIONAL →")}</span>
                    </div>
                  </div>
                </div>
              </TacticalPanel>

              <TacticalPanel title={t(lang, "PENERANGAN PARTI", "PARTY DESCRIPTION")}>
                <textarea
                  value={partyDesc}
                  onChange={(e) => setPartyDesc(e.target.value)}
                  placeholder={t(lang, "Terangkan misi dan nilai teras parti anda...", "Describe your party's core mission and values...")}
                  rows={4}
                  className="w-full resize-none text-[13px]"
                />
              </TacticalPanel>

              <TacticalPanel title={t(lang, "MOD PILIHAN RAYA — PRU / PRN", "ELECTION MODE — PRU / PRN")}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "pru" as const, titleMS: "PRU — PILIHAN RAYA UMUM", titleEN: "PRU — PILIHAN RAYA UMUM", subMS: "Kempen parlimen kebangsaan · semua kerusi Malaysia · bentuk kerajaan persekutuan", subEN: "National parliamentary campaign · all Malaysia seats · form federal government", locked: false },
                    { id: "prn" as const, titleMS: "PRN — PILIHAN RAYA NEGERI", titleEN: "PRN — PILIHAN RAYA NEGERI", subMS: "Kempen pilihan raya negeri · fokus satu negeri · naratif MB/kerajaan negeri", subEN: "State election campaign · focus one negeri · MB/state-government narrative", locked: !hasPremium },
                  ].map((mode) => {
                    const active = electionScope === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => { if (!mode.locked) setElectionScope(mode.id); }}
                        disabled={mode.locked}
                        className="relative p-4 text-left transition-all disabled:cursor-not-allowed"
                        style={{
                          border: `1px solid ${active ? "var(--gold)" : "rgb(var(--cyan-rgb) / 0.18)"}`,
                          background: active ? "rgb(var(--gold-rgb) / 0.08)" : "rgba(255,255,255,0.025)",
                          boxShadow: active ? "0 0 16px rgb(var(--gold-rgb) / 0.18)" : "none",
                          opacity: mode.locked ? 0.55 : 1,
                        }}
                      >
                        {mode.locked && (
                          <span className="absolute right-3 top-3 text-[9px] font-black tracking-widest" style={{ color: "var(--gold)" }}>
                            🔒 {t(lang, "PREMIUM", "PREMIUM")}
                          </span>
                        )}
                        <div className="text-[13px] font-black tracking-widest" style={{ color: active ? "var(--gold)" : "var(--cyan)" }}>{t(lang, mode.titleMS, mode.titleEN)}</div>
                        <div className="mt-2 text-[11px] leading-relaxed text-text-muted">{t(lang, mode.subMS, mode.subEN)}</div>
                      </button>
                    );
                  })}
                </div>
                {!hasPremium && (
                  <div className="mt-3 flex items-center justify-between gap-3 border p-3" style={{ borderColor: "rgb(var(--gold-rgb) / 0.3)", background: "rgb(var(--gold-rgb) / 0.05)" }}>
                    <div className="text-[11px] leading-relaxed text-text-muted">
                      {t(lang, "Mod PRN adalah ciri Premium — beli sekali untuk buka selamanya.", "PRN mode is a Premium feature — buy once to unlock it permanently.")}
                    </div>
                    <UpgradeButton
                      priceId={PREMIUM_PRICE_IDS.prnMode}
                      mode="payment"
                      label={t(lang, "BUKA MOD PRN", "UNLOCK PRN MODE")}
                    />
                  </div>
                )}
                {electionScope === "prn" && (
                  <div className="mt-4 rounded-sm border border-cyan/15 bg-[var(--bg)]/45 p-3">
                    <div className="mb-2 text-[11px] font-bold tracking-widest text-text-muted">{t(lang, "PILIH NEGERI PRN", "SELECT PRN STATE")}</div>
                    <select value={prnStateId} onChange={(e) => setPrnStateId(e.target.value)} className="w-full text-[13px]">
                      {states.filter((state) => state.dunSeats > 0).map((state) => <option key={state.id} value={state.id}>{state.name} · {state.dunSeats} kerusi</option>)}
                    </select>
                    <div className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--gold)" }}>{t(lang, "Mod PRN akan menyorot negeri ini dalam bilik perang, isu negeri, dan taklimat peta taktikal.", "PRN mode will spotlight this negeri in the war room, state issues, and tactical map briefing.")}</div>
                  </div>
                )}
              </TacticalPanel>

              <TacticalPanel title={t(lang, "FOKUS REGIUN PERMULAAN", "STARTING REGION FOCUS")}>
                <div className="flex gap-6 mt-2">
                  {[
                    { labelMS: "SEMENANJUNG MALAYSIA", labelEN: "PENINSULAR MALAYSIA", val: regionPeninsular, set: setRegionPeninsular },
                    { labelMS: "SABAH", labelEN: "SABAH", val: regionSabah, set: setRegionSabah },
                    { labelMS: "SARAWAK", labelEN: "SARAWAK", val: regionSarawak, set: setRegionSarawak },
                  ].map(({ labelMS, labelEN, val, set }) => (
                    <label key={labelEN} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => set(e.target.checked)}
                        className="w-4 h-4"
                        style={{ accentColor: "var(--cyan)" }}
                      />
                      <span className="text-[13px] text-text-muted tracking-wider">{t(lang, labelMS, labelEN)}</span>
                    </label>
                  ))}
                </div>
              </TacticalPanel>
            </div>
          )}

          {/* Step 4: Difficulty */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {DIFFICULTIES.map((d) => {
                  const locked = d.id === "nightmare" && !hasPremium;
                  return (
                    <button
                      key={d.id}
                      onClick={() => { if (!locked) handleDifficultySelect(d); }}
                      disabled={locked}
                      className="relative p-4 text-left transition-all disabled:cursor-not-allowed"
                      style={{
                        background: difficulty === d.id ? "rgb(var(--gold-rgb) / 0.08)" : "rgba(255,255,255,0.02)",
                        border: difficulty === d.id ? "1px solid var(--gold)" : "1px solid var(--bar-empty)",
                        boxShadow: difficulty === d.id ? "0 0 12px rgb(var(--gold-rgb) / 0.2)" : "none",
                        opacity: locked ? 0.55 : 1,
                      }}
                    >
                      {locked && (
                        <span className="absolute right-3 top-3 text-[9px] font-black tracking-widest" style={{ color: "var(--gold)" }}>
                          🔒 {t(lang, "PREMIUM", "PREMIUM")}
                        </span>
                      )}
                      <div
                        className="text-sm font-bold tracking-widest mb-2"
                        style={{ color: difficulty === d.id ? "var(--gold)" : "#ffffff" }}
                      >
                        {t(lang, d.labelMS, d.labelEN)}
                      </div>
                      <div className="text-[12px] text-text-muted mb-3 leading-relaxed">{t(lang, d.descMS, d.descEN)}</div>
                      <div className="space-y-1.5">
                        <div>
                          <div className="text-[11px] text-text-muted mb-0.5">{t(lang, "KEKUATAN PEMBANGKANG", "OPPOSITION STR.")}</div>
                          <StatBar label="" value={d.opp} color="var(--neon-red)" animate={false} size="sm" />
                        </div>
                        <div>
                          <div className="text-[11px] text-text-muted mb-0.5">{t(lang, "CABARAN MEDIA", "MEDIA CHALLENGE")}</div>
                          <StatBar label="" value={d.media} color="var(--warn-orange)" animate={false} size="sm" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {!hasPremium && (
                <div className="flex items-center justify-between gap-3 border p-3" style={{ borderColor: "rgb(var(--gold-rgb) / 0.3)", background: "rgb(var(--gold-rgb) / 0.05)" }}>
                  <div className="text-[11px] leading-relaxed text-text-muted">
                    {t(lang, "Kesukaran Mimpi Ngeri adalah ciri Premium.", "Nightmare difficulty is a Premium feature.")}
                  </div>
                  <UpgradeButton
                    priceId={PREMIUM_PRICE_IDS.premiumMonthly}
                    mode="subscription"
                    label={t(lang, "DAPATKAN PREMIUM", "GET PREMIUM")}
                  />
                </div>
              )}

              <TacticalPanel title={t(lang, "PENALAAN HALUS", "FINE TUNING")}>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] text-text-muted tracking-wider">{t(lang, "KEKUATAN PEMBANGKANG", "OPPOSITION STRENGTH")}</span>
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
                    <div className="text-[12px] text-text-muted tracking-wider mb-2">{t(lang, "BIAS MEDIA", "MEDIA BIAS")}</div>
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
                          {t(lang, m.ms, m.en)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-8 pt-2">
                    <Toggle value={eventRandomness} onChange={setEventRandomness} label={t(lang, "KERAWAKAN PERISTIWA", "EVENT RANDOMNESS")} />
                    <Toggle value={permanentConsequences} onChange={setPermanentConsequences} label={t(lang, "KESAN KEKAL", "PERMANENT CONSEQUENCES")} />
                  </div>
                </div>
              </TacticalPanel>
            </div>
          )}

          {/* Step 5: Confirm */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <TacticalPanel title={t(lang, "PROFIL PEMIMPIN", "LEADER PROFILE")}>
                  <div className="space-y-2">
                    <div className="flex justify-center mb-3">
                      <div style={{ width: "80px", height: "80px", border: "2px solid var(--cyan)", overflow: "hidden", background: "var(--bg)" }}>
                        <img src={AVATARS[avatarIndex].src} alt={t(lang, "Avatar", "Avatar")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    </div>
                    <SummaryRow label={t(lang, "NAMA", "NAME")} value={leaderName} />
                    <SummaryRow label={t(lang, "JAWATAN", "POSITION")} value={t(lang, POSITIONS.find((p) => p.id === position)?.ms ?? position, position)} />
                    <SummaryRow label={t(lang, "PENGALAMAN", "EXPERIENCE")} value={t(lang, EXPERIENCE_OPTIONS.find((e) => e.id === experience)?.ms ?? experience.toUpperCase(), experience.toUpperCase())} />
                    <SummaryRow label={t(lang, "NEGERI ASAL", "HOME STATE")} value={states.find((s) => s.id === homeState)?.name || homeState} />
                    <SummaryRow label={t(lang, "KERUSI DIPERTANDINGKAN", "CONTESTING SEAT")} value={contestConstituency ? `${contestConstituency.name} (${contestConstituency.code})` : "—"} />
                  </div>
                </TacticalPanel>

                <TacticalPanel title={t(lang, "IDENTITI PARTI", "PARTY IDENTITY")}>
                  <div className="space-y-2">
                    <div
                      className="flex items-center justify-center h-12 text-2xl font-bold mb-3"
                      style={{ background: "var(--bg)", border: `2px solid ${partyColor}`, color: partyColor }}
                    >
                      {partyAbbr[0] || "M"}
                    </div>
                    <SummaryRow label={t(lang, "NAMA", "NAME")} value={partyName} />
                    <SummaryRow label={t(lang, "SINGKATAN", "ABBR")} value={partyAbbr} />
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-text-muted tracking-wider">{t(lang, "WARNA", "COLOR")}</span>
                      <div className="w-5 h-5" style={{ background: partyColor }} />
                    </div>
                  </div>
                </TacticalPanel>

                <TacticalPanel title={t(lang, "TETAPAN PERMAINAN", "GAME SETTINGS")}>
                  <div className="space-y-2">
                    <SummaryRow label={t(lang, "MOD DATA", "DATA MODE")} value={t(lang, selectedDataset === "real-malaysia" ? "MALAYSIA SEBENAR" : "FIKSYEN", selectedDataset === "real-malaysia" ? "REAL MALAYSIA" : "FICTIONAL")} />
                    <SummaryRow label={t(lang, "MOD PILIHAN RAYA", "ELECTION MODE")} value={electionScope === "prn" ? `PRN · ${states.find((s) => s.id === prnStateId)?.name ?? prnStateId}` : t(lang, "PRU · KEBANGSAAN", "PRU · NATIONAL")} />
                    <SummaryRow label={t(lang, "KESUKARAN", "DIFFICULTY")} value={t(lang, DIFFICULTIES.find((d) => d.id === difficulty)?.labelMS ?? difficulty.toUpperCase(), difficulty.toUpperCase())} />
                    <SummaryRow label={t(lang, "KEKUATAN PEMBANGKANG", "OPP. STRENGTH")} value={`${oppStrength}%`} />
                    <SummaryRow label={t(lang, "BIAS MEDIA", "MEDIA BIAS")} value={t(lang, MEDIA_OPTIONS.find((m) => m.id === mediaBias)?.ms ?? mediaBias, mediaBias)} />
                    <SummaryRow label={t(lang, "KERAWAKAN", "RANDOMNESS")} value={t(lang, eventRandomness ? "HIDUP" : "MATI", eventRandomness ? "ON" : "OFF")} />
                    <SummaryRow label={t(lang, "KESAN KEKAL", "PERM. EFFECTS")} value={t(lang, permanentConsequences ? "HIDUP" : "MATI", permanentConsequences ? "ON" : "OFF")} />
                  </div>
                </TacticalPanel>
              </div>

              <TacticalPanel title={t(lang, "RINGKASAN ATRIBUT", "ATTRIBUTE SUMMARY")}>
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { labelMS: "PENGARUH", labelEN: "INFLUENCE", val: influence, color: "var(--cyan)" },
                    { labelMS: "KARISMA", labelEN: "CHARISMA", val: charisma, color: "var(--gold)" },
                    { labelMS: "KREDIBILITI", labelEN: "CREDIBILITY", val: credibility, color: "var(--neon-green)" },
                    { labelMS: "RUNDINGAN", labelEN: "NEGOTIATION", val: negotiation, color: "var(--warn-orange)" },
                    { labelMS: "STRATEGI", labelEN: "STRATEGY", val: strategy, color: "#8b5cf6" },
                  ].map(({ labelMS, labelEN, val, color }) => (
                    <div key={labelEN} className="text-center">
                      <div className="text-2xl font-bold" style={{ color }}>{val}</div>
                      <div className="text-[11px] text-text-muted mt-1">{t(lang, labelMS, labelEN)}</div>
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
                {isLaunching ? t(lang, "⟳ MEMUATKAN...", "⟳ LOADING...") : t(lang, "▶ LANCAR KEMPEN", "▶ LAUNCH CAMPAIGN")}
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
                {t(lang, "← KEMBALI", "← BACK")}
              </button>

              <div className="text-[12px] text-text-muted tracking-wider">
                {t(lang, `LANGKAH ${step + 1} / 6`, `STEP ${step + 1} / 6`)}
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
                  {t(lang, "SETERUSNYA →", "NEXT →")}
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
                  {isLaunching ? t(lang, "⟳ MEMUATKAN...", "⟳ LOADING...") : t(lang, "LANCAR →", "LAUNCH →")}
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
