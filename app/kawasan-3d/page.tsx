// app/kawasan-3d — WebGL (React Three Fiber) rewrite of the app/kawasan
// CSS-3D city map. Built at a separate route so the live game
// (app/kawasan/page.tsx) stays untouched and playable during the migration.
//
// This route is a rendering-layer swap only: it will consume the SAME data
// layer as the CSS version (zoneBuildings/PALETTES/WORLD/PLOT/ROAD_GAP and
// the day/dusk/night logic) once later phases wire it up. No game logic,
// zone data, or scoring lives here.
//
// Migration status: Phase 0 — isolated spike. Canvas + ground plane +
// orbit camera + basic lighting only. No zone grid, no buildings yet.

import Kawasan3DView from "./Kawasan3DView";

export const metadata = {
  title: "Kawasan 3D (WebGL spike)",
};

export default function Kawasan3DPage() {
  return <Kawasan3DView />;
}
