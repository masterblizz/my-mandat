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

const FEDERAL_STRATEGIES = [
  { id: "shadow", momentum: 8 },
  { id: "parliament", momentum: 6 },
  { id: "prk", momentum: 9 },
];

const STATE_STRATEGIES = [
  { id: "shadow", momentum: 8 },
  { id: "parliament", momentum: 6 },
  { id: "prk", momentum: 9 },
];

export default function OppositionPage() {
  const router = useRouter();
  const { isPending, navigate } = usePendingNav();
  const lang = useLang();
  const { states, leader, settings } = useGameStore();
  const outcome = computeElectionOutcome(states, { electionScope: settings.electionScope, prnStateId: settings.prnStateId });
  const terms = getGovernmentTerms(lang, settings.electionScope, outcome.contestedStates[0]);
  const strategies = terms.isPrn ? STATE_STRATEGIES : FEDERAL_STRATEGIES;
  const strategyScope = terms.isPrn ? "state" : "federal";
  const [active, setActive] = useState(["shadow"]);
  const comeback = Math.min(100, 35 + Math.round(outcome.seatsWon / 3) + active.length * 8);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {t(lang, "opposition_page.failedToFormOppositionMode", { termsGovernmentName: terms.governmentName })}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{t(lang, "opposition_page.buildComeback")}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>{terms.scopeLabel} · {leader.partyAbbr} · {outcome.seatsWon}/{outcome.totalSeats} {t(lang, "opposition_page.seats", { termsSeatLabel: terms.seatLabel })}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/mandate")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {t(lang, "opposition_page.mandate")}</button>
            <button onClick={() => navigate("/career")} disabled={isPending} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-60 disabled:cursor-wait" style={{ border: "1px solid rgb(var(--gold-rgb)/0.42)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.08)" }}>{isPending ? t(lang, "opposition_page.loading") : t(lang, "opposition_page.manageOppositionTerm")}</button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <TacticalPanel title={t(lang, "opposition_page.oppositionStatus")}>
            <div className="text-6xl font-black" style={{ color: comeback >= 70 ? "var(--neon-green)" : "var(--gold)" }}>{comeback}</div>
            <div className="mt-2 text-[12px] text-text-muted tracking-wider">{terms.isPrn ? t(lang, "opposition_page.comebackIndexTowardTheNextState") : t(lang, "opposition_page.comebackIndexTowardTheNextGe")}</div>
            <div className="mt-5 text-[13px] leading-relaxed text-text-muted">
              {terms.isPrn
                ? t(lang, "opposition_page.theGameDoesNotEndYou", { termsStateName: terms.stateName })
                : t(lang, "opposition_page.theGameDoesNotEndYou2")}
            </div>
          </TacticalPanel>

          <TacticalPanel title={t(lang, "opposition_page.oppositionStrategy")} noPadding>
            <div className="p-4 grid gap-3 md:grid-cols-3">
              {strategies.map((strategy) => {
                const selected = active.includes(strategy.id);
                return (
                  <button key={strategy.id} onClick={() => setActive((items) => items.includes(strategy.id) ? items.filter((item) => item !== strategy.id) : [...items, strategy.id])} className="border p-4 text-left" style={{ borderColor: selected ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.16)", background: selected ? "rgb(var(--gold-rgb)/0.10)" : "rgba(3,8,15,0.72)" }}>
                    <div className="text-[14px] font-black tracking-wider text-white">{t(lang, `opposition_page.strategy_${strategyScope}_${strategy.id}_title`)}</div>
                    <div className="mt-2 text-[11px] leading-relaxed text-text-muted">{t(lang, `opposition_page.strategy_${strategyScope}_${strategy.id}_detail`)}</div>
                    <div className="mt-3 text-[10px] font-bold" style={{ color: "var(--gold)" }}>Momentum +{strategy.momentum}</div>
                  </button>
                );
              })}
            </div>
          </TacticalPanel>
        </div>
      </main>
      <StatusBar leftText={t(lang, "opposition_page.oppositionMode")} rightText={`${leader.partyAbbr} · Comeback ${comeback}`} />
    </div>
  );
}
