"use client";

// Client wrapper for the WebGL scene.
//
// next/dynamic with { ssr: false } is only allowed inside a Client
// Component in the Next 14 App Router, so the dynamic() call lives here
// rather than in page.tsx (a Server Component). Next.js can't server-render
// a WebGL <canvas>, so the whole Scene is browser-only.

import dynamic from "next/dynamic";

const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "#0b1224",
        color: "#8fb8d4",
        font: "14px system-ui, sans-serif",
      }}
    >
      Loading 3D city…
    </div>
  ),
});

export default function Kawasan3DView() {
  return <Scene />;
}
