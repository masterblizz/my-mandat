"use client";

import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";
import { usePendingNav } from "../hooks/usePendingNav";
import { computeElectionOutcome, MAJORITY, TOTAL_SEATS } from "../utils/electionOutcome";

const STATUS_COPY = {
  majority: {
    color: "var(--neon-green)",
    textMS: "Rakyat memberi mandat jelas kepada parti anda. Langkah seterusnya ialah mengesahkan sokongan di Istana Negara sebelum kabinet pertama dibentuk.",
    textEN: "Voters have given your party a clear mandate. The next step is to confirm confidence at Istana Negara before forming the first cabinet.",
    actionMS: "SAHKAN MANDAT DI ISTANA",
    actionEN: "CONFIRM MANDATE AT PALACE",
    route: "/formation",
  },
  hung: {
    color: "var(--gold)",
    textMS: "Tiada blok capai majoriti. Parti anda perlu berunding dengan rakan koalisi dan membuktikan sokongan sebelum kerajaan boleh dibentuk.",
    textEN: "No bloc reached majority. Your party must negotiate coalition support and prove confidence before government can form.",
    actionMS: "RUNDING KOALISI",
    actionEN: "NEGOTIATE COALITION",
    route: "/formation",
  },
  opposition: {
    color: "var(--warn-orange)",
    textMS: "Anda gagal membentuk kerajaan pusat, tetapi cukup kuat untuk memimpin pembangkang, membina shadow cabinet dan bersedia untuk PRN/PRK.",
    textEN: "You failed to form federal government, but remain strong enough to lead opposition, build a shadow cabinet and prepare for PRN/by-elections.",
    actionMS: "BENTUK SHADOW CABINET",
    actionEN: "FORM SHADOW CABINET",
    route: "/opposition",
  },
  collapse: {
    color: "var(--neon-red)",
    textMS: "Keputusan ini menolak mandat parti. Survival politik kini bergantung kepada post-mortem, reformasi parti dan pembinaan semula jentera.",
    textEN: "The result rejects the party mandate. Political survival now depends on post-mortem, party reform and rebuilding machinery.",
    actionMS: "POST-MORTEM PARTI",
    actionEN: "PARTY POST-MORTEM",
    route: "/postmortem",
  },
};

export default function MandatePage() {
  const router = useRouter();
  const { isPending, navigate } = usePendingNav();
  const lang = useLang();
  const { states, leader } = useGameStore();
  const outcome = computeElectionOutcome(states);
  const copy = STATUS_COPY[outcome.status];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {t(lang, "STATUS MANDAT SELEPAS KEPUTUSAN", "POST-RESULT MANDATE STATUS")}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{t(lang, "SAHKAN MANDAT", "CONFIRM MANDATE")}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>{leader.partyAbbr} · {outcome.seatsWon}/{TOTAL_SEATS} {t(lang, "KERUSI", "SEATS")}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/results")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {t(lang, "KEPUTUSAN", "RESULTS")}</button>
            <button onClick={() => navigate(copy.route)} disabled={isPending} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-60 disabled:cursor-wait" style={{ border: `1px solid ${copy.color}88`, color: copy.color, background: `${copy.color}14` }}>{isPending ? t(lang, "MEMUATKAN...", "LOADING...") : t(lang, copy.actionMS, copy.actionEN)}</button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <TacticalPanel title={t(lang, "KEPUTUSAN MANDAT", "MANDATE VERDICT")}>
            <div className="text-[11px] font-bold tracking-[0.24em] text-text-muted">{t(lang, "STATUS RASMI", "OFFICIAL STATUS")}</div>
            <div className="mt-2 text-3xl font-black leading-tight" style={{ color: copy.color }}>{t(lang, outcome.statusLabelMS, outcome.statusLabelEN)}</div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="border p-3" style={{ borderColor: `${leader.partyColor}66` }}><div className="text-[10px] text-text-muted">{leader.partyAbbr}</div><div className="text-4xl font-black" style={{ color: leader.partyColor }}>{outcome.seatsWon}</div></div>
              <div className="border p-3" style={{ borderColor: "rgb(var(--gold-rgb)/0.36)" }}><div className="text-[10px] text-text-muted">{t(lang, "MAJORITI", "MAJORITY")}</div><div className="text-4xl font-black text-white">{MAJORITY}</div></div>
              <div className="border p-3" style={{ borderColor: "rgb(255 176 0 / 0.28)" }}><div className="text-[10px] text-text-muted">LAWAN</div><div className="text-2xl font-black" style={{ color: "var(--warn-orange)" }}>{outcome.lawanSeats}</div></div>
              <div className="border p-3" style={{ borderColor: "rgba(255,255,255,0.14)" }}><div className="text-[10px] text-text-muted">OTHERS</div><div className="text-2xl font-black text-text-muted">{outcome.othersSeats}</div></div>
            </div>
          </TacticalPanel>

          <TacticalPanel title={t(lang, "ARAH STORYLINE", "STORYLINE DIRECTION")}>
            <div className="text-[15px] leading-relaxed text-text-muted">{t(lang, copy.textMS, copy.textEN)}</div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="border p-4" style={{ borderColor: "rgb(var(--cyan-rgb)/0.22)" }}><div className="text-[10px] text-text-muted tracking-widest">{t(lang, "SOKONGAN NASIONAL", "NATIONAL SUPPORT")}</div><div className="mt-2 text-3xl font-black" style={{ color: "var(--cyan)" }}>{outcome.nationalSupport}</div></div>
              <div className="border p-4" style={{ borderColor: "rgb(var(--gold-rgb)/0.22)" }}><div className="text-[10px] text-text-muted tracking-widest">{t(lang, "NEGERI MENANG", "STATES WON")}</div><div className="mt-2 text-3xl font-black" style={{ color: "var(--gold)" }}>{outcome.statesWon}</div></div>
              <div className="border p-4" style={{ borderColor: "rgb(255 68 68 / 0.22)" }}><div className="text-[10px] text-text-muted tracking-widest">{t(lang, "NEGERI KALAH", "STATES LOST")}</div><div className="mt-2 text-3xl font-black" style={{ color: "var(--neon-red)" }}>{outcome.statesLost}</div></div>
            </div>
            <div className="mt-5 text-[12px] leading-relaxed text-text-muted">
              {t(lang, "War Room masih aktif hanya untuk semakan keputusan. Selepas mandat disahkan dan kerajaan dibentuk, War Room akan dikunci sehingga musim pilihan raya berikutnya.", "War Room remains available only for result review. Once mandate is confirmed and government forms, War Room will lock until the next election season.")}
            </div>
          </TacticalPanel>
        </div>
      </main>
      <StatusBar leftText={`${t(lang, "STATUS MANDAT", "MANDATE STATUS")} · ${t(lang, outcome.statusLabelMS, outcome.statusLabelEN)}`} rightText={`${leader.partyAbbr} ${outcome.seatsWon}/${TOTAL_SEATS}`} />
    </div>
  );
}
