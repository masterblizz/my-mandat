"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import StatBar from "../components/ui/StatBar";
import MalaysiaMap from "../components/map/MalaysiaMap";
import StateDunMap from "../components/map/StateDunMap";
import { useGameStore, Operation, NominationEntry } from "../store/gameStore";
import { generateConstituencies, Constituency } from "../data/constituencies";
import type { StateData } from "../data/states";
import { PARTY_MEMBERS, PartyMember } from "../data/members";
import { buildCandidateFalloutReaction } from "../data/politicalReactions";
import { useLang, t, type Lang } from "../i18n/useLang";
import type { MiniGameTactic, MiniGameType } from "../store/campaignMath";
import CeramahSceneModal from "../components/campaign/CeramahSceneModal";

type Tab = "NOMINATION" | "MINI-GAMES" | "OPERATIONS" | "VOLUNTEERS" | "RESOURCES" | "SCHEDULE" | "MESSAGING";

const TABS: Tab[] = ["NOMINATION", "MINI-GAMES", "OPERATIONS", "VOLUNTEERS", "RESOURCES", "SCHEDULE", "MESSAGING"];

const MINI_GAME_TACTICS: Record<MiniGameTactic, { titleMS: string; titleEN: string; descMS: string; descEN: string; riskMS: string; riskEN: string; color: string }> = {
  safe: { titleMS: "MESEJ SELAMAT", titleEN: "SAFE MESSAGE", descMS: "Mesej terkawal, stabil, risiko backlash rendah.", descEN: "Controlled, stable message. Low risk of backlash.", riskMS: "Risiko rendah / perolehan sederhana", riskEN: "Low risk / modest gain", color: "var(--neon-green)" },
  balanced: { titleMS: "TOLAKAN SEIMBANG", titleEN: "BALANCED PUSH", descMS: "Gabung janji dasar + attack line sederhana.", descEN: "Combine policy pledges with mild attack lines.", riskMS: "Risiko sederhana / perolehan baik", riskEN: "Medium risk / good gain", color: "var(--cyan)" },
  aggressive: { titleMS: "SERANGAN AGRESIF", titleEN: "AGGRESSIVE ATTACK", descMS: "Serangan narrative tajam. Gain tinggi tapi amaran media boleh muncul.", descEN: "Sharp narrative attack. High gain but media warnings may trigger.", riskMS: "Risiko tinggi / perolehan tinggi", riskEN: "High risk / high gain", color: "var(--warn-orange)" },
};

const UPCOMING_EVENTS = [
  { date: "28 MAY", eventMS: "CERAMAH MEGA — PAHANG", eventEN: "CERAMAH MEGA — PAHANG", location: "Kuantan, Pahang" },
  { date: "30 MAY", eventMS: "DEWAN TERBUKA BELIA", eventEN: "YOUTH TOWN HALL", location: "Petaling Jaya, Selangor" },
  { date: "02 JUN", eventMS: "SIDANG AKHBAR", eventEN: "PRESS CONFERENCE", location: "Kuala Lumpur" },
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

const OP_TEMPLATES: Record<OpType, { labelMS: string; labelEN: string; descMS: string; descEN: string; manpowerCost: number; fundsCost: number; supportGain: number }> = {
  ceramah:        { labelMS: "CERAMAH",         labelEN: "CERAMAH",         descMS: "Perhimpunan besar — kesan orang ramai tinggi.", descEN: "Mass rally — high crowd impact.", manpowerCost: 100, fundsCost: 120000, supportGain: 2.5 },
  "door-to-door": { labelMS: "RUMAH KE RUMAH",  labelEN: "DOOR-TO-DOOR",    descMS: "Hubungan langsung pengundi. Bina kepercayaan.", descEN: "Direct voter contact. Builds trust.", manpowerCost: 80,  fundsCost: 40000,  supportGain: 1.2 },
  youth:          { labelMS: "JANGKAUAN BELIA", labelEN: "YOUTH OUTREACH", descMS: "Libatkan pengundi kali pertama.", descEN: "Engage first-time voters.", manpowerCost: 50,  fundsCost: 30000,  supportGain: 1.8 },
  digital:        { labelMS: "DIGITAL",         labelEN: "DIGITAL",         descMS: "Media sosial & iklan dalam talian.", descEN: "Social media & online ads.", manpowerCost: 20,  fundsCost: 150000, supportGain: 1.0 },
  rural:          { labelMS: "LIBATAN LUAR BANDAR", labelEN: "RURAL ENGAGE", descMS: "Operasi lapangan di kawasan luar bandar.", descEN: "Ground ops in rural constituencies.", manpowerCost: 90,  fundsCost: 60000,  supportGain: 1.4 },
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

function StatusBadge({ status, lang }: { status: string; lang: Lang }) {
  if (status === "active") return (
    <span className="text-[11px] px-1.5 py-0.5 tracking-widest" style={{ color: "var(--neon-green)", background: "rgb(var(--neon-green-rgb,21 128 61) / 0.1)", border: "1px solid rgb(var(--neon-green-rgb,21 128 61) / 0.3)" }}>
      {t(lang, "AKTIF", "ACTIVE")}
    </span>
  );
  if (status === "ongoing") return (
    <span className="text-[11px] px-1.5 py-0.5 tracking-widest" style={{ color: "var(--gold)", background: "rgb(var(--gold-rgb) / 0.1)", border: "1px solid rgb(var(--gold-rgb) / 0.3)" }}>
      {t(lang, "BERTERUSAN", "ONGOING")}
    </span>
  );
  return (
    <span className="text-[11px] px-1.5 py-0.5 tracking-widest" style={{ color: "var(--text-muted)", background: "rgba(136,153,170,0.08)", border: "1px solid rgba(136,153,170,0.2)" }}>
      {t(lang, "DIRANCANG", "PLANNED")}
    </span>
  );
}

function DeployModal({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const { resources, states: gameStates, addOperation, settings } = useGameStore();
  const isPrn = settings.electionScope === "prn";
  const targetableStates = isPrn ? gameStates.filter((s) => s.id === settings.prnStateId) : gameStates;
  const [opType, setOpType] = useState<OpType>("ceramah");
  const [selectedStateIds, setSelectedStateIds] = useState<string[]>(() => isPrn ? [settings.prnStateId] : []);

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
      name: t(lang, template.labelMS, template.labelEN),
      type: opType,
      location: selectedNames || t(lang, "Seluruh Negara", "Nationwide"),
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
          <span className="text-[14px] font-bold tracking-widest uppercase" style={{ color: "var(--gold)" }}>{t(lang, "LANCAR OPERASI BAHARU", "DEPLOY NEW OPERATION")}</span>
          <button onClick={onClose} className="text-[22px] leading-none" style={{ color: "var(--text-muted)", cursor: "pointer" }}>×</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5">

          {/* Operation type */}
          <div>
            <div className="text-[12px] tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>{t(lang, "JENIS OPERASI", "OPERATION TYPE")}</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(OP_TEMPLATES) as OpType[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setOpType(opt)}
                  className="px-3 py-1.5 text-[12px] tracking-widest uppercase transition-colors"
                  style={{
                    border: opType === opt ? "1px solid var(--cyan)" : "1px solid rgb(var(--cyan-rgb) / 0.2)",
                    color: opType === opt ? "var(--cyan)" : "var(--text-muted)",
                    background: opType === opt ? "rgb(var(--cyan-rgb) / 0.08)" : "none",
                    cursor: "pointer",
                  }}
                >
                  {t(lang, OP_TEMPLATES[opt].labelMS, OP_TEMPLATES[opt].labelEN)}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
              {t(lang, template.descMS, template.descEN)}&nbsp;
              <span style={{ color: "var(--cyan)" }}>{t(lang, "Perolehan", "Gain")}: +{template.supportGain}%/{t(lang, "hari", "day")}</span>
              &nbsp;·&nbsp;
              <span style={{ color: canAffordManpower ? "var(--text-muted)" : "var(--neon-red)" }}>{template.manpowerCost} {t(lang, "TENAGA", "MAN")}</span>
              &nbsp;·&nbsp;
              <span style={{ color: canAffordFunds ? "var(--text-muted)" : "var(--neon-red)" }}>{formatRM(template.fundsCost)}</span>
            </div>
          </div>

          {/* State selection */}
          <div>
            <div className="text-[12px] tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>{t(lang, "NEGERI SASARAN", "TARGET STATES")} <span style={{ color: "#4a5568" }}>{isPrn ? t(lang, "(dikunci pada negeri PRN)", "(locked to PRN negeri)") : t(lang, "(pilih sekurang-kurangnya satu)", "(select at least one)")}</span></div>
            <div className="grid grid-cols-3 gap-1.5">
              {targetableStates.map((s) => {
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
              <span style={{ color: "var(--text-muted)" }}>{t(lang, "TENAGA TERSEDIA", "MANPOWER AVAIL")}: </span>
              <span style={{ color: canAffordManpower ? "var(--neon-green)" : "var(--neon-red)", fontWeight: "bold" }}>{resources.manpower}</span>
              <span style={{ color: "#4a5568" }}> / {t(lang, "perlu", "needs")} {template.manpowerCost}</span>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>{t(lang, "DANA TERSEDIA", "FUNDS AVAIL")}: </span>
              <span style={{ color: canAffordFunds ? "var(--neon-green)" : "var(--neon-red)", fontWeight: "bold" }}>{formatRM(resources.funds)}</span>
              <span style={{ color: "#4a5568" }}> / {t(lang, "perlu", "needs")} {formatRM(template.fundsCost)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-[13px] tracking-widest uppercase"
              style={{ border: "1px solid rgba(136,153,170,0.3)", color: "var(--text-muted)", background: "none", cursor: "pointer" }}
            >
              {t(lang, "BATAL", "CANCEL")}
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
              {t(lang, "LANCAR OPERASI", "DEPLOY OPERATION")}
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

const CANDIDATE_PORTRAIT_MAP: Map<string, string> = new Map([
  ["pm-001", "/candidate-portraits/v1/v1-001.png"],
  ["pm-002", "/candidate-portraits/v1/v1-005.png"],
  ["pm-003", "/candidate-portraits/v3/v3-001.png"],
  ["pm-004", "/candidate-portraits/v3/v3-010.png"],
  ["pm-005", "/candidate-portraits/v2/v2-001.png"],
  ["pm-006", "/candidate-portraits/v1/v1-002.png"],
  ["pm-007", "/candidate-portraits/v1/v1-014.png"],
  ["pm-008", "/candidate-portraits/v3/v3-002.png"],
  ["pm-009", "/candidate-portraits/v2/v2-002.png"],
  ["pm-010", "/candidate-portraits/v1/v1-003.png"],
  ["pm-011", "/candidate-portraits/v3/v3-003.png"],
  ["pm-012", "/candidate-portraits/v3/v3-013.png"],
  ["pm-013", "/candidate-portraits/v2/v2-003.png"],
  ["pm-014", "/candidate-portraits/v1/v1-025.png"],
  ["pm-015", "/candidate-portraits/v1/v1-004.png"],
  ["pm-016", "/candidate-portraits/v3/v3-014.png"],
  ["pm-017", "/candidate-portraits/v3/v3-004.png"],
  ["pm-018", "/candidate-portraits/v1/v1-006.png"],
  ["pm-019", "/candidate-portraits/v1/v1-028.png"],
  ["pm-020", "/candidate-portraits/v3/v3-005.png"],
  ["pm-021", "/candidate-portraits/v1/v1-007.png"],
  ["pm-022", "/candidate-portraits/v3/v3-006.png"],
  ["pm-023", "/candidate-portraits/v3/v3-018.png"],
  ["pm-024", "/candidate-portraits/v1/v1-008.png"],
  ["pm-025", "/candidate-portraits/v1/v1-031.png"],
  ["branch-johor-0", "/candidate-portraits/v3/v3-021.png"],
  ["branch-johor-1", "/candidate-portraits/v1/v1-032.png"],
  ["branch-johor-2", "/candidate-portraits/v3/v3-022.png"],
  ["branch-johor-3", "/candidate-portraits/v1/v1-037.png"],
  ["branch-johor-4", "/candidate-portraits/v3/v3-023.png"],
  ["branch-johor-5", "/candidate-portraits/v1/v1-038.png"],
  ["branch-johor-6", "/candidate-portraits/v3/v3-025.png"],
  ["branch-johor-7", "/candidate-portraits/v1/v1-041.png"],
  ["branch-johor-8", "/candidate-portraits/v3/v3-029.png"],
  ["branch-johor-9", "/candidate-portraits/v1/v1-042.png"],
  ["branch-johor-10", "/candidate-portraits/v3/v3-007.png"],
  ["branch-johor-11", "/candidate-portraits/v1/v1-009.png"],
  ["branch-johor-12", "/candidate-portraits/v3/v3-008.png"],
  ["branch-johor-13", "/candidate-portraits/v1/v1-010.png"],
  ["branch-johor-14", "/candidate-portraits/v3/v3-009.png"],
  ["branch-johor-15", "/candidate-portraits/v1/v1-011.png"],
  ["branch-johor-16", "/candidate-portraits/v3/v3-011.png"],
  ["branch-johor-17", "/candidate-portraits/v1/v1-012.png"],
  ["branch-johor-18", "/candidate-portraits/v3/v3-012.png"],
  ["branch-johor-19", "/candidate-portraits/v1/v1-013.png"],
  ["branch-johor-20", "/candidate-portraits/v3/v3-033.png"],
  ["branch-johor-21", "/candidate-portraits/v1/v1-045.png"],
  ["branch-johor-22", "/candidate-portraits/v3/v3-037.png"],
  ["branch-johor-23", "/candidate-portraits/v1/v1-051.png"],
  ["branch-johor-24", "/candidate-portraits/v3/v3-039.png"],
  ["branch-johor-25", "/candidate-portraits/v1/v1-056.png"],
  ["branch-kedah-0", "/candidate-portraits/v3/v3-015.png"],
  ["branch-kedah-1", "/candidate-portraits/v1/v1-015.png"],
  ["branch-kedah-2", "/candidate-portraits/v3/v3-016.png"],
  ["branch-kedah-3", "/candidate-portraits/v1/v1-016.png"],
  ["branch-kedah-4", "/candidate-portraits/v3/v3-017.png"],
  ["branch-kedah-5", "/candidate-portraits/v1/v1-017.png"],
  ["branch-kedah-6", "/candidate-portraits/v3/v3-019.png"],
  ["branch-kedah-7", "/candidate-portraits/v1/v1-018.png"],
  ["branch-kedah-8", "/candidate-portraits/v3/v3-020.png"],
  ["branch-kedah-9", "/candidate-portraits/v1/v1-019.png"],
  ["branch-kedah-10", "/candidate-portraits/v3/v3-040.png"],
  ["branch-kedah-11", "/candidate-portraits/v1/v1-058.png"],
  ["branch-kedah-12", "/candidate-portraits/v3/v3-043.png"],
  ["branch-kedah-13", "/candidate-portraits/v1/v1-060.png"],
  ["branch-kedah-14", "/candidate-portraits/v3/v3-045.png"],
  ["branch-kelantan-0", "/candidate-portraits/v3/v3-024.png"],
  ["branch-kelantan-1", "/candidate-portraits/v1/v1-020.png"],
  ["branch-kelantan-2", "/candidate-portraits/v3/v3-026.png"],
  ["branch-kelantan-3", "/candidate-portraits/v1/v1-021.png"],
  ["branch-kelantan-4", "/candidate-portraits/v3/v3-027.png"],
  ["branch-kelantan-5", "/candidate-portraits/v1/v1-022.png"],
  ["branch-kelantan-6", "/candidate-portraits/v3/v3-028.png"],
  ["branch-kelantan-7", "/candidate-portraits/v1/v1-023.png"],
  ["branch-kelantan-8", "/candidate-portraits/v3/v3-030.png"],
  ["branch-kelantan-9", "/candidate-portraits/v1/v1-024.png"],
  ["branch-kelantan-10", "/candidate-portraits/v1/v1-062.png"],
  ["branch-kelantan-11", "/candidate-portraits/v3/v3-046.png"],
  ["branch-kelantan-12", "/candidate-portraits/v1/v1-067.png"],
  ["branch-kelantan-13", "/candidate-portraits/v3/v3-049.png"],
  ["branch-melaka-0", "/candidate-portraits/v1/v1-069.png"],
  ["branch-melaka-1", "/candidate-portraits/v3/v3-052.png"],
  ["branch-melaka-2", "/candidate-portraits/v1/v1-077.png"],
  ["branch-melaka-3", "/candidate-portraits/v3/v3-054.png"],
  ["branch-melaka-4", "/candidate-portraits/v1/v1-078.png"],
  ["branch-melaka-5", "/candidate-portraits/v3/v3-055.png"],
  ["branch-ns-0", "/candidate-portraits/v1/v1-079.png"],
  ["branch-ns-1", "/candidate-portraits/v3/v3-058.png"],
  ["branch-ns-2", "/candidate-portraits/v1/v1-080.png"],
  ["branch-ns-3", "/candidate-portraits/v3/v3-062.png"],
  ["branch-ns-4", "/candidate-portraits/v1/v1-081.png"],
  ["branch-ns-5", "/candidate-portraits/v3/v3-065.png"],
  ["branch-ns-6", "/candidate-portraits/v1/v1-083.png"],
  ["branch-ns-7", "/candidate-portraits/v3/v3-066.png"],
  ["branch-pahang-0", "/candidate-portraits/v1/v1-086.png"],
  ["branch-pahang-1", "/candidate-portraits/v3/v3-068.png"],
  ["branch-pahang-2", "/candidate-portraits/v1/v1-088.png"],
  ["branch-pahang-3", "/candidate-portraits/v3/v3-069.png"],
  ["branch-pahang-4", "/candidate-portraits/v1/v1-090.png"],
  ["branch-pahang-5", "/candidate-portraits/v3/v3-070.png"],
  ["branch-pahang-6", "/candidate-portraits/v1/v1-092.png"],
  ["branch-pahang-7", "/candidate-portraits/v3/v3-077.png"],
  ["branch-pahang-8", "/candidate-portraits/v1/v1-095.png"],
  ["branch-pahang-9", "/candidate-portraits/v3/v3-079.png"],
  ["branch-pahang-10", "/candidate-portraits/v3/v3-031.png"],
  ["branch-pahang-11", "/candidate-portraits/v1/v1-026.png"],
  ["branch-pahang-12", "/candidate-portraits/v3/v3-032.png"],
  ["branch-pahang-13", "/candidate-portraits/v1/v1-027.png"],
  ["branch-perak-0", "/candidate-portraits/v1/v1-097.png"],
  ["branch-perak-1", "/candidate-portraits/v3/v3-081.png"],
  ["branch-perak-2", "/candidate-portraits/v1/v1-098.png"],
  ["branch-perak-3", "/candidate-portraits/v3/v3-085.png"],
  ["branch-perak-4", "/candidate-portraits/v1/v1-102.png"],
  ["branch-perak-5", "/candidate-portraits/v3/v3-086.png"],
  ["branch-perak-6", "/candidate-portraits/v1/v1-103.png"],
  ["branch-perak-7", "/candidate-portraits/v3/v3-089.png"],
  ["branch-perak-8", "/candidate-portraits/v1/v1-105.png"],
  ["branch-perak-9", "/candidate-portraits/v3/v3-100.png"],
  ["branch-perak-10", "/candidate-portraits/v3/v3-034.png"],
  ["branch-perak-11", "/candidate-portraits/v1/v1-029.png"],
  ["branch-perak-12", "/candidate-portraits/v3/v3-035.png"],
  ["branch-perak-13", "/candidate-portraits/v1/v1-030.png"],
  ["branch-perak-14", "/candidate-portraits/v3/v3-036.png"],
  ["branch-perak-15", "/candidate-portraits/v1/v1-033.png"],
  ["branch-perak-16", "/candidate-portraits/v3/v3-038.png"],
  ["branch-perak-17", "/candidate-portraits/v1/v1-034.png"],
  ["branch-perak-18", "/candidate-portraits/v3/v3-041.png"],
  ["branch-perak-19", "/candidate-portraits/v1/v1-035.png"],
  ["branch-perak-20", "/candidate-portraits/v1/v1-106.png"],
  ["branch-perak-21", "/candidate-portraits/v3/v3-114.png"],
  ["branch-perak-22", "/candidate-portraits/v1/v1-107.png"],
  ["branch-perak-23", "/candidate-portraits/v3/v3-120.png"],
  ["branch-perlis-0", "/candidate-portraits/v1/v1-110.png"],
  ["branch-perlis-1", "/candidate-portraits/v3/v3-122.png"],
  ["branch-perlis-2", "/candidate-portraits/v1/v1-113.png"],
  ["branch-penang-0", "/candidate-portraits/v3/v3-042.png"],
  ["branch-penang-1", "/candidate-portraits/v1/v1-036.png"],
  ["branch-penang-2", "/candidate-portraits/v3/v3-044.png"],
  ["branch-penang-3", "/candidate-portraits/v1/v1-039.png"],
  ["branch-penang-4", "/candidate-portraits/v3/v3-047.png"],
  ["branch-penang-5", "/candidate-portraits/v1/v1-040.png"],
  ["branch-penang-6", "/candidate-portraits/v3/v3-048.png"],
  ["branch-penang-7", "/candidate-portraits/v1/v1-043.png"],
  ["branch-penang-8", "/candidate-portraits/v3/v3-050.png"],
  ["branch-penang-9", "/candidate-portraits/v1/v1-044.png"],
  ["branch-penang-10", "/candidate-portraits/v3/v3-129.png"],
  ["branch-penang-11", "/candidate-portraits/v1/v1-115.png"],
  ["branch-penang-12", "/candidate-portraits/v1/v1-117.png"],
  ["branch-sabah-0", "/candidate-portraits/v1/v1-119.png"],
  ["branch-sabah-1", "/candidate-portraits/v1/v1-122.png"],
  ["branch-sabah-2", "/candidate-portraits/v1/v1-124.png"],
  ["branch-sabah-3", "/candidate-portraits/v1/v1-128.png"],
  ["branch-sabah-4", "/candidate-portraits/v1/v1-130.png"],
  ["branch-sabah-5", "/candidate-portraits/v1/v1-133.png"],
  ["branch-sabah-6", "/candidate-portraits/v1/v1-138.png"],
  ["branch-sabah-7", "/candidate-portraits/v1/v1-139.png"],
  ["branch-sabah-8", "/candidate-portraits/v1/v1-140.png"],
  ["branch-sabah-9", "/candidate-portraits/v1/v1-142.png"],
  ["branch-sabah-10", "/candidate-portraits/v3/v3-051.png"],
  ["branch-sabah-11", "/candidate-portraits/v1/v1-046.png"],
  ["branch-sabah-12", "/candidate-portraits/v3/v3-053.png"],
  ["branch-sabah-13", "/candidate-portraits/v1/v1-047.png"],
  ["branch-sabah-14", "/candidate-portraits/v3/v3-056.png"],
  ["branch-sabah-15", "/candidate-portraits/v1/v1-048.png"],
  ["branch-sabah-16", "/candidate-portraits/v3/v3-057.png"],
  ["branch-sabah-17", "/candidate-portraits/v1/v1-049.png"],
  ["branch-sabah-18", "/candidate-portraits/v3/v3-059.png"],
  ["branch-sabah-19", "/candidate-portraits/v1/v1-050.png"],
  ["branch-sabah-20", "/candidate-portraits/v3/v3-021.png"],
  ["branch-sabah-21", "/candidate-portraits/v1/v1-032.png"],
  ["branch-sabah-22", "/candidate-portraits/v3/v3-022.png"],
  ["branch-sabah-23", "/candidate-portraits/v1/v1-037.png"],
  ["branch-sabah-24", "/candidate-portraits/v3/v3-023.png"],
  ["branch-sarawak-0", "/candidate-portraits/v1/v1-038.png"],
  ["branch-sarawak-1", "/candidate-portraits/v3/v3-025.png"],
  ["branch-sarawak-2", "/candidate-portraits/v1/v1-041.png"],
  ["branch-sarawak-3", "/candidate-portraits/v3/v3-029.png"],
  ["branch-sarawak-4", "/candidate-portraits/v1/v1-042.png"],
  ["branch-sarawak-5", "/candidate-portraits/v3/v3-033.png"],
  ["branch-sarawak-6", "/candidate-portraits/v1/v1-045.png"],
  ["branch-sarawak-7", "/candidate-portraits/v3/v3-037.png"],
  ["branch-sarawak-8", "/candidate-portraits/v1/v1-051.png"],
  ["branch-sarawak-9", "/candidate-portraits/v3/v3-039.png"],
  ["branch-sarawak-10", "/candidate-portraits/v3/v3-060.png"],
  ["branch-sarawak-11", "/candidate-portraits/v1/v1-052.png"],
  ["branch-sarawak-12", "/candidate-portraits/v3/v3-061.png"],
  ["branch-sarawak-13", "/candidate-portraits/v1/v1-053.png"],
  ["branch-sarawak-14", "/candidate-portraits/v3/v3-063.png"],
  ["branch-sarawak-15", "/candidate-portraits/v1/v1-054.png"],
  ["branch-sarawak-16", "/candidate-portraits/v3/v3-064.png"],
  ["branch-sarawak-17", "/candidate-portraits/v1/v1-055.png"],
  ["branch-sarawak-18", "/candidate-portraits/v3/v3-067.png"],
  ["branch-sarawak-19", "/candidate-portraits/v1/v1-057.png"],
  ["branch-sarawak-20", "/candidate-portraits/v1/v1-056.png"],
  ["branch-sarawak-21", "/candidate-portraits/v3/v3-040.png"],
  ["branch-sarawak-22", "/candidate-portraits/v1/v1-058.png"],
  ["branch-sarawak-23", "/candidate-portraits/v3/v3-043.png"],
  ["branch-sarawak-24", "/candidate-portraits/v1/v1-060.png"],
  ["branch-sarawak-25", "/candidate-portraits/v3/v3-045.png"],
  ["branch-sarawak-26", "/candidate-portraits/v1/v1-062.png"],
  ["branch-sarawak-27", "/candidate-portraits/v3/v3-046.png"],
  ["branch-sarawak-28", "/candidate-portraits/v1/v1-067.png"],
  ["branch-sarawak-29", "/candidate-portraits/v3/v3-049.png"],
  ["branch-sarawak-30", "/candidate-portraits/v3/v3-071.png"],
  ["branch-selangor-0", "/candidate-portraits/v1/v1-069.png"],
  ["branch-selangor-1", "/candidate-portraits/v3/v3-052.png"],
  ["branch-selangor-2", "/candidate-portraits/v1/v1-077.png"],
  ["branch-selangor-3", "/candidate-portraits/v3/v3-054.png"],
  ["branch-selangor-4", "/candidate-portraits/v1/v1-078.png"],
  ["branch-selangor-5", "/candidate-portraits/v3/v3-055.png"],
  ["branch-selangor-6", "/candidate-portraits/v1/v1-079.png"],
  ["branch-selangor-7", "/candidate-portraits/v3/v3-058.png"],
  ["branch-selangor-8", "/candidate-portraits/v1/v1-080.png"],
  ["branch-selangor-9", "/candidate-portraits/v3/v3-062.png"],
  ["branch-selangor-10", "/candidate-portraits/v1/v1-059.png"],
  ["branch-selangor-11", "/candidate-portraits/v3/v3-072.png"],
  ["branch-selangor-12", "/candidate-portraits/v1/v1-061.png"],
  ["branch-selangor-13", "/candidate-portraits/v3/v3-073.png"],
  ["branch-selangor-14", "/candidate-portraits/v1/v1-063.png"],
  ["branch-selangor-15", "/candidate-portraits/v3/v3-074.png"],
  ["branch-selangor-16", "/candidate-portraits/v1/v1-064.png"],
  ["branch-selangor-17", "/candidate-portraits/v3/v3-075.png"],
  ["branch-selangor-18", "/candidate-portraits/v1/v1-065.png"],
  ["branch-selangor-19", "/candidate-portraits/v3/v3-076.png"],
  ["branch-selangor-20", "/candidate-portraits/v1/v1-081.png"],
  ["branch-selangor-21", "/candidate-portraits/v3/v3-065.png"],
  ["branch-terengganu-0", "/candidate-portraits/v1/v1-066.png"],
  ["branch-terengganu-1", "/candidate-portraits/v3/v3-078.png"],
  ["branch-terengganu-2", "/candidate-portraits/v1/v1-068.png"],
  ["branch-terengganu-3", "/candidate-portraits/v3/v3-080.png"],
  ["branch-terengganu-4", "/candidate-portraits/v1/v1-070.png"],
  ["branch-terengganu-5", "/candidate-portraits/v3/v3-082.png"],
  ["branch-terengganu-6", "/candidate-portraits/v1/v1-071.png"],
  ["branch-terengganu-7", "/candidate-portraits/v3/v3-083.png"],
  ["branch-wp-0", "/candidate-portraits/v1/v1-083.png"],
  ["branch-wp-1", "/candidate-portraits/v3/v3-066.png"],
  ["branch-wp-2", "/candidate-portraits/v1/v1-086.png"],
  ["branch-wp-3", "/candidate-portraits/v3/v3-068.png"],
  ["branch-wp-4", "/candidate-portraits/v1/v1-088.png"],
  ["branch-wp-5", "/candidate-portraits/v3/v3-069.png"],
  ["branch-wp-6", "/candidate-portraits/v1/v1-090.png"],
  ["branch-wp-7", "/candidate-portraits/v3/v3-070.png"],
  ["branch-wp-8", "/candidate-portraits/v1/v1-092.png"],
  ["branch-wp-9", "/candidate-portraits/v3/v3-077.png"],
  ["branch-wp-10", "/candidate-portraits/v1/v1-072.png"],
  ["branch-wp-11", "/candidate-portraits/v3/v3-084.png"],
  ["branch-wp-12", "/candidate-portraits/v1/v1-073.png"],
]);

const CLEAN_PORTRAIT_POOL_SIZE = 144 + 3 + 132; // v1 + clean v2-001..003 + v3

function stablePortraitHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function portraitFromCleanPool(index: number): string {
  const normalized = ((index % CLEAN_PORTRAIT_POOL_SIZE) + CLEAN_PORTRAIT_POOL_SIZE) % CLEAN_PORTRAIT_POOL_SIZE;
  if (normalized < 144) return `/candidate-portraits/v1/v1-${String(normalized + 1).padStart(3, "0")}.png`;
  if (normalized < 147) return `/candidate-portraits/v2/v2-${String(normalized - 143).padStart(3, "0")}.png`;
  return `/candidate-portraits/v3/v3-${String(normalized - 146).padStart(3, "0")}.png`;
}

function candidatePortrait(member: PartyMember): string {
  const direct = CANDIDATE_PORTRAIT_MAP.get(member.id);
  if (direct) return direct;

  // PRN mode generates DUN-local ids like branch-selangor-dun-42, while the
  // curated portrait map originally covered PRU ids like branch-selangor-0.
  // Never return an empty image src; use the curated PRU equivalent first, then
  // a deterministic clean-pool fallback for DUN seats beyond the PRU count.
  const dunMatch = /^branch-([a-z]+)-dun-(\d+)$/.exec(member.id);
  if (dunMatch) {
    const [, stateId, indexText] = dunMatch;
    const parliamentEquivalent = `branch-${stateId}-${indexText}`;
    const equivalent = CANDIDATE_PORTRAIT_MAP.get(parliamentEquivalent);
    if (equivalent) return equivalent;

    const stateOffset = stablePortraitHash(stateId) % 173;
    return portraitFromCleanPool(25 + stateOffset + Number(indexText));
  }

  return portraitFromCleanPool(stablePortraitHash(member.id));
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
  const lang = useLang();
  const { states: gameStates, nominations, setNomination, applyCandidateFallout, day, leader, settings } = useGameStore();
  const isPrn = settings.electionScope === "prn";
  const seatScope = isPrn ? "dun" : "parliament";
  const seatLabel = isPrn ? "DUN" : t(lang, "PARLIMEN", "PARLIAMENT");
  const nominationStates = isPrn ? gameStates.filter((s) => s.id === settings.prnStateId) : gameStates;
  const initialStateId = (isPrn ? settings.prnStateId : gameStates[0]?.id) ?? "selangor";
  const firstSeatId = useCallback((stateId: string) => (isPrn ? `${stateId}-dun-0` : `${stateId}-0`), [isPrn]);
  const [selectedStateId, setSelectedStateId] = useState(initialStateId);
  const [selectedConstId, setSelectedConstId] = useState<string | null>(firstSeatId(initialStateId));
  const [advisorNote, setAdvisorNote] = useState(t(lang, "AI Advisor belum dijalankan. Cadangan akan isi kerusi kosong sahaja supaya pilihan player tidak ditimpa.", "AI Advisor has not run yet. Suggestions only fill empty seats — the player's existing picks are never overwritten."));

  const selectedState = gameStates.find((s) => s.id === selectedStateId);

  useEffect(() => {
    const validSelectedState = nominationStates.some((state) => state.id === selectedStateId);
    const nextStateId = isPrn ? settings.prnStateId : (validSelectedState ? selectedStateId : nominationStates[0]?.id);
    if (nextStateId && selectedStateId !== nextStateId) {
      setSelectedStateId(nextStateId);
      setSelectedConstId(firstSeatId(nextStateId));
    } else if (selectedConstId && selectedConstId.startsWith(`${selectedStateId}-`) && isPrn && !selectedConstId.startsWith(`${selectedStateId}-dun-`)) {
      setSelectedConstId(firstSeatId(selectedStateId));
    }
  }, [firstSeatId, isPrn, settings.prnStateId, nominationStates, selectedConstId, selectedStateId]);

  const constituencies = useMemo(
    () => (selectedState ? generateConstituencies(selectedState, seatScope) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedStateId, selectedState?.mandatSupport, selectedState?.lawanSupport, seatScope]
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
    return nominationStates.flatMap((state) =>
      generateConstituencies(state, seatScope).map((constituency) => ({ state, constituency }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nominationStates, seatScope]);

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
    for (const s of nominationStates) {
      for (const c of generateConstituencies(s, seatScope)) {
        map[c.id] = { name: c.name, stateShort: s.shortName };
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nominationStates, seatScope]);

  const stateProgress = (stateId: string) => {
    const s = gameStates.find((x) => x.id === stateId);
    if (!s) return { nominated: 0, total: 0 };
    const consts = generateConstituencies(s, seatScope);
    const nominated = consts.filter((c) => nominations[c.id] != null).length;
    return { nominated, total: consts.length };
  };

  const assign = (entry: NominationEntry | null) => {
    if (!selectedConstId) return;
    let fallout: { stateId: string; reaction: ReturnType<typeof buildCandidateFalloutReaction>; lawanBoost: number; othersBoost: number } | null = null;
    if (entry?.type === "member") {
      const prev = memberAssignments[entry.memberId];
      if (prev && prev !== selectedConstId) setNomination(prev, null);

      if (selectedConst && selectedState) {
        const seatName = selectedConst.name.toLowerCase();
        const snubbed = candidatePool
          .filter((member) => member.id !== entry.memberId && !memberAssignments[member.id])
          .map((member) => {
            const exactSeat = member.homeConstituency?.toLowerCase() === seatName;
            const sameState = member.homeState === selectedStateId;
            const seniority = member.experience === "veteran" ? 18 : member.experience === "rising" ? 10 : 0;
            const grievance = (exactSeat ? 70 : sameState ? 34 : 0) + member.influence * 0.55 + member.credibility * 0.25 + seniority;
            return { member, exactSeat, sameState, grievance };
          })
          .filter(({ member, exactSeat, sameState, grievance }) => exactSeat || (sameState && grievance >= 92) || (member.influenceScope === "national" && grievance >= 105))
          .sort((a, b) => b.grievance - a.grievance)[0];

        if (snubbed && snubbed.grievance >= 86) {
          const scenario = snubbed.exactSeat
            ? "independent"
            : snubbed.member.influence >= 80 || snubbed.member.credibility >= 84
              ? "opposition"
              : "sabotage";
          const reaction = buildCandidateFalloutReaction({
            day,
            constituencyName: selectedConst.name,
            stateId: selectedState.id,
            snubbedName: snubbed.member.name,
            snubbedRole: snubbed.member.role,
            selectedName: entry.memberName,
            influence: snubbed.member.influence,
            credibility: snubbed.member.credibility,
            scenario,
            partyAbbr: leader.partyAbbr,
          });
          fallout = {
            stateId: selectedState.id,
            reaction,
            lawanBoost: scenario === "opposition" ? 2 : scenario === "sabotage" ? 0.8 : 0.5,
            othersBoost: scenario === "independent" ? 2.3 : scenario === "sabotage" ? 0.4 : 0.5,
          };
        }
      }
    }
    setNomination(selectedConstId, entry);
    if (fallout) applyCandidateFallout(fallout.stateId, fallout.reaction, fallout.lawanBoost, fallout.othersBoost);
  };

  const scColor = (s: Constituency["safety"]) =>
    s === "safe" ? "var(--neon-green)" : s === "marginal" ? "var(--gold)" : "var(--neon-red)";
  const winColor = (w: Constituency["winner"]) =>
    w === "mandat" ? "var(--cyan)" : w === "lawan" ? "var(--warn-orange)" : "var(--text-muted)";
  const winLabel = (w: Constituency["winner"]) =>
    t(lang, w === "mandat" ? "KITA UNGGUL" : w === "lawan" ? "LAWAN UNGGUL" : "LAIN-LAIN", w === "mandat" ? "WE LEAD" : w === "lawan" ? "LAWAN LEADS" : "OTHERS");

  const expColor = (e: PartyMember["experience"]) =>
    e === "veteran" ? "var(--gold)" : e === "rising" ? "var(--cyan)" : "var(--text-muted)";
  const expLabel = (e: PartyMember["experience"]) =>
    t(lang, e === "veteran" ? "VETERAN" : e === "rising" ? "MENINGKAT" : "BAHARU", e === "veteran" ? "VETERAN" : e === "rising" ? "RISING" : "NEW");

  const nomBadge = (nom: NominationEntry | null | undefined) => {
    if (!nom) return { label: t(lang, "BELUM PILIH", "PENDING"), color: "#4a5568", bg: "transparent" };
    if (nom.type === "member") return { label: nom.memberName.split(" ").slice(-1)[0].toUpperCase(), color: "var(--cyan)", bg: "rgb(var(--cyan-rgb)/0.10)" };
    if (nom.type === "leader") return { label: t(lang, "PRESIDEN", "PRESIDENT"), color: "var(--gold)", bg: "rgb(var(--gold-rgb)/0.10)" };
    return { label: "WALKOVER", color: "var(--neon-red)", bg: "rgba(255,68,68,0.08)" };
  };

  const isLocalMember = (member: PartyMember) => member.homeState === selectedStateId;
  const isDistrictMember = (member: PartyMember) => !!selectedConst && member.homeConstituency?.toLowerCase() === selectedConst.name.toLowerCase();

  const scopeColor = (scope: PartyMember["influenceScope"]) =>
    scope === "national" ? "var(--gold)" : scope === "state" ? "var(--cyan)" : "var(--neon-green)";
  const scopeLabel = (scope: PartyMember["influenceScope"]) =>
    t(lang, scope === "national" ? "NASIONAL" : scope === "state" ? "NEGERI" : "DAERAH", scope === "national" ? "NATIONAL" : scope === "state" ? "STATE" : "DISTRICT");

  const fitLabel = (member: PartyMember) => {
    if (isDistrictMember(member)) return t(lang, "ANAK KAWASAN", "LOCAL TO SEAT");
    if (isLocalMember(member)) return t(lang, "ANAK NEGERI", "LOCAL TO STATE");
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
    if (isDistrictMember(member)) return t(lang, "+Daerah: akar umbi kuat di kerusi ini", "+District: strong grassroots in this seat");
    if (isLocalMember(member)) return t(lang, "+Negeri: jentera negeri lebih mudah digerakkan", "+State: state machinery mobilises more easily");
    if (member.influenceScope === "national") return t(lang, "+Nasional: nama besar tarik liputan media", "+National: big name draws media coverage");
    if (member.influenceScope === "state") return t(lang, "Pengaruh negeri: sesuai dalam negeri asal", "State influence: fits best in home state");
    return t(lang, "Pengaruh daerah: terbaik jika diletak di kawasan asal", "District influence: best placed in home constituency");
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
    const scopedToStateId = isPrn ? settings.prnStateId : selectedStateId;
    const pool = scope === "state" || isPrn
      ? allConstituencies.filter(({ state }) => state.id === scopedToStateId)
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

    const targetLabel = scope === "state"
      ? selectedState?.name ?? t(lang, "negeri ini", "this state")
      : (isPrn ? selectedState?.name ?? t(lang, "negeri PRN ini", "this PRN state") : t(lang, "seluruh negara", "the whole country"));
    setAdvisorNote(
      applied > 0
        ? t(lang,
            `AI Advisor cadangkan ${applied} calon untuk ${targetLabel}. Kerusi yang sudah ada calon tidak disentuh; player masih boleh clear, tukar atau pindahkan calon selepas ini.`,
            `AI Advisor suggested ${applied} candidates for ${targetLabel}. Seats that already have a candidate are untouched; you can still clear, swap, or move a candidate afterwards.`)
        : t(lang,
            `AI Advisor tidak mengubah apa-apa untuk ${targetLabel} kerana semua calon/kerusi sesuai sudah digunakan atau tiada slot kosong.`,
            `AI Advisor made no changes for ${targetLabel} — all suitable candidates/seats are already used or no empty slots remain.`)
    );
  };

  return (
    <div className="flex" style={{ minHeight: "calc(100vh - 160px)", borderTop: "1px solid rgb(var(--cyan-rgb)/0.12)" }}>

      {/* Col 1: State List */}
      <div style={{ width: "158px", borderRight: "1px solid rgb(var(--cyan-rgb)/0.12)", overflowY: "auto", flexShrink: 0 }}>
        {nominationStates.map((s) => {
          const { nominated, total } = stateProgress(s.id);
          const pct = total > 0 ? nominated / total : 0;
          const pColor = pct === 1 ? "var(--neon-green)" : pct > 0 ? "var(--gold)" : "#4a5568";
          const isActive = selectedStateId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => { setSelectedStateId(s.id); setSelectedConstId(firstSeatId(s.id)); }}
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
            {t(lang, `${selectedState?.name} — ${constituencies.length} KERUSI ${seatLabel}`, `${selectedState?.name} — ${constituencies.length} ${seatLabel} SEATS`)}
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
        <div className="mb-5 grid gap-4" style={{ gridTemplateColumns: isPrn ? "minmax(420px, 1.15fr) minmax(330px, 0.85fr)" : "1fr" }}>
          {isPrn && selectedState && (
            <div className="p-3" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.24)", background: "rgb(var(--cyan-rgb)/0.035)" }}>
              <StateDunMap
                state={selectedState}
                constituencies={constituencies}
                nominations={nominations}
                selectedConstId={selectedConstId}
                onSeatClick={(id) => setSelectedConstId(id)}
              />
            </div>
          )}
          <div className="p-3" style={{ border: "1px solid rgb(var(--gold-rgb)/0.28)", background: "rgb(var(--gold-rgb)/0.06)" }}>
            <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black tracking-widest uppercase" style={{ color: "var(--gold)" }}>
                {t(lang, "AI ADVISOR · CADANGAN KELOMPOK CALON", "AI ADVISOR · BULK CANDIDATE SUGGESTIONS")}
              </div>
              <div className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {t(lang,
                  "Advisor pilih calon ahli parti mengikut pengaruh nasional, negeri dan daerah. Ia hanya isi kerusi kosong — player boleh edit/pindahkan calon selepas cadangan.",
                  "The advisor picks party candidates by national, state, and district influence. It only fills empty seats — you can still edit/move a candidate afterwards.")}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => applyAdvisor("state")}
                className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase"
                style={{ border: "1px solid rgb(var(--cyan-rgb)/0.4)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.07)", cursor: "pointer" }}
              >
                {isPrn ? t(lang, "PILIH DUN NEGERI INI", "FILL THIS STATE'S DUN") : t(lang, "PILIH NEGERI INI", "FILL THIS STATE")}
              </button>
              <button
                onClick={() => applyAdvisor("national")}
                className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase"
                style={{ border: "1px solid rgb(var(--gold-rgb)/0.5)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.08)", cursor: "pointer" }}
              >
                {isPrn ? t(lang, "PILIH SEMUA DUN NEGERI", "FILL ALL STATE'S DUN") : t(lang, "PILIH SELURUH NEGARA", "FILL WHOLE COUNTRY")}
              </button>
            </div>
          </div>
          <div className="mt-2 text-[10px] leading-relaxed" style={{ color: "#94a3b8" }}>
            {advisorNote}
          </div>
        </div>
        </div>

        {!selectedConstId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center" style={{ minHeight: "300px" }}>
            <div className="text-[28px]" style={{ color: "var(--text-muted)" }}>←</div>
            <div className="text-[12px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
              {t(lang, `Pilih kerusi ${seatLabel} untuk letak calon`, `Select a ${seatLabel} seat to place a candidate`)}
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
                  <div className="text-[9px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>{t(lang, "SOKONGAN KITA", "OUR SUPPORT")}</div>
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
              <div className="text-[10px] tracking-widest mb-2 uppercase" style={{ color: "var(--text-muted)" }}>{t(lang, "Calon Semasa", "Current Candidate")}</div>
              {!currentNom ? (
                <div className="text-[13px]" style={{ color: "#4a5568" }}>{t(lang, "— Belum ada calon —", "— No candidate yet —")}</div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {currentMember && currentNom.type === "member" && (
                      <div
                        className="relative h-[82px] w-[64px] shrink-0 overflow-hidden"
                        style={{
                          border: "1px solid rgb(var(--cyan-rgb)/0.55)",
                          background: "radial-gradient(circle at 50% 20%, rgb(var(--cyan-rgb)/0.18), transparent 42%), linear-gradient(180deg, rgb(var(--cyan-rgb)/0.08), rgb(var(--gold-rgb)/0.045))",
                          boxShadow: "0 0 20px rgb(var(--cyan-rgb)/0.22), inset 0 0 18px rgb(var(--cyan-rgb)/0.06)",
                        }}
                      >
                        <img
                          src={candidatePortrait(currentMember)}
                          alt={`${currentMember.name} profile photo`}
                          className="h-full w-full object-contain object-center"
                          style={{ padding: "4px 4px 8px", imageRendering: "auto" }}
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5" style={{ background: "linear-gradient(180deg, transparent, rgb(3 8 15 / 0.72))" }} />
                      </div>
                    )}
                    <div className="min-w-0">
                      {currentNom.type === "member" && (
                        <>
                          <div className="text-[15px] font-bold text-white">{currentNom.memberName}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--cyan)" }}>{currentNom.memberRole}</div>
                          {currentMember && (
                            <div className="text-[10px] mt-1 uppercase tracking-wide" style={{ color: scopeColor(currentMember.influenceScope) }}>
                              {fitLabel(currentMember)} · {t(lang, "PENGARUH", "INFLUENCE")} {scopeLabel(currentMember.influenceScope)}
                            </div>
                          )}
                        </>
                      )}
                      {currentNom.type === "none" && (
                        <>
                          <div className="text-[15px] font-bold" style={{ color: "var(--neon-red)" }}>{t(lang, "TIADA CALON — WALKOVER", "NO CANDIDATE — WALKOVER")}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{t(lang, "Kerusi ini tidak dipertandingkan", "This seat is not contested")}</div>
                        </>
                      )}
                      {currentNom.type === "leader" && (
                        <>
                          <div className="text-[15px] font-bold" style={{ color: "var(--gold)" }}>{leader.name} ({leader.position})</div>
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--gold)" }}>{t(lang, "ANDA MENANDING KERUSI INI SECARA PERIBADI", "YOU ARE PERSONALLY CONTESTING THIS SEAT")}</div>
                        </>
                      )}
                    </div>
                  </div>
                  {currentNom.type !== "leader" && (
                    <button
                      onClick={() => assign(null)}
                      className="text-[11px] px-3 py-1 tracking-widest uppercase shrink-0"
                      style={{ border: "1px solid var(--neon-red)", color: "var(--neon-red)", background: "rgba(255,68,68,0.06)", cursor: "pointer" }}
                    >
                      {t(lang, "PADAM", "CLEAR")}
                    </button>
                  )}
                </div>
              )}
            </div>

            {currentNom?.type === "leader" ? (
              <div className="p-3 text-[12px] leading-relaxed" style={{ border: "1px solid rgb(var(--gold-rgb)/0.28)", background: "rgb(var(--gold-rgb)/0.06)", color: "var(--gold)" }}>
                {t(lang,
                  "◇ Kerusi ini dikunci untuk calon presiden — tidak boleh ditukar atau diserahkan kepada ahli parti lain.",
                  "◇ This seat is locked to the presidential candidate — it can't be changed or handed to another party member.")}
              </div>
            ) : (
              <>
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
                    {t(lang, "✗ TIADA CALON", "✗ NO CANDIDATE")}
                  </button>
                </div>

                {/* Member grid */}
                <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] tracking-widest uppercase font-bold" style={{ color: "var(--text-muted)" }}>
                  {t(lang, "AHLI PARTI — PILIH UNTUK DICALONKAN", "PARTY MEMBERS — SELECT TO NOMINATE")}
                </div>
                <div className="text-[10px]" style={{ color: "#4a5568" }}>
                  {t(lang,
                    `${candidatePool.filter((m) => !memberAssignments[m.id]).length}/${candidatePool.length} TERSEDIA · ${candidatePool.filter((m) => m.influenceScope === "national").length} NASIONAL · ${candidatePool.filter(isLocalMember).length} ANAK NEGERI`,
                    `${candidatePool.filter((m) => !memberAssignments[m.id]).length}/${candidatePool.length} AVAILABLE · ${candidatePool.filter((m) => m.influenceScope === "national").length} NATIONAL · ${candidatePool.filter(isLocalMember).length} LOCAL TO STATE`)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {sortedMembers.map((member) => {
                  const assignedTo = memberAssignments[member.id];
                  const isHere = assignedTo === selectedConstId;
                  const isElsewhere = !!assignedTo && !isHere;

                  const borderColor = isHere
                    ? "var(--cyan)"
                    : isElsewhere
                    ? "rgb(var(--gold-rgb)/0.4)"
                    : "rgb(var(--cyan-rgb)/0.14)";
                  const statusColor = isHere ? "var(--cyan)" : isElsewhere ? "var(--gold)" : "var(--neon-green)";
                  const statusLabel = isHere ? t(lang, "KERUSI INI", "THIS SEAT") : isElsewhere ? t(lang, "PINDAH →", "MOVE →") : t(lang, "TERSEDIA", "AVAILABLE");
                  const moveToLabel = t(lang, "PINDAH →", "MOVE →");
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
                      style={{
                        border: `1px solid ${borderColor}`,
                        background: isHere
                          ? "linear-gradient(135deg, rgb(var(--cyan-rgb)/0.11), rgb(var(--gold-rgb)/0.045))"
                          : isElsewhere
                          ? "linear-gradient(135deg, rgb(var(--gold-rgb)/0.055), rgb(var(--cyan-rgb)/0.025))"
                          : "linear-gradient(135deg, rgb(var(--cyan-rgb)/0.035), transparent 62%)",
                        cursor: isHere ? "default" : "pointer",
                        boxShadow: isHere ? "0 0 20px rgb(var(--cyan-rgb)/0.16)" : "inset 0 0 18px rgb(var(--cyan-rgb)/0.025)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="relative h-[96px] w-[74px] shrink-0 overflow-hidden"
                          style={{
                            border: `1px solid ${isHere ? "var(--cyan)" : local ? "var(--neon-green)" : "rgb(var(--cyan-rgb)/0.28)"}`,
                            background: "radial-gradient(circle at 50% 18%, rgb(var(--cyan-rgb)/0.18), transparent 44%), linear-gradient(180deg, rgba(0,212,255,0.075), rgba(255,178,44,0.045))",
                            boxShadow: isHere ? "0 0 22px rgb(var(--cyan-rgb)/0.24), inset 0 0 18px rgb(var(--cyan-rgb)/0.08)" : "inset 0 0 14px rgb(var(--cyan-rgb)/0.055)",
                          }}
                        >
                          <img
                            src={portrait}
                            alt={`${member.name} profile photo`}
                            className="h-full w-full object-contain object-center"
                            style={{ padding: "4px 4px 16px", filter: isElsewhere ? "grayscale(0.35) brightness(0.78)" : "contrast(1.03) saturate(1.04)" }}
                          />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7" style={{ background: "linear-gradient(180deg, transparent, rgb(3 8 15 / 0.78))" }} />
                          <div className="absolute inset-x-1 bottom-1 px-1 py-0.5 text-center text-[7px] font-black tracking-[0.16em]" style={{ color: "#061018", background: local ? "var(--neon-green)" : "var(--cyan)", boxShadow: "0 0 10px rgb(var(--cyan-rgb)/0.28)" }}>
                            {t(lang, "PROFIL", "PROFILE")}
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
                            {t(lang, "ASAL/MENETAP", "FROM/BASED IN")}: {gameStates.find((s) => s.id === member.homeState)?.shortName ?? member.homeState.toUpperCase()}{member.homeConstituency ? ` · ${member.homeConstituency}` : ""}
                          </div>
                          <div className="text-[9px] mb-2 uppercase tracking-wide" style={{ color: scopeTone }}>
                            {t(lang, "PENGARUH", "INFLUENCE")} {scope} · {candidateEffectText(member)}
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
                              title={isElsewhere ? `${moveToLabel} ${elseWhereName}` : statusLabel}
                            >
                              {isElsewhere ? `${moveToLabel} ${elseWhereName}` : statusLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
              </>
            )}
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
  const { operations, resources, states: gameStates, removeOperation, settings } = useGameStore();
  const isPrn = settings.electionScope === "prn";
  const campaignStates = isPrn ? gameStates.filter((s) => s.id === settings.prnStateId) : gameStates;
  const [selectedMiniGameState, setSelectedMiniGameState] = useState(() => (isPrn ? settings.prnStateId : "selangor"));
  const [miniGameType, setMiniGameType] = useState<MiniGameType>("ceramah");
  const [recruitDone, setRecruitDone] = useState(false);
  const [activeScene, setActiveScene] = useState<{ stateId: string; gameType: MiniGameType; tactic: MiniGameTactic } | null>(null);
  const router = useRouter();

  const activeOpsCount = operations.filter((o) => o.status === "active" || o.status === "ongoing").length;
  const plannedOpsCount = operations.filter((o) => o.status === "planned").length;
  const miniGameState = campaignStates.find((s) => s.id === selectedMiniGameState) ?? campaignStates[0];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", fontFamily: "'Space Mono', monospace" }}>
      <Header />
      <StatusBar leftText={t(lang, "» IBU PEJABAT KEMPEN · ARAHAN OPERASI", "» CAMPAIGN HQ · OPERATIONS COMMAND")} rightText={t(lang, "TAB: TUKAR PANEL · ↵ PILIH", "TAB: SWITCH PANEL · ↵ SELECT")} />

      {showDeployModal && <DeployModal onClose={() => setShowDeployModal(false)} />}
      {activeScene && (
        <CeramahSceneModal
          stateId={activeScene.stateId}
          gameType={activeScene.gameType}
          tactic={activeScene.tactic}
          onClose={() => setActiveScene(null)}
        />
      )}

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
            <TacticalPanel title={t(lang, "SASARAN MINI-PERMAINAN", "MINI-GAME TARGET")}>
              <div className="flex gap-2 mb-3">
                {(["ceramah", "social"] as MiniGameType[]).map((type) => (
                  <button key={type} onClick={() => setMiniGameType(type)} className="flex-1 py-2 text-[12px] font-bold tracking-widest uppercase" style={{ border: miniGameType === type ? "1px solid var(--gold)" : "1px solid rgb(var(--cyan-rgb)/0.18)", color: miniGameType === type ? "var(--gold)" : "var(--text-muted)", background: miniGameType === type ? "rgb(var(--gold-rgb)/0.08)" : "transparent" }}>{type}</button>
                ))}
              </div>
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
                {campaignStates.map((s) => (
                  <button key={s.id} onClick={() => setSelectedMiniGameState(s.id)} className="w-full px-3 py-2 text-left text-[12px]" style={{ border: selectedMiniGameState === s.id ? "1px solid var(--cyan)" : "1px solid rgb(var(--cyan-rgb)/0.12)", color: selectedMiniGameState === s.id ? "#fff" : "var(--text-muted)", background: selectedMiniGameState === s.id ? "rgb(var(--cyan-rgb)/0.07)" : "transparent" }}>
                    <div className="flex justify-between"><span className="font-bold">{s.name}</span><span>{s.mandatSupport}%</span></div>
                    <div className="mt-1 h-1.5" style={{ background: "var(--bar-empty)" }}><div className="h-1.5" style={{ width: `${s.mandatSupport}%`, background: "var(--cyan)" }} /></div>
                  </button>
                ))}
              </div>
            </TacticalPanel>

            <TacticalPanel title={`${miniGameType === "ceramah" ? t(lang, "MINI-PERMAINAN CERAMAH", "CERAMAH MINI-GAME") : t(lang, "MINI-PERMAINAN MEDIA SOSIAL", "SOCIAL MEDIA MINI-GAME")} — ${miniGameState?.name.toUpperCase() ?? t(lang, "NEGERI", "STATE")}`}>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="border p-3" style={{ borderColor: "rgb(var(--cyan-rgb)/0.16)" }}><div className="text-[10px] text-text-muted">{t(lang, "KESESUAIAN AUDIENS", "AUDIENCE FIT")}</div><div className="text-xl font-black" style={{ color: "var(--cyan)" }}>{miniGameType === "ceramah" ? t(lang, `${miniGameState?.demographics.rural}% LUAR BANDAR`, `${miniGameState?.demographics.rural}% RURAL`) : t(lang, `${miniGameState?.demographics.youth}% BELIA`, `${miniGameState?.demographics.youth}% YOUTH`)}</div></div>
                <div className="border p-3" style={{ borderColor: "rgb(var(--cyan-rgb)/0.16)" }}><div className="text-[10px] text-text-muted">{t(lang, "BELIAN MEDIA", "MEDIA BUY")}</div><div className="text-xl font-black" style={{ color: "var(--gold)" }}>{resources.mediaBuy}</div></div>
                <div className="border p-3" style={{ borderColor: "rgb(var(--cyan-rgb)/0.16)" }}><div className="text-[10px] text-text-muted">{t(lang, "DANA", "FUNDS")}</div><div className="text-xl font-black" style={{ color: "var(--neon-green)" }}>{formatRM(resources.funds)}</div></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(MINI_GAME_TACTICS) as MiniGameTactic[]).map((tactic) => {
                  const option = MINI_GAME_TACTICS[tactic];
                  return (
                    <button key={tactic} onClick={() => miniGameState && setActiveScene({ stateId: miniGameState.id, gameType: miniGameType, tactic })} className="p-5 text-left transition-all hover:scale-[1.01]" style={{ border: `1px solid ${option.color}55`, background: `${option.color}0d`, cursor: "pointer" }}>
                      <div className="text-[13px] font-black tracking-widest" style={{ color: option.color }}>{t(lang, option.titleMS, option.titleEN)}</div>
                      <div className="mt-2 min-h-[52px] text-[11px] leading-5" style={{ color: "#9fb0c2" }}>{t(lang, option.descMS, option.descEN)}</div>
                      <div className="mt-3 text-[10px] font-bold" style={{ color: option.color }}>{t(lang, option.riskMS, option.riskEN)}</div>
                      <div className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>{miniGameType === "ceramah" ? t(lang, "RM75K · 42 TENAGA", "RM75K · 42 MAN") : t(lang, "RM45K · 65 MEDIA", "RM45K · 65 MEDIA")}</div>
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
              <TacticalPanel title={t(lang, "OPERASI AKTIF", "ACTIVE OPERATIONS")}>
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
                              <StatusBadge status={op.status} lang={lang} />
                              <button
                                onClick={(e) => { e.stopPropagation(); removeOperation(op.id); }}
                                className="text-[17px] leading-none transition-colors"
                                style={{ color: "#4a5568", cursor: "pointer" }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neon-red)")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "#4a5568")}
                                title={t(lang, "Batalkan operasi", "Cancel operation")}
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
              <TacticalPanel title={isPrn ? "PETA DUN OPERASI PRN" : "OPERATIONAL MAP"}>
                {isPrn && campaignStates[0] ? (
                  <StateDunMap
                    state={campaignStates[0]}
                    constituencies={generateConstituencies(campaignStates[0], "dun")}
                    nominations={{}}
                    compact
                  />
                ) : (
                  <MalaysiaMap states={campaignStates} compact={true} />
                )}
              </TacticalPanel>
            </div>

            {/* Right Column ~45% */}
            <div className="flex flex-col gap-4" style={{ flex: "1" }}>

              {/* Resource Allocation — live from store */}
              <TacticalPanel title={t(lang, "PERUNTUKAN SUMBER", "RESOURCE ALLOCATION")}>
                <div className="flex flex-col gap-3">
                  <StatBar label={t(lang, "TENAGA", "MANPOWER")} value={resources.manpower} max={1000} color="var(--cyan)" animate={true} />
                  <StatBar label={t(lang, "KENDERAAN", "VEHICLES")} value={resources.vehicles} max={500} color="var(--gold)" animate={true} />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>{t(lang, "BAJET", "BUDGET")}</span>
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
                  <StatBar label={t(lang, "BAHAN", "MATERIALS")} value={resources.materials} max={1000} color="var(--warn-orange)" animate={true} />
                  <StatBar label={t(lang, "BELIAN MEDIA", "MEDIA BUY")} value={resources.mediaBuy} max={1000} color="#8b5cf6" animate={true} />
                </div>
              </TacticalPanel>

              {/* Upcoming Events */}
              <TacticalPanel title={t(lang, "PERISTIWA AKAN DATANG", "UPCOMING EVENTS")}>
                <div className="flex flex-col gap-2">
                  {UPCOMING_EVENTS.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 py-1.5" style={{ borderBottom: i < 2 ? "1px solid rgb(var(--cyan-rgb) / 0.08)" : "none" }}>
                      <span className="text-[12px] font-bold shrink-0" style={{ color: "var(--gold)", minWidth: "52px" }}>{ev.date}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white tracking-wider uppercase">{t(lang, ev.eventMS, ev.eventEN)}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{ev.location}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </TacticalPanel>

              {/* Operation Status — live counts */}
              <TacticalPanel title={t(lang, "STATUS OPERASI", "OPERATION STATUS")}>
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
                    <span style={{ color: "var(--cyan)" }}>{t(lang, "AKTIF/BERTERUSAN", "ACTIVE/ONGOING")}</span>
                    <span className="text-white font-bold">{activeOpsCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2" style={{ background: "#4a5568" }} />
                    <span style={{ color: "var(--text-muted)" }}>{t(lang, "DIRANCANG", "PLANNED")}</span>
                    <span className="text-white font-bold">{plannedOpsCount}</span>
                  </div>
                </div>
                <div className="text-center text-[12px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                  {t(lang, "JUMLAH", "TOTAL")}: <span className="text-white font-bold">{operations.length} {t(lang, "OPS", "OPS")}</span>
                </div>
              </TacticalPanel>
            </div>
          </div>
        )}

        {/* VOLUNTEERS TAB */}
        {activeTab === "VOLUNTEERS" && (
          <TacticalPanel title={t(lang, "PENEMPATAN SUKARELAWAN", "VOLUNTEER DEPLOYMENT")}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.3)" }}>
                    {[t(lang, "REGION", "REGION"), t(lang, "SUKARELAWAN", "VOLUNTEERS"), t(lang, "SASARAN", "TARGET"), t(lang, "% DIISI", "% FILLED")].map((h) => (
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
            <TacticalPanel title={t(lang, "PERUNTUKAN BAJET", "BUDGET ALLOCATION")}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.3)" }}>
                      {[t(lang, "KATEGORI", "CATEGORY"), t(lang, "DIPERUNTUKKAN", "ALLOCATED"), t(lang, "DIBELANJA", "SPENT"), t(lang, "BERBAKI", "REMAINING")].map((h) => (
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
                  <span className="text-[13px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>{t(lang, "JUMLAH DANA KEMPEN", "TOTAL CAMPAIGN FUNDS")}</span>
                  <span className="text-[13px] font-bold" style={{ color: "var(--neon-green)" }}>{formatRM(resources.funds)} {t(lang, "BERBAKI", "REMAINING")}</span>
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
          <TacticalPanel title={t(lang, "JADUAL KEMPEN", "CAMPAIGN SCHEDULE")}>
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="text-[13px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                {t(lang, "JADUAL KEMPEN PENUH DENGAN PENGURUSAN PERISTIWA", "FULL CAMPAIGN SCHEDULE WITH EVENT MANAGEMENT")}
              </div>
              <button
                onClick={() => router.push("/calendar")}
                className="px-8 py-3 text-[16px] tracking-widest uppercase font-bold transition-opacity hover:opacity-80"
                style={{ background: "var(--gold)", color: "#000", cursor: "pointer" }}
              >
                {t(lang, "LIHAT JADUAL PENUH →", "VIEW FULL SCHEDULE →")}
              </button>
            </div>
          </TacticalPanel>
        )}

        {/* MESSAGING TAB */}
        {activeTab === "MESSAGING" && (
          <TacticalPanel title={t(lang, "PUSAT PESANAN", "MESSAGING CENTER")}>
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="text-[13px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                {t(lang, "GUBAH DAN LANCARKAN MESEJ KEMPEN MERENTASI SEMUA SALURAN", "CRAFT AND DEPLOY CAMPAIGN MESSAGES ACROSS ALL CHANNELS")}
              </div>
              <button
                onClick={() => router.push("/messaging")}
                className="px-8 py-3 text-[16px] tracking-widest uppercase font-bold transition-opacity hover:opacity-80"
                style={{ background: "var(--gold)", color: "#000", cursor: "pointer" }}
              >
                {t(lang, "LIHAT PUSAT PESANAN →", "VIEW MESSAGING CENTER →")}
              </button>
            </div>
          </TacticalPanel>
        )}
      </main>
    </div>
  );
}
