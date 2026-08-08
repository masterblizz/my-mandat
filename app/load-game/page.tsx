"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_SAVE_SLOTS,
  deleteSavedGame,
  getActiveSaveSlotId,
  getSavedGames,
  saveGameToSlot,
  setActiveSaveSlot,
  type SavedGameSlot,
} from "../store/saveGame";
import { useGameStore } from "../store/gameStore";
import { usePendingNav } from "../hooks/usePendingNav";
import { useLang, t, type Lang } from "../i18n/useLang";


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
  const [status, setStatus] = useState(t(lang, "load_game_page.scanLocalSaveSlots"));


  const refreshSlots = (preferredSlotNumber?: number) => {
    const records = getSavedGames();
    const activeId = getActiveSaveSlotId();
    const preferred = preferredSlotNumber ?? records.find((slot) => slot.id === activeId)?.slotNumber ?? records[0]?.slotNumber ?? 1;
    setSlots(records);
    setActiveSlotId(activeId);
    setSelectedSlotNumber(Math.max(1, Math.min(MAX_SAVE_SLOTS, preferred)));
    setStatus(t(lang, "load_game_page.saveSlotDetected", { recordsLength: records.length, mAX_SAVE_SLOTS: MAX_SAVE_SLOTS }));
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
    navigate("/kawasan", () => {
      setActiveSaveSlot(selectedSlot.id);
      setActiveSlotId(selectedSlot.id);
      useGameStore.setState({ ...selectedSlot.state, phase: "playing" });
      setStatus(t(lang, "load_game_page.slotLoaded", { selectedSlotSlotNumberPadStart: selectedSlot.slotNumber.toString().padStart(2, "0") }));
    });
  };

  const handleDelete = (slot: SavedGameSlot) => {
    deleteSavedGame(slot.id);
    refreshSlots(slot.slotNumber);
    setStatus(t(lang, "load_game_page.slotEmptyCleared", { slotSlotNumberPadStart: slot.slotNumber.toString().padStart(2, "0") }));
  };

  const handleManualSave = () => {
    if (!hasActiveGame) {
      setStatus(t(lang, "load_game_page.noActiveCampaignToSave"));
      return;
    }
    const saved = saveGameToSlot(currentGame, selectedSlotNumber);
    refreshSlots(selectedSlotNumber);
    setStatus(saved
      ? t(lang, "load_game_page.manualSaveCompleteSlotRewritten", { selectedSlotNumberPadStart: selectedSlotNumber.toString().padStart(2, "0") })
      : t(lang, "load_game_page.manualSaveFailed"));
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden px-8 py-7"
      style={{
        background:
          "radial-gradient(circle at 62% 42%, rgb(var(--cyan-rgb) / 0.08), transparent 34%), radial-gradient(circle at 18% 18%, rgb(var(--gold-rgb) / 0.04), transparent 26%), #05080e",
        color: "var(--text-primary)",
        fontFamily: "'Space Mono', 'Chakra Petch', monospace",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.24]" style={{ backgroundImage: "linear-gradient(rgb(var(--cyan-rgb) / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--cyan-rgb) / 0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.018), rgba(255,255,255,0.018) 1px, transparent 1px, transparent 4px)" }} />

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl items-center justify-center">
        <div className="w-full border p-6" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.24)", background: "linear-gradient(135deg, rgba(3,8,15,0.92), rgba(3,8,15,0.72))", boxShadow: "0 0 42px rgb(var(--cyan-rgb) / 0.08), inset 0 0 34px rgb(var(--cyan-rgb) / 0.035)" }}>
          <div className="mb-6 flex items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.16)" }}>
            <div>
              <div className="text-[10px] font-black tracking-[0.42em]" style={{ color: "var(--gold)" }}>{t(lang, "load_game_page.loadSaveGame")}</div>
              <h1 className="mt-2 text-[34px] font-black tracking-[-0.04em] text-white">{t(lang, "load_game_page.saveSlotCommand")}</h1>
              <div className="mt-1 text-[11px] tracking-[0.18em]" style={{ color: "#7d91a5" }}>{status}</div>
            </div>
            <button
              onClick={() => router.push("/")}
              className="border px-4 py-2 text-[10px] font-black tracking-[0.2em] transition hover:scale-[1.02]"
              style={{ borderColor: "rgb(var(--cyan-rgb) / 0.24)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / 0.045)" }}
            >
              {t(lang, "load_game_page.mainMenu")}
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid max-h-[64vh] gap-3 overflow-y-auto pr-2">
              {slotViews.map(({ slotNumber, slot }) => {
                const active = slotNumber === selectedSlotNumber;
                const activeCampaignSlot = slot?.id && slot.id === activeSlotId;
                const summary = slot ? getSummary(slot) : null;
                return (
                  <button
                    key={slotNumber}
                    onClick={() => setSelectedSlotNumber(slotNumber)}
                    className="group border p-4 text-left transition hover:scale-[1.005]"
                    style={{
                      borderColor: active ? "rgb(var(--gold-rgb) / 0.75)" : slot ? "rgb(var(--cyan-rgb) / 0.20)" : "rgb(136 153 170 / 0.18)",
                      background: active ? "linear-gradient(135deg, rgb(var(--gold-rgb) / 0.12), rgba(3,8,15,0.78))" : slot ? "rgba(3,8,15,0.58)" : "rgba(255,255,255,0.025)",
                      boxShadow: active ? "0 0 26px rgb(var(--gold-rgb) / 0.18)" : "none",
                      opacity: slot ? 1 : 0.74,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-black tracking-[0.28em]" style={{ color: active ? "var(--gold)" : slot ? "var(--cyan)" : "#718397" }}>
                          {t(lang, "load_game_page.slot")} {slotNumber.toString().padStart(2, "0")}{activeCampaignSlot ? t(lang, "load_game_page.autosaveTarget") : ""}
                        </div>
                        <div className="mt-2 text-[20px] font-black tracking-[0.12em] text-white">
                          {slot ? t(lang, "load_game_page.day", { slotStateLeader: slot.state.leader.partyAbbr, slotStateDay: slot.state.day, slotStateTotalDays: slot.state.totalDays }) : t(lang, "load_game_page.emptySlot")}
                        </div>
                        <div className="mt-1 text-[10px] tracking-[0.18em]" style={{ color: "#7d91a5" }}>
                          {slot ? t(lang, "load_game_page.saved", { formatSavedAtSlotSavedAt: formatSavedAt(slot.savedAt, lang) }) : t(lang, "load_game_page.availableForManualSaveOrNew")}
                        </div>
                      </div>
                      <span className="h-3 w-3 rounded-full" style={{ background: active ? "var(--gold)" : slot ? "var(--cyan)" : "#34465a", boxShadow: active ? "0 0 14px var(--gold)" : slot ? "0 0 10px var(--cyan)" : "none" }} />
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-3">
                      {slot && summary ? [
                        [t(lang, "load_game_page.projected"), `${summary.projectedSeats}/${summary.seatTotal}`],
                        [summary.isPrn ? t(lang, "load_game_page.negeri") : t(lang, "load_game_page.safeStates"), summary.isPrn ? (summary.stateName ?? "—") : String(summary.statesWon)],
                        [t(lang, "load_game_page.funds"), `RM ${summary.funds}`],
                        [t(lang, "load_game_page.sentiment"), t(lang, slot.state.mediaSentiment === "positive" ? "load_game_page.sentimentPositive" : slot.state.mediaSentiment === "negative" ? "load_game_page.sentimentNegative" : "load_game_page.sentimentNeutral")],
                      ].map(([label, value]) => (
                        <div key={label} className="border px-3 py-2" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.14)", background: "rgb(var(--cyan-rgb) / 0.035)" }}>
                          <div className="truncate text-[15px] font-black" style={{ color: label === t(lang, "load_game_page.funds") ? "var(--gold)" : "var(--cyan)" }}>{value}</div>
                          <div className="mt-1 text-[8px] tracking-[0.2em]" style={{ color: "#718397" }}>{label}</div>
                        </div>
                      )) : [t(lang, "load_game_page.projected"), t(lang, "load_game_page.safeStates"), t(lang, "load_game_page.funds"), t(lang, "load_game_page.sentiment")].map((label) => (
                        <div key={label} className="border px-3 py-2" style={{ borderColor: "rgb(136 153 170 / 0.10)", background: "rgba(255,255,255,0.018)" }}>
                          <div className="text-[15px] font-black" style={{ color: "#41556a" }}>--</div>
                          <div className="mt-1 text-[8px] tracking-[0.2em]" style={{ color: "#4f6276" }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <aside className="border p-4" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.22)", background: "rgba(3,8,15,0.58)" }}>
              <div className="text-[10px] font-black tracking-[0.28em]" style={{ color: "var(--cyan)" }}>{t(lang, "load_game_page.selectedSlot")}</div>
              <div className="mt-3 border p-4" style={{ borderColor: "rgb(var(--gold-rgb) / 0.30)", background: "rgb(var(--gold-rgb) / 0.065)" }}>
                <div className="text-[9px] font-black tracking-[0.24em]" style={{ color: "var(--gold)" }}>{t(lang, "load_game_page.slot")} {selectedSlotNumber.toString().padStart(2, "0")}</div>
                <div className="mt-2 text-[22px] font-black text-white">{selectedSlot ? selectedSlot.state.leader.partyAbbr : t(lang, "load_game_page.empty")}</div>
                <div className="text-[11px] leading-5" style={{ color: "#90a4b8" }}>{selectedSlot ? selectedSlot.state.leader.party : t(lang, "load_game_page.emptySlotCanBePickedFor")}</div>
              </div>
              <div className="mt-4 space-y-2 text-[10px] leading-5" style={{ color: "#90a4b8" }}>
                <p>{t(lang, "load_game_page.maximumSaveSlotsAllEmptySlots", { mAX_SAVE_SLOTS: MAX_SAVE_SLOTS })}</p>
                <p>{t(lang, "load_game_page.autosaveWillRewriteTheActiveCampaign")}</p>
                <p>{t(lang, "load_game_page.manualSaveCanPickAnySlot")}</p>
                {activeSlotId && (
                  <p style={{ color: "var(--gold)" }}>
                    {t(lang, "load_game_page.autosaveTarget2")}
                    {slots.find((slot) => slot.id === activeSlotId)?.slotNumber ? `${t(lang, "load_game_page.slot")} ${slots.find((slot) => slot.id === activeSlotId)?.slotNumber.toString().padStart(2, "0")}` : t(lang, "load_game_page.activeSlot")}
                  </p>
                )}
              </div>
              <div className="mt-5 grid gap-3">
                <button
                  onClick={handleManualSave}
                  disabled={!hasActiveGame}
                  className="px-5 py-3 text-[11px] font-black tracking-[0.22em] transition enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ background: "linear-gradient(90deg, var(--gold), #f7a81f)", color: "#05080e", boxShadow: "0 0 28px rgb(var(--gold-rgb) / 0.24)" }}
                >
                  {selectedSlot
                    ? t(lang, "load_game_page.replaceSlot", { selectedSlotNumberPadStart: selectedSlotNumber.toString().padStart(2, "0") })
                    : t(lang, "load_game_page.saveToSlot", { selectedSlotNumberPadStart: selectedSlotNumber.toString().padStart(2, "0") })} »
                </button>
                <button
                  onClick={handleLoad}
                  disabled={!selectedSlot || isPending}
                  className="border px-5 py-3 text-[11px] font-black tracking-[0.22em] disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ borderColor: "rgb(var(--cyan-rgb) / 0.35)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / 0.055)" }}
                >
                  {isPending ? t(lang, "load_game_page.loading") : selectedSlot ? t(lang, "load_game_page.loadSlot", { selectedSlotNumberPadStart: selectedSlotNumber.toString().padStart(2, "0") }) : t(lang, "load_game_page.loadDisabledEmpty")}
                </button>
                <button
                  onClick={() => selectedSlot && handleDelete(selectedSlot)}
                  disabled={!selectedSlot}
                  className="border px-5 py-3 text-[10px] font-black tracking-[0.22em] disabled:cursor-not-allowed disabled:opacity-35"
                  style={{ borderColor: "rgb(255 68 68 / 0.35)", color: "var(--neon-red)", background: "rgb(255 68 68 / 0.055)" }}
                >
                  {t(lang, "load_game_page.deleteSlot")}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
