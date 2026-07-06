"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";
import { computeElectionOutcome } from "../utils/electionOutcome";
import { usePendingNav } from "../hooks/usePendingNav";

const REFORMS = [
  { id: "leadership", titleMS: "Cabaran Kepimpinan", titleEN: "Leadership Challenge", effect: 9 },
  { id: "candidate", titleMS: "Audit Calon Toksik", titleEN: "Audit Toxic Candidates", effect: 7 },
  { id: "rebrand", titleMS: "Rebrand Parti", titleEN: "Party Rebrand", effect: 8 },
  { id: "youth", titleMS: "Rekrut Pemimpin Muda", titleEN: "Recruit Young Leaders", effect: 10 },
];

export default function PostmortemPage() {
  const router = useRouter();
  const { isPending, navigate } = usePendingNav();
  const lang = useLang();
  const { states, leader } = useGameStore();
  const outcome = computeElectionOutcome(states);
  const [selected, setSelected] = useState(["candidate", "youth"]);
  const survival = Math.min(100, 18 + outcome.seatsWon + selected.length * 12);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {t(lang, "MANDAT DITOLAK · POST-MORTEM PARTI", "MANDATE REJECTED · PARTY POST-MORTEM")}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{t(lang, "BINA SEMULA PARTI", "REBUILD THE PARTY")}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>{leader.partyAbbr} · {outcome.seatsWon} {t(lang, "kerusi sahaja", "seats only")}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/mandate")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {t(lang, "MANDAT", "MANDATE")}</button>
            <button onClick={() => navigate("/career")} disabled={isPending} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-60 disabled:cursor-wait" style={{ border: "1px solid rgb(var(--gold-rgb)/0.42)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.08)" }}>{isPending ? t(lang, "MEMUATKAN...", "LOADING...") : t(lang, "TERUSKAN SURVIVAL", "CONTINUE SURVIVAL")}</button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <TacticalPanel title={t(lang, "SKOR SURVIVAL", "SURVIVAL SCORE")}>
            <div className="text-6xl font-black" style={{ color: survival >= 55 ? "var(--gold)" : "var(--neon-red)" }}>{survival}</div>
            <div className="mt-2 text-[13px] leading-relaxed text-text-muted">{t(lang, "Kekalahan teruk bukan game over, tetapi parti perlu dibersihkan, dijenamakan semula dan dibina dari bawah sebelum PRU seterusnya.", "A heavy defeat is not game over, but the party must be cleaned up, rebranded and rebuilt from the ground before the next GE.")}</div>
          </TacticalPanel>
          <TacticalPanel title={t(lang, "AGENDA REFORMASI", "REFORM AGENDA")}>
            <div className="grid gap-3 md:grid-cols-2">
              {REFORMS.map((reform) => {
                const active = selected.includes(reform.id);
                return <button key={reform.id} onClick={() => setSelected((items) => items.includes(reform.id) ? items.filter((item) => item !== reform.id) : [...items, reform.id])} className="border p-4 text-left" style={{ borderColor: active ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.16)", background: active ? "rgb(var(--gold-rgb)/0.10)" : "rgba(3,8,15,0.72)" }}><div className="text-[14px] font-black text-white">{t(lang, reform.titleMS, reform.titleEN)}</div><div className="mt-2 text-[10px] font-bold" style={{ color: "var(--gold)" }}>Survival +{reform.effect}</div></button>;
              })}
            </div>
          </TacticalPanel>
        </div>
      </main>
      <StatusBar leftText={t(lang, "POST-MORTEM PARTI", "PARTY POST-MORTEM")} rightText={`${leader.partyAbbr} · Survival ${survival}`} />
    </div>
  );
}
