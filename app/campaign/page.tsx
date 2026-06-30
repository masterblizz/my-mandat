"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import StatBar from "../components/ui/StatBar";
import MalaysiaMap from "../components/map/MalaysiaMap";
import { useGameStore, Operation, NominationEntry } from "../store/gameStore";
import { generateConstituencies, Constituency } from "../data/constituencies";
import type { StateData } from "../data/states";
import { PARTY_MEMBERS, PartyMember } from "../data/members";
import { useLang, t } from "../i18n/useLang";

type Tab = "NOMINATION" | "MINI-GAMES" | "OPERATIONS" | "VOLUNTEERS" | "RESOURCES" | "SCHEDULE" | "MESSAGING";

const TABS: Tab[] = ["NOMINATION", "MINI-GAMES", "OPERATIONS", "VOLUNTEERS", "RESOURCES", "SCHEDULE", "MESSAGING"];

type MiniGameType = "ceramah" | "social";
type MiniGameTactic = "safe" | "balanced" | "aggressive";

const MINI_GAME_TACTICS: Record<MiniGameTactic, { title: string; descMS: string; descEN: string; risk: string; color: string }> = {
  safe: { title: "SAFE MESSAGE", descMS: "Mesej terkawal, stabil, risiko backlash rendah.", descEN: "Controlled, stable message. Low risk of backlash.", risk: "Low risk / modest gain", color: "var(--neon-green)" },
  balanced: { title: "BALANCED PUSH", descMS: "Gabung janji dasar + attack line sederhana.", descEN: "Combine policy pledges with mild attack lines.", risk: "Medium risk / good gain", color: "var(--cyan)" },
  aggressive: { title: "AGGRESSIVE ATTACK", descMS: "Serangan narrative tajam. Gain tinggi tapi amaran media boleh muncul.", descEN: "Sharp narrative attack. High gain but media warnings may trigger.", risk: "High risk / high gain", color: "var(--warn-orange)" },
};

const UPCOMING_EVENTS = [
  { date: "28 MAY", event: "CERAMAH MEGA — PAHANG", location: "Kuantan, Pahang" },
  { date: "30 MAY", event: "YOUTH TOWN HALL", location: "Petaling Jaya, Selangor" },
  { date: "02 JUN", event: "PRESS CONFERENCE", location: "Kuala Lumpur" },
];

const VOLUNTEER_DATA = [
  { region: "Selangor", volunteers: 180, target: 250 },
  { region: "Johor", volunteers: 95, target: 150 },
  { region: "Perak", volunteers: 78, target: 120 },
  { region: "Pahang", volunteers: 65, target: 80 },
  { region: "Sabah", volunteers: 54, target: 80 },
  { region: "Others", volunteers: 160, target: 320 },
];

const BUDGET_DATA = [
  { category: "Ceramah", allocated: 800000, spent: 320000 },
  { category: "Digital", allocated: 600000, spent: 180000 },
  { category: "Print", allocated: 300000, spent: 210000 },
  { category: "Transport", allocated: 400000, spent: 240000 },
  { category: "Ops Support", allocated: 200000, spent: 145000 },
];

type OpType = Operation["type"];

const OP_TEMPLATES: Record<OpType, { label: string; desc: string; manpowerCost: number; fundsCost: number; supportGain: number }> = {
  ceramah:        { label: "CERAMAH",       desc: "Mass rally — high crowd impact.",       manpowerCost: 100, fundsCost: 120000, supportGain: 2.5 },
  "door-to-door": { label: "DOOR-TO-DOOR",  desc: "Direct voter contact. Builds trust.",   manpowerCost: 80,  fundsCost: 40000,  supportGain: 1.2 },
  youth:          { label: "YOUTH OUTREACH",desc: "Engage first-time voters.",              manpowerCost: 50,  fundsCost: 30000,  supportGain: 1.8 },
  digital:        { label: "DIGITAL",       desc: "Social media & online ads.",             manpowerCost: 20,  fundsCost: 150000, supportGain: 1.0 },
  rural:          { label: "RURAL ENGAGE",  desc: "Ground ops in rural constituencies.",   manpowerCost: 90,  fundsCost: 60000,  supportGain: 1.4 },
};

function formatRM(amount: number): string {
  if (amount >= 1000000) return `RM ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `RM ${(amount / 1000).toFixed(0)}K`;
  return `RM ${amount}`;
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "active" ? "var(--neon-green)" :
    status === "ongoing" ? "var(--gold)" :
    "var(--text-muted)";
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: color, boxShadow: `0 0 4px ${color}` }}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return (
    <span className="text-[11px] px-1.5 py-0.5 tracking-widest" style={{ color: "var(--neon-green)", background: "rgb(var(--neon-green-rgb,21 128 61) / 0.1)", border: "1px solid rgb(var(--neon-green-rgb,21 128 61) / 0.3)" }}>
      ACTIVE
    </span>
  );
  if (status === "ongoing") return (
    <span className="text-[11px] px-1.5 py-0.5 tracking-widest" style={{ color: "var(--gold)", background: "rgb(var(--gold-rgb) / 0.1)", border: "1px solid rgb(var(--gold-rgb) / 0.3)" }}>
      ONGOING
    </span>
  );
  return (
    <span className="text-[11px] px-1.5 py-0.5 tracking-widest" style={{ color: "var(--text-muted)", background: "rgba(136,153,170,0.08)", border: "1px solid rgba(136,153,170,0.2)" }}>
      PLANNED
    </span>
  );
}

function DeployModal({ onClose }: { onClose: () => void }) {
  const { resources, states: gameStates, addOperation } = useGameStore();
  const [opType, setOpType] = useState<OpType>("ceramah");
  const [selectedStateIds, setSelectedStateIds] = useState<string[]>([]);

  const template = OP_TEMPLATES[opType];
  const canAffordFunds = resources.funds >= template.fundsCost;
  const canAffordManpower = resources.manpower >= template.manpowerCost;
  const canDeploy = canAffordFunds && canAffordManpower && selectedStateIds.length > 0;

  function toggleState(id: string) {
    setSelectedStateIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function handleDeploy() {
    const selectedNames = gameStates
      .filter((s) => selectedStateIds.includes(s.id))
      .map((s) => s.shortName)
      .join(" · ");

    const newOp: Operation = {
      id: `op-${Date.now()}`,
      name: template.label,
      type: opType,
      location: selectedNames || "Nationwide",
      stateIds: selectedStateIds,
      status: "active",
      manpowerCost: template.manpowerCost,
      fundsCost: template.fundsCost,
      supportGain: template.supportGain,
    };
    addOperation(newOp);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl p-0"
        style={{ background: "var(--panel)", border: "1px solid rgb(var(--cyan-rgb) / 0.4)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.2)" }}>
          <span className="text-[14px] font-bold tracking-widest uppercase" style={{ color: "var(--gold)" }}>DEPLOY NEW OPERATION</span>
          <button onClick={onClose} className="text-[22px] leading-none" style={{ color: "var(--text-muted)", cursor: "pointer" }}>×</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5">

          {/* Operation type */}
          <div>
            <div className="text-[12px] tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>OPERATION TYPE</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(OP_TEMPLATES) as OpType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setOpType(t)}
                  className="px-3 py-1.5 text-[12px] tracking-widest uppercase transition-colors"
                  style={{
                    border: opType === t ? "1px solid var(--cyan)" : "1px solid rgb(var(--cyan-rgb) / 0.2)",
                    color: opType === t ? "var(--cyan)" : "var(--text-muted)",
                    background: opType === t ? "rgb(var(--cyan-rgb) / 0.08)" : "none",
                    cursor: "pointer",
                  }}
                >
                  {OP_TEMPLATES[t].label}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
              {template.desc}&nbsp;
              <span style={{ color: "var(--cyan)" }}>Gain: +{template.supportGain}%/day</span>
              &nbsp;·&nbsp;
              <span style={{ color: canAffordManpower ? "var(--text-muted)" : "var(--neon-red)" }}>{template.manpowerCost} MAN</span>
              &nbsp;·&nbsp;
              <span style={{ color: canAffordFunds ? "var(--text-muted)" : "var(--neon-red)" }}>{formatRM(template.fundsCost)}</span>
            </div>
          </div>

          {/* State selection */}
          <div>
            <div className="text-[12px] tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>TARGET STATES <span style={{ color: "#4a5568" }}>(select at least one)</span></div>
            <div className="grid grid-cols-3 gap-1.5">
              {gameStates.map((s) => {
                const selected = selectedStateIds.includes(s.id);
                const statusColor = s.status === "winning" ? "var(--cyan)" : s.status === "losing" ? "var(--neon-red)" : "var(--gold)";
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleState(s.id)}
                    className="flex items-center gap-2 px-2 py-1.5 text-[12px] tracking-wider uppercase transition-colors text-left"
                    style={{
                      border: selected ? "1px solid var(--gold)" : "1px solid rgb(var(--cyan-rgb) / 0.15)",
                      color: selected ? "#ffffff" : "var(--text-muted)",
                      background: selected ? "rgb(var(--gold-rgb) / 0.08)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor }} />
                    {s.shortName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resource check */}
          <div className="flex gap-4 text-[12px]" style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.1)", paddingTop: "12px" }}>
            <div>
              <span style={{ color: "var(--text-muted)" }}>MANPOWER AVAIL: </span>
              <span style={{ color: canAffordManpower ? "var(--neon-green)" : "var(--neon-red)", fontWeight: "bold" }}>{resources.manpower}</span>
              <span style={{ color: "#4a5568" }}> / needs {template.manpowerCost}</span>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>FUNDS AVAIL: </span>
              <span style={{ color: canAffordFunds ? "var(--neon-green)" : "var(--neon-red)", fontWeight: "bold" }}>{formatRM(resources.funds)}</span>
              <span style={{ color: "#4a5568" }}> / needs {formatRM(template.fundsCost)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-[13px] tracking-widest uppercase"
              style={{ border: "1px solid rgba(136,153,170,0.3)", color: "var(--text-muted)", background: "none", cursor: "pointer" }}
            >
              CANCEL
            </button>
            <button
              onClick={handleDeploy}
              disabled={!canDeploy}
              className="px-6 py-2 text-[13px] tracking-widest uppercase font-bold transition-opacity"
              style={{
                background: canDeploy ? "var(--gold)" : "var(--bar-empty)",
                color: canDeploy ? "#000" : "#4a5568",
                cursor: canDeploy ? "pointer" : "not-allowed",
              }}
            >
              DEPLOY OPERATION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Nomination Tab ────────────────────────────────────────────────────────────

const LOCAL_CANDIDATE_FIRST_NAMES = ["Amir", "Sofia", "Hakim", "Aina", "Farhan", "Nadia", "Khalid", "Mei Lin", "Ravi", "Aisyah", "Daniel", "Zulaikha", "Hafiz", "Priya", "Johan", "Marlina"];
const LOCAL_CANDIDATE_LAST_NAMES = ["Rahman", "Tan", "Ibrahim", "Lim", "Kumar", "Zainal", "Wong", "Ismail", "Lee", "Yusof", "Singh", "Othman", "Chong", "Hassan", "Ng", "Salleh"];
const CANDIDATE_PORTRAITS = [
  "/avatars/leader-01.png",
  "/avatars/leader-02.png",
  "/avatars/leader-03.png",
  "/avatars/leader-04.png",
  "/avatars/leader-05.png",
];

function candidatePortrait(member: PartyMember): string {
  const seed = member.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return CANDIDATE_PORTRAITS[seed % CANDIDATE_PORTRAITS.length];
}

function makeLocalBranchCandidate(state: StateData, constituency: Constituency, index: number): PartyMember {
  const seed = constituency.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) + index * 17;
  const first = LOCAL_CANDIDATE_FIRST_NAMES[seed % LOCAL_CANDIDATE_FIRST_NAMES.length];
  const last = LOCAL_CANDIDATE_LAST_NAMES[(seed * 7) % LOCAL_CANDIDATE_LAST_NAMES.length];
  const specialty = (["grassroots", "rural", "urban", "youth", "economic", "media"] as PartyMember["specialty"][])[seed % 6];
  return {
    id: `branch-${constituency.id}`,
    name: `${first} ${last}`,
    role: `Ketua Cabang ${constituency.name}`,
    homeState: state.id,
    homeConstituency: constituency.name,
    influenceScope: "local",
    influence: 48 + (seed % 18),
    charisma: 50 + ((seed * 3) % 22),
    credibility: 52 + ((seed * 5) % 24),
    experience: "new",
    specialty,
  };
}

function NominationTab() {
  const { states: gameStates, nominations, setNomination } = useGameStore();
  const [selectedStateId, setSelectedStateId] = useState(gameStates[0]?.id ?? "selangor");
  const [selectedConstId, setSelectedConstId] = useState<string | null>(null);
  const [advisorNote, setAdvisorNote] = useState("AI Advisor belum dijalankan. Cadangan akan isi kerusi kosong sahaja supaya pilihan player tidak ditimpa.");

  const selectedState = gameStates.find((s) => s.id === selectedStateId);

  const constituencies = useMemo(
    () => (selectedState ? generateConstituencies(selectedState) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedStateId, selectedState?.mandatSupport, selectedState?.lawanSupport]
  );

  const selectedConst = constituencies.find((c) => c.id === selectedConstId) ?? null;
  const currentNom: NominationEntry | null = selectedConstId ? (nominations[selectedConstId] ?? null) : null;

  const memberAssignments = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [constId, nom] of Object.entries(nominations)) {
      if (nom?.type === "member") map[nom.memberId] = constId;
    }
    return map;
  }, [nominations]);

  const allConstituencies = useMemo(() => {
    return gameStates.flatMap((state) =>
      generateConstituencies(state).map((constituency) => ({ state, constituency }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStates]);

  const candidatePool = useMemo(() => {
    const branchMembers = allConstituencies.map(({ state, constituency }, index) =>
      makeLocalBranchCandidate(state, constituency, index)
    );
    return [...PARTY_MEMBERS, ...branchMembers];
  }, [allConstituencies]);

  const currentMember = currentNom?.type === "member"
    ? candidatePool.find((member) => member.id === currentNom.memberId) ?? null
    : null;

  const allConsts = useMemo(() => {
    const map: Record<string, { name: string; stateShort: string }> = {};
    for (const s of gameStates) {
      for (const c of generateConstituencies(s)) {
        map[c.id] = { name: c.name, stateShort: s.shortName };
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStates]);

  const stateProgress = (stateId: string) => {
    const s = gameStates.find((x) => x.id === stateId);
    if (!s) return { nominated: 0, total: 0 };
    const consts = generateConstituencies(s);
    const nominated = consts.filter((c) => nominations[c.id] != null).length;
    return { nominated, total: consts.length };
  };

  const assign = (entry: NominationEntry | null) => {
    if (!selectedConstId) return;
    if (entry?.type === "member") {
      const prev = memberAssignments[entry.memberId];
      if (prev && prev !== selectedConstId) setNomination(prev, null);
    }
    setNomination(selectedConstId, entry);
  };

  const scColor = (s: Constituency["safety"]) =>
    s === "safe" ? "var(--neon-green)" : s === "marginal" ? "var(--gold)" : "var(--neon-red)";
  const winColor = (w: Constituency["winner"]) =>
    w === "mandat" ? "var(--cyan)" : w === "lawan" ? "var(--warn-orange)" : "var(--text-muted)";
  const winLabel = (w: Constituency["winner"]) =>
    w === "mandat" ? "KITA UNGGUL" : w === "lawan" ? "LAWAN UNGGUL" : "OTHERS";

  const expColor = (e: PartyMember["experience"]) =>
    e === "veteran" ? "var(--gold)" : e === "rising" ? "var(--cyan)" : "var(--text-muted)";
  const expLabel = (e: PartyMember["experience"]) =>
    e === "veteran" ? "VETERAN" : e === "rising" ? "RISING" : "NEW";

  const nomBadge = (nom: NominationEntry | null | undefined) => {
    if (!nom) return { label: "PENDING", color: "#4a5568", bg: "transparent" };
    if (nom.type === "member") return { label: nom.memberName.split(" ").slice(-1)[0].toUpperCase(), color: "var(--cyan)", bg: "rgb(var(--cyan-rgb)/0.10)" };
    return { label: "WALKOVER", color: "var(--neon-red)", bg: "rgba(255,68,68,0.08)" };
  };

  const isLocalMember = (member: PartyMember) => member.homeState === selectedStateId;
  const isDistrictMember = (member: PartyMember) => !!selectedConst && member.homeConstituency?.toLowerCase() === selectedConst.name.toLowerCase();

  const scopeColor = (scope: PartyMember["influenceScope"]) =>
    scope === "national" ? "var(--gold)" : scope === "state" ? "var(--cyan)" : "var(--neon-green)";
  const scopeLabel = (scope: PartyMember["influenceScope"]) =>
    scope === "national" ? "NASIONAL" : scope === "state" ? "NEGERI" : "DAERAH";

  const fitLabel = (member: PartyMember) => {
    if (isDistrictMember(member)) return "ANAK KAWASAN";
    if (isLocalMember(member)) return "ANAK NEGERI";
    return scopeLabel(member.influenceScope);
  };

  const fitScore = (member: PartyMember) => {
    if (isDistrictMember(member)) return 100;
    if (isLocalMember(member)) return 70;
    if (member.influenceScope === "national") return 50;
    if (member.influenceScope === "state") return 30;
    return 10;
  };

  const candidateEffectText = (member: PartyMember) => {
    if (isDistrictMember(member)) return "+Daerah: akar umbi kuat di kerusi ini";
    if (isLocalMember(member)) return "+Negeri: jentera negeri lebih mudah digerakkan";
    if (member.influenceScope === "national") return "+Nasional: nama besar tarik liputan media";
    if (member.influenceScope === "state") return "Pengaruh negeri: sesuai dalam negeri asal";
    return "Pengaruh daerah: terbaik jika diletak di kawasan asal";
  };

  const sortedMembers = [...candidatePool].sort((a, b) => fitScore(b) - fitScore(a) || b.influence - a.influence);

  const candidateFitScoreFor = (member: PartyMember, targetStateId: string, targetConstituencyName: string) => {
    const sameSeat = member.homeConstituency?.toLowerCase() === targetConstituencyName.toLowerCase();
    const sameState = member.homeState === targetStateId;
    const scopeBase = member.influenceScope === "national" ? 55 : member.influenceScope === "state" ? 42 : 28;
    return scopeBase + member.influence * 0.45 + member.charisma * 0.2 + member.credibility * 0.25 + (sameSeat ? 70 : sameState ? 38 : 0);
  };

  const seatPriorityScore = (c: Constituency) => {
    const safetyWeight = c.safety === "danger" ? 35 : c.safety === "marginal" ? 24 : 8;
    const underdogWeight = c.winner === "lawan" ? 16 : c.winner === "others" ? 10 : 0;
    return safetyWeight + underdogWeight + Math.max(0, 30 - c.margin);
  };

  const pickAdvisorSeat = (
    member: PartyMember,
    pool: { state: StateData; constituency: Constituency }[],
    reserved: Set<string>
  ) => {
    return pool
      .filter(({ constituency }) => !reserved.has(constituency.id) && !nominations[constituency.id])
      .sort((a, b) => {
        const aScore = candidateFitScoreFor(member, a.state.id, a.constituency.name) + seatPriorityScore(a.constituency);
        const bScore = candidateFitScoreFor(member, b.state.id, b.constituency.name) + seatPriorityScore(b.constituency);
        return bScore - aScore;
      })[0] ?? null;
  };

  const applyAdvisor = (scope: "state" | "national") => {
    const pool = scope === "state"
      ? allConstituencies.filter(({ state }) => state.id === selectedStateId)
      : allConstituencies;
    const usedMembers = new Set(Object.values(nominations).flatMap((nom) => nom?.type === "member" ? [nom.memberId] : []));
    const reservedSeats = new Set<string>();
    const candidates = [...candidatePool]
      .filter((member) => !usedMembers.has(member.id))
      .sort((a, b) => {
        if (scope === "state") {
          const localDiff = Number(b.homeState === selectedStateId) - Number(a.homeState === selectedStateId);
          if (localDiff !== 0) return localDiff;
        }
        const scopeRank = { national: 3, state: 2, local: 1 } as const;
        return scopeRank[b.influenceScope] - scopeRank[a.influenceScope] || b.influence - a.influence;
      });

    let applied = 0;
    for (const member of candidates) {
      const pick = pickAdvisorSeat(member, pool, reservedSeats);
      if (!pick) continue;
      reservedSeats.add(pick.constituency.id);
      setNomination(pick.constituency.id, { type: "member", memberId: member.id, memberName: member.name, memberRole: member.role });
      applied += 1;
    }

    const targetLabel = scope === "state" ? selectedState?.name ?? "negeri ini" : "seluruh negara";
    setAdvisorNote(
      applied > 0
        ? `AI Advisor cadangkan ${applied} calon untuk ${targetLabel}. Kerusi yang sudah ada calon tidak disentuh; player masih boleh clear, tukar atau pindahkan calon selepas ini.`
        : `AI Advisor tidak mengubah apa-apa untuk ${targetLabel} kerana semua calon/kerusi sesuai sudah digunakan atau tiada slot kosong.`
    );
  };

  return (
    <div className="flex" style={{ minHeight: "calc(100vh - 160px)", borderTop: "1px solid rgb(var(--cyan-rgb)/0.12)" }}>

      {/* Col 1: State List */}
      <div style={{ width: "158px", borderRight: "1px solid rgb(var(--cyan-rgb)/0.12)", overflowY: "auto", flexShrink: 0 }}>
        {gameStates.map((s) => {
          const { nominated, total } = stateProgress(s.id);
          const pct = total > 0 ? nominated / total : 0;
          const pColor = pct === 1 ? "var(--neon-green)" : pct > 0 ? "var(--gold)" : "#4a5568";
          const isActive = selectedStateId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => { setSelectedStateId(s.id); setSelectedConstId(null); }}
              className="w-full px-3 py-2.5 text-left transition-colors"
              style={{
                borderBottom: "1px solid rgb(var(--cyan-rgb)/0.07)",
                borderLeft: isActive ? "2px solid var(--gold)" : "2px solid transparent",
                background: isActive ? "rgb(var(--gold-rgb)/0.07)" : "transparent",
              }}
            >
              <div className="text-[12px] font-bold tracking-wider" style={{ color: isActive ? "#fff" : "var(--text-muted)" }}>
                {s.shortName}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: pColor }}>{nominated}/{total}</div>
              <div className="mt-1 h-0.5 transition-all" style={{ background: "var(--bar-empty)" }}>
                <div className="h-0.5" style={{ width: `${pct * 100}%`, background: pColor }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Col 2: Constituency List */}
      <div style={{ width: "268px", borderRight: "1px solid rgb(var(--cyan-rgb)/0.12)", overflowY: "auto", flexShrink: 0 }}>
        <div className="px-3 py-2 sticky top-0" style={{ background: "var(--bg)", borderBottom: "1px solid rgb(var(--cyan-rgb)/0.12)", zIndex: 1 }}>
          <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--gold)" }}>
            {selectedState?.name} — {constituencies.length} KERUSI
          </div>
        </div>
        {constituencies.map((c) => {
          const nom = nominations[c.id];
          const badge = nomBadge(nom);
          const isActive = selectedConstId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedConstId(c.id)}
              className="w-full px-3 py-2 text-left transition-colors"
              style={{
                borderBottom: "1px solid rgb(var(--cyan-rgb)/0.05)",
                borderLeft: isActive ? "2px solid var(--gold)" : "2px solid transparent",
                background: isActive ? "rgb(var(--gold-rgb)/0.06)" : "transparent",
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: scColor(c.safety) }} />
                  <span className="text-[12px] font-bold truncate" style={{ color: isActive ? "#fff" : "var(--text-muted)" }}>
                    {c.name}
                  </span>
                </div>
                <span className="text-[9px] shrink-0" style={{ color: "#4a5568" }}>{c.code}</span>
              </div>
              <div className="flex items-center justify-between mt-0.5 gap-1">
                <span className="text-[10px]" style={{ color: winColor(c.winner) }}>{winLabel(c.winner)}</span>
                <span className="text-[9px] px-1 py-0.5" style={{ color: badge.color, background: badge.bg, border: `1px solid ${badge.color}33` }}>
                  {badge.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Col 3: Candidate Panel */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-5 p-3" style={{ border: "1px solid rgb(var(--gold-rgb)/0.28)", background: "rgb(var(--gold-rgb)/0.06)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black tracking-widest uppercase" style={{ color: "var(--gold)" }}>
                AI ADVISOR · CADANGAN KELOMPOK CALON
              </div>
              <div className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Advisor pilih calon ahli parti mengikut pengaruh nasional, negeri dan daerah. Ia hanya isi kerusi kosong — player boleh edit/pindahkan calon selepas cadangan.
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => applyAdvisor("state")}
                className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase"
                style={{ border: "1px solid rgb(var(--cyan-rgb)/0.4)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.07)", cursor: "pointer" }}
              >
                PILIH NEGERI INI
              </button>
              <button
                onClick={() => applyAdvisor("national")}
                className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase"
                style={{ border: "1px solid rgb(var(--gold-rgb)/0.5)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.08)", cursor: "pointer" }}
              >
                PILIH SELURUH NEGARA
              </button>
            </div>
          </div>
          <div className="mt-2 text-[10px] leading-relaxed" style={{ color: "#94a3b8" }}>
            {advisorNote}
          </div>
        </div>

        {!selectedConstId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center" style={{ minHeight: "300px" }}>
            <div className="text-[28px]" style={{ color: "var(--text-muted)" }}>←</div>
            <div className="text-[12px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
              Pilih kawasan parlimen untuk letak calon
            </div>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Constituency header */}
            <div className="flex items-start justify-between gap-4 pb-4" style={{ borderBottom: "1px solid rgb(var(--cyan-rgb)/0.15)" }}>
              <div>
                <div className="text-[20px] font-black tracking-widest text-white uppercase">{selectedConst?.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px]" style={{ color: "#4a5568" }}>{selectedConst?.code}</span>
                  <span style={{ color: "#4a5568" }}>·</span>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{selectedState?.name}</span>
                  <span style={{ color: "#4a5568" }}>·</span>
                  <span className="text-[11px] font-bold uppercase" style={{ color: scColor(selectedConst?.safety ?? "danger") }}>
                    {selectedConst?.safety}
                  </span>
                </div>
              </div>
              <div className="flex gap-4 text-right shrink-0">
                <div>
                  <div className="text-[9px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>SOKONGAN KITA</div>
                  <div className="text-[22px] font-black" style={{ color: "var(--cyan)" }}>{selectedConst?.mandat}%</div>
                </div>
                <div>
                  <div className="text-[9px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>MARGIN</div>
                  <div className="text-[22px] font-black" style={{ color: selectedConst?.winner === "mandat" ? "var(--neon-green)" : "var(--neon-red)" }}>
                    {selectedConst?.winner === "mandat" ? "+" : "−"}{Math.abs(selectedConst?.margin ?? 0)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Current nomination */}
            <div className="p-3" style={{ background: "var(--bg)", border: "1px solid rgb(var(--cyan-rgb)/0.18)" }}>
              <div className="text-[10px] tracking-widest mb-2 uppercase" style={{ color: "var(--text-muted)" }}>Calon Semasa</div>
              {!currentNom ? (
                <div className="text-[13px]" style={{ color: "#4a5568" }}>— Belum ada calon —</div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {currentMember && currentNom.type === "member" && (
                      <div className="h-[58px] w-[46px] shrink-0 overflow-hidden" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.42)", background: "rgb(var(--cyan-rgb)/0.06)", boxShadow: "0 0 16px rgb(var(--cyan-rgb)/0.18)" }}>
                        <img
                          src={candidatePortrait(currentMember)}
                          alt={`${currentMember.name} profile photo`}
                          className="h-full w-full object-cover"
                          style={{ transform: "scale(1.08)" }}
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      {currentNom.type === "member" && (
                        <>
                          <div className="text-[15px] font-bold text-white">{currentNom.memberName}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--cyan)" }}>{currentNom.memberRole}</div>
                          {currentMember && (
                            <div className="text-[10px] mt-1 uppercase tracking-wide" style={{ color: scopeColor(currentMember.influenceScope) }}>
                              {fitLabel(currentMember)} · PENGARUH {scopeLabel(currentMember.influenceScope)}
                            </div>
                          )}
                        </>
                      )}
                      {currentNom.type === "none" && (
                        <>
                          <div className="text-[15px] font-bold" style={{ color: "var(--neon-red)" }}>TIADA CALON — WALKOVER</div>
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Kerusi ini tidak dipertandingkan</div>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => assign(null)}
                    className="text-[11px] px-3 py-1 tracking-widest uppercase shrink-0"
                    style={{ border: "1px solid var(--neon-red)", color: "var(--neon-red)", background: "rgba(255,68,68,0.06)", cursor: "pointer" }}
                  >
                    CLEAR
                  </button>
                </div>
              )}
            </div>

            {/* Walkover option */}
            <div className="flex gap-2">
              <button
                onClick={() => assign({ type: "none" })}
                className="flex-1 py-2 text-[12px] font-bold tracking-widest uppercase"
                style={{
                  border: currentNom?.type === "none" ? "1px solid var(--neon-red)" : "1px solid rgba(255,68,68,0.22)",
                  color: currentNom?.type === "none" ? "var(--neon-red)" : "var(--text-muted)",
                  background: currentNom?.type === "none" ? "rgba(255,68,68,0.06)" : "transparent",
                  cursor: "pointer",
                }}
              >
                ✗ TIADA CALON
              </button>
            </div>

            {/* Member grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] tracking-widest uppercase font-bold" style={{ color: "var(--text-muted)" }}>
                  AHLI PARTI — PILIH UNTUK DICALONKAN
                </div>
                <div className="text-[10px]" style={{ color: "#4a5568" }}>
                  {candidatePool.filter((m) => !memberAssignments[m.id]).length}/{candidatePool.length} TERSEDIA · {candidatePool.filter((m) => m.influenceScope === "national").length} NASIONAL · {candidatePool.filter(isLocalMember).length} ANAK NEGERI
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {sortedMembers.map((member) => {
                  const assignedTo = memberAssignments[member.id];
                  const isHere = assignedTo === selectedConstId;
                  const isElsewhere = !!assignedTo && !isHere;

                  const borderColor = isHere
                    ? "var(--cyan)"
                    : isElsewhere
                    ? "rgb(var(--gold-rgb)/0.4)"
                    : "rgb(var(--cyan-rgb)/0.14)";
                  const bgColor = isHere
                    ? "rgb(var(--cyan-rgb)/0.08)"
                    : isElsewhere
                    ? "rgb(var(--gold-rgb)/0.04)"
                    : "transparent";
                  const statusColor = isHere ? "var(--cyan)" : isElsewhere ? "var(--gold)" : "var(--neon-green)";
                  const statusLabel = isHere ? "KERUSI INI" : isElsewhere ? "PINDAH →" : "TERSEDIA";
                  const elseWhereName = isElsewhere ? (allConsts[assignedTo]?.name ?? assignedTo) : "";
                  const local = isLocalMember(member);
                  const district = isDistrictMember(member);
                  const scope = scopeLabel(member.influenceScope);
                  const scopeTone = scopeColor(member.influenceScope);
                  const fit = fitLabel(member);
                  const portrait = candidatePortrait(member);

                  return (
                    <button
                      key={member.id}
                      onClick={() => {
                        if (!isHere) {
                          assign({ type: "member", memberId: member.id, memberName: member.name, memberRole: member.role });
                        }
                      }}
                      disabled={isHere}
                      className="p-3 text-left transition-all"
                      style={{ border: `1px solid ${borderColor}`, background: bgColor, cursor: isHere ? "default" : "pointer" }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="relative h-[74px] w-[58px] shrink-0 overflow-hidden"
                          style={{
                            border: `1px solid ${isHere ? "var(--cyan)" : local ? "var(--neon-green)" : "rgb(var(--cyan-rgb)/0.28)"}`,
                            background: "linear-gradient(135deg, rgba(0,212,255,0.08), rgba(255,178,44,0.06))",
                            boxShadow: isHere ? "0 0 18px rgb(var(--cyan-rgb)/0.22)" : "none",
                          }}
                        >
                          <img
                            src={portrait}
                            alt={`${member.name} profile photo`}
                            className="h-full w-full object-cover"
                            style={{ transform: "scale(1.08)", filter: isElsewhere ? "grayscale(0.35) brightness(0.78)" : "none" }}
                          />
                          <div className="absolute inset-x-0 bottom-0 px-1 py-0.5 text-center text-[7px] font-black tracking-[0.16em]" style={{ color: "#061018", background: local ? "var(--neon-green)" : "var(--cyan)" }}>
                            ID
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <div className="text-[12px] font-bold text-white leading-tight">{member.name}</div>
                            <div className="flex gap-1 shrink-0">
                              {(local || member.influenceScope === "national") && (
                                <span
                                  className="text-[8px] px-1 py-0.5 mt-0.5 uppercase tracking-wide"
                                  style={{ color: district ? "var(--neon-green)" : scopeTone, border: `1px solid ${district ? "rgb(var(--neon-green-rgb,21 128 61)/0.45)" : `${scopeTone}66`}`, background: district ? "rgb(var(--neon-green-rgb,21 128 61)/0.12)" : `${scopeTone}11` }}
                                  title={candidateEffectText(member)}
                                >
                                  {fit}
                                </span>
                              )}
                              <span
                                className="text-[8px] px-1 py-0.5 mt-0.5 uppercase tracking-wide"
                                style={{ color: expColor(member.experience), border: `1px solid ${expColor(member.experience)}44`, background: `${expColor(member.experience)}11` }}
                              >
                                {expLabel(member.experience)}
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>{member.role}</div>
                          <div className="text-[9px] mb-1 uppercase tracking-wide" style={{ color: local ? "var(--neon-green)" : "#4a5568" }}>
                            ASAL/MENETAP: {gameStates.find((s) => s.id === member.homeState)?.shortName ?? member.homeState.toUpperCase()}{member.homeConstituency ? ` · ${member.homeConstituency}` : ""}
                          </div>
                          <div className="text-[9px] mb-2 uppercase tracking-wide" style={{ color: scopeTone }}>
                            PENGARUH {scope} · {candidateEffectText(member)}
                          </div>

                          <div className="space-y-1 mb-2">
                            {([["INFL", member.influence, "var(--cyan)"], ["CHAR", member.charisma, "var(--gold)"], ["CRED", member.credibility, "var(--neon-green)"]] as [string, number, string][]).map(([key, val, color]) => (
                              <div key={key} className="flex items-center gap-1.5">
                                <span className="text-[9px] w-7 shrink-0" style={{ color: "#4a5568" }}>{key}</span>
                                <div className="flex-1 h-1" style={{ background: "var(--bar-empty)" }}>
                                  <div className="h-1" style={{ width: `${val}%`, background: color }} />
                                </div>
                                <span className="text-[9px] w-5 text-right" style={{ color }}>{val}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] uppercase tracking-wide" style={{ color: "#4a5568" }}>{member.specialty}</span>
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 truncate"
                              style={{ maxWidth: "130px", color: statusColor, background: `${statusColor}11`, border: `1px solid ${statusColor}33` }}
                              title={isElsewhere ? `PINDAH → ${elseWhereName}` : statusLabel}
                            >
                              {isElsewhere ? `PINDAH → ${elseWhereName}` : statusLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Campaign Page ──────────────────────────────────────────────────────────────

const TAB_LABELS: Record<Tab, [string, string]> = {
  "NOMINATION":  ["PENAMAAN", "NOMINATION"],
  "MINI-GAMES":  ["MINI-PERMAINAN", "MINI-GAMES"],
  "OPERATIONS":  ["OPERASI", "OPERATIONS"],
  "VOLUNTEERS":  ["SUKARELAWAN", "VOLUNTEERS"],
  "RESOURCES":   ["SUMBER", "RESOURCES"],
  "SCHEDULE":    ["JADUAL", "SCHEDULE"],
  "MESSAGING":   ["PESANAN", "MESSAGING"],
};

export default function CampaignPage() {
  const lang = useLang();
  const [activeTab, setActiveTab] = useState<Tab>("NOMINATION");
  const [expandedOp, setExpandedOp] = useState<string | null>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [selectedMiniGameState, setSelectedMiniGameState] = useState("selangor");
  const [miniGameType, setMiniGameType] = useState<MiniGameType>("ceramah");
  const [recruitDone, setRecruitDone] = useState(false);
  const { operations, resources, states: gameStates, removeOperation, runCampaignMiniGame } = useGameStore();
  const router = useRouter();

  const activeOpsCount = operations.filter((o) => o.status === "active" || o.status === "ongoing").length;
  const plannedOpsCount = operations.filter((o) => o.status === "planned").length;
  const miniGameState = gameStates.find((s) => s.id === selectedMiniGameState) ?? gameStates[0];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", fontFamily: "'Space Mono', monospace" }}>
      <Header />
      <StatusBar leftText="» CAMPAIGN HQ · OPERATIONS COMMAND" rightText="TAB: SWITCH PANEL · ↵ SELECT" />

      {showDeployModal && <DeployModal onClose={() => setShowDeployModal(false)} />}

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
              {t(lang, ...TAB_LABELS[tab])}
            </button>
          ))}
        </div>

        {/* NOMINATION TAB */}
        {activeTab === "NOMINATION" && <NominationTab />}

        {/* MINI-GAMES TAB */}
        {activeTab === "MINI-GAMES" && (
          <div className="grid grid-cols-[340px_1fr] gap-4">
            <TacticalPanel title="MINI-GAME TARGET">
              <div className="flex gap-2 mb-3">
                {(["ceramah", "social"] as MiniGameType[]).map((type) => (
                  <button key={type} onClick={() => setMiniGameType(type)} className="flex-1 py-2 text-[12px] font-bold tracking-widest uppercase" style={{ border: miniGameType === type ? "1px solid var(--gold)" : "1px solid rgb(var(--cyan-rgb)/0.18)", color: miniGameType === type ? "var(--gold)" : "var(--text-muted)", background: miniGameType === type ? "rgb(var(--gold-rgb)/0.08)" : "transparent" }}>{type}</button>
                ))}
              </div>
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
                {gameStates.map((s) => (
                  <button key={s.id} onClick={() => setSelectedMiniGameState(s.id)} className="w-full px-3 py-2 text-left text-[12px]" style={{ border: selectedMiniGameState === s.id ? "1px solid var(--cyan)" : "1px solid rgb(var(--cyan-rgb)/0.12)", color: selectedMiniGameState === s.id ? "#fff" : "var(--text-muted)", background: selectedMiniGameState === s.id ? "rgb(var(--cyan-rgb)/0.07)" : "transparent" }}>
                    <div className="flex justify-between"><span className="font-bold">{s.name}</span><span>{s.mandatSupport}%</span></div>
                    <div className="mt-1 h-1.5" style={{ background: "var(--bar-empty)" }}><div className="h-1.5" style={{ width: `${s.mandatSupport}%`, background: "var(--cyan)" }} /></div>
                  </button>
                ))}
              </div>
            </TacticalPanel>

            <TacticalPanel title={`${miniGameType === "ceramah" ? "CERAMAH MINI-GAME" : "SOCIAL MEDIA MINI-GAME"} — ${miniGameState?.name.toUpperCase() ?? "STATE"}`}>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="border p-3" style={{ borderColor: "rgb(var(--cyan-rgb)/0.16)" }}><div className="text-[10px] text-text-muted">AUDIENCE FIT</div><div className="text-xl font-black" style={{ color: "var(--cyan)" }}>{miniGameType === "ceramah" ? `${miniGameState?.demographics.rural}% RURAL` : `${miniGameState?.demographics.youth}% YOUTH`}</div></div>
                <div className="border p-3" style={{ borderColor: "rgb(var(--cyan-rgb)/0.16)" }}><div className="text-[10px] text-text-muted">MEDIA BUY</div><div className="text-xl font-black" style={{ color: "var(--gold)" }}>{resources.mediaBuy}</div></div>
                <div className="border p-3" style={{ borderColor: "rgb(var(--cyan-rgb)/0.16)" }}><div className="text-[10px] text-text-muted">FUNDS</div><div className="text-xl font-black" style={{ color: "var(--neon-green)" }}>{formatRM(resources.funds)}</div></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(MINI_GAME_TACTICS) as MiniGameTactic[]).map((tactic) => {
                  const option = MINI_GAME_TACTICS[tactic];
                  return (
                    <button key={tactic} onClick={() => miniGameState && runCampaignMiniGame(miniGameState.id, miniGameType, tactic)} className="p-5 text-left transition-all hover:scale-[1.01]" style={{ border: `1px solid ${option.color}55`, background: `${option.color}0d`, cursor: "pointer" }}>
                      <div className="text-[13px] font-black tracking-widest" style={{ color: option.color }}>{option.title}</div>
                      <div className="mt-2 min-h-[52px] text-[11px] leading-5" style={{ color: "#9fb0c2" }}>{t(lang, option.descMS, option.descEN)}</div>
                      <div className="mt-3 text-[10px] font-bold" style={{ color: option.color }}>{option.risk}</div>
                      <div className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>{miniGameType === "ceramah" ? "RM75K · 42 MAN" : "RM45K · 65 MEDIA"}</div>
                    </button>
                  );
                })}
              </div>
            </TacticalPanel>
          </div>
        )}

        {/* OPERATIONS TAB */}
        {activeTab === "OPERATIONS" && (
          <div className="flex gap-4">
            {/* Left Column ~55% */}
            <div className="flex flex-col gap-4" style={{ flex: "0 0 55%" }}>

              {/* Active Operations */}
              <TacticalPanel title="ACTIVE OPERATIONS">
                <div className="flex flex-col gap-1">
                  {operations.length === 0 && (
                    <div className="text-center py-6 text-[12px] tracking-widest" style={{ color: "#4a5568" }}>
                      NO OPERATIONS DEPLOYED
                    </div>
                  )}
                  {operations.map((op) => (
                    <div key={op.id}>
                      <div
                        className="flex items-center gap-3 py-2 px-2 cursor-pointer transition-colors rounded-sm"
                        style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.08)" }}
                        onClick={() => setExpandedOp(expandedOp === op.id ? null : op.id)}
                      >
                        <StatusDot status={op.status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-white text-[13px] font-bold tracking-wider uppercase truncate">{op.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <StatusBadge status={op.status} />
                              <button
                                onClick={(e) => { e.stopPropagation(); removeOperation(op.id); }}
                                className="text-[17px] leading-none transition-colors"
                                style={{ color: "#4a5568", cursor: "pointer" }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neon-red)")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "#4a5568")}
                                title="Cancel operation"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{op.location}</span>
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {op.manpowerCost} MAN · {formatRM(op.fundsCost)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {expandedOp === op.id && (
                        <div className="px-6 py-2 text-[12px]" style={{ color: "var(--text-muted)", background: "rgb(var(--cyan-rgb) / 0.03)", borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.08)" }}>
                          <span style={{ color: "var(--cyan)" }}>TYPE:</span> {op.type.toUpperCase()} &nbsp;|&nbsp;
                          <span style={{ color: "var(--cyan)" }}>SUPPORT GAIN:</span> +{op.supportGain}%/day &nbsp;|&nbsp;
                          <span style={{ color: "var(--cyan)" }}>STATES:</span> {op.stateIds.map(s => s.toUpperCase()).join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setShowDeployModal(true)}
                  className="mt-3 w-full py-2 text-[12px] tracking-widest uppercase transition-colors"
                  style={{
                    border: "1px dashed rgb(var(--cyan-rgb) / 0.3)",
                    color: "var(--text-muted)",
                    background: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "var(--cyan)"; (e.target as HTMLElement).style.borderColor = "rgb(var(--cyan-rgb) / 0.7)"; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "var(--text-muted)"; (e.target as HTMLElement).style.borderColor = "rgb(var(--cyan-rgb) / 0.3)"; }}
                >
                  + DEPLOY OPERATION
                </button>
              </TacticalPanel>

              {/* Mini Map */}
              <TacticalPanel title="OPERATIONAL MAP">
                <MalaysiaMap states={gameStates} compact={true} />
              </TacticalPanel>
            </div>

            {/* Right Column ~45% */}
            <div className="flex flex-col gap-4" style={{ flex: "1" }}>

              {/* Resource Allocation — live from store */}
              <TacticalPanel title="RESOURCE ALLOCATION">
                <div className="flex flex-col gap-3">
                  <StatBar label="MANPOWER" value={resources.manpower} max={1000} color="var(--cyan)" animate={true} />
                  <StatBar label="VEHICLES" value={resources.vehicles} max={500} color="var(--gold)" animate={true} />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>BUDGET</span>
                      <span className="text-[13px] font-bold" style={{ color: "var(--neon-green)" }}>
                        {formatRM(resources.funds)} / RM 5.0M
                      </span>
                    </div>
                    <div className="h-2 w-full" style={{ background: "var(--bar-empty)" }}>
                      <div
                        className="h-2 transition-all duration-[1500ms] ease-out"
                        style={{ width: `${Math.min(100, (resources.funds / 5000000) * 100)}%`, background: "var(--neon-green)" }}
                      />
                    </div>
                  </div>
                  <StatBar label="MATERIALS" value={resources.materials} max={1000} color="var(--warn-orange)" animate={true} />
                  <StatBar label="MEDIA BUY" value={resources.mediaBuy} max={1000} color="#8b5cf6" animate={true} />
                </div>
              </TacticalPanel>

              {/* Upcoming Events */}
              <TacticalPanel title="UPCOMING EVENTS">
                <div className="flex flex-col gap-2">
                  {UPCOMING_EVENTS.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 py-1.5" style={{ borderBottom: i < 2 ? "1px solid rgb(var(--cyan-rgb) / 0.08)" : "none" }}>
                      <span className="text-[12px] font-bold shrink-0" style={{ color: "var(--gold)", minWidth: "52px" }}>{ev.date}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white tracking-wider uppercase">{ev.event}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{ev.location}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </TacticalPanel>

              {/* Operation Status — live counts */}
              <TacticalPanel title="OPERATION STATUS">
                <div className="flex h-4 w-full rounded-sm overflow-hidden mb-3">
                  {operations.length > 0 ? (
                    <>
                      <div style={{ width: `${(activeOpsCount / operations.length) * 100}%`, background: "var(--cyan)", opacity: 0.85 }} />
                      <div style={{ width: `${(plannedOpsCount / operations.length) * 100}%`, background: "#4a5568", opacity: 0.85 }} />
                    </>
                  ) : (
                    <div style={{ width: "100%", background: "var(--bar-empty)" }} />
                  )}
                </div>
                <div className="flex justify-between text-[11px] tracking-wider mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2" style={{ background: "var(--cyan)" }} />
                    <span style={{ color: "var(--cyan)" }}>ACTIVE/ONGOING</span>
                    <span className="text-white font-bold">{activeOpsCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2" style={{ background: "#4a5568" }} />
                    <span style={{ color: "var(--text-muted)" }}>PLANNED</span>
                    <span className="text-white font-bold">{plannedOpsCount}</span>
                  </div>
                </div>
                <div className="text-center text-[12px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                  TOTAL: <span className="text-white font-bold">{operations.length} OPS</span>
                </div>
              </TacticalPanel>
            </div>
          </div>
        )}

        {/* VOLUNTEERS TAB */}
        {activeTab === "VOLUNTEERS" && (
          <TacticalPanel title="VOLUNTEER DEPLOYMENT">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.3)" }}>
                    {["REGION", "VOLUNTEERS", "TARGET", "% FILLED"].map((h) => (
                      <th key={h} className="py-2 px-3 text-left tracking-widest uppercase" style={{ color: "var(--gold)", fontWeight: "normal" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {VOLUNTEER_DATA.map((row, i) => {
                    const pct = Math.round((row.volunteers / row.target) * 100);
                    const pctColor = pct >= 80 ? "var(--neon-green)" : pct >= 60 ? "var(--gold)" : "var(--neon-red)";
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.08)" }} className="hover:bg-cyan/5 transition-colors">
                        <td className="py-2 px-3 text-white uppercase tracking-wider">{row.region}</td>
                        <td className="py-2 px-3 font-bold" style={{ color: "var(--cyan)" }}>{row.volunteers}</td>
                        <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>{row.target}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5" style={{ background: "var(--bar-empty)", minWidth: "60px" }}>
                              <div className="h-1.5" style={{ width: `${pct}%`, background: pctColor }} />
                            </div>
                            <span className="font-bold" style={{ color: pctColor }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              className="mt-4 px-6 py-2 text-[13px] tracking-widest uppercase font-bold transition-opacity hover:opacity-80"
              style={{ background: recruitDone ? "var(--neon-green)" : "var(--gold)", color: "#000", cursor: "pointer" }}
              onClick={() => {
                setRecruitDone(true);
                setTimeout(() => setRecruitDone(false), 2000);
              }}
            >
              {recruitDone ? t(lang, "✓ DIREKRUT", "✓ RECRUITED") : t(lang, "+ REKRUT SUKARELAWAN", "+ RECRUIT VOLUNTEERS")}
            </button>
          </TacticalPanel>
        )}

        {/* RESOURCES TAB */}
        {activeTab === "RESOURCES" && (
          <div className="flex flex-col gap-4">
            <TacticalPanel title="BUDGET ALLOCATION">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.3)" }}>
                      {["CATEGORY", "ALLOCATED", "SPENT", "REMAINING"].map((h) => (
                        <th key={h} className="py-2 px-3 text-left tracking-widest uppercase" style={{ color: "var(--gold)", fontWeight: "normal" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {BUDGET_DATA.map((row, i) => {
                      const remaining = row.allocated - row.spent;
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.08)" }} className="hover:bg-cyan/5 transition-colors">
                          <td className="py-2 px-3 text-white uppercase tracking-wider">{row.category}</td>
                          <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>{formatRM(row.allocated)}</td>
                          <td className="py-2 px-3 font-bold" style={{ color: "var(--warn-orange)" }}>{formatRM(row.spent)}</td>
                          <td className="py-2 px-3 font-bold" style={{ color: "var(--neon-green)" }}>{formatRM(remaining)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.2)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>TOTAL CAMPAIGN FUNDS</span>
                  <span className="text-[13px] font-bold" style={{ color: "var(--neon-green)" }}>{formatRM(resources.funds)} REMAINING</span>
                </div>
                <div className="h-3 w-full" style={{ background: "var(--bar-empty)" }}>
                  <div
                    className="h-3 transition-all duration-[1500ms]"
                    style={{ width: `${Math.min(100, (resources.funds / 5000000) * 100)}%`, background: "linear-gradient(90deg, var(--gold), var(--neon-green))" }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <span>0</span>
                  <span>RM 5.0M</span>
                </div>
              </div>
            </TacticalPanel>
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === "SCHEDULE" && (
          <TacticalPanel title="CAMPAIGN SCHEDULE">
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="text-[13px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                FULL CAMPAIGN SCHEDULE WITH EVENT MANAGEMENT
              </div>
              <button
                onClick={() => router.push("/calendar")}
                className="px-8 py-3 text-[16px] tracking-widest uppercase font-bold transition-opacity hover:opacity-80"
                style={{ background: "var(--gold)", color: "#000", cursor: "pointer" }}
              >
                VIEW FULL SCHEDULE →
              </button>
            </div>
          </TacticalPanel>
        )}

        {/* MESSAGING TAB */}
        {activeTab === "MESSAGING" && (
          <TacticalPanel title="MESSAGING CENTER">
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="text-[13px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                CRAFT AND DEPLOY CAMPAIGN MESSAGES ACROSS ALL CHANNELS
              </div>
              <button
                onClick={() => router.push("/messaging")}
                className="px-8 py-3 text-[16px] tracking-widest uppercase font-bold transition-opacity hover:opacity-80"
                style={{ background: "var(--gold)", color: "#000", cursor: "pointer" }}
              >
                VIEW MESSAGING CENTER →
              </button>
            </div>
          </TacticalPanel>
        )}
      </main>
    </div>
  );
}
