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
import { getPrnCandidate } from "../data/prnCandidates";
import { HudButton, InfoFold, NumTile, PageHead, StatChip } from "../components/formation/Hud";

type StatusCopy = { color: string; icon: string; short: string; text: string; action: string; route: string };

function getStatusCopy(lang: Lang, terms: GovernmentTerms): Record<MandateStatus, StatusCopy> {
  const prn = terms.isPrn;
  return {
    majority: {
      color: "var(--neon-green)",
      icon: "🏆",
      short: t(lang, `Sahkan sokongan di ${terms.appointingAuthority}`, `Confirm support at ${terms.appointingAuthority}`),
      text: prn
        ? t(lang, "mandate_page.stateVotersHaveGivenYourParty", { termsAppointingAuthority: terms.appointingAuthority, termsHeadTitle: terms.headTitle })
        : t(lang, "mandate_page.votersHaveGivenYourPartyA"),
      action: prn ? t(lang, "mandate_page.confirmStateMandate") : t(lang, "mandate_page.confirmMandateAtPalace"),
      route: "/formation",
    },
    hung: {
      color: "var(--gold)",
      icon: "🤝",
      short: t(lang, "Runding rakan untuk capai majoriti", "Negotiate partners to reach majority"),
      text: prn
        ? t(lang, "mandate_page.noBlocReachedADunMajority")
        : t(lang, "mandate_page.noBlocReachedMajorityYourParty"),
      action: t(lang, "mandate_page.negotiateCoalition"),
      route: "/formation",
    },
    opposition: {
      color: "var(--warn-orange)",
      icon: "⚖️",
      short: prn ? t(lang, "Pimpin pembangkang DUN", "Lead the DUN opposition") : t(lang, "Pimpin pembangkang", "Lead the opposition"),
      text: prn
        ? t(lang, "mandate_page.youFailedToFormTheState")
        : t(lang, "mandate_page.youFailedToFormFederalGovernment"),
      action: prn ? t(lang, "mandate_page.formShadowExco") : t(lang, "mandate_page.formShadowCabinet"),
      route: "/opposition",
    },
    collapse: {
      color: "var(--neon-red)",
      icon: "🩹",
      short: t(lang, "Bina semula parti", "Rebuild the party"),
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
  const { states, leader, settings, enterTerm, finishElection, journey } = useGameStore();
  const outcome = computeElectionOutcome(states, { electionScope: settings.electionScope, prnStateId: settings.prnStateId });
  const isPrn = settings.electionScope === "prn";
  const terms = getGovernmentTerms(lang, settings.electionScope, outcome.contestedStates[0]);
  const copy = getStatusCopy(lang, terms)[outcome.status];
  const scopeName = terms.scopeLabel;
  const prnCandidate = isPrn ? getPrnCandidate(journey.prnCandidateId) : undefined;

  const confirm = () => { finishElection(); const repRoute = useGameStore.getState().continueRepresentativeCareer(); if (repRoute) { navigate(repRoute); return; } if (outcome.status === "opposition" || outcome.status === "collapse") enterTerm(outcome.status === "collapse" ? "rebuilding" : "opposition"); navigate(copy.route); };
  const leadsGovernment = outcome.status === "majority" || outcome.status === "hung";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="w-full px-3 pb-[58px] pt-[56px] sm:px-6">
        <PageHead
          title={t(lang, "mandate_page.confirmMandate")}
          chips={<>
            <StatChip icon="🗳️">{scopeName}</StatChip>
            <StatChip icon="🪑" color="var(--cyan)">{leader.partyAbbr} {outcome.seatsWon}/{outcome.totalSeats}</StatChip>
          </>}
          actions={<>
            <HudButton onClick={() => router.push("/results")}>← {t(lang, "mandate_page.results")}</HudButton>
            <HudButton color={copy.color} onClick={confirm} disabled={isPending}>{isPending ? t(lang, "mandate_page.loading") : `${copy.action} →`}</HudButton>
          </>}
        />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] min-[1280px]:grid-cols-[380px_minmax(0,1fr)]">
          <TacticalPanel title={`${copy.icon} ${t(lang, "mandate_page.mandateVerdict")}`}>
            <div className="text-2xl font-black leading-tight sm:text-3xl" style={{ color: copy.color }}>{t(lang, outcome.statusLabelKey)}</div>
            <div className="mt-1 text-[12px] font-bold text-text-muted">➡️ {copy.short}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <NumTile icon="🪑" label={leader.partyAbbr} value={outcome.seatsWon} color={leader.partyColor} />
              <NumTile icon="🎯" label={t(lang, "mandate_page.majority")} value={outcome.majorityTarget} color="#fff" border="rgb(var(--gold-rgb)/0.36)" />
              <NumTile icon="⚔️" label="LAWAN" value={outcome.lawanSeats} color="var(--warn-orange)" />
              <NumTile icon="◽" label={t(lang, "mandate_page.others")} value={outcome.othersSeats} color="var(--text-muted)" border="rgba(255,255,255,0.14)" />
            </div>
          </TacticalPanel>

          <TacticalPanel title={`🧭 ${terms.governmentName}`}>
            {prnCandidate && <div className="mb-3 flex items-center justify-between gap-3 border p-2.5" style={{ borderColor: `${prnCandidate.color}66`, background: `${prnCandidate.color}0c` }}>
              <div className="min-w-0"><div className="text-[9px] font-black tracking-[0.22em] text-text-muted">👤 {leadsGovernment ? terms.headAbbr : t(lang, "KETUA PEMBANGKANG", "OPPOSITION LEAD")}</div><div className="truncate text-lg font-black" style={{ color: prnCandidate.color }}>{prnCandidate.name}</div></div>
              <span className="shrink-0 text-[10px] font-bold text-text-muted">{prnCandidate.archetype[lang]}</span>
            </div>}
            <div className="grid grid-cols-3 gap-2">
              <NumTile icon="📣" label={isPrn ? t(lang, "mandate_page.stateSupport") : t(lang, "mandate_page.nationalSupport")} value={outcome.nationalSupport} color="var(--cyan)" />
              <NumTile icon="🏳️" label={isPrn ? t(lang, "mandate_page.stateStatus") : t(lang, "mandate_page.statesWon")} value={outcome.statesWon} color="var(--gold)" />
              <NumTile icon="📉" label={isPrn ? t(lang, "mandate_page.stateLost") : t(lang, "mandate_page.statesLost")} value={outcome.statesLost} color="var(--neon-red)" />
            </div>
            <InfoFold label={t(lang, "Butiran", "Details")}>
              <p>{copy.text}</p>
              {prnCandidate && <p className="mt-2">{prnCandidate.pitch[lang]}</p>}
              <p className="mt-2">{t(lang, "mandate_page.warRoomRemainsAvailableOnlyFor")}</p>
            </InfoFold>
          </TacticalPanel>
        </div>
      </main>
      <StatusBar leftText={`${t(lang, "mandate_page.mandateStatus")} · ${t(lang, outcome.statusLabelKey)}`} rightText={`${scopeName} · ${leader.partyAbbr} ${outcome.seatsWon}/${outcome.totalSeats}`} />
    </div>
  );
}
