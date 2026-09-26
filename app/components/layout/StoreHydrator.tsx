"use client";
import { getSavedGames, getActiveSaveSlotId } from "../../store/saveGame";
import { useEffect } from "react";
import { useUIStore, type Lang } from "../../store/uiStore";
import { useGameStore, readPersistedPoliticalReactions } from "../../store/gameStore";

// Reads persisted values from localStorage once after React mount.
// This is needed because the Zustand store initialises with defaults during SSR
// (no window/localStorage available), and we restore the saved values on the client.
export default function StoreHydrator() {
  const { setLanguage, setTheme, setMusicEnabled, setMusicVolume, setShowCampaignBriefing } = useUIStore();
  const updateSettings = useGameStore((state) => state.updateSettings);

  useEffect(() => {
    const lang = localStorage.getItem("mandat-lang") as Lang | null;
    if (lang === "en" || lang === "ms") setLanguage(lang);

    const theme = localStorage.getItem("mandat-theme") as "dark" | "light" | null;
    if (theme === "dark" || theme === "light") setTheme(theme);

    const musicEnabled = localStorage.getItem("mandat-music-enabled");
    if (musicEnabled !== null) setMusicEnabled(musicEnabled === "true");

    const vol = Number(localStorage.getItem("mandat-music-volume"));
    if (Number.isFinite(vol) && vol >= 0) setMusicVolume(vol);

    const briefing = localStorage.getItem("mandat-campaign-briefing");
    if (briefing !== null) setShowCampaignBriefing(briefing === "true");

    const savedGameSettings = localStorage.getItem("mymandat-game-settings");
    if (savedGameSettings) {
      try {
        const parsed = JSON.parse(savedGameSettings) as Partial<ReturnType<typeof useGameStore.getState>["settings"]>;
        updateSettings(parsed);
      } catch {
        localStorage.removeItem("mymandat-game-settings");
      }
    }

    const activeId = getActiveSaveSlotId();
    const active = getSavedGames().find(slot => slot.id === activeId);
    if (active) {
      useGameStore.setState({ ...active.state });
      return;
    }
    const politicalReactions = readPersistedPoliticalReactions();
    if (politicalReactions.length > 0) {
      useGameStore.setState({ politicalReactions });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
