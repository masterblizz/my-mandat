import type { GameState } from "./gameStore";

export const GAME_SAVE_KEY = "mymandat-save-v1";
export const GAME_SAVE_SLOTS_KEY = "mymandat-save-slots-v2";
export const ACTIVE_SAVE_SLOT_KEY = "mymandat-active-save-slot-v2";
export const MAX_SAVE_SLOTS = 5;

export type SavedGameSnapshot = Pick<
  GameState,
  | "phase"
  | "dataset"
  | "nominations"
  | "day"
  | "totalDays"
  | "leader"
  | "resources"
  | "states"
  | "operations"
  | "alerts"
  | "lastEvent"
  | "selectedStateId"
  | "difficulty"
  | "mediaSentiment"
  | "settings"
  | "hasWonElection"
  | "dailyChallengeDate"
  | "careerProgress"
  | "governmentProgress"
  | "sandboxProgress"
>;

export interface SavedGameRecord {
  version: 1;
  savedAt: string;
  label: string;
  state: SavedGameSnapshot;
}

export interface SavedGameSlot extends SavedGameRecord {
  id: string;
  slotNumber: number;
  createdAt: string;
}

export function createSaveSnapshot(state: GameState): SavedGameSnapshot {
  return {
    phase: state.phase,
    dataset: state.dataset,
    nominations: state.nominations,
    day: state.day,
    totalDays: state.totalDays,
    leader: state.leader,
    resources: state.resources,
    states: state.states,
    operations: state.operations,
    alerts: state.alerts,
    lastEvent: state.lastEvent,
    selectedStateId: state.selectedStateId,
    difficulty: state.difficulty,
    mediaSentiment: state.mediaSentiment,
    settings: state.settings,
    hasWonElection: state.hasWonElection,
    dailyChallengeDate: state.dailyChallengeDate,
    careerProgress: state.careerProgress,
    governmentProgress: state.governmentProgress,
    sandboxProgress: state.sandboxProgress,
  };
}

function isBrowser() {
  return typeof window !== "undefined";
}

function makeSlotId() {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeLabel(snapshot: SavedGameSnapshot) {
  return `${snapshot.leader.partyAbbr} · Day ${snapshot.day}/${snapshot.totalDays}`;
}

function normalizeSlots(slots: SavedGameSlot[]) {
  const used = new Set<number>();
  const normalized: SavedGameSlot[] = [];

  for (const slot of slots) {
    if (!slot?.id || slot.version !== 1 || !slot.state) continue;
    const wanted = Number.isInteger(slot.slotNumber) && slot.slotNumber >= 1 && slot.slotNumber <= MAX_SAVE_SLOTS
      ? slot.slotNumber
      : null;
    let slotNumber = wanted && !used.has(wanted) ? wanted : 1;
    while (used.has(slotNumber) && slotNumber <= MAX_SAVE_SLOTS) slotNumber += 1;
    if (slotNumber > MAX_SAVE_SLOTS) continue;
    used.add(slotNumber);
    normalized.push({ ...slot, slotNumber });
  }

  return normalized.sort((a, b) => a.slotNumber - b.slotNumber).slice(0, MAX_SAVE_SLOTS);
}

function readLegacySave(): SavedGameSlot | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(GAME_SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedGameRecord;
    if (parsed?.version !== 1 || !parsed.state) return null;
    return {
      ...parsed,
      id: "slot-legacy-autosave",
      slotNumber: 1,
      createdAt: parsed.savedAt,
      label: parsed.label || makeLabel(parsed.state),
    };
  } catch {
    return null;
  }
}

function writeSlots(slots: SavedGameSlot[]) {
  if (!isBrowser()) return;
  localStorage.setItem(GAME_SAVE_SLOTS_KEY, JSON.stringify(normalizeSlots(slots)));
}

export function getSavedGames(): SavedGameSlot[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(GAME_SAVE_SLOTS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SavedGameSlot[];
      if (Array.isArray(parsed)) return normalizeSlots(parsed);
    } catch {
      // fall through to legacy migration
    }
  }

  const legacy = readLegacySave();
  if (!legacy) return [];
  writeSlots([legacy]);
  localStorage.setItem(ACTIVE_SAVE_SLOT_KEY, legacy.id);
  return [legacy];
}

export function getSavedGame(): SavedGameRecord | null {
  return getSavedGames()[0] ?? null;
}

export function getActiveSaveSlotId() {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACTIVE_SAVE_SLOT_KEY);
}

export function setActiveSaveSlot(id: string | null) {
  if (!isBrowser()) return;
  if (id) localStorage.setItem(ACTIVE_SAVE_SLOT_KEY, id);
  else localStorage.removeItem(ACTIVE_SAVE_SLOT_KEY);
}

function firstEmptySlotNumber(slots: SavedGameSlot[]) {
  for (let slotNumber = 1; slotNumber <= MAX_SAVE_SLOTS; slotNumber += 1) {
    if (!slots.some((slot) => slot.slotNumber === slotNumber)) return slotNumber;
  }
  return null;
}

function oldestSlot(slots: SavedGameSlot[]) {
  return [...slots].sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime())[0] ?? null;
}

export function saveGameToSlot(state: GameState, slotNumber: number) {
  if (!isBrowser()) return null;
  if (state.phase !== "playing" && state.phase !== "ended") return null;

  const normalizedSlotNumber = Math.max(1, Math.min(MAX_SAVE_SLOTS, Math.trunc(slotNumber)));
  const snapshot = createSaveSnapshot(state);
  const now = new Date().toISOString();
  const slots = getSavedGames();
  const existingIndex = slots.findIndex((slot) => slot.slotNumber === normalizedSlotNumber);
  const existing = existingIndex >= 0 ? slots[existingIndex] : null;

  const nextSlot: SavedGameSlot = {
    id: existing?.id ?? makeSlotId(),
    slotNumber: normalizedSlotNumber,
    version: 1,
    createdAt: existing?.createdAt ?? now,
    savedAt: now,
    label: makeLabel(snapshot),
    state: snapshot,
  };

  const nextSlots = existingIndex >= 0
    ? slots.map((slot, index) => (index === existingIndex ? nextSlot : slot))
    : [...slots, nextSlot];

  writeSlots(nextSlots);
  setActiveSaveSlot(nextSlot.id);
  return nextSlot;
}

export function createNewSaveSlot(state: GameState) {
  if (!isBrowser()) return null;
  const currentSlots = getSavedGames();
  const emptySlotNumber = firstEmptySlotNumber(currentSlots);

  if (emptySlotNumber) {
    return saveGameToSlot(state, emptySlotNumber);
  }

  const replacementSlot = oldestSlot(currentSlots);
  return saveGameToSlot(state, replacementSlot?.slotNumber ?? MAX_SAVE_SLOTS);
}

export function saveGameSnapshot(state: GameState) {
  if (!isBrowser()) return null;
  if (state.phase !== "playing" && state.phase !== "ended") return null;

  const activeId = getActiveSaveSlotId();
  const slots = getSavedGames();
  const activeSlot = activeId ? slots.find((slot) => slot.id === activeId) : null;

  // Autosave must rewrite the active campaign slot. It should not create a new slot
  // when the current campaign already came from or was saved into an existing slot.
  if (activeSlot) return saveGameToSlot(state, activeSlot.slotNumber);

  return createNewSaveSlot(state);
}

export function deleteSavedGame(id?: string) {
  if (!isBrowser()) return;
  if (!id) {
    localStorage.removeItem(GAME_SAVE_KEY);
    localStorage.removeItem(GAME_SAVE_SLOTS_KEY);
    localStorage.removeItem(ACTIVE_SAVE_SLOT_KEY);
    return;
  }
  const slots = getSavedGames().filter((slot) => slot.id !== id);
  writeSlots(slots);
  if (getActiveSaveSlotId() === id) setActiveSaveSlot(null);
}

// /kawasan keeps its own per-seat dev progress cache outside this file (see
// its STORAGE_PREFIX) — mirrored here as a literal string since importing a
// page module for one constant isn't worth it. Bump/add a prefix here if
// that key ever changes.
const KAWASAN_DEV_KEY_PREFIXES = ["mymandat-kawasan-development-v2:", "mymandat-kawasan-development-v1:"];

// Every other flat localStorage key this app writes outside gameStore/
// historyStore's own persistence (those two are cleared separately by the
// caller via resetGame()/clearHistory()) — kept together so a "wipe this
// browser's game memory" caller (see /register) doesn't have to know about
// each one individually.
const OTHER_SAVE_RELATED_KEYS = ["mymandat-game-settings"];

// Clears every save-related localStorage key this app owns: save slots,
// legacy autosave, settings cache, and every seat's kawasan dev progress —
// used when a fresh account should start with zero leftover game memory
// from whoever last played on this browser (see /register's handleRegister).
// Does NOT touch gameStore/historyStore in-memory state or their own
// persistence — call resetGame()/clearHistory() alongside this.
export function clearAllSavedGameData() {
  if (!isBrowser()) return;
  deleteSavedGame();
  OTHER_SAVE_RELATED_KEYS.forEach((key) => localStorage.removeItem(key));
  Object.keys(localStorage)
    .filter((key) => KAWASAN_DEV_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)))
    .forEach((key) => localStorage.removeItem(key));
}
