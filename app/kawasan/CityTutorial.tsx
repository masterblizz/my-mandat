"use client";

// New-game walkthrough on /kawasan, after the map → city fly-in:
//   1. a short story intro from the personal assistant (who you are now,
//      your kawasan in real census figures, what the job is), then
//   2. a guided tour that spotlights the real HUD pieces one by one.
// Progress is part of the save (journey.cityTutorial: story → tour → done),
// so it plays once per new game; older saves skip it (normalizeJourney).

import Image from "next/image";
import { useEffect, useLayoutEffect, useState } from "react";
import { t, type Lang } from "../i18n/useLang";
import { formatNumber } from "../utils/format";

type Bi = { ms: string; en: string };

export type StoryFacts = {
  leaderName: string;
  partyAbbr: string;
  partyColor: string;
  seatCode: string;
  seatName: string;
  stateName: string;
  population: number;
  households: number | null;
  density: number;
  areaKm2: number;
  budget: number;
  quarters: number;
  assistantSrc: string;
};

const box = { background: "rgb(var(--bg-rgb) / .94)", backdropFilter: "blur(14px)", fontFamily: "'Space Mono', monospace" } as const;

export function StoryIntro({ lang, facts, onTour, onSkip }: { lang: Lang; facts: StoryFacts; onTour: () => void; onSkip: () => void }) {
  const [slide, setSlide] = useState(0);
  const f = facts;
  const slides: { kicker: Bi; title: Bi; body: React.ReactNode }[] = [
    {
      kicker: { ms: "HARI PERTAMA", en: "DAY ONE" },
      title: { ms: `Selamat datang, YB ${f.leaderName}`, en: `Welcome, YB ${f.leaderName}` },
      body: (
        <p className="text-[12px] leading-relaxed text-text-muted">
          {t(lang,
            `Rakyat ${f.seatCode} ${f.seatName}, ${f.stateName} telah memberi mandat kepada anda bersama ${f.partyAbbr}. Anda ada ${f.quarters} suku tahun (lima tahun) untuk membuktikan janji sebelum pilihan raya seterusnya.`,
            `The people of ${f.seatCode} ${f.seatName}, ${f.stateName} have given you and ${f.partyAbbr} their mandate. You have ${f.quarters} quarters (five years) to deliver before the next election.`)}
        </p>
      ),
    },
    {
      kicker: { ms: "KAWASAN ANDA", en: "YOUR KAWASAN" },
      title: { ms: `${f.seatName} dalam angka`, en: `${f.seatName} in numbers` },
      body: (
        <>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: "👥", label: { ms: "Penduduk", en: "Residents" }, value: formatNumber(f.population) },
              { icon: "🏠", label: { ms: "Isi rumah", en: "Households" }, value: f.households ? formatNumber(f.households) : "—" },
              { icon: "📍", label: { ms: "Ketumpatan", en: "Density" }, value: `${formatNumber(f.density)}/km²` },
              { icon: "🗺️", label: { ms: "Keluasan", en: "Area" }, value: `${formatNumber(Math.round(f.areaKm2))} km²` },
            ].map((row) => (
              <div key={row.label.en} className="border px-2 py-1.5" style={{ borderColor: "rgb(var(--cyan-rgb) / .25)" }}>
                <div className="text-[9px] tracking-widest text-text-muted">{row.icon} {t(lang, row.label.ms, row.label.en).toUpperCase()}</div>
                <div className="text-[14px] font-black text-white">{row.value}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
            {t(lang,
              "Setiap rumah dalam bandar 3D mewakili satu isi rumah sebenar (Banci 2020, DOSM).",
              "Every home in the 3D city stands for one real household (2020 census, DOSM).")}
          </p>
        </>
      ),
    },
    {
      kicker: { ms: "TUGAS ANDA", en: "YOUR JOB" },
      title: { ms: "Apa yang rakyat harapkan", en: "What residents expect" },
      body: (
        <ul className="space-y-1.5 text-[11.5px] leading-snug text-text-muted">
          <li>❗ {t(lang, "Selesaikan aduan penduduk sebelum tamat tempoh.", "Resolve residents' complaints before they expire.")}</li>
          <li>🏗 {t(lang, "Bina kemudahan di zon yang paling memerlukan.", "Build facilities where zones need them most.")}</li>
          <li>💰 {t(lang, `Urus bajet awam (RM ${formatNumber(f.budget)}); geran masuk setiap suku.`, `Manage the public budget (RM ${formatNumber(f.budget)}); grants arrive every quarter.`)}</li>
          <li>🗳️ {t(lang, "Jaga sentimen dan sokongan untuk pilihan raya seterusnya.", "Keep sentiment and support up for the next election.")}</li>
        </ul>
      ),
    },
  ];
  const last = slide === slides.length - 1;
  const s = slides[slide];
  return (
    <div className="city-story fixed inset-0 z-[190] flex items-end justify-center p-3 sm:items-center" style={{ background: "rgb(4 10 20 / .55)" }} role="dialog" aria-modal="true" aria-label={t(lang, "Pengenalan", "Introduction")}>
      <section className="w-full max-w-[560px] border p-4 shadow-2xl" style={{ ...box, borderColor: "rgb(var(--gold-rgb) / .55)" }}>
        <div className="flex gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden border" style={{ borderColor: "rgb(var(--gold-rgb) / .55)" }}>
            <Image src={f.assistantSrc} alt={t(lang, "Pembantu peribadi", "Personal assistant")} fill sizes="64px" className="object-cover object-[center_36%]" priority />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black tracking-[.22em] text-gold">{t(lang, s.kicker.ms, s.kicker.en)} · {t(lang, "PEMBANTU PERIBADI", "PERSONAL ASSISTANT")}</div>
            <h2 className="mt-1 text-[15px] font-black leading-tight text-white">{t(lang, s.title.ms, s.title.en)}</h2>
          </div>
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: f.partyColor }} aria-hidden />
        </div>
        <div className="mt-3">{s.body}</div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex gap-1" aria-hidden>
            {slides.map((_, i) => <span key={i} className="h-1.5 w-5" style={{ background: i <= slide ? "var(--gold)" : "rgb(255 255 255 / .18)" }} />)}
          </div>
          <button type="button" onClick={onSkip} className="ml-auto px-2 py-2 text-[10px] font-black tracking-widest text-text-muted hover:text-white">
            {t(lang, "LANGKAU", "SKIP")}
          </button>
          {slide > 0 && (
            <button type="button" onClick={() => setSlide(slide - 1)} className="border px-3 py-2 text-[10px] font-black tracking-widest text-text-muted" style={{ borderColor: "rgb(var(--cyan-rgb) / .35)" }}>◀</button>
          )}
          {last ? (
            <button type="button" onClick={onTour} className="border px-4 py-2 text-[10px] font-black tracking-widest" style={{ borderColor: "rgb(var(--gold-rgb) / .8)", color: "var(--bg)", background: "var(--gold)" }}>
              {t(lang, "TUNJUKKAN SAYA →", "SHOW ME AROUND →")}
            </button>
          ) : (
            <button type="button" onClick={() => setSlide(slide + 1)} className="border px-4 py-2 text-[10px] font-black tracking-widest" style={{ borderColor: "rgb(var(--gold-rgb) / .7)", color: "var(--gold)" }}>
              {t(lang, "SETERUSNYA →", "NEXT →")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

type TourStep = { target: string | null; title: Bi; body: Bi };

const TOUR: TourStep[] = [
  { target: null,
    title: { ms: "Ini bandar anda", en: "This is your city" },
    body: { ms: "Seret dengan satu jari untuk bergerak, cubit untuk zum, pusing dua jari untuk memutar. Ketik mana-mana zon untuk memilihnya.", en: "Drag with one finger to move, pinch to zoom, twist two fingers to turn. Tap any zone to select it." } },
  { target: ".nhud-seat",
    title: { ms: "Kad kawasan", en: "Seat card" },
    body: { ms: "Sentimen keseluruhan, ketumpatan penduduk dan apa yang wujud dalam bandar: rumah, kedai, industri, jambatan.", en: "Overall sentiment, population density and what the city holds: homes, shops, industry, bridges." } },
  { target: ".nhud-top__band",
    title: { ms: "Sentimen ikut zon", en: "Sentiment by zone" },
    body: { ms: "Perumahan, niaga dan industri: purata sentimen setiap jenis zon. Bar yang rendah ialah tempat untuk bertindak.", en: "Housing, commerce and industry: the average sentiment of each zone type. A low bar is where to act." } },
  { target: ".city-zone-card",
    title: { ms: "Zon dipilih", en: "Selected zone" },
    body: { ms: "Terima aduan penduduk di sini, masuk ke pejabat, atau tekan BINA untuk projek di zon ini.", en: "Take residents' complaints here, enter the office, or press BUILD for a project in this zone." } },
  { target: "[data-tour=\"agenda\"]",
    title: { ms: "Agenda mingguan", en: "Weekly agenda" },
    body: { ms: "Setiap minggu anda ada 3 slot dan tenaga terhad: turun padang, sesi khidmat, kenduri, ceramah. ❗ ialah aduan terbuka.", en: "Each week you get 3 slots and limited stamina: ground visits, service sessions, events, talks. ❗ marks open complaints." } },
  { target: "[data-tour=\"build\"]",
    title: { ms: "Bina kemudahan", en: "Build facilities" },
    body: { ms: "Klinik, sekolah, saliran, pasar… Setiap projek menaikkan statistik zon dan dibayar daripada bajet awam.", en: "Clinics, schools, drainage, markets… Each project lifts a zone's stats and is paid from the public budget." } },
  { target: "[data-tour=\"budget\"]",
    title: { ms: "Bajet awam", en: "Public budget" },
    body: { ms: "Wang untuk projek. Geran dan cukai masuk setiap suku; kemudahan yang dibina ada kos senggaraan.", en: "Money for projects. Grants and taxes arrive each quarter; built facilities cost upkeep." } },
  { target: ".city-hub-bar",
    title: { ms: "Hub bandar", en: "City hub" },
    body: { ms: "Pejabat, media, pentadbiran dan negara: tempat untuk mesyuarat, kenyataan dan urusan di luar kawasan.", en: "Office, media, administration and nation: where meetings, statements and business beyond the seat happen." } },
  { target: ".nhud-minimap",
    title: { ms: "Peta mini", en: "Mini-map" },
    body: { ms: "Ketik mana-mana tempat pada peta untuk terus ke sana. Butang + / − untuk zum.", en: "Tap anywhere on the map to jump there. The + / − buttons zoom." } },
  { target: ".term-clock",
    title: { ms: "Masa penggal", en: "Term clock" },
    body: { ms: "▶ memulakan masa. H / M / B / S memilih kelajuan (hari, minggu, bulan, suku). Dewan bersidang pada masa tertentu.", en: "▶ starts time. D / W / M / Q pick the speed (day, week, month, quarter). The Dewan sits at set times." } },
  { target: ".city-next-goal",
    title: { ms: "Apa seterusnya?", en: "What next?" },
    body: { ms: "Cadangan ini sentiasa menunjukkan langkah terbaik seterusnya. Ketik untuk melakukannya. Selamat berkhidmat, YB!", en: "This suggestion always shows the best next step. Tap it to do it. Good luck, YB!" } },
];

/** Spotlight tour over the real HUD; steps whose element isn't on screen are skipped. */
export function HudTour({ lang, onDone }: { lang: Lang; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const visible = (sel: string | null) => {
    if (!sel) return true;
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== "hidden" && Number(getComputedStyle(el).opacity) > 0.05;
  };
  // land on the next step whose element is showing
  const go = (from: number, dir: 1 | -1) => {
    let k = from;
    while (k >= 0 && k < TOUR.length && !visible(TOUR[k].target)) k += dir;
    if (k >= TOUR.length) { onDone(); return; }
    setI(Math.max(0, k));
  };
  useEffect(() => { go(0, 1); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const step = TOUR[i];
  useLayoutEffect(() => {
    const measure = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      const el = step.target ? document.querySelector(step.target) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    // measured when the step changes (and once more as panels finish
    // sliding in), not continuously, so the card holds still under a finger
    measure();
    const timers = [window.setTimeout(measure, 350), window.setTimeout(measure, 900)];
    window.addEventListener("resize", measure);
    return () => { timers.forEach((id) => window.clearTimeout(id)); window.removeEventListener("resize", measure); };
  }, [step.target]);
  const pad = 6;
  const hole = rect ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  // the card sits below the spotlight when there's room, else above; centred with no target
  const cardW = Math.min(340, vw - 24);
  let cardStyle: React.CSSProperties = { left: (vw - cardW) / 2, top: Math.max(12, vh / 2 - 90), width: cardW };
  if (hole) {
    const below = hole.top + hole.height + 10;
    const left = Math.min(Math.max(12, hole.left + hole.width / 2 - cardW / 2), vw - cardW - 12);
    cardStyle = below + 170 < vh ? { left, top: below, width: cardW } : { left, bottom: Math.max(12, vh - hole.top + 10), width: cardW };
  }
  const count = TOUR.length;
  return (
    <div className="city-tour fixed inset-0 z-[195]" role="dialog" aria-modal="true" aria-label={t(lang, "Tutorial", "Tutorial")}>
      {hole ? (
        <div className="pointer-events-none fixed border-2 transition-all duration-300"
          style={{ ...hole, borderColor: "var(--gold)", borderRadius: 12, boxShadow: "0 0 0 9999px rgb(4 10 20 / .62), 0 0 22px rgb(var(--gold-rgb) / .55)" }} />
      ) : (
        <div className="pointer-events-none fixed inset-0" style={{ background: "rgb(4 10 20 / .35)" }} />
      )}
      <section className="fixed border p-3 shadow-2xl" style={{ ...box, ...cardStyle, borderColor: "rgb(var(--gold-rgb) / .6)" }}>
        <div className="text-[9px] font-black tracking-[.22em] text-gold">{t(lang, "TUTORIAL", "TUTORIAL")} · {i + 1}/{count}</div>
        <h3 className="mt-1 text-[14px] font-black text-white">{t(lang, step.title.ms, step.title.en)}</h3>
        <p className="mt-1 text-[11.5px] leading-snug text-text-muted">{t(lang, step.body.ms, step.body.en)}</p>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={onDone} className="px-1 py-1.5 text-[10px] font-black tracking-widest text-text-muted hover:text-white">
            {t(lang, "LANGKAU", "SKIP")}
          </button>
          {i > 0 && (
            <button type="button" onClick={() => go(i - 1, -1)} className="ml-auto border px-3 py-1.5 text-[10px] font-black tracking-widest text-text-muted" style={{ borderColor: "rgb(var(--cyan-rgb) / .35)" }}>◀</button>
          )}
          <button type="button" onClick={() => (i >= count - 1 ? onDone() : go(i + 1, 1))}
            className={`${i > 0 ? "" : "ml-auto "}border px-4 py-1.5 text-[10px] font-black tracking-widest`}
            style={{ borderColor: "rgb(var(--gold-rgb) / .8)", color: "var(--bg)", background: "var(--gold)" }}>
            {i >= count - 1 ? t(lang, "MULA BERKHIDMAT", "START SERVING") : t(lang, "SETERUSNYA →", "NEXT →")}
          </button>
        </div>
      </section>
    </div>
  );
}
