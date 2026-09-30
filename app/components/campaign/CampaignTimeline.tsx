"use client";

import Link from "next/link";
import { getElectionFlowStatus } from "../../data/electionFlow";
import { t, type Lang } from "../../i18n/useLang";

type Phase = { id: "prepare" | "nomination" | "campaign" | "polling"; starts: number; ends: number; shortMs: string; shortEn: string; titleMs: string; titleEn: string; helpMs: string; helpEn: string; actionMs: string; actionEn: string; color: string };

const PHASES: Phase[] = [
  { id: "prepare", starts: 1, ends: 14, shortMs: "SEDIA", shortEn: "PREP", titleMs: "Persediaan & strategi awal", titleEn: "Preparation & early strategy", helpMs: "Susun calon, pilih negeri sasaran dan kuatkan jentera sebelum penamaan calon.", helpEn: "Place candidates, choose target states and strengthen your machine before nomination.", actionMs: "Rancang di pejabat / War Room", actionEn: "Plan in office / War Room", color: "var(--cyan)" },
  { id: "nomination", starts: 15, ends: 15, shortMs: "CALON", shortEn: "NOM.", titleMs: "Hari Penamaan Calon", titleEn: "Nomination Day", helpMs: "Sahkan calon sekarang. Calon yang belum dinamakan akan melemahkan kempen anda.", helpEn: "Confirm candidates now. Unnominated candidates will weaken your campaign.", actionMs: "Sahkan semua calon", actionEn: "Confirm all candidates", color: "var(--gold)" },
  { id: "campaign", starts: 16, ends: 29, shortMs: "KEMPEN", shortEn: "CAMPAIGN", titleMs: "Tempoh berkempen", titleEn: "Campaign period", helpMs: "Lancar ceramah, operasi akar umbi dan media. Urus tenaga serta dana setiap hari.", helpEn: "Launch rallies, grassroots operations and media. Manage energy and funds each day.", actionMs: "Jalankan operasi hari ini", actionEn: "Run today’s operations", color: "var(--neon-green)" },
  { id: "polling", starts: 30, ends: 30, shortMs: "UNDI", shortEn: "VOTE", titleMs: "Hari Mengundi", titleEn: "Polling Day", helpMs: "Pantau turnout dan gerakkan pengundi sebelum pusat mengundi ditutup.", helpEn: "Monitor turnout and mobilise voters before polls close.", actionMs: "Pantau turnout", actionEn: "Monitor turnout", color: "var(--neon-red)" },
];

function phaseForDay(day: number) {
  return PHASES.find((phase) => day >= phase.starts && day <= phase.ends) ?? PHASES[PHASES.length - 1];
}

/** A legible, action-led timeline for the dense 3D city HUD. */
export default function CampaignTimeline({ day, totalDays, lang, compact = false }: { day: number; totalDays: number; lang: Lang; compact?: boolean }) {
  const safeDay = Math.min(Math.max(day, 1), totalDays);
  const phase = phaseForDay(safeDay);
  const status = getElectionFlowStatus(safeDay, totalDays);
  const phaseDay = safeDay - phase.starts + 1;
  const phaseLength = phase.ends - phase.starts + 1;
  const phaseProgress = Math.round((phaseDay / phaseLength) * 100);
  const electionProgress = Math.round((safeDay / totalDays) * 100);
  const daysToPoll = Math.max(0, totalDays - safeDay);
  const nextTitle = lang === "ms" ? status.next.title : status.next.titleEN;
  const phaseTitle = lang === "ms" ? phase.titleMs : phase.titleEn;
  const phaseHelp = lang === "ms" ? phase.helpMs : phase.helpEn;
  const phaseAction = lang === "ms" ? phase.actionMs : phase.actionEn;
  const actionRoute = phase.id === "polling" ? "/warroom" : "/campaign";
  const actionLabel = phase.id === "prepare" || phase.id === "nomination"
    ? t(lang, "SUSUN CALON", "PLACE CANDIDATES")
    : phase.id === "campaign"
      ? t(lang, "BUKA OPERASI", "OPEN OPERATIONS")
      : t(lang, "BUKA WAR ROOM", "OPEN WAR ROOM");

  return <section aria-label={t(lang, "Jadual kempen", "Campaign schedule")} className={`border border-cyan/45 bg-[#020814]/95 shadow-xl ${compact ? "p-3" : "p-4"}`} style={{ fontFamily: "'Space Mono', monospace", backdropFilter: "blur(12px)", boxShadow: "0 14px 28px rgb(0 0 0 / .3), inset 0 0 20px rgb(var(--cyan-rgb) / .045)" }}>
    <div className="flex items-start justify-between gap-3"><div><div className="text-[8px] font-black tracking-[.22em] text-cyan">{t(lang, "JADUAL KEMPEN", "CAMPAIGN SCHEDULE")}</div><div className="mt-1 text-[11px] font-black tracking-wide text-white">{phaseTitle}</div></div><div className="shrink-0 border px-2 py-1 text-right" style={{ borderColor: `${phase.color}88`, background: "rgb(var(--bg-rgb) / .7)" }}><div className="text-[7px] font-black tracking-widest" style={{ color: phase.color }}>{t(lang, "HARI SEMASA", "CURRENT DAY")}</div><div className="mt-0.5 text-[12px] font-black text-white">{safeDay}<span className="text-[8px] text-text-muted"> / {totalDays}</span></div></div></div>
    <div className="mt-2.5 border-l-2 px-2.5 py-2" style={{ borderColor: phase.color, background: "rgb(var(--cyan-rgb) / .055)" }}><div className="flex items-center justify-between gap-2"><span className="text-[8px] font-black tracking-[.14em]" style={{ color: phase.color }}>{t(lang, "SEKARANG", "NOW")} · {lang === "ms" ? phase.shortMs : phase.shortEn}</span><span className="text-[8px] font-black text-gold">{t(lang, "FASA", "PHASE")} {phaseDay}/{phaseLength}</span></div><p className="mt-1 text-[9px] leading-relaxed text-text-muted">{phaseHelp}</p><div className="mt-1.5 text-[8px] font-black tracking-[.08em]" style={{ color: phase.color }}>→ {phaseAction}</div></div>
    <div className="mt-2.5"><div className="mb-1 flex items-center justify-between text-[7px] font-black tracking-[.1em] text-text-muted"><span>{t(lang, "PROGRES FASA", "PHASE PROGRESS")}</span><span style={{ color: phase.color }}>{phaseProgress}%</span></div><div className="h-1.5 overflow-hidden bg-white/10"><div className="h-full transition-all duration-500" style={{ width: `${phaseProgress}%`, background: phase.color, boxShadow: `0 0 10px ${phase.color}` }} /></div></div>
    <div className="mt-2.5 grid grid-cols-4 gap-1 border-t pt-2" style={{ borderColor: "rgb(var(--cyan-rgb) / .18)" }}>{PHASES.map((item) => { const active = item.id === phase.id; const done = safeDay > item.ends; return <div key={item.id} className="min-w-0 border px-1 py-1.5 text-center" style={{ borderColor: active ? `${item.color}99` : "rgb(var(--cyan-rgb) / .13)", background: active ? "rgb(var(--cyan-rgb) / .09)" : "transparent", opacity: done || active ? 1 : .58 }}><div className="text-[7px] font-black tracking-tight" style={{ color: active ? item.color : done ? "var(--gold)" : "var(--text-muted)" }}>{lang === "ms" ? item.shortMs : item.shortEn}</div><div className="mt-0.5 text-[6px] tracking-tight text-text-muted">{item.starts === item.ends ? `${t(lang, "H", "D")}${item.starts}` : `${t(lang, "H", "D")}${item.starts}–${item.ends}`}</div></div>; })}</div>
    <div className="mt-2 flex items-center justify-between gap-2 text-[8px]"><span className="text-text-muted">{daysToPoll > 0 ? t(lang, `${daysToPoll} hari ke hari mengundi`, `${daysToPoll} days to polling`) : t(lang, "Hari mengundi", "Polling day")}</span><span className="truncate text-right text-gold">{t(lang, "SETERUSNYA", "NEXT")}: {nextTitle}</span></div>
    <Link href={actionRoute} className="mt-2 flex min-h-8 items-center justify-center border text-[8px] font-black tracking-[.12em] transition hover:brightness-125" style={{ borderColor: `${phase.color}88`, color: phase.color, background: "rgb(var(--bg-rgb) / .6)" }}>→ {actionLabel}</Link>
    {!compact && <div className="mt-1 text-right text-[7px] text-text-muted">{t(lang, "Progres pilihan raya", "Election progress")} {electionProgress}%</div>}
  </section>;
}
