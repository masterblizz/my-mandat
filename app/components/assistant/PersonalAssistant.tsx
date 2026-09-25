"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { resumeRoute } from "../../store/journey";
import { useLang, t } from "../../i18n/useLang";

type Guidance = { title: string; message: string; action: string; route: string };

export default function PersonalAssistant({ embedded = false, prominent = false }: { embedded?: boolean; prominent?: boolean }) {
  const router = useRouter();
  const lang = useLang();
  const state = useGameStore();
  const [open, setOpen] = useState(false);
  const journey = state.journey;

  if (state.phase === "ended" || (state.phase === "menu" && journey.characterStage === "member")) return null;

  const guidance: Guidance = journey.chapter === "campaign"
    ? state.day >= state.totalDays
      ? { title: t(lang, "Malam keputusan", "Election night"), message: t(lang, "Kempen tamat. Pergi ke pusat bandar untuk menilai keputusan pilihan raya.", "The campaign is over. Go to the city centre to review the election result."), action: t(lang, "Buka pusat keputusan", "Open results centre"), route: "/kawasan" }
      : { title: embedded ? t(lang, "Cara mula hari ini", "How to start today") : t(lang, "Arahan hari ini", "Today's direction"), message: embedded ? t(lang, `Hari ${state.day}/${state.totalDays}. Mulakan di Pejabat Anda untuk menggunakan tenaga pertama dan membina sokongan kawasan.`, `Day ${state.day}/${state.totalDays}. Start at Your Office to use your first energy and build constituency support.`) : t(lang, `Hari ${state.day}/${state.totalDays}. Klik zon bandar untuk melawat komuniti, menggerakkan jentera atau buka lokasi politik.`, `Day ${state.day}/${state.totalDays}. Click a city zone to visit communities, mobilise organisers or enter a political location.`), action: embedded ? t(lang, "Mula di Pejabat Anda", "Start at Your Office") : t(lang, "Kembali ke bandar", "Return to city"), route: embedded ? "/office" : "/kawasan" }
    : journey.chapter === "government"
      ? { title: embedded ? t(lang, "Urus penggal kerajaan", "Manage the government term") : t(lang, "Mandat sedang berjalan", "Your mandate is underway"), message: t(lang, "Gunakan Bangunan Kabinet untuk keputusan politik, kemudian Pusat Pentadbiran untuk laksana dasar.", "Use the Cabinet Building for political decisions, then the Administration Centre to deliver policies."), action: embedded ? t(lang, "Buka Bangunan Kabinet", "Open Cabinet Building") : t(lang, "Buka bandar", "Open city"), route: embedded ? "/location/cabinet" : "/kawasan" }
    : { title: t(lang, "Langkah seterusnya", "Next step"), message: t(lang, "Saya telah menanda lokasi untuk bab politik semasa anda.", "I have marked the location for your current political chapter."), action: t(lang, "Teruskan", "Continue"), route: resumeRoute(state) };
  const citySteps = journey.chapter === "campaign"
    ? [t(lang, "1. Klik tag ‘PEJABAT ANDA’ atau tekan butang di bawah.", "1. Click the ‘YOUR OFFICE’ tag or use the button below."), t(lang, "2. Di pejabat, buka Meja Strategi atau Berita TV dan pilih satu tindakan.", "2. In the office, open the Strategy Desk or Live News and choose one action."), t(lang, "3. Semak tenaga, dana dan jentera sebelum sahkan. Kemudian kembali ke bandar untuk lokasi seterusnya.", "3. Check energy, funds and organisers before confirming. Then return to the city for the next location.")]
    : [t(lang, "1. Klik Bangunan Kabinet untuk membuat keputusan penggal.", "1. Click the Cabinet Building to make term decisions."), t(lang, "2. Semak bajet dan had tindakan sebelum sahkan arahan.", "2. Check budget and the action limit before confirming a directive."), t(lang, "3. Gunakan Pusat Pentadbiran untuk melaksanakan dasar selepas keputusan dibuat.", "3. Use the Administration Centre to deliver policy after a decision.")];

  if (embedded) {
    return <div className="absolute bottom-12 right-[12%] z-30 w-[min(280px,calc(100vw-48px))]" style={{ fontFamily: "'Space Mono', monospace" }}>
      {open && <section className="absolute bottom-[calc(100%+12px)] right-0 z-10 w-[min(360px,calc(100vw-48px))] border p-3 shadow-2xl" style={{ borderColor: "rgb(var(--cyan-rgb) / .48)", background: "rgb(var(--bg-rgb) / .96)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black tracking-[.2em] text-gold">{t(lang, "PERSONAL ASSISTANT", "PERSONAL ASSISTANT")}</div><h2 className="mt-1 text-xs font-black text-white">{guidance.title}</h2></div><button type="button" onClick={() => setOpen(false)} className="text-xs text-text-muted" aria-label={t(lang, "Tutup pembantu", "Close assistant")}>×</button></div>
        <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{guidance.message}</p>
        <div className="mt-3 border p-2" style={{ borderColor: "rgb(var(--cyan-rgb) / .28)", background: "rgb(var(--cyan-rgb) / .05)" }}><b className="text-[8px] tracking-[.16em] text-cyan">{t(lang, "IKUT TURUTAN INI", "FOLLOW THESE STEPS")}</b><ol className="mt-2 space-y-2">{citySteps.map((step) => <li key={step} className="text-[10px] leading-relaxed text-text-muted">{step}</li>)}</ol></div>
        <button type="button" onClick={() => { setOpen(false); router.push(guidance.route); }} className="mt-3 w-full border px-3 py-2 text-[10px] font-black tracking-widest" style={{ borderColor: "rgb(var(--gold-rgb) / .56)", color: "var(--gold)", background: "rgb(var(--gold-rgb) / .08)" }}>{guidance.action} →</button>
      </section>}
      <button type="button" onClick={() => setOpen((value) => !value)} className="relative w-full overflow-hidden border text-left shadow-2xl transition hover:scale-[1.015] focus:outline-none" style={{ borderColor: "rgb(var(--cyan-rgb) / .7)", background: "rgb(2 8 20 / .96)" }} aria-label={t(lang, "Buka Personal Assistant", "Open Personal Assistant")}><div className="relative h-40 overflow-hidden border-b" style={{ borderColor: "rgb(var(--cyan-rgb) / .4)", background: "linear-gradient(145deg, #12314a, #07111c)" }}><Image src="/personal-assistant.png" alt={t(lang, "Personal Assistant", "Personal Assistant")} fill sizes="280px" className="object-cover object-top" /><span className="absolute left-3 top-3 flex items-center gap-1.5 border px-2 py-1 text-[8px] font-black tracking-widest text-[#07111c]" style={{ borderColor: "var(--neon-green)", background: "var(--neon-green)" }}><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#07111c]" /> LIVE</span><span className="absolute right-3 top-3 border px-2 py-1 text-[8px] text-white" style={{ borderColor: "rgb(255 255 255 / .45)", background: "rgb(2 8 20 / .62)" }}>◉ HD</span></div><div className="flex items-center justify-between px-3 py-3"><div><b className="block text-[10px] tracking-[.14em] text-white">PERSONAL ASSISTANT</b><span className="mt-1 block text-[9px] text-cyan">{t(lang, "Panggilan video aktif", "Video call active")}</span></div><span className="border px-2 py-1 text-[8px] font-black text-gold" style={{ borderColor: "rgb(var(--gold-rgb) / .55)" }}>{open ? t(lang, "TUTUP", "CLOSE") : t(lang, "BUKA", "OPEN")}</span></div></button>
    </div>;
  }

  return (
    <div className={`${embedded ? "absolute bottom-4 left-4 z-30" : "fixed bottom-12 left-4 z-[65]"} flex items-end gap-2`} style={{ fontFamily: "'Space Mono', monospace" }}>
      {open && <section className={`${prominent ? "w-[min(390px,calc(100vw-156px))]" : "w-[min(330px,calc(100vw-88px))]"} border p-3 shadow-2xl`} style={{ borderColor: "rgb(var(--cyan-rgb) / .48)", background: "rgb(var(--bg-rgb) / .94)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black tracking-[.2em] text-gold">{t(lang, "PERSONAL ASSISTANT", "PERSONAL ASSISTANT")}</div><h2 className="mt-1 text-xs font-black text-white">{guidance.title}</h2></div><button type="button" onClick={() => setOpen(false)} className="text-xs text-text-muted" aria-label={t(lang, "Tutup pembantu", "Close assistant")}>×</button></div>
        <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{guidance.message}</p>
        <button type="button" onClick={() => { setOpen(false); router.push(guidance.route); }} className="mt-3 w-full border px-3 py-2 text-[10px] font-black tracking-widest" style={{ borderColor: "rgb(var(--gold-rgb) / .56)", color: "var(--gold)", background: "rgb(var(--gold-rgb) / .08)" }}>{guidance.action} →</button>
      </section>}
      <button type="button" onClick={() => setOpen((value) => !value)} className={`relative overflow-hidden rounded-full border shadow-lg transition hover:scale-105 ${prominent ? "h-28 w-28 ring-2 ring-cyan/35" : "h-14 w-14"}`} style={{ borderColor: "rgb(var(--gold-rgb) / .72)", background: "var(--bg)", boxShadow: prominent ? "0 0 28px rgb(var(--cyan-rgb) / .46)" : "0 0 20px rgb(var(--cyan-rgb) / .24)" }} aria-label={t(lang, "Buka Personal Assistant", "Open Personal Assistant")}>
        <Image src="/personal-assistant.png" alt={t(lang, "Personal Assistant", "Personal Assistant")} fill sizes={prominent ? "112px" : "56px"} className="object-cover" />
        {prominent && <span className="absolute inset-1 rounded-full border border-cyan/50 animate-pulse" />}
        <span className={`absolute bottom-0 left-0 right-0 bg-black/75 font-black tracking-widest text-cyan ${prominent ? "py-1 text-[9px]" : "py-0.5 text-[7px]"}`}>{prominent ? "PERSONAL ASSISTANT" : "PA"}</span>
      </button>
    </div>
  );
}
