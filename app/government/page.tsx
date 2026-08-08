"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";
import { formatNumber } from "../utils/format";
import { computeElectionOutcome } from "../utils/electionOutcome";
import { getGovernmentTerms } from "../utils/governmentTerms";
import { usePendingNav } from "../hooks/usePendingNav";

type PolicyId = string;
type CrisisId = string;

type Policy = {
  id: PolicyId;
  cost: number;
  approval: number;
  stability: number;
  trust: number;
};

type Crisis = {
  id: CrisisId;
  pressure: number;
  choices: { approval: number; stability: number; trust: number }[];
};

const FEDERAL_POLICIES: Policy[] = [
  { id: "cost", cost: 420000, approval: 7, stability: 1, trust: 5 },
  { id: "jobs", cost: 320000, approval: 5, stability: 1, trust: 4 },
  { id: "antiCorruption", cost: 180000, approval: 4, stability: -2, trust: 8 },
  { id: "rural", cost: 500000, approval: 6, stability: 2, trust: 3 },
  { id: "federalState", cost: 260000, approval: 3, stability: 6, trust: 4 },
];

const STATE_POLICIES: Policy[] = [
  { id: "cost", cost: 180000, approval: 7, stability: 1, trust: 5 },
  { id: "jobs", cost: 150000, approval: 5, stability: 1, trust: 4 },
  { id: "antiCorruption", cost: 90000, approval: 4, stability: -2, trust: 8 },
  { id: "rural", cost: 240000, approval: 6, stability: 2, trust: 3 },
  { id: "federalState", cost: 60000, approval: 3, stability: 6, trust: 4 },
];

const FEDERAL_CRISES: Crisis[] = [
  { id: "livingCost", pressure: 68, choices: [
    { approval: 6, stability: 0, trust: 3 },
    { approval: -4, stability: 2, trust: -1 },
  ] },
  { id: "flood", pressure: 61, choices: [
    { approval: 4, stability: 4, trust: 5 },
    { approval: -3, stability: -2, trust: -4 },
  ] },
  { id: "coalition", pressure: 72, choices: [
    { approval: -1, stability: 7, trust: 0 },
    { approval: 2, stability: -6, trust: 1 },
  ] },
  { id: "minister", pressure: 76, choices: [
    { approval: 3, stability: -1, trust: 7 },
    { approval: -5, stability: 2, trust: -6 },
  ] },
];

const STATE_CRISES: Crisis[] = [
  { id: "livingCost", pressure: 64, choices: [
    { approval: 6, stability: 0, trust: 3 },
    { approval: -4, stability: 2, trust: -1 },
  ] },
  { id: "flood", pressure: 61, choices: [
    { approval: 4, stability: 4, trust: 5 },
    { approval: -3, stability: -2, trust: -4 },
  ] },
  { id: "coalition", pressure: 70, choices: [
    { approval: -1, stability: 7, trust: 0 },
    { approval: 2, stability: -6, trust: 1 },
  ] },
  { id: "exco", pressure: 73, choices: [
    { approval: 3, stability: -1, trust: 7 },
    { approval: -5, stability: 2, trust: -6 },
  ] },
];

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
  const { states, resources, leader, day, totalDays, difficulty, settings, governmentProgress, setGovernmentProgress } = useGameStore();
  const { activePolicies, crisisIndex, crisisDeltas } = governmentProgress;

  const outcome = useMemo(
    () => computeElectionOutcome(states, { electionScope: settings.electionScope, prnStateId: settings.prnStateId }),
    [states, settings.electionScope, settings.prnStateId]
  );
  const terms = getGovernmentTerms(lang, settings.electionScope, outcome.contestedStates[0]);
  const isPrn = terms.isPrn;
  const scope = isPrn ? "state" : "federal";
  const policies = isPrn ? STATE_POLICIES : FEDERAL_POLICIES;
  const crises = isPrn ? STATE_CRISES : FEDERAL_CRISES;
  const seatsWon = outcome.seatsWon;
  const totalSeats = outcome.totalSeats;
  const majorityTarget = outcome.majorityTarget;
  const canGovern = seatsWon >= majorityTarget;
  const nationalSupport = outcome.nationalSupport;
  const chosenPolicies = policies.filter((policy) => activePolicies.includes(policy.id));
  const policyCost = chosenPolicies.reduce((sum, policy) => sum + policy.cost, 0);
  const policyApproval = chosenPolicies.reduce((sum, policy) => sum + policy.approval, 0);
  const policyStability = chosenPolicies.reduce((sum, policy) => sum + policy.stability, 0);
  const policyTrust = chosenPolicies.reduce((sum, policy) => sum + policy.trust, 0);
  const coalitionStability = clamp(48 + Math.round((seatsWon - majorityTarget) * 0.9) + Math.round(leader.negotiation / 8) + policyStability + crisisDeltas.stability);
  const approval = clamp(nationalSupport + policyApproval + crisisDeltas.approval + (settings.electionScope === "prn" ? 2 : 0));
  const publicTrust = clamp(50 + Math.round(leader.credibility / 7) + policyTrust + crisisDeltas.trust - Math.max(0, policyCost - resources.funds) / 100000);
  const fiscalSpace = Math.max(0, resources.funds - policyCost);
  const currentCrisis = crises[crisisIndex % crises.length];
  const termDay = Math.max(1, day - totalDays);

  function togglePolicy(id: PolicyId) {
    setGovernmentProgress({ activePolicies: activePolicies.includes(id) ? activePolicies.filter((item) => item !== id) : [...activePolicies, id] });
  }

  function respond(choice: Crisis["choices"][number]) {
    setGovernmentProgress({
      crisisDeltas: {
        approval: crisisDeltas.approval + choice.approval,
        stability: crisisDeltas.stability + choice.stability,
        trust: crisisDeltas.trust + choice.trust,
      },
      crisisIndex: crisisIndex + 1,
    });
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {t(lang, "government_page.formedGoverningPhase", { termsGovernmentName: terms.governmentName })}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>
              {isPrn ? t(lang, "government_page.govern", { termsStateName: terms.stateName.toUpperCase() }) : t(lang, "government_page.governTheCountry")}
            </h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>
              {terms.headTitle} · {leader.partyAbbr} · {seatsWon}/{totalSeats} {t(lang, "government_page.seats", { termsSeatLabel: terms.seatLabel })} · {t(lang, "government_page.governingDay")} {termDay}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/cabinet")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {terms.executiveBody}</button>
            <button onClick={() => router.push("/kawasan")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--gold-rgb)/0.42)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.08)" }}>{t(lang, "government_page.developConstituency")}</button>
            <button onClick={() => navigate("/career")} disabled={isPending} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-60 disabled:cursor-wait" style={{ border: "1px solid rgb(var(--neon-green-rgb,0 255 136)/0.42)", color: "var(--neon-green)", background: "rgb(0 255 136 / 0.06)" }}>{isPending ? t(lang, "government_page.loading") : t(lang, "government_page.manageTerm")}</button>
            <span className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(255 176 0 / 0.32)", color: "var(--warn-orange)", background: "rgb(255 176 0 / 0.06)" }}>{t(lang, "government_page.warRoomLocked")}</span>
          </div>
        </div>

        {canGovern && (
          <div className="mb-4 border px-4 py-3" style={{ borderColor: "rgb(var(--gold-rgb)/0.34)", background: "linear-gradient(90deg, rgb(var(--gold-rgb)/0.09), rgba(3,8,15,0.72))" }}>
            <div className="text-[11px] font-black tracking-[0.24em]" style={{ color: "var(--gold)" }}>{t(lang, "government_page.storylineFlow")}</div>
            <div className="mt-1 text-[13px] text-text-muted">
              {isPrn
                ? t(lang, "government_page.theExcoLineUpIsFormed", { termsGovernmentName: terms.governmentName })
                : t(lang, "government_page.cabinetIsFormedElectionModeIs")}
            </div>
          </div>
        )}

        {!canGovern ? (
          <TacticalPanel title={t(lang, "government_page.notFormed", { termsGovernmentName: terms.governmentName })}>
            <div className="py-10 text-center">
              <div className="text-5xl font-black" style={{ color: "var(--neon-red)" }}>{seatsWon}/{majorityTarget}</div>
              <div className="mt-3 text-sm text-text-muted">{t(lang, "government_page.reachMajorityFirstBeforeEnteringGovernment")}</div>
            </div>
          </TacticalPanel>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)_390px]">
            <div className="space-y-4">
              <TacticalPanel title={t(lang, "government_page.mandateStatus")}>
                <div className="text-5xl font-black" style={{ color: leader.partyColor }}>{seatsWon}</div>
                <div className="mt-1 text-[12px] text-text-muted tracking-wider">{t(lang, "government_page.governmentSeats")}</div>
                <div className="mt-3 h-3 overflow-hidden" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.2)", background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full" style={{ width: `${Math.min(100, seatsWon / Math.max(1, totalSeats) * 100)}%`, background: `linear-gradient(90deg, ${leader.partyColor}, var(--gold))` }} />
                </div>
              </TacticalPanel>

              <TacticalPanel title={t(lang, "government_page.governingIndex")}>
                <div className="grid grid-cols-2 gap-2">
                  <MetricCard label={t(lang, "government_page.approval")} value={approval} color="var(--neon-green)" />
                  <MetricCard label={t(lang, "government_page.trust")} value={publicTrust} color="var(--cyan)" />
                  <MetricCard label={t(lang, "government_page.coalition")} value={coalitionStability} color="var(--gold)" />
                  <MetricCard label={t(lang, "government_page.funds")} value={Math.round(fiscalSpace / 10000)} color="var(--warn-orange)" suffix="k" />
                </div>
              </TacticalPanel>
            </div>

            <TacticalPanel title={t(lang, "government_page._100DayPolicyAgenda")} noPadding>
              <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-4 space-y-3">
                {policies.map((policy) => {
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
                          <div className="text-[14px] font-black tracking-wider text-white">{t(lang, `government_page.policy_${scope}_${policy.id}_title`)}</div>
                          <div className="mt-1 text-[11px] leading-relaxed text-text-muted">{t(lang, `government_page.policy_${scope}_${policy.id}_detail`)}</div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-bold tracking-wider">
                            <span style={{ color: "var(--warn-orange)" }}>RM {formatNumber(policy.cost)}</span>
                            <span style={{ color: "var(--neon-green)" }}>Approval +{policy.approval}</span>
                            <span style={{ color: "var(--cyan)" }}>Trust +{policy.trust}</span>
                            <span style={{ color: policy.stability >= 0 ? "var(--gold)" : "var(--neon-red)" }}>Coalition {policy.stability >= 0 ? "+" : ""}{policy.stability}</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-black tracking-widest" style={{ color: active ? "var(--gold)" : "var(--text-muted)" }}>{active ? t(lang, "government_page.active") : t(lang, "government_page.select")}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </TacticalPanel>

            <div className="space-y-4">
              <TacticalPanel title={t(lang, "government_page.crisisRoom")}>
                <div className="text-[10px] font-bold tracking-[0.22em] text-text-muted">{isPrn ? t(lang, "government_page.statePressure") : t(lang, "government_page.nationalPressure")}</div>
                <div className="mt-1 text-4xl font-black" style={{ color: "var(--warn-orange)" }}>{currentCrisis.pressure}</div>
                <div className="mt-3 text-[15px] font-black text-white">{t(lang, `government_page.crisis_${scope}_${currentCrisis.id}_title`, { stateName: terms.stateName })}</div>
                <div className="mt-2 text-[12px] leading-relaxed text-text-muted">{t(lang, `government_page.crisis_${scope}_${currentCrisis.id}_detail`, { headTitle: terms.headTitle })}</div>
                <div className="mt-4 space-y-2">
                  {currentCrisis.choices.map((choice, index) => (
                    <button key={index} onClick={() => respond(choice)} className="w-full border px-3 py-2 text-left text-[11px] font-bold tracking-wider transition hover:scale-[1.01]" style={{ borderColor: "rgb(var(--cyan-rgb)/0.22)", color: "var(--cyan)", background: "rgba(0,212,255,0.045)" }}>
                      {t(lang, `government_page.crisis_${scope}_${currentCrisis.id}_choice${index}`)}
                    </button>
                  ))}
                </div>
              </TacticalPanel>

              <TacticalPanel title={t(lang, "government_page.termSummary")}>
                <div className="space-y-2 text-[11px] text-text-muted leading-relaxed">
                  <div>{t(lang, "government_page.activeAgenda")}: <span className="font-black text-white">{activePolicies.length}</span></div>
                  <div>{t(lang, "government_page.policyCost")}: <span className="font-black" style={{ color: "var(--warn-orange)" }}>RM {formatNumber(policyCost)}</span></div>
                  <div>{t(lang, "government_page.fiscalSpace")}: <span className="font-black" style={{ color: fiscalSpace > 0 ? "var(--neon-green)" : "var(--neon-red)" }}>RM {formatNumber(fiscalSpace)}</span></div>
                  <div>{t(lang, "government_page.mode")}: <span className="font-black text-white">{settings.electionScope.toUpperCase()}</span></div>
                </div>
              </TacticalPanel>
            </div>
          </div>
        )}
      </main>
      <StatusBar leftText={`${t(lang, "government_page.phase2Government")} · ${terms.governmentName} · ${difficulty.toUpperCase()}`} rightText={`${leader.partyAbbr} ${seatsWon} ${t(lang, "government_page.seats", { termsSeatLabel: terms.seatLabel })} · Approval ${approval}%`} />
    </div>
  );
}
