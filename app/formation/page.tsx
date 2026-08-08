"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";
import { computeElectionOutcome } from "../utils/electionOutcome";
import { getGovernmentTerms } from "../utils/governmentTerms";
import { usePendingNav } from "../hooks/usePendingNav";

const FEDERAL_PARTNERS = [
  { id: "borneo", seats: 18, stability: 74 },
  { id: "centrist", seats: 14, stability: 68 },
  { id: "regional", seats: 9, stability: 61 },
];

const STATE_PARTNERS = [
  { id: "borneo", seats: 4, stability: 66 },
  { id: "centrist", seats: 3, stability: 71 },
  { id: "regional", seats: 2, stability: 58 },
];

export default function FormationPage() {
  const router = useRouter();
  const { isPending, navigate } = usePendingNav();
  const lang = useLang();
  const { states, leader, settings } = useGameStore();
  const outcome = computeElectionOutcome(states, { electionScope: settings.electionScope, prnStateId: settings.prnStateId });
  const terms = getGovernmentTerms(lang, settings.electionScope, outcome.contestedStates[0]);
  const partnerPool = terms.isPrn ? STATE_PARTNERS : FEDERAL_PARTNERS;
  const partnerScope = terms.isPrn ? "state" : "federal";
  const majorityTarget = outcome.majorityTarget;
  const [partners, setPartners] = useState<string[]>(outcome.status === "hung" ? ["borneo"] : []);
  const selectedPartners = partnerPool.filter((partner) => partners.includes(partner.id));
  const coalitionSeats = outcome.seatsWon + selectedPartners.reduce((sum, partner) => sum + partner.seats, 0);
  const confidenceScore = Math.min(100, Math.round((coalitionSeats / majorityTarget) * 74 + leader.negotiation / 4 + selectedPartners.reduce((sum, partner) => sum + partner.stability, 0) / Math.max(1, selectedPartners.length || 1) / 6));
  const canForm = coalitionSeats >= majorityTarget;
  const istanaText = canForm
    ? t(lang, "formation_page.majorityCanBeProvenIsReady", { termsAppointingAuthority: terms.appointingAuthority, termsHeadTitle: terms.headTitle, termsExecutiveBody: terms.executiveBody })
    : t(lang, "formation_page.supportIsInsufficientNegotiatePartnersOr");

  function togglePartner(id: string) {
    setPartners((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {terms.appointingAuthority} · {t(lang, "formation_page.formation", { termsGovernmentName: terms.governmentName })}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{t(lang, "formation_page.negotiatePower")}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>{terms.scopeLabel} · {leader.partyAbbr} · {outcome.seatsWon}/{outcome.totalSeats} {t(lang, "formation_page.seats", { termsSeatLabel: terms.seatLabel })}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/mandate")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {t(lang, "formation_page.mandate")}</button>
            <button onClick={() => navigate(canForm ? "/cabinet" : "/opposition")} disabled={isPending} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-60 disabled:cursor-wait" style={{ border: `1px solid ${canForm ? "rgb(var(--gold-rgb)/0.5)" : "rgb(255 176 0 / 0.38)"}`, color: canForm ? "var(--gold)" : "var(--warn-orange)", background: canForm ? "rgb(var(--gold-rgb)/0.08)" : "rgb(255 176 0 / 0.06)" }}>{isPending ? t(lang, "formation_page.loading") : canForm ? t(lang, "formation_page.form", { termsExecutiveBody: terms.executiveBody }) : t(lang, "formation_page.enterOpposition")}</button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
          <TacticalPanel title={t(lang, "formation_page.confidenceCheck")}>
            <div className="text-[10px] font-bold tracking-[0.24em] text-text-muted">{t(lang, "formation_page.coalitionSeats")}</div>
            <div className="mt-2 text-6xl font-black" style={{ color: canForm ? "var(--neon-green)" : "var(--warn-orange)" }}>{coalitionSeats}</div>
            <div className="mt-1 text-[12px] text-text-muted">{t(lang, "formation_page.majorityTarget")} {majorityTarget} · {terms.assemblyName}</div>
            <div className="mt-5 h-3 overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}><div className="h-full" style={{ width: `${Math.min(100, coalitionSeats / majorityTarget * 100)}%`, background: canForm ? "var(--neon-green)" : "var(--warn-orange)" }} /></div>
            <div className="mt-4 text-[12px] leading-relaxed text-text-muted">{istanaText}</div>
          </TacticalPanel>

          <TacticalPanel title={t(lang, "formation_page.coalitionTalks")} noPadding>
            <div className="p-4 space-y-3">
              {partnerPool.map((partner) => {
                const active = partners.includes(partner.id);
                return (
                  <button key={partner.id} onClick={() => togglePartner(partner.id)} className="w-full border p-4 text-left transition hover:scale-[1.005]" style={{ borderColor: active ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.16)", background: active ? "rgb(var(--gold-rgb)/0.10)" : "rgba(3,8,15,0.72)" }}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[14px] font-black tracking-wider text-white">{t(lang, `formation_page.partner_${partnerScope}_${partner.id}_name`)}</div>
                        <div className="mt-1 text-[11px] leading-relaxed text-text-muted">{t(lang, `formation_page.partner_${partnerScope}_${partner.id}_demand`)}</div>
                        <div className="mt-3 flex gap-3 text-[10px] font-bold tracking-wider"><span style={{ color: "var(--gold)" }}>+{partner.seats} {t(lang, "formation_page.seats2")}</span><span style={{ color: "var(--cyan)" }}>{t(lang, "formation_page.stability")} {partner.stability}</span></div>
                      </div>
                      <div className="text-[10px] font-black tracking-widest" style={{ color: active ? "var(--gold)" : "var(--text-muted)" }}>{active ? t(lang, "formation_page.agreed") : t(lang, "formation_page.negotiate")}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </TacticalPanel>

          <div className="space-y-4">
            <TacticalPanel title={t(lang, "formation_page.confirmation", { termsAppointingAuthority: terms.appointingAuthority })}>
              <div className="text-[11px] font-bold tracking-[0.24em] text-text-muted">{t(lang, "formation_page.confidenceScore")}</div>
              <div className="mt-2 text-5xl font-black" style={{ color: confidenceScore >= 75 ? "var(--neon-green)" : confidenceScore >= 55 ? "var(--gold)" : "var(--warn-orange)" }}>{confidenceScore}</div>
              <div className="mt-4 text-[12px] leading-relaxed text-text-muted">
                {canForm
                  ? t(lang, "formation_page.ifContinuedAppointmentsWillDefineThe", { termsExecutiveBody: terms.executiveBody, termsGovernmentName: terms.governmentName })
                  : terms.isPrn
                    ? t(lang, "formation_page.ifNegotiationsFailTheStorylineSwitches")
                    : t(lang, "formation_page.ifNegotiationsFailStorylineSwitchesTo")}
              </div>
            </TacticalPanel>
            <TacticalPanel title={t(lang, "formation_page.keyDemands")}>
              <div className="space-y-2 text-[11px] leading-relaxed text-text-muted">
                {selectedPartners.length ? selectedPartners.map((partner) => <div key={partner.id}>• {t(lang, `formation_page.partner_${partnerScope}_${partner.id}_demand`)}</div>) : <div>{t(lang, "formation_page.noCoalitionPartnerSelected")}</div>}
              </div>
            </TacticalPanel>
          </div>
        </div>
      </main>
      <StatusBar leftText={`${t(lang, "formation_page.powerNegotiation")} · ${terms.scopeLabel} · ${coalitionSeats}/${majorityTarget}`} rightText={`${leader.partyAbbr} · Confidence ${confidenceScore}`} />
    </div>
  );
}
