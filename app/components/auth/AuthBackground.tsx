"use client";

import { useEffect, useState } from "react";
import { CYAN, GOLD, RED } from "./TacticalAuthShell";

// Full-bleed decorative backdrop for /login and /register: one composed
// illustration instead of the old lone radar-circle — a dim Malaysia map
// watermark (real state geometry, same /malaysia.svg the war-room map
// fetches — see MalaysiaMap.tsx — not a redrawn approximation), plus
// line-icon vignettes for a news bulletin, a ballot box, and a vote-share
// chart. Everything sits at very low opacity behind the login/register
// card so it reads as texture, not competing UI.
export default function AuthBackground() {
  const [mapPaths, setMapPaths] = useState<string[]>([]);

  useEffect(() => {
    fetch("/malaysia.svg")
      .then((r) => r.text())
      .then((text) => {
        const doc = new DOMParser().parseFromString(text, "image/svg+xml");
        setMapPaths(Array.from(doc.querySelectorAll("path")).map((p) => p.getAttribute("d") || "").filter(Boolean));
      })
      .catch(() => setMapPaths([]));
  }, []);

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width="100%"
      height="100%"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Malaysia map watermark, low-right */}
      <g transform="translate(560 470) scale(1.05)" fill="none" stroke={CYAN} strokeWidth="1.1" opacity={0.07}>
        {mapPaths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* Radar / HQ rings, upper-right */}
      <g transform="translate(1180 60)" fill="none" stroke={RED} strokeWidth="1" opacity={0.3}>
        <circle cx="350" cy="350" r="320" />
        <circle cx="350" cy="350" r="200" />
        <line x1="350" y1="30" x2="350" y2="670" />
        <line x1="30" y1="350" x2="670" y2="350" />
      </g>

      {/* News bulletin clipping, upper-left */}
      <g transform="translate(90 150)" fill="none" stroke={GOLD} strokeWidth="1.2" opacity={0.16}>
        <rect x="0" y="0" width="230" height="86" rx="2" />
        <circle cx="205" cy="18" r="5" fill={RED} stroke="none" />
        <line x1="18" y1="20" x2="150" y2="20" />
        <line x1="18" y1="40" x2="205" y2="40" />
        <line x1="18" y1="54" x2="205" y2="54" />
        <line x1="18" y1="68" x2="120" y2="68" />
      </g>
      <text x="90" y="138" fontFamily="monospace" fontSize="9" letterSpacing="3" fill={GOLD} opacity={0.18}>
        BREAKING
      </text>

      {/* Ballot box ("peta undi"), lower-left */}
      <g transform="translate(110 700)" fill="none" stroke={CYAN} strokeWidth="1.2" opacity={0.16}>
        <path d="M0 30 L70 30 L60 92 L10 92 Z" />
        <line x1="6" y1="30" x2="64" y2="30" />
        <rect x="23" y="12" width="24" height="9" rx="1" />
        <line x1="35" y1="0" x2="35" y2="30" />
        <line x1="27" y1="8" x2="43" y2="8" />
      </g>

      {/* Vote-share bars, lower-right */}
      <g transform="translate(1370 730)" fill="none" stroke={GOLD} strokeWidth="1" opacity={0.16}>
        <line x1="0" y1="80" x2="150" y2="80" />
        <line x1="0" y1="0" x2="0" y2="80" />
        <rect x="16" y="40" width="20" height="40" fill={CYAN} stroke="none" opacity={0.6} />
        <rect x="55" y="15" width="20" height="65" fill={RED} stroke="none" opacity={0.6} />
        <rect x="94" y="52" width="20" height="28" fill={GOLD} stroke="none" opacity={0.6} />
      </g>
    </svg>
  );
}
