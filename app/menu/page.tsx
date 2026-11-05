"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import MalaysiaMap from "../components/map/MalaysiaMap";
import CreditsModal from "../components/menu/CreditsModal";
import ContinueRunModal from "../components/menu/ContinueRunModal";
import LangThemeToggle from "../components/layout/LangThemeToggle";
import { states as initialStates } from "../data/states";
import { hubRoute, newJourney, normalizeJourney } from "../store/journey";
import { useGameStore } from "../store/gameStore";
import { getActiveSaveSlotId, getSavedGames, setActiveSaveSlot, type SavedGameSlot } from "../store/saveGame";
import { useLang, t, type Lang } from "../i18n/useLang";
import { inTerm, termQuarter } from "../store/termClock";
import { TERM_QUARTERS } from "../data/ybService";
import { isRulerState } from "../utils/governmentTerms";
import { createClient } from "../utils/supabase/client";

type MenuItemConfig = {
  id: string;
  href: string | null;
  danger?: boolean;
  /** Items in a group render indented beneath their parent, only while it is expanded. */
  group?: "solo";
  /** Parent row that expands/collapses this group instead of navigating. */
  toggles?: "solo";
};

type MenuItem = MenuItemConfig & { label: string; sub: string; disabled?: boolean };

const MENU_ICONS: Record<string, string> = {
  solo: "🎮", "02": "▶", "01": "✚", "03": "💾", "05": "📊", online: "🌐", "04": "⚙️", "06": "⭐", "07": "⏻",
};

// Top level: Solo Campaign · Multiplayer · Settings · Credits · Exit.
// Solo Campaign expands to show its run-specific actions.
const MENU_ITEMS_CONFIG: MenuItemConfig[] = [
  { id: "solo", href: null, toggles: "solo" },
  { id: "02", href: "/warroom", group: "solo" },
  { id: "01", href: "/setup", group: "solo" },
  { id: "03", href: "/load-game", group: "solo" },
  { id: "05", href: "/stats", group: "solo" },
  // Shared persistent worlds; separate from solo saves.
  { id: "online", href: "/online" },
  { id: "04", href: "/settings" },
  { id: "06", href: null },
  { id: "07", href: null, danger: true },
];

const LIVE_NEWS_MS = [
  "PARLIMEN DIBUBAR — NEGARA MASUK MOD KEMPEN",
  "UNDI BANDAR SELANGOR MASIH TERLALU RAPAT UNTUK DIRAMAL",
  "BLOK BORNEO DIPANTAU SEMUA KOALISI",
  "WAR ROOM MEDIA SOSIAL KESAN SWING SENTIMEN PANTAS",
  "PENGANALISIS: MAJORITI 112 KERUSI MASIH BOLEH DICAPAI",
];
const LIVE_NEWS_EN = [
  "PARLIAMENT DISSOLVED — NATION ENTERS CAMPAIGN MODE",
  "SELANGOR URBAN VOTE REMAINS TOO CLOSE TO CALL",
  "SABAH AND SARAWAK KINGMAKERS WATCHED BY ALL COALITIONS",
  "SOCIAL MEDIA WAR ROOM DETECTS RAPID SENTIMENT SWING",
  "ANALYSTS SAY 112-SEAT THRESHOLD IS STILL WITHIN REACH",
];

// PRN ticker: the selected negeri's own state-election headlines.
function prnLiveNews(lang: Lang, stateId: string, name: string, dunSeats: number) {
  const upper = name.toUpperCase();
  const majority = Math.floor(dunSeats / 2) + 1;
  const head = isRulerState(stateId) ? "MB" : t(lang, "KM", "CM");
  return lang === "ms"
    ? [
        `DUN ${upper} DIBUBAR — NEGERI MASUK MOD KEMPEN PRN`,
        `${dunSeats} KERUSI DUN ${upper} DIREBUT`,
        `PENGANALISIS: MAJORITI ${majority} KERUSI DIPERLUKAN UNTUK MEMBENTUK KERAJAAN NEGERI`,
        `CALON ${head} ${upper} JADI TUMPUAN PENGUNDI`,
        `WAR ROOM PRN ${upper} KESAN SWING SENTIMEN TEMPATAN`,
      ]
    : [
        `${upper} STATE ASSEMBLY DISSOLVED — STATE ENTERS PRN CAMPAIGN MODE`,
        `${dunSeats} ${upper} DUN SEATS UP FOR GRABS`,
        `ANALYSTS: ${majority}-SEAT MAJORITY NEEDED TO FORM THE STATE GOVERNMENT`,
        `${upper} ${head} CANDIDATES IN VOTERS' SPOTLIGHT`,
        `${upper} PRN WAR ROOM DETECTS LOCAL SENTIMENT SWING`,
      ];
}

function CornerFrame() {
  return (
    <>
      <span className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l border-t" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.35)" }} />
      <span className="pointer-events-none absolute right-4 top-4 h-6 w-6 border-r border-t" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.35)" }} />
      <span className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 border-b border-l" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.35)" }} />
      <span className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b border-r" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.35)" }} />
    </>
  );
}

export default function MainMenuPage() {
  const router = useRouter();
  const lang = useLang();
  const [selected, setSelected] = useState(0);
  const [soloOpen, setSoloOpen] = useState(false);
  const [clock, setClock] = useState("--:--:--");
  const [mounted, setMounted] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [continueSlot, setContinueSlot] = useState<SavedGameSlot | null>(null);
  // Save slots live in localStorage, so this can only be known post-mount
  // (see the `mounted` flag pattern used elsewhere on this page) — defaults
  // to false, the safe "nothing to continue" assumption, until the mount
  // effect below checks for real.
  const [hasSave, setHasSave] = useState(false);

  const {
    leader, day, totalDays, states: liveStates, getTotalProjectedSeats, getNationalSupport, settings,
    resetGame, journey, careerProgress,
  } = useGameStore();
  const isPrn = settings.electionScope === "prn";
  // Live campaign state (restored from the active save), not the static starting data.
  const prnState = isPrn ? liveStates.find((state) => state.id === settings.prnStateId) ?? liveStates[0] : null;
  const seatTotal = isPrn ? (prnState?.dunSeats ?? 0) : 222;
  const projectedSeats = isPrn ? (prnState?.projectedSeats ?? 0) : getTotalProjectedSeats();
  const nationalSupport = isPrn && prnState
    ? { mandat: Math.round(prnState.mandatSupport), lawan: Math.round(prnState.lawanSupport), others: Math.round(prnState.othersSupport) }
    : getNationalSupport();
  const daysLeft = Math.max(0, totalDays - day + 1);
  // In the term the campaign day is frozen at its last value; the term
  // quarter is the clock that moves.
  const termStat = inTerm(journey) ? { value: `${termQuarter({ journey, careerProgress })}/${TERM_QUARTERS}`, label: t(lang, "SUKU PENGGAL", "TERM QUARTER") } : null;

  // With a save, CONTINUE leads the solo list; without one, START NEW does and the disabled CONTINUE drops below it.
  const menuItems: MenuItem[] = useMemo(() => MENU_ITEMS_CONFIG
    .filter((item) => !item.group || soloOpen)
    .map((item, _i, list) => (!hasSave && item.id === "02" ? list.find((entry) => entry.id === "01")! : !hasSave && item.id === "01" ? list.find((entry) => entry.id === "02")! : item))
    .map((item) => ({
      ...item,
      label: t(lang, `menu_page.item_${item.id}_label`),
      sub: item.id === "02" && !hasSave ? t(lang, "menu_page.noSavedCampaign") : t(lang, `menu_page.item_${item.id}_sub`),
      disabled: item.id === "02" && !hasSave,
    })), [lang, hasSave, soloOpen]);

  const liveNewsItems = isPrn && prnState
    ? prnLiveNews(lang, prnState.id, prnState.name, prnState.dunSeats)
    : lang === "ms" ? LIVE_NEWS_MS : LIVE_NEWS_EN;

  // Always the full 14-state map, even in PRN mode — this is the ambient
  // "state of the nation" backdrop, not literally the player's campaign
  // scope, so it shouldn't shrink down to a single negeri's outline just
  // because the current run is a PRN contest. Hovering any state still
  // shows that state's own reference info via MalaysiaMap's
  // tooltipPlacement="menu-static" (see the "SELANGOR ONLY" bug report
  // this was fixed from — the map used to render just [prnState] here).
  const highlightedStates = useMemo(
    () => initialStates.map((state) => ({
      ...state,
      status: "winning" as const,
    })),
    []
  );

  const resumeSavedGame = useCallback((slot: SavedGameSlot) => {
    setActiveSaveSlot(slot.id);
    useGameStore.setState({ ...slot.state, journey: normalizeJourney(slot.state.journey), phase: "playing" });
    router.push(hubRoute(slot.state));
  }, [router]);

  const navigateMenuItem = useCallback((item: MenuItem) => {
    if (item.toggles) {
      setSoloOpen((open) => !open);
      setSelected(0);
      return;
    }
    if (item.id === "01") {
      // A new career must always begin with the character creator. The 3D
      // city is the campaign hub only after the player confirms a candidate,
      // party and home constituency in /setup.
      resetGame();
      useGameStore.setState({ journey: newJourney() });
      setActiveSaveSlot(null);
      router.push("/setup");
      return;
    }
    if (item.id === "07") {
      const supabase = createClient();
      supabase.auth.signOut().finally(() => router.push("/login"));
      return;
    }
    if (item.id === "06") {
      setShowCredits(true);
      return;
    }
    if (item.id === "02") {
      const slots = getSavedGames();
      // No save slot at all: this item renders disabled (see menuItems
      // above) and shouldn't do anything if still reached via keyboard
      // Enter — no more falling back to /load-game, which had nothing
      // useful to show anyway with zero slots.
      if (slots.length === 0) return;

      const activeId = getActiveSaveSlotId();
      const activeSlot = activeId ? slots.find((slot) => slot.id === activeId) : null;
      const latestSlot = [...slots].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())[0] ?? null;
      const slotToContinue = activeSlot ?? latestSlot;

      if (slotToContinue) {
        setContinueSlot(slotToContinue);
      }
      return;
    }
    if (!item.href) return;
    router.push(item.href);
  }, [router, resetGame]);

  useEffect(() => {
    setMounted(true);
    setHasSave(getSavedGames().length > 0);
    const update = () => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    update();
    const timer = setInterval(update, 1000);
    const handleKey = (event: KeyboardEvent) => {
      if (continueSlot) {
        if (event.key === "Escape") setContinueSlot(null);
        return;
      }
      if (event.key === "ArrowDown") setSelected((value) => Math.min(value + 1, menuItems.length - 1));
      if (event.key === "ArrowUp") setSelected((value) => Math.max(value - 1, 0));
      if (event.key === "ArrowRight" && menuItems[selected]?.toggles && !soloOpen) setSoloOpen(true);
      if (event.key === "ArrowLeft" && soloOpen && (menuItems[selected]?.toggles || menuItems[selected]?.group)) { setSoloOpen(false); setSelected(0); }
      if (event.key === "Enter") {
        const item = menuItems[selected];
        if (item && !item.disabled) navigateMenuItem(item);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [continueSlot, navigateMenuItem, selected, menuItems, soloOpen]);

  return (
    <main
      className="main-menu-screen relative min-h-screen overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 62% 42%, rgb(var(--cyan-rgb) / 0.08), transparent 34%), radial-gradient(circle at 18% 18%, rgb(var(--gold-rgb) / 0.035), transparent 26%), var(--bg)",
        color: "var(--text-primary)",
        fontFamily: "'Space Mono', 'Chakra Petch', monospace",
      }}
    >
      {showCredits && <CreditsModal lang={lang} onClose={() => setShowCredits(false)} />}
      {continueSlot && <ContinueRunModal lang={lang} slot={continueSlot} onClose={() => setContinueSlot(null)} onConfirm={() => resumeSavedGame(continueSlot)} />}
      <style>{`
        @keyframes mymandat-live-news-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes mymandat-radar-sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes mymandat-radar-pulse {
          0%, 100% { opacity: 0.22; transform: translate(-50%, -50%) scale(0.86); }
          50% { opacity: 0.52; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes mymandat-radar-ping {
          0% { opacity: 0.42; transform: translate(-50%, -50%) scale(0.18); }
          78%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.28); }
        }
        @keyframes mymandat-hotspot-bling {
          0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.72); box-shadow: 0 0 0 rgb(var(--gold-rgb) / 0); }
          45% { opacity: 1; transform: translate(-50%, -50%) scale(1.18); box-shadow: 0 0 18px rgb(var(--gold-rgb) / 0.78), 0 0 34px rgb(var(--cyan-rgb) / 0.34); }
        }
        @keyframes mymandat-hotspot-ring {
          0% { opacity: 0.65; transform: translate(-50%, -50%) scale(0.3); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2.8); }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 opacity-[0.28]" style={{ backgroundImage: "linear-gradient(rgb(var(--cyan-rgb) / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--cyan-rgb) / 0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.018), rgba(255,255,255,0.018) 1px, transparent 1px, transparent 4px)" }} />

      <header
        className="relative z-20 flex h-7 items-center justify-between border-b px-5 text-[10px] uppercase"
        style={{ borderColor: "rgb(var(--cyan-rgb) / 0.18)", background: "rgb(var(--bg-rgb) / 0.82)", letterSpacing: "0.24em" }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: "var(--cyan)" }}>◇</span>
          <span className="main-menu-ops" style={{ color: "var(--text-muted)" }}>{t(lang, "menu_page.tacticalOps")}</span>
        </div>
        <div className="main-menu-title hidden md:block" style={{ color: "var(--text-muted)" }}>
          {isPrn
            ? t(lang, "menu_page.stateElectionCommandSimulator", { prnStateName: prnState?.name?.toUpperCase() ?? "" })
            : t(lang, "menu_page.generalElectionCommandSimulator")}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/online" className="main-menu-online-link border px-2 py-1 text-[9px] font-bold tracking-[0.12em]" style={{ borderColor: "rgb(var(--gold-rgb) / 0.55)", color: "var(--gold)" }}>
            {t(lang, "DUNIA ONLINE", "ONLINE WORLDS")}
          </Link>
          <span className="main-menu-clock font-bold tracking-[0.15em] text-white tabular-nums">{clock}</span>
          <span className="main-menu-presence flex items-center gap-1 font-bold" style={{ color: "var(--neon-green)" }}><span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--neon-green)" }} />{t(lang, "menu_page.sysOnline")}</span>
          <LangThemeToggle />
        </div>
      </header>

      <section className="main-menu-layout relative z-10 grid overflow-hidden" style={{ height: "calc(100vh - 54px)", gridTemplateColumns: "480px minmax(0, 1fr)" }}>
        <div className="absolute inset-0 z-[2] flex items-center justify-center pl-[300px] pr-10">
          <div className="w-full max-w-[1180px] scale-[1.28] opacity-[0.58]" style={{ filter: "drop-shadow(0 0 36px rgb(var(--cyan-rgb) / 0.55)) saturate(1.45)" }}>
            <MalaysiaMap states={highlightedStates} compact showLabels={false} showHotspots tooltipPlacement="menu-static" onStateClick={() => undefined} />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 z-[1]" style={{ background: "radial-gradient(circle at 57% 45%, transparent 0%, rgb(var(--bg-rgb) / 0.24) 42%, rgb(var(--bg-rgb) / 0.78) 100%)" }} />
        <div className="mm-particles z-[1]" />
        <aside className="main-menu-sidebar relative z-20 flex flex-col border-r px-9 pb-5 pt-7" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.18)", background: "linear-gradient(90deg, rgb(var(--bg-rgb) / 0.96), rgb(var(--bg-rgb) / 0.88) 72%, rgb(var(--bg-rgb) / 0.62))" }}>
          <div className="mb-3 flex items-center gap-3">
            <Image src="/logo-peti-undi.png" alt="My Mandat Logo" width={56} height={56} style={{ flexShrink: 0, filter: "drop-shadow(0 0 8px rgb(var(--cyan-rgb) / 0.4))" }} />
            <div>
              <h1 className="whitespace-nowrap leading-none tracking-[-0.03em]">
                <span className="text-[38px] font-black" style={{ color: "var(--cyan)", textShadow: "0 0 32px rgb(var(--cyan-rgb) / 0.45)" }}>MY </span>
                <span className="text-[38px] font-black" style={{ color: "var(--gold)", textShadow: "0 0 38px rgb(var(--gold-rgb) / 0.45)" }}>MANDAT</span>
              </h1>
              <div className="text-[9px] font-bold tracking-[0.38em]" style={{ color: "rgb(var(--gold-rgb) / 0.55)" }}>{t(lang, "menu_page.campaignCommandSimulator")}</div>
            </div>
          </div>
          <nav className="flex flex-col gap-2">
            {menuItems.map((item, index) => {
              const isSelected = index === selected && !item.disabled;
              const color = item.danger ? "var(--neon-red)" : isSelected ? "#05080e" : "var(--text-primary)";
              return (
                <Fragment key={item.id}>
                <button
                  data-group={item.group}
                  aria-expanded={item.toggles ? soloOpen : undefined}
                  disabled={item.disabled}
                  title={item.disabled ? item.sub : undefined}
                  className={`group flex ${item.group ? "h-9 ml-5" : "h-11"} items-center justify-between rounded-md border px-4 text-left transition-all duration-150 active:scale-[.98] disabled:cursor-not-allowed`}
                  style={{
                    borderColor: item.danger ? "rgb(var(--neon-red-rgb) / 0.3)" : isSelected ? "rgb(var(--gold-rgb) / 0.92)" : "rgb(var(--cyan-rgb) / 0.18)",
                    background: isSelected ? "linear-gradient(90deg, var(--gold), rgb(var(--gold-rgb) / 0.82))" : item.danger ? "rgb(var(--neon-red-rgb) / 0.04)" : "rgb(var(--bg-rgb) / 0.7)",
                    color,
                    boxShadow: isSelected ? "0 0 28px rgb(var(--gold-rgb) / 0.33)" : "none",
                    opacity: item.disabled ? 0.4 : 1,
                  }}
                  onMouseEnter={() => { if (!item.disabled) setSelected(index); }}
                  onClick={() => {
                    if (item.disabled) return;
                    setSelected(index);
                    navigateMenuItem(item);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span aria-hidden className={`${item.group ? "text-[14px]" : "text-[17px]"} w-6 text-center leading-none`}>{MENU_ICONS[item.id] ?? "•"}</span>
                    <span className={`${item.group ? "text-[12px]" : "text-[15px]"} truncate font-black tracking-[0.16em]`}>{item.label}</span>
                    {item.disabled && <span className="text-[9px] font-bold tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{t(lang, "menu_page.noSave")}</span>}
                  </span>
                  {item.toggles
                    ? <span className="text-[13px] font-black transition-transform duration-150" style={{ transform: soloOpen ? "rotate(90deg)" : "none" }}>▸</span>
                    : isSelected && <span className="text-[18px] font-black">»</span>}
                </button>
                </Fragment>
              );
            })}
          </nav>

          {/* Player card, and — only when there is a run to continue — its
              three headline numbers. No timelines or tables on the title screen. */}
          <Link
            href="/profile"
            className="mt-4 flex items-center gap-3 rounded-md border px-3 py-2.5 transition hover:border-cyan/70"
            style={{ borderColor: "rgb(var(--cyan-rgb) / 0.2)", background: "linear-gradient(135deg, rgb(var(--cyan-rgb) / 0.06), rgb(var(--bg-rgb) / 0.62))" }}
          >
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2" style={{ borderColor: leader.partyColor || "var(--cyan)", background: "rgb(var(--cyan-rgb) / .08)" }}>
              <Image src={`/avatars/leader-${String((leader.avatarIndex ?? 0) + 1).padStart(2, "0")}.png`} alt={leader.name} fill sizes="44px" style={{ objectFit: "cover", objectPosition: "center 18%" }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-black tracking-[.08em] text-white">{leader.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="rounded-full px-1.5 py-px text-[9px] font-black text-black" style={{ background: leader.partyColor || "var(--cyan)" }}>{leader.partyAbbr || leader.party}</span>
                {mounted && hasSave && <span className="truncate text-[9px] font-bold tracking-wider" style={{ color: "var(--text-muted)" }}>{isPrn ? `PRN · ${prnState?.name ?? ""}` : "PRU"}</span>}
              </div>
            </div>
            <span className="text-[14px]" style={{ color: "var(--cyan)" }}>›</span>
          </Link>

          {mounted && hasSave && (
            <div className="main-menu-stats mt-2 grid grid-cols-3 gap-2">
              {[
                { icon: "🪑", value: `${projectedSeats}/${seatTotal}`, label: t(lang, "menu_page.seats"), color: "var(--cyan)" },
                { icon: "📈", value: `${nationalSupport.mandat}%`, label: t(lang, "menu_page.support"), color: "var(--text-primary)" },
                { icon: "📅", value: termStat?.value ?? `${daysLeft}`, label: termStat?.label ?? t(lang, "menu_page.daysLeft"), color: "var(--gold)" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-md border px-2 py-1.5 text-center" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.14)", background: "rgb(var(--bg-rgb) / 0.6)" }}>
                  <div className="text-[15px] font-black" style={{ color: stat.color }}><span className="mr-1 text-[12px]">{stat.icon}</span>{stat.value}</div>
                  <div className="truncate text-[8px] tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </aside>
        <div className="main-menu-intel pointer-events-none relative z-10 min-w-0 overflow-hidden">
          <CornerFrame />
          <div
            className="absolute left-8 right-8 top-6 z-20 flex h-9 items-center overflow-hidden rounded-md border"
            style={{
              borderColor: "rgb(var(--neon-red-rgb) / 0.34)",
              background: "linear-gradient(90deg, rgb(var(--neon-red-rgb) / 0.16), rgb(var(--bg-rgb) / 0.72) 24%, rgb(var(--bg-rgb) / 0.48))",
              boxShadow: "0 0 24px rgb(var(--neon-red-rgb) / 0.10), inset 0 0 20px rgb(var(--neon-red-rgb) / 0.035)",
            }}
          >
            <div className="flex h-full shrink-0 items-center gap-2 px-3" style={{ background: "rgb(var(--neon-red-rgb) / 0.18)", color: "var(--neon-red)" }}>
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--neon-red)", boxShadow: "0 0 10px var(--neon-red)" }} />
              <span className="text-[10px] font-black tracking-[0.28em]">{t(lang, "menu_page.liveNews")}</span>
            </div>
            <div className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
              <div
                className="inline-flex items-center gap-8 pl-6 text-[10px] font-bold tracking-[0.22em]"
                style={{ color: "var(--text-primary)", animation: "mymandat-live-news-scroll 24s linear infinite" }}
              >
                {[...liveNewsItems, ...liveNewsItems].map((item, index) => (
                  <span key={`${item}-${index}`} className="inline-flex items-center gap-8">
                    <span>{item}</span>
                    <span style={{ color: "var(--gold)" }}>◆</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute left-[10%] top-[5%] h-[78vh] w-[78vh] rounded-full border" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.035)" }} />
          <div className="pointer-events-none absolute left-[20%] top-[18%] h-[50vh] w-[50vh] rounded-full border" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.04)" }} />
          {/* Blue/cyan radar sweep — same left-[38%] top-[47%] pivot as the
              red radar group below, so both rotations share one visual
              centre. Previously `.mm-radar` lived in the outer <section>
              with an ad hoc `left: 300` override, which put its own
              (unrelated) 50%/50% self-centering at a different point on
              screen than this red group's pivot — hence the two radars
              sweeping from different spots. Explicit left/top/right/
              bottom/width/height here fully replace the class's `inset: 0`
              default instead of only partially overriding it. */}
          <div className="mm-radar z-[6]" style={{ left: "38%", top: "47%", right: "auto", bottom: "auto", width: "62vw", height: "62vw", transform: "translate(-50%, -50%)" }} />
          <div className="pointer-events-none absolute left-[38%] top-[47%] z-[8] h-[62vw] w-[62vw] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ animation: "mymandat-radar-pulse 3.8s ease-in-out infinite" }}>
            <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: "rgb(var(--neon-red-rgb) / 0.75)", boxShadow: "0 0 18px rgb(var(--neon-red-rgb) / 0.5), inset 0 0 18px rgb(var(--neon-red-rgb) / 0.2)" }} />
            <div className="absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: "rgb(var(--neon-red-rgb) / 0.55)" }} />
            <div className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: "rgb(var(--neon-red-rgb) / 0.55)" }} />
            <div className="absolute left-1/2 top-1/2 h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "var(--neon-red)", boxShadow: "0 0 18px var(--neon-red)" }} />
            <div className="absolute inset-0 origin-center rounded-full" style={{ animation: "mymandat-radar-sweep 4.8s linear infinite", background: "conic-gradient(from 0deg, rgb(var(--neon-red-rgb) / 0.45), rgb(var(--neon-red-rgb) / 0.18) 14deg, transparent 46deg, transparent 360deg)", mixBlendMode: "screen" }} />
          </div>
          {/* Was missing -translate-x-1/2 -translate-y-1/2 — every other
              element sharing this left-[38%] top-[47%] pivot centers itself
              on it via that transform; without it this ring's top-left
              corner sat on the pivot instead, offsetting it by half its own
              68vw/68vh size from the others. */}
          <div className="pointer-events-none absolute left-[38%] top-[47%] z-[7] h-[68vw] w-[68vw] -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: "rgb(var(--neon-red-rgb) / 0.45)", animation: "mymandat-radar-ping 2.8s ease-out infinite" }} />
        </div>
      </section>

      <footer
        className="relative z-20 flex h-[26px] items-center justify-between border-t px-5 text-[9px] uppercase"
        style={{ borderColor: "rgb(var(--cyan-rgb) / 0.16)", background: "rgb(var(--bg-rgb) / 0.96)", letterSpacing: "0.24em" }}
      >
        <span><span style={{ color: "var(--gold)" }}>➤ {t(lang, "menu_page.ready")}</span><span style={{ color: "var(--text-muted)" }}> · {t(lang, "menu_page.startCampaignToBegin")}</span></span>
        <span className="hidden [@media(pointer:fine)]:inline" style={{ color: "var(--text-muted)" }}>↑↓ {t(lang, "menu_page.navigate")} · ↵ {t(lang, "menu_page.select")}</span>
      </footer>
    </main>
  );
}
