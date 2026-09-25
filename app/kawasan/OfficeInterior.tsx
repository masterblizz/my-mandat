"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLang, t } from "../i18n/useLang";

export type OfficeInteriorKind = "office" | "party" | "operations" | "calendar" | "media" | "commission" | "cabinet" | "administration" | "national";

type Interior = { icon: string; ms: string; en: string; route: string; msAction: string; enAction: string; accent: string };

const INTERIORS: Record<OfficeInteriorKind, Interior> = {
  office: { icon: "🏢", ms: "Pejabat Peribadi", en: "Personal Office", route: "/career", msAction: "Buka taklimat karier", enAction: "Open career briefing", accent: "#22d3ee" },
  party: { icon: "🏛️", ms: "Ibu Pejabat Parti", en: "Party Headquarters", route: "/campaign", msAction: "Masuk bilik strategi", enAction: "Enter strategy room", accent: "#f0a500" },
  operations: { icon: "🛰️", ms: "Pusat Operasi", en: "Operations Centre", route: "/warroom", msAction: "Buka War Room", enAction: "Open War Room", accent: "#22d3ee" },
  calendar: { icon: "📅", ms: "Bilik Jadual Kempen", en: "Campaign Calendar", route: "/calendar", msAction: "Buka jadual", enAction: "Open calendar", accent: "#a78bfa" },
  media: { icon: "📡", ms: "Pusat Media", en: "Media Centre", route: "/messaging", msAction: "Buka konsol media", enAction: "Open media console", accent: "#38bdf8" },
  commission: { icon: "🗳️", ms: "Suruhanjaya Pilihan Raya", en: "Election Commission", route: "/polling", msAction: "Buka data tinjauan", enAction: "Open polling data", accent: "#34d399" },
  cabinet: { icon: "🏛️", ms: "Bangunan Kabinet", en: "Cabinet Building", route: "/cabinet", msAction: "Masuk bilik kabinet", enAction: "Enter cabinet room", accent: "#f0a500" },
  administration: { icon: "⚖️", ms: "Pusat Pentadbiran", en: "Administration Centre", route: "/government", msAction: "Urus pentadbiran", enAction: "Manage administration", accent: "#22d3ee" },
  national: { icon: "🗺️", ms: "Pusat Analisis Negara", en: "National Analysis Centre", route: "/sandbox", msAction: "Buka analisis negara", enAction: "Open national analysis", accent: "#a78bfa" },
};

export default function OfficeInterior({ kind, onClose }: { kind: OfficeInteriorKind; onClose: () => void }) {
  const router = useRouter();
  const lang = useLang();
  const interior = INTERIORS[kind];
  const label = lang === "ms" ? interior.ms : interior.en;
  const action = lang === "ms" ? interior.msAction : interior.enAction;

  return <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6" style={{ background: "rgba(1, 6, 14, .88)", backdropFilter: "blur(8px)" }}>
    <section className="relative h-[min(720px,calc(100vh-48px))] w-[min(1180px,100%)] overflow-hidden border shadow-2xl" style={{ borderColor: `${interior.accent}99`, background: "linear-gradient(180deg, #132238 0 43%, #283342 44%, #111924 100%)", boxShadow: `0 0 55px ${interior.accent}2c` }}>
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b px-4 py-3" style={{ borderColor: `${interior.accent}55`, background: "rgba(3, 10, 20, .82)" }}><div><div className="text-[9px] font-black tracking-[.25em]" style={{ color: interior.accent }}>{t(lang, "LOKASI BANDAR · INTERIOR", "CITY LOCATION · INTERIOR")}</div><h2 className="mt-1 text-lg font-black text-white">{interior.icon} {label}</h2></div><button type="button" onClick={onClose} className="border px-3 py-2 text-[10px] font-black tracking-widest text-text-muted" style={{ borderColor: "rgba(255,255,255,.22)" }}>{t(lang, "KELUAR KE BANDAR", "EXIT TO CITY")} ×</button></div>
      <div className="absolute inset-x-[10%] top-[17%] h-[38%] border-[10px]" style={{ borderColor: "#263b55", background: "linear-gradient(135deg, #5cc7ec 0 40%, #b6dcdf 41% 47%, #274055 48%)", boxShadow: "inset 0 0 60px rgba(0,20,40,.45)" }}><div className="absolute inset-x-0 bottom-0 h-8" style={{ background: "rgba(5, 15, 27, .55)" }} /></div>
      <div className="absolute left-[8%] right-[8%] top-[47%] h-[44%]" style={{ background: "linear-gradient(165deg, #4b3726, #1e1713 73%)", clipPath: "polygon(10% 0, 90% 0, 100% 100%, 0 100%)" }} />
      <div className="absolute left-1/2 top-[52%] h-[20%] w-[46%] -translate-x-1/2 rounded-sm border" style={{ borderColor: "#8d6131", background: "linear-gradient(150deg, #c99757, #5c371c)", boxShadow: "0 18px 20px rgba(0,0,0,.45)" }}><div className="absolute -bottom-20 left-[8%] h-20 w-4 bg-[#3a2416]" /><div className="absolute -bottom-20 right-[8%] h-20 w-4 bg-[#3a2416]" /><div className="absolute left-[11%] top-[20%] h-[47%] w-[18%] border bg-[#0d1e2d]" style={{ borderColor: interior.accent }} /><div className="absolute right-[14%] top-[22%] h-[36%] w-[11%] rounded-full border-2 bg-[#ece4cf]" style={{ borderColor: "#bca66a" }} /></div>
      <div className="absolute bottom-[13%] left-[16%] h-20 w-24 rounded-t-[45%] bg-[#1c2631] shadow-xl" style={{ border: "6px solid #0b1119" }} /><div className="absolute bottom-[13%] right-[16%] h-20 w-24 rounded-t-[45%] bg-[#1c2631] shadow-xl" style={{ border: "6px solid #0b1119" }} />
      <div className="absolute bottom-[8%] left-[6%] w-48 border p-3" style={{ borderColor: `${interior.accent}55`, background: "rgba(3, 12, 22, .88)" }}><div className="flex gap-2"><div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border" style={{ borderColor: interior.accent }}><Image src="/personal-assistant.png" alt="Personal Assistant" fill sizes="40px" className="object-cover" /></div><div><div className="text-[9px] font-black tracking-widest" style={{ color: interior.accent }}>PERSONAL ASSISTANT</div><p className="mt-1 text-[10px] text-text-muted">{t(lang, "Anda sudah berada di dalam bangunan. Gunakan meja strategi untuk mula bekerja.", "You are inside the building. Use the strategy desk to start working.")}</p></div></div></div>
      <button type="button" onClick={() => router.push(`${interior.route}?from=city&place=${kind}`)} className="absolute bottom-[8%] right-[6%] border px-4 py-3 text-[10px] font-black tracking-widest" style={{ borderColor: interior.accent, color: interior.accent, background: "rgba(3, 12, 22, .88)" }}>{action} →</button>
    </section>
  </div>;
}
