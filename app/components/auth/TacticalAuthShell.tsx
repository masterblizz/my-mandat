"use client";

import { ReactNode, useEffect, useState } from "react";
import { useLang, t } from "../../i18n/useLang";
import { useUIStore, type Lang } from "../../store/uiStore";
import AuthBackground from "./AuthBackground";
import { BG, PANEL, BORDER, INPUT_BG, TEXT, TEXT_DIM, TEXT_FAINT, CYAN, GOLD, RED, GREEN } from "./theme";
import { plexMono, inter } from "./fonts";
import { getNationalStats } from "../../data/states";
import { formatNumber } from "../../utils/format";

// Shared chrome for /login and /register: "tactical map + centered card" —
// ported from the Claude Design canvas "Login Page.dc.html", variant 5a
// ("Peta taktikal + kad tengah"), the app's native dark cyan/gold/red HUD
// look — radar dial, breaking-news ticker, glowing map backdrop (see
// AuthBackground), corner-bracketed card.
export { BG, PANEL, BORDER, INPUT_BG, TEXT, TEXT_DIM, TEXT_FAINT, CYAN, GOLD, RED, GREEN };
export { plexMono, inter };

// Ticker separator/timestamp tone — distinct from TEXT_FAINT, used only here.
const TICKER_MUTED = "#3d4656";

function LangToggle() {
  const lang = useLang();
  const setLanguage = useUIStore((s) => s.setLanguage);
  const codes: Lang[] = ["ms", "en"];
  return (
    <div className="absolute right-8 z-20 flex gap-1" style={{ top: 96 }}>
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
      style={{ height: 34, background: "rgba(4,6,12,0.85)", borderBottom: `1px solid #1c2432`, padding: "0 24px" }}
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

// National facts only — no simulated/campaign data (mandat/lawan support,
// win probability) belongs here; this panel sits above the login card as a
// neutral "who is Malaysia" strip, not a game readout.
function MalaysiaInfoPanel({ lang, maxWidth }: { lang: Lang; maxWidth: number }) {
  const stats = getNationalStats();
  const { ethnic } = stats;

  return (
    <div
      className={plexMono.className}
      style={{
        width: "100%",
        maxWidth,
        margin: "0 24px",
        background: PANEL,
        backdropFilter: "blur(6px)",
        border: `1px solid ${BORDER}`,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <img
        src="/flags/malaysia.svg"
        alt="Malaysia"
        style={{ width: 42, height: 26, objectFit: "cover", border: `1px solid ${BORDER}`, flexShrink: 0 }}
      />
      <div style={{ display: "flex", flex: 1, flexWrap: "wrap", gap: "8px 18px" }}>
        <div>
          <div style={{ fontSize: 9, color: TEXT_FAINT, letterSpacing: 1 }}>{t(lang, "components_auth_TacticalAuthShell.population")}</div>
          <div style={{ fontSize: 13, color: CYAN, fontWeight: 700 }}>{formatNumber(stats.population, 0)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: TEXT_FAINT, letterSpacing: 1 }}>{t(lang, "components_auth_TacticalAuthShell.area")}</div>
          <div style={{ fontSize: 13, color: CYAN, fontWeight: 700 }}>{formatNumber(stats.area, 0)} km²</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: TEXT_FAINT, letterSpacing: 1 }}>{t(lang, "components_auth_TacticalAuthShell.ethnicBreakdown")}</div>
          <div style={{ fontSize: 11, color: TEXT, fontWeight: 600 }}>
            {t(lang, "components_auth_TacticalAuthShell.malay")} {formatNumber(ethnic.malay)}% · {t(lang, "components_auth_TacticalAuthShell.chinese")} {formatNumber(ethnic.chinese)}% ·{" "}
            {t(lang, "components_auth_TacticalAuthShell.indian")} {formatNumber(ethnic.indian)}% · {t(lang, "components_auth_TacticalAuthShell.other")} {formatNumber(ethnic.others)}%
          </div>
        </div>
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
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ background: BG, fontFamily: inter.style.fontFamily }}
    >
      <AuthBackground />

      <NewsTicker lang={lang} />

      <div className="absolute z-10 flex items-center gap-2.5" style={{ left: 32, top: 56 }}>
        <img
          src="/logo-peti-undi.png"
          alt="My Mandat"
          style={{ width: 26, height: 26, filter: "drop-shadow(0 0 8px rgba(0,212,255,0.5))" }}
        />
        <div style={{ fontSize: 15, fontWeight: 800 }}>
          <span style={{ color: CYAN }}>MY </span>
          <span style={{ color: GOLD }}>MANDAT</span>
        </div>
      </div>

      <div
        className={plexMono.className}
        style={{ position: "absolute", top: 60, right: 32, fontSize: 11, color: TEXT_FAINT, letterSpacing: 1 }}
      >
        {time} ·{" "}
        <span style={{ color: GREEN }}>
          <span className="mm-auth-live-blink" style={{ display: "inline-block" }}>
            ●
          </span>{" "}
          {t(lang, "components_auth_TacticalAuthShell.sysOnline")}
        </span>
      </div>

      <LangToggle />

      <div className="relative z-10 flex w-full flex-col items-center" style={{ gap: 14 }}>
        <MalaysiaInfoPanel lang={lang} maxWidth={cardWidth} />

        <div
          className="mm-auth-card-glow relative w-full"
          style={{ maxWidth: cardWidth, margin: "0 24px", background: PANEL, backdropFilter: "blur(6px)", border: `1px solid ${BORDER}`, padding: 36 }}
        >
          <span className="pointer-events-none absolute" style={{ top: -1, left: -1, width: 18, height: 18, borderTop: `2px solid ${CYAN}`, borderLeft: `2px solid ${CYAN}` }} />
          <span className="pointer-events-none absolute" style={{ top: -1, right: -1, width: 18, height: 18, borderTop: `2px solid ${CYAN}`, borderRight: `2px solid ${CYAN}` }} />
          <span className="pointer-events-none absolute" style={{ bottom: -1, left: -1, width: 18, height: 18, borderBottom: `2px solid ${CYAN}`, borderLeft: `2px solid ${CYAN}` }} />
          <span className="pointer-events-none absolute" style={{ bottom: -1, right: -1, width: 18, height: 18, borderBottom: `2px solid ${CYAN}`, borderRight: `2px solid ${CYAN}` }} />

          <div className="mb-6 text-center">
            <div className={plexMono.className} style={{ fontSize: 10, color: GOLD, letterSpacing: 2, marginBottom: 10 }}>
              {eyebrow}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f2f4f8" }}>{heading}</div>
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}
