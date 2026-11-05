"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import StatBar from "../components/ui/StatBar";
import { useGameStore } from "../store/gameStore";
import { usePremiumStatus } from "../hooks/usePremiumStatus";
import { createClient } from "../utils/supabase/client";
import { formatPlaytime, getPlayerRank, getRankPerks, playerXp } from "../lib/playerRank";
import { useLang, t } from "../i18n/useLang";
import Fold from "../components/results/Fold";

export default function ProfilePage() {
  const lang = useLang();
  const { leader, day, totalDays, careerProgress, journey, settings, states } = useGameStore();
  const { hasPremium, hasUltimate, isLoading } = usePremiumStatus();
  const [operator, setOperator] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !active) return;
        const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
        if (active) setOperator(data?.username || user.user_metadata?.username || user.email?.split("@")[0] || null);
      } catch { /* The local game profile remains useful offline. */ }
    }
    loadProfile();
    return () => { active = false; };
  }, []);

  const xp = useMemo(() => playerXp({ playedMinutes: careerProgress.playedMinutes, day, term: careerProgress.term, completed: careerProgress.completed, journalEntries: journey.journal.length }), [careerProgress, day, journey.journal.length]);
  const { rank, next, progress } = getPlayerRank(xp);
  const perks = getRankPerks(xp);
  const prnState = states.find((state) => state.id === settings.prnStateId);
  const planName = hasUltimate ? "ULTIMATE" : hasPremium ? "PREMIUM" : "FREE";
  const planColor = hasUltimate ? "#a78bfa" : hasPremium ? "var(--gold)" : "var(--cyan)";
  const scope = settings.electionScope === "prn" ? `PRN · ${prnState?.name ?? settings.prnStateId}` : "PRU · MALAYSIA";

  return <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgb(var(--cyan-rgb)/.12),transparent_42%),var(--bg)] pb-20 pt-[52px]" style={{ fontFamily: "'Space Mono', monospace" }}>
    <Header />
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:py-6">
      <div className="mb-4 border p-4 sm:p-5" style={{ borderColor: rank.color, background: "rgb(var(--bg-rgb) / .78)", boxShadow: "0 0 38px rgb(var(--cyan-rgb) / .12)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border text-2xl" style={{ borderColor: rank.color, color: rank.color, background: "rgb(var(--bg-rgb) / .9)" }}>◈</div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black text-white">{operator ?? leader.name}</h1>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-black tracking-widest">
                <span className="rounded-full border px-2.5 py-0.5" style={{ borderColor: rank.color, color: rank.color }}>{t(lang, rank.titleMs, rank.titleEn).toUpperCase()}</span>
                <span className="rounded-full border px-2.5 py-0.5" style={{ borderColor: planColor, color: planColor }}>⭐ {isLoading ? t(lang, "MENYEMAK", "CHECKING") : planName}</span>
                <span className="rounded-full border px-2.5 py-0.5 text-cyan" style={{ borderColor: "rgb(var(--cyan-rgb) / .35)" }}>{leader.partyAbbr}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 text-center">
            <div className="min-w-[84px] border px-3 py-2" style={{ borderColor: "rgb(var(--cyan-rgb) / .25)" }}><div className="text-[15px]" aria-hidden>⏱</div><b className="block text-sm text-cyan">{formatPlaytime(careerProgress.playedMinutes ?? 0)}</b></div>
            <div className="min-w-[84px] border px-3 py-2" style={{ borderColor: "rgb(var(--gold-rgb) / .25)" }}><div className="text-[15px]" aria-hidden>🏛</div><b className="block text-sm text-gold">{t(lang, `PENGGAL ${careerProgress.term}`, `TERM ${careerProgress.term}`)}</b></div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px]"><span className="font-black tracking-widest" style={{ color: rank.color }}>⚡ {xp} XP</span><span className="text-text-muted">{next ? `→ ${t(lang, next.titleMs, next.titleEn)} · ${next.minXp - xp} XP` : t(lang, "🏆 RANK TERTINGGI", "🏆 TOP RANK")}</span></div>
          <div className="mt-1.5 h-2 overflow-hidden bg-bar-empty"><div className="h-full transition-all" style={{ width: `${progress}%`, background: rank.color }} /></div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[1.1fr_.9fr]">
        <TacticalPanel title={`📈 ${t(lang, "KEMAJUAN", "PROGRESS")}`}><div className="space-y-3"><StatBar label={`📅 ${t(lang, "Hari kempen", "Campaign days")}`} value={day} max={totalDays} color="var(--cyan)" /><StatBar label={`🎯 ${t(lang, "Objektif", "Objectives")}`} value={careerProgress.completed.length} max={8} color="var(--gold)" /><StatBar label={`🏗 ${t(lang, "Organisasi", "Organisation")}`} value={journey.organisation} max={100} color="var(--neon-green)" /><StatBar label={`🤝 ${t(lang, "Kepercayaan", "Trust")}`} value={journey.trust} max={100} color="#a78bfa" /></div></TacticalPanel>
        <TacticalPanel title={`🔑 ${t(lang, "AKSES", "ACCESS")}`}>
          <div className="space-y-2 text-[11px]">
            <div className="flex flex-wrap gap-1.5 font-black tracking-widest">
              <span className="rounded-full border px-2.5 py-1 text-white" style={{ borderColor: planColor }}>🗺️ {scope}</span>
              <span className="rounded-full border px-2.5 py-1" style={{ borderColor: hasPremium ? "rgb(0 255 136 / .4)" : "rgba(255,255,255,.15)", color: hasPremium ? "var(--neon-green)" : "var(--text-muted)" }}>{hasPremium ? "✓ PRN" : "🔒 PRN (PERLIS ✓)"}</span>
              <span className="rounded-full border px-2.5 py-1" style={{ borderColor: hasUltimate ? "rgb(167 139 250 / .6)" : "rgba(255,255,255,.15)", color: hasUltimate ? "#a78bfa" : "var(--text-muted)" }}>{hasUltimate ? "✓" : "🔒"} {t(lang, "ARKIB SENARIO", "SCENARIO ARCHIVE")}</span>
            </div>
            <Fold className="text-text-muted" summaryClassName="text-[10px]" summary={<>ⓘ {t(lang, "BUTIRAN PELAN", "PLAN DETAILS")}</>}>
              <p className="mt-1 leading-relaxed">{hasPremium ? t(lang, "Premium membuka kempen PRN di semua negeri, selain PRU nasional.", "Premium unlocks PRN campaigns in every state, on top of the national PRU.") : t(lang, "Akaun percuma bermain PRU nasional dan PRN Perlis. PRN negeri lain dibuka dengan Premium.", "Free accounts play the national PRU and the Perlis PRN. Other states' PRN unlocks with Premium.")}</p>
              <p className="mt-1 leading-relaxed">{hasUltimate ? t(lang, "Semua senario eksklusif dan Arkib Senario tersedia.", "All exclusive scenarios and the Scenario Archive are available.") : t(lang, "Naik taraf untuk membuka PRN, tahap kesukaran lebih tinggi dan akses senario Ultimate.", "Upgrade to unlock PRN, higher difficulty and Ultimate scenario access.")}</p>
            </Fold>
          </div>
        </TacticalPanel>
      </div>
      <div className="mt-4"><TacticalPanel title={`🎖 ${t(lang, "KELEBIHAN RANK", "RANK ABILITIES")}`}>
        <div className="flex flex-wrap gap-2">{perks.features.map((feature, index) => <span key={feature.labelEn} title={t(lang, feature.descriptionMs, feature.descriptionEn)} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: index === perks.features.length - 1 ? rank.color : "rgb(var(--cyan-rgb) / .22)", background: "rgb(var(--bg-rgb) / .45)" }}><span className="text-base" style={{ color: index === perks.features.length - 1 ? rank.color : "var(--cyan)" }}>{feature.icon}</span><b className="text-[10px] tracking-wider text-white">{t(lang, feature.labelMs, feature.labelEn)}</b></span>)}</div>
        <Fold className="mt-2 text-[10px] text-text-muted" summaryClassName="text-[10px]" summary={<>ⓘ {t(lang, "APA ITU?", "WHAT DO THEY DO?")}</>}>
          <ul className="mt-1 space-y-1 leading-relaxed">{perks.features.map((feature) => <li key={feature.labelEn}><span aria-hidden>{feature.icon}</span> <b className="text-white">{t(lang, feature.labelMs, feature.labelEn)}</b> — {t(lang, feature.descriptionMs, feature.descriptionEn)}</li>)}</ul>
        </Fold>
      </TacticalPanel></div>
    </div>
    <StatusBar />
  </main>;
}
