"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { resumeRoute } from "../../store/journey";
import { useLang, t } from "../../i18n/useLang";

type Guidance = { title: string; message: string; action: string; route: string };
type CityContext = { selectedName: string; selectedSentiment: number; overall: number };

export default function PersonalAssistant({ embedded = false, prominent = false, cityContext }: { embedded?: boolean; prominent?: boolean; cityContext?: CityContext }) {
  const router = useRouter();
  const lang = useLang();
  const state = useGameStore();
  const [open, setOpen] = useState(false);
  const [briefVisible, setBriefVisible] = useState(embedded);
  const journey = state.journey;

  // A compact, state-aware briefing makes the assistant feel present in the
  // city without forcing an intrusive card over the map. A new selection or
  // meaningful change earns a fresh, short nudge; the player can always tap
  // the larger avatar for the full plan.
  const proactive = useMemo(() => {
    if (journey.decisions <= 0) return t(lang, "Tenaga hari ini telah digunakan. Semak kalendar dan rancang tindakan esok.", "Today's energy is spent. Check the calendar and plan tomorrow's move.");
    if (cityContext?.selectedSentiment !== undefined && cityContext.selectedSentiment < 54) return t(lang, `${cityContext.selectedName} memerlukan perhatian segera — sentimen ${cityContext.selectedSentiment}%.`, `${cityContext.selectedName} needs attention now — sentiment is ${cityContext.selectedSentiment}%.`);
    if (cityContext && cityContext.overall < 55) return t(lang, "Sentimen keseluruhan masih rapuh. Utamakan lawatan komuniti dan isu paling lemah.", "Overall sentiment is fragile. Prioritise community visits and the weakest issue.");
    if (state.resources.funds < 25_000) return t(lang, "Dana operasi rendah. Pilih aktiviti kos rendah sebelum komit projek besar.", "Operating funds are low. Choose low-cost activity before committing to a major project.");
    if (cityContext) return t(lang, `Saya memantau ${cityContext.selectedName}. Sentimen zon: ${cityContext.selectedSentiment}%.`, `I'm monitoring ${cityContext.selectedName}. Zone sentiment: ${cityContext.selectedSentiment}%.`);
    return t(lang, "Saya sedang memantau papan strategi anda. Tekan saya jika mahu langkah seterusnya.", "I'm monitoring your strategy board. Tap me when you want the next move.");
  }, [cityContext, journey.decisions, lang, state.resources.funds]);
  const proactiveKey = `${cityContext?.selectedName ?? ""}:${cityContext?.selectedSentiment ?? ""}:${journey.decisions}:${state.resources.funds}`;
  useEffect(() => {
    if (!embedded) return;
    setBriefVisible(true);
    const timer = window.setTimeout(() => setBriefVisible(false), 7500);
    return () => window.clearTimeout(timer);
  }, [embedded, proactiveKey]);

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
    return <div className={`absolute bottom-[186px] right-4 ${open ? "z-[120]" : "z-30"} flex items-end justify-end`} style={{ fontFamily: "'Space Mono', monospace" }}>
      {briefVisible && !open && <button type="button" onClick={() => { setOpen(true); setBriefVisible(false); }} className="absolute bottom-[calc(100%+10px)] right-0 w-[min(280px,calc(100vw-48px))] border px-3 py-2 text-left shadow-xl transition hover:border-cyan" style={{ borderColor: "rgb(var(--cyan-rgb) / .5)", background: "rgb(var(--bg-rgb) / .94)", backdropFilter: "blur(12px)" }} aria-label={t(lang, "Buka nasihat pembantu", "Open assistant advice")}><div className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full bg-cyan animate-pulse" /><span className="text-[8px] font-black tracking-[.16em] text-cyan">{t(lang, "PA // ANALISIS LANGSUNG", "PA // LIVE ANALYSIS")}</span></div><p className="mt-1 text-[10px] leading-relaxed text-text-muted">{proactive}</p></button>}
      {open && <section className="absolute bottom-[calc(100%+14px)] right-0 z-10 max-h-[min(590px,calc(100vh-230px))] w-[min(480px,calc(100vw-40px))] overflow-y-auto border p-4 shadow-2xl" style={{ borderColor: "rgb(var(--cyan-rgb) / .48)", background: "rgb(var(--bg-rgb) / .96)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black tracking-[.2em] text-gold">{t(lang, "PEMBANTU PERIBADI · AI AKTIF", "PERSONAL ASSISTANT · AI ACTIVE")}</div><h2 className="mt-1 text-sm font-black text-white">{guidance.title}</h2></div><button type="button" onClick={() => setOpen(false)} className="border px-2 py-1 text-[9px] font-black tracking-widest text-text-muted hover:text-white" style={{ borderColor: "rgb(var(--cyan-rgb) / .35)" }} aria-label={t(lang, "Minimumkan pembantu", "Minimise assistant")}>{t(lang, "MINIMUM", "MINIMISE")}</button></div>
        <div className="mt-3 border px-3 py-2" style={{ borderColor: "rgb(var(--gold-rgb) / .3)", background: "rgb(var(--gold-rgb) / .06)" }}><div className="text-[8px] font-black tracking-[.16em] text-gold">{t(lang, "BACAAN LANGSUNG", "LIVE READOUT")}</div><p className="mt-1 text-[11px] leading-relaxed text-white">{proactive}</p></div>
        <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{guidance.message}</p>
        <div className="mt-3 border p-3" style={{ borderColor: "rgb(var(--cyan-rgb) / .28)", background: "rgb(var(--cyan-rgb) / .05)" }}><b className="text-[9px] tracking-[.16em] text-cyan">{t(lang, "IKUT TURUTAN INI", "FOLLOW THESE STEPS")}</b><ol className="mt-2 space-y-2">{citySteps.map((step) => <li key={step} className="text-[11px] leading-relaxed text-text-muted">{step}</li>)}</ol></div>
        <button type="button" onClick={() => { setOpen(false); router.push(guidance.route); }} className="mt-3 w-full border px-3 py-2.5 text-[11px] font-black tracking-widest" style={{ borderColor: "rgb(var(--gold-rgb) / .56)", color: "var(--gold)", background: "rgb(var(--gold-rgb) / .08)" }}>{guidance.action} →</button>
      </section>}
      <button
        type="button"
        onClick={() => { setOpen((value) => !value); setBriefVisible(false); }}
        className="group relative h-[132px] w-[min(220px,calc(100vw-48px))] overflow-hidden border-2 text-left shadow-2xl transition hover:scale-[1.025] focus:outline-none"
        style={{ borderColor: "rgb(var(--gold-rgb) / .82)", background: "rgb(2 8 20 / .96)", boxShadow: "0 0 32px rgb(var(--cyan-rgb) / .5)" }}
        aria-label={t(lang, "Buka panggilan video pembantu peribadi", "Open Personal Assistant video call")}
      >
        <Image src="/personal-assistant.png" alt={t(lang, "Pembantu Peribadi", "Personal Assistant")} fill sizes="220px" className="object-cover object-[center_18%] transition duration-500 group-hover:scale-105" />
        <span className="absolute inset-0 bg-gradient-to-t from-[#020814]/95 via-transparent to-[#020814]/20" />
        <span className="absolute left-2 top-2 flex items-center gap-1.5 bg-emerald-400 px-2 py-1 text-[8px] font-black tracking-[.16em] text-[#021018] shadow"><span className="h-1.5 w-1.5 rounded-full bg-[#021018] animate-pulse" />{t(lang, "LANGSUNG", "LIVE")}</span>
        <span className="absolute right-2 top-2 border border-white/50 bg-[#020814]/80 px-1.5 py-1 text-[8px] font-black tracking-widest text-white">HD</span>
        <span className="absolute bottom-0 left-0 right-0 border-t border-cyan/35 bg-[#020814]/80 px-3 py-2 backdrop-blur-sm"><span className="block text-[9px] font-black tracking-[.16em] text-white">{t(lang, "PEMBANTU PERIBADI", "PERSONAL ASSISTANT")}</span><span className="mt-0.5 block text-[8px] font-black tracking-[.12em] text-cyan">{t(lang, "PANGGILAN VIDEO · TEKAN UNTUK BUKA", "VIDEO CALL · TAP TO OPEN")}</span></span>
      </button>
    </div>;
  }

  return (
    <div className={`${embedded ? "absolute bottom-4 left-4 z-30" : "fixed bottom-12 left-4 z-[65]"} flex items-end gap-2`} style={{ fontFamily: "'Space Mono', monospace" }}>
      {open && <section className={`${prominent ? "w-[min(390px,calc(100vw-156px))]" : "w-[min(330px,calc(100vw-88px))]"} border p-3 shadow-2xl`} style={{ borderColor: "rgb(var(--cyan-rgb) / .48)", background: "rgb(var(--bg-rgb) / .94)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black tracking-[.2em] text-gold">{t(lang, "PEMBANTU PERIBADI", "PERSONAL ASSISTANT")}</div><h2 className="mt-1 text-xs font-black text-white">{guidance.title}</h2></div><button type="button" onClick={() => setOpen(false)} className="text-xs text-text-muted" aria-label={t(lang, "Tutup pembantu", "Close assistant")}>×</button></div>
        <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{guidance.message}</p>
        <button type="button" onClick={() => { setOpen(false); router.push(guidance.route); }} className="mt-3 w-full border px-3 py-2 text-[10px] font-black tracking-widest" style={{ borderColor: "rgb(var(--gold-rgb) / .56)", color: "var(--gold)", background: "rgb(var(--gold-rgb) / .08)" }}>{guidance.action} →</button>
      </section>}
      <button type="button" onClick={() => setOpen((value) => !value)} className={`relative overflow-hidden rounded-full border shadow-lg transition hover:scale-105 ${prominent ? "h-28 w-28 ring-2 ring-cyan/35" : "h-14 w-14"}`} style={{ borderColor: "rgb(var(--gold-rgb) / .72)", background: "var(--bg)", boxShadow: prominent ? "0 0 28px rgb(var(--cyan-rgb) / .46)" : "0 0 20px rgb(var(--cyan-rgb) / .24)" }} aria-label={t(lang, "Buka pembantu peribadi", "Open Personal Assistant")}>
        <Image src="/personal-assistant.png" alt={t(lang, "Pembantu Peribadi", "Personal Assistant")} fill sizes={prominent ? "112px" : "56px"} className="object-cover" />
        {prominent && <span className="absolute inset-1 rounded-full border border-cyan/50 animate-pulse" />}
        <span className={`absolute bottom-0 left-0 right-0 bg-black/75 font-black tracking-widest text-cyan ${prominent ? "py-1 text-[9px]" : "py-0.5 text-[7px]"}`}>{prominent ? t(lang, "PEMBANTU PERIBADI", "PERSONAL ASSISTANT") : "PA"}</span>
      </button>
    </div>
  );
}
