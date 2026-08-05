"use client";

import { ReactNode } from "react";
import { useLang, t } from "../../i18n/useLang";
import { useUIStore, type Lang } from "../../store/uiStore";

// Same corner-bracket motif as the /menu CornerFrame — kept local (not
// imported from menu/page.tsx, which doesn't export it) since it's a
// trivial four-span decoration, not worth threading through a shared file
// for two call sites.
function CornerFrame() {
  return (
    <>
      <span className="pointer-events-none absolute left-0 top-0 h-5 w-5 border-l border-t" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.4)" }} />
      <span className="pointer-events-none absolute right-0 top-0 h-5 w-5 border-r border-t" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.4)" }} />
      <span className="pointer-events-none absolute bottom-0 left-0 h-5 w-5 border-b border-l" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.4)" }} />
      <span className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 border-b border-r" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.4)" }} />
    </>
  );
}

function LangToggle() {
  const lang = useLang();
  const setLanguage = useUIStore((s) => s.setLanguage);
  const codes: Lang[] = ["ms", "en"];
  return (
    <div className="absolute right-5 top-5 z-20 flex gap-1">
      {codes.map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLanguage(code)}
            className="border px-2 py-1 text-[9px] font-black tracking-[0.18em]"
            style={{
              borderColor: active ? "rgb(var(--gold-rgb) / 0.7)" : "rgb(var(--cyan-rgb) / 0.2)",
              color: active ? "var(--gold)" : "var(--text-muted)",
              background: active ? "rgb(var(--gold-rgb) / 0.08)" : "transparent",
            }}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

// Shared chrome for /login and /register: same dark tactical background,
// scanline/grid overlay, MY MANDAT wordmark and bordered panel used
// everywhere else in the app (see /menu). Only the panel's title/subtitle
// and form body differ per page.
export default function AuthShell({ title, subtitle, children, footNote }: { title: string; subtitle: string; children: ReactNode; footNote?: ReactNode }) {
  const lang = useLang();
  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{
        background:
          "radial-gradient(circle at 26% 20%, rgb(var(--cyan-rgb) / 0.09), transparent 38%), radial-gradient(circle at 82% 82%, rgb(var(--gold-rgb) / 0.05), transparent 36%), var(--bg)",
        color: "var(--text-primary)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.24]" style={{ backgroundImage: "linear-gradient(rgb(var(--cyan-rgb) / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--cyan-rgb) / 0.06) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.016), rgba(255,255,255,0.016) 1px, transparent 1px, transparent 4px)" }} />

      <LangToggle />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src="/logo-peti-undi.png" alt="My Mandat" width={48} height={48} style={{ filter: "drop-shadow(0 0 8px rgb(0 212 255 / 0.4))" }} />
          <div className="leading-none">
            <div className="whitespace-nowrap">
              <span className="text-[27px] font-black" style={{ color: "#55dcff", textShadow: "0 0 24px rgb(var(--cyan-rgb) / 0.45)" }}>MY </span>
              <span className="text-[27px] font-black" style={{ color: "#ffb22c", textShadow: "0 0 28px rgb(var(--gold-rgb) / 0.45)" }}>MANDAT</span>
            </div>
            <div className="text-[8px] font-bold tracking-[0.34em]" style={{ color: "rgb(var(--gold-rgb) / 0.55)" }}>
              {t(lang, "SIMULATOR KEMPEN PILIHAN RAYA", "CAMPAIGN COMMAND SIMULATOR")}
            </div>
          </div>
        </div>

        <section
          className="relative overflow-hidden border"
          style={{
            borderColor: "rgb(var(--cyan-rgb) / 0.28)",
            background: "linear-gradient(135deg, rgb(var(--cyan-rgb) / 0.05), rgba(3,8,15,0.86))",
            boxShadow: "0 0 40px rgb(var(--cyan-rgb) / 0.1), inset 0 0 40px rgb(var(--cyan-rgb) / 0.03)",
          }}
        >
          <CornerFrame />
          <div className="border-b px-6 py-4" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.18)" }}>
            <div className="text-[11px] font-black tracking-[0.3em]" style={{ color: "var(--cyan)" }}>{title}</div>
            <div className="mt-1 text-[10px] tracking-[0.06em]" style={{ color: "var(--text-muted)" }}>{subtitle}</div>
          </div>
          <div className="px-6 py-6">{children}</div>
        </section>

        {footNote && <div className="mt-4 text-center text-[9px] tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{footNote}</div>}
      </div>
    </main>
  );
}
