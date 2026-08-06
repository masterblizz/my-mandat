"use client";

import { useLang, t } from "../../i18n/useLang";

// Shared loading indicator: a spinning cyan ring (Tailwind's built-in
// `animate-spin`) plus a blinking tactical-style label, used anywhere a
// fetch/chunk/computation takes long enough to notice — map SVGs loading,
// a dynamic-imported scene, or a full route transition (see app/loading.tsx).
export default function LoadingSpinner({ label, size = 32, fullScreen = false }: { label?: string; size?: number; fullScreen?: boolean }) {
  const lang = useLang();
  const content = (
    <div className="flex flex-col items-center justify-center gap-3" style={{ fontFamily: "'Space Mono', monospace" }}>
      <div
        className="animate-spin rounded-full"
        style={{
          width: size,
          height: size,
          border: "2px solid rgb(var(--cyan-rgb) / 0.15)",
          borderTopColor: "var(--cyan)",
          boxShadow: "0 0 12px rgb(var(--cyan-rgb) / 0.35)",
        }}
      />
      <div className="mm-blip text-[10px] font-bold tracking-[0.25em]" style={{ color: "var(--text-muted)" }}>
        {label ?? t(lang, "MEMUATKAN...", "LOADING...")}
      </div>
    </div>
  );

  if (!fullScreen) return content;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "var(--bg)" }}>
      {content}
    </div>
  );
}
