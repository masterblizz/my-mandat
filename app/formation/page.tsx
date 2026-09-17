"use client";

import { coalitionDealEffect, coalitionPool, outcomeOf, type CoalitionDeal } from "../store/journey";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";
import { getGovernmentTerms } from "../utils/governmentTerms";
import { usePendingNav } from "../hooks/usePendingNav";

export default function FormationPage() {
  const router = useRouter();
  const { isPending, navigate } = usePendingNav();
  const lang = useLang();
  const game = useGameStore();
  const { leader, settings } = game;
  const outcome = outcomeOf(game);
  const terms = getGovernmentTerms(lang, settings.electionScope, outcome.contestedStates[0]);
  const partnerPool = coalitionPool(game);
  const majorityTarget = outcome.majorityTarget;
  const [partners, setPartners] = useState<string[]>(game.journey.partners);
  const [dealTerms, setDealTerms] = useState<Record<string, CoalitionDeal>>(game.journey.coalitionTerms);
  const selectedPartners = partnerPool.filter((partner) => partners.includes(partner.id));
  const dealFor = (id: string) => dealTerms[id] ?? "development";
  const coalitionSeats = outcome.seatsWon + selectedPartners.reduce((sum, partner) => sum + coalitionDealEffect(partner, dealFor(partner.id)).seats, 0);
  const agreementStability = selectedPartners.reduce((sum, partner) => sum + partner.stability + coalitionDealEffect(partner, dealFor(partner.id)).stability, 0) / Math.max(1, selectedPartners.length);
  const confidenceScore = Math.min(100, Math.round((coalitionSeats / majorityTarget) * 74 + leader.negotiation / 4 + agreementStability / 6));
  const canForm = coalitionSeats >= majorityTarget;
  const istanaText = canForm
    ? t(lang, "formation_page.majorityCanBeProvenIsReady", { termsAppointingAuthority: terms.appointingAuthority, termsHeadTitle: terms.headTitle, termsExecutiveBody: terms.executiveBody })
    : t(lang, "formation_page.supportIsInsufficientNegotiatePartnersOr");

  function togglePartner(id: string) {
    setPartners((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setDealTerms(current => ({ ...current, [id]: current[id] ?? "development" }));
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="w-full px-3 pb-[58px] pt-[56px] sm:px-6">
        <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {terms.appointingAuthority} · {t(lang, "formation_page.formation", { termsGovernmentName: terms.governmentName })}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{t(lang, "formation_page.negotiatePower")}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>{terms.scopeLabel} · {leader.partyAbbr} · {outcome.seatsWon}/{outcome.totalSeats} {t(lang, "formation_page.seats", { termsSeatLabel: terms.seatLabel })}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => router.push("/mandate")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {t(lang, "formation_page.mandate")}</button>
            <button onClick={() => { game.finishElection(); if (canForm) { game.confirmCoalition(partners, dealTerms); navigate("/cabinet"); } else { game.enterTerm("opposition"); navigate("/opposition"); } }} disabled={isPending} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-60 disabled:cursor-wait" style={{ border: `1px solid ${canForm ? "rgb(var(--gold-rgb)/0.5)" : "rgb(255 176 0 / 0.38)"}`, color: canForm ? "var(--gold)" : "var(--warn-orange)", background: canForm ? "rgb(var(--gold-rgb)/0.08)" : "rgb(255 176 0 / 0.06)" }}>{isPending ? t(lang, "formation_page.loading") : canForm ? t(lang, "formation_page.form", { termsExecutiveBody: terms.executiveBody }) : t(lang, "formation_page.enterOpposition")}</button>
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
              {partnerPool.length === 0 && <p className="text-sm text-text-muted">{t(lang, "Tiada kerusi blok bebas untuk rundingan. Bentuk kerajaan jika anda mempunyai majoriti; jika tidak, bina pembangkang.", "No independent bloc seats are available for negotiation. Form government if you hold a majority; otherwise build an opposition.")}</p>}
              {partnerPool.map((partner) => {
                const active = partners.includes(partner.id);
                return (
                  <div key={partner.id} className="w-full border p-4 text-left" style={{ borderColor: active ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.16)", background: active ? "rgb(var(--gold-rgb)/0.10)" : "rgb(var(--bg-rgb) / 0.72)" }}>
                    <button onClick={() => togglePartner(partner.id)} className="flex w-full items-start justify-between gap-4 text-left">
                      <div>
                        <div className="text-[14px] font-black tracking-wider text-white">{t(lang, partner.ms, partner.en)}</div>
                        <div className="mt-1 text-[11px] leading-relaxed text-text-muted">{t(lang, "Pilih struktur perjanjian selepas membuka rundingan.", "Select a deal structure after opening talks.")}</div>
                        <div className="mt-3 flex gap-3 text-[10px] font-bold tracking-wider"><span style={{ color: "var(--gold)" }}>+{active ? coalitionDealEffect(partner, dealFor(partner.id)).seats : partner.seats} {t(lang, "formation_page.seats2")}</span><span style={{ color: "var(--cyan)" }}>{t(lang, "formation_page.stability")} {partner.stability}</span></div>
                      </div>
                      <div className="text-[10px] font-black tracking-widest" style={{ color: active ? "var(--gold)" : "var(--text-muted)" }}>{active ? t(lang, "formation_page.agreed") : t(lang, "formation_page.negotiate")}</div>
                    </button>
                    {active && <div className="mt-4 grid gap-2 sm:grid-cols-3">{(["development", "portfolio", "confidence"] as CoalitionDeal[]).map(deal => {
                      const effect = coalitionDealEffect(partner, deal), chosen = dealFor(partner.id) === deal;
                      const label = deal === "development" ? t(lang, "Peruntukan", "Development") : deal === "portfolio" ? t(lang, "Portfolio", "Portfolio") : t(lang, "Keyakinan & bekalan", "Confidence & supply");
                      const detail = deal === "development" ? t(lang, `RM${effect.cost.toLocaleString()} · stabil +4`, `RM${effect.cost.toLocaleString()} · stability +4`) : deal === "portfolio" ? t(lang, `RM${effect.cost.toLocaleString()} · kabinet −5`, `RM${effect.cost.toLocaleString()} · cabinet −5`) : t(lang, `${effect.seats} sokongan · stabil −10`, `${effect.seats} support · stability −10`);
                      return <button key={deal} onClick={() => setDealTerms(current => ({ ...current, [partner.id]: deal }))} className="border p-2 text-left text-[10px]" style={{ borderColor: chosen ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.18)", color: chosen ? "var(--gold)" : "var(--text-muted)" }}><strong className="block text-[11px]">{label}</strong>{detail}</button>;
                    })}</div>}
                  </div>
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
                {selectedPartners.length ? selectedPartners.map((partner) => { const deal = dealFor(partner.id), effect = coalitionDealEffect(partner, deal); return <div key={partner.id}>• {t(lang, partner.ms, partner.en)}: {deal === "development" ? t(lang, `peruntukan RM${effect.cost.toLocaleString()}`, `RM${effect.cost.toLocaleString()} allocation`) : deal === "portfolio" ? t(lang, `portfolio · penalti kabinet ${effect.cabinetPenalty}`, `portfolio · cabinet penalty ${effect.cabinetPenalty}`) : t(lang, `keyakinan & bekalan · ${effect.seats} sokongan`, `confidence & supply · ${effect.seats} support`)}</div>; }) : <div>{t(lang, "formation_page.noCoalitionPartnerSelected")}</div>}
              </div>
            </TacticalPanel>
          </div>
        </div>
      </main>
      <StatusBar leftText={`${t(lang, "formation_page.powerNegotiation")} · ${terms.scopeLabel} · ${coalitionSeats}/${majorityTarget}`} rightText={`${leader.partyAbbr} · Confidence ${confidenceScore}`} />
    </div>
  );
}
