"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_SAVE_SLOTS,
  deleteSavedGame,
  formatSaveLabel,
  getActiveSaveSlotId,
  getSavedGames,
  saveGameToSlot,
  setActiveSaveSlot,
  type SavedGameSlot,
} from "../store/saveGame";
import { hubRoute, normalizeJourney } from "../store/journey";
import { useGameStore } from "../store/gameStore";
import { usePendingNav } from "../hooks/usePendingNav";
import { useLang, t, type Lang } from "../i18n/useLang";
import LangThemeToggle from "../components/layout/LangThemeToggle";
import Fold from "../components/results/Fold";


function formatSavedAt(value: string, lang: Lang) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t(lang, "load_game_page.unknownTime");
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).toUpperCase();
}

function getSummary(slot: SavedGameSlot) {
  const isPrn = slot.state.settings?.electionScope === "prn";
  const prnState = isPrn ? slot.state.states.find((state) => state.id === slot.state.settings.prnStateId) ?? null : null;
  // A PRN save only ever contests one negeri — score it against that state's
  // dunSeats, not the national states/seats tally the PRU branch uses.
  const statesWon = isPrn ? undefined : slot.state.states.filter((state) => state.status === "winning").length;
  const seatTotal = isPrn ? (prnState?.dunSeats ?? 0) : 222;
  const projectedSeats = isPrn ? (prnState?.projectedSeats ?? 0) : slot.state.states.reduce((sum, state) => sum + state.projectedSeats, 0);
  return {
    isPrn,
    stateName: prnState?.name,
    statesWon,
    projectedSeats,
    seatTotal,
    funds: new Intl.NumberFormat("en-MY", { notation: "compact", maximumFractionDigits: 1 }).format(slot.state.resources.funds),
  };
}

type SlotView = {
  slotNumber: number;
  slot: SavedGameSlot | null;
};

export default function LoadGamePage() {
  const router = useRouter();
  const lang = useLang();
  const { isPending, navigate } = usePendingNav();
  const currentGame = useGameStore();
  const [slots, setSlots] = useState<SavedGameSlot[]>([]);
  const [selectedSlotNumber, setSelectedSlotNumber] = useState(1);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  // Keep the status as a dictionary key + vars so it re-renders in the live UI language.
  const [status, setStatusState] = useState<{ key: string; vars?: Record<string, string | number> }>({ key: "load_game_page.scanLocalSaveSlots" });
  const setStatus = (key: string, vars?: Record<string, string | number>) => setStatusState({ key, vars });


  const refreshSlots = (preferredSlotNumber?: number) => {
    const records = getSavedGames();
    const activeId = getActiveSaveSlotId();
    const preferred = preferredSlotNumber ?? records.find((slot) => slot.id === activeId)?.slotNumber ?? records[0]?.slotNumber ?? 1;
    setSlots(records);
    setActiveSlotId(activeId);
    setSelectedSlotNumber(Math.max(1, Math.min(MAX_SAVE_SLOTS, preferred)));
    setStatus("load_game_page.saveSlotDetected", { recordsLength: records.length, mAX_SAVE_SLOTS: MAX_SAVE_SLOTS });
  };

  useEffect(() => {
    refreshSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slotViews = useMemo<SlotView[]>(
    () => Array.from({ length: MAX_SAVE_SLOTS }, (_, index) => {
      const slotNumber = index + 1;
      return {
        slotNumber,
        slot: slots.find((item) => item.slotNumber === slotNumber) ?? null,
      };
    }),
    [slots]
  );

  const selectedView = useMemo(
    () => slotViews.find((slot) => slot.slotNumber === selectedSlotNumber) ?? slotViews[0],
    [selectedSlotNumber, slotViews]
  );
  const selectedSlot = selectedView?.slot ?? null;
  const hasActiveGame = currentGame.phase === "playing" || currentGame.phase === "ended";

  const handleLoad = () => {
    if (!selectedSlot) return;
    navigate(hubRoute(selectedSlot.state), () => {
      setActiveSaveSlot(selectedSlot.id);
      setActiveSlotId(selectedSlot.id);
      useGameStore.setState({ ...selectedSlot.state, journey: normalizeJourney(selectedSlot.state.journey), phase: "playing" });
      setStatus("load_game_page.slotLoaded", { selectedSlotSlotNumberPadStart: selectedSlot.slotNumber.toString().padStart(2, "0") });
    });
  };

  const handleDelete = (slot: SavedGameSlot) => {
    deleteSavedGame(slot.id);
    refreshSlots(slot.slotNumber);
    setStatus("load_game_page.slotEmptyCleared", { slotSlotNumberPadStart: slot.slotNumber.toString().padStart(2, "0") });
  };

  const handleManualSave = () => {
    if (!hasActiveGame) {
      setStatus("load_game_page.noActiveCampaignToSave");
      return;
    }
    const saved = saveGameToSlot(currentGame, selectedSlotNumber);
    refreshSlots(selectedSlotNumber);
    if (saved) setStatus("load_game_page.manualSaveCompleteSlotRewritten", { selectedSlotNumberPadStart: selectedSlotNumber.toString().padStart(2, "0") });
    else setStatus("load_game_page.manualSaveFailed");
  };

  return (
    <main
      className="load-game-screen relative min-h-screen overflow-hidden px-4 py-4 sm:px-8 sm:py-7"
      style={{
        background:
          "radial-gradient(circle at 62% 42%, rgb(var(--cyan-rgb) / 0.08), transparent 34%), radial-gradient(circle at 18% 18%, rgb(var(--gold-rgb) / 0.04), transparent 26%), var(--bg)",
        color: "var(--text-primary)",
        fontFamily: "'Space Mono', 'Chakra Petch', monospace",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.24]" style={{ backgroundImage: "linear-gradient(rgb(var(--cyan-rgb) / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--cyan-rgb) / 0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.018), rgba(255,255,255,0.018) 1px, transparent 1px, transparent 4px)" }} />

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-32px)] max-w-6xl items-center justify-center">
        <div className="w-full border p-3 sm:p-6" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.24)", background: "linear-gradient(135deg, rgb(var(--bg-rgb) / 0.92), rgb(var(--bg-rgb) / 0.72))", boxShadow: "0 0 42px rgb(var(--cyan-rgb) / 0.08), inset 0 0 34px rgb(var(--cyan-rgb) / 0.035)" }}>
          <div className="mb-3 flex items-center justify-between gap-3 border-b pb-3 sm:mb-5 sm:pb-4" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.16)" }}>
            <div className="min-w-0">
              <h1 className="text-[22px] font-black tracking-[-0.02em] text-white sm:text-[30px]">💾 {t(lang, "SLOT SIMPAN", "SAVE SLOTS")}</h1>
              <div className="mt-0.5 truncate text-[10px] tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{t(lang, status.key, status.vars)}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <LangThemeToggle />
              <button
                onClick={() => router.push("/")}
                className="min-h-[40px] border px-3 py-2 text-[10px] font-black tracking-[0.2em] transition hover:scale-[1.02]"
                style={{ borderColor: "rgb(var(--cyan-rgb) / 0.24)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / 0.045)" }}
              >
                ← {t(lang, "MENU", "MENU")}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5">
            <div className="grid max-h-[calc(100vh-150px)] content-start gap-2 overflow-y-auto pr-1 sm:max-h-[64vh] sm:gap-3">
              {slotViews.map(({ slotNumber, slot }) => {
                const active = slotNumber === selectedSlotNumber;
                const activeCampaignSlot = slot?.id && slot.id === activeSlotId;
                const summary = slot ? getSummary(slot) : null;
                return (
                  <button
                    key={slotNumber}
                    onClick={() => setSelectedSlotNumber(slotNumber)}
                    className="group border px-3 py-2.5 text-left transition hover:scale-[1.005] sm:p-4"
                    style={{
                      borderColor: active ? "rgb(var(--gold-rgb) / 0.75)" : slot ? "rgb(var(--cyan-rgb) / 0.20)" : "rgb(136 153 170 / 0.18)",
                      background: active ? "linear-gradient(135deg, rgb(var(--gold-rgb) / 0.12), rgb(var(--bg-rgb) / 0.78))" : slot ? "rgb(var(--bg-rgb) / 0.58)" : "rgba(255,255,255,0.025)",
                      boxShadow: active ? "0 0 26px rgb(var(--gold-rgb) / 0.18)" : "none",
                      opacity: slot ? 1 : 0.74,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black tracking-[0.2em]" style={{ color: active ? "var(--gold)" : slot ? "var(--cyan)" : "#718397" }}>
                          <span>{t(lang, "load_game_page.slot")} {slotNumber.toString().padStart(2, "0")}</span>
                          {activeCampaignSlot && <span className="rounded-full border px-2 py-0.5 text-[8px]" style={{ borderColor: "rgb(var(--gold-rgb) / 0.5)", color: "var(--gold)" }}>⟳ AUTO</span>}
                        </div>
                        <div className="mt-1 truncate text-[16px] font-black tracking-[0.1em] text-white sm:text-[20px]">
                          {slot ? formatSaveLabel(slot.state, lang).toUpperCase() : t(lang, "load_game_page.emptySlot")}
                        </div>
                        {slot && (
                          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                            <span>🕒 {formatSavedAt(slot.savedAt, lang)}</span>
                            <span className="truncate" style={{ color: "var(--cyan)" }}>📍 {slot.state.leader.homeConstituencyName || "—"}</span>
                          </div>
                        )}
                      </div>
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: active ? "var(--gold)" : slot ? "var(--cyan)" : "#34465a", boxShadow: active ? "0 0 14px var(--gold)" : slot ? "0 0 10px var(--cyan)" : "none" }} />
                    </div>

                    {slot && summary && (
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black">
                        {[
                          { icon: "🗳️", value: `${summary.projectedSeats}/${summary.seatTotal}`, title: t(lang, "load_game_page.projected"), color: "var(--cyan)" },
                          { icon: summary.isPrn ? "🗺️" : "🏴", value: summary.isPrn ? (summary.stateName ?? "—") : String(summary.statesWon), title: summary.isPrn ? t(lang, "load_game_page.negeri") : t(lang, "load_game_page.safeStates"), color: "var(--cyan)" },
                          { icon: "💰", value: `RM ${summary.funds}`, title: t(lang, "load_game_page.funds"), color: "var(--gold)" },
                          { icon: "📰", value: t(lang, slot.state.mediaSentiment === "positive" ? "load_game_page.sentimentPositive" : slot.state.mediaSentiment === "negative" ? "load_game_page.sentimentNegative" : "load_game_page.sentimentNeutral"), title: t(lang, "load_game_page.sentiment"), color: slot.state.mediaSentiment === "positive" ? "var(--neon-green)" : slot.state.mediaSentiment === "negative" ? "var(--neon-red)" : "var(--text-muted)" },
                        ].map((item) => (
                          <span key={item.title} title={item.title} className="rounded-full border px-2.5 py-1" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.16)", background: "rgb(var(--cyan-rgb) / 0.035)", color: item.color }}>
                            {item.icon} {item.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <aside className="flex flex-col border p-3 sm:p-4" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.22)", background: "rgb(var(--bg-rgb) / 0.58)" }}>
              <div className="border p-3" style={{ borderColor: "rgb(var(--gold-rgb) / 0.30)", background: "rgb(var(--gold-rgb) / 0.065)" }}>
                <div className="text-[9px] font-black tracking-[0.24em]" style={{ color: "var(--gold)" }}>▶ {t(lang, "load_game_page.slot")} {selectedSlotNumber.toString().padStart(2, "0")}</div>
                <div className="mt-1 truncate text-[20px] font-black text-white">{selectedSlot ? selectedSlot.state.leader.partyAbbr : t(lang, "load_game_page.empty")}</div>
                {selectedSlot && <div className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{selectedSlot.state.leader.party}</div>}
              </div>
              <div className="mt-3 grid gap-2">
                <button
                  onClick={handleLoad}
                  disabled={!selectedSlot || isPending}
                  className="min-h-[44px] px-4 py-3 text-[12px] font-black tracking-[0.2em] transition enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ background: "linear-gradient(90deg, var(--gold), #f7a81f)", color: "#05080e", boxShadow: "0 0 28px rgb(var(--gold-rgb) / 0.24)" }}
                >
                  {isPending ? t(lang, "load_game_page.loading") : selectedSlot ? `▶ ${t(lang, "MUAT", "LOAD")}` : `— ${t(lang, "load_game_page.empty")}`}
                </button>
                <button
                  onClick={handleManualSave}
                  disabled={!hasActiveGame}
                  className="min-h-[44px] border px-4 py-3 text-[11px] font-black tracking-[0.2em] disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ borderColor: "rgb(var(--cyan-rgb) / 0.35)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / 0.055)" }}
                >
                  💾 {selectedSlot ? t(lang, "GANTI", "REPLACE") : t(lang, "SIMPAN", "SAVE")}
                </button>
                <button
                  onClick={() => selectedSlot && handleDelete(selectedSlot)}
                  disabled={!selectedSlot}
                  className="min-h-[40px] border px-4 py-2 text-[10px] font-black tracking-[0.22em] disabled:cursor-not-allowed disabled:opacity-35"
                  style={{ borderColor: "rgb(255 68 68 / 0.35)", color: "var(--neon-red)", background: "rgb(255 68 68 / 0.055)" }}
                >
                  🗑 {t(lang, "PADAM", "DELETE")}
                </button>
              </div>
              <Fold className="mt-3 text-[10px] leading-5" style={{ color: "var(--text-muted)" }} summaryClassName="text-[10px]" summary={<>
                  <span>ⓘ</span>
                  <span>{activeSlotId
                    ? `⟳ AUTO: ${slots.find((slot) => slot.id === activeSlotId)?.slotNumber ? `${t(lang, "load_game_page.slot")} ${slots.find((slot) => slot.id === activeSlotId)?.slotNumber.toString().padStart(2, "0")}` : t(lang, "load_game_page.activeSlot")}`
                    : t(lang, "INFO", "INFO")}</span>
                </>}>
                <div className="space-y-1.5 pt-1">
                  <p>{t(lang, "load_game_page.maximumSaveSlotsAllEmptySlots", { mAX_SAVE_SLOTS: MAX_SAVE_SLOTS })}</p>
                  <p>{t(lang, "load_game_page.autosaveWillRewriteTheActiveCampaign")}</p>
                  <p>{t(lang, "load_game_page.manualSaveCanPickAnySlot")}</p>
                </div>
              </Fold>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
