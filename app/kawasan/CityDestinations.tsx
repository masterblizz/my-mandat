"use client";

import { useRouter } from "next/navigation";
import { useGameStore } from "../store/gameStore";
import { resumeRoute } from "../store/journey";
import { useLang, t } from "../i18n/useLang";

type Destination = {
  id: string;
  icon: string;
  route: string;
  ms: { name: string; detail: string };
  en: { name: string; detail: string };
};

const campaignDestinations: Destination[] = [
  { id: "office", icon: "🏢", route: "/career", ms: { name: "Pejabat Peribadi", detail: "Taklimat karier, janji dan hubungan." }, en: { name: "Personal Office", detail: "Career briefing, pledges and relationships." } },
  { id: "party", icon: "🏛️", route: "/campaign", ms: { name: "Ibu Pejabat Parti", detail: "Calon, manifesto dan gerakan kempen." }, en: { name: "Party Headquarters", detail: "Candidates, manifesto and campaign movement." } },
  { id: "operations", icon: "🛰️", route: "/warroom", ms: { name: "Pusat Operasi", detail: "Susun operasi, hari kempen dan medan negeri." }, en: { name: "Operations Centre", detail: "Plan operations, campaign days and state battlefield." } },
  { id: "calendar", icon: "📅", route: "/calendar", ms: { name: "Bilik Jadual Kempen", detail: "Rancang masa, lawatan dan gerakan harian." }, en: { name: "Campaign Calendar", detail: "Plan time, visits and daily movement." } },
  { id: "media", icon: "📡", route: "/messaging", ms: { name: "Pusat Media", detail: "Kawal mesej dan respons awam." }, en: { name: "Media Centre", detail: "Manage messaging and public response." } },
  { id: "commission", icon: "🗳️", route: "/polling", ms: { name: "Suruhanjaya Pilihan Raya", detail: "Semak tinjauan dan momentum." }, en: { name: "Election Commission", detail: "Review polling and momentum." } },
];

const governmentDestinations: Destination[] = [
  { id: "office", icon: "🏢", route: "/career", ms: { name: "Pejabat Wakil Rakyat", detail: "Janji kawasan dan rekod perkhidmatan." }, en: { name: "Representative Office", detail: "Constituency pledges and service record." } },
  { id: "cabinet", icon: "🏛️", route: "/cabinet", ms: { name: "Bangunan Kabinet", detail: "Susun pasukan menteri dan portfolio." }, en: { name: "Cabinet Building", detail: "Organise ministers and portfolios." } },
  { id: "administration", icon: "⚖️", route: "/government", ms: { name: "Pusat Pentadbiran", detail: "Laksana dasar dan majukan penggal." }, en: { name: "Administration Centre", detail: "Deliver policies and advance the term." } },
  { id: "national", icon: "🗺️", route: "/sandbox", ms: { name: "Pusat Analisis Negara", detail: "Lihat kesan keputusan di seluruh negara." }, en: { name: "National Analysis Centre", detail: "See how decisions affect the whole country." } },
];

export default function CityDestinations() {
  const router = useRouter();
  const lang = useLang();
  const state = useGameStore();
  const chapter = state.journey.chapter;
  const destinations = chapter === "government"
    ? [...governmentDestinations, ...(state.careerProgress.month >= 60 ? [{ id: "report", icon: "📜", route: "/report-card", ms: { name: "Arkib Rekod Penggal", detail: "Nilai legasi dan laporan penggal anda." }, en: { name: "Term Record Archive", detail: "Review your legacy and term report." } }] : [])]
    : campaignDestinations;
  const chapterDestination = chapter === "campaign" ? null : {
    id: "continue", icon: chapter === "results" ? "📊" : chapter === "formation" ? "🤝" : "🧭",
    route: resumeRoute(state),
    ms: { name: chapter === "results" ? "Pusat Keputusan" : chapter === "formation" ? "Dewan Rundingan" : "Pusat Gerakan", detail: "Sambung bab politik semasa anda." },
    en: { name: chapter === "results" ? "Results Centre" : chapter === "formation" ? "Negotiation Hall" : "Movement Centre", detail: "Continue your current political chapter." },
  };
  const visible = chapterDestination ? [chapterDestination, ...destinations] : destinations;

  return (
    <section aria-label={t(lang, "Destinasi bandar", "City destinations")} className="mb-4 border p-3" style={{ borderColor: "rgb(var(--cyan-rgb) / .30)", background: "linear-gradient(135deg, rgb(var(--cyan-rgb) / .08), rgb(var(--bg-rgb) / .72))" }}>
      <div className="flex items-baseline justify-between gap-3"><div><div className="text-[10px] font-black tracking-[.2em] text-gold">{t(lang, "DESTINASI BANDAR", "CITY DESTINATIONS")}</div><p className="mt-1 text-[10px] text-text-muted">{t(lang, "Pilih bangunan di bandar untuk memulakan aktiviti politik anda.", "Choose a building in the city to begin a political activity.")}</p></div><span className="text-[9px] font-bold tracking-widest text-cyan">{t(lang, "HUB AKTIF", "ACTIVE HUB")}</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {visible.map((destination) => {
          const copy = destination[lang];
          return <button key={destination.id} onClick={() => router.push(`${destination.route}?from=city&place=${destination.id}`)} className="border p-3 text-left transition hover:-translate-y-0.5 hover:border-gold/60" style={{ borderColor: "rgb(var(--cyan-rgb) / .22)", background: "rgb(var(--bg-rgb) / .58)" }}>
            <span className="text-xl" aria-hidden="true">{destination.icon}</span><b className="mt-2 block text-[11px] text-white">{copy.name}</b><span className="mt-1 block text-[10px] leading-relaxed text-text-muted">{copy.detail}</span><span className="mt-2 block text-[9px] font-black tracking-widest text-cyan">{t(lang, "MASUK", "ENTER")} →</span>
          </button>;
        })}
      </div>
    </section>
  );
}
