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
  if (Number.isNaN(date.getTime())) return t(lang, "MASA TIDAK DIKETAHUI", "UNKNOWN TIME");
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
  const [status, setStatus] = useState(t(lang, "MENGIMBAS SLOT SIMPAN TEMPATAN", "SCAN LOCAL SAVE SLOTS"));


  const refreshSlots = (preferredSlotNumber?: number) => {
    const records = getSavedGames();
    const activeId = getActiveSaveSlotId();
    const preferred = preferredSlotNumber ?? records.find((slot) => slot.id === activeId)?.slotNumber ?? records[0]?.slotNumber ?? 1;
    setSlots(records);
    setActiveSlotId(activeId);
    setSelectedSlotNumber(Math.max(1, Math.min(MAX_SAVE_SLOTS, preferred)));
    setStatus(t(lang, `${records.length}/${MAX_SAVE_SLOTS} SLOT SIMPAN DIKESAN`, `${records.length}/${MAX_SAVE_SLOTS} SAVE SLOT DETECTED`));
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
      setStatus(t(lang, `SLOT ${selectedSlot.slotNumber.toString().padStart(2, "0")} DIMUATKAN`, `SLOT ${selectedSlot.slotNumber.toString().padStart(2, "0")} LOADED`));
    });
  };

  const handleDelete = (slot: SavedGameSlot) => {
    deleteSavedGame(slot.id);
    refreshSlots(slot.slotNumber);
    setStatus(t(lang, `SLOT ${slot.slotNumber.toString().padStart(2, "0")} · KOSONG DIKOSONGKAN`, `SLOT ${slot.slotNumber.toString().padStart(2, "0")} · EMPTY CLEARED`));
  };

  const handleManualSave = () => {
    if (!hasActiveGame) {
      setStatus(t(lang, "TIADA KEMPEN AKTIF UNTUK DISIMPAN", "NO ACTIVE CAMPAIGN TO SAVE"));
      return;
    }
    const saved = saveGameToSlot(currentGame, selectedSlotNumber);
    refreshSlots(selectedSlotNumber);
    setStatus(saved
      ? t(lang, `SIMPAN MANUAL SELESAI · SLOT ${selectedSlotNumber.toString().padStart(2, "0")} DITULIS SEMULA`, `MANUAL SAVE COMPLETE · SLOT ${selectedSlotNumber.toString().padStart(2, "0")} REWRITTEN`)
      : t(lang, "SIMPAN MANUAL GAGAL", "MANUAL SAVE FAILED"));
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
              <div className="text-[10px] font-black tracking-[0.42em]" style={{ color: "var(--gold)" }}>{t(lang, "MUAT / SIMPAN PERMAINAN", "LOAD / SAVE GAME")}</div>
              <h1 className="mt-2 text-[34px] font-black tracking-[-0.04em] text-white">{t(lang, "ARAHAN SLOT SIMPAN", "SAVE SLOT COMMAND")}</h1>
              <div className="mt-1 text-[11px] tracking-[0.18em]" style={{ color: "#7d91a5" }}>{status}</div>
            </div>
            <button
              onClick={() => router.push("/")}
              className="border px-4 py-2 text-[10px] font-black tracking-[0.2em] transition hover:scale-[1.02]"
              style={{ borderColor: "rgb(var(--cyan-rgb) / 0.24)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / 0.045)" }}
            >
              {t(lang, "← MENU UTAMA", "← MAIN MENU")}
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
                          {t(lang, "SLOT", "SLOT")} {slotNumber.toString().padStart(2, "0")}{activeCampaignSlot ? t(lang, " · SASARAN AUTOSAVE", " · AUTOSAVE TARGET") : ""}
                        </div>
                        <div className="mt-2 text-[20px] font-black tracking-[0.12em] text-white">
                          {slot ? t(lang, `${slot.state.leader.partyAbbr} · HARI ${slot.state.day}/${slot.state.totalDays}`, `${slot.state.leader.partyAbbr} · DAY ${slot.state.day}/${slot.state.totalDays}`) : t(lang, "SLOT KOSONG", "EMPTY SLOT")}
                        </div>
                        <div className="mt-1 text-[10px] tracking-[0.18em]" style={{ color: "#7d91a5" }}>
                          {slot ? t(lang, `DISIMPAN ${formatSavedAt(slot.savedAt, lang)}`, `SAVED ${formatSavedAt(slot.savedAt, lang)}`) : t(lang, "Tersedia untuk simpan manual atau kempen baharu", "Available for manual save or new campaign")}
                        </div>
                      </div>
                      <span className="h-3 w-3 rounded-full" style={{ background: active ? "var(--gold)" : slot ? "var(--cyan)" : "#34465a", boxShadow: active ? "0 0 14px var(--gold)" : slot ? "0 0 10px var(--cyan)" : "none" }} />
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-3">
                      {slot && summary ? [
                        [t(lang, "UNJURAN", "PROJECTED"), `${summary.projectedSeats}/${summary.seatTotal}`],
                        [summary.isPrn ? t(lang, "NEGERI", "NEGERI") : t(lang, "NEGERI SELAMAT", "SAFE STATES"), summary.isPrn ? (summary.stateName ?? "—") : String(summary.statesWon)],
                        [t(lang, "DANA", "FUNDS"), `RM ${summary.funds}`],
                        [t(lang, "SENTIMEN", "SENTIMENT"), t(lang, slot.state.mediaSentiment === "positive" ? "POSITIF" : slot.state.mediaSentiment === "negative" ? "NEGATIF" : "NEUTRAL", slot.state.mediaSentiment.toUpperCase())],
                      ].map(([label, value]) => (
                        <div key={label} className="border px-3 py-2" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.14)", background: "rgb(var(--cyan-rgb) / 0.035)" }}>
                          <div className="truncate text-[15px] font-black" style={{ color: label === t(lang, "DANA", "FUNDS") ? "var(--gold)" : "var(--cyan)" }}>{value}</div>
                          <div className="mt-1 text-[8px] tracking-[0.2em]" style={{ color: "#718397" }}>{label}</div>
                        </div>
                      )) : [t(lang, "UNJURAN", "PROJECTED"), t(lang, "NEGERI SELAMAT", "SAFE STATES"), t(lang, "DANA", "FUNDS"), t(lang, "SENTIMEN", "SENTIMENT")].map((label) => (
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
              <div className="text-[10px] font-black tracking-[0.28em]" style={{ color: "var(--cyan)" }}>{t(lang, "SLOT DIPILIH", "SELECTED SLOT")}</div>
              <div className="mt-3 border p-4" style={{ borderColor: "rgb(var(--gold-rgb) / 0.30)", background: "rgb(var(--gold-rgb) / 0.065)" }}>
                <div className="text-[9px] font-black tracking-[0.24em]" style={{ color: "var(--gold)" }}>{t(lang, "SLOT", "SLOT")} {selectedSlotNumber.toString().padStart(2, "0")}</div>
                <div className="mt-2 text-[22px] font-black text-white">{selectedSlot ? selectedSlot.state.leader.partyAbbr : t(lang, "KOSONG", "EMPTY")}</div>
                <div className="text-[11px] leading-5" style={{ color: "#90a4b8" }}>{selectedSlot ? selectedSlot.state.leader.party : t(lang, "Slot kosong — boleh pilih untuk simpan manual.", "Empty slot — can be picked for a manual save.")}</div>
              </div>
              <div className="mt-4 space-y-2 text-[10px] leading-5" style={{ color: "#90a4b8" }}>
                <p>{t(lang, `Maksimum ${MAX_SAVE_SLOTS} slot simpan. Semua slot kosong tetap dipaparkan.`, `Maximum ${MAX_SAVE_SLOTS} save slots. All empty slots are always shown.`)}</p>
                <p>{t(lang, "Autosave akan menulis semula slot aktif kempen, bukan cipta slot baharu setiap kali simpan.", "Autosave will rewrite the active campaign slot, not create a new slot every time it saves.")}</p>
                <p>{t(lang, "Simpan manual boleh pilih mana-mana slot dan ganti kandungan slot tersebut.", "Manual save can pick any slot and replace that slot's contents.")}</p>
                {activeSlotId && (
                  <p style={{ color: "var(--gold)" }}>
                    {t(lang, "SASARAN AUTOSAVE: ", "AUTOSAVE TARGET: ")}
                    {slots.find((slot) => slot.id === activeSlotId)?.slotNumber ? `${t(lang, "SLOT", "SLOT")} ${slots.find((slot) => slot.id === activeSlotId)?.slotNumber.toString().padStart(2, "0")}` : t(lang, "SLOT AKTIF", "ACTIVE SLOT")}
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
                    ? t(lang, `GANTI SLOT ${selectedSlotNumber.toString().padStart(2, "0")}`, `REPLACE SLOT ${selectedSlotNumber.toString().padStart(2, "0")}`)
                    : t(lang, `SIMPAN KE SLOT ${selectedSlotNumber.toString().padStart(2, "0")}`, `SAVE TO SLOT ${selectedSlotNumber.toString().padStart(2, "0")}`)} »
                </button>
                <button
                  onClick={handleLoad}
                  disabled={!selectedSlot || isPending}
                  className="border px-5 py-3 text-[11px] font-black tracking-[0.22em] disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ borderColor: "rgb(var(--cyan-rgb) / 0.35)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / 0.055)" }}
                >
                  {isPending ? t(lang, "⟳ MEMUATKAN...", "⟳ LOADING...") : selectedSlot ? t(lang, `MUAT SLOT ${selectedSlotNumber.toString().padStart(2, "0")} »`, `LOAD SLOT ${selectedSlotNumber.toString().padStart(2, "0")} »`) : t(lang, "MUAT DILUMPUHKAN · KOSONG", "LOAD DISABLED · EMPTY")}
                </button>
                <button
                  onClick={() => selectedSlot && handleDelete(selectedSlot)}
                  disabled={!selectedSlot}
                  className="border px-5 py-3 text-[10px] font-black tracking-[0.22em] disabled:cursor-not-allowed disabled:opacity-35"
                  style={{ borderColor: "rgb(255 68 68 / 0.35)", color: "var(--neon-red)", background: "rgb(255 68 68 / 0.055)" }}
                >
                  {t(lang, "PADAM SLOT", "DELETE SLOT")}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
