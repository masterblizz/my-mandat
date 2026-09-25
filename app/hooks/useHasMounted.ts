"use client";
import { useEffect, useState } from "react";

/**
 * StoreHydrator restores the active save after the layout hydrates, but page
 * Suspense boundaries hydrate later and would read the restored state — so a
 * page that renders saved-game numbers must wait until mounted, or its first
 * client render won't match the server's default-state HTML.
 */
export function useHasMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
