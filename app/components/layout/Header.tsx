"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLang, t } from "../../i18n/useLang";

const WAR_ROOM_FLOW_ROUTES = [
  "/calendar",
  "/campaign",
  "/messaging",
  "/polling",
  "/results",
];

function isWarRoomFlowRoute(pathname: string): boolean {
  return WAR_ROOM_FLOW_ROUTES.includes(pathname) || pathname.startsWith("/state/");
}

export default function Header() {
  const [time, setTime] = useState("");
  const pathname = usePathname();
  const lang = useLang();

  const isHome = pathname === "/warroom";
  const showWarRoomHome = isWarRoomFlowRoute(pathname);

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
        <span className="tracking-wider text-text-muted">- TACTICAL OPS</span>

        {showWarRoomHome && (
          <Link
            href="/warroom"
            className="px-2 py-1 text-[12px] font-bold tracking-[0.18em] text-gold transition-all hover:bg-gold/15"
            style={{ border: "1px solid rgb(var(--gold-rgb) / 0.45)" }}
          >
            {t(lang, "LAMAN WAR ROOM", "WAR ROOM HOME")}
          </Link>
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
            {t(lang, "MENU UTAMA", "MAIN MENU")}
          </Link>
        )}
      </div>

      <div className="hidden text-xs uppercase tracking-widest text-text-muted md:block">
        GENERAL ELECTION - COMMAND SIMULATOR
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="font-bold tracking-widest text-white tabular-nums">{time}</span>
        <span className="flex items-center gap-1 text-neon-green">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon-green" />
          SYS ONLINE
        </span>
      </div>
    </header>
  );
}
