"use client";
import { motion } from "framer-motion";
import { useSceneMotion } from "./LivingScene";
import { SCENE_DURATION } from "./motionTokens";

interface SceneHotspotProps {
  /** Percentage position within the parent LivingScene, e.g. { x: 20, y: 30 }. */
  position: { x: number; y: number };
  color: string;
  labelMS: string;
  labelEN: string;
  /** Short status word shown next to the label — text, not just color, carries the meaning. */
  statusMS: string;
  statusEN: string;
  lang: "en" | "ms";
  intensity?: "idle" | "active" | "alert";
}

/**
 * A named, colored marker inside a living scene (advisor desk, media wall,
 * ops board, ...). Always renders its status as text next to the dot so the
 * state is never communicated by color/animation alone.
 */
export default function SceneHotspot({
  position,
  color,
  labelMS,
  labelEN,
  statusMS,
  statusEN,
  lang,
  intensity = "idle",
}: SceneHotspotProps) {
  const { animate } = useSceneMotion();
  const pulseScale = intensity === "alert" ? [1, 1.6, 1] : intensity === "active" ? [1, 1.25, 1] : [1, 1.08, 1];
  const duration = intensity === "alert" ? SCENE_DURATION.base * 2.2 : SCENE_DURATION.ambient;

  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
    >
      <div className="relative flex items-center justify-center">
        {animate && (
          <motion.span
            className="absolute h-3 w-3 rounded-full"
            style={{ background: color }}
            animate={{ scale: pulseScale, opacity: [0.55, 0, 0.55] }}
            transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <span className="relative h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
      <div className="whitespace-nowrap text-center leading-tight">
        <div className="text-[8px] font-bold tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
          {lang === "ms" ? labelMS : labelEN}
        </div>
        <div className="text-[9px] font-bold tracking-[0.1em]" style={{ color }}>
          {lang === "ms" ? statusMS : statusEN}
        </div>
      </div>
    </div>
  );
}
