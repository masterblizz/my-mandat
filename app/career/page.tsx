"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";
import { computeElectionOutcome } from "../utils/electionOutcome";
import { getGovernmentTerms } from "../utils/governmentTerms";
import { usePendingNav } from "../hooks/usePendingNav";

type CareerAction = {
  id: string;
  titleMS: string;
  titleEN: string;
  detailMS: string;
  detailEN: string;
  legacy: number;
  faction: number;
  machinery: number;
  nextElection: number;
};

type Faction = {
  id: string;
  labelMS: string;
  labelEN: string;
  loyalty: number;
  demandMS: string;
  demandEN: string;
  color: string;
};

const CAREER_ACTIONS: CareerAction[] = [
  {
    id: "prn-test",
    titleMS: "Hadapi PRN Tengah Penggal",
    titleEN: "Face Mid-Term PRN",
    detailMS: "Jadikan PRN sebagai referendum kerajaan. Menang PRN menguatkan mandat, kalah PRN beri momentum kepada pembangkang.",
    detailEN: "Use state elections as a government referendum. Winning strengthens the mandate; losing gives opposition momentum.",
    legacy: 6,
    faction: 1,
    machinery: 4,
    nextElection: 5,
  },
  {
    id: "prk-machine",
    titleMS: "Gerakkan Jentera PRK",
    titleEN: "Deploy By-Election Machine",
    detailMS: "PRK kecil tetapi simbolik. Keputusan boleh mengubah moral parti dan naratif media nasional.",
    detailEN: "By-elections are small but symbolic. Results shift party morale and national media narratives.",
    legacy: 3,
    faction: 2,
    machinery: 7,
    nextElection: 4,
  },
  {
    id: "party-election",
    titleMS: "Urus Pemilihan Parti",
    titleEN: "Manage Party Election",
    detailMS: "Seimbangkan reformis, warlord negeri dan sayap pemuda supaya parti tidak retak sebelum PRU seterusnya.",
    detailEN: "Balance reformists, state warlords and youth wing so the party does not split before the next GE.",
    legacy: 4,
    faction: 8,
    machinery: 2,
    nextElection: 3,
  },
  {
    id: "shadow-or-govern",
    titleMS: "Siapkan Mode Kerajaan / Pembangkang",
    titleEN: "Prepare Government / Opposition Mode",
    detailMS: "Jika kerajaan, pertahan rekod. Jika kalah, bina shadow cabinet dan serang kelemahan kerajaan.",
    detailEN: "If governing, defend the record. If defeated, build a shadow cabinet and attack the government's weaknesses.",
    legacy: 5,
    faction: 3,
    machinery: 3,
    nextElection: 8,
  },
  {
    id: "next-pru",
    titleMS: "Bina Naratif PRU Seterusnya",
    titleEN: "Build Next GE Narrative",
    detailMS: "Tentukan sama ada kempen akan fokus reformasi, kestabilan, ekonomi atau mandat baru rakyat.",
    detailEN: "Choose whether the next campaign focuses on reform, stability, economy or a renewed public mandate.",
    legacy: 7,
    faction: 0,
    machinery: 5,
    nextElection: 9,
  },
];

const FACTIONS: Faction[] = [
  { id: "reform", labelMS: "Reformis", labelEN: "Reformists", loyalty: 74, demandMS: "Reformasi institusi lebih cepat", demandEN: "Faster institutional reform", color: "var(--cyan)" },
  { id: "warlord", labelMS: "Warlord Kawasan", labelEN: "Area Warlords", loyalty: 61, demandMS: "Peruntukan kawasan dan jawatan eksekutif", demandEN: "Constituency allocations and executive posts", color: "var(--warn-orange)" },
  { id: "youth", labelMS: "Sayap Pemuda", labelEN: "Youth Wing", loyalty: 68, demandMS: "Kerja anak muda dan calon muda", demandEN: "Youth jobs and younger candidates", color: "var(--neon-green)" },
  { id: "borneo", labelMS: "Blok Borneo", labelEN: "Borneo Bloc", loyalty: 57, demandMS: "MA63 dan autonomi pembangunan", demandEN: "MA63 and development autonomy", color: "var(--gold)" },
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border p-3" style={{ borderColor: `${color}55`, background: "rgba(3,8,15,0.72)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold tracking-[0.2em] text-text-muted">{label}</span>
        <span className="text-xl font-black" style={{ color }}>{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export default function CareerPage() {
  const router = useRouter();
  const { isPending, navigate } = usePendingNav();
  const lang = useLang();
  const { states, leader, settings, difficulty, careerProgress, setCareerProgress } = useGameStore();
  const { completed, term, month } = careerProgress;

  const outcome = useMemo(
    () => computeElectionOutcome(states, { electionScope: settings.electionScope, prnStateId: settings.prnStateId }),
    [states, settings.electionScope, settings.prnStateId]
  );
  const terms = getGovernmentTerms(lang, settings.electionScope, outcome.contestedStates[0]);
  const seatsWon = outcome.seatsWon;
  const isGovernment = seatsWon >= outcome.majorityTarget;
  const nationalSupport = outcome.nationalSupport;
  const activeActions = CAREER_ACTIONS.filter((action) => completed.includes(action.id));
  const legacyScore = clamp(38 + Math.round(seatsWon / 4) + activeActions.reduce((sum, action) => sum + action.legacy, 0));
  const factionControl = clamp(48 + Math.round(leader.negotiation / 5) + activeActions.reduce((sum, action) => sum + action.faction, 0));
  const partyMachinery = clamp(44 + Math.round(leader.strategy / 5) + activeActions.reduce((sum, action) => sum + action.machinery, 0));
  const monthProgress = Math.round((month / 60) * 100);
  const nextPruReadiness = clamp(30 + Math.round(nationalSupport / 2) + Math.round(monthProgress / 5) + activeActions.reduce((sum, action) => sum + action.nextElection, 0));
  const prnPressure = clamp(70 - Math.round(nationalSupport / 2) + (settings.electionScope === "prn" ? 10 : 0));
  const prkRisk = clamp(22 + FACTIONS.filter((faction) => faction.loyalty < 65).length * 9 + (isGovernment ? 3 : 12));
  const careerTitle = isGovernment
    ? t(lang, `${terms.governmentName} Bertahan`, `${terms.governmentName} Survival`)
    : t(lang, "Kebangkitan Pembangkang", "Opposition Comeback");
  const yearInTerm = Math.floor((month - 1) / 12) + 1;
  const monthInYear = ((month - 1) % 12) + 1;
  const monthsToNextPru = Math.max(0, 60 - month);
  const nextPruWindow = month >= 60;

  function toggleAction(id: string) {
    setCareerProgress({ completed: completed.includes(id) ? completed.filter((item) => item !== id) : [...completed, id] });
  }

  function advanceMonth() {
    if (month >= 60) {
      setCareerProgress({ term: term + 1, month: 1, completed: Array.from(new Set([...completed, "next-pru"])) });
      return;
    }
    const nextMonth = month + 1;
    setCareerProgress({
      month: nextMonth,
      completed: nextMonth >= 60 ? Array.from(new Set([...completed, "next-pru"])) : completed,
    });
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {t(lang, "FASA 3 · KERJAYA POLITIK BERBILANG PENGGAL", "PHASE 3 · MULTI-TERM POLITICAL CAREER")}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{t(lang, "PETA LEGASI", "LEGACY MAP")}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>
              {leader.partyAbbr} · {careerTitle} · {t(lang, "Penggal", "Term")} {term} · {t(lang, "Tahun", "Year")} {yearInTerm} · {t(lang, "Bulan", "Month")} {monthInYear}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/government")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {t(lang, "KERAJAAN", "GOVERNMENT")}</button>
            <button onClick={() => navigate("/sandbox")} disabled={isPending} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-60 disabled:cursor-wait" style={{ border: "1px solid rgb(var(--neon-green-rgb,0 255 136)/0.42)", color: "var(--neon-green)", background: "rgb(0 255 136 / 0.06)" }}>{isPending ? t(lang, "MEMUATKAN...", "LOADING...") : t(lang, "SIMULASI NEGARA", "NATIONAL SIMULATION")}</button>
            <button onClick={advanceMonth} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--gold-rgb)/0.42)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.08)" }}>{nextPruWindow ? t(lang, "MULA KITARAN PRU BARU", "START NEW GE CYCLE") : t(lang, "MAJU BULAN +1", "ADVANCE MONTH +1")}</button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <TacticalPanel title={t(lang, "SKOR LEGASI", "LEGACY SCORE")}>
              <div className="text-6xl font-black" style={{ color: legacyScore >= 75 ? "var(--neon-green)" : legacyScore >= 55 ? "var(--gold)" : "var(--warn-orange)" }}>{legacyScore}</div>
              <div className="mt-2 text-[12px] text-text-muted tracking-wider">{t(lang, "bukan tamat selepas satu PRU", "not ending after one election")}</div>
            </TacticalPanel>
            <TacticalPanel title={t(lang, "MASA KE PRU SETERUSNYA", "TIME TO NEXT GE")}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold tracking-[0.22em] text-text-muted">{t(lang, "PENGGAL", "TERM")}</div>
                  <div className="mt-1 text-2xl font-black text-white">{term}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold tracking-[0.22em] text-text-muted">{t(lang, "TAHUN / BULAN", "YEAR / MONTH")}</div>
                  <div className="mt-1 text-2xl font-black" style={{ color: "var(--gold)" }}>{yearInTerm} / {monthInYear}</div>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full" style={{ width: `${monthProgress}%`, background: "linear-gradient(90deg,var(--cyan),var(--gold))" }} />
              </div>
              <div className="mt-2 text-[11px] text-text-muted tracking-wider">
                {nextPruWindow ? t(lang, "Tetingkap PRU seterusnya sudah terbuka.", "Next GE window is now open.") : `${monthsToNextPru} ${t(lang, "bulan sebelum PRU seterusnya", "months before next GE")}`}
              </div>
            </TacticalPanel>
            <TacticalPanel title={t(lang, "INDEKS KERJAYA", "CAREER INDEX")}>
              <div className="space-y-2">
                <Meter label={t(lang, "Faction", "Faction")} value={factionControl} color="var(--cyan)" />
                <Meter label={t(lang, "Jentera", "Machinery")} value={partyMachinery} color="var(--neon-green)" />
                <Meter label={t(lang, "PRU Seterusnya", "Next GE")} value={nextPruReadiness} color="var(--gold)" />
              </div>
            </TacticalPanel>
            <TacticalPanel title={t(lang, "RISIKO ELEKTORAL", "ELECTORAL RISK")}>
              <div className="grid grid-cols-2 gap-2">
                <Meter label="PRN" value={prnPressure} color="var(--warn-orange)" />
                <Meter label="PRK" value={prkRisk} color="var(--neon-red)" />
              </div>
            </TacticalPanel>
          </div>

          <TacticalPanel title={t(lang, "LALUAN KERJAYA POLITIK", "POLITICAL CAREER PATH")} noPadding>
            <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-4 space-y-3">
              {CAREER_ACTIONS.map((action, index) => {
                const active = completed.includes(action.id);
                return (
                  <button
                    key={action.id}
                    onClick={() => toggleAction(action.id)}
                    className="w-full border p-4 text-left transition hover:scale-[1.005]"
                    style={{ borderColor: active ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.16)", background: active ? "rgb(var(--gold-rgb)/0.10)" : "rgba(3,8,15,0.72)" }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center border text-sm font-black" style={{ borderColor: active ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.25)", color: active ? "var(--gold)" : "var(--cyan)" }}>{index + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[14px] font-black tracking-wider text-white">{t(lang, action.titleMS, action.titleEN)}</div>
                          <div className="text-[10px] font-black tracking-widest" style={{ color: active ? "var(--gold)" : "var(--text-muted)" }}>{active ? t(lang, "AKTIF", "ACTIVE") : t(lang, "PILIH", "SELECT")}</div>
                        </div>
                        <div className="mt-1 text-[11px] leading-relaxed text-text-muted">{t(lang, action.detailMS, action.detailEN)}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-bold tracking-wider">
                          <span style={{ color: "var(--gold)" }}>Legacy +{action.legacy}</span>
                          <span style={{ color: "var(--cyan)" }}>Faction +{action.faction}</span>
                          <span style={{ color: "var(--neon-green)" }}>Jentera +{action.machinery}</span>
                          <span style={{ color: "var(--warn-orange)" }}>Next PRU +{action.nextElection}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </TacticalPanel>

          <div className="space-y-4">
            <TacticalPanel title={t(lang, "POLITIK DALAMAN PARTI", "PARTY INTERNAL POLITICS")}>
              <div className="space-y-3">
                {FACTIONS.map((faction) => {
                  const adjusted = clamp(faction.loyalty + Math.round((factionControl - 50) / 3));
                  return (
                    <div key={faction.id} className="border p-3" style={{ borderColor: `${faction.color}44`, background: "rgba(255,255,255,0.025)" }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-black tracking-wider text-white">{t(lang, faction.labelMS, faction.labelEN)}</span>
                        <span className="text-[16px] font-black" style={{ color: faction.color }}>{adjusted}</span>
                      </div>
                      <div className="mt-1 text-[10px] leading-relaxed text-text-muted">{t(lang, faction.demandMS, faction.demandEN)}</div>
                    </div>
                  );
                })}
              </div>
            </TacticalPanel>

            <TacticalPanel title={isGovernment ? t(lang, `MODE ${terms.governmentName}`, `${terms.governmentName} MODE`) : t(lang, "MODE PEMBANGKANG", "OPPOSITION MODE")}>
              <div className="text-[13px] leading-relaxed text-text-muted">
                {terms.isPrn
                  ? isGovernment
                    ? t(lang, "Pertahankan rekod kerajaan negeri, urus PRK DUN, kawal faction dan bina naratif untuk PRN seterusnya.", "Defend the state governing record, manage DUN by-elections, control factions and build the next state election narrative.")
                    : t(lang, "Bina shadow EXCO, serang kelemahan kerajaan negeri, menang PRK DUN dan sediakan comeback untuk PRN seterusnya.", "Build a shadow EXCO, attack state government weakness, win DUN by-elections and prepare a comeback for the next state election.")
                  : isGovernment
                    ? t(lang, "Pertahankan rekod kerajaan, urus PRN/PRK, kawal faction dan bina naratif untuk PRU seterusnya.", "Defend the governing record, manage PRN/by-elections, control factions and build the next GE narrative.")
                    : t(lang, "Bina shadow cabinet, serang kelemahan kerajaan, menang PRK dan sediakan comeback untuk PRU seterusnya.", "Build a shadow cabinet, attack government weakness, win by-elections and prepare a comeback for the next GE.")}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] font-bold tracking-widest">
                <div className="border p-2" style={{ borderColor: "rgb(var(--cyan-rgb)/0.18)", color: "var(--cyan)" }}>{settings.electionScope.toUpperCase()}</div>
                <div className="border p-2" style={{ borderColor: "rgb(var(--gold-rgb)/0.24)", color: "var(--gold)" }}>{difficulty.toUpperCase()}</div>
              </div>
            </TacticalPanel>
          </div>
        </div>
      </main>
      <StatusBar leftText={`${t(lang, "FASA 3 · KERJAYA POLITIK", "PHASE 3 · POLITICAL CAREER")} · ${careerTitle}`} rightText={`${leader.partyAbbr} · Legacy ${legacyScore} · Term ${term} · Y${yearInTerm} M${monthInYear}`} />
    </div>
  );
}
