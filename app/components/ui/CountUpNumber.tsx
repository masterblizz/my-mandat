"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import { animate } from "framer-motion";

interface CountUpNumberProps {
  value: number;
  /** Animation length in milliseconds. */
  duration?: number;
  /**
   * Change-driven mode (war room resource bar): the first render shows
   * `value` as-is (no mount count-up), then every later `value` change tweens
   * from the previous value to the new one. Default is the original
   * mount-once 0 → value count-up (results screen).
   */
  animateOnChange?: boolean;
  /** Optional formatter for the displayed number (e.g. add "%" or "RM"). */
  format?: (value: number) => string;
  className?: string;
  style?: CSSProperties;
}

// Counts up from 0 to `value` once on mount (easeOut), then stays at the
// final value. Reusable for seat totals, support %, funds spent, etc.
// With `animateOnChange`, instead tweens between successive `value` props.
// Respects prefers-reduced-motion by rendering the final value immediately.
// The number is written imperatively via textContent (same pattern as
// ReactionFace) so the 60fps tween never triggers React re-renders.
export default function CountUpNumber({ value, duration = 1200, animateOnChange = false, format, className, style }: CountUpNumberProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const playedRef = useRef(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const fmt = format ?? ((n: number) => String(n));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (animateOnChange) {
      // Change-driven mode: remember where the number was last render and
      // tween from there whenever the store pushes a new value (advanceDay).
      const startValue = prevValueRef.current;
      prevValueRef.current = value;
      if (!playedRef.current) {
        playedRef.current = true; // first render: value is already on screen
        return;
      }
      if (startValue === value) return;
      if (reduced) {
        if (spanRef.current) spanRef.current.textContent = fmt(value);
        return; // jump straight to the new value
      }
      if (spanRef.current) spanRef.current.textContent = fmt(startValue);
      const controls = animate(startValue, value, {
        duration: duration / 1000,
        ease: "easeOut",
        onUpdate: (latest) => {
          if (spanRef.current) spanRef.current.textContent = fmt(Math.round(latest));
        },
        onComplete: () => {
          if (spanRef.current) spanRef.current.textContent = fmt(value);
        },
      });
      return () => controls.stop();
    }

    // Mount-once mode. Run-once flag: parent re-renders never replay the
    // count-up. Reset on cleanup so a StrictMode dev remount still plays.
    if (playedRef.current) return;
    playedRef.current = true;

    if (reduced) {
      return; // final value is already rendered — skip straight to it
    }

    const node = spanRef.current;
    if (node) node.textContent = fmt(0);
    const controls = animate(0, value, {
      duration: duration / 1000,
      ease: "easeOut",
      onUpdate: (latest) => {
        if (spanRef.current) spanRef.current.textContent = fmt(Math.round(latest));
      },
      onComplete: () => {
        if (spanRef.current) spanRef.current.textContent = fmt(value);
      },
    });
    return () => {
      controls.stop();
      playedRef.current = false;
    };
    // Re-runs only when `value` changes (needed for animateOnChange); the
    // mount-once path still plays exactly once with the values present at
    // first render and must not restart on unrelated prop identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, animateOnChange]);

  return (
    <span ref={spanRef} className={className} style={style}>
      {(format ?? ((n: number) => String(n)))(value)}
    </span>
  );
}
