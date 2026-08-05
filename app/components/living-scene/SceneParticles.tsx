"use client";
import { useEffect, useRef } from "react";
import { useSceneMotion } from "./LivingScene";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface SceneParticlesProps {
  /** Kept low on purpose — this is ambient texture, not a particle showcase. */
  count?: number;
  color?: string;
  className?: string;
}

/**
 * Lightweight canvas ambience (drifting data points) for a LivingScene's
 * background. Pauses the rAF loop entirely — not just visually, the loop
 * itself stops running — when the scene says not to animate (reduced-motion,
 * hidden tab, unmounted), and renders one static frame instead so the layer
 * never just goes blank.
 */
export default function SceneParticles({ count = 22, color, className = "" }: SceneParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { animate, state } = useSceneMotion();
  const particleColor = color ?? "var(--cyan)";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let rafId: number | null = null;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        r: Math.random() * 1.2 + 0.4,
      }));
    }

    function resolvedColor() {
      // getComputedStyle resolves the CSS var to a concrete color the canvas can use.
      const probe = getComputedStyle(canvas!.parentElement ?? canvas!);
      if (particleColor.startsWith("var(")) {
        const varName = particleColor.slice(4, -1).trim();
        return probe.getPropertyValue(varName).trim() || "#00d4ff";
      }
      return particleColor;
    }

    function draw(dtSeconds: number) {
      ctx!.clearRect(0, 0, width, height);
      const rgb = resolvedColor();
      for (const p of particles) {
        if (dtSeconds > 0) {
          p.x += p.vx * dtSeconds;
          p.y += p.vy * dtSeconds;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
        }
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = rgb;
        ctx!.globalAlpha = 0.5;
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    resize();
    seed();

    if (!animate) {
      draw(0);
      return; // no rAF loop at all — fully paused, not just visually frozen
    }

    let lastTime = performance.now();
    function tick(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      draw(dt);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    const handleResize = () => resize();
    window.addEventListener("resize", handleResize);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
    };
  }, [animate, count, particleColor, state]);

  return <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full ${className}`} aria-hidden="true" />;
}
