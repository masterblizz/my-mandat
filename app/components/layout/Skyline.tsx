"use client";

// CSS-drawn Kuala Lumpur skyline silhouette: KLCC twin towers with
// skybridge, KL Tower, and city blocks with lit windows and blinking
// aviation beacons. Decorative overlay; parent must be positioned.

const WINDOWS =
  "repeating-linear-gradient(0deg, rgba(125,211,252,0.16) 0 2px, transparent 2px 6px), repeating-linear-gradient(90deg, rgba(125,211,252,0.1) 0 2px, transparent 2px 5px)";

const BLOCKS: { w: number; h: number; win?: boolean }[] = [
  { w: 24, h: 40, win: true },
  { w: 16, h: 26 },
  { w: 30, h: 58, win: true },
  { w: 20, h: 34 },
  { w: 26, h: 70, win: true },
  { w: 18, h: 30 },
];

function Block({ w, h, win }: { w: number; h: number; win?: boolean }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        background: "linear-gradient(180deg, #101d33, #070d18)",
        backgroundImage: win ? WINDOWS : undefined,
        borderTop: "1px solid rgba(125,211,252,0.35)",
      }}
    />
  );
}

function KlccTower() {
  return (
    <div className="flex flex-col items-center">
      <span className="mm-blip" style={{ width: 3, height: 3, borderRadius: "50%", background: "#f87171", boxShadow: "0 0 6px rgba(248,113,113,0.9)" }} />
      <div style={{ width: 2, height: 16, background: "#334155" }} />
      <div
        style={{
          width: 22,
          height: 104,
          clipPath: "polygon(28% 0, 72% 0, 100% 100%, 0 100%)",
          background: "linear-gradient(180deg, #16263f, #0a1220)",
          backgroundImage: WINDOWS,
          borderTop: "1px solid rgba(125,211,252,0.4)",
        }}
      />
    </div>
  );
}

export default function Skyline({ opacity = 0.6, height = 150 }: { opacity?: number; height?: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ opacity, height }}>
      <div className="absolute inset-x-0 bottom-0" style={{ height: 60, background: "linear-gradient(180deg, transparent, rgb(var(--cyan-rgb) / 0.08))" }} />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-[4px]">
        {BLOCKS.slice(0, 3).map((block, index) => (
          <Block key={`l-${index}`} {...block} />
        ))}
        {/* KL Tower */}
        <div className="flex flex-col items-center">
          <span className="mm-blip" style={{ width: 3, height: 3, borderRadius: "50%", background: "#f87171", boxShadow: "0 0 6px rgba(248,113,113,0.9)" }} />
          <div style={{ width: 2, height: 12, background: "#334155" }} />
          <div style={{ width: 14, height: 12, borderRadius: "45%", background: "linear-gradient(180deg, #1d3252, #0c1524)", border: "1px solid rgba(125,211,252,0.35)" }} />
          <div style={{ width: 4, height: 62, background: "linear-gradient(180deg, #16263f, #0a1220)" }} />
        </div>
        <Block {...BLOCKS[3]} />
        {/* KLCC twins + skybridge */}
        <div className="relative flex items-end gap-[8px]">
          <KlccTower />
          <KlccTower />
          <div className="absolute" style={{ left: 18, bottom: 58, width: 18, height: 3, background: "#24405f", borderTop: "1px solid rgba(125,211,252,0.4)" }} />
        </div>
        {BLOCKS.slice(4).map((block, index) => (
          <Block key={`r-${index}`} {...block} />
        ))}
      </div>
    </div>
  );
}
