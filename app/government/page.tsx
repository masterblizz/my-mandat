"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";
import { generateConstituencies } from "../data/constituencies";
import type { StateData } from "../data/states";
import { formatNumber } from "../utils/format";
import { usePendingNav } from "../hooks/usePendingNav";

const TOTAL_SEATS = 222;
const MAJORITY = 112;

type PolicyId = "cost" | "jobs" | "antiCorruption" | "rural" | "federalState";
type CrisisId = "livingCost" | "flood" | "coalition" | "minister";

type Policy = {
  id: PolicyId;
  titleMS: string;
  titleEN: string;
  detailMS: string;
  detailEN: string;
  cost: number;
  approval: number;
  stability: number;
  trust: number;
};

type Crisis = {
  id: CrisisId;
  titleMS: string;
  titleEN: string;
  detailMS: string;
  detailEN: string;
  pressure: number;
  choices: { labelMS: string; labelEN: string; approval: number; stability: number; trust: number }[];
};

const POLICIES: Policy[] = [
  { id: "cost", titleMS: "Pakej Kos Sara Hidup", titleEN: "Cost of Living Package", detailMS: "Subsidi bersasar, bantuan tunai dan kawalan harga barang asas.", detailEN: "Targeted subsidy, cash aid and essential price control.", cost: 420000, approval: 7, stability: 1, trust: 5 },
  { id: "jobs", titleMS: "Pelan Kerja Anak Muda", titleEN: "Youth Jobs Plan", detailMS: "Insentif pekerjaan, latihan digital dan gaji permulaan graduan.", detailEN: "Hiring incentives, digital training and graduate starter wage support.", cost: 320000, approval: 5, stability: 1, trust: 4 },
  { id: "antiCorruption", titleMS: "Reformasi Anti-Rasuah", titleEN: "Anti-Corruption Reform", detailMS: "Audit GLC, procurement terbuka dan perlindungan pemberi maklumat.", detailEN: "GLC audit, open procurement and whistleblower protection.", cost: 180000, approval: 4, stability: -2, trust: 8 },
  { id: "rural", titleMS: "Infrastruktur Luar Bandar", titleEN: "Rural Infrastructure", detailMS: "Jalan kampung, klinik desa, internet dan bekalan air negeri pinggir.", detailEN: "Village roads, rural clinics, internet and water supply in peripheral states.", cost: 500000, approval: 6, stability: 2, trust: 3 },
  { id: "federalState", titleMS: "Perjanjian Persekutuan-Negeri", titleEN: "Federal-State Compact", detailMS: "Dana pembangunan negeri, MA63 dan mekanisme rundingan MB/KM.", detailEN: "State development fund, MA63 and MB/CM negotiation mechanism.", cost: 260000, approval: 3, stability: 6, trust: 4 },
];

const CRISES: Crisis[] = [
  { id: "livingCost", titleMS: "Harga barang naik selepas PRU", titleEN: "Prices rise after election", detailMS: "Media menekan kerajaan baru; rakyat mahu tindakan cepat.", detailEN: "Media pressure rises; voters demand fast action.", pressure: 68, choices: [
    { labelMS: "Umum bantuan segera", labelEN: "Announce immediate aid", approval: 6, stability: 0, trust: 3 },
    { labelMS: "Tunggu bajet penuh", labelEN: "Wait for full budget", approval: -4, stability: 2, trust: -1 },
  ] },
  { id: "flood", titleMS: "Banjir besar di Pantai Timur", titleEN: "Major flood in East Coast", detailMS: "Agensi bantuan perlukan arahan pusat dan dana kecemasan.", detailEN: "Relief agencies need central orders and emergency funding.", pressure: 61, choices: [
    { labelMS: "Gerak taskforce nasional", labelEN: "Deploy national taskforce", approval: 4, stability: 4, trust: 5 },
    { labelMS: "Serah kepada negeri", labelEN: "Leave it to state level", approval: -3, stability: -2, trust: -4 },
  ] },
  { id: "coalition", titleMS: "Rakan koalisi tuntut jawatan", titleEN: "Coalition partner demands posts", detailMS: "Blok kecil mahu lebih peranan dalam keputusan kabinet.", detailEN: "A smaller bloc wants more say in cabinet decisions.", pressure: 72, choices: [
    { labelMS: "Beri konsesi dasar", labelEN: "Offer policy concession", approval: -1, stability: 7, trust: 0 },
    { labelMS: "Tolak dan disiplinkan", labelEN: "Reject and discipline", approval: 2, stability: -6, trust: 1 },
  ] },
  { id: "minister", titleMS: "Isu integriti menteri viral", titleEN: "Minister integrity issue goes viral", detailMS: "Opposition minta PM jelaskan kedudukan menteri terbabit.", detailEN: "Opposition asks PM to clarify the minister's position.", pressure: 76, choices: [
    { labelMS: "Siasat terbuka", labelEN: "Open investigation", approval: 3, stability: -1, trust: 7 },
    { labelMS: "Pertahan menteri", labelEN: "Defend minister", approval: -5, stability: 2, trust: -6 },
  ] },
];

function computeMandatSeats(states: StateData[]) {
  return states.reduce((sum, state) => {
    const details = generateConstituencies(state).map((constituency, index) => {
      const seed = constituency.id.split("").reduce((total, ch) => total + ch.charCodeAt(0), 0) + index * 13;
      const avgRegistered = Math.max(1, Math.round(state.registeredVoters / Math.max(1, state.seats)));
      const registeredVoters = Math.round(avgRegistered * (0.88 + (seed % 25) / 100));
      const turnoutPct = Math.max(55, Math.min(88, state.turnoutTarget + ((seed % 17) - 8) * 0.55));
      const votesCast = Math.round(registeredVoters * (turnoutPct / 100));
      const mandatVotes = Math.round(votesCast * (constituency.mandat / 100));
      const lawanVotes = Math.round(votesCast * (constituency.lawan / 100));
      const othersVotes = Math.max(0, votesCast - mandatVotes - lawanVotes);
      return mandatVotes >= lawanVotes && mandatVotes >= othersVotes;
    });
    return sum + details.filter(Boolean).length;
  }, 0);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function MetricCard({ label, value, color, suffix = "%" }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <div className="border p-3" style={{ borderColor: `${color}55`, background: "rgba(3,8,15,0.68)" }}>
      <div className="text-[10px] font-bold tracking-[0.22em] text-text-muted">{label}</div>
      <div className="mt-2 text-3xl font-black" style={{ color }}>{value}{suffix}</div>
      <div className="mt-2 h-2 overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
      </div>
    </div>
  );
}

export default function GovernmentPage() {
  const router = useRouter();
  const { isPending, navigate } = usePendingNav();
  const lang = useLang();
  const { states, resources, leader, day, totalDays, difficulty, settings } = useGameStore();
  const [activePolicies, setActivePolicies] = useState<PolicyId[]>(["cost", "antiCorruption"]);
  const [crisisIndex, setCrisisIndex] = useState(0);
  const [crisisDeltas, setCrisisDeltas] = useState({ approval: 0, stability: 0, trust: 0 });

  const seatsWon = useMemo(() => computeMandatSeats(states), [states]);
  const canGovern = seatsWon >= MAJORITY;
  const nationalSupport = Math.round(states.reduce((sum, state) => sum + state.mandatSupport * (state.seats / TOTAL_SEATS), 0));
  const chosenPolicies = POLICIES.filter((policy) => activePolicies.includes(policy.id));
  const policyCost = chosenPolicies.reduce((sum, policy) => sum + policy.cost, 0);
  const policyApproval = chosenPolicies.reduce((sum, policy) => sum + policy.approval, 0);
  const policyStability = chosenPolicies.reduce((sum, policy) => sum + policy.stability, 0);
  const policyTrust = chosenPolicies.reduce((sum, policy) => sum + policy.trust, 0);
  const coalitionStability = clamp(48 + Math.round((seatsWon - MAJORITY) * 0.9) + Math.round(leader.negotiation / 8) + policyStability + crisisDeltas.stability);
  const approval = clamp(nationalSupport + policyApproval + crisisDeltas.approval + (settings.electionScope === "prn" ? 2 : 0));
  const publicTrust = clamp(50 + Math.round(leader.credibility / 7) + policyTrust + crisisDeltas.trust - Math.max(0, policyCost - resources.funds) / 100000);
  const fiscalSpace = Math.max(0, resources.funds - policyCost);
  const currentCrisis = CRISES[crisisIndex % CRISES.length];
  const termDay = Math.max(1, day - totalDays);

  function togglePolicy(id: PolicyId) {
    setActivePolicies((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function respond(choice: Crisis["choices"][number]) {
    setCrisisDeltas((current) => ({
      approval: current.approval + choice.approval,
      stability: current.stability + choice.stability,
      trust: current.trust + choice.trust,
    }));
    setCrisisIndex((current) => current + 1);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {t(lang, "KERAJAAN DITUBUHKAN · FASA MEMERINTAH", "GOVERNMENT FORMED · GOVERNING PHASE")}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{t(lang, "MEMERINTAH NEGARA", "GOVERN THE COUNTRY")}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>
              {leader.partyAbbr} · {seatsWon}/{TOTAL_SEATS} {t(lang, "KERUSI", "SEATS")} · {t(lang, "HARI PEMERINTAHAN", "GOVERNING DAY")} {termDay}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/cabinet")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {t(lang, "KABINET", "CABINET")}</button>
            <button onClick={() => navigate("/career")} disabled={isPending} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-60 disabled:cursor-wait" style={{ border: "1px solid rgb(var(--neon-green-rgb,0 255 136)/0.42)", color: "var(--neon-green)", background: "rgb(0 255 136 / 0.06)" }}>{isPending ? t(lang, "MEMUATKAN...", "LOADING...") : t(lang, "URUS PENGGAL", "MANAGE TERM")}</button>
            <span className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(255 176 0 / 0.32)", color: "var(--warn-orange)", background: "rgb(255 176 0 / 0.06)" }}>{t(lang, "WAR ROOM DIKUNCI", "WAR ROOM LOCKED")}</span>
          </div>
        </div>

        {canGovern && (
          <div className="mb-4 border px-4 py-3" style={{ borderColor: "rgb(var(--gold-rgb)/0.34)", background: "linear-gradient(90deg, rgb(var(--gold-rgb)/0.09), rgba(3,8,15,0.72))" }}>
            <div className="text-[11px] font-black tracking-[0.24em]" style={{ color: "var(--gold)" }}>{t(lang, "ALIRAN STORYLINE", "STORYLINE FLOW")}</div>
            <div className="mt-1 text-[13px] text-text-muted">
              {t(lang, "Kabinet telah dibentuk. Mod pilihan raya ditutup; War Room dikunci sehingga tetingkap PRU/PRN seterusnya. Fokus kini ialah memerintah, melaksanakan dasar, mengurus krisis dan mengekalkan mandat.", "Cabinet is formed. Election mode is closed; War Room is locked until the next GE/PRN window. Focus now shifts to governing, policy delivery, crisis management and mandate survival.")}
            </div>
          </div>
        )}

        {!canGovern ? (
          <TacticalPanel title={t(lang, "KERAJAAN BELUM TERBENTUK", "GOVERNMENT NOT FORMED")}>
            <div className="py-10 text-center">
              <div className="text-5xl font-black" style={{ color: "var(--neon-red)" }}>{seatsWon}/{MAJORITY}</div>
              <div className="mt-3 text-sm text-text-muted">{t(lang, "Capai majoriti dahulu sebelum memasuki fasa pemerintahan.", "Reach majority first before entering government phase.")}</div>
            </div>
          </TacticalPanel>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)_390px]">
            <div className="space-y-4">
              <TacticalPanel title={t(lang, "STATUS MANDAT", "MANDATE STATUS")}>
                <div className="text-5xl font-black" style={{ color: leader.partyColor }}>{seatsWon}</div>
                <div className="mt-1 text-[12px] text-text-muted tracking-wider">{t(lang, "kerusi kerajaan", "government seats")}</div>
                <div className="mt-3 h-3 overflow-hidden" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.2)", background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full" style={{ width: `${Math.min(100, seatsWon / TOTAL_SEATS * 100)}%`, background: `linear-gradient(90deg, ${leader.partyColor}, var(--gold))` }} />
                </div>
              </TacticalPanel>

              <TacticalPanel title={t(lang, "INDEKS PEMERINTAHAN", "GOVERNING INDEX")}>
                <div className="grid grid-cols-2 gap-2">
                  <MetricCard label={t(lang, "Approval", "Approval")} value={approval} color="var(--neon-green)" />
                  <MetricCard label={t(lang, "Trust", "Trust")} value={publicTrust} color="var(--cyan)" />
                  <MetricCard label={t(lang, "Koalisi", "Coalition")} value={coalitionStability} color="var(--gold)" />
                  <MetricCard label={t(lang, "Dana", "Funds")} value={Math.round(fiscalSpace / 10000)} color="var(--warn-orange)" suffix="k" />
                </div>
              </TacticalPanel>
            </div>

            <TacticalPanel title={t(lang, "AGENDA DASAR 100 HARI", "100-DAY POLICY AGENDA")} noPadding>
              <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-4 space-y-3">
                {POLICIES.map((policy) => {
                  const active = activePolicies.includes(policy.id);
                  return (
                    <button
                      key={policy.id}
                      onClick={() => togglePolicy(policy.id)}
                      className="w-full border p-4 text-left transition hover:scale-[1.005]"
                      style={{ borderColor: active ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.16)", background: active ? "rgb(var(--gold-rgb)/0.10)" : "rgba(3,8,15,0.72)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-black tracking-wider text-white">{t(lang, policy.titleMS, policy.titleEN)}</div>
                          <div className="mt-1 text-[11px] leading-relaxed text-text-muted">{t(lang, policy.detailMS, policy.detailEN)}</div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-bold tracking-wider">
                            <span style={{ color: "var(--warn-orange)" }}>RM {formatNumber(policy.cost)}</span>
                            <span style={{ color: "var(--neon-green)" }}>Approval +{policy.approval}</span>
                            <span style={{ color: "var(--cyan)" }}>Trust +{policy.trust}</span>
                            <span style={{ color: policy.stability >= 0 ? "var(--gold)" : "var(--neon-red)" }}>Coalition {policy.stability >= 0 ? "+" : ""}{policy.stability}</span>
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
              <TacticalPanel title={t(lang, "BILIK KRISIS", "CRISIS ROOM")}>
                <div className="text-[10px] font-bold tracking-[0.22em] text-text-muted">{t(lang, "TEKANAN NASIONAL", "NATIONAL PRESSURE")}</div>
                <div className="mt-1 text-4xl font-black" style={{ color: "var(--warn-orange)" }}>{currentCrisis.pressure}</div>
                <div className="mt-3 text-[15px] font-black text-white">{t(lang, currentCrisis.titleMS, currentCrisis.titleEN)}</div>
                <div className="mt-2 text-[12px] leading-relaxed text-text-muted">{t(lang, currentCrisis.detailMS, currentCrisis.detailEN)}</div>
                <div className="mt-4 space-y-2">
                  {currentCrisis.choices.map((choice) => (
                    <button key={choice.labelEN} onClick={() => respond(choice)} className="w-full border px-3 py-2 text-left text-[11px] font-bold tracking-wider transition hover:scale-[1.01]" style={{ borderColor: "rgb(var(--cyan-rgb)/0.22)", color: "var(--cyan)", background: "rgba(0,212,255,0.045)" }}>
                      {t(lang, choice.labelMS, choice.labelEN)}
                    </button>
                  ))}
                </div>
              </TacticalPanel>

              <TacticalPanel title={t(lang, "RINGKASAN TERM", "TERM SUMMARY")}>
                <div className="space-y-2 text-[11px] text-text-muted leading-relaxed">
                  <div>{t(lang, "Agenda aktif", "Active agenda")}: <span className="font-black text-white">{activePolicies.length}</span></div>
                  <div>{t(lang, "Kos dasar", "Policy cost")}: <span className="font-black" style={{ color: "var(--warn-orange)" }}>RM {formatNumber(policyCost)}</span></div>
                  <div>{t(lang, "Baki fiskal", "Fiscal space")}: <span className="font-black" style={{ color: fiscalSpace > 0 ? "var(--neon-green)" : "var(--neon-red)" }}>RM {formatNumber(fiscalSpace)}</span></div>
                  <div>{t(lang, "Mode", "Mode")}: <span className="font-black text-white">{settings.electionScope.toUpperCase()}</span></div>
                </div>
              </TacticalPanel>
            </div>
          </div>
        )}
      </main>
      <StatusBar leftText={`${t(lang, "FASA 2 · PEMERINTAHAN", "PHASE 2 · GOVERNMENT")} · ${difficulty.toUpperCase()}`} rightText={`${leader.partyAbbr} ${seatsWon} ${t(lang, "KERUSI", "SEATS")} · Approval ${approval}%`} />
    </div>
  );
}
