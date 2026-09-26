"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLang, t } from "../../i18n/useLang";
import { useGameStore } from "../../store/gameStore";
import { usePremiumStatus } from "../../hooks/usePremiumStatus";
import LangThemeToggle from "./LangThemeToggle";
import PersonalAssistant from "../assistant/PersonalAssistant";

const CITY_HUB_ROUTES = [
  "/calendar",
  "/campaign",
  "/messaging",
  "/polling",
  "/results",
  "/mandate",
  "/formation",
  "/cabinet",
];

const GOVERNING_ROUTES = ["/swearing-in", "/government", "/career", "/report-card", "/sandbox", "/opposition", "/postmortem"];

// Routes with no dedicated back/hub nav of their own (not part of the war
// room flow, not one of the governing-flow pages with their own "back to
// previous stage" button) — these get a plain browser-back button instead.
const GENERIC_BACK_ROUTES = ["/advisor", "/stats", "/settings", "/setup"];

// The city is the main hub, so it does not need a back-to-menu control.
const MENU_BACK_ROUTES: string[] = [];

function isCityHubRoute(pathname: string): boolean {
  return CITY_HUB_ROUTES.includes(pathname) || pathname.startsWith("/state/");
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
  const { hasPremium, hasUltimate } = usePremiumStatus();

  const showCityHub = isCityHubRoute(pathname) || isGoverningRoute(pathname);
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
    <>
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
            {hasUltimate ? "✦ " + t(lang, "components_layout_Header.ultimate") : "⭐ " + t(lang, "components_layout_Header.premium")}
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
            href="/kawasan"
            className="px-2 py-1 text-[12px] font-bold tracking-[0.18em] transition-all"
            style={{
              color: "var(--text-muted)",
              border: "1px solid rgb(var(--cyan-rgb) / 0.25)",
            }}
          >
            ← {t(lang, "components_layout_Header.mainMenu")}
          </Link>
        )}

        {showCityHub && (
          <Link
            href="/kawasan"
            className="px-2 py-1 text-[12px] font-bold tracking-[0.18em] text-gold transition-all hover:bg-gold/15"
            style={{ border: "1px solid rgb(var(--gold-rgb) / 0.45)" }}
          >
            {t(lang, "BANDAR 3D", "3D CITY")}
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
    {/* Kawasan embeds the assistant in the 3D city HUD so the player never
        has to look away from the map while playing. */}
    {pathname !== "/kawasan" && pathname !== "/office" && !pathname.startsWith("/location/") && <PersonalAssistant />}
    </>
  );
}
