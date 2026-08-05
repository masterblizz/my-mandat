"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { usePageVisible } from "../../hooks/usePageVisible";
import { SCENE_STATE_META, type SceneMotionContextValue, type SceneState } from "./types";

const SceneMotionContext = createContext<SceneMotionContextValue>({ animate: false, state: "idle" });

/** Read by SceneLayer/SceneParticles/SceneHotspot so they don't each need their own hooks. */
export function useSceneMotion(): SceneMotionContextValue {
  return useContext(SceneMotionContext);
}

interface LivingSceneProps {
  /** Current mood of the scene — drives child colors via useSceneMotion(). Must be derived from real game state by the caller, never randomized. */
  state: SceneState;
  lang: "en" | "ms";
  children: ReactNode;
  className?: string;
  /** Fixed aspect ratio for the scene viewport, e.g. "16/7". Omit to fill the parent. */
  aspectRatio?: string;
}

/**
 * Root viewport for a "living scene": layered ambient visuals that react to
 * real game state. Handles the concerns every scene needs so page code only
 * describes *what* the scene should show, not *whether* it's allowed to
 * animate right now:
 *  - prefers-reduced-motion (falls back to a static frame)
 *  - document visibility (pauses when the tab is hidden)
 *  - client-only mount (avoids SSR/hydration mismatch for anything randomized)
 *  - a text state badge so mood is never color-only (accessibility)
 *
 * This does not render tactical-panel chrome itself — wrap it in
 * <TacticalPanel noPadding> the same way any other panel content is wrapped.
 */
export default function LivingScene({ state, lang, children, className = "", aspectRatio }: LivingSceneProps) {
  const [mounted, setMounted] = useState(false);
  const reducedMotion = useReducedMotion();
  const pageVisible = usePageVisible();

  useEffect(() => setMounted(true), []);

  const animate = mounted && pageVisible && !reducedMotion;
  const meta = SCENE_STATE_META[state];

  return (
    <SceneMotionContext.Provider value={{ animate, state }}>
      <div
        className={`relative w-full overflow-hidden ${className}`}
        style={{ aspectRatio, background: "radial-gradient(120% 100% at 50% 0%, rgb(var(--cyan-rgb) / 0.05), transparent 60%)" }}
      >
        {children}

        {/* Text state badge — mood must be readable even with color vision
            deficiency or reduced-motion/no-animation fallback. */}
        <div
          className="absolute top-2 left-2 z-10 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.16em]"
          style={{ color: meta.color, background: "rgba(3,8,15,0.55)", border: `1px solid ${meta.color}55` }}
        >
          {lang === "ms" ? meta.labelMS : meta.labelEN}
        </div>
      </div>
    </SceneMotionContext.Provider>
  );
}
