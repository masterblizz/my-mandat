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

export default function ProfilePage() {
  const lang = useLang();
  const { leader, day, careerProgress, journey, settings, states } = useGameStore();
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

  return <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgb(var(--cyan-rgb)/.12),transparent_42%),var(--bg)] pb-20 pt-[64px]" style={{ fontFamily: "'Space Mono', monospace" }}>
    <Header />
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-5 border p-5" style={{ borderColor: rank.color, background: "rgb(var(--bg-rgb) / .78)", boxShadow: "0 0 38px rgb(var(--cyan-rgb) / .12)" }}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-full border text-2xl" style={{ borderColor: rank.color, color: rank.color, background: "rgb(var(--bg-rgb) / .9)" }}>◈</div><div><div className="text-[9px] font-black tracking-[.24em]" style={{ color: rank.color }}>PLAYER PROFILE · {planName}</div><h1 className="mt-1 text-xl font-black text-white">{operator ?? leader.name}</h1><p className="mt-1 text-[11px] text-text-muted">{t(lang, rank.titleMs, rank.titleEn)} · {leader.partyAbbr}</p></div></div>
          <div className="border px-4 py-3 text-right" style={{ borderColor: planColor, background: "rgb(var(--bg-rgb) / .55)" }}><div className="text-[8px] tracking-[.18em] text-text-muted">{t(lang, "PELANCANGAN AKAUN", "ACCOUNT PLAN")}</div><b className="mt-1 block text-sm tracking-widest" style={{ color: planColor }}>{isLoading ? "CHECKING" : planName}</b></div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_280px]"><div><div className="flex items-center justify-between text-[10px]"><span className="font-black tracking-widest" style={{ color: rank.color }}>{t(lang, rank.titleMs, rank.titleEn).toUpperCase()}</span><span className="text-text-muted">{xp} XP</span></div><div className="mt-2 h-2 overflow-hidden bg-bar-empty"><div className="h-full transition-all" style={{ width: `${progress}%`, background: rank.color }} /></div><p className="mt-2 text-[10px] text-text-muted">{next ? t(lang, `Lagi ${next.minXp - xp} XP untuk ${next.titleMs}.`, `${next.minXp - xp} XP to ${next.titleEn}.`) : t(lang, "Rank tertinggi dicapai.", "Highest rank achieved.")}</p></div><div className="grid grid-cols-2 gap-2"><div className="border p-3" style={{ borderColor: "rgb(var(--cyan-rgb) / .25)" }}><div className="text-[8px] text-text-muted">{t(lang, "MASA BERMAIN", "PLAY TIME")}</div><b className="mt-1 block text-sm text-cyan">{formatPlaytime(careerProgress.playedMinutes ?? 0)}</b></div><div className="border p-3" style={{ borderColor: "rgb(var(--gold-rgb) / .25)" }}><div className="text-[8px] text-text-muted">{t(lang, "PENGGAL", "TERMS")}</div><b className="mt-1 block text-sm text-gold">{careerProgress.term}</b></div></div></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><TacticalPanel title={t(lang, "REKOD KEMAJUAN", "PROGRESSION RECORD")}><div className="space-y-4"><StatBar label={t(lang, "Hari kempen", "Campaign days")} value={day} max={30} color="var(--cyan)" /><StatBar label={t(lang, "Objektif selesai", "Objectives complete")} value={careerProgress.completed.length} max={8} color="var(--gold)" /><StatBar label={t(lang, "Organisasi", "Organisation")} value={journey.organisation} max={100} color="var(--neon-green)" /><StatBar label={t(lang, "Kepercayaan", "Trust")} value={journey.trust} max={100} color="#a78bfa" /></div></TacticalPanel>
      <TacticalPanel title={t(lang, "AKSES PERMAINAN", "GAME ACCESS")}><div className="space-y-3 text-[11px] leading-relaxed text-text-muted"><div className="border p-3" style={{ borderColor: planColor }}><b className="text-white">{scope}</b><p className="mt-1">{hasPremium ? t(lang, "Premium membuka kempen PRU nasional dan semua pilihan PRN.", "Premium unlocks national PRU campaigns and every PRN selection.") : t(lang, "Akaun Free bermain satu kempen PRN pada kawasan/negeri pilihan sahaja.", "Free accounts play one PRN campaign in their chosen state/area only.")}</p></div><div className="border p-3" style={{ borderColor: "rgb(var(--cyan-rgb) / .24)" }}><b className="text-cyan">{hasUltimate ? "ULTIMATE ARCHIVE" : t(lang, "LALUAN SETERUSNYA", "NEXT PATH")}</b><p className="mt-1">{hasUltimate ? t(lang, "Semua senario eksklusif dan Arkib Senario tersedia.", "All exclusive scenarios and the Scenario Archive are available.") : t(lang, "Naik taraf untuk membuka PRU, tahap kesukaran lebih tinggi dan akses senario Ultimate.", "Upgrade to unlock PRU, higher difficulty and Ultimate scenario access.")}</p></div></div></TacticalPanel></div>
      <div className="mt-4"><TacticalPanel title={t(lang, "KELEBIHAN RANK", "RANK ABILITIES")}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{perks.features.map((feature, index) => <div key={feature.labelEn} className="border p-3" style={{ borderColor: index === perks.features.length - 1 ? rank.color : "rgb(var(--cyan-rgb) / .22)", background: "rgb(var(--bg-rgb) / .45)" }}><div className="flex items-center gap-2"><span className="text-lg" style={{ color: index === perks.features.length - 1 ? rank.color : "var(--cyan)" }}>{feature.icon}</span><b className="text-[10px] tracking-wider text-white">{t(lang, feature.labelMs, feature.labelEn)}</b></div><p className="mt-2 text-[10px] leading-relaxed text-text-muted">{t(lang, feature.descriptionMs, feature.descriptionEn)}</p></div>)}</div></TacticalPanel></div>
    </div>
    <StatusBar />
  </main>;
}
