"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { GodotWorldState } from "../components/world/GodotWorld";
import { governingSeats } from "../store/journey";
import { assistantGender } from "../lib/assistantAvatar";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { coalitionCabinetPenalty } from "../store/journey";
import { useLang, t } from "../i18n/useLang";
import { DPM_POSTS, EXCO_POSTS, MINISTER_POSTS, PM_POST, SPECIALTY_LABEL } from "../data/cabinet";
import { PARTY_MEMBERS } from "../data/members";
import { computeElectionOutcome } from "../utils/electionOutcome";
import { getGovernmentTerms } from "../utils/governmentTerms";
import { usePendingNav } from "../hooks/usePendingNav";
import { getPrnCandidate } from "../data/prnCandidates";
import { HudButton, InfoFold, NumTile, PageHead, StatChip } from "../components/formation/Hud";
import { playerModel } from "../lib/playerAvatar";

// The ceremony takes place in the 3D chamber (Godot); the panels below stay.
const GodotWorld = dynamic(() => import("../components/world/GodotWorld"), { ssr: false });
const CHAMBER_ENGINE_KEY = "chamber-engine";

const KEY_FEDERAL_POST_IDS = ["pm", "dpm1", "min-fin", "min-home", "min-edu", "min-health"];
const KEY_STATE_POST_IDS = ["exco-fin", "exco-local", "exco-rural", "exco-edu", "exco-health"];

export default function SwearingInPage() {
  const router = useRouter();
  const { isPending, navigate } = usePendingNav();
  const lang = useLang();
  const { states, leader, settings, journey, enterTerm } = useGameStore();
  const outcome = computeElectionOutcome(states, { electionScope: settings.electionScope, prnStateId: settings.prnStateId });
  const terms = getGovernmentTerms(lang, settings.electionScope, outcome.contestedStates[0]);
  const allPosts = terms.isPrn ? EXCO_POSTS : [PM_POST, ...DPM_POSTS, ...MINISTER_POSTS];
  const keyPostIds = terms.isPrn ? KEY_STATE_POST_IDS : KEY_FEDERAL_POST_IDS;
  const keyMinisters = keyPostIds.map((postId) => ({ post: allPosts.find((post) => post.id === postId), member: PARTY_MEMBERS.find(member => member.id === journey.appointments[postId]) })).filter((item) => item.post && item.member);
  const cabinetScore = Math.max(0, journey.cabinetQuality - coalitionCabinetPenalty(useGameStore.getState()));
  const prnCandidate = terms.isPrn ? getPrnCandidate(journey.prnCandidateId) : undefined;
  const headName = prnCandidate?.name ?? leader.name;
  const assistantAvatar = useGameStore((state) => state.assistantAvatar);
  const govSeats = governingSeats(useGameStore.getState());
  const [chamber3d, setChamber3d] = useState(true);
  const [sworn, setSworn] = useState(false);
  useEffect(() => {
    try { if (window.localStorage.getItem(CHAMBER_ENGINE_KEY) === "off") setChamber3d(false); } catch { /* default on */ }
  }, []);
  const switchChamber = (on: boolean) => {
    setChamber3d(on);
    try { window.localStorage.setItem(CHAMBER_ENGINE_KEY, on ? "on" : "off"); } catch { /* not persisted */ }
  };
  const chamberState = useMemo<GodotWorldState>(() => ({
    lang,
    player: playerModel(leader.avatarIndex),
    playerName: headName,
    playerColor: leader.partyColor,
    pa: assistantGender(assistantAvatar) === "female" ? "pa_female" : "pa_male",
    night: false,
    badges: {},
    intro: true,
    chamberName: terms.isPrn ? t(lang, "Dewan Undangan Negeri", "State Legislative Assembly") : t(lang, "Dewan Rakyat", "Dewan Rakyat"),
    totalSeats: outcome.totalSeats,
    ownSeats: outcome.seatsWon,
    governmentSeats: govSeats,
    ministers: keyMinisters.filter(({ post }) => post!.id !== "pm").slice(0, 5).map(({ post, member }) => ({ name: member!.name, post: t(lang, post!.titleMS, post!.titleEN) })),
  }), [lang, leader.avatarIndex, headName, leader.partyColor, assistantAvatar, terms.isPrn, outcome.totalSeats, outcome.seatsWon, govSeats, keyMinisters.map(({ member }) => member!.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const openChamber = (id: string) => {
    if (id === "oath") setSworn(true);
    else if (id === "cabinet") router.push("/cabinet");
    else if (id === "exit") router.push("/kawasan");
  };

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(circle at 50% 0%, rgb(var(--gold-rgb)/0.10), transparent 35%), var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <PageHead
          title={t(lang, "swearing_in_page.official", { termsExecutiveBody: terms.executiveBody })}
          chips={<>
            <StatChip icon="🗳️">{terms.scopeLabel}</StatChip>
            <StatChip icon="🪑" color="var(--cyan)">{leader.partyAbbr} {outcome.seatsWon} {terms.seatLabel}</StatChip>
          </>}
          actions={<>
            <HudButton onClick={() => router.push("/cabinet")}>← {terms.executiveBody}</HudButton>
            <HudButton tone="gold" onClick={() => switchChamber(!chamber3d)}>🏛️ {chamber3d ? t(lang, "SEMBUNYI 3D", "HIDE 3D") : t(lang, "TUNJUK 3D", "SHOW 3D")}</HudButton>
            <HudButton tone="gold" onClick={() => { enterTerm("government"); navigate("/government"); }} disabled={isPending || !journey.coalitionConfirmed || !Object.values(journey.appointments).some(Boolean)}>{isPending ? t(lang, "swearing_in_page.loading") : `▶ ${t(lang, "MULA 100 HARI", "START 100 DAYS")}`}</HudButton>
          </>}
        />

        {chamber3d && (
          <div className="swearing-chamber relative mb-4 h-[min(58vh,560px)] min-h-[300px] overflow-hidden border" style={{ borderColor: "rgb(var(--gold-rgb)/0.35)" }}>
            <GodotWorld scene="dewan" state={chamberState} onOpen={openChamber} onError={() => switchChamber(false)} />
            {sworn && (
              <div role="status" className="pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 border-y-2 py-4 text-center" style={{ borderColor: "var(--gold)", background: "rgb(var(--bg-rgb) / .9)" }}>
                <div className="text-[10px] font-bold tracking-[0.35em] text-gold">{terms.appointingAuthority}</div>
                <div className="mt-2 px-4 text-xl font-black tracking-widest text-white sm:text-2xl">{headName} · {t(lang, "TELAH MENGANGKAT SUMPAH", "HAS TAKEN THE OATH")}</div>
                <div className="mt-1 text-[11px] text-text-muted">{terms.headTitle} · {terms.governmentName}</div>
              </div>
            )}
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] min-[1280px]:grid-cols-[420px_minmax(0,1fr)]">
          <TacticalPanel title={`📜 ${terms.appointingAuthority}`}>
            <div className="text-2xl font-black leading-tight" style={{ color: "var(--gold)" }}>✅ {t(lang, "swearing_in_page.approved", { termsGovernmentName: terms.governmentName })}</div>
            <div className="mt-2 flex items-center justify-between gap-2 border p-2.5" style={{ borderColor: `${prnCandidate?.color ?? leader.partyColor}66`, background: `${prnCandidate?.color ?? leader.partyColor}0c` }}>
              <div className="min-w-0"><div className="text-[9px] font-black tracking-[0.22em] text-text-muted">👤 {terms.headTitle.toUpperCase()}</div><div className="truncate text-lg font-black" style={{ color: prnCandidate?.color ?? "#fff" }}>{headName}</div></div>
              {prnCandidate && <span className="shrink-0 text-[10px] font-bold text-text-muted">{prnCandidate.archetype[lang]}</span>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <NumTile icon="📣" label={t(lang, "swearing_in_page.publicReaction")} value={t(lang, "swearing_in_page.positive")} color="var(--neon-green)" border="rgb(var(--gold-rgb)/0.32)" />
              <NumTile icon="⭐" label={t(lang, "swearing_in_page.score", { termsExecutiveBody: terms.executiveBody })} value={cabinetScore} color="var(--cyan)" />
            </div>
            <InfoFold label={t(lang, "Butiran", "Details")}>
              {t(lang, "swearing_in_page.andTheFirstLineUpHave", { termsHeadTitle: terms.headTitle, leaderName: headName, termsExecutiveBody: terms.executiveBody })}
            </InfoFold>
          </TacticalPanel>

          <TacticalPanel title={`🏛️ ${t(lang, "swearing_in_page.keyLineup")}`}>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {keyMinisters.map(({ post, member }) => (
                <div key={post!.id} className="min-w-0 border p-2.5" style={{ borderColor: "rgb(var(--cyan-rgb)/0.18)", background: "rgb(var(--bg-rgb) / 0.74)" }}>
                  <div className="line-clamp-2 min-h-[2.4em] text-[9px] font-bold leading-tight tracking-[0.12em] text-text-muted" title={t(lang, post!.titleMS, post!.titleEN)}>{t(lang, post!.titleMS, post!.titleEN)}</div>
                  <div className="mt-1 line-clamp-2 text-[13px] font-black leading-tight text-white" title={member!.name}>{member!.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-text-muted">📍 {member!.homeState.toUpperCase()} · {t(lang, SPECIALTY_LABEL[member!.specialty][0], SPECIALTY_LABEL[member!.specialty][1])}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 border px-3 py-2 text-[12px] font-black tracking-wider" style={{ borderColor: "rgb(var(--gold-rgb)/0.26)", background: "rgb(var(--gold-rgb)/0.06)", color: "var(--gold)" }}>
              ➡️ {t(lang, "Seterusnya: 100 hari pertama", "Next: the first 100 days")}
            </div>
          </TacticalPanel>
        </div>
      </main>
      <StatusBar leftText={t(lang, "swearing_in_page.swornIn", { termsExecutiveBody: terms.executiveBody })} rightText={t(lang, "swearing_in_page.first100DaysReady", { leaderPartyAbbr: leader.partyAbbr })} />
    </div>
  );
}
