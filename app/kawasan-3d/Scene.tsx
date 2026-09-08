"use client";

// /kawasan-3d sandbox harness for the WebGL city map.
//
// This route is NOT the live game. It feeds demo data (makeDemoZones +
// density presets) into <City3DMapGL> — the real drop-in component, with
// the exact prop signature of <City3DMap> in app/kawasan/page.tsx — and
// renders it inside a panel-sized box (not full-screen) so it's obvious
// the component works embedded in a layout cell. A mock right-side panel
// stands in for the live page's store-backed panel to show that selection
// flows out through setSelectedZoneId.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import City3DMapGL from "./City3DMapGL";
import { useLang } from "../i18n/useLang";
import {
  kawasanGridSize, kawasanDevelopedCount, makeDemoZones,
  DEFAULT_TRAITS, ZONE_KIND_LABEL,
} from "./cityData";

const SEED = "kawasan-3d-demo";

const DENSITY_PRESETS: { key: string; label: string; density: number }[] = [
  { key: "rural", label: "Rural · 6×6", density: 0.2 },
  { key: "semi", label: "Semi-urban · 8×8", density: 0.45 },
  { key: "metro", label: "Metro · 10×10", density: 0.72 },
  { key: "dense", label: "Dense metro · 12×12", density: 0.9 },
];

export default function Scene() {
  const lang = useLang();
  const [presetKey, setPresetKey] = useState("metro");
  const preset = DENSITY_PRESETS.find((p) => p.key === presetKey)!;
  const gridSize = kawasanGridSize(preset.density);

  const baseZones = useMemo(
    () => makeDemoZones(SEED, kawasanDevelopedCount(preset.density, gridSize)),
    [preset.density, gridSize],
  );

  // Demo "grow": stat bump so buildingHeight() rises and the tween shows.
  const [grown, setGrown] = useState<Record<string, number>>({});
  useEffect(() => setGrown({}), [presetKey]);
  const zones = useMemo(
    () =>
      baseZones.map((z) => {
        const d = grown[z.id];
        if (!d) return z;
        const economy = Math.min(100, z.economy + d);
        const welfare = Math.min(100, z.welfare + d);
        const infra = Math.min(100, z.infra + d);
        return { ...z, economy, welfare, infra, sentiment: Math.round((economy + welfare + infra) / 3) };
      }),
    [baseZones, grown],
  );

  // Stack the harness's [map | 390px panel] grid on narrow screens, the
  // way the live page does (its split is lg: only).
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 980);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const [selectedZoneId, setSelectedZoneId] = useState("zone-0");
  const selected = zones.find((z) => z.id === selectedZoneId) ?? zones[0];
  const overall = zones.length
    ? Math.round(zones.reduce((s, z) => s + z.sentiment, 0) / zones.length)
    : 0;

  const growSelected = useCallback(() => {
    setGrown((g) => ({ ...g, [selectedZoneId]: Math.min(45, (g[selectedZoneId] ?? 0) + 15) }));
  }, [selectedZoneId]);

  // Demo celebration (mirrors the live page's project-approved burst).
  const [celebration, setCelebration] = useState<{ zoneId: string; at: number } | null>(null);
  useEffect(() => {
    if (!celebration) return;
    const id = setTimeout(() => setCelebration(null), 2800);
    return () => clearTimeout(id);
  }, [celebration]);
  const celebrateSelected = useCallback(
    () => setCelebration({ zoneId: selectedZoneId, at: Date.now() }),
    [selectedZoneId],
  );

  return (
    <div style={ui.page}>
      <div style={ui.bar}>
        <strong style={{ color: "#e0f2fe" }}>kawasan-3d</strong>
        <span style={{ color: "#5c7186" }}>Phase 5 · &lt;City3DMapGL&gt; drop-in — demo data</span>
        {DENSITY_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPresetKey(p.key)}
            style={{ ...ui.chip, ...(p.key === presetKey ? ui.chipOn : null) }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* mimic the live page's [minmax(0,1fr) 390px] panel grid (lg only) */}
      <div style={{ ...ui.grid, gridTemplateColumns: narrow ? "1fr" : "minmax(0,1fr) 390px" }}>
        <City3DMapGL
          zones={zones}
          selectedZoneId={selectedZoneId}
          setSelectedZoneId={setSelectedZoneId}
          lang={lang}
          gridSize={gridSize}
          density={preset.density}
          densityLabel={preset.label}
          traits={DEFAULT_TRAITS}
          celebration={celebration}
          overall={overall}
        />

        <aside style={ui.side}>
          <div style={ui.sideKicker}>{selected && ZONE_KIND_LABEL[selected.kind]}</div>
          <div style={ui.sideTitle}>
            {selected?.archetype}{selected?.repeat ? ` ${selected.repeat}` : ""}
          </div>
          <div style={ui.sideId}>{selected?.id}</div>
          {selected && (
            <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
              <Stat k="INFRA" v={selected.infra} />
              <Stat k="WELFARE" v={selected.welfare} />
              <Stat k="ECONOMY" v={selected.economy} />
              <Stat k="SENTIMENT" v={selected.sentiment} />
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <button type="button" style={{ ...ui.grow, marginTop: 0 }} onClick={growSelected}>▲ Grow (demo)</button>
            <button type="button" style={{ ...ui.grow, marginTop: 0, borderColor: "rgba(250,204,21,0.5)", background: "rgba(250,204,21,0.14)", color: "#fde68a" }} onClick={celebrateSelected}>✦ Celebrate</button>
          </div>
          <div style={ui.sideNote}>
            This panel is OUTSIDE the map component — it updates purely from
            setSelectedZoneId, exactly like the live page&apos;s store-backed
            panel will.
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: number }) {
  const color = v >= 74 ? "#22c55e" : v >= 54 ? "#f0a500" : "#ff4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 82, color: "#7f9bb3", fontSize: 11, letterSpacing: 0.5 }}>{k}</span>
      <span style={{ flex: 1, height: 6, background: "#1c2836", borderRadius: 3, overflow: "hidden" }}>
        <span style={{ display: "block", width: `${v}%`, height: "100%", background: color }} />
      </span>
      <span style={{ width: 26, textAlign: "right", color, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
}

const ui: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#0b1224", color: "#dbe7f2", font: "13px system-ui, sans-serif", padding: 16, boxSizing: "border-box" },
  bar: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  chip: { padding: "6px 10px", borderRadius: 6, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(125,211,252,0.28)", background: "rgba(9,14,24,0.86)", color: "#9fb6cc", font: "12px system-ui, sans-serif", cursor: "pointer" },
  chipOn: { background: "rgba(125,211,252,0.18)", color: "#e0f2fe", borderColor: "rgba(125,211,252,0.6)" },
  grid: { display: "grid", gap: 16, gridTemplateColumns: "minmax(0,1fr) 390px", maxWidth: 1400 },
  side: { border: "1px solid rgba(125,211,252,0.2)", borderRadius: 8, padding: 14, background: "rgba(9,14,24,0.6)", height: "fit-content" },
  sideKicker: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#7dd3fc" },
  sideTitle: { fontSize: 16, fontWeight: 700, margin: "2px 0 0", textTransform: "capitalize" },
  sideId: { fontSize: 11, color: "#63788c" },
  grow: { marginTop: 12, width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.5)", background: "rgba(34,197,94,0.14)", color: "#86efac", font: "12px system-ui, sans-serif", cursor: "pointer" },
  sideNote: { marginTop: 10, fontSize: 10, lineHeight: 1.4, color: "#5c7186" },
};
