"use client";
import { useEffect, useRef } from "react";
import { animate, useMotionValue } from "framer-motion";

export type CrowdReaction = "positive" | "neutral" | "negative";

// Mouth curve expressed as a single number (the Q control point's Y): below
// the baseline (16) reads as a smile, above it reads as a frown. Animating
// this one number — not the raw `d` string — is what framer-motion actually
// supports smoothly.
const CURVE_CONTROL_Y: Record<CrowdReaction, number> = {
  positive: 20,
  neutral: 16,
  negative: 12,
};

const FACE_COLOR: Record<CrowdReaction, string> = {
  positive: "var(--neon-green)",
  neutral: "var(--text-muted)",
  negative: "var(--neon-red)",
};

function mouthPathFor(controlY: number): string {
  return `M 7 16 Q 12 ${controlY} 17 16`;
}

interface ReactionFaceProps {
  reaction: CrowdReaction;
  size?: number;
}

export default function ReactionFace({ reaction, size = 22 }: ReactionFaceProps) {
  const color = FACE_COLOR[reaction];
  const pathRef = useRef<SVGPathElement>(null);
  const controlY = useMotionValue(CURVE_CONTROL_Y[reaction]);
  // Static first-paint value only — never updated via React re-render.
  // `motion-dom`'s SVG `d` renderer has a first-frame timing quirk when `d`
  // is bound live to a MotionValue prop, so all updates after mount go
  // through the imperative `setAttribute` below instead.
  const initialD = useRef(mouthPathFor(CURVE_CONTROL_Y[reaction])).current;

  useEffect(() => {
    const unsubscribe = controlY.on("change", (y) => {
      pathRef.current?.setAttribute("d", mouthPathFor(y));
    });
    return unsubscribe;
  }, [controlY]);

  useEffect(() => {
    const controls = animate(controlY, CURVE_CONTROL_Y[reaction], { duration: 0.45, ease: "easeInOut" });
    return () => controls.stop();
  }, [reaction, controlY]);

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.4" opacity={0.85} />
      <circle cx="8.5" cy="10" r="1.1" fill={color} />
      <circle cx="15.5" cy="10" r="1.1" fill={color} />
      <path ref={pathRef} d={initialD} stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
