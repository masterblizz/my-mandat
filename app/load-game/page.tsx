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
import IntroVideo from "../components/ui/IntroVideo";

function formatSavedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "UNKNOWN TIME";
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
  const statesWon = slot.state.states.filter((state) => state.status === "winning").length;
  const projectedSeats = slot.state.states.reduce((sum, state) => sum + state.projectedSeats, 0);
  return {
    statesWon,
    projectedSeats,
    funds: new Intl.NumberFormat("en-MY", { notation: "compact", maximumFractionDigits: 1 }).format(slot.state.resources.funds),
  };
}

function emptySlotLabel(slotNumber: number) {
  return `SLOT ${slotNumber.toString().padStart(2, "0")} · EMPTY`;
}

type SlotView = {
  slotNumber: number;
  slot: SavedGameSlot | null;
};

export default function LoadGamePage() {
  const router = useRouter();
  const currentGame = useGameStore();
  const [slots, setSlots] = useState<SavedGameSlot[]>([]);
  const [selectedSlotNumber, setSelectedSlotNumber] = useState(1);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [status, setStatus] = useState("SCAN LOCAL SAVE SLOTS");
  const [showIntro, setShowIntro] = useState(false);

  const refreshSlots = (preferredSlotNumber?: number) => {
    const records = getSavedGames();
    const activeId = getActiveSaveSlotId();
    const preferred = preferredSlotNumber ?? records.find((slot) => slot.id === activeId)?.slotNumber ?? records[0]?.slotNumber ?? 1;
    setSlots(records);
    setActiveSlotId(activeId);
    setSelectedSlotNumber(Math.max(1, Math.min(MAX_SAVE_SLOTS, preferred)));
    setStatus(records.length ? `${records.length}/${MAX_SAVE_SLOTS} SAVE SLOT DETECTED` : `0/${MAX_SAVE_SLOTS} SAVE SLOT DETECTED`);
  };

  useEffect(() => {
    refreshSlots();
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
    setActiveSaveSlot(selectedSlot.id);
    setActiveSlotId(selectedSlot.id);
    useGameStore.setState({ ...selectedSlot.state, phase: "playing" });
    setStatus(`SLOT ${selectedSlot.slotNumber.toString().padStart(2, "0")} LOADED · BOOTING TACTICAL CORE`);
    setShowIntro(true);
  };

  const handleDelete = (slot: SavedGameSlot) => {
    deleteSavedGame(slot.id);
    refreshSlots(slot.slotNumber);
    setStatus(`${emptySlotLabel(slot.slotNumber)} CLEARED`);
  };

  const handleManualSave = () => {
    if (!hasActiveGame) {
      setStatus("NO ACTIVE CAMPAIGN TO SAVE");
      return;
    }
    const saved = saveGameToSlot(currentGame, selectedSlotNumber);
    refreshSlots(selectedSlotNumber);
    setStatus(saved ? `MANUAL SAVE COMPLETE · SLOT ${selectedSlotNumber.toString().padStart(2, "0")} REWRITTEN` : "MANUAL SAVE FAILED");
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
      {showIntro && selectedSlot && (
        <IntroVideo
          leaderName={selectedSlot.state.leader.name}
          partyName={selectedSlot.state.leader.party}
          partyAbbr={selectedSlot.state.leader.partyAbbr}
          partyColor={selectedSlot.state.leader.partyColor}
          difficulty={selectedSlot.state.difficulty}
          onComplete={() => router.push("/warroom")}
        />
      )}
      <div className="pointer-events-none absolute inset-0 opacity-[0.24]" style={{ backgroundImage: "linear-gradient(rgb(var(--cyan-rgb) / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--cyan-rgb) / 0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.018), rgba(255,255,255,0.018) 1px, transparent 1px, transparent 4px)" }} />

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl items-center justify-center">
        <div className="w-full border p-6" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.24)", background: "linear-gradient(135deg, rgba(3,8,15,0.92), rgba(3,8,15,0.72))", boxShadow: "0 0 42px rgb(var(--cyan-rgb) / 0.08), inset 0 0 34px rgb(var(--cyan-rgb) / 0.035)" }}>
          <div className="mb-6 flex items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.16)" }}>
            <div>
              <div className="text-[10px] font-black tracking-[0.42em]" style={{ color: "var(--gold)" }}>LOAD / SAVE GAME</div>
              <h1 className="mt-2 text-[34px] font-black tracking-[-0.04em] text-white">SAVE SLOT COMMAND</h1>
              <div className="mt-1 text-[11px] tracking-[0.18em]" style={{ color: "#7d91a5" }}>{status}</div>
            </div>
            <button
              onClick={() => router.push("/")}
              className="border px-4 py-2 text-[10px] font-black tracking-[0.2em] transition hover:scale-[1.02]"
              style={{ borderColor: "rgb(var(--cyan-rgb) / 0.24)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / 0.045)" }}
            >
              ← MAIN MENU
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
                          SLOT {slotNumber.toString().padStart(2, "0")}{activeCampaignSlot ? " · AUTOSAVE TARGET" : ""}
                        </div>
                        <div className="mt-2 text-[20px] font-black tracking-[0.12em] text-white">
                          {slot ? `${slot.state.leader.partyAbbr} · DAY ${slot.state.day}/${slot.state.totalDays}` : "EMPTY SLOT"}
                        </div>
                        <div className="mt-1 text-[10px] tracking-[0.18em]" style={{ color: "#7d91a5" }}>
                          {slot ? `SAVED ${formatSavedAt(slot.savedAt)}` : "Available for manual save or new campaign"}
                        </div>
                      </div>
                      <span className="h-3 w-3 rounded-full" style={{ background: active ? "var(--gold)" : slot ? "var(--cyan)" : "#34465a", boxShadow: active ? "0 0 14px var(--gold)" : slot ? "0 0 10px var(--cyan)" : "none" }} />
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-3">
                      {slot && summary ? [
                        ["PROJECTED", `${summary.projectedSeats}/222`],
                        ["SAFE STATES", String(summary.statesWon)],
                        ["FUNDS", `RM ${summary.funds}`],
                        ["SENTIMENT", slot.state.mediaSentiment.toUpperCase()],
                      ].map(([label, value]) => (
                        <div key={label} className="border px-3 py-2" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.14)", background: "rgb(var(--cyan-rgb) / 0.035)" }}>
                          <div className="text-[15px] font-black" style={{ color: label === "FUNDS" ? "var(--gold)" : "var(--cyan)" }}>{value}</div>
                          <div className="mt-1 text-[8px] tracking-[0.2em]" style={{ color: "#718397" }}>{label}</div>
                        </div>
                      )) : ["PROJECTED", "SAFE STATES", "FUNDS", "SENTIMENT"].map((label) => (
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
              <div className="text-[10px] font-black tracking-[0.28em]" style={{ color: "var(--cyan)" }}>SELECTED SLOT</div>
              <div className="mt-3 border p-4" style={{ borderColor: "rgb(var(--gold-rgb) / 0.30)", background: "rgb(var(--gold-rgb) / 0.065)" }}>
                <div className="text-[9px] font-black tracking-[0.24em]" style={{ color: "var(--gold)" }}>SLOT {selectedSlotNumber.toString().padStart(2, "0")}</div>
                <div className="mt-2 text-[22px] font-black text-white">{selectedSlot ? selectedSlot.state.leader.partyAbbr : "EMPTY"}</div>
                <div className="text-[11px] leading-5" style={{ color: "#90a4b8" }}>{selectedSlot ? selectedSlot.state.leader.party : "Slot kosong — boleh pilih untuk manual save."}</div>
              </div>
              <div className="mt-4 space-y-2 text-[10px] leading-5" style={{ color: "#90a4b8" }}>
                <p>Maximum {MAX_SAVE_SLOTS} save slots. Semua slot kosong tetap dipaparkan.</p>
                <p>Autosave akan rewrite slot aktif campaign, bukan cipta slot baru setiap kali save.</p>
                <p>Manual save boleh pilih mana-mana slot dan replace isi slot tersebut.</p>
                {activeSlotId && <p style={{ color: "var(--gold)" }}>AUTOSAVE TARGET: {slots.find((slot) => slot.id === activeSlotId)?.slotNumber ? `SLOT ${slots.find((slot) => slot.id === activeSlotId)?.slotNumber.toString().padStart(2, "0")}` : "ACTIVE SLOT"}</p>}
              </div>
              <div className="mt-5 grid gap-3">
                <button
                  onClick={handleManualSave}
                  disabled={!hasActiveGame}
                  className="px-5 py-3 text-[11px] font-black tracking-[0.22em] transition enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ background: "linear-gradient(90deg, var(--gold), #f7a81f)", color: "#05080e", boxShadow: "0 0 28px rgb(var(--gold-rgb) / 0.24)" }}
                >
                  {selectedSlot ? `REPLACE SLOT ${selectedSlotNumber.toString().padStart(2, "0")}` : `SAVE TO SLOT ${selectedSlotNumber.toString().padStart(2, "0")}`} »
                </button>
                <button
                  onClick={handleLoad}
                  disabled={!selectedSlot}
                  className="border px-5 py-3 text-[11px] font-black tracking-[0.22em] disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ borderColor: "rgb(var(--cyan-rgb) / 0.35)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / 0.055)" }}
                >
                  {selectedSlot ? `LOAD SLOT ${selectedSlotNumber.toString().padStart(2, "0")} »` : "LOAD DISABLED · EMPTY"}
                </button>
                <button
                  onClick={() => selectedSlot && handleDelete(selectedSlot)}
                  disabled={!selectedSlot}
                  className="border px-5 py-3 text-[10px] font-black tracking-[0.22em] disabled:cursor-not-allowed disabled:opacity-35"
                  style={{ borderColor: "rgb(255 68 68 / 0.35)", color: "var(--neon-red)", background: "rgb(255 68 68 / 0.055)" }}
                >
                  DELETE SLOT
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
