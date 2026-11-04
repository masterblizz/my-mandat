"use client";

// Sky life over the hosted Godot city (a separate project, so it is drawn
// here as a light DOM layer): soft clouds drifting across the upper part of
// the frame, flocks of birds crossing now and then, and at dusk a few
// birds heading home. Night keeps a couple of dim clouds and no birds.
// Pure CSS animation; never takes input; respects reduced motion.

import { useEffect, useState } from "react";

type Phase = "day" | "dusk" | "night";

function phaseNow(date = new Date()): Phase {
  const h = date.getHours();
  if (h >= 19 || h < 6) return "night";
  if (h >= 17) return "dusk";
  return "day";
}

// Deterministic layout so the sky does not reshuffle on every render.
// Thin, high clouds kept to the top band of the frame (where the sky is at
// the default camera); the band fades out downwards so a cloud never sits
// as a solid blot on the ground.
const CLOUDS = [
  { top: 1, scale: 1.2, duration: 150, delay: -20, opacity: 0.7 },
  { top: 7, scale: 0.8, duration: 115, delay: -70, opacity: 0.55 },
  { top: 0, scale: 0.95, duration: 170, delay: -110, opacity: 0.6 },
  { top: 10, scale: 0.6, duration: 95, delay: -40, opacity: 0.45 },
  { top: 4, scale: 1.05, duration: 135, delay: -125, opacity: 0.6 },
];

const FLOCKS = [
  { top: 14, size: 7, duration: 34, delay: 3, dir: 1 },
  { top: 24, size: 5, duration: 41, delay: 19, dir: -1 },
  { top: 9, size: 4, duration: 29, delay: 31, dir: 1 },
];

// one bird: two wing strokes from the body, flapping via scaleY
function Bird({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="sky-bird-wing" style={{ animationDelay: `${delay}s` }}>
        <path d="M-7 0 Q-3.5 -4 0 0 Q3.5 -4 7 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </g>
  );
}

export default function CitySkyLife() {
  const [phase, setPhase] = useState<Phase>("day");

  useEffect(() => {
    const update = () => setPhase(phaseNow());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const cloudColor = phase === "night" ? "rgb(150 165 190 / .22)" : phase === "dusk" ? "rgb(255 214 190 / .8)" : "rgb(255 255 255 / .85)";
  const clouds = phase === "night" ? CLOUDS.slice(0, 3) : CLOUDS;
  const flocks = phase === "night" ? [] : phase === "dusk" ? FLOCKS.slice(0, 2) : FLOCKS;

  return (
    <div aria-hidden className="city-sky-life pointer-events-none absolute inset-0 overflow-hidden">
      <div className="sky-cloud-band">
      {clouds.map((c, i) => (
        <div key={i} className="sky-cloud" style={{
          top: `${c.top}%`, opacity: c.opacity, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s`,
          ["--cloud-scale" as string]: c.scale, ["--cloud-color" as string]: cloudColor,
        }}>
          <span /><span /><span /><span />
        </div>
      ))}
      </div>
      {flocks.map((f, i) => (
        <svg key={i} className={`sky-flock ${f.dir < 0 ? "sky-flock--west" : ""}`} viewBox="-40 -20 80 40"
          style={{ top: `${f.top}%`, width: 60 + f.size * 6, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s`,
            color: phase === "dusk" ? "rgb(40 30 40 / .8)" : "rgb(30 40 52 / .72)" }}>
          {Array.from({ length: f.size }, (_, k) => {
            // a loose V: alternate sides, each step further back and out
            const side = k === 0 ? 0 : k % 2 ? -1 : 1;
            const step = Math.ceil(k / 2);
            return <Bird key={k} x={side * step * 9 - step * 2} y={step * 5 - 6 + ((k * 7) % 3)} delay={k * 0.13} />;
          })}
        </svg>
      ))}
    </div>
  );
}
