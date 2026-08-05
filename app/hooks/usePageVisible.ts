"use client";
import { useEffect, useState } from "react";

// Tracks document.visibilityState so background/hidden tabs can pause rAF
// loops and other continuous animation work instead of burning CPU/battery
// off-screen.
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handler = () => setVisible(document.visibilityState === "visible");
    handler();
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return visible;
}
