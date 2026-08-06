"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLang, t } from "../../i18n/useLang";
import { useUIStore, type Lang } from "../../store/uiStore";
import Skyline from "../layout/Skyline";

// Same corner-bracket motif as the /menu CornerFrame — kept local (not
// imported from menu/page.tsx, which doesn't export it) since it's a
// trivial four-span decoration, not worth threading through a shared file
// for two call sites.
function CornerFrame() {
  return (
    <>
      <span className="pointer-events-none absolute left-0 top-0 h-5 w-5 border-l border-t" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.4)" }} />
      <span className="pointer-events-none absolute right-0 top-0 h-5 w-5 border-r border-t" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.4)" }} />
      <span className="pointer-events-none absolute bottom-0 left-0 h-5 w-5 border-b border-l" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.4)" }} />
      <span className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 border-b border-r" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.4)" }} />
    </>
  );
}

// Scattered "live signal" blips, echoing the pulsing hotspot dots on the
// /menu map — reads as a faint operations map ticking along behind the
// login panel instead of empty space. Positions avoid the centred panel;
// each dot gets its own animation-delay so they don't blink in lockstep.
const HOTSPOTS: { left: string; top: string; color: "cyan" | "gold"; delay: string }[] = [
  { left: "10%", top: "18%", color: "cyan", delay: "0s" },
  { left: "88%", top: "14%", color: "gold", delay: "0.6s" },
  { left: "15%", top: "78%", color: "gold", delay: "1.1s" },
  { left: "92%", top: "70%", color: "cyan", delay: "1.7s" },
  { left: "6%", top: "48%", color: "cyan", delay: "0.3s" },
  { left: "94%", top: "42%", color: "gold", delay: "1.4s" },
];

function AmbientBackground() {
  return (
    <>
      <div className="mm-particles" />
      <div className="mm-radar" />
      {HOTSPOTS.map((spot, i) => {
        const rgbVar = spot.color === "cyan" ? "var(--cyan-rgb)" : "var(--gold-rgb)";
        return (
          <span
            key={i}
            className="mm-blip pointer-events-none absolute h-1.5 w-1.5 rounded-full"
            style={{
              left: spot.left,
              top: spot.top,
              background: `rgb(${rgbVar})`,
              boxShadow: `0 0 8px 2px rgb(${rgbVar} / 0.7)`,
              animationDelay: spot.delay,
            }}
          />
        );
      })}
    </>
  );
}

function BackButton() {
  const lang = useLang();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="absolute left-5 top-5 z-20 border px-2 py-1 text-[9px] font-black tracking-[0.18em] transition-all hover:bg-cyan/10"
      style={{ borderColor: "rgb(var(--cyan-rgb) / 0.32)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / 0.06)" }}
    >
      ← {t(lang, "KEMBALI", "BACK")}
    </button>
  );
}

function LangToggle() {
  const lang = useLang();
  const setLanguage = useUIStore((s) => s.setLanguage);
  const codes: Lang[] = ["ms", "en"];
  return (
    <div className="flex gap-1">
      {codes.map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLanguage(code)}
            className="border px-2 py-1 text-[9px] font-black tracking-[0.18em]"
            style={{
              borderColor: active ? "rgb(var(--gold-rgb) / 0.7)" : "rgb(var(--cyan-rgb) / 0.2)",
              color: active ? "var(--gold)" : "var(--text-muted)",
              background: active ? "rgb(var(--gold-rgb) / 0.08)" : "transparent",
            }}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function ThemeToggle() {
  const lang = useLang();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const options: { id: "dark" | "light"; labelMS: string; labelEN: string }[] = [
    { id: "dark", labelMS: "GELAP", labelEN: "DARK" },
    { id: "light", labelMS: "CERAH", labelEN: "LIGHT" },
  ];
  return (
    <div className="flex gap-1">
      {options.map((opt) => {
        const active = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme(opt.id)}
            className="border px-2 py-1 text-[9px] font-black tracking-[0.18em]"
            style={{
              borderColor: active ? "rgb(var(--gold-rgb) / 0.7)" : "rgb(var(--cyan-rgb) / 0.2)",
              color: active ? "var(--gold)" : "var(--text-muted)",
              background: active ? "rgb(var(--gold-rgb) / 0.08)" : "transparent",
            }}
          >
            {t(lang, opt.labelMS, opt.labelEN)}
          </button>
        );
      })}
    </div>
  );
}

// Shared chrome for /login and /register: same dark tactical background,
// scanline/grid overlay, MY MANDAT wordmark and bordered panel used
// everywhere else in the app (see /menu). Only the panel's title/subtitle
// and form body differ per page.
export default function AuthShell({ title, subtitle, children, footNote, showBack = true }: { title: string; subtitle: string; children: ReactNode; footNote?: ReactNode; showBack?: boolean }) {
  const lang = useLang();
  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{
        background:
          "radial-gradient(circle at 26% 20%, rgb(var(--cyan-rgb) / 0.09), transparent 38%), radial-gradient(circle at 82% 82%, rgb(var(--gold-rgb) / 0.05), transparent 36%), var(--bg)",
        color: "var(--text-primary)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.24]" style={{ backgroundImage: "linear-gradient(rgb(var(--cyan-rgb) / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--cyan-rgb) / 0.06) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.016), rgba(255,255,255,0.016) 1px, transparent 1px, transparent 4px)" }} />
      <AmbientBackground />
      <Skyline opacity={0.32} />

      {showBack && <BackButton />}
      <div className="absolute right-5 top-5 z-20 flex items-center gap-2">
        <ThemeToggle />
        <span className="h-3.5 w-px" style={{ background: "rgb(var(--cyan-rgb) / 0.2)" }} />
        <LangToggle />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-3 mm-rise" style={{ ["--mm-i" as string]: 0 }}>
          <img src="/logo-peti-undi.png" alt="My Mandat" width={48} height={48} style={{ filter: "drop-shadow(0 0 8px rgb(0 212 255 / 0.4))" }} />
          <div className="leading-none">
            <div className="whitespace-nowrap">
              <span className="text-[27px] font-black" style={{ color: "#55dcff", textShadow: "0 0 24px rgb(var(--cyan-rgb) / 0.45)" }}>MY </span>
              <span className="text-[27px] font-black" style={{ color: "#ffb22c", textShadow: "0 0 28px rgb(var(--gold-rgb) / 0.45)" }}>MANDAT</span>
            </div>
            <div className="text-[8px] font-bold tracking-[0.34em]" style={{ color: "rgb(var(--gold-rgb) / 0.55)" }}>
              {t(lang, "SIMULATOR KEMPEN PILIHAN RAYA", "CAMPAIGN COMMAND SIMULATOR")}
            </div>
          </div>
        </div>

        <section
          className="relative overflow-hidden border mm-rise"
          style={{
            ["--mm-i" as string]: 1,
            borderColor: "rgb(var(--cyan-rgb) / 0.28)",
            background: "linear-gradient(135deg, rgb(var(--cyan-rgb) / 0.08), var(--panel-dark))",
            boxShadow: "0 0 40px rgb(var(--cyan-rgb) / 0.1), inset 0 0 40px rgb(var(--cyan-rgb) / 0.03)",
          }}
        >
          <CornerFrame />
          <div className="border-b px-6 py-4" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.18)" }}>
            <div className="text-[11px] font-black tracking-[0.3em]" style={{ color: "var(--cyan)" }}>{title}</div>
            <div className="mt-1 text-[10px] tracking-[0.06em]" style={{ color: "var(--text-muted)" }}>{subtitle}</div>
          </div>
          <div className="px-6 py-6">{children}</div>
        </section>

        {footNote && <div className="mt-4 text-center text-[9px] tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{footNote}</div>}
      </div>
    </main>
  );
}
