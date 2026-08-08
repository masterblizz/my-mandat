"use client";

import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t, type Lang } from "../i18n/useLang";
import { usePendingNav } from "../hooks/usePendingNav";
import { computeElectionOutcome, type MandateStatus } from "../utils/electionOutcome";
import { getGovernmentTerms, type GovernmentTerms } from "../utils/governmentTerms";

type StatusCopy = { color: string; text: string; action: string; route: string };

function getStatusCopy(lang: Lang, terms: GovernmentTerms): Record<MandateStatus, StatusCopy> {
  const prn = terms.isPrn;
  return {
    majority: {
      color: "var(--neon-green)",
      text: prn
        ? t(lang, "mandate_page.stateVotersHaveGivenYourParty", { termsAppointingAuthority: terms.appointingAuthority, termsHeadTitle: terms.headTitle })
        : t(lang, "mandate_page.votersHaveGivenYourPartyA"),
      action: prn ? t(lang, "mandate_page.confirmStateMandate") : t(lang, "mandate_page.confirmMandateAtPalace"),
      route: "/formation",
    },
    hung: {
      color: "var(--gold)",
      text: prn
        ? t(lang, "mandate_page.noBlocReachedADunMajority")
        : t(lang, "mandate_page.noBlocReachedMajorityYourParty"),
      action: t(lang, "mandate_page.negotiateCoalition"),
      route: "/formation",
    },
    opposition: {
      color: "var(--warn-orange)",
      text: prn
        ? t(lang, "mandate_page.youFailedToFormTheState")
        : t(lang, "mandate_page.youFailedToFormFederalGovernment"),
      action: prn ? t(lang, "mandate_page.formShadowExco") : t(lang, "mandate_page.formShadowCabinet"),
      route: "/opposition",
    },
    collapse: {
      color: "var(--neon-red)",
      text: t(lang, "mandate_page.theResultRejectsThePartyMandate"),
      action: t(lang, "mandate_page.partyPostMortem"),
      route: "/postmortem",
    },
  };
}

export default function MandatePage() {
  const router = useRouter();
  const { isPending, navigate } = usePendingNav();
  const lang = useLang();
  const { states, leader, settings } = useGameStore();
  const outcome = computeElectionOutcome(states, { electionScope: settings.electionScope, prnStateId: settings.prnStateId });
  const isPrn = settings.electionScope === "prn";
  const terms = getGovernmentTerms(lang, settings.electionScope, outcome.contestedStates[0]);
  const copy = getStatusCopy(lang, terms)[outcome.status];
  const scopeName = terms.scopeLabel;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {t(lang, "mandate_page.postResultMandateStatus")}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{t(lang, "mandate_page.confirmMandate")}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>{scopeName} · {leader.partyAbbr} · {outcome.seatsWon}/{outcome.totalSeats} {t(lang, "mandate_page.seats")}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/results")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {t(lang, "mandate_page.results")}</button>
            <button onClick={() => navigate(copy.route)} disabled={isPending} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-60 disabled:cursor-wait" style={{ border: `1px solid ${copy.color}88`, color: copy.color, background: `${copy.color}14` }}>{isPending ? t(lang, "mandate_page.loading") : copy.action}</button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <TacticalPanel title={t(lang, "mandate_page.mandateVerdict")}>
            <div className="text-[11px] font-bold tracking-[0.24em] text-text-muted">{t(lang, "mandate_page.officialStatus")}</div>
            <div className="mt-2 text-3xl font-black leading-tight" style={{ color: copy.color }}>{t(lang, outcome.statusLabelKey)}</div>
            <div className="mt-2 text-[11px] tracking-wider" style={{ color: "var(--gold)" }}>{terms.governmentName} · {terms.assemblyName}</div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="border p-3" style={{ borderColor: `${leader.partyColor}66` }}><div className="text-[10px] text-text-muted">{leader.partyAbbr}</div><div className="text-4xl font-black" style={{ color: leader.partyColor }}>{outcome.seatsWon}</div></div>
              <div className="border p-3" style={{ borderColor: "rgb(var(--gold-rgb)/0.36)" }}><div className="text-[10px] text-text-muted">{t(lang, "mandate_page.majority")}</div><div className="text-4xl font-black text-white">{outcome.majorityTarget}</div></div>
              <div className="border p-3" style={{ borderColor: "rgb(255 176 0 / 0.28)" }}><div className="text-[10px] text-text-muted">LAWAN</div><div className="text-2xl font-black" style={{ color: "var(--warn-orange)" }}>{outcome.lawanSeats}</div></div>
              <div className="border p-3" style={{ borderColor: "rgba(255,255,255,0.14)" }}><div className="text-[10px] text-text-muted">{t(lang, "mandate_page.others")}</div><div className="text-2xl font-black text-text-muted">{outcome.othersSeats}</div></div>
            </div>
          </TacticalPanel>

          <TacticalPanel title={t(lang, "mandate_page.storylineDirection")}>
            <div className="text-[15px] leading-relaxed text-text-muted">{copy.text}</div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="border p-4" style={{ borderColor: "rgb(var(--cyan-rgb)/0.22)" }}><div className="text-[10px] text-text-muted tracking-widest">{isPrn ? t(lang, "mandate_page.stateSupport") : t(lang, "mandate_page.nationalSupport")}</div><div className="mt-2 text-3xl font-black" style={{ color: "var(--cyan)" }}>{outcome.nationalSupport}</div></div>
              <div className="border p-4" style={{ borderColor: "rgb(var(--gold-rgb)/0.22)" }}><div className="text-[10px] text-text-muted tracking-widest">{isPrn ? t(lang, "mandate_page.stateStatus") : t(lang, "mandate_page.statesWon")}</div><div className="mt-2 text-3xl font-black" style={{ color: "var(--gold)" }}>{outcome.statesWon}</div></div>
              <div className="border p-4" style={{ borderColor: "rgb(255 68 68 / 0.22)" }}><div className="text-[10px] text-text-muted tracking-widest">{isPrn ? t(lang, "mandate_page.stateLost") : t(lang, "mandate_page.statesLost")}</div><div className="mt-2 text-3xl font-black" style={{ color: "var(--neon-red)" }}>{outcome.statesLost}</div></div>
            </div>
            <div className="mt-5 text-[12px] leading-relaxed text-text-muted">
              {t(lang, "mandate_page.warRoomRemainsAvailableOnlyFor")}
            </div>
          </TacticalPanel>
        </div>
      </main>
      <StatusBar leftText={`${t(lang, "mandate_page.mandateStatus")} · ${t(lang, outcome.statusLabelKey)}`} rightText={`${scopeName} · ${leader.partyAbbr} ${outcome.seatsWon}/${outcome.totalSeats}`} />
    </div>
  );
}
