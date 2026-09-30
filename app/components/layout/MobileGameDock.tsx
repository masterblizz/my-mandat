"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, useLang } from "../../i18n/useLang";

type DockItem = {
  href: string;
  icon: string;
  labelMs: string;
  labelEn: string;
  match: (pathname: string) => boolean;
};

const DOCK_ITEMS: DockItem[] = [
  { href: "/kawasan", icon: "⌂", labelMs: "Bandar", labelEn: "City", match: (path) => path === "/kawasan" || path.startsWith("/location/") || path === "/office" },
  { href: "/warroom", icon: "◈", labelMs: "War Room", labelEn: "War Room", match: (path) => path === "/warroom" || path.startsWith("/state/") },
  { href: "/campaign", icon: "⚑", labelMs: "Kempen", labelEn: "Campaign", match: (path) => path === "/campaign" || path === "/calendar" },
  { href: "/polling", icon: "⌁", labelMs: "Intel", labelEn: "Intel", match: (path) => path === "/polling" || path === "/messaging" || path === "/advisor" },
  { href: "/menu", icon: "☰", labelMs: "Menu", labelEn: "Menu", match: (path) => path === "/menu" },
];

const HIDDEN_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/purchase-confirmation", "/trailer"];
const HIDDEN_ROUTES = new Set(["/", "/menu", "/setup", "/load-game", "/kawasan-3d"]);

/**
 * Thumb-zone navigation for an installed/mobile browser session. The desktop
 * HUD remains unchanged; CSS exposes this dock only at phone widths.
 */
export default function MobileGameDock() {
  const pathname = usePathname();
  const lang = useLang();

  if (HIDDEN_ROUTES.has(pathname) || HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <nav className="mobile-game-dock" aria-label={t(lang, "Navigasi permainan", "Game navigation")}>
      {DOCK_ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`mobile-game-dock__item${active ? " mobile-game-dock__item--active" : ""}`}
          >
            <span className="mobile-game-dock__icon" aria-hidden="true">{item.icon}</span>
            <span>{lang === "ms" ? item.labelMs : item.labelEn}</span>
          </Link>
        );
      })}
    </nav>
  );
}
