"use client";

import type { ReactNode } from "react";

/**
 * Small presentation pieces shared by the government-formation flow
 * (/mandate, /formation, /cabinet, /swearing-in and the term dashboard):
 * a title row with fact chips instead of kicker sentences, icon+number chips,
 * a folded "ⓘ" detail toggle and a big tap-target button.
 */

/** An icon + value pill — replaces a labelled sentence. */
export function StatChip({ icon, children, color = "var(--gold)", title }: { icon: string; children: ReactNode; color?: string; title?: string }) {
  return (
    <span title={title} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black tracking-wider"
      style={{ border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`, color, background: `color-mix(in srgb, ${color} 9%, transparent)` }}>
      <span aria-hidden>{icon}</span>{children}
    </span>
  );
}

/** Folded optional detail: a small ⓘ toggle, closed by default. */
export function InfoFold({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group mt-3 rounded-md border text-[11px] leading-relaxed text-text-muted" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.16)", background: "rgba(255,255,255,0.02)" }}>
      <summary className="flex min-h-[32px] cursor-pointer list-none items-center justify-between gap-2 px-3 py-1.5 text-[10px] font-black tracking-[0.18em]" style={{ color: "var(--cyan)" }}>
        <span>ⓘ {label}</span><span className="transition-transform group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

type Tone = "cyan" | "gold" | "green" | "orange" | "red";
const TONE: Record<Tone, { border: string; color: string; bg: string }> = {
  cyan: { border: "rgb(var(--cyan-rgb)/0.38)", color: "var(--cyan)", bg: "rgb(var(--cyan-rgb)/0.06)" },
  gold: { border: "rgb(var(--gold-rgb)/0.55)", color: "var(--gold)", bg: "rgb(var(--gold-rgb)/0.10)" },
  green: { border: "rgb(0 255 136 / 0.45)", color: "var(--neon-green)", bg: "rgb(0 255 136 / 0.07)" },
  orange: { border: "rgb(255 176 0 / 0.45)", color: "var(--warn-orange)", bg: "rgb(255 176 0 / 0.07)" },
  red: { border: "rgb(255 68 68 / 0.45)", color: "var(--neon-red)", bg: "rgb(255 68 68 / 0.07)" },
};

/** A short-verb HUD button with a phone-sized (≥40px) tap target. */
export function HudButton({ tone = "cyan", onClick, disabled, children, className = "", color }: {
  tone?: Tone; onClick?: () => void; disabled?: boolean; children: ReactNode; className?: string; color?: string;
}) {
  const s = TONE[tone];
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 whitespace-nowrap px-4 py-2 text-[11px] font-black tracking-widest transition active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={color ? { border: `1px solid color-mix(in srgb, ${color} 55%, transparent)`, color, background: `color-mix(in srgb, ${color} 8%, transparent)` } :{ border: `1px solid ${s.border}`, color: s.color, background: s.bg }}>
      {children}
    </button>
  );
}

/** Page title row: one title, a row of fact chips, actions on the right. */
export function PageHead({ title, chips, actions }: { title: string; chips?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <h1 className="text-xl font-black tracking-widest text-white sm:text-2xl" style={{ fontFamily: "Space Mono, monospace" }}>{title}</h1>
        {chips && <div className="mt-1.5 flex flex-wrap gap-1.5">{chips}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A compact number tile: icon + tiny label on top, big value below. */
export function NumTile({ icon, label, value, color = "var(--cyan)", border }: { icon: string; label: string; value: ReactNode; color?: string; border?: string }) {
  return (
    <div className="min-w-0 border p-2.5" style={{ borderColor: border ?? `color-mix(in srgb, ${color} 35%, transparent)` }}>
      <div className="truncate text-[10px] font-bold tracking-wider text-text-muted"><span aria-hidden>{icon}</span> {label}</div>
      <div className="mt-1 text-2xl font-black leading-none sm:text-3xl" style={{ color }}>{value}</div>
    </div>
  );
}
