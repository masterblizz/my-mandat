"use client";
import { create } from "zustand";

type OnlineSession = { worldId: string | null; characterId: string | null; select: (worldId: string, characterId: string) => void; clear: () => void };
const KEY = "mymandat-online-session-v1";
export const useOnlineSessionStore = create<OnlineSession>((set) => ({
  worldId: null, characterId: null,
  select: (worldId, characterId) => { if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify({ worldId, characterId })); set({ worldId, characterId }); },
  clear: () => { if (typeof window !== "undefined") localStorage.removeItem(KEY); set({ worldId: null, characterId: null }); },
}));
export function restoreOnlineSession() { if (typeof window === "undefined") return; try { const raw = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (raw && typeof raw.worldId === "string" && typeof raw.characterId === "string") useOnlineSessionStore.setState({ worldId: raw.worldId, characterId: raw.characterId }); } catch { localStorage.removeItem(KEY); } }
