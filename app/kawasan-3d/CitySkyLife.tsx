"use client";

// Sky life over the hosted Godot city: soft clouds drifting across the
// upper part of the frame (a light DOM layer). Birds are real 3D flocks
// inside the Godot city (godot/kawasan-city/birds.gd).
// Pure CSS animation; never takes input; respects reduced motion.

import { useEffect, useState } from "react";

type Phase = "day" | "dusk" | "night";

// Always daytime: night mode from the real clock was removed.
function phaseNow(): Phase {
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
    </div>
  );
}
