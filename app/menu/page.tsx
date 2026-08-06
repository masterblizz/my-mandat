"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MalaysiaMap from "../components/map/MalaysiaMap";
import Skyline from "../components/layout/Skyline";
import { states as initialStates } from "../data/states";
import { generateConstituencies } from "../data/constituencies";
import { advisors } from "../data/advisors";
import { useGameStore } from "../store/gameStore";
import { getActiveSaveSlotId, getSavedGames, setActiveSaveSlot } from "../store/saveGame";
import { buildDailyChallenge } from "../utils/dailyChallenge";
import { useLang, t } from "../i18n/useLang";
import { createClient } from "../utils/supabase/client";

type MenuItemConfig = {
  id: string;
  labelMS: string; labelEN: string;
  subMS: string;   subEN: string;
  href: string | null;
  danger?: boolean;
};

type MenuItem = MenuItemConfig & { label: string; sub: string; disabled?: boolean };

const MENU_ITEMS_CONFIG: MenuItemConfig[] = [
  { id: "01", labelMS: "MULA KEMPEN",        labelEN: "START CAMPAIGN",    subMS: "Mulakan kempen baharu",          subEN: "Begin new mandate run",          href: "/setup" },
  { id: "01b", labelMS: "CABARAN HARIAN",    labelEN: "DAILY CHALLENGE",   subMS: "Senario sama untuk semua pemain hari ini", subEN: "Same scenario for every player today", href: null },
  { id: "02", labelMS: "SAMBUNG KEMPEN",      labelEN: "CONTINUE RUN",      subMS: "Kembali ke kempen aktif",        subEN: "Return to active campaign",      href: "/warroom" },
  { id: "03", labelMS: "MUAT PERMAINAN",      labelEN: "LOAD GAME",         subMS: "Buka slot kempen tersimpan",     subEN: "Open saved campaign slot",       href: "/load-game" },
  { id: "04", labelMS: "TETAPAN",             labelEN: "SETTINGS",          subMS: "Audio · paparan · kawalan",      subEN: "Audio · display · controls",     href: "/settings" },
  { id: "05", labelMS: "STATISTIK / SEJARAH", labelEN: "STATS / HISTORY",   subMS: "Pilihan raya & rekod lalu",      subEN: "Past elections and records",     href: "/stats" },
  { id: "06", labelMS: "KREDIT",              labelEN: "CREDITS",           subMS: "Pasukan dan penghargaan",        subEN: "Team and acknowledgements",      href: null },
  { id: "07", labelMS: "KELUAR",              labelEN: "EXIT",              subMS: "Tutup terminal arahan",          subEN: "Close command terminal",         href: null, danger: true },
];

const STATUS_ROWS_MS = [
  { label: "STATUS DEWAN", value: "DIBUBAR", color: "var(--neon-red)" },
  { label: "SENTIMEN AWAL", value: "TIDAK MENENTU", color: "var(--gold)" },
  { label: "FOKUS SEMASA", value: "PARTI-AVATAR", color: "var(--cyan)" },
  { label: "PEMANTAUAN BORNEO", value: "AKTIF", color: "var(--neon-green)" },
];
const STATUS_ROWS_EN = [
  { label: "PARLIAMENT STATUS", value: "DISSOLVED", color: "var(--neon-red)" },
  { label: "EARLY SENTIMENT", value: "FLUID", color: "var(--gold)" },
  { label: "CURRENT FOCUS", value: "AVATAR-PARTY", color: "var(--cyan)" },
  { label: "BORNEO WATCH", value: "ONLINE", color: "var(--neon-green)" },
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

function IntelPanel({ title, children, tone = "cyan" }: { title: string; children: React.ReactNode; tone?: "cyan" | "gold" }) {
  const color = tone === "gold" ? "var(--gold)" : "var(--cyan)";
  const rgb = tone === "gold" ? "var(--gold-rgb)" : "var(--cyan-rgb)";
  return (
    <section
      className="relative overflow-hidden"
      style={{
        border: `1px solid rgb(${rgb} / 0.22)`,
        background: `linear-gradient(135deg, rgb(${rgb} / 0.055), rgba(3, 8, 15, 0.56))`,
        boxShadow: `inset 0 0 28px rgb(${rgb} / 0.035)`,
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2" style={{ color }}>
        <span className="h-2 w-[2px]" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
        <span className="text-[10px] font-bold tracking-[0.28em]">{title}</span>
      </div>
      <div className="px-3 pb-3">{children}</div>
    </section>
  );
}

export default function MainMenuPage() {
  const router = useRouter();
  const lang = useLang();
  const [selected, setSelected] = useState(0);
  const [clock, setClock] = useState("--:--:--");
  const [mounted, setMounted] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  // Save slots live in localStorage, so this can only be known post-mount
  // (see the `mounted` flag pattern used elsewhere on this page) — defaults
  // to false, the safe "nothing to continue" assumption, until the mount
  // effect below checks for real.
  const [hasSave, setHasSave] = useState(false);

  const {
    leader, day, totalDays, getTotalProjectedSeats, getNationalSupport, mediaSentiment, settings,
    resetGame, setDataset, setLeader, setNomination, updateSettings, startCampaign, setDailyChallengeDate,
  } = useGameStore();
  const isPrn = settings.electionScope === "prn";
  const prnState = isPrn ? initialStates.find((state) => state.id === settings.prnStateId) ?? initialStates[0] : null;
  const seatTotal = isPrn ? (prnState?.dunSeats ?? 0) : 222;
  const majorityTarget = isPrn ? Math.floor(seatTotal / 2) + 1 : 112;
  const projectedSeats = isPrn ? (prnState?.projectedSeats ?? 0) : getTotalProjectedSeats();
  const nationalSupport = isPrn && prnState
    ? { mandat: Math.round(prnState.mandatSupport), lawan: Math.round(prnState.lawanSupport), others: Math.round(prnState.othersSupport) }
    : getNationalSupport();
  const campaignProgress = Math.round((day / totalDays) * 100);
  const daysLeft = Math.max(0, totalDays - day + 1);
  const leadAdvisor = advisors[0];
  const activeAdvisors = advisors.filter((advisor) => advisor.status === "active").length;

  const menuItems: MenuItem[] = MENU_ITEMS_CONFIG.map((item) => ({
    ...item,
    label: t(lang, item.labelMS, item.labelEN),
    sub: item.id === "02" && !hasSave ? t(lang, "Tiada kempen tersimpan", "No saved campaign") : t(lang, item.subMS, item.subEN),
    disabled: item.id === "02" && !hasSave,
  }));

  const statusRows = lang === "ms" ? STATUS_ROWS_MS : STATUS_ROWS_EN;
  const liveNewsItems = lang === "ms" ? LIVE_NEWS_MS : LIVE_NEWS_EN;

  const highlightedStates = useMemo(
    () => (isPrn && prnState ? [prnState] : initialStates).map((state) => ({
      ...state,
      status: "winning" as const,
    })),
    [isPrn, prnState]
  );

  // PRN runs replace the two national flavor tables (registered voters,
  // seat projection by state) with data scoped to the single negeri in
  // play, so nothing on this screen implies other states are contested.
  const prnDunSeats = useMemo(
    () => (isPrn && prnState ? generateConstituencies(prnState, "dun") : []),
    [isPrn, prnState]
  );
  const prnTopMarginSeats = useMemo(
    () => [...prnDunSeats].sort((a, b) => a.margin - b.margin).slice(0, 8),
    [prnDunSeats]
  );

  const navigateMenuItem = useCallback((item: MenuItem) => {
    if (item.id === "07") {
      const supabase = createClient();
      supabase.auth.signOut().finally(() => router.push("/login"));
      return;
    }
    if (item.id === "06") {
      setShowCredits(true);
      return;
    }
    if (item.id === "01b") {
      // Skips the setup wizard entirely — dataset/home state/difficulty/
      // media bias are all seeded from today's date (see
      // buildDailyChallenge), so every player who plays today starts from
      // the identical scenario. Day-to-day event/opponent RNG afterward is
      // unseeded, same as any other campaign — see dailyChallenge.ts's own
      // comment for why that's an intentional scope cut, not an oversight.
      const config = buildDailyChallenge();
      const homeState = initialStates.find((state) => state.id === config.homeStateId) ?? initialStates[0];
      const homeConstituency = generateConstituencies(homeState)[0];
      resetGame();
      setActiveSaveSlot(null);
      setDataset(config.dataset);
      setLeader({
        homeState: homeState.id,
        homeConstituencyId: homeConstituency?.id ?? "",
        homeConstituencyName: homeConstituency?.name ?? "",
      });
      if (homeConstituency) setNomination(homeConstituency.id, { type: "leader" });
      updateSettings({
        electionScope: "pru",
        difficulty: config.difficulty,
        mediaBias: config.mediaBias,
        oppositionStrength: config.oppositionStrength,
      });
      setDailyChallengeDate(config.dateKey);
      startCampaign();
      router.push("/kawasan");
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
        setActiveSaveSlot(slotToContinue.id);
        useGameStore.setState({ ...slotToContinue.state, phase: "playing" });
        router.push("/kawasan");
      }
      return;
    }
    if (!item.href) return;
    router.push(item.href);
  }, [router, resetGame, setDataset, setLeader, setNomination, updateSettings, startCampaign, setDailyChallengeDate]);

  useEffect(() => {
    setMounted(true);
    setHasSave(getSavedGames().length > 0);
    const update = () => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    update();
    const timer = setInterval(update, 1000);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") setSelected((value) => Math.min(value + 1, MENU_ITEMS_CONFIG.length - 1));
      if (event.key === "ArrowUp") setSelected((value) => Math.max(value - 1, 0));
      if (event.key === "Enter") {
        const item = MENU_ITEMS_CONFIG[selected];
        navigateMenuItem(item as MenuItem);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [navigateMenuItem, selected]);

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 62% 42%, rgb(var(--cyan-rgb) / 0.08), transparent 34%), radial-gradient(circle at 18% 18%, rgb(var(--gold-rgb) / 0.035), transparent 26%), #05080e",
        color: "var(--text-primary)",
        fontFamily: "'Space Mono', 'Chakra Petch', monospace",
      }}
    >
      {showCredits && (
        <div
          className="fixed inset-0 z-[9997] flex items-center justify-center px-4"
          style={{ background: "rgba(2, 6, 12, 0.86)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowCredits(false)}
        >
          <section
            className="relative w-full max-w-[760px] overflow-hidden border"
            style={{
              borderColor: "rgb(var(--gold-rgb) / 0.42)",
              background: "linear-gradient(135deg, rgba(240,165,0,0.12), rgba(3,8,15,0.96) 34%, rgba(0,212,255,0.08))",
              boxShadow: "0 0 42px rgb(var(--gold-rgb) / 0.16), inset 0 0 40px rgb(var(--cyan-rgb) / 0.05)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <CornerFrame />
            <div className="border-b px-6 py-4" style={{ borderColor: "rgb(var(--gold-rgb) / 0.24)" }}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black tracking-[0.34em]" style={{ color: "var(--gold)" }}>
                    {t(lang, "KREDIT OPERASI", "OPERATION CREDITS")}
                  </div>
                  <h2 className="mt-1 text-[26px] font-black tracking-[0.18em]" style={{ color: "#ffffff", textShadow: "0 0 18px rgb(var(--cyan-rgb) / 0.35)" }}>
                    MY MANDAT
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCredits(false)}
                  className="border px-4 py-2 text-[11px] font-black tracking-[0.18em] transition hover:brightness-125"
                  style={{ borderColor: "rgb(var(--cyan-rgb) / 0.35)", color: "var(--cyan)", background: "rgba(0,212,255,0.06)" }}
                >
                  {t(lang, "TUTUP ×", "CLOSE ×")}
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              {[
                { labelMS: "ARAHAN KREATIF", labelEN: "CREATIVE DIRECTION", value: "MyMandat Tactical Election Simulator" },
                { labelMS: "REKA BENTUK UI", labelEN: "UI DESIGN", value: "Cyan/Gold War Room Interface" },
                { labelMS: "SIMULASI PRU", labelEN: "ELECTION SIMULATION", value: "Malaysia campaign flow, states, seats & coalitions" },
                { labelMS: "PEMBANGUNAN", labelEN: "DEVELOPMENT", value: "Next.js · React · Zustand · Tactical HUD" },
              ].map((credit) => (
                <div key={credit.labelMS} className="border p-4" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.18)", background: "rgba(0,212,255,0.035)" }}>
                  <div className="text-[9px] font-black tracking-[0.24em]" style={{ color: "var(--cyan)" }}>{t(lang, credit.labelMS, credit.labelEN)}</div>
                  <div className="mt-2 text-[12px] font-bold leading-5" style={{ color: "#d7e7f5" }}>{credit.value}</div>
                </div>
              ))}
            </div>

            <div className="border-t px-6 py-4 text-[10px] leading-5 tracking-[0.12em]" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.16)", color: "#8aa0b5" }}>
              {t(
                lang,
                "Dibina sebagai pengalaman simulasi politik interaktif. Semua nombor senario dan unjuran adalah gameplay/simulasi, bukan ramalan sebenar.",
                "Built as an interactive political simulation experience. Scenario numbers and projections are gameplay simulation values, not real forecasts."
              )}
            </div>
          </section>
        </div>
      )}
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
        style={{ borderColor: "rgb(var(--cyan-rgb) / 0.18)", background: "rgba(3, 7, 13, 0.82)", letterSpacing: "0.24em" }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: "var(--cyan)" }}>◇</span>
          <span className="font-bold tracking-[0.18em] text-white">MANDAT//AI</span>
          <span style={{ color: "var(--text-muted)" }}>· {t(lang, "OPS TAKTIKAL", "TACTICAL OPS")}</span>
        </div>
        <div className="hidden md:block" style={{ color: "rgb(136 153 170 / 0.72)" }}>
          {isPrn
            ? t(lang, `PILIHAN RAYA NEGERI · ${prnState?.name?.toUpperCase() ?? ""} · SIMULATOR ARAHAN`, `STATE ELECTION · ${prnState?.name?.toUpperCase() ?? ""} · COMMAND SIMULATOR`)
            : t(lang, "PILIHAN RAYA UMUM · SIMULATOR ARAHAN", "GENERAL ELECTION · COMMAND SIMULATOR")}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-[0.15em] text-white tabular-nums">{clock}</span>
          <span className="flex items-center gap-1 font-bold" style={{ color: "var(--neon-green)" }}><span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--neon-green)" }} />{t(lang, "SIS DALAM TALIAN", "SYS ONLINE")}</span>
        </div>
      </header>

      <section className="relative z-10 grid overflow-hidden" style={{ height: "calc(100vh - 54px)", gridTemplateColumns: "480px minmax(0, 1fr)" }}>
        <div className="absolute inset-0 z-[2] flex items-center justify-center pl-[300px] pr-10">
          <div className="w-full max-w-[1180px] scale-[1.28] opacity-[0.58]" style={{ filter: "drop-shadow(0 0 36px rgb(var(--cyan-rgb) / 0.55)) saturate(1.45)" }}>
            <MalaysiaMap states={highlightedStates} compact showLabels={false} showHotspots tooltipPlacement="menu-static" onStateClick={() => undefined} />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 z-[1]" style={{ background: "radial-gradient(circle at 57% 45%, transparent 0%, rgba(5,8,14,0.24) 42%, rgba(5,8,14,0.78) 100%)" }} />
        <div className="mm-particles z-[1]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1]" style={{ left: 300 }}>
          <Skyline opacity={0.5} />
        </div>

        <aside className="relative z-20 flex flex-col border-r px-9 pb-5 pt-7" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.18)", background: "linear-gradient(90deg, rgba(4,8,14,0.96), rgba(4,8,14,0.88) 72%, rgba(4,8,14,0.62))" }}>
          <div className="mb-3 flex items-center gap-3">
            <img src="/logo-peti-undi.png" alt="My Mandat Logo" width={56} height={56} style={{ flexShrink: 0, filter: "drop-shadow(0 0 8px rgb(0 212 255 / 0.4))" }} />
            <div>
              <h1 className="whitespace-nowrap leading-none tracking-[-0.03em]">
                <span className="text-[38px] font-black" style={{ color: "#55dcff", textShadow: "0 0 32px rgb(var(--cyan-rgb) / 0.45)" }}>MY </span>
                <span className="text-[38px] font-black" style={{ color: "#ffb22c", textShadow: "0 0 38px rgb(var(--gold-rgb) / 0.45)" }}>MANDAT</span>
              </h1>
              <div className="text-[9px] font-bold tracking-[0.38em]" style={{ color: "rgb(var(--gold-rgb) / 0.55)" }}>{t(lang, "SIMULATOR KEMPEN PILIHAN RAYA", "CAMPAIGN COMMAND SIMULATOR")}</div>
            </div>
          </div>
          <p className="mb-3 max-w-[395px] text-[11px] leading-5" style={{ color: "#7d91a5" }}>
            {isPrn
              ? t(lang, `Mesin sudah hidup. ${prnState?.name ?? "Negeri"} dalam permainan, ${seatTotal} kerusi DUN untuk diperintah. Rakyat sedang memerhati.`, `The machine is live. ${prnState?.name ?? "The state"} in play, ${seatTotal} DUN seats to govern. The people are watching.`)
              : t(lang, "Mesin sudah hidup. Empat belas negeri dalam permainan, 112 kerusi untuk diperintah. Rakyat sedang memerhati.", "The machine is live. Fourteen states in play, 112 seats to govern. The people are watching.")}
          </p>

          <nav className="flex flex-col gap-1.5">
            {menuItems.map((item, index) => {
              const isSelected = index === selected && !item.disabled;
              const color = item.danger ? "var(--neon-red)" : isSelected ? "#05080e" : "var(--text-primary)";
              return (
                <button
                  key={item.id}
                  disabled={item.disabled}
                  title={item.disabled ? item.sub : undefined}
                  className="group flex h-8 items-center justify-between border px-5 text-left transition-all duration-150 disabled:cursor-not-allowed"
                  style={{
                    borderColor: item.danger ? "rgb(255 68 68 / 0.24)" : isSelected ? "rgb(var(--gold-rgb) / 0.92)" : "rgb(var(--cyan-rgb) / 0.16)",
                    background: isSelected ? "linear-gradient(90deg, #ffb42f, #f7a81f)" : item.danger ? "rgb(255 68 68 / 0.035)" : "rgba(4, 12, 19, 0.66)",
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
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] font-bold opacity-55">{item.id}</span>
                    <span className="text-[15px] font-black tracking-[0.18em]">{item.label}</span>
                    {item.disabled && <span className="text-[9px] font-bold tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{t(lang, "· TIADA SIMPANAN", "· NO SAVE")}</span>}
                  </span>
                  {isSelected && <span className="text-[18px] font-black">»</span>}
                </button>
              );
            })}
          </nav>

          <div
            className="mt-2 border px-4 py-1.5"
            style={{
              borderColor: "rgb(var(--cyan-rgb) / 0.20)",
              background: "linear-gradient(135deg, rgb(var(--cyan-rgb) / 0.055), rgba(3,8,15,0.62))",
              boxShadow: "inset 0 0 22px rgb(var(--cyan-rgb) / 0.035)",
            }}
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px]" style={{ color: "var(--cyan)" }}>{leadAdvisor.icon}</span>
                <span className="text-[10px] font-black tracking-[0.28em]" style={{ color: "var(--cyan)" }}>{t(lang, "PENASIHAT AI", "AI ADVISOR")}</span>
              </div>
              <span className="text-[8px] font-bold tracking-[0.18em]" style={{ color: "var(--neon-green)" }}>{activeAdvisors} {t(lang, "AKTIF", "ACTIVE")}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[12px] font-black tracking-[0.14em] text-white">{leadAdvisor.name}</div>
                <div className="truncate text-[9px] tracking-[0.13em]" style={{ color: "var(--gold)" }}>{leadAdvisor.role}</div>
              </div>
              <div className="shrink-0 border px-2 py-1 text-[8px] font-bold tracking-[0.18em]" style={{ borderColor: "rgb(var(--gold-rgb) / 0.35)", color: "var(--gold)" }}>
                {leadAdvisor.codename}
              </div>
            </div>
          </div>

          <div className="mt-3 border-t pt-2" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.12)" }}>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[21px] font-black" style={{ color: "var(--cyan)" }}>{mounted ? projectedSeats : Math.round(seatTotal * 0.48)}<span className="text-[12px]" style={{ color: "#6f8092" }}>/{seatTotal}</span></div>
                <div className="text-[10px] tracking-[0.25em]" style={{ color: "#64778b" }}>{t(lang, "KERUSI", "SEATS")}</div>
              </div>
              <div>
                <div className="text-[21px] font-black text-white">{nationalSupport.mandat}%</div>
                <div className="text-[10px] tracking-[0.25em]" style={{ color: "#64778b" }}>{t(lang, "SOKONGAN", "SUPPORT")}</div>
              </div>
              <div>
                <div className="truncate text-[17px] font-black" style={{ color: mediaSentiment === "positive" ? "var(--neon-green)" : mediaSentiment === "negative" ? "var(--neon-red)" : "var(--gold)" }}>{t(lang, mediaSentiment === "positive" ? "POSITIF" : mediaSentiment === "negative" ? "NEGATIF" : "NEUTRAL", mediaSentiment.toUpperCase())}</div>
                <div className="text-[10px] tracking-[0.25em]" style={{ color: "#64778b" }}>{t(lang, "SENTIMEN", "SENTIMENT")}</div>
              </div>
            </div>
          </div>

          {/* Election Timeline */}
          <div className="mt-4 border-t pt-3" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.12)" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-black tracking-[0.32em]" style={{ color: "var(--gold)" }}>{isPrn ? t(lang, "TIMELINE PRN", "ELECTION TIMELINE") : t(lang, "TIMELINE PRU", "ELECTION TIMELINE")}</span>
              <span className="text-[9px] font-bold tracking-[0.18em]" style={{ color: "var(--neon-red)" }}>{isPrn ? `PRN · ${prnState?.shortName ?? ""}` : "GE16"} · {t(lang, "AKTIF", "ACTIVE")}</span>
            </div>
            <div className="flex flex-col gap-0">
              {[
                { day: "T-30", labelMS: "PARLIMEN DIBUBAR",  labelEN: "PARLIAMENT DISSOLVED", date: "12 JUN", done: true },
                { day: "T-15", labelMS: "HARI PENAMAAN",     labelEN: "NOMINATION DAY",       date: "27 JUN", done: true },
                { day: "T-4",  labelMS: "PENGUNDIAN AWAL",   labelEN: "EARLY VOTING",         date: "8 JUL", done: false, active: false },
                { day: "T-1",  labelMS: "HARI TENANG",       labelEN: "COOLING-OFF DAY",      date: "11 JUL", done: false, active: false },
                { day: "T-0",  labelMS: "HARI MENGUNDI",     labelEN: "POLLING DAY",          date: "12 JUL", done: false, active: false },
              ].map((ev, i) => (
                <div key={i} className="flex items-stretch gap-3">
                  <div className="flex w-7 flex-col items-center">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full border" style={{
                      borderColor: ev.done ? "var(--neon-green)" : ev.active ? "var(--gold)" : "rgb(var(--cyan-rgb) / 0.35)",
                      background: ev.done ? "var(--neon-green)" : ev.active ? "var(--gold)" : "transparent",
                      boxShadow: ev.done ? "0 0 6px var(--neon-green)" : ev.active ? "0 0 6px var(--gold)" : "none",
                    }} />
                    {i < 4 && <div className="w-px flex-1" style={{ background: ev.done ? "rgb(0 255 136 / 0.25)" : "rgb(var(--cyan-rgb) / 0.10)" }} />}
                  </div>
                  <div className="pb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[9px] font-bold tracking-[0.18em]" style={{ color: ev.done ? "var(--neon-green)" : ev.active ? "var(--gold)" : "#4a5e72" }}>{ev.day}</span>
                      <span className="text-[9px] font-black tracking-[0.14em]" style={{ color: ev.done ? "#c8e6c9" : ev.active ? "var(--gold)" : "#8899aa" }}>{t(lang, ev.labelMS, ev.labelEN)}</span>
                    </div>
                    <div className="text-[8px] tracking-[0.16em]" style={{ color: "#3d5166" }}>{ev.date} 2025</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coalition Watch */}
          <div className="mt-2 border px-4 py-3" style={{
            borderColor: "rgb(var(--gold-rgb) / 0.18)",
            background: "linear-gradient(135deg, rgb(var(--gold-rgb) / 0.04), rgba(3,8,15,0.62))",
          }}>
            <div className="mb-2 text-[10px] font-black tracking-[0.28em]" style={{ color: "var(--gold)" }}>{t(lang, "PEMERHATIAN KOALISI", "COALITION WATCH")}</div>
            <div className="flex flex-col gap-1.5">
              {(mounted ? [
                { name: leader.partyAbbr || "MANDAT", seats: projectedSeats, color: leader.partyColor || "var(--cyan)", pct: Math.round((projectedSeats / seatTotal) * 100) },
                { name: "PEMBANGKANG", seats: seatTotal - projectedSeats - Math.round((seatTotal * nationalSupport.others) / 100), color: "var(--neon-red)", pct: Math.round(((seatTotal - projectedSeats - Math.round((seatTotal * nationalSupport.others) / 100)) / seatTotal) * 100) },
                { name: "BEBAS / LAIN", seats: Math.round((seatTotal * nationalSupport.others) / 100), color: "#a78bfa", pct: Math.round(nationalSupport.others) },
              ] : [
                { name: "MANDAT", seats: Math.round(seatTotal * 0.5), color: "var(--cyan)", pct: 50 },
                { name: "PEMBANGKANG", seats: Math.round(seatTotal * 0.37), color: "var(--neon-red)", pct: 37 },
                { name: "BEBAS / LAIN", seats: Math.round(seatTotal * 0.13), color: "#a78bfa", pct: 13 },
              ]).map((c, i) => (
                <div key={i}>
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="text-[8px] font-bold tracking-[0.14em]" style={{ color: c.color }}>{c.name}</span>
                    <span className="text-[9px] font-black" style={{ color: c.color }}>{c.seats} <span className="text-[7px] font-normal" style={{ color: "#4a5e72" }}>{t(lang, "kerusi", "seats")}</span></span>
                  </div>
                  <div className="h-[3px] w-full rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[8px] tracking-[0.14em]" style={{ color: "#3d5166" }}>{t(lang, `MAJORITI DIPERLUKAN · ${majorityTarget} KERUSI`, `MAJORITY REQUIRED · ${majorityTarget} SEATS`)}</div>
          </div>
        </aside>

        <div className="pointer-events-none relative z-10 min-w-0 overflow-hidden">
          <CornerFrame />
          <div className="absolute left-4 top-3 z-10 text-[10px] tracking-[0.34em]" style={{ color: "rgb(136 153 170 / 0.42)" }}>
            ↳ {isPrn
              ? t(lang, `PETA TAKTIKAL — ${prnState?.name?.toUpperCase() ?? "NEGERI"} · ${seatTotal} KERUSI`, `TACTICAL MAP — ${prnState?.name?.toUpperCase() ?? "STATE"} · ${seatTotal} SEATS`)
              : t(lang, "PETA TAKTIKAL — MALAYSIA · 222 KERUSI", "TACTICAL MAP — MALAYSIA · 222 SEATS")}
          </div>

          <div
            className="absolute left-8 right-60 top-11 z-20 flex h-9 items-center overflow-hidden border"
            style={{
              borderColor: "rgb(255 68 68 / 0.34)",
              background: "linear-gradient(90deg, rgba(255,68,68,0.16), rgba(3,8,15,0.72) 24%, rgba(3,8,15,0.48))",
              boxShadow: "0 0 24px rgb(255 68 68 / 0.10), inset 0 0 20px rgb(255 68 68 / 0.035)",
            }}
          >
            <div className="flex h-full shrink-0 items-center gap-2 px-3" style={{ background: "rgb(255 68 68 / 0.18)", color: "var(--neon-red)" }}>
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--neon-red)", boxShadow: "0 0 10px var(--neon-red)" }} />
              <span className="text-[10px] font-black tracking-[0.28em]">{t(lang, "BERITA LANGSUNG", "LIVE NEWS")}</span>
            </div>
            <div className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
              <div
                className="inline-flex items-center gap-8 pl-6 text-[10px] font-bold tracking-[0.22em]"
                style={{ color: "#d7e7f5", animation: "mymandat-live-news-scroll 24s linear infinite" }}
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
          <div
            className="absolute bottom-32 left-8 z-10 w-[360px] border px-5 py-4"
            style={{
              borderColor: "rgb(var(--gold-rgb) / 0.32)",
              background: "linear-gradient(135deg, rgba(240,165,0,0.10), rgba(3,8,15,0.72))",
              boxShadow: "0 0 28px rgb(var(--gold-rgb) / 0.10), inset 0 0 30px rgb(var(--gold-rgb) / 0.04)",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-black tracking-[0.32em]" style={{ color: "var(--gold)" }}>{t(lang, "STATUS PILIHAN RAYA", "ELECTION STATUS")}</span>
              <span className="text-[9px] font-bold tracking-[0.22em]" style={{ color: "var(--neon-red)" }}>
                {isPrn ? `PRN · ${prnState?.shortName ?? ""}` : "PRU16"} · {t(lang, "PILIHAN RAYA MENGEJUT", "SNAP POLL")}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[26px] font-black leading-none" style={{ color: "var(--gold)", textShadow: "0 0 18px rgb(var(--gold-rgb) / 0.45)" }}>{mounted ? daysLeft : totalDays}</div>
                <div className="mt-1 text-[8px] tracking-[0.22em]" style={{ color: "#718397" }}>{t(lang, "HARI BERBAKI", "DAYS LEFT")}</div>
              </div>
              <div>
                <div className="text-[26px] font-black leading-none" style={{ color: "var(--cyan)" }}>{seatTotal}</div>
                <div className="mt-1 text-[8px] tracking-[0.22em]" style={{ color: "#718397" }}>{t(lang, "KERUSI", "SEATS")}</div>
              </div>
              <div>
                <div className="text-[26px] font-black leading-none" style={{ color: "var(--neon-green)" }}>{majorityTarget}</div>
                <div className="mt-1 text-[8px] tracking-[0.22em]" style={{ color: "#718397" }}>{t(lang, "MAJORITI", "MAJORITY")}</div>
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden" style={{ background: "rgb(var(--cyan-rgb) / 0.10)" }}>
              <div className="mm-bar h-full" style={{ width: `${mounted ? campaignProgress : 0}%`, background: "linear-gradient(90deg, var(--gold), var(--cyan))", transition: "width 0.6s ease-out" }} />
            </div>
            <div className="mt-2 flex justify-between text-[8px] tracking-[0.2em]" style={{ color: "#718397" }}>
              <span>{t(lang, "TEMPOH KEMPEN", "CAMPAIGN WINDOW")}</span>
              <span style={{ color: "var(--gold)" }}>T–{mounted ? daysLeft : totalDays} / {mounted ? campaignProgress : 0}%</span>
            </div>
          </div>

          <div className="absolute right-5 top-6 z-10 flex w-48 flex-col gap-2.5">
            <IntelPanel title={t(lang, "RINGKASAN LANGSUNG", "LIVE BRIEF")}>
              <p className="text-[10px] leading-[1.55]" style={{ color: "#93a6b8" }}>
                {t(lang, "Parlimen dibubar. Penamaan calon selesai dahulu; tetingkap kempen 14 hari hanya bermula selepas penamaan dan tamat 1 hari sebelum hari mengundi.", "Parliament dissolved. Nomination is completed first; the 14-day campaign window starts only after nomination and ends 1 day before polling day.")}
              </p>
            </IntelPanel>

            <IntelPanel title={t(lang, "NADI PILIHAN RAYA", "ELECTION PULSE")}>
              <div className="space-y-2">
                {statusRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 text-[8px]">
                    <span className="whitespace-nowrap tracking-[0.14em]" style={{ color: "#75879b" }}>{row.label}</span>
                    <span className="whitespace-nowrap text-right font-black tracking-[0.1em]" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </IntelPanel>

            <IntelPanel title={t(lang, "OBJEKTIF", "OBJECTIVE")} tone="gold">
              <div className="flex items-end justify-between gap-3">
                <div className="text-[9px] leading-[1.6] tracking-[0.22em]" style={{ color: "#718397" }}>
                  <div>{t(lang, "KERUSI UNTUK MEMBENTUK KERAJAAN", "SEATS TO FORM GOVERNMENT")}</div>
                  <div>{t(lang, "DIJAMIN 0", "SECURED 0")}</div>
                </div>
                <div className="text-[34px] font-black leading-none" style={{ color: "var(--gold)", textShadow: "0 0 20px rgb(var(--gold-rgb) / 0.44)" }}>{majorityTarget}</div>
              </div>
            </IntelPanel>

            <IntelPanel title={t(lang, "PENGUNDI BERDAFTAR", "REGISTERED VOTERS")}>
              <div className="space-y-1.5">
                {(isPrn && prnState ? [{
                  negeri: prnState.name.toUpperCase(),
                  juta: prnState.registeredVoters / 1_000_000,
                  kerusi: prnState.dunSeats,
                  max: prnState.registeredVoters / 1_000_000,
                }] : [
                  { negeri: "SELANGOR",    juta: 3.1, kerusi: 22, max: 3.1 },
                  { negeri: "JOHOR",       juta: 2.3, kerusi: 26, max: 3.1 },
                  { negeri: "SABAH",       juta: 1.5, kerusi: 25, max: 3.1 },
                  { negeri: "PERAK",       juta: 1.4, kerusi: 24, max: 3.1 },
                  { negeri: "SARAWAK",     juta: 1.4, kerusi: 31, max: 3.1 },
                  { negeri: "KEDAH",       juta: 1.1, kerusi: 15, max: 3.1 },
                  { negeri: "KELANTAN",    juta: 1.0, kerusi: 14, max: 3.1 },
                  { negeri: "WP K.LUMPUR", juta: 0.8, kerusi: 11, max: 3.1 },
                  { negeri: "PAHANG",      juta: 0.8, kerusi: 14, max: 3.1 },
                  { negeri: "TERENGGANU", juta: 0.7, kerusi: 8,  max: 3.1 },
                  { negeri: "N.SEMBILAN", juta: 0.7, kerusi: 8,  max: 3.1 },
                  { negeri: "MELAKA",      juta: 0.5, kerusi: 6,  max: 3.1 },
                  { negeri: "PERLIS",      juta: 0.2, kerusi: 3,  max: 3.1 },
                ]).map((s) => (
                  <div key={s.negeri}>
                    <div className="flex items-center justify-between">
                      <span className="text-[7.5px] font-bold tracking-[0.10em]" style={{ color: "#8899aa" }}>{s.negeri}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[7px] tracking-[0.08em]" style={{ color: "#4a5e72" }}>{s.kerusi}{t(lang, "K", "S")}</span>
                        <span className="text-[7.5px] font-black" style={{ color: "var(--cyan)" }}>{s.juta.toFixed(1)}{t(lang, "J", "M")}</span>
                      </div>
                    </div>
                    <div className="mt-0.5 h-[2px] w-full rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(s.juta / s.max) * 100}%`, background: "linear-gradient(90deg, rgb(var(--cyan-rgb) / 0.7), rgb(var(--cyan-rgb) / 0.35))" }} />
                    </div>
                  </div>
                ))}
                <div className="pt-1 text-[7px] tracking-[0.14em]" style={{ color: "#2d3f52" }}>
                  {isPrn && prnState
                    ? t(lang, `JUMLAH · ${(prnState.registeredVoters / 1_000_000).toFixed(1)} JUTA PENGUNDI · ${prnState.name.toUpperCase()}`, `TOTAL · ${(prnState.registeredVoters / 1_000_000).toFixed(1)}M VOTERS · ${prnState.name.toUpperCase()}`)
                    : t(lang, "JUMLAH · 15.9 JUTA PENGUNDI · SPR 2025", "TOTAL · 15.9M VOTERS · EC 2025")}
                </div>
              </div>
            </IntelPanel>

            <IntelPanel title={t(lang, "UNJURAN KERUSI", "SEAT PROJECTION")} tone="gold">
              <div className="space-y-1">
                {(isPrn && prnState ? prnTopMarginSeats.map((c) => ({
                  negeri: c.name,
                  kerusi: 1,
                  proj: c.winner === "mandat" ? 1 : 0,
                  status: c.safety === "marginal" ? "SWING" : c.winner === "mandat" ? "WIN" : "LOSE",
                })) : [
                  { negeri: "SARAWAK",    kerusi: 31, proj: 18, status: "WIN" },
                  { negeri: "JOHOR",      kerusi: 26, proj: 14, status: "WIN" },
                  { negeri: "SABAH",      kerusi: 25, proj: 11, status: "SWING" },
                  { negeri: "PERAK",      kerusi: 24, proj: 12, status: "WIN" },
                  { negeri: "SELANGOR",   kerusi: 22, proj: 8,  status: "SWING" },
                  { negeri: "KEDAH",      kerusi: 15, proj: 5,  status: "LOSE" },
                  { negeri: "KELANTAN",   kerusi: 14, proj: 3,  status: "LOSE" },
                  { negeri: "PAHANG",     kerusi: 14, proj: 9,  status: "WIN" },
                  { negeri: "WP K.L",     kerusi: 11, proj: 6,  status: "SWING" },
                  { negeri: "TERENGGANU",kerusi: 8,  proj: 3,  status: "LOSE" },
                  { negeri: "N.SEMBILAN",kerusi: 8,  proj: 5,  status: "WIN" },
                  { negeri: "MELAKA",     kerusi: 6,  proj: 4,  status: "WIN" },
                  { negeri: "PERLIS",     kerusi: 3,  proj: 1,  status: "LOSE" },
                ]).map((s) => {
                  const statusColor = s.status === "WIN" ? "var(--neon-green)" : s.status === "LOSE" ? "var(--neon-red)" : "var(--gold)";
                  return (
                    <div key={s.negeri} className="flex items-center justify-between gap-1">
                      <span className="w-[72px] truncate text-[7.5px] tracking-[0.08em]" style={{ color: "#7a8fa3" }}>{s.negeri}</span>
                      <div className="flex flex-1 items-center gap-1">
                        <div className="h-[2px] flex-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                          <div className="h-full rounded-full" style={{ width: `${(s.proj / s.kerusi) * 100}%`, background: statusColor, boxShadow: `0 0 4px ${statusColor}` }} />
                        </div>
                        <span className="w-[18px] text-right text-[7.5px] font-black" style={{ color: statusColor }}>{s.proj}</span>
                      </div>
                      <span className="w-[26px] text-right text-[6.5px] font-bold tracking-[0.08em]" style={{ color: statusColor }}>{s.status === "WIN" ? t(lang, "MENANG", "WIN") : s.status === "LOSE" ? t(lang, "KALAH", "LOSE") : t(lang, "RAGU", "SWING")}</span>
                    </div>
                  );
                })}
                <div className="mt-1 flex items-center justify-between border-t pt-1" style={{ borderColor: "rgb(var(--gold-rgb) / 0.15)" }}>
                  <span className="text-[7px] tracking-[0.14em]" style={{ color: "#4a5e72" }}>{t(lang, "JUMLAH UNJURAN", "TOTAL PROJECTION")}</span>
                  <span className="text-[10px] font-black" style={{ color: "var(--gold)" }}>{isPrn ? `${projectedSeats} / ${seatTotal}` : "99 / 222"}</span>
                </div>
              </div>
            </IntelPanel>
          </div>
        </div>
      </section>

      <footer
        className="relative z-20 flex h-[26px] items-center justify-between border-t px-5 text-[9px] uppercase"
        style={{ borderColor: "rgb(var(--cyan-rgb) / 0.16)", background: "rgba(2, 7, 12, 0.96)", letterSpacing: "0.24em" }}
      >
        <span><span style={{ color: "var(--gold)" }}>➤ {t(lang, "SEDIA", "READY")}</span><span style={{ color: "#637589" }}> · {t(lang, "MULA KEMPEN UNTUK BERMAIN _", "START CAMPAIGN TO BEGIN _")}</span></span>
        <span style={{ color: "#637589" }}>↑↓ {t(lang, "NAVIGASI", "NAVIGATE")} · ↵ {t(lang, "PILIH", "SELECT")}</span>
      </footer>
    </main>
  );
}
