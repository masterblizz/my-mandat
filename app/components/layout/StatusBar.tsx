"use client";
import { useReducedMotion } from "../../hooks/useReducedMotion";

interface StatusBarProps {
  leftText?: string;
  rightText?: string;
  /**
   * Marquee mode (war room live-news bar): scrolls `leftText` across the bar
   * like a breaking-news ticker. Re-keyed by the text, so a new headline
   * replaces the previous scroll. Off by default; static text elsewhere.
   */
  ticker?: boolean;
}

export default function StatusBar({
  leftText = "» READY · AWAITING COMMAND",
  rightText = "↑↓ NAVIGATE · ↵ SELECT",
  ticker = false,
}: StatusBarProps) {
  const reducedMotion = useReducedMotion();
  const scrolling = ticker && !reducedMotion;
  // Scroll duration proportional to headline length, clamped to ~4-6s.
  const tickerDuration = Math.min(6, Math.max(4, leftText.length * 0.045));

  return (
    <footer
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-4 pr-[264px]"
      style={{
        height: "36px",
        background: "var(--bg)",
        borderTop: "1px solid rgb(var(--cyan-rgb) / 0.4)",
        fontFamily: "'Space Mono', monospace",
      }}
    >
      {scrolling ? (
        <span className="text-gold text-xs tracking-wider uppercase mr-6 flex-1 min-w-0 overflow-hidden whitespace-nowrap">
          <span
            key={leftText}
            className="inline-block whitespace-nowrap"
            style={{ animation: `mm-ticker-scroll ${tickerDuration}s linear infinite`, willChange: "transform" }}
          >
            {leftText}
          </span>
        </span>
      ) : (
        <span className="text-gold min-w-0 truncate text-xs tracking-wider uppercase">{leftText}</span>
      )}
      {/* was shrink-0 with no truncate: on narrow viewports (long rightText,
          e.g. kawasan's "RM x,xxx,xxx · SENTIMEN xx% · PROJEK n") it never
          shrank, so it overflowed straight through the pr-[264px] zone
          reserved for the AmbientMusic pills and visually collided with
          them. min-w-0 lets it actually shrink below its content size;
          truncate turns that shrink into a clean ellipsis instead of a
          raw clip/overlap. */}
      <span className="text-gold min-w-0 shrink truncate text-xs tracking-wider uppercase">{rightText}</span>
    </footer>
  );
}
