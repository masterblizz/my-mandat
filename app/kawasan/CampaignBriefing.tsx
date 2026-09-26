"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLang, t } from "../i18n/useLang";
import { useGameStore } from "../store/gameStore";
import { useUIStore } from "../store/uiStore";

// Day-1 campaign briefing from the Personal Assistant. Opens by itself on a
// fresh campaign (day 1, full energy, nothing done yet) unless the player
// opted out, and can be reopened
// from the GUIDE button for the rest of the campaign. It closes for good
// as soon as the player acts or ends the day, so no save flag is needed.
// "Don't show again" is a per-device preference (uiStore, localStorage)
// that only stops the automatic day-1 opening; GUIDE always works.
export default function CampaignBriefing() {
  const lang = useLang();
  const router = useRouter();
  const { journey, day, totalDays, leader, settings } = useGameStore();
  const showOnStart = useUIStore((s) => s.showCampaignBriefing);
  const setShowOnStart = useUIStore((s) => s.setShowCampaignBriefing);
  const [dismissed, setDismissed] = useState(false);
  const [reopened, setReopened] = useState(false);
  // Wait one commit so StoreHydrator has restored the saved preference —
  // otherwise the default (show) would flash the dialog for opted-out players.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const homeSupport = useGameStore((state) => state.states.find((item) => item.id === state.leader.homeState)?.mandatSupport ?? 0);
  const campaign = journey.chapter === "campaign" && day < totalDays;
  if (!campaign) return null;
  const fresh = day === 1 && journey.decisions === 3 && journey.actionsToday.length === 0;
  const objectiveDay = Math.min(10, totalDays);
  const objectiveDone = journey.locationObjectives.includes("campaign:home-support-60");
  const open = reopened || (ready && showOnStart && fresh && !dismissed);
  const close = () => { setDismissed(true); setReopened(false); };

  const prn = settings.electionScope === "prn";
  const steps: [string, string, string][] = [
    ["⚡", t(lang, "3 tenaga sehari", "3 energy a day"), t(lang,
      "Setiap tindakan utama menggunakan 1 tenaga (lihat TENAGA di bar bawah). Tenaga diisi semula setiap hari baharu.",
      "Every major action uses 1 energy (see ENERGY in the bottom bar). It refills each new day.")],
    ["🏙️", t(lang, "Masuk lokasi di bandar", "Enter city locations"), t(lang,
      "Klik label MASUK. Persediaan lebih murah dan membina jentera serta kepercayaan; Tindakan menaikkan sokongan terus.",
      "Click a MASUK label. Prepare is cheaper and builds organisation and trust; Commit raises support directly.")],
    ["🛰️", t(lang, "Rancang di Pusat Operasi", "Plan in the Operations Centre"), t(lang,
      "Bilik Gerakan: peta negeri, manifesto, peristiwa kempen serta ceramah dan media sosial.",
      "The War Room: state map, manifesto, campaign events, ceramah and social media.")],
    ["🌙", t(lang, "Tamatkan hari", "End the day"), t(lang,
      "Tekan TAMAT HARI di mana-mana lokasi. Lawan bertindak, sokongan berubah dan berita baharu tiba.",
      "Press END DAY at any location. Opponents respond, support shifts and new news arrives.")],
    ["🗳️", t(lang, `Hari ${totalDays}: keputusan`, `Day ${totalDays}: results`), t(lang,
      prn ? "Menang kerusi DUN anda dan majoriti negeri untuk membentuk kerajaan negeri — atau pimpin pembangkang." : "Menang kerusi anda dan majoriti Parlimen untuk membentuk kerajaan — atau pimpin pembangkang.",
      prn ? "Win your DUN seat and a state majority to form the state government — or lead the opposition." : "Win your seat and a parliamentary majority to form government — or lead the opposition.")],
  ];

  return (
    <>
      <button type="button" onClick={() => setReopened(true)}
        className="absolute right-[172px] top-3 z-30 border px-3 py-2 text-[9px] font-black tracking-widest text-cyan shadow-xl"
        style={{ borderColor: "rgb(var(--cyan-rgb) / .5)", background: "rgb(var(--bg-rgb) / .9)", backdropFilter: "blur(12px)" }}>
        ? {t(lang, "PANDUAN", "GUIDE")} · {objectiveDone
          ? t(lang, "OBJEKTIF ✓", "OBJECTIVE ✓")
          : t(lang, `${homeSupport.toFixed(0)}%/60% H${day}/${objectiveDay}`, `${homeSupport.toFixed(0)}%/60% D${day}/${objectiveDay}`)}
      </button>
      {open && (
        // z above the 3D map's <Html> location labels (zIndexRange up to 100 in CityScene)
        <div className="absolute inset-0 z-[150] flex items-center justify-center p-4" style={{ background: "rgb(0 0 0 / .45)" }} onClick={close}>
          <section role="dialog" aria-modal="true" aria-labelledby="campaign-briefing-title" onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[720px] border p-5 shadow-2xl"
            style={{ borderColor: "rgb(var(--gold-rgb) / .55)", background: "rgb(var(--bg-rgb) / .95)", backdropFilter: "blur(14px)", fontFamily: "'Space Mono', monospace" }}>
            <div className="flex gap-3">
              <div className="relative hidden h-16 w-16 shrink-0 overflow-hidden border sm:block" style={{ borderColor: "rgb(var(--gold-rgb) / .55)" }}>
                <Image src="/personal-assistant.png" alt="Personal Assistant" fill sizes="64px" className="object-cover" />
              </div>
              <div>
                <div className="text-[9px] font-black tracking-[.22em] text-gold">
                  {t(lang, `HARI ${day}/${totalDays}`, `DAY ${day}/${totalDays}`)} · PERSONAL ASSISTANT
                </div>
                <h2 id="campaign-briefing-title" className="mt-1 text-base font-black text-white">
                  {t(lang, `Selamat datang ke kempen, ${leader.name || "YB"}`, `Welcome to the campaign, ${leader.name || "YB"}`)}
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                  {t(lang,
                    `Anda ada ${totalDays} hari untuk meraih sokongan ${prn ? "negeri" : "seluruh negara"} bersama ${leader.partyAbbr || leader.party}. Begini cara kempen berjalan:`,
                    `You have ${totalDays} days to win ${prn ? "the state" : "the country"} for ${leader.partyAbbr || leader.party}. Here is how the campaign works:`)}
                </p>
              </div>
            </div>
            <ol className="mt-4 grid gap-2 sm:grid-cols-2">
              {steps.map(([icon, title, detail], i) => (
                <li key={title} className={`border p-3 ${i === steps.length - 1 ? "sm:col-span-2" : ""}`} style={{ borderColor: "rgb(var(--cyan-rgb) / .22)", background: "rgb(var(--bg-rgb) / .5)" }}>
                  <div className="flex items-center gap-2 text-[11px] font-black text-white"><span className="text-base">{icon}</span><span className="text-cyan">0{i + 1}</span>{title}</div>
                  <p className="mt-1 text-[10px] leading-relaxed text-text-muted">{detail}</p>
                </li>
              ))}
            </ol>
            <p className="mt-3 border px-3 py-2 text-[10px] text-gold" style={{ borderColor: "rgb(var(--gold-rgb) / .35)", background: "rgb(var(--gold-rgb) / .06)" }}>
              {t(lang,
                "Objektif awal: capai 60% sokongan di negeri asal sebelum hari 10 untuk ganjaran RM75,000.",
                "Early objective: reach 60% support in your home state by day 10 for a RM75,000 reward.")}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <label className="mr-auto flex cursor-pointer items-center gap-2 text-[10px] text-text-muted">
                <input type="checkbox" checked={!showOnStart} onChange={(e) => setShowOnStart(!e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer" style={{ accentColor: "var(--gold)" }} />
                {t(lang, "Jangan tunjuk lagi pada permulaan kempen", "Don't show again when a campaign starts")}
              </label>
              <button type="button" onClick={() => { close(); router.push("/location/operations"); }}
                className="border px-4 py-2 text-[10px] font-black tracking-widest text-cyan"
                style={{ borderColor: "rgb(var(--cyan-rgb) / .5)", background: "rgb(var(--cyan-rgb) / .06)" }}>
                {t(lang, "BUKA PUSAT OPERASI", "OPEN OPERATIONS CENTRE")}
              </button>
              <button type="button" onClick={close} autoFocus
                className="border px-4 py-2 text-[10px] font-black tracking-widest text-gold"
                style={{ borderColor: "rgb(var(--gold-rgb) / .7)", background: "rgb(var(--gold-rgb) / .1)" }}>
                {day === 1 ? t(lang, "MULAKAN HARI 1", "START DAY 1") : t(lang, "TUTUP", "CLOSE")} →
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
