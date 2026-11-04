"use client";

// "What should I do now?" — one tappable suggestion over the city, so a
// new YB is never left staring at the map. /kawasan picks the goal from
// the live state (term clock, open complaints, affordable projects,
// weekly slots) and passes the action that carries it out.

import { t, type Lang } from "../i18n/useLang";

export type NextGoalItem = { key: string; icon: string; text: string; run: () => void };

export default function NextGoal({ lang, goal }: { lang: Lang; goal: NextGoalItem | null }) {
  if (!goal) return null;
  return (
    <button
      key={goal.key}
      type="button"
      onClick={goal.run}
      className="city-next-goal city-hud-box absolute left-1/2 top-12 z-30 flex max-w-[min(440px,calc(100%-180px))] -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-left shadow-xl transition active:scale-95"
      style={{
        borderColor: "rgb(var(--gold-rgb) / .75)",
        background: "linear-gradient(90deg, rgb(var(--gold-rgb) / .22), rgb(var(--bg-rgb) / .92))",
        backdropFilter: "blur(12px)",
        boxShadow: "0 0 22px rgb(var(--gold-rgb) / .28)",
        fontFamily: "'Space Mono', monospace",
        animation: "mm-goal-in .35s ease-out",
      }}
    >
      <span className="shrink-0 text-[9px] font-black tracking-[.18em] text-gold">🎯 {t(lang, "SETERUSNYA", "NEXT")}</span>
      <span className="shrink-0 text-[15px] leading-none" aria-hidden>{goal.icon}</span>
      <span className="min-w-0 truncate text-[11px] font-black text-white">{goal.text}</span>
      <span className="shrink-0 text-[12px] font-black text-gold">›</span>
    </button>
  );
}
