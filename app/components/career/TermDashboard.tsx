"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../layout/Header";
import JourneyPanel from "./JourneyPanel";
import ConfettiCanvas from "../ui/ConfettiCanvas";
import { useGameStore } from "../../store/gameStore";
import { useLang, t } from "../../i18n/useLang";
import { governingSeats, outcomeOf, resumeRoute, type Chapter } from "../../store/journey";
import { HudButton, InfoFold, NumTile, PageHead, StatChip } from "../formation/Hud";

export default function TermDashboard({ expected }: { expected?: Chapter }) {
  const s = useGameStore();
  const router = useRouter();
  const lang = useLang();
  const j = s.journey;
  const delivered = j.pledges.filter(p => p.status === "delivered").length;
  const previousDelivered = useRef(delivered);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (delivered > previousDelivered.current) setCelebrate(true);
    previousDelivered.current = delivered;
    const timer = window.setTimeout(() => setCelebrate(false), 2200);
    return () => window.clearTimeout(timer);
  }, [delivered]);
  const term = ["government", "opposition", "rebuilding"].includes(j.chapter);
  const title = j.chapter === "government" ? t(lang, "TUNAIKAN MANDAT", "DELIVER YOUR MANDATE") : j.chapter === "opposition" ? t(lang, "BINA GERAKAN KEMBALI", "BUILD YOUR COMEBACK") : j.rank ? t(lang, `REBUT SEMULA ${s.leader.homeConstituencyName.toUpperCase()}`, `WIN BACK ${s.leader.homeConstituencyName.toUpperCase()}`) : t(lang, "BINA SEMULA PARTI", "REBUILD THE PARTY");
  return <div className="min-h-screen bg-[var(--bg)]"><Header />{celebrate && <ConfettiCanvas colors={["#00e5ff", "#ffca28", "#ffffff"]} duration={2000} particleCount={60} />}<main className="mx-auto max-w-7xl px-4 pb-16 pt-16">
    {!term || (expected && expected !== j.chapter) ? <section className="border border-cyan/30 p-5 text-center"><h1 className="text-xl font-bold text-gold">🧭 {t(lang, "Ikuti bab semasa", "Continue your current chapter")}</h1><Link className="mt-4 inline-flex min-h-[40px] items-center border border-cyan/40 bg-cyan/5 px-5 font-black tracking-widest text-cyan" href={resumeRoute(s)}>{t(lang, "TERUSKAN →", "CONTINUE →")}</Link></section> : <>
      <PageHead
        title={title}
        chips={<>
          <StatChip icon="🗳️">{s.settings.electionScope.toUpperCase()}{s.settings.electionScope === "prn" ? ` ${s.states.find(x => x.id === s.settings.prnStateId)?.name ?? ""}` : ""}</StatChip>
          <StatChip icon="🏳️" color="var(--cyan)">{s.leader.partyAbbr}</StatChip>
          <StatChip icon="📅" color="var(--cyan)">{t(lang, `P${s.careerProgress.term} · ${s.careerProgress.month}/60`, `T${s.careerProgress.term} · ${s.careerProgress.month}/60`)}</StatChip>
        </>}
        actions={<HudButton tone="gold" onClick={() => { if (s.careerProgress.month >= 60) router.push("/report-card"); else s.journeyAction({ type: "quarter" }); }}>{s.careerProgress.month >= 60 ? `📋 ${t(lang, "KAD LAPORAN", "REPORT CARD")} →` : `⏩ ${t(lang, "SUKU SETERUSNYA", "NEXT QUARTER")}`}</HudButton>}
      />
      <div className="mb-3 h-2 bg-white/10"><div className="h-2 bg-[var(--gold)]" style={{ width: `${s.careerProgress.month / 60 * 100}%` }} /></div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <NumTile icon="✅" label={t(lang, "JANJI SIAP", "DELIVERED")} value={`${delivered}/${j.pledges.length}`} color="var(--gold)" />
        <NumTile icon={j.chapter === "government" ? "🏛️" : "⚙️"} label={j.chapter === "government" ? t(lang, "SOKONGAN DEWAN", "ASSEMBLY") : t(lang, "JENTERA", "ORGANISATION")} value={j.chapter === "government" ? `${governingSeats(s)}/${outcomeOf(s).majorityTarget}` : `${j.organisation}/65`} />
        <NumTile icon="🤝" label={t(lang, "KEPERCAYAAN", "TRUST")} value={`${j.trust}%`} />
      </div>
      <div className="mb-3"><InfoFold label={t(lang, "Matlamat", "Objective")}>{j.chapter === "government" ? t(lang, "Siapkan janji, jaga gabungan dan pertahankan rekod. Projek memerlukan dua suku tahun; prestasi kabinet mempengaruhi kepercayaan.", "Deliver commitments, maintain the coalition and defend your record. Projects take two quarters; cabinet performance affects trust.") : t(lang, "Capai jentera 65 dan kepercayaan 60 sebelum pilihan raya. Bina cawangan, latih calon dan semak dasar kerajaan.", "Reach organisation 65 and trust 60 before the election. Build branches, train candidates and scrutinise government policy.")}</InfoFold></div>
      <JourneyPanel />
      {j.records.length > 0 && <section className="border border-gold/30 p-4"><h2 className="font-bold text-gold">🏅 {t(lang, "Legasi politik", "Political legacy")}</h2>{j.records.map(r => <p key={r.term} className="mt-2 text-sm text-text-muted">{t(lang, `Penggal ${r.term}`, `Term ${r.term}`)}: 🪑 {r.seats} · ✅ {r.delivered} · 🤝 {r.trust}</p>)}</section>}
      <Link className="mt-4 inline-flex min-h-[40px] items-center text-cyan underline" href="/sandbox">🌐 {s.settings.electionScope === "prn" ? t(lang, `Simulasi negeri · ${s.states.find(x => x.id === s.settings.prnStateId)?.name ?? ""}`, `State simulation · ${s.states.find(x => x.id === s.settings.prnStateId)?.name ?? ""}`) : t(lang, "Simulasi negara", "National simulation")}</Link>
    </>}
  </main></div>;
}
