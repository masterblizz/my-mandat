"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { buildTermReport, RATING_LABELS, type TermReportRecord } from "../data/termReport";
import { useLang, t } from "../i18n/useLang";
import { useGameStore } from "../store/gameStore";

const ratingColor = (rating: number) => rating >= 85 ? "var(--neon-green)" : rating >= 70 ? "var(--cyan)" : rating >= 55 ? "var(--gold)" : rating >= 40 ? "var(--warn-orange)" : "var(--neon-red)";

export default function ReportCardPage() {
  const lang = useLang();
  const router = useRouter();
  const game = useGameStore();
  const inTerm = ["government", "opposition", "rebuilding"].includes(game.journey.chapter);
  const liveReport = inTerm && game.careerProgress.month >= 60 ? buildTermReport(game) : null;
  const savedReports = game.journey.records.filter((record): record is TermReportRecord => typeof record.rating === "number");
  const report = liveReport ?? savedReports.at(-1) ?? null;

  if (!report) return <div className="min-h-screen bg-[var(--bg)]"><Header /><main className="mx-auto max-w-3xl px-4 pb-16 pt-16"><TacticalPanel title={t(lang, "LAPORAN PENGGAL", "TERM REPORT")}><h1 className="text-xl font-black text-gold">{t(lang, "Penggal belum selesai", "Term not complete")}</h1><p className="my-3 text-sm text-text-muted">{t(lang, "Laporan penuh dibuka pada bulan 60 selepas semua keputusan pentadbiran dinilai.", "The full report opens at month 60 after every governing decision has been assessed.")}</p><Link href="/career" className="text-cyan underline">{t(lang, "Kembali ke kerjaya →", "Return to career →")}</Link></TacticalPanel></main></div>;

  const color = ratingColor(report.rating);
  const ratingLabel = RATING_LABELS[report.ratingBand][lang];
  const previous = savedReports.filter(item => item.term < report.term);
  const previousAverage = previous.length ? Math.round(previous.reduce((sum, item) => sum + item.rating, 0) / previous.length) : null;
  const strongestBloc = [...report.voterBlocs].sort((a, b) => b.support - a.support)[0];
  const weakestBloc = [...report.voterBlocs].sort((a, b) => a.support - b.support)[0];
  const roleLabel = report.chapter === "government" ? t(lang, "Kerajaan", "Government") : report.chapter === "opposition" ? t(lang, "Pembangkang", "Opposition") : t(lang, "Pembinaan semula", "Rebuilding");

  function startNextElection() {
    game.journeyAction({ type: "next-election" });
    router.push("/warroom");
  }

  return <div className="min-h-screen bg-[var(--bg)]"><Header />
    <main className="mx-auto w-full max-w-7xl px-3 pb-16 pt-16 sm:px-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div><div className="text-[10px] font-black tracking-[0.28em] text-gold">◇ {t(lang, "ARKIB PRESTASI POLITIK", "POLITICAL PERFORMANCE ARCHIVE")}</div><h1 className="mt-2 text-2xl font-black tracking-widest text-white">{t(lang, `KAD LAPORAN PENGGAL ${report.term}`, `TERM ${report.term} REPORT CARD`)}</h1><p className="mt-1 text-sm text-text-muted">{report.scope.toUpperCase()} {report.stateId ? `· ${game.states.find(state => state.id === report.stateId)?.name ?? report.stateId}` : "· Malaysia"} · {roleLabel}</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/career" className="border border-cyan/40 bg-cyan/5 px-4 py-2 text-xs font-bold tracking-wider text-cyan">← {t(lang, "Kerjaya", "Career")}</Link>{liveReport && <button onClick={startNextElection} className="border border-gold/60 bg-gold/10 px-4 py-2 text-xs font-bold tracking-wider text-gold">{t(lang, "Mulakan pilihan raya seterusnya →", "Start next election →")}</button>}</div>
      </div>

      <section className="mb-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center border p-6 text-center" style={{ borderColor: `${color}88`, background: `${color}0d`, boxShadow: `0 0 28px ${color}16` }}><div className="text-[10px] font-black tracking-[0.25em] text-text-muted">{t(lang, "PENARAFAN SEJARAH", "HISTORICAL RATING")}</div><div className="mt-3 text-7xl font-black" style={{ color }}>{report.rating}</div><div className="mt-1 text-sm font-black uppercase tracking-wider" style={{ color }}>{ratingLabel}</div><div className="mt-3 text-xs text-text-muted">{previousAverage === null ? t(lang, "Tanda aras pertama kerjaya ini", "First benchmark of this career") : t(lang, `Purata terdahulu ${previousAverage} · ${report.rating >= previousAverage ? "meningkat" : "menurun"}`, `Previous average ${previousAverage} · ${report.rating >= previousAverage ? "improved" : "declined"}`)}</div></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [t(lang, "KERUSI", "SEATS"), `${report.seats}/${report.totalSeats}`, report.seats >= report.majorityTarget ? "var(--neon-green)" : "var(--gold)"],
            [t(lang, "UNDI POPULAR", "POPULAR VOTE"), `${report.popularVote}%`, "var(--cyan)"],
            [t(lang, "KEPERCAYAAN", "TRUST"), `${report.trust}%`, "var(--cyan)"],
            [t(lang, "JANJI SIAP", "DELIVERED"), `${report.delivered}/${report.totalPledges}`, "var(--gold)"],
            [t(lang, "KUALITI KABINET/EXCO", "CABINET/EXCO QUALITY"), `${report.cabinetQuality}%`, "var(--cyan)"],
            [t(lang, "KESTABILAN GABUNGAN", "COALITION STABILITY"), `${report.stability}%`, "var(--gold)"],
            [t(lang, "JENTERA", "ORGANISATION"), `${report.organisation}%`, "var(--neon-green)"],
            [t(lang, "AMBANG MAJORITI", "MAJORITY TARGET"), `${report.majorityTarget}`, "var(--text-primary)"],
          ].map(([label, value, metricColor]) => <div key={label} className="border border-cyan/20 bg-black/20 p-3"><div className="text-[9px] font-bold tracking-widest text-text-muted">{label}</div><div className="mt-2 text-2xl font-black" style={{ color: metricColor }}>{value}</div></div>)}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <TacticalPanel title={t(lang, "PENILAIAN STRATEGI", "STRATEGY ASSESSMENT")}>
          <div className="grid gap-3 sm:grid-cols-2"><div className="border border-neon-green/30 bg-neon-green/5 p-4"><div className="text-[9px] font-black tracking-[0.2em] text-neon-green">{t(lang, "STRATEGI TERBAIK", "BEST STRATEGY")}</div><p className="mt-2 text-sm leading-relaxed text-white">{report.bestStrategy[lang]}</p></div><div className="border border-neon-red/30 bg-neon-red/5 p-4"><div className="text-[9px] font-black tracking-[0.2em] text-neon-red">{t(lang, "KESILAPAN TERBESAR", "BIGGEST MISTAKE")}</div><p className="mt-2 text-sm leading-relaxed text-white">{report.biggestMistake[lang]}</p></div></div>
        </TacticalPanel>
        <TacticalPanel title={t(lang, "KEKUATAN WILAYAH", "REGIONAL STRENGTH")}>
          <div className="grid grid-cols-2 gap-3"><div className="border border-cyan/25 p-4"><div className="text-[9px] text-text-muted">{t(lang, "TERKUAT", "STRONGEST")}</div><div className="mt-2 text-lg font-black text-cyan">{report.strongestRegion[lang]}</div><div className="text-2xl font-black text-white">{report.strongestRegion.value}%</div></div><div className="border border-gold/25 p-4"><div className="text-[9px] text-text-muted">{t(lang, "PALING LEMAH", "WEAKEST")}</div><div className="mt-2 text-lg font-black text-gold">{report.weakestRegion[lang]}</div><div className="text-2xl font-black text-white">{report.weakestRegion.value}%</div></div></div>
        </TacticalPanel>
        <TacticalPanel title={t(lang, "SOKONGAN BLOK PENGUNDI", "VOTER BLOC SUPPORT")}>
          <div className="space-y-3">{report.voterBlocs.map(bloc => <div key={bloc.id}><div className="mb-1 flex justify-between text-[11px]"><span className="text-text-muted">{bloc.label[lang]}</span><b className={bloc.id === strongestBloc.id ? "text-neon-green" : bloc.id === weakestBloc.id ? "text-gold" : "text-white"}>{bloc.support}%</b></div><div className="h-2 bg-white/10"><div className="h-2 bg-cyan" style={{ width: `${bloc.support}%` }} /></div></div>)}</div>
        </TacticalPanel>
        <TacticalPanel title={t(lang, "KEPUTUSAN SEJARAH", "HISTORICAL VERDICT")}>
          <p className="text-sm leading-relaxed text-text-muted">{report.rating >= 85 ? t(lang, "Penggal ini menggabungkan mandat pilihan raya, keyakinan awam dan keupayaan pelaksanaan pada tahap yang jarang dicapai.", "This term combined electoral mandate, public confidence and delivery capacity at a rare level.") : report.rating >= 70 ? t(lang, "Rekod ini cukup kukuh untuk menjadi asas kempen seterusnya, tetapi kelemahan yang dikenal pasti masih boleh menghakis kelebihan.", "This record is strong enough to anchor the next campaign, though the identified weakness can still erode the advantage.") : report.rating >= 55 ? t(lang, "Pengundi melihat pencapaian nyata bersama kegagalan yang belum diselesaikan. Kempen seterusnya perlu memilih naratif dengan disiplin.", "Voters see real achievements alongside unresolved failures. The next campaign needs a disciplined narrative.") : t(lang, "Rekod ini meninggalkan parti dalam keadaan defensif. Pemulihan memerlukan perubahan strategi yang ketara.", "This record leaves the party on the defensive. Recovery requires a material strategic change.")}</p>
          <div className="mt-4 border-t border-white/10 pt-3 text-xs text-text-muted">{t(lang, `Blok terbaik: ${strongestBloc.label.ms} ${strongestBloc.support}% · Risiko: ${weakestBloc.label.ms} ${weakestBloc.support}%`, `Best bloc: ${strongestBloc.label.en} ${strongestBloc.support}% · Risk: ${weakestBloc.label.en} ${weakestBloc.support}%`)}</div>
        </TacticalPanel>
      </div>
    </main><StatusBar leftText={`${t(lang, "Laporan penggal", "Term report")} · ${report.rating}/100`} rightText={`${game.leader.partyAbbr} · ${ratingLabel}`} />
  </div>;
}
