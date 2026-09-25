"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { resumeRoute } from "../../store/journey";
import { useLang, t } from "../../i18n/useLang";

type Guidance = { title: string; message: string; action: string; route: string };

export default function PersonalAssistant() {
  const router = useRouter();
  const lang = useLang();
  const state = useGameStore();
  const [open, setOpen] = useState(false);
  const journey = state.journey;

  if (state.phase === "ended" || (state.phase === "menu" && journey.characterStage === "member")) return null;

  const guidance: Guidance = journey.chapter === "campaign"
    ? state.day >= state.totalDays
      ? { title: t(lang, "Malam keputusan", "Election night"), message: t(lang, "Kempen tamat. Pergi ke pusat bandar untuk menilai keputusan pilihan raya.", "The campaign is over. Go to the city centre to review the election result."), action: t(lang, "Buka pusat keputusan", "Open results centre"), route: "/kawasan" }
      : { title: t(lang, "Arahan hari ini", "Today's direction"), message: t(lang, `Hari ${state.day}/${state.totalDays}. Klik zon bandar untuk melawat komuniti, menggerakkan jentera atau buka lokasi politik.`, `Day ${state.day}/${state.totalDays}. Click a city zone to visit communities, mobilise organisers or enter a political location.`), action: t(lang, "Kembali ke bandar", "Return to city"), route: "/kawasan" }
    : journey.chapter === "government"
      ? { title: t(lang, "Mandat sedang berjalan", "Your mandate is underway"), message: t(lang, "Gunakan bangunan Kabinet dan Pusat Pentadbiran di bandar untuk mengurus penggal anda.", "Use the Cabinet Building and Administration Centre in the city to manage your term."), action: t(lang, "Buka bandar", "Open city"), route: "/kawasan" }
    : { title: t(lang, "Langkah seterusnya", "Next step"), message: t(lang, "Saya telah menanda lokasi untuk bab politik semasa anda.", "I have marked the location for your current political chapter."), action: t(lang, "Teruskan", "Continue"), route: resumeRoute(state) };

  return (
    <div className="fixed bottom-12 left-4 z-[65] flex items-end gap-2" style={{ fontFamily: "'Space Mono', monospace" }}>
      {open && <section className="w-[min(330px,calc(100vw-88px))] border p-3 shadow-2xl" style={{ borderColor: "rgb(var(--cyan-rgb) / .48)", background: "rgb(var(--bg-rgb) / .94)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black tracking-[.2em] text-gold">{t(lang, "PERSONAL ASSISTANT", "PERSONAL ASSISTANT")}</div><h2 className="mt-1 text-xs font-black text-white">{guidance.title}</h2></div><button type="button" onClick={() => setOpen(false)} className="text-xs text-text-muted" aria-label={t(lang, "Tutup pembantu", "Close assistant")}>×</button></div>
        <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{guidance.message}</p>
        <button type="button" onClick={() => { setOpen(false); router.push(guidance.route); }} className="mt-3 w-full border px-3 py-2 text-[10px] font-black tracking-widest" style={{ borderColor: "rgb(var(--gold-rgb) / .56)", color: "var(--gold)", background: "rgb(var(--gold-rgb) / .08)" }}>{guidance.action} →</button>
      </section>}
      <button type="button" onClick={() => setOpen((value) => !value)} className="relative h-14 w-14 overflow-hidden rounded-full border shadow-lg transition hover:scale-105" style={{ borderColor: "rgb(var(--gold-rgb) / .72)", background: "var(--bg)", boxShadow: "0 0 20px rgb(var(--cyan-rgb) / .24)" }} aria-label={t(lang, "Buka Personal Assistant", "Open Personal Assistant")}>
        <Image src="/personal-assistant.png" alt={t(lang, "Personal Assistant", "Personal Assistant")} fill sizes="56px" className="object-cover" />
        <span className="absolute bottom-0 left-0 right-0 bg-black/75 py-0.5 text-[7px] font-black tracking-widest text-cyan">PA</span>
      </button>
    </div>
  );
}
