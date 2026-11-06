"use client";

import { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import { useLang, t } from "../../i18n/useLang";
import { useUIStore, type Lang } from "../../store/uiStore";
import { BG, PANEL, BORDER, INPUT_BG, TEXT, TEXT_DIM, TEXT_FAINT, CYAN, GOLD, RED, GREEN, ERROR_TEXT } from "./theme";
import { plexMono, inter } from "./fonts";

// Shared chrome for /login and /register: "tactical map + centered card" —
// ported from the Claude Design canvas "Login Page.dc.html", variant 5a
// ("Peta taktikal + kad tengah"), the app's native dark cyan/gold/red HUD
// look — radar dial, breaking-news ticker, glowing map backdrop (see
// AuthBackground), corner-bracketed card.
export { BG, PANEL, BORDER, INPUT_BG, TEXT, TEXT_DIM, TEXT_FAINT, CYAN, GOLD, RED, GREEN, ERROR_TEXT };
export { plexMono, inter };

// Ticker separator/timestamp tone — distinct from TEXT_FAINT, used only here.
const TICKER_MUTED = "var(--auth-ticker-muted)";

function LangToggle() {
  const lang = useLang();
  const setLanguage = useUIStore((s) => s.setLanguage);
  const codes: Lang[] = ["ms", "en"];
  return (
    <div className="flex gap-1">
      {codes.map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLanguage(code)}
            aria-label={code === "ms" ? "Tukar bahasa ke Bahasa Melayu" : "Switch language to English"}
            aria-pressed={active}
            className={plexMono.className}
            style={{
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 1,
              border: `1px solid ${active ? GOLD : BORDER}`,
              color: active ? GOLD : TEXT_FAINT,
              background: active ? "rgb(var(--auth-gold-rgb) / 0.08)" : "transparent",
            }}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function ThemeToggle() {
  const lang = useLang();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? t(lang, "components_auth_TacticalAuthShell.switchToLight") : t(lang, "components_auth_TacticalAuthShell.switchToDark")}
      title={theme === "dark" ? t(lang, "components_auth_TacticalAuthShell.switchToLight") : t(lang, "components_auth_TacticalAuthShell.switchToDark")}
      style={{
        padding: "3px 8px",
        fontSize: 11,
        border: `1px solid ${BORDER}`,
        color: CYAN,
        background: "transparent",
      }}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

function NewsTicker({ lang }: { lang: Lang }) {
  const headlines = [
    t(lang, "components_auth_TacticalAuthShell.selangorStillTooCloseToCall"),
    t(lang, "components_auth_TacticalAuthShell.borneoBlocWatchedByAllCoalitions"),
    t(lang, "components_auth_TacticalAuthShell.socialWarRoomDetectsSwing"),
  ];
  const live = t(lang, "components_auth_TacticalAuthShell.liveNews");

  const run = (key: string) => (
    <div key={key} className="flex items-center gap-2.5" style={{ whiteSpace: "nowrap" }}>
      <span style={{ color: RED }}>
        <span className="mm-auth-live-blink" style={{ display: "inline-block" }}>
          ●
        </span>{" "}
        {live}
      </span>
      {headlines.flatMap((h, i) => [
        <span key={`h-${i}`}>{h}</span>,
        i < headlines.length - 1 ? (
          <span key={`sep-${i}`} style={{ color: TICKER_MUTED }}>
            ◆
          </span>
        ) : null,
      ])}
    </div>
  );

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center overflow-hidden"
      style={{ height: 34, background: "rgb(var(--auth-bg-rgb) / 0.85)", borderBottom: "1px solid var(--auth-hairline)", padding: "0 24px" }}
    >
      <div
        className={`${plexMono.className} mm-auth-ticker-track flex gap-2.5`}
        style={{ fontSize: 10, letterSpacing: 1, color: TEXT_DIM }}
      >
        {run("a")}
        {run("b")}
      </div>
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
      className="navy-ui navy-auth relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ background: BG, fontFamily: inter.style.fontFamily }}
    >
      {/* the 3D city behind the sign-in card, as in the game */}
      <div aria-hidden className="navy-ui__backdrop pointer-events-none absolute inset-0">
        <Image src="/elected-city-bg.webp" alt="" fill priority sizes="100vw" style={{ objectFit: "cover", objectPosition: "center 60%" }} />
      </div>

      <NewsTicker lang={lang} />

      <div className="absolute z-10 flex items-center gap-2.5" style={{ left: 32, top: 56 }}>
        <Image
          src="/logo-peti-undi.png"
          alt="My Mandat"
          width={26}
          height={26}
          style={{ height: "auto", filter: "drop-shadow(0 0 8px rgb(var(--auth-wash-rgb) / 0.5))" }}
        />
        <div style={{ fontSize: 15, fontWeight: 800 }}>
          <span style={{ color: CYAN }}>MY </span>
          <span style={{ color: GOLD }}>MANDAT</span>
        </div>
      </div>

      {/* One top-right row: clock, language, theme */}
      <div className={`${plexMono.className} absolute z-20 flex items-center gap-3`} style={{ top: 50, right: 24, fontSize: 11, color: TEXT_FAINT, letterSpacing: 1 }}>
        <span className="auth-clock">
          {time} ·{" "}
          <span style={{ color: GREEN }}>
            <span className="mm-auth-live-blink" style={{ display: "inline-block" }}>●</span>{" "}
            {t(lang, "components_auth_TacticalAuthShell.sysOnline")}
          </span>
        </span>
        <LangToggle />
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex w-full flex-col items-center">
        <div
          className="auth-card mm-auth-card-glow relative w-full"
          style={{ maxWidth: cardWidth, margin: "0 24px", background: PANEL, backdropFilter: "blur(6px)", border: `1px solid ${BORDER}`, padding: 32, borderRadius: 6 }}
        >
          <span className="pointer-events-none absolute" style={{ top: -1, left: -1, width: 18, height: 18, borderTop: `2px solid ${CYAN}`, borderLeft: `2px solid ${CYAN}` }} />
          <span className="pointer-events-none absolute" style={{ top: -1, right: -1, width: 18, height: 18, borderTop: `2px solid ${CYAN}`, borderRight: `2px solid ${CYAN}` }} />
          <span className="pointer-events-none absolute" style={{ bottom: -1, left: -1, width: 18, height: 18, borderBottom: `2px solid ${CYAN}`, borderLeft: `2px solid ${CYAN}` }} />
          <span className="pointer-events-none absolute" style={{ bottom: -1, right: -1, width: 18, height: 18, borderBottom: `2px solid ${CYAN}`, borderRight: `2px solid ${CYAN}` }} />

          <div className="auth-head mb-5 text-center">
            <div className={`auth-eyebrow ${plexMono.className}`} style={{ fontSize: 10, color: GOLD, letterSpacing: 2, marginBottom: 8 }}>
              {eyebrow}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>{heading}</div>
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}
