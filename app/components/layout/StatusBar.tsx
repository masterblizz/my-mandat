"use client";

interface StatusBarProps {
  leftText?: string;
  rightText?: string;
}

export default function StatusBar({
  leftText = "» READY · AWAITING COMMAND",
  rightText = "↑↓ NAVIGATE · ↵ SELECT",
}: StatusBarProps) {
  return (
    <footer
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4"
      style={{
        height: "36px",
        background: "var(--bg)",
        borderTop: "1px solid rgb(var(--cyan-rgb) / 0.4)",
        fontFamily: "'Space Mono', monospace",
      }}
    >
      <span className="text-gold text-xs tracking-wider uppercase">{leftText}</span>
      <span className="text-gold text-xs tracking-wider uppercase">{rightText}</span>
    </footer>
  );
}
