"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Header from "../components/layout/Header";
import PersonalAssistant from "../components/assistant/PersonalAssistant";
import StatusBar from "../components/layout/StatusBar";
import { useGameStore } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";

type Hotspot = { icon: string; title: string; detail: string; route: string; className: string };

export default function PoliticalOfficePage() {
  const router = useRouter();
  const lang = useLang();
  const { leader, journey, resources } = useGameStore();
  const [active, setActive] = useState<string | null>(null);
  const officeTitle = journey.chapter === "government"
    ? t(lang, "Pejabat Wakil Rakyat", "Representative Office")
    : t(lang, "Pejabat Politik Anda", "Your Political Office");
  const hotspots: Hotspot[] = [
    { icon: "🖥️", title: t(lang, "Meja Strategi", "Strategy Desk"), detail: t(lang, "Semak karier, janji dan hubungan.", "Review career, pledges and relationships."), route: "/career", className: "left-[34%] top-[43%] h-[29%] w-[31%]" },
    { icon: "📅", title: t(lang, "Jadual Politik", "Political Schedule"), detail: t(lang, "Rancang hari kempen dan lawatan.", "Plan campaign days and visits."), route: "/calendar", className: "left-[52%] top-[17%] h-[29%] w-[14%]" },
    { icon: "📰", title: t(lang, "Skrin Berita", "News Screen"), detail: t(lang, "Semak mesej dan respons awam.", "Review messaging and public response."), route: "/messaging", className: "left-[72%] top-[12%] h-[24%] w-[12%]" },
    { icon: "🗂️", title: t(lang, "Fail Kawasan", "Constituency Files"), detail: t(lang, "Kembali ke bandar dan lihat zon anda.", "Return to the city and inspect your zones."), route: "/kawasan", className: "left-[4%] top-[10%] h-[66%] w-[18%]" },
  ];

  return <div className="min-h-screen overflow-hidden" style={{ background: "#020814" }}>
    <Header />
    <main className="relative h-[calc(100vh-30px)] min-h-[650px] pt-[40px]" style={{ fontFamily: "'Space Mono', monospace" }}>
      <Image src="/political-office-realistic.png" alt={officeTitle} fill priority sizes="100vw" className="object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,8,20,.68),transparent_36%,transparent_68%,rgba(2,8,20,.46))]" />
      <div className="absolute left-4 top-14 z-10 border px-4 py-3 shadow-2xl" style={{ borderColor: "rgb(var(--cyan-rgb) / .5)", background: "rgb(2 8 20 / .86)", backdropFilter: "blur(12px)" }}>
        <div className="text-[9px] font-black tracking-[.22em] text-cyan">🏢 {t(lang, "LOKASI BANDAR · INTERIOR", "CITY LOCATION · INTERIOR")}</div>
        <h1 className="mt-1 text-lg font-black tracking-wider text-white">{officeTitle}</h1>
        <p className="mt-1 text-[9px] text-text-muted">{leader.partyAbbr || leader.party} · {t(lang, "Ruang kerja aktif", "Active workspace")}</p>
      </div>
      <button type="button" onClick={() => router.push("/kawasan")} className="absolute right-4 top-14 z-10 border px-3 py-2 text-[9px] font-black tracking-widest text-cyan shadow-xl" style={{ borderColor: "rgb(var(--cyan-rgb) / .48)", background: "rgb(2 8 20 / .86)" }}>← {t(lang, "KEMBALI KE BANDAR", "RETURN TO CITY")}</button>

      {hotspots.map((spot) => <button key={spot.title} type="button" onClick={() => setActive(spot.title)} className={`group absolute z-[5] cursor-pointer rounded border border-transparent transition hover:border-cyan/80 hover:bg-cyan/10 ${spot.className}`} aria-label={spot.title}><span className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap border px-2 py-1 text-[9px] font-black tracking-widest text-cyan shadow-xl group-hover:block" style={{ background: "rgb(2 8 20 / .9)", borderColor: "rgb(var(--cyan-rgb) / .6)" }}>{spot.icon} {spot.title}</span></button>)}

      {active && (() => { const spot = hotspots.find((item) => item.title === active)!; return <section className="absolute bottom-10 left-4 z-20 w-[min(360px,calc(100%-32px))] border p-3 shadow-2xl" style={{ borderColor: "rgb(var(--cyan-rgb) / .5)", background: "rgb(2 8 20 / .92)", backdropFilter: "blur(14px)" }}><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black tracking-widest text-gold">{spot.icon} {spot.title.toUpperCase()}</div><p className="mt-2 text-[10px] leading-relaxed text-text-muted">{spot.detail}</p></div><button type="button" onClick={() => setActive(null)} className="text-text-muted">×</button></div><button type="button" onClick={() => router.push(spot.route)} className="mt-3 w-full border px-3 py-2 text-[9px] font-black tracking-widest text-cyan" style={{ borderColor: "rgb(var(--cyan-rgb) / .55)", background: "rgb(var(--cyan-rgb) / .08)" }}>{t(lang, "BUKA AKTIVITI", "OPEN ACTIVITY")} →</button></section>; })()}
      <div className="absolute bottom-4 right-4 z-10 border px-3 py-2 text-[9px] font-black tracking-widest text-gold" style={{ borderColor: "rgb(var(--gold-rgb) / .42)", background: "rgb(2 8 20 / .84)" }}>RM {resources.funds.toLocaleString("en-MY")} · {t(lang, "DANA AKTIF", "ACTIVE FUNDS")}</div>
      <PersonalAssistant embedded />
    </main>
    <StatusBar leftText={t(lang, "PEJABAT POLITIK · RUANG KERJA", "POLITICAL OFFICE · WORKSPACE")} rightText={t(lang, "Klik perabot atau paparan untuk berinteraksi", "Click furniture or displays to interact")} />
  </div>;
}
