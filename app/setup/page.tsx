"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import StatBar from "../components/ui/StatBar";
import Toggle from "../components/ui/Toggle";
import IntroVideo from "../components/ui/IntroVideo";
import { useGameStore } from "../store/gameStore";
import { setActiveSaveSlot } from "../store/saveGame";
import { states } from "../data/states";
import { type DatasetKind, availableDatasets, getDatasetById } from "../data/datasets";

const POSITIONS = ["PRESIDENT", "SECRETARY GENERAL", "CHAIRMAN", "DEPUTY PRESIDENT"];
const EXPERIENCE_OPTIONS = ["VETERAN", "MODERATE", "ROOKIE"] as const;
const DIFFICULTIES = [
  { id: "easy", label: "EASY", desc: "For first-timers. Relaxed opposition, favorable media.", opp: 40, media: 30 },
  { id: "normal", label: "NORMAL", desc: "Balanced challenge. Fair competition.", opp: 60, media: 50 },
  { id: "hard", label: "HARD", desc: "Tough opposition, biased media.", opp: 80, media: 70 },
  { id: "nightmare", label: "NIGHTMARE", desc: "Maximum challenge. Everything against you.", opp: 95, media: 90 },
] as const;
const MEDIA_OPTIONS = ["PRO-MANDAT", "BALANCED", "HOSTILE"] as const;
const TOTAL_POINTS = 450;
const AVATARS = [
  { src: "/avatars/leader-01.png", label: "URBAN STRATEGIST" },
  { src: "/avatars/leader-02.png", label: "REFORM DIPLOMAT" },
  { src: "/avatars/leader-03.png", label: "POLICY TECHNOCRAT" },
  { src: "/avatars/leader-04.png", label: "GRASSROOTS ORGANISER" },
  { src: "/avatars/leader-05.png", label: "SENIOR STATESMAN" },
];

const STEPS = [
  { num: "00", label: "DATA MODE" },
  { num: "01", label: "AVATAR & PARTY" },
  { num: "02", label: "CAMPAIGN SETTINGS" },
  { num: "03", label: "DIFFICULTY" },
  { num: "04", label: "CONFIRM" },
];

export default function SetupPage() {
  const router = useRouter();
  const { setLeader, setPhase, updateSettings, setDataset, resetGame, settings } = useGameStore();

  const [step, setStep] = useState(0);
  const [showIntro, setShowIntro] = useState(false);

  // Step 0 state
  const [selectedDataset, setSelectedDataset] = useState<DatasetKind>("dummy");
  const currentDataset = useMemo(() => getDatasetById(selectedDataset), [selectedDataset]);

  // Step 1 state
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [leaderName, setLeaderName] = useState("SYURAHBIL");
  const [position, setPosition] = useState("PRESIDENT");
  const [experience, setExperience] = useState<"veteran" | "moderate" | "rookie">("veteran");
  const [homeState, setHomeState] = useState("selangor");
  const [influence, setInfluence] = useState(85);
  const [charisma, setCharisma] = useState(72);
  const [credibility, setCredibility] = useState(91);
  const [negotiation, setNegotiation] = useState(88);
  const [strategy, setStrategy] = useState(84);

  const [selectedPartyId, setSelectedPartyId] = useState(currentDataset.parties[0]?.id ?? "");
  const selectedParty = useMemo(
    () => currentDataset.parties.find((party) => party.id === selectedPartyId) ?? currentDataset.parties[0],
    [currentDataset, selectedPartyId]
  );
  const partyName = selectedParty?.name ?? "";
  const partyAbbr = selectedParty?.abbreviation ?? "";
  const partyColor = selectedParty?.color ?? "var(--cyan)";

  // Step 2 state
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

  useEffect(() => {
    setDifficulty(settings.difficulty);
    setOppStrength(settings.oppositionStrength);
    setMediaBias(settings.mediaBias === "pro" ? "PRO-MANDAT" : settings.mediaBias === "hostile" ? "HOSTILE" : "BALANCED");
    setEventRandomness(settings.eventRandomness);
    setPermanentConsequences(settings.permanentConsequences);
  }, [settings.difficulty, settings.eventRandomness, settings.mediaBias, settings.oppositionStrength, settings.permanentConsequences]);

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
    if (step < 4) setStep(step + 1);
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  function handleLaunch() {
    // LAUNCH CAMPAIGN must always start a fresh run from the setup choices.
    // If the player previously loaded an old slot, clear that active slot first
    // so the autosave subscriber creates a new slot instead of rewriting/resuming it.
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
      ideology: { economic: economicIdeology, social: socialIdeology },
    });
    updateSettings({
      difficulty,
      oppositionStrength: oppStrength,
      mediaBias: mediaBias === "PRO-MANDAT" ? "pro" : mediaBias === "HOSTILE" ? "hostile" : "balanced",
      eventRandomness,
      permanentConsequences,
    });
    setPhase("playing");
    setShowIntro(true);
  }

  function handleIntroComplete() {
    router.push("/warroom");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {showIntro && (
        <IntroVideo
          leaderName={leaderName}
          partyName={partyName}
          partyAbbr={partyAbbr}
          partyColor={partyColor}
          difficulty={difficulty}
          onComplete={handleIntroComplete}
        />
      )}
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
                  {s.label}
                </div>
              </button>
            ))}
          </div>

          {/* Step 0: Data Mode */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <div className="text-[13px] text-text-muted tracking-widest uppercase">
                  Choose which political names &amp; parties appear in your campaign
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
                          SELECTED
                        </div>
                      )}
                      <div className="text-[22px] mb-3">{isReal ? "🇲🇾" : "🎮"}</div>
                      <div
                        className="text-[15px] font-bold tracking-wider mb-2 uppercase"
                        style={{ color: selected ? accentColor : "#fff" }}
                      >
                        {ds.label}
                      </div>
                      <div className="text-[13px] text-text-muted leading-relaxed mb-4">
                        {ds.description}
                      </div>
                      <div
                        className="text-[11px] px-3 py-2 leading-relaxed"
                        style={{
                          background: isReal ? "rgb(var(--gold-rgb) / 0.08)" : "rgb(var(--cyan-rgb) / 0.08)",
                          border: `1px solid ${isReal ? "rgb(var(--gold-rgb) / 0.25)" : "rgb(var(--cyan-rgb) / 0.25)"}`,
                          color: "var(--text-muted)",
                        }}
                      >
                        ℹ {ds.dataNote}
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
                            + {ds.parties.length - 4} more parties
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
              <TacticalPanel title="AVATAR" className="w-[220px] shrink-0">
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
                        alt={`${AVATARS[avatarIndex].label} avatar`}
                        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.06)" }}
                      />
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[11px] tracking-[0.28em]" style={{ color: "var(--cyan)" }}>
                      SELECTED AVATAR
                    </div>
                    <div
                      className="mt-1 inline-flex px-2 py-1 text-[10px] font-bold tracking-wider"
                      style={{
                        color: "var(--gold)",
                        border: "1px solid rgb(var(--gold-rgb) / 0.35)",
                        background: "rgb(var(--gold-rgb) / 0.08)",
                      }}
                    >
                      {AVATARS[avatarIndex].label}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2.5 w-full pt-1" aria-label="Choose avatar">
                    {AVATARS.map((avatar, i) => {
                      const selected = avatarIndex === i;
                      return (
                        <button
                          key={avatar.src}
                          type="button"
                          onClick={() => setAvatarIndex(i)}
                          aria-label={`Select ${avatar.label}`}
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
              <TacticalPanel title="LEADER DETAILS" className="flex-1">
                <div className="space-y-3">
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">NAME</div>
                    <input
                      type="text"
                      value={leaderName}
                      onChange={(e) => setLeaderName(e.target.value.toUpperCase())}
                      className="w-full uppercase"
                      placeholder="ENTER NAME"
                    />
                  </div>
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">POSITION</div>
                    <select
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="w-full"
                    >
                      {POSITIONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">EXPERIENCE</div>
                    <div className="flex gap-2">
                      {EXPERIENCE_OPTIONS.map((e) => (
                        <button
                          key={e}
                          onClick={() => setExperience(e.toLowerCase() as "veteran" | "moderate" | "rookie")}
                          className="flex-1 py-1.5 text-[12px] tracking-wider transition-all"
                          style={{
                            background: experience === e.toLowerCase() ? "var(--gold)" : "transparent",
                            color: experience === e.toLowerCase() ? "#000" : "var(--text-muted)",
                            border: "1px solid",
                            borderColor: experience === e.toLowerCase() ? "var(--gold)" : "var(--bar-empty)",
                          }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">HOME STATE</div>
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
                      <div className="text-[12px] text-text-muted tracking-wider">LEADER ATTRIBUTES</div>
                      <div
                        className="text-[12px] font-bold"
                        style={{ color: pointsRemaining < 0 ? "var(--neon-red)" : "var(--neon-green)" }}
                      >
                        {pointsRemaining} PTS REMAINING
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "INFLUENCE", val: influence, set: setInfluence },
                        { label: "CHARISMA", val: charisma, set: setCharisma },
                        { label: "CREDIBILITY", val: credibility, set: setCredibility },
                        { label: "NEGOTIATION", val: negotiation, set: setNegotiation },
                        { label: "STRATEGY", val: strategy, set: setStrategy },
                      ].map(({ label, val, set }) => (
                        <div key={label} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-text-muted">{label}</span>
                            <span className="text-[12px] text-cyan font-bold">{val}</span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={100}
                            value={val}
                            onChange={(e) => set(Number(e.target.value))}
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
              <TacticalPanel title="PARTY IDENTITY" className="w-[200px] shrink-0">
                <div className="space-y-3">
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-1">DATASET PARTY</div>
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
                      Party identity locked to selected dataset: {currentDataset.label}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <div className="border px-3 py-2" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.14)", background: "rgba(255,255,255,0.025)" }}>
                      <div className="text-[9px] text-text-muted tracking-[0.18em]">PARTY NAME</div>
                      <div className="mt-1 text-[11px] font-bold leading-4 text-white">{partyName}</div>
                    </div>
                    <div className="border px-3 py-2" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.14)", background: "rgba(255,255,255,0.025)" }}>
                      <div className="text-[9px] text-text-muted tracking-[0.18em]">ABBREVIATION</div>
                      <div className="mt-1 text-[13px] font-black" style={{ color: partyColor }}>{partyAbbr}</div>
                    </div>
                  </div>
                  {/* Logo Preview */}
                  <div>
                    <div className="text-[12px] text-text-muted tracking-wider mb-2">LOGO PREVIEW</div>
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

          {/* Step 2: Campaign Settings */}
          {step === 2 && (
            <div className="space-y-4">
              <TacticalPanel title="IDEOLOGY POSITIONING">
                <div className="space-y-6">
                  <div className="rounded-sm border border-cyan/15 bg-[var(--bg)]/45 px-3 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[12px] text-text-muted tracking-wider">ECONOMIC POLICY</span>
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
                      <span className="text-neon-green">← PROGRESSIVE</span>
                      <span className="text-warn-orange">CONSERVATIVE →</span>
                    </div>
                  </div>

                  <div className="rounded-sm border border-cyan/15 bg-[var(--bg)]/45 px-3 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[12px] text-text-muted tracking-wider">SOCIAL STANCE</span>
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
                      <span className="text-neon-green">← PROGRESSIVE</span>
                      <span className="text-warn-orange">TRADITIONAL →</span>
                    </div>
                  </div>
                </div>
              </TacticalPanel>

              <TacticalPanel title="PARTY DESCRIPTION">
                <textarea
                  value={partyDesc}
                  onChange={(e) => setPartyDesc(e.target.value)}
                  placeholder="Describe your party's core mission and values..."
                  rows={4}
                  className="w-full resize-none text-[13px]"
                />
              </TacticalPanel>

              <TacticalPanel title="STARTING REGION FOCUS">
                <div className="flex gap-6 mt-2">
                  {[
                    { label: "PENINSULAR MALAYSIA", val: regionPeninsular, set: setRegionPeninsular },
                    { label: "SABAH", val: regionSabah, set: setRegionSabah },
                    { label: "SARAWAK", val: regionSarawak, set: setRegionSarawak },
                  ].map(({ label, val, set }) => (
                    <label key={label} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => set(e.target.checked)}
                        className="w-4 h-4"
                        style={{ accentColor: "var(--cyan)" }}
                      />
                      <span className="text-[13px] text-text-muted tracking-wider">{label}</span>
                    </label>
                  ))}
                </div>
              </TacticalPanel>
            </div>
          )}

          {/* Step 3: Difficulty */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleDifficultySelect(d)}
                    className="relative p-4 text-left transition-all"
                    style={{
                      background: difficulty === d.id ? "rgb(var(--gold-rgb) / 0.08)" : "rgba(255,255,255,0.02)",
                      border: difficulty === d.id ? "1px solid var(--gold)" : "1px solid var(--bar-empty)",
                      boxShadow: difficulty === d.id ? "0 0 12px rgb(var(--gold-rgb) / 0.2)" : "none",
                    }}
                  >
                    <div
                      className="text-sm font-bold tracking-widest mb-2"
                      style={{ color: difficulty === d.id ? "var(--gold)" : "#ffffff" }}
                    >
                      {d.label}
                    </div>
                    <div className="text-[12px] text-text-muted mb-3 leading-relaxed">{d.desc}</div>
                    <div className="space-y-1.5">
                      <div>
                        <div className="text-[11px] text-text-muted mb-0.5">OPPOSITION STR.</div>
                        <StatBar label="" value={d.opp} color="var(--neon-red)" animate={false} size="sm" />
                      </div>
                      <div>
                        <div className="text-[11px] text-text-muted mb-0.5">MEDIA CHALLENGE</div>
                        <StatBar label="" value={d.media} color="var(--warn-orange)" animate={false} size="sm" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <TacticalPanel title="FINE TUNING">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] text-text-muted tracking-wider">OPPOSITION STRENGTH</span>
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
                    <div className="text-[12px] text-text-muted tracking-wider mb-2">MEDIA BIAS</div>
                    <div className="flex gap-2">
                      {MEDIA_OPTIONS.map((m) => (
                        <button
                          key={m}
                          onClick={() => setMediaBias(m)}
                          className="flex-1 py-1.5 text-[12px] tracking-wider transition-all"
                          style={{
                            background: mediaBias === m ? (m === "PRO-MANDAT" ? "rgb(var(--neon-green-rgb,21 128 61) / 0.15)" : m === "HOSTILE" ? "rgb(255 68 68 / 0.15)" : "rgb(var(--cyan-rgb) / 0.15)") : "transparent",
                            color: mediaBias === m ? (m === "PRO-MANDAT" ? "var(--neon-green)" : m === "HOSTILE" ? "var(--neon-red)" : "var(--cyan)") : "var(--text-muted)",
                            border: "1px solid",
                            borderColor: mediaBias === m ? (m === "PRO-MANDAT" ? "var(--neon-green)" : m === "HOSTILE" ? "var(--neon-red)" : "var(--cyan)") : "var(--bar-empty)",
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-8 pt-2">
                    <Toggle value={eventRandomness} onChange={setEventRandomness} label="EVENT RANDOMNESS" />
                    <Toggle value={permanentConsequences} onChange={setPermanentConsequences} label="PERMANENT CONSEQUENCES" />
                  </div>
                </div>
              </TacticalPanel>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <TacticalPanel title="LEADER PROFILE">
                  <div className="space-y-2">
                    <div className="flex justify-center mb-3">
                      <div style={{ width: "80px", height: "80px", border: "2px solid var(--cyan)", overflow: "hidden", background: "var(--bg)" }}>
                        <img src={AVATARS[avatarIndex].src} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    </div>
                    <SummaryRow label="NAME" value={leaderName} />
                    <SummaryRow label="POSITION" value={position} />
                    <SummaryRow label="EXPERIENCE" value={experience.toUpperCase()} />
                    <SummaryRow label="HOME STATE" value={states.find((s) => s.id === homeState)?.name || homeState} />
                  </div>
                </TacticalPanel>

                <TacticalPanel title="PARTY IDENTITY">
                  <div className="space-y-2">
                    <div
                      className="flex items-center justify-center h-12 text-2xl font-bold mb-3"
                      style={{ background: "var(--bg)", border: `2px solid ${partyColor}`, color: partyColor }}
                    >
                      {partyAbbr[0] || "M"}
                    </div>
                    <SummaryRow label="NAME" value={partyName} />
                    <SummaryRow label="ABBR" value={partyAbbr} />
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-text-muted tracking-wider">COLOR</span>
                      <div className="w-5 h-5" style={{ background: partyColor }} />
                    </div>
                  </div>
                </TacticalPanel>

                <TacticalPanel title="GAME SETTINGS">
                  <div className="space-y-2">
                    <SummaryRow label="DATA MODE" value={selectedDataset === "real-malaysia" ? "REAL MALAYSIA" : "FICTIONAL"} />
                    <SummaryRow label="DIFFICULTY" value={difficulty.toUpperCase()} />
                    <SummaryRow label="OPP. STRENGTH" value={`${oppStrength}%`} />
                    <SummaryRow label="MEDIA BIAS" value={mediaBias} />
                    <SummaryRow label="RANDOMNESS" value={eventRandomness ? "ON" : "OFF"} />
                    <SummaryRow label="PERM. EFFECTS" value={permanentConsequences ? "ON" : "OFF"} />
                  </div>
                </TacticalPanel>
              </div>

              <TacticalPanel title="ATTRIBUTE SUMMARY">
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { label: "INFLUENCE", val: influence, color: "var(--cyan)" },
                    { label: "CHARISMA", val: charisma, color: "var(--gold)" },
                    { label: "CREDIBILITY", val: credibility, color: "var(--neon-green)" },
                    { label: "NEGOTIATION", val: negotiation, color: "var(--warn-orange)" },
                    { label: "STRATEGY", val: strategy, color: "#8b5cf6" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="text-center">
                      <div className="text-2xl font-bold" style={{ color }}>{val}</div>
                      <div className="text-[11px] text-text-muted mt-1">{label}</div>
                    </div>
                  ))}
                </div>
              </TacticalPanel>

              <button
                onClick={handleLaunch}
                className="w-full py-4 text-sm font-bold tracking-[0.2em] uppercase transition-all"
                style={{
                  background: "var(--gold)",
                  color: "#000000",
                  fontFamily: "Space Mono, monospace",
                  boxShadow: "0 0 20px rgb(var(--gold-rgb) / 0.4)",
                }}
              >
                ▶ LAUNCH CAMPAIGN
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
                ← BACK
              </button>

              <div className="text-[12px] text-text-muted tracking-wider">
                STEP {step + 1} / 5
              </div>

              {step < 4 ? (
                <button
                  onClick={handleNext}
                  className="px-6 py-2 text-[13px] tracking-widest uppercase transition-all"
                  style={{
                    background: "var(--gold)",
                    color: "#000000",
                    fontFamily: "Space Mono, monospace",
                  }}
                >
                  NEXT →
                </button>
              ) : (
                <button
                  onClick={handleLaunch}
                  className="px-6 py-2 text-[13px] font-bold tracking-widest uppercase transition-all"
                  style={{
                    background: "var(--gold)",
                    color: "#000000",
                    fontFamily: "Space Mono, monospace",
                    boxShadow: "0 0 16px rgb(var(--gold-rgb) / 0.35)",
                  }}
                >
                  LAUNCH →
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
