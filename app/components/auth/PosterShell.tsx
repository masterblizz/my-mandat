"use client";

import { ReactNode } from "react";
import { Anton, Oswald } from "next/font/google";
import { useLang, t } from "../../i18n/useLang";
import { useUIStore, type Lang } from "../../store/uiStore";

// Shared chrome for /login and /register: a vintage election-poster look,
// deliberately NOT AuthShell's dark cyan/gold tactical HUD — a separate
// visual language by explicit request, not a divorced/inconsistent variant
// of it. reset-password and forgot-password still use AuthShell unchanged.
// next/font here (not globals.css's Google Fonts @import) so Anton/Oswald
// only ever download on these two pages, not site-wide.
export const anton = Anton({ subsets: ["latin"], weight: "400" });
export const oswald = Oswald({ subsets: ["latin"], weight: ["500", "700"] });

export const INK = "#1c1a17";
export const RED = "#c11f2c";
export const RED_DARK = "#7c1119";
export const PAPER = "#e9e1d1";
export const CARD = "#f5efe1";
export const MUTED = "#8a8171";

// Class for underline-style <input>s on these two pages — globals.css's
// generic input:focus rule (cyan border-glow, tuned for the rest of the
// app's dark theme) doesn't fit this palette, and its box-shadow has
// nothing inline to compete with it, so it always wins without this.
export const POSTER_INPUT_CLASS = "mm-poster-input";

function StripeBar() {
  return (
    <div
      style={{
        height: 14,
        backgroundImage: `repeating-linear-gradient(45deg, ${RED} 0 18px, ${INK} 18px 36px)`,
      }}
    />
  );
}

function LangToggle() {
  const lang = useLang();
  const setLanguage = useUIStore((s) => s.setLanguage);
  const codes: Lang[] = ["ms", "en"];
  return (
    <div className="absolute right-4 top-6 z-20 flex gap-1">
      {codes.map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLanguage(code)}
            className={oswald.className}
            style={{
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              border: `1.5px solid ${active ? RED : MUTED}`,
              color: active ? RED : MUTED,
              background: active ? "rgba(193,31,44,0.08)" : "transparent",
            }}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

interface PosterShellProps {
  heading: string;
  ribbonLabel?: string;
  children: ReactNode;
  footNote?: ReactNode;
}

export default function PosterShell({ heading, ribbonLabel, children, footNote }: PosterShellProps) {
  const lang = useLang();

  return (
    <main className="relative flex min-h-screen flex-col" style={{ background: PAPER, color: INK }}>
      <style>{`
        .${POSTER_INPUT_CLASS}:focus {
          border-bottom-color: ${RED} !important;
          box-shadow: none !important;
          outline: none !important;
        }
      `}</style>
      <StripeBar />
      <LangToggle />

      <div className="mx-auto flex w-full flex-1 flex-col items-center justify-center px-6 py-12" style={{ maxWidth: 480 }}>
        {/* Stamp seal */}
        <div
          className="mb-8 flex items-center justify-center rounded-full"
          style={{ width: 132, height: 132, border: `3px solid ${RED}`, transform: "rotate(-4deg)" }}
        >
          <span className={oswald.className} style={{ color: RED, fontWeight: 700, fontSize: 20, letterSpacing: "0.12em" }}>
            {t(lang, "UNDI", "VOTE")}
          </span>
        </div>

        {/* Wordmark */}
        <h1
          className={anton.className}
          style={{ fontSize: 56, lineHeight: 0.92, textAlign: "center", color: INK, textShadow: `5px 5px 0 ${RED}`, letterSpacing: "0.01em" }}
        >
          MY<br />MANDAT
        </h1>

        <div className="mt-4 mb-10 flex flex-col items-center gap-1.5" style={{ width: "100%", maxWidth: 300 }}>
          <div style={{ height: 3, width: "100%", background: INK }} />
          <span className={oswald.className} style={{ color: RED, fontWeight: 700, fontSize: 13, letterSpacing: "0.32em" }}>
            {t(lang, "SIMULATOR KEMPEN", "CAMPAIGN SIMULATOR")}
          </span>
          <div style={{ height: 3, width: "100%", background: INK }} />
        </div>

        {/* Card */}
        <section className="relative w-full" style={{ background: CARD, border: `2px dashed ${MUTED}`, padding: "32px 28px" }}>
          <span
            className={oswald.className}
            style={{
              position: "absolute",
              top: -14,
              right: 20,
              background: RED,
              color: "#fff",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.16em",
              padding: "5px 14px",
              transform: "rotate(4deg)",
              boxShadow: `3px 3px 0 ${RED_DARK}`,
            }}
          >
            {ribbonLabel ?? t(lang, "RAHSIA", "CONFIDENTIAL")}
          </span>

          <h2 className={anton.className} style={{ fontSize: 26, marginBottom: 22 }}>
            {heading}
          </h2>

          {children}
        </section>

        {footNote && (
          <p className={oswald.className} style={{ marginTop: 28, textAlign: "center", fontSize: 12, color: INK }}>
            {footNote}
          </p>
        )}
      </div>

      <StripeBar />
    </main>
  );
}
