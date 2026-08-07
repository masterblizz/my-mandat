"use client";

import { ReactNode, useEffect, useState } from "react";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { useLang, t } from "../../i18n/useLang";
import { useUIStore, type Lang } from "../../store/uiStore";

// Shared chrome for /login and /register: "tactical map + centered card" —
// Design Canvas variant 5a, the app's native dark cyan/gold/red HUD look.
export const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
export const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "700", "800"] });

export const BG = "#070b12";
export const PANEL = "rgba(10,15,24,0.88)";
export const BORDER = "#263042";
export const INPUT_BG = "#0d1320";
export const TEXT = "#e5e9f0";
export const TEXT_DIM = "#8b95a5";
export const TEXT_FAINT = "#5b6576";
export const CYAN = "#55dcff";
export const GOLD = "#ffb22c";
export const RED = "#c11f2c";
export const GREEN = "#22c55e";

function LangToggle() {
  const lang = useLang();
  const setLanguage = useUIStore((s) => s.setLanguage);
  const codes: Lang[] = ["ms", "en"];
  return (
    <div className="absolute right-8 top-16 z-20 flex gap-1">
      {codes.map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLanguage(code)}
            className={plexMono.className}
            style={{
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 1,
              border: `1px solid ${active ? GOLD : BORDER}`,
              color: active ? GOLD : TEXT_FAINT,
              background: active ? "rgba(255,178,44,0.08)" : "transparent",
            }}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

interface TacticalAuthShellProps {
  eyebrow: string;
  heading: string;
  children: ReactNode;
  cardWidth?: number;
}

export default function TacticalAuthShell({ eyebrow, heading, children, cardWidth = 420 }: TacticalAuthShellProps) {
  const lang = useLang();
  const [time, setTime] = useState("--:--:--");

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ background: BG, fontFamily: inter.style.fontFamily }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,11,18,0.4), rgba(7,11,18,0.92)), repeating-linear-gradient(0deg, rgba(148,163,184,0.05) 0px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(148,163,184,0.05) 0px, transparent 1px 40px)",
        }}
      />

      <svg
        className="pointer-events-none absolute"
        style={{ right: 40, top: 40, opacity: 0.3 }}
        width="560"
        height="560"
        viewBox="0 0 700 700"
      >
        <circle cx="350" cy="350" r="320" fill="none" stroke={RED} strokeWidth="1" />
        <circle cx="350" cy="350" r="200" fill="none" stroke={RED} strokeWidth="1" />
        <line x1="350" y1="30" x2="350" y2="670" stroke={RED} strokeWidth="1" />
        <line x1="30" y1="350" x2="670" y2="350" stroke={RED} strokeWidth="1" />
      </svg>

      <div className="absolute left-8 top-6 z-10 flex items-center gap-2.5">
        <img
          src="/logo-peti-undi.png"
          alt="My Mandat"
          style={{ width: 26, height: 26, filter: "drop-shadow(0 0 8px rgba(0,212,255,0.4))" }}
        />
        <div style={{ fontSize: 15, fontWeight: 800 }}>
          <span style={{ color: CYAN }}>MY </span>
          <span style={{ color: GOLD }}>MANDAT</span>
        </div>
      </div>

      <div
        className={plexMono.className}
        style={{ position: "absolute", top: 28, right: 32, fontSize: 11, color: TEXT_FAINT, letterSpacing: 1 }}
      >
        {time} · <span style={{ color: GREEN }}>{t(lang, "SIS DALAM TALIAN", "SYS ONLINE")}</span>
      </div>

      <LangToggle />

      <div
        className="relative z-10 w-full"
        style={{ maxWidth: cardWidth, margin: "0 24px", background: PANEL, border: `1px solid ${BORDER}`, padding: 36, boxShadow: "0 0 60px rgba(0,0,0,0.5)" }}
      >
        <div className="mb-6 text-center">
          <div className={plexMono.className} style={{ fontSize: 10, color: GOLD, letterSpacing: 2, marginBottom: 10 }}>
            {eyebrow}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f2f4f8" }}>{heading}</div>
        </div>

        {children}
      </div>
    </main>
  );
}
