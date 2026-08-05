"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSceneMotion } from "./LivingScene";

interface SceneLayerProps {
  children: ReactNode;
  /** 0 = static, higher = moves more under pointer parallax. Ignored when motion is off. */
  depth?: number;
  className?: string;
}

/**
 * One depth layer inside a LivingScene (background/midground/foreground).
 * Adds a subtle pointer-parallax offset scaled by `depth`; does nothing but
 * position children when animation is disabled (reduced-motion, hidden tab,
 * or depth=0).
 */
export default function SceneLayer({ children, depth = 0, className = "" }: SceneLayerProps) {
  const { animate } = useSceneMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!animate || depth === 0) {
      setOffset({ x: 0, y: 0 });
      return;
    }
    const el = ref.current;
    if (!el) return;

    function handlePointerMove(e: PointerEvent) {
      const rect = el!.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      setOffset({ x: relX * depth * -8, y: relY * depth * -8 });
    }
    function handlePointerLeave() {
      setOffset({ x: 0, y: 0 });
    }

    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [animate, depth]);

  return (
    <div
      ref={ref}
      className={`absolute inset-0 ${className}`}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        transition: "transform 0.3s ease-out",
      }}
    >
      {children}
    </div>
  );
}
