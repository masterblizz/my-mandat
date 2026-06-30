"use client";

import { useEffect } from "react";
import { useGameStore } from "../../store/gameStore";
import { saveGameSnapshot } from "../../store/saveGame";

export default function AutoSave() {
  useEffect(() => {
    saveGameSnapshot(useGameStore.getState());
    const unsubscribe = useGameStore.subscribe((state) => {
      saveGameSnapshot(state);
    });
    return unsubscribe;
  }, []);

  return null;
}
