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
  { id: "shadow", titleMS: "Bentuk Shadow Cabinet", titleEN: "Form Shadow Cabinet", detailMS: "Padankan jurucakap pembangkang kepada portfolio kerajaan untuk serangan dasar yang konsisten.", detailEN: "Match opposition spokespeople to government portfolios for consistent policy attacks.", momentum: 8 },
  { id: "parliament", titleMS: "Tekan Di Parlimen", titleEN: "Pressure In Parliament", detailMS: "Gunakan soalan, usul dan jawatankuasa untuk memaksa kerajaan bertahan.", detailEN: "Use questions, motions and committees to force government defence.", momentum: 6 },
  { id: "prk", titleMS: "Sasar PRK / PRN", titleEN: "Target By-Elections / PRN", detailMS: "Cari medan kecil untuk menunjukkan momentum comeback sebelum PRU seterusnya.", detailEN: "Find smaller battlegrounds to show comeback momentum before the next GE.", momentum: 9 },
];

const STATE_STRATEGIES = [
  { id: "shadow", titleMS: "Bentuk Shadow EXCO", titleEN: "Form Shadow EXCO", detailMS: "Padankan jurucakap pembangkang kepada portfolio EXCO untuk serangan dasar yang konsisten.", detailEN: "Match opposition spokespeople to EXCO portfolios for consistent policy attacks.", momentum: 8 },
  { id: "parliament", titleMS: "Tekan Di DUN", titleEN: "Pressure In The DUN", detailMS: "Gunakan soalan, usul dan jawatankuasa DUN untuk memaksa kerajaan negeri bertahan.", detailEN: "Use DUN questions, motions and committees to force the state government to defend itself.", momentum: 6 },
  { id: "prk", titleMS: "Sasar PRK DUN", titleEN: "Target DUN By-Elections", detailMS: "Cari kerusi DUN kosong untuk menunjukkan momentum comeback sebelum PRN seterusnya.", detailEN: "Target vacant DUN seats to show comeback momentum before the next state election.", momentum: 9 },
];

export default function OppositionPage() {
  const router = useRouter();
  const { isPending, navigate } = usePendingNav();
  const lang = useLang();
  const { states, leader, settings } = useGameStore();
  const outcome = computeElectionOutcome(states, { electionScope: settings.electionScope, prnStateId: settings.prnStateId });
  const terms = getGovernmentTerms(lang, settings.electionScope, outcome.contestedStates[0]);
  const strategies = terms.isPrn ? STATE_STRATEGIES : FEDERAL_STRATEGIES;
  const [active, setActive] = useState(["shadow"]);
  const comeback = Math.min(100, 35 + Math.round(outcome.seatsWon / 3) + active.length * 8);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {t(lang, `GAGAL BENTUK ${terms.governmentName} · MOD PEMBANGKANG`, `FAILED TO FORM ${terms.governmentName} · OPPOSITION MODE`)}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{t(lang, "BINA COMEBACK", "BUILD COMEBACK")}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>{terms.scopeLabel} · {leader.partyAbbr} · {outcome.seatsWon}/{outcome.totalSeats} {t(lang, `kerusi ${terms.seatLabel}`, `${terms.seatLabel} seats`)}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/mandate")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--cyan-rgb)/0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.06)" }}>← {t(lang, "MANDAT", "MANDATE")}</button>
            <button onClick={() => navigate("/career")} disabled={isPending} className="px-4 py-2 text-[11px] font-bold tracking-widest disabled:opacity-60 disabled:cursor-wait" style={{ border: "1px solid rgb(var(--gold-rgb)/0.42)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.08)" }}>{isPending ? t(lang, "MEMUATKAN...", "LOADING...") : t(lang, "URUS PENGGAL PEMBANGKANG", "MANAGE OPPOSITION TERM")}</button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <TacticalPanel title={t(lang, "STATUS PEMBANGKANG", "OPPOSITION STATUS")}>
            <div className="text-6xl font-black" style={{ color: comeback >= 70 ? "var(--neon-green)" : "var(--gold)" }}>{comeback}</div>
            <div className="mt-2 text-[12px] text-text-muted tracking-wider">{terms.isPrn ? t(lang, "indeks comeback menuju PRN seterusnya", "comeback index toward the next state election") : t(lang, "indeks comeback menuju PRU seterusnya", "comeback index toward the next GE")}</div>
            <div className="mt-5 text-[13px] leading-relaxed text-text-muted">
              {terms.isPrn
                ? t(lang, `Game tidak tamat. Anda kini pembangkang DUN: bentuk shadow EXCO, tekan kerajaan negeri, menang PRK DUN dan bina laluan kembali ke pentadbiran ${terms.stateName}.`, `The game does not end. You are now the DUN opposition: form a shadow EXCO, pressure the state government, win DUN by-elections and build a route back into the ${terms.stateName} administration.`)
                : t(lang, "Game tidak tamat. Anda kini menjadi pembangkang: bentuk shadow cabinet, tekan kerajaan, menang PRK/PRN dan bina laluan kembali ke Putrajaya.", "The game does not end. You are now opposition: form a shadow cabinet, pressure government, win by-elections/PRN and build a route back to Putrajaya.")}
            </div>
          </TacticalPanel>

          <TacticalPanel title={t(lang, "STRATEGI PEMBANGKANG", "OPPOSITION STRATEGY")} noPadding>
            <div className="p-4 grid gap-3 md:grid-cols-3">
              {strategies.map((strategy) => {
                const selected = active.includes(strategy.id);
                return (
                  <button key={strategy.id} onClick={() => setActive((items) => items.includes(strategy.id) ? items.filter((item) => item !== strategy.id) : [...items, strategy.id])} className="border p-4 text-left" style={{ borderColor: selected ? "var(--gold)" : "rgb(var(--cyan-rgb)/0.16)", background: selected ? "rgb(var(--gold-rgb)/0.10)" : "rgba(3,8,15,0.72)" }}>
                    <div className="text-[14px] font-black tracking-wider text-white">{t(lang, strategy.titleMS, strategy.titleEN)}</div>
                    <div className="mt-2 text-[11px] leading-relaxed text-text-muted">{t(lang, strategy.detailMS, strategy.detailEN)}</div>
                    <div className="mt-3 text-[10px] font-bold" style={{ color: "var(--gold)" }}>Momentum +{strategy.momentum}</div>
                  </button>
                );
              })}
            </div>
          </TacticalPanel>
        </div>
      </main>
      <StatusBar leftText={t(lang, "MOD PEMBANGKANG", "OPPOSITION MODE")} rightText={`${leader.partyAbbr} · Comeback ${comeback}`} />
    </div>
  );
}
