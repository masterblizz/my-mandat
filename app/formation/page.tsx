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
import { getPrnCandidate } from "../data/prnCandidates";
import { HudButton, InfoFold, PageHead, StatChip } from "../components/formation/Hud";

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
  const prnCandidate = terms.isPrn ? getPrnCandidate(game.journey.prnCandidateId) : undefined;
  const [partners, setPartners] = useState<string[]>(game.journey.partners);
  const [dealTerms, setDealTerms] = useState<Record<string, CoalitionDeal>>(game.journey.coalitionTerms);
  const selectedPartners = partnerPool.filter((partner) => partners.includes(partner.id));
  const dealFor = (id: string) => dealTerms[id] ?? "development";
  const coalitionSeats = outcome.seatsWon + selectedPartners.reduce((sum, partner) => sum + coalitionDealEffect(partner, dealFor(partner.id)).seats, 0);
  const agreementStability = selectedPartners.reduce((sum, partner) => sum + partner.stability + coalitionDealEffect(partner, dealFor(partner.id)).stability, 0) / Math.max(1, selectedPartners.length);
  const confidenceScore = Math.min(100, Math.round((coalitionSeats / majorityTarget) * 74 + leader.negotiation / 4 + agreementStability / 6 + (prnCandidate?.formationBonus ?? 0)));
  const canForm = coalitionSeats >= majorityTarget;
  function togglePartner(id: string) {
    setPartners((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setDealTerms(current => ({ ...current, [id]: current[id] ?? "development" }));
  }

  const formOrOpposition = () => { game.finishElection(); if (canForm) { game.confirmCoalition(partners, dealTerms); navigate("/cabinet"); } else { game.enterTerm("opposition"); navigate("/opposition"); } };
  const confidenceColor = confidenceScore >= 75 ? "var(--neon-green)" : confidenceScore >= 55 ? "var(--gold)" : "var(--warn-orange)";
  const dealLabel = (deal: CoalitionDeal) => deal === "development" ? t(lang, "💰 Dana", "💰 Funds") : deal === "portfolio" ? t(lang, "💼 Portfolio", "💼 Portfolio") : t(lang, "🤝 Sokongan", "🤝 Support");

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="w-full px-3 pb-[58px] pt-[56px] sm:px-6">
        <PageHead
          title={t(lang, "formation_page.negotiatePower")}
          chips={<>
            <StatChip icon="🗳️">{terms.scopeLabel}</StatChip>
            <StatChip icon="🪑" color="var(--cyan)">{leader.partyAbbr} {outcome.seatsWon}/{outcome.totalSeats} {terms.seatLabel}</StatChip>
          </>}
          actions={<>
            <HudButton onClick={() => router.push("/mandate")}>← {t(lang, "formation_page.mandate")}</HudButton>
            <HudButton tone={canForm ? "gold" : "orange"} onClick={formOrOpposition} disabled={isPending}>{isPending ? t(lang, "formation_page.loading") : canForm ? `✓ ${t(lang, "formation_page.form", { termsExecutiveBody: terms.executiveBody })}` : t(lang, "formation_page.enterOpposition")}</HudButton>
          </>}
        />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)] min-[1280px]:grid-cols-[360px_minmax(0,1fr)_360px]">
          <TacticalPanel title={`🎯 ${t(lang, "MAJORITI", "MAJORITY")}`}>
            <div className="flex items-end gap-2">
              <div className="text-5xl font-black leading-none" style={{ color: canForm ? "var(--neon-green)" : "var(--warn-orange)" }}>{coalitionSeats}</div>
              <div className="pb-1 text-lg font-black text-text-muted">/ {majorityTarget}</div>
            </div>
            <div className="mt-3 h-3 overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}><div className="h-full" style={{ width: `${Math.min(100, coalitionSeats / majorityTarget * 100)}%`, background: canForm ? "var(--neon-green)" : "var(--warn-orange)" }} /></div>
            <div className="mt-2 text-[12px] font-bold" style={{ color: canForm ? "var(--neon-green)" : "var(--warn-orange)" }}>{canForm ? t(lang, "✅ Majoriti cukup", "✅ Majority secured") : t(lang, `⚠️ Kurang ${majorityTarget - coalitionSeats} kerusi`, `⚠️ ${majorityTarget - coalitionSeats} seats short`)}</div>
            {prnCandidate && <div className="mt-3 flex items-center justify-between gap-2 border p-2.5" style={{ borderColor: `${prnCandidate.color}66`, background: `${prnCandidate.color}0c` }}>
              <div className="min-w-0"><div className="text-[9px] font-black tracking-[0.2em] text-text-muted">👤 {terms.headAbbr}</div><div className="truncate font-black" style={{ color: prnCandidate.color }}>{prnCandidate.name}</div></div>
              <StatChip icon="⭐" color="var(--neon-green)" title={t(lang, "keyakinan pelantikan", "appointment confidence")}>+{prnCandidate.formationBonus}</StatChip>
            </div>}
          </TacticalPanel>

          <TacticalPanel title={`🤝 ${t(lang, "formation_page.coalitionTalks")}`} noPadding>
            <div className="space-y-2 p-3">
              {partnerPool.length === 0 && <div className="py-3 text-center text-[12px] text-text-muted">{t(lang, "Tiada rakan bebas untuk dirunding", "No free partners to negotiate")}</div>}
              {partnerPool.map((partner) => {
                const active = partners.includes(partner.id);
                return (
                  <div key={partner.id} className="w-full border p-3 text-left" style={{ borderColor: active ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.16)", background: active ? "rgb(var(--gold-rgb)/0.10)" : "rgb(var(--bg-rgb) / 0.72)" }}>
                    <button type="button" onClick={() => togglePartner(partner.id)} aria-pressed={active} className="flex min-h-[40px] w-full items-center justify-between gap-3 text-left">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-black tracking-wider text-white">{t(lang, partner.ms, partner.en)}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5"><StatChip icon="🪑">+{active ? coalitionDealEffect(partner, dealFor(partner.id)).seats : partner.seats}</StatChip><StatChip icon="⚖️" color="var(--cyan)">{partner.stability}</StatChip></div>
                      </div>
                      <span className="shrink-0 text-[10px] font-black tracking-widest" style={{ color: active ? "var(--gold)" : "var(--text-muted)" }}>{active ? `✓ ${t(lang, "formation_page.agreed")}` : t(lang, "formation_page.negotiate")}</span>
                    </button>
                    {active && <div className="mt-2 grid grid-cols-3 gap-1.5">{(["development", "portfolio", "confidence"] as CoalitionDeal[]).map(deal => {
                      const effect = coalitionDealEffect(partner, deal), chosen = dealFor(partner.id) === deal;
                      const detail = deal === "development" ? [`RM${effect.cost.toLocaleString()}`, "⚖️ +4"] : deal === "portfolio" ? [`RM${effect.cost.toLocaleString()}`, "🏛️ −5"] : [`🪑 ${effect.seats}`, "⚖️ −10"];
                      return <button type="button" key={deal} onClick={() => setDealTerms(current => ({ ...current, [partner.id]: deal }))} aria-pressed={chosen} className="min-h-[44px] min-w-0 border p-1.5 text-left text-[10px]" style={{ borderColor: chosen ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.18)", color: chosen ? "var(--gold)" : "var(--text-muted)" }}><strong className="block break-words text-[11px] leading-tight">{dealLabel(deal)}</strong><span className="mt-0.5 block whitespace-nowrap">{detail[0]}</span><span className="block whitespace-nowrap">{detail[1]}</span></button>;
                    })}</div>}
                  </div>
                );
              })}
            </div>
          </TacticalPanel>

          <TacticalPanel title={`⭐ ${t(lang, "KEYAKINAN", "CONFIDENCE")}`}>
            <div className="text-5xl font-black leading-none" style={{ color: confidenceColor }}>{confidenceScore}</div>
            <div className="mt-2 text-[12px] font-bold text-text-muted">➡️ {canForm ? t(lang, `Seterusnya: lantik ${terms.executiveBody}`, `Next: appoint ${terms.executiveBody}`) : t(lang, "Gagal: jadi pembangkang", "If it fails: opposition")}</div>
            <div className="mt-3 border-t pt-2" style={{ borderColor: "rgb(var(--cyan-rgb)/0.14)" }}>
              <div className="mb-1 text-[10px] font-black tracking-[0.2em]" style={{ color: "var(--gold)" }}>📜 {t(lang, "formation_page.keyDemands")}</div>
              <div className="space-y-1 text-[11px] text-text-muted">
                {selectedPartners.length ? selectedPartners.map((partner) => { const deal = dealFor(partner.id), effect = coalitionDealEffect(partner, deal); return <div key={partner.id} className="flex justify-between gap-2"><span className="truncate">{t(lang, partner.ms, partner.en)}</span><span className="shrink-0 font-bold text-white">{deal === "development" ? `💰 RM${effect.cost.toLocaleString()}` : deal === "portfolio" ? `💼 🏛️−${effect.cabinetPenalty}` : `🤝 🪑${effect.seats}`}</span></div>; }) : <div>—</div>}
              </div>
            </div>
            <InfoFold label={terms.appointingAuthority}>
              {canForm
                ? t(lang, "formation_page.ifContinuedAppointmentsWillDefineThe", { termsExecutiveBody: terms.executiveBody, termsGovernmentName: terms.governmentName })
                : terms.isPrn
                  ? t(lang, "formation_page.ifNegotiationsFailTheStorylineSwitches")
                  : t(lang, "formation_page.ifNegotiationsFailStorylineSwitchesTo")}
            </InfoFold>
          </TacticalPanel>
        </div>
      </main>
      <StatusBar leftText={`${t(lang, "formation_page.powerNegotiation")} · ${terms.scopeLabel} · ${coalitionSeats}/${majorityTarget}`} rightText={`${leader.partyAbbr} · ${t(lang, "Keyakinan", "Confidence")} ${confidenceScore}`} />
    </div>
  );
}
