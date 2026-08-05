"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";
import { formatNumber } from "../utils/format";

const TOTAL_SEATS = 222;

type LeverId = "subsidy" | "ma63" | "antiCorruption" | "mediaFreedom" | "foreignInvestment" | "parliamentReform";

type Lever = {
  id: LeverId;
  titleMS: string;
  titleEN: string;
  detailMS: string;
  detailEN: string;
  economy: number;
  federal: number;
  parliament: number;
  institution: number;
  international: number;
  cost: number;
};

const LEVERS: Lever[] = [
  {
    id: "subsidy",
    titleMS: "Subsidi Bersasar Nasional",
    titleEN: "National Targeted Subsidy",
    detailMS: "Kurangkan tekanan kos sara hidup tetapi makan ruang fiskal kerajaan.",
    detailEN: "Reduces living-cost pressure but consumes fiscal space.",
    economy: 5,
    federal: 1,
    parliament: 1,
    institution: 0,
    international: -1,
    cost: 680000,
  },
  {
    id: "ma63",
    titleMS: "Pakej MA63 & Autonomi Borneo",
    titleEN: "MA63 & Borneo Autonomy Package",
    detailMS: "Perkukuh hubungan Sabah/Sarawak dengan Putrajaya melalui royalti, infrastruktur dan kuasa pentadbiran.",
    detailEN: "Strengthens Sabah/Sarawak ties with Putrajaya via royalties, infrastructure and administrative powers.",
    economy: 2,
    federal: 9,
    parliament: 2,
    institution: 1,
    international: 1,
    cost: 520000,
  },
  {
    id: "antiCorruption",
    titleMS: "Reformasi SPRM & Perolehan Terbuka",
    titleEN: "MACC & Open Procurement Reform",
    detailMS: "Naikkan keyakinan institusi tetapi boleh mencetuskan tentangan elit lama.",
    detailEN: "Raises institutional confidence but can trigger old-elite resistance.",
    economy: 3,
    federal: 0,
    parliament: 3,
    institution: 10,
    international: 4,
    cost: 240000,
  },
  {
    id: "mediaFreedom",
    titleMS: "Piagam Kebebasan Media",
    titleEN: "Media Freedom Charter",
    detailMS: "Media lebih bebas, tekanan jangka pendek naik tetapi legitimacy kerajaan meningkat.",
    detailEN: "Freer media increases short-term pressure but improves legitimacy.",
    economy: 0,
    federal: 0,
    parliament: 2,
    institution: 7,
    international: 5,
    cost: 120000,
  },
  {
    id: "foreignInvestment",
    titleMS: "Koridor Pelaburan Serantau",
    titleEN: "Regional Investment Corridor",
    detailMS: "Tarik FDI, teknologi dan kerja bernilai tinggi di Klang Valley, Johor, Pulau Pinang dan Borneo.",
    detailEN: "Attracts FDI, technology and high-value jobs in Klang Valley, Johor, Penang and Borneo.",
    economy: 10,
    federal: 2,
    parliament: 0,
    institution: 1,
    international: 8,
    cost: 760000,
  },
  {
    id: "parliamentReform",
    titleMS: "Reformasi Parlimen & Undi Percaya",
    titleEN: "Parliament Reform & Confidence Vote",
    detailMS: "Mengurangkan risiko lompat parti dan menjadikan survival kerajaan lebih telus.",
    detailEN: "Reduces defection risk and makes government survival more transparent.",
    economy: 1,
    federal: 1,
    parliament: 10,
    institution: 5,
    international: 2,
    cost: 180000,
  },
];

const SCENARIOS = [
  {
    labelMS: "Malaysia Stabil Reformis",
    labelEN: "Stable Reformist Malaysia",
    condition: (economy: number, institution: number, parliament: number) => economy >= 65 && institution >= 65 && parliament >= 60,
    color: "var(--neon-green)",
  },
  {
    labelMS: "Kerajaan Koalisi Rapuh",
    labelEN: "Fragile Coalition Government",
    condition: (_economy: number, _institution: number, parliament: number) => parliament < 50,
    color: "var(--warn-orange)",
  },
  {
    labelMS: "Tekanan Ekonomi Nasional",
    labelEN: "National Economic Pressure",
    condition: (economy: number) => economy < 52,
    color: "var(--neon-red)",
  },
  {
    labelMS: "Sandbox Malaysia Kompetitif",
    labelEN: "Competitive Malaysia Sandbox",
    condition: () => true,
    color: "var(--cyan)",
  },
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border p-3" style={{ borderColor: `${color}55`, background: "rgba(3,8,15,0.72)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold tracking-[0.2em] text-text-muted">{label}</span>
        <span className="text-2xl font-black" style={{ color }}>{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export default function SandboxPage() {
  const router = useRouter();
  const lang = useLang();
  const { states, resources, leader, settings, difficulty, sandboxProgress, setSandboxProgress } = useGameStore();
  const { activeLevers, simulationTick } = sandboxProgress;

  const selectedLevers = LEVERS.filter((lever) => activeLevers.includes(lever.id));
  const federalBase = Math.round(states.reduce((sum, state) => sum + state.mandatSupport, 0) / Math.max(1, states.length));
  const economyBase = Math.round(resources.funds / 46000);
  const parliamentBase = Math.round(42 + leader.negotiation / 3 + leader.credibility / 6);
  const institutionBase = Math.round(40 + leader.credibility / 3);
  const internationalBase = Math.round(38 + leader.strategy / 4 + leader.charisma / 5);
  const policyCost = selectedLevers.reduce((sum, lever) => sum + lever.cost, 0);
  const fiscalStress = Math.max(0, policyCost - resources.funds) / 120000;
  const economy = clamp(economyBase + selectedLevers.reduce((sum, lever) => sum + lever.economy, 0) - Math.round(fiscalStress));
  const federal = clamp(federalBase + selectedLevers.reduce((sum, lever) => sum + lever.federal, 0));
  const parliament = clamp(parliamentBase + selectedLevers.reduce((sum, lever) => sum + lever.parliament, 0));
  const institution = clamp(institutionBase + selectedLevers.reduce((sum, lever) => sum + lever.institution, 0));
  const international = clamp(internationalBase + selectedLevers.reduce((sum, lever) => sum + lever.international, 0));
  const nationalStability = clamp(Math.round((economy + federal + parliament + institution + international) / 5));
  const scenario = SCENARIOS.find((item) => item.condition(economy, institution, parliament)) ?? SCENARIOS.at(-1)!;
  const strongestStates = useMemo(() => [...states].sort((a, b) => b.mandatSupport - a.mandatSupport).slice(0, 4), [states]);
  const pressureStates = useMemo(() => [...states].sort((a, b) => a.mandatSupport - b.mandatSupport).slice(0, 4), [states]);

  function toggleLever(id: LeverId) {
    setSandboxProgress({ activeLevers: activeLevers.includes(id) ? activeLevers.filter((item) => item !== id) : [...activeLevers, id] });
  }

  function runScenario() {
    setSandboxProgress({ simulationTick: simulationTick + 1 });
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {t(lang, "FASA 4 · SANDBOX POLITIK MALAYSIA", "PHASE 4 · MALAYSIA POLITICAL SANDBOX")}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{t(lang, "SIMULASI NEGARA", "NATIONAL SIMULATION")}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>
              {leader.partyAbbr} · {t(lang, scenario.labelMS, scenario.labelEN)} · RUN {simulationTick}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/career")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {t(lang, "PETA LEGASI", "LEGACY MAP")}</button>
            <button onClick={runScenario} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--gold-rgb)/0.42)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.08)" }}>{t(lang, "JALANKAN SIMULASI", "RUN SIMULATION")}</button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <TacticalPanel title={t(lang, "OUTCOME NASIONAL", "NATIONAL OUTCOME")}>
              <div className="text-[11px] font-bold tracking-[0.24em] text-text-muted">{t(lang, "SENARIO ALTERNATIF", "ALTERNATE SCENARIO")}</div>
              <div className="mt-2 text-xl font-black leading-tight" style={{ color: scenario.color }}>{t(lang, scenario.labelMS, scenario.labelEN)}</div>
              <div className="mt-4 text-6xl font-black" style={{ color: nationalStability >= 70 ? "var(--neon-green)" : nationalStability >= 55 ? "var(--gold)" : "var(--warn-orange)" }}>{nationalStability}</div>
              <div className="text-[12px] text-text-muted tracking-wider">{t(lang, "indeks kestabilan negara", "national stability index")}</div>
            </TacticalPanel>

            <TacticalPanel title={t(lang, "METRIK SANDBOX", "SANDBOX METRICS")}>
              <div className="space-y-2">
                <Metric label={t(lang, "Ekonomi", "Economy")} value={economy} color="var(--neon-green)" />
                <Metric label={t(lang, "Federal-Negeri", "Federal-State")} value={federal} color="var(--gold)" />
                <Metric label={t(lang, "Parlimen", "Parliament")} value={parliament} color="var(--cyan)" />
                <Metric label={t(lang, "Institusi", "Institutions")} value={institution} color="var(--warn-orange)" />
                <Metric label={t(lang, "Antarabangsa", "International")} value={international} color="var(--neon-red)" />
              </div>
            </TacticalPanel>
          </div>

          <TacticalPanel title={t(lang, "TUAS DASAR NEGARA", "NATIONAL POLICY LEVERS")} noPadding>
            <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-4 space-y-3">
              {LEVERS.map((lever) => {
                const active = activeLevers.includes(lever.id);
                return (
                  <button
                    key={lever.id}
                    onClick={() => toggleLever(lever.id)}
                    className="w-full border p-4 text-left transition hover:scale-[1.005]"
                    style={{ borderColor: active ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.16)", background: active ? "rgb(var(--gold-rgb)/0.10)" : "rgba(3,8,15,0.72)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-black tracking-wider text-white">{t(lang, lever.titleMS, lever.titleEN)}</div>
                        <div className="mt-1 text-[11px] leading-relaxed text-text-muted">{t(lang, lever.detailMS, lever.detailEN)}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-bold tracking-wider">
                          <span style={{ color: "var(--neon-green)" }}>Eco {lever.economy >= 0 ? "+" : ""}{lever.economy}</span>
                          <span style={{ color: "var(--gold)" }}>Fed {lever.federal >= 0 ? "+" : ""}{lever.federal}</span>
                          <span style={{ color: "var(--cyan)" }}>Parl {lever.parliament >= 0 ? "+" : ""}{lever.parliament}</span>
                          <span style={{ color: "var(--warn-orange)" }}>Inst {lever.institution >= 0 ? "+" : ""}{lever.institution}</span>
                          <span style={{ color: "var(--neon-red)" }}>Intl {lever.international >= 0 ? "+" : ""}{lever.international}</span>
                          <span className="text-text-muted">RM {formatNumber(lever.cost)}</span>
                        </div>
                      </div>
                      <div className="text-[10px] font-black tracking-widest" style={{ color: active ? "var(--gold)" : "var(--text-muted)" }}>{active ? t(lang, "AKTIF", "ACTIVE") : t(lang, "PILIH", "SELECT")}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </TacticalPanel>

          <div className="space-y-4">
            <TacticalPanel title={t(lang, "HUBUNGAN PERSEKUTUAN-NEGERI", "FEDERAL-STATE RELATIONS")}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-bold tracking-[0.2em] text-text-muted">{t(lang, "KUBU KUAT", "STRONGHOLDS")}</div>
                  <div className="mt-2 space-y-1">
                    {strongestStates.map((state) => <div key={state.id} className="flex justify-between text-[11px]"><span className="text-white">{state.name}</span><span style={{ color: "var(--neon-green)" }}>{Math.round(state.mandatSupport)}</span></div>)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-[0.2em] text-text-muted">{t(lang, "TEKANAN", "PRESSURE")}</div>
                  <div className="mt-2 space-y-1">
                    {pressureStates.map((state) => <div key={state.id} className="flex justify-between text-[11px]"><span className="text-white">{state.name}</span><span style={{ color: "var(--warn-orange)" }}>{Math.round(state.mandatSupport)}</span></div>)}
                  </div>
                </div>
              </div>
            </TacticalPanel>

            <TacticalPanel title={t(lang, "PARLIMEN & INSTITUSI", "PARLIAMENT & INSTITUTIONS")}>
              <div className="space-y-2 text-[11px] leading-relaxed text-text-muted">
                <div>{t(lang, "Majoriti efektif", "Effective majority")}: <span className="font-black text-white">{Math.round((parliament / 100) * TOTAL_SEATS)}</span></div>
                <div>{t(lang, "Ruang fiskal selepas dasar", "Fiscal space after policy")}: <span className="font-black" style={{ color: resources.funds - policyCost >= 0 ? "var(--neon-green)" : "var(--neon-red)" }}>RM {formatNumber(resources.funds - policyCost)}</span></div>
                <div>{t(lang, "Tekanan media/mahkamah", "Media/court pressure")}: <span className="font-black" style={{ color: institution >= 65 ? "var(--neon-green)" : "var(--warn-orange)" }}>{institution >= 65 ? t(lang, "terkawal", "managed") : t(lang, "tinggi", "high")}</span></div>
                <div>{t(lang, "Mode pilihan raya", "Election mode")}: <span className="font-black text-white">{settings.electionScope.toUpperCase()}</span></div>
              </div>
            </TacticalPanel>

            <TacticalPanel title={t(lang, "CATATAN SEJARAH ALTERNATIF", "ALTERNATE HISTORY LOG")}>
              <div className="space-y-2 text-[11px] leading-relaxed text-text-muted">
                <div>01 · {t(lang, "Mandat kerajaan diuji melalui ekonomi, federalisme dan institusi.", "Mandate tested through economy, federalism and institutions.")}</div>
                <div>02 · {t(lang, "Setiap tuas dasar mengubah masa depan PRU/PRN berikutnya.", "Every policy lever changes the next GE/PRN future.")}</div>
                <div>03 · {t(lang, "Sandbox ini menjadi asas simulasi Malaysia penuh.", "This sandbox is the foundation for full Malaysia simulation.")}</div>
              </div>
            </TacticalPanel>
          </div>
        </div>
      </main>
      <StatusBar leftText={`${t(lang, "FASA 4 · SANDBOX MALAYSIA", "PHASE 4 · MALAYSIA SANDBOX")} · ${t(lang, scenario.labelMS, scenario.labelEN)}`} rightText={`${leader.partyAbbr} · Stability ${nationalStability} · ${difficulty.toUpperCase()}`} />
    </div>
  );
}
