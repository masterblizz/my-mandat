import { RED, CYAN, GOLD } from "./theme";

// Full-bleed decorative backdrop for /login and /register — ported from the
// Claude Design canvas "Login Page.dc.html", variant 5a ("Peta taktikal +
// kad tengah"): a radial cyan/gold wash, two zoomed/cropped copies of the
// real /malaysia.svg recolored cyan via a black-then-hue-rotate filter
// (Peninsular clipped to the left 60%, Borneo full-bleed on the right) as
// an atmospheric map glow, a drifting grid, faint scanlines, a spinning
// radar dial, and four pulsing activity blips. Pure CSS/SVG — no fetch, no
// client state — the animations are the only motion, all disabled under
// prefers-reduced-motion via the mm-auth- classes in globals.css.
const MAP_RECOLOR_FILTER =
  "brightness(0) saturate(100%) invert(70%) sepia(85%) saturate(1200%) hue-rotate(155deg) brightness(1.4) drop-shadow(0 0 24px rgba(0,212,255,0.25))";

const BLIPS: { left: string; top: string; size: number; color: string; delay: string }[] = [
  { left: "12.2%", top: "60.9%", size: 8, color: CYAN, delay: "0s" },
  { left: "95%", top: "35.6%", size: 8, color: GOLD, delay: "0.6s" },
  { left: "20.6%", top: "84.1%", size: 6, color: GOLD, delay: "1.2s" },
  { left: "80%", top: "78%", size: 6, color: CYAN, delay: "1.8s" },
];

export default function AuthBackground() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 1100px 800px at 60% 46%, rgba(0,212,255,0.20), transparent 62%), radial-gradient(ellipse 700px 600px at 20% 85%, rgba(255,178,44,0.08), transparent 60%), #04060c",
        }}
      />

      {/* Peninsular Malaysia, cropped to the left 60% so it doesn't overlap Borneo */}
      <div
        className="mm-auth-map-glow pointer-events-none absolute inset-0"
        style={{
          clipPath: "inset(0 40% 0 0)",
          backgroundImage: "url(/malaysia.svg)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "2400px auto",
          backgroundPosition: "-172px 128px",
          opacity: 0.15,
          filter: MAP_RECOLOR_FILTER,
          mixBlendMode: "screen",
        }}
      />
      {/* East Malaysia (Sabah/Sarawak), full-bleed on the right */}
      <div
        className="mm-auth-map-glow pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "url(/malaysia.svg)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "2400px auto",
          backgroundPosition: "-720px 128px",
          opacity: 0.15,
          filter: MAP_RECOLOR_FILTER,
          mixBlendMode: "screen",
        }}
      />

      <div
        className="mm-auth-grid-drift pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(148,163,184,0.05) 0px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(148,163,184,0.05) 0px, transparent 1px 40px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.014), rgba(255,255,255,0.014) 1px, transparent 1px, transparent 4px)",
        }}
      />

      <svg
        className="mm-auth-radar-spin pointer-events-none absolute"
        style={{ right: 40, top: 40, opacity: 0.4, transformOrigin: "50% 50%" }}
        width="760"
        height="760"
        viewBox="0 0 760 760"
      >
        <circle cx="380" cy="380" r="350" fill="none" stroke={RED} strokeWidth="1" />
        <circle cx="380" cy="380" r="260" fill="none" stroke={RED} strokeWidth="1" strokeDasharray="2 6" />
        <circle cx="380" cy="380" r="170" fill="none" stroke={RED} strokeWidth="1" />
        <circle cx="380" cy="380" r="80" fill="none" stroke={RED} strokeWidth="1" strokeDasharray="2 6" />
        <line x1="380" y1="30" x2="380" y2="730" stroke={RED} strokeWidth="1" />
        <line x1="30" y1="380" x2="730" y2="380" stroke={RED} strokeWidth="1" />
        <path d="M 380 380 L 380 30 A 350 350 0 0 1 627 133 Z" fill="rgba(193,31,44,0.12)" />
      </svg>

      {BLIPS.map((blip, i) => (
        <div
          key={i}
          className="mm-auth-blip pointer-events-none absolute rounded-full"
          style={{
            left: blip.left,
            top: blip.top,
            width: blip.size,
            height: blip.size,
            background: blip.color,
            boxShadow: `0 0 ${blip.size * 1.5}px ${blip.size / 2}px ${blip.color}b3`,
            animationDelay: blip.delay,
          }}
        />
      ))}
    </>
  );
}
