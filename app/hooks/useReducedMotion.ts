"use client";
import { useEffect, useState } from "react";

// Tracks the OS-level prefers-reduced-motion setting so any scene/animation
// can fall back to a static presentation without polling or prop-drilling a
// MediaQueryList by hand.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}
