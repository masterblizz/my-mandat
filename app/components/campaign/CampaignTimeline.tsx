"use client";

import { electionFlowSteps, getElectionFlowStatus } from "../../data/electionFlow";
import { t, type Lang } from "../../i18n/useLang";

export default function CampaignTimeline({ day, totalDays, lang, compact = false }: { day: number; totalDays: number; lang: Lang; compact?: boolean }) {
  const status = getElectionFlowStatus(day, totalDays);
  const currentLabel = lang === "ms" ? status.label : status.labelEN;
  const nextLabel = lang === "ms" ? status.next.title : status.next.titleEN;
  const steps = electionFlowSteps.filter((step) => ["dissolution", "nomination", "campaign", "polling", "government"].includes(step.id));

  return <section aria-label={t(lang, "Timeline kempen", "Campaign timeline")} className={`border border-cyan/35 bg-[#020814]/90 p-3 shadow-xl ${compact ? "" : ""}`} style={{ fontFamily: "'Space Mono', monospace", backdropFilter: "blur(12px)" }}>
    <div className="flex items-center justify-between gap-2"><b className="text-[8px] tracking-[.2em] text-cyan">{t(lang, "TIMELINE KEMPEN", "CAMPAIGN TIMELINE")}</b><span className="text-[8px] font-black text-gold">{currentLabel}</span></div>
    <div className="mt-2 flex gap-1">{steps.map((step) => { const active = step.id === status.current.id; const past = electionFlowSteps.findIndex((item) => item.id === step.id) < electionFlowSteps.findIndex((item) => item.id === status.current.id); return <div key={step.id} className="min-w-0 flex-1"><div className={`h-1.5 ${active ? "bg-cyan" : past ? "bg-gold" : "bg-white/15"}`} /><span className={`mt-1 block truncate text-[7px] font-black ${active ? "text-cyan" : past ? "text-gold" : "text-text-muted"}`}>{lang === "ms" ? step.title : step.titleEN}</span></div>; })}</div>
    {!compact && <p className="mt-2 text-[9px] leading-relaxed text-text-muted">{t(lang, "Seterusnya", "Next")}: <b className="text-white">{nextLabel}</b></p>}
  </section>;
}
