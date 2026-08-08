"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLang, t } from "../../i18n/useLang";
import { useGameStore } from "../../store/gameStore";
import { usePremiumStatus } from "../../hooks/usePremiumStatus";
import LangThemeToggle from "./LangThemeToggle";

const WAR_ROOM_FLOW_ROUTES = [
  "/calendar",
  "/campaign",
  "/messaging",
  "/polling",
  "/results",
  "/mandate",
  "/formation",
  "/cabinet",
];

const GOVERNING_ROUTES = ["/swearing-in", "/government", "/career", "/sandbox", "/opposition", "/postmortem"];

// Routes with no dedicated back/hub nav of their own (not part of the war
// room flow, not one of the governing-flow pages with their own "back to
// previous stage" button) — these get a plain browser-back button instead.
const GENERIC_BACK_ROUTES = ["/advisor", "/stats", "/settings", "/setup"];

// Routes that should jump straight to /menu rather than browser-back —
// kawasan is a top-level hub reached from the menu, not a step in a flow.
const MENU_BACK_ROUTES = ["/kawasan"];

function isWarRoomFlowRoute(pathname: string): boolean {
  return WAR_ROOM_FLOW_ROUTES.includes(pathname) || pathname.startsWith("/state/");
}

function isGoverningRoute(pathname: string): boolean {
  return GOVERNING_ROUTES.includes(pathname);
}

export default function Header() {
  const [time, setTime] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const lang = useLang();
  const electionScope = useGameStore((state) => state.settings.electionScope ?? "pru");
  const { hasPremium } = usePremiumStatus();

  const isHome = pathname === "/warroom";
  const showWarRoomHome = isWarRoomFlowRoute(pathname);
  const governingRoute = isGoverningRoute(pathname);
  const showGenericBack = GENERIC_BACK_ROUTES.includes(pathname);
  const showMenuBack = MENU_BACK_ROUTES.includes(pathname);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4"
      style={{
        height: "40px",
        background: "var(--bg)",
        borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.4)",
        fontFamily: "'Space Mono', monospace",
      }}
    >
      <div className="flex items-center gap-3 text-xs">
        <span className="font-bold tracking-widest text-cyan">MANDAT//AI</span>
        <span className="tracking-wider text-text-muted">{t(lang, "components_layout_Header.tacticalOps")}</span>

        {/* Only rendered once hasPremium is confirmed true — nothing shows
            while usePremiumStatus() is still loading or if the user isn't
            premium, so there's no "not premium" flash for premium users on
            every page load while the check is in flight. */}
        {hasPremium && (
          <span
            className="px-2 py-0.5 text-[11px] font-bold tracking-[0.16em]"
            style={{ color: "var(--gold)", border: "1px solid rgb(var(--gold-rgb) / 0.45)", background: "rgb(var(--gold-rgb) / 0.08)" }}
          >
            ⭐ {t(lang, "components_layout_Header.premium")}
          </span>
        )}

        {showGenericBack && (
          <button
            onClick={() => router.back()}
            className="px-2 py-1 text-[12px] font-bold tracking-[0.18em] transition-all hover:bg-cyan/10"
            style={{
              color: "var(--cyan)",
              border: "1px solid rgb(var(--cyan-rgb) / 0.32)",
              background: "rgb(var(--cyan-rgb) / 0.06)",
            }}
          >
            ← {t(lang, "components_layout_Header.back")}
          </button>
        )}

        {showMenuBack && (
          <Link
            href="/menu"
            className="px-2 py-1 text-[12px] font-bold tracking-[0.18em] transition-all"
            style={{
              color: "var(--text-muted)",
              border: "1px solid rgb(var(--cyan-rgb) / 0.25)",
            }}
          >
            ← {t(lang, "components_layout_Header.mainMenu")}
          </Link>
        )}

        {showWarRoomHome && (
          <Link
            href="/warroom"
            className="px-2 py-1 text-[12px] font-bold tracking-[0.18em] text-gold transition-all hover:bg-gold/15"
            style={{ border: "1px solid rgb(var(--gold-rgb) / 0.45)" }}
          >
            {t(lang, "components_layout_Header.warRoomHome")}
          </Link>
        )}

        {governingRoute && (
          <span
            className="px-2 py-1 text-[12px] font-bold tracking-[0.18em]"
            style={{ color: "var(--warn-orange)", border: "1px solid rgb(255 176 0 / 0.38)", background: "rgb(255 176 0 / 0.06)" }}
          >
            {t(lang, "components_layout_Header.warRoomLocked")}
          </span>
        )}

        {isHome && (
          <Link
            href="/menu"
            className="px-2 py-1 text-[12px] font-bold tracking-[0.18em] transition-all"
            style={{
              color: "var(--text-muted)",
              border: "1px solid rgb(var(--cyan-rgb) / 0.25)",
            }}
          >
            {t(lang, "components_layout_Header.mainMenu")}
          </Link>
        )}
      </div>

      <div className="hidden text-xs uppercase tracking-widest text-text-muted md:block">
        {governingRoute
          ? t(lang, "components_layout_Header.governmentAdministrationNonElectionMode")
          : electionScope === "prn"
            ? t(lang, "components_layout_Header.stateElectionCommandSimulator")
            : t(lang, "components_layout_Header.generalElectionCommandSimulator")}
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="font-bold tracking-widest text-white tabular-nums">{time}</span>
        <span className="flex items-center gap-1 text-neon-green">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon-green" />
          {t(lang, "components_layout_Header.sysOnline")}
        </span>
        <LangThemeToggle />
      </div>
    </header>
  );
}
