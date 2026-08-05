"use client";
import { useEffect, useRef } from "react";

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vrot: number;
  color: string;
}

interface ConfettiCanvasProps {
  /** Particle colors — pass literal canvas colors (e.g. partyColor + white/gray). */
  colors: string[];
  /** Total run time in milliseconds; the effect auto-stops (no infinite loop). */
  duration?: number;
  particleCount?: number;
}

// Tiny self-contained confetti burst on a fixed full-screen canvas.
// Runs once on mount for `duration` ms, fades out over the last 500ms,
// then clears itself. cancelAnimationFrame on unmount — no leaks.
export default function ConfettiCanvas({ colors, duration = 2500, particleCount = 140 }: ConfettiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: ConfettiParticle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 2 + Math.random() * 3.5,
      w: 4 + Math.random() * 5,
      h: 7 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.25,
      color: colors[Math.floor(Math.random() * colors.length)] ?? "#ffffff",
    }));

    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (elapsed >= duration) return; // auto-stop; canvas already cleared

      ctx.globalAlpha = Math.max(0, Math.min(1, (duration - elapsed) / 500));
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.rot += p.vrot;
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.vy = 2 + Math.random() * 3.5;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // Mount-only by design: one celebratory burst with the colors present at
    // first render; must not restart when the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 60 }}
    />
  );
}
