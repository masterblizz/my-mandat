"use client";

import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";
import { DPM_POSTS, MINISTER_POSTS, PM_POST } from "../data/cabinet";
import { PARTY_MEMBERS } from "../data/members";
import { computeElectionOutcome } from "../utils/electionOutcome";
import { usePendingNav } from "../hooks/usePendingNav";

const KEY_POST_IDS = ["pm", "dpm1", "min-fin", "min-home", "min-edu", "min-health"];

export default function SwearingInPage() {
  const router = useRouter();
  const { isPending, navigate } = usePendingNav();
  const lang = useLang();
  const { states, leader } = useGameStore();
  const outcome = computeElectionOutcome(states);
  const allPosts = [PM_POST, ...DPM_POSTS, ...MINISTER_POSTS];
  const keyMinisters = KEY_POST_IDS.map((postId, index) => ({ post: allPosts.find((post) => post.id === postId), member: PARTY_MEMBERS[index] })).filter((item) => item.post && item.member);
  const cabinetScore = Math.min(100, Math.round(58 + outcome.seatsWon / 5 + leader.credibility / 8));

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(circle at 50% 0%, rgb(var(--gold-rgb)/0.10), transparent 35%), var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {t(lang, "ISTIADAT ANGKAT SUMPAH", "SWEARING-IN CEREMONY")}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{t(lang, "KABINET RASMI", "OFFICIAL CABINET")}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>{leader.partyAbbr} · {outcome.seatsWon} {t(lang, "kerusi", "seats")} · {t(lang, "kerajaan baharu", "new government")}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/cabinet")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {t(lang, "KABINET", "CABINET")}</button>
            <button onClick={() => navigate("/government")} disabled={isPending} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-60 disabled:cursor-wait" style={{ border: "1px solid rgb(var(--gold-rgb)/0.5)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.10)" }}>{isPending ? t(lang, "MEMUATKAN...", "LOADING...") : t(lang, "MULA 100 HARI PERTAMA", "START FIRST 100 DAYS")}</button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <TacticalPanel title={t(lang, "PENGUMUMAN RASMI", "OFFICIAL ANNOUNCEMENT")}>
            <div className="text-[11px] font-bold tracking-[0.24em] text-text-muted">ISTANA NEGARA</div>
            <div className="mt-3 text-3xl font-black leading-tight" style={{ color: "var(--gold)" }}>{t(lang, "KERAJAAN DIPERKENANKAN", "GOVERNMENT APPROVED")}</div>
            <div className="mt-4 text-[13px] leading-relaxed text-text-muted">
              {t(lang, "Barisan kabinet pertama telah mengangkat sumpah. War Room pilihan raya ditutup. Cabaran sebenar kini bermula: menunaikan janji, mengurus krisis dan mempertahankan mandat rakyat.", "The first cabinet has been sworn in. Election War Room is closed. The real challenge begins: deliver promises, manage crises and defend the people's mandate.")}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="border p-3" style={{ borderColor: "rgb(var(--gold-rgb)/0.32)" }}><div className="text-[10px] text-text-muted">{t(lang, "REAKSI AWAM", "PUBLIC REACTION")}</div><div className="text-2xl font-black" style={{ color: "var(--neon-green)" }}>POSITIF</div></div>
              <div className="border p-3" style={{ borderColor: "rgb(var(--cyan-rgb)/0.32)" }}><div className="text-[10px] text-text-muted">{t(lang, "SKOR KABINET", "CABINET SCORE")}</div><div className="text-2xl font-black" style={{ color: "var(--cyan)" }}>{cabinetScore}</div></div>
            </div>
          </TacticalPanel>

          <TacticalPanel title={t(lang, "BARISAN UTAMA", "KEY LINEUP")}>
            <div className="grid gap-3 md:grid-cols-3">
              {keyMinisters.map(({ post, member }) => (
                <div key={post!.id} className="border p-4" style={{ borderColor: "rgb(var(--cyan-rgb)/0.18)", background: "rgba(3,8,15,0.74)" }}>
                  <div className="text-[10px] font-bold tracking-[0.2em] text-text-muted">{t(lang, post!.titleMS, post!.titleEN)}</div>
                  <div className="mt-2 text-[14px] font-black text-white">{member!.name}</div>
                  <div className="mt-1 text-[11px] text-text-muted">{member!.homeState} · {member!.specialty}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 border px-4 py-3" style={{ borderColor: "rgb(var(--gold-rgb)/0.26)", background: "rgb(var(--gold-rgb)/0.06)" }}>
              <div className="text-[11px] font-black tracking-[0.22em]" style={{ color: "var(--gold)" }}>{t(lang, "NEXT STORY BEAT", "NEXT STORY BEAT")}</div>
              <div className="mt-1 text-[12px] text-text-muted">{t(lang, "Masuk ke pemerintahan 100 hari pertama: pilih dasar, kawal koalisi dan jawab krisis awal kerajaan.", "Enter the first 100 days: choose policy, manage coalition and respond to early government crises.")}</div>
            </div>
          </TacticalPanel>
        </div>
      </main>
      <StatusBar leftText={t(lang, "KABINET ANGKAT SUMPAH", "CABINET SWORN IN")} rightText={`${leader.partyAbbr} · First 100 Days Ready`} />
    </div>
  );
}
