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
  const title = j.chapter === "government" ? t(lang, "TUNAIKAN MANDAT", "DELIVER YOUR MANDATE") : j.chapter === "opposition" ? t(lang, "BINA GERAKAN KEMBALI", "BUILD YOUR COMEBACK") : t(lang, "BINA SEMULA PARTI", "REBUILD THE PARTY");
  return <div className="min-h-screen bg-[var(--bg)]"><Header />{celebrate && <ConfettiCanvas colors={["#00e5ff", "#ffca28", "#ffffff"]} duration={2000} particleCount={60} />}<main className="mx-auto max-w-7xl px-4 pb-16 pt-16">
    {!term || (expected && expected !== j.chapter) ? <section className="border border-cyan/30 p-6"><h1 className="text-xl font-bold text-gold">{t(lang, "Ikuti bab semasa", "Continue your current chapter")}</h1><p className="my-3 text-text-muted">{t(lang, "Selesaikan pilihan raya dan sahkan peranan anda sebelum mengurus penggal.", "Complete the election and confirm your role before managing a term.")}</p><Link className="text-cyan underline" href={resumeRoute(s)}>{t(lang, "Teruskan →", "Continue →")}</Link></section> : <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><div className="text-xs tracking-widest text-gold">{s.settings.electionScope.toUpperCase()} {s.settings.electionScope === "prn" ? s.states.find(x => x.id === s.settings.prnStateId)?.name : ""} · {s.leader.partyAbbr}</div><h1 className="mt-2 text-2xl font-black text-white">{title}</h1><p className="mt-2 text-text-muted">{t(lang, `Penggal ${s.careerProgress.term} · Bulan ${s.careerProgress.month}/60`, `Term ${s.careerProgress.term} · Month ${s.careerProgress.month}/60`)}</p></div>
      <button className="border border-gold/60 bg-gold/10 px-5 py-3 font-bold text-gold hover:bg-gold/20" onClick={() => { if (s.careerProgress.month >= 60) router.push("/report-card"); else s.journeyAction({ type: "quarter" }); }}>{s.careerProgress.month >= 60 ? t(lang, "Buka kad laporan penggal →", "Open term report card →") : t(lang, "Majukan suku tahun →", "Advance quarter →")}</button></div>
      <div className="mb-4 h-2 bg-white/10"><div className="h-2 bg-[var(--gold)]" style={{ width: `${s.careerProgress.month / 60 * 100}%` }} /></div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="border border-gold/30 p-4"><div className="text-xs text-text-muted">{t(lang, "JANJI SIAP", "PROMISES DELIVERED")}</div><div className="mt-2 text-3xl font-bold text-gold">{delivered}/{j.pledges.length}</div></div>
        <div className="border border-cyan/30 p-4"><div className="text-xs text-text-muted">{j.chapter === "government" ? t(lang, "SOKONGAN DEWAN", "ASSEMBLY SUPPORT") : t(lang, "SASARAN JENTERA", "ORGANISATION TARGET")}</div><div className="mt-2 text-3xl font-bold text-cyan">{j.chapter === "government" ? `${governingSeats(s)}/${outcomeOf(s).majorityTarget}` : `${j.organisation}/65`}</div></div>
        <div className="border border-cyan/30 p-4"><div className="text-xs text-text-muted">{t(lang, "KEPERCAYAAN AWAM", "PUBLIC TRUST")}</div><div className="mt-2 text-3xl font-bold text-cyan">{j.trust}%</div></div>
      </div>
      <p className="mb-4 text-sm text-text-muted">{j.chapter === "government" ? t(lang, "Matlamat: siapkan janji, jaga gabungan dan pertahankan rekod. Projek memerlukan dua suku tahun; prestasi kabinet mempengaruhi kepercayaan.", "Objective: deliver commitments, maintain the coalition and defend your record. Projects take two quarters; cabinet performance affects trust.") : t(lang, "Matlamat: capai jentera 65 dan kepercayaan 60 sebelum pilihan raya. Bina cawangan, latih calon dan semak dasar kerajaan untuk memperkukuh sokongan.", "Objective: reach organisation 65 and trust 60 before the election. Build branches, train candidates and scrutinise government policy to strengthen support.")}</p>
      <JourneyPanel />
      {j.records.length > 0 && <section className="border border-gold/30 p-4"><h2 className="font-bold text-gold">{t(lang, "Legasi politik", "Political legacy")}</h2>{j.records.map(r => <p key={r.term} className="mt-2 text-sm text-text-muted">{t(lang, `Penggal ${r.term}: ${r.seats} kerusi · ${r.delivered} janji siap · kepercayaan ${r.trust}`, `Term ${r.term}: ${r.seats} seats · ${r.delivered} commitments delivered · trust ${r.trust}`)}</p>)}</section>}
      <Link className="mt-4 inline-block text-cyan underline" href="/sandbox">{t(lang, "Teroka simulasi negara", "Explore national simulation")}</Link>
    </>}
  </main></div>;
}
