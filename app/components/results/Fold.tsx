"use client";
import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * Optional detail folded behind a tap target. The body mounts only while the
 * fold is open, so long tables/notes cost nothing (and read as nothing) until
 * the player asks for them.
 */
export default function Fold({ summary, children, className = "", style, summaryClassName = "", summaryStyle, defaultOpen = false }: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  summaryClassName?: string;
  summaryStyle?: CSSProperties;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className={`group ${className}`} style={style} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary
        className={`flex min-h-[40px] cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-black tracking-[0.18em] ${summaryClassName}`}
        style={summaryStyle}
      >
        <span className="flex min-w-0 items-center gap-1.5">{summary}</span>
        <span className="transition-transform group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      {open && children}
    </details>
  );
}
