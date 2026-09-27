"use client";

import { useEffect } from "react";
import { useGameStore } from "../../store/gameStore";

// Counts only visible, active campaign time. The value is saved with the
// campaign snapshot, so a rank reflects real play rather than page visits.
export default function PlayerProgressTracker() {
  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = useGameStore.getState();
      if (document.visibilityState !== "visible" || state.phase !== "playing") return;
      state.setCareerProgress({ playedMinutes: (state.careerProgress.playedMinutes ?? 0) + 1 });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
