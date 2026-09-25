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
  const { leader, journey, day, totalDays, advanceDay } = useGameStore();
  const [active, setActive] = useState<string | null>(null);
  const [missionOpen, setMissionOpen] = useState(true);
  const [inboxOpen, setInboxOpen] = useState(true);
  const [openedMail, setOpenedMail] = useState<number | null>(null);
  const officeTitle = journey.chapter === "government"
    ? t(lang, "Pejabat Wakil Rakyat", "Representative Office")
    : t(lang, "Pejabat Politik Anda", "Your Political Office");
  const hotspots: Hotspot[] = [
    { icon: "🖥️", title: t(lang, "Meja Strategi", "Strategy Desk"), detail: t(lang, "Rancang kempen, agih dana dan tetapkan mesej utama untuk minggu ini.", "Plan campaign moves, allocate funds and set the week's core message."), route: "/career", className: "left-[36%] top-[51%]" },
    { icon: "📅", title: t(lang, "Jadual Politik", "Political Schedule"), detail: t(lang, "Rancang hari kempen dan lawatan.", "Plan campaign days and visits."), route: "/calendar", className: "left-[52%] top-[25%]" },
    { icon: "📰", title: t(lang, "Berita TV", "Live News"), detail: t(lang, "Semak mesej dan respons awam.", "Review messaging and public response."), route: "/messaging", className: "left-[70%] top-[16%]" },
    { icon: "🗂️", title: t(lang, "Fail Kawasan", "Constituency Files"), detail: t(lang, "Kembali ke bandar dan lihat zon anda.", "Return to the city and inspect your zones."), route: "/kawasan", className: "left-[12%] top-[32%]" },
  ];
  const mails = lang === "ms"
    ? [
      { from: "Ketua Jentera Pandan", subject: "Laporan isu penduduk — tindakan hari ini", preview: "Tiga kawasan meminta lawatan segera berhubung kos sara hidup dan saliran." },
      { from: "Personal Assistant", subject: "Jadual politik dikemas kini", preview: "Mesyuarat jentera dianjak ke 11:30. Saya sudah tandakan jadual di papan pejabat." },
      { from: "Pasukan Media", subject: "Respons media menunggu kelulusan", preview: "Draf kenyataan awam tersedia untuk semakan di skrin berita." },
    ]
    : [
      { from: "Pandan Campaign Chief", subject: "Resident issue report — action today", preview: "Three local areas request an immediate visit about living costs and drainage." },
      { from: "Personal Assistant", subject: "Political schedule updated", preview: "The organiser meeting has moved to 11:30. I marked the schedule on the office board." },
      { from: "Media Team", subject: "Media response awaiting approval", preview: "A public statement draft is ready to review on the news screen." },
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
      <div className="absolute right-40 top-14 z-10 hidden items-center gap-5 border px-4 py-2.5 text-[9px] font-black tracking-widest xl:flex" style={{ borderColor: "rgb(var(--cyan-rgb) / .28)", background: "rgb(2 8 20 / .84)", backdropFilter: "blur(12px)" }}><div><span className="block text-text-muted">{t(lang, "SOKONGAN", "SUPPORT")}</span><b className="mt-1 block text-sm text-cyan">{journey.trust}%</b></div><div className="h-8 w-px bg-cyan/20" /><div><span className="block text-text-muted">{t(lang, "TENAGA", "ENERGY")}</span><b className="mt-1 block text-sm text-gold">{journey.decisions}/3</b></div></div>
      <button type="button" onClick={() => router.push("/kawasan")} className="absolute right-4 top-14 z-10 border px-3 py-2 text-[9px] font-black tracking-widest text-cyan shadow-xl" style={{ borderColor: "rgb(var(--cyan-rgb) / .48)", background: "rgb(2 8 20 / .86)" }}>← {t(lang, "KEMBALI KE BANDAR", "RETURN TO CITY")}</button>

      {hotspots.map((spot) => <div key={spot.title} className={`absolute z-[5] flex items-center gap-2 ${spot.className}`}><span className="relative flex h-3 w-3"><i className="absolute inset-0 animate-ping rounded-full bg-cyan/70" /><i className="relative m-auto h-2 w-2 rounded-full bg-cyan ring-2 ring-[#07111c]" /></span><button type="button" onClick={() => setActive(spot.title)} className="border px-3 py-2 text-[10px] font-black tracking-wide text-white shadow-xl transition hover:border-gold hover:bg-cyan/15" style={{ borderColor: "rgb(var(--cyan-rgb) / .58)", background: "rgb(2 8 20 / .88)" }}>{spot.icon} {spot.title}</button></div>)}
      <button type="button" onClick={() => setInboxOpen(true)} className="absolute left-[41%] top-[53%] z-10 flex items-center gap-1.5 border px-2 py-1.5 text-[9px] font-black tracking-widest text-cyan shadow-xl transition hover:scale-105 hover:border-gold" style={{ borderColor: "rgb(var(--cyan-rgb) / .75)", background: "rgb(2 8 20 / .9)" }}><span className="relative text-base">✉️<i className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-neon-red" /></span>{t(lang, "E-MEL MASUK", "INBOX")} <b className="rounded-full bg-neon-red px-1.5 py-0.5 text-[8px] text-white">{mails.length}</b></button>

      {missionOpen && <section className="absolute bottom-12 left-36 z-20 w-[min(390px,calc(100%-190px))] border p-3 shadow-2xl" style={{ borderColor: "rgb(var(--gold-rgb) / .54)", background: "rgb(2 8 20 / .94)", backdropFilter: "blur(14px)" }}><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black tracking-[.2em] text-gold">PEMBANTU PERIBADI</div><h2 className="mt-1 text-[13px] font-black text-white">{t(lang, "Tuan, isu penduduk makin panas.", "The resident issue is heating up.")}</h2></div><button type="button" onClick={() => setMissionOpen(false)} className="text-text-muted">×</button></div><p className="mt-2 text-[10px] leading-relaxed text-text-muted">{t(lang, "Mahu saya atur lawatan esok pagi, atau keluarkan kenyataan media dahulu?", "Should I schedule a visit tomorrow morning, or prepare a media statement first?")}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => router.push("/calendar")} className="flex-1 border px-2 py-2 text-[9px] font-black text-cyan" style={{ borderColor: "rgb(var(--cyan-rgb) / .55)" }}>{t(lang, "ATUR LAWATAN", "SCHEDULE VISIT")}</button><button type="button" onClick={() => router.push("/messaging")} className="flex-1 border px-2 py-2 text-[9px] font-black text-cyan" style={{ borderColor: "rgb(var(--cyan-rgb) / .55)" }}>{t(lang, "KENYATAAN MEDIA", "MEDIA STATEMENT")}</button></div></section>}
      {!missionOpen && <button type="button" onClick={() => setMissionOpen(true)} className="absolute bottom-12 left-36 z-20 border px-3 py-2 text-[9px] font-black tracking-widest text-gold" style={{ borderColor: "rgb(var(--gold-rgb) / .5)", background: "rgb(2 8 20 / .88)" }}>PA · {t(lang, "TUGAS", "OBJECTIVE")}</button>}

      {active && (() => { const spot = hotspots.find((item) => item.title === active)!; return <section className="absolute bottom-10 left-4 z-20 w-[min(360px,calc(100%-32px))] border p-3 shadow-2xl" style={{ borderColor: "rgb(var(--cyan-rgb) / .5)", background: "rgb(2 8 20 / .92)", backdropFilter: "blur(14px)" }}><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black tracking-widest text-gold">{spot.icon} {spot.title.toUpperCase()}</div><p className="mt-2 text-[10px] leading-relaxed text-text-muted">{spot.detail}</p></div><button type="button" onClick={() => setActive(null)} className="text-text-muted">×</button></div><button type="button" onClick={() => router.push(spot.route)} className="mt-3 w-full border px-3 py-2 text-[9px] font-black tracking-widest text-cyan" style={{ borderColor: "rgb(var(--cyan-rgb) / .55)", background: "rgb(var(--cyan-rgb) / .08)" }}>{t(lang, "BUKA AKTIVITI", "OPEN ACTIVITY")} →</button></section>; })()}
      {inboxOpen && <section className="absolute right-4 top-40 z-30 w-[min(320px,calc(100%-32px))] border border-t-2 shadow-2xl" style={{ borderColor: "rgb(var(--cyan-rgb) / .42)", borderTopColor: "var(--neon-red)", background: "rgb(2 8 20 / .96)", backdropFilter: "blur(16px)" }}><div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "rgb(var(--cyan-rgb) / .22)" }}><div><div className="text-[9px] font-black tracking-[.2em] text-cyan">✉️ {t(lang, "E-MEL MASUK", "INBOX")}</div><h2 className="mt-1 text-sm font-black text-white">{t(lang, "Peti masuk pejabat", "Office inbox")}</h2></div><div className="flex gap-2"><b className="bg-neon-red px-1.5 py-1 text-[8px] text-white">{mails.length} {t(lang, "BARU", "NEW")}</b><button type="button" onClick={() => setInboxOpen(false)} className="text-text-muted">×</button></div></div><div className="max-h-[48vh] overflow-y-auto">{mails.map((mail, index) => <button key={mail.subject} type="button" onClick={() => setOpenedMail(index)} className="w-full border-b px-4 py-3 text-left transition hover:bg-cyan/10" style={{ borderColor: "rgb(var(--cyan-rgb) / .14)", background: openedMail === index ? "rgb(var(--cyan-rgb) / .08)" : undefined }}><div className="flex items-center justify-between gap-3"><b className="text-[9px] text-gold">{mail.from}</b>{openedMail !== index && <i className="h-2 w-2 rounded-full bg-neon-red" />}</div><div className="mt-1 text-[10px] font-black text-white">{mail.subject}</div>{openedMail === index && <p className="mt-2 text-[10px] leading-relaxed text-text-muted">{mail.preview}</p>}</button>)}</div></section>}
      <section className="absolute bottom-12 right-4 z-20 w-72 border p-3 shadow-2xl" style={{ borderColor: "rgb(var(--cyan-rgb) / .35)", background: "rgb(2 8 20 / .92)" }}><div className="flex items-end justify-between"><div><div className="text-[8px] font-black tracking-widest text-text-muted">{t(lang, "TENAGA HARI INI", "TODAY'S ENERGY")}</div><div className="mt-2 flex gap-1">{[0, 1, 2].map((i) => <i key={i} className="h-2 w-7" style={{ background: i < journey.decisions ? "var(--cyan)" : "rgb(255 255 255 / .12)" }} />)}</div></div><b className="text-xl text-white">{journey.decisions}<span className="text-sm text-text-muted">/3</span></b></div><div className="mt-3 flex gap-2"><button type="button" onClick={() => router.push("/kawasan")} className="border px-3 py-2 text-[9px] font-black text-cyan" style={{ borderColor: "rgb(var(--cyan-rgb) / .45)" }}>← {t(lang, "BANDAR", "CITY")}</button><button type="button" onClick={advanceDay} className="flex-1 bg-gold px-3 py-2 text-[9px] font-black tracking-widest text-[#07111c]">{t(lang, "TAMAT HARI", "END DAY")} {day}/{totalDays} →</button></div></section>
      <PersonalAssistant embedded prominent />
      <footer className="absolute bottom-0 left-0 right-0 z-20 flex h-8 items-center overflow-hidden border-t bg-[#07111c]" style={{ borderColor: "rgb(var(--cyan-rgb) / .3)" }}><b className="flex h-full items-center bg-gold px-3 text-[9px] tracking-widest text-[#07111c]">● {t(lang, "BERITA", "NEWS")}</b><div className="whitespace-nowrap px-5 text-[10px] text-text-muted animate-[pulse_5s_ease-in-out_infinite]">{t(lang, "Penduduk Pandan desak tindakan segera isu saliran", "Pandan residents demand immediate drainage action")} <span className="mx-5 text-cyan">◆</span>{t(lang, "Tinjauan: sokongan pengundi muda naik 2 mata minggu ini", "Poll: youth support rises 2 points this week")}</div></footer>
    </main>
    <StatusBar leftText={t(lang, "PEJABAT POLITIK · RUANG KERJA", "POLITICAL OFFICE · WORKSPACE")} rightText={t(lang, "Klik perabot atau paparan untuk berinteraksi", "Click furniture or displays to interact")} />
  </div>;
}
