"use client";

import { t, type Lang } from "../../i18n/useLang";

// War-room styled credits dialog for the main menu — ported from a design
// reference (MyMandatCredits.jsx) and reskinned onto the project's own
// tokens (CSS vars, Space Mono, bilingual t()) instead of its standalone
// hardcoded palette/fonts, so it matches every other screen in the app.
const ROSTER: { idx: string; roleKey: string; whoKey: string; tag: string; lead?: boolean }[] = [
  { idx: "01", roleKey: "rosterDeveloperStudio", whoKey: "rosterDeveloperStudioWho", tag: "DEVELOPER", lead: true },
  { idx: "02", roleKey: "rosterCreativeDirection", whoKey: "rosterCreativeDirectionWho", tag: "CONCEPT" },
  { idx: "03", roleKey: "rosterUiDesign", whoKey: "rosterUiDesignWho", tag: "UI / UX" },
  { idx: "04", roleKey: "rosterElectionSimulation", whoKey: "rosterElectionSimulationWho", tag: "SYSTEM" },
];

const TICKER_ITEMS = [
  "SELANGOR",
  "JOHOR",
  "SABAH",
  "SARAWAK",
  "PERAK",
  "KEDAH",
  "PULAU PINANG",
  "PAKATAN HARAPAN",
  "PERIKATAN NASIONAL",
  "BARISAN NASIONAL",
  "GABUNGAN PARTI SARAWAK",
];

export default function CreditsModal({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const tickerText = [...TICKER_ITEMS, ...TICKER_ITEMS].join("   ·   ");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, "components_menu_CreditsModal.myMandatOperationCredits")}
      className="fixed inset-0 z-[9997] flex items-center justify-center px-4"
      style={{ background: "rgba(2, 6, 12, 0.86)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <section
        className="relative w-full max-w-[820px] overflow-hidden border"
        style={{
          borderColor: "rgb(var(--cyan-rgb) / 0.28)",
          background: "linear-gradient(180deg, var(--panel) 0%, var(--panel-dark) 100%)",
          boxShadow: "0 0 42px rgb(var(--gold-rgb) / 0.14), inset 0 0 40px rgb(var(--cyan-rgb) / 0.04)",
          fontFamily: "'Space Mono', monospace",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="pointer-events-none absolute left-2.5 top-2.5 h-5 w-5 border-l-2 border-t-2" style={{ borderColor: "var(--cyan)", opacity: 0.7 }} />
        <span className="pointer-events-none absolute right-2.5 top-2.5 h-5 w-5 border-r-2 border-t-2" style={{ borderColor: "var(--cyan)", opacity: 0.7 }} />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 h-5 w-5 border-b-2 border-l-2" style={{ borderColor: "var(--cyan)", opacity: 0.7 }} />
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 h-5 w-5 border-b-2 border-r-2" style={{ borderColor: "var(--cyan)", opacity: 0.7 }} />

        <div
          className="flex items-center justify-between px-6 py-2.5"
          style={{ background: "rgb(var(--neon-red-rgb) / 0.08)", borderBottom: "1px solid rgb(var(--neon-red-rgb) / 0.3)" }}
        >
          <span className="flex items-center text-[11px] font-bold tracking-[0.24em]" style={{ color: "var(--neon-red)" }}>
            <span className="mmc-dot mr-2 inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--neon-red)" }} />
            {t(lang, "components_menu_CreditsModal.classifiedOperationClosed")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="border px-2.5 py-1 text-[11px] font-bold tracking-[0.18em] transition hover:brightness-125"
            style={{ borderColor: "rgb(var(--neon-red-rgb) / 0.4)", color: "var(--neon-red)" }}
          >
            {t(lang, "components_menu_CreditsModal.close")} ×
          </button>
        </div>

        <div className="relative overflow-hidden border-b px-11 py-8" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.2)" }}>
          <div className="mmc-radar pointer-events-none absolute" style={{ top: "50%", right: -60, transform: "translateY(-50%)", width: 220, height: 220, opacity: 0.4 }}>
            <svg viewBox="0 0 220 220">
              <circle cx="110" cy="110" r="100" fill="none" stroke="var(--cyan)" strokeOpacity="0.25" strokeWidth="1" />
              <circle cx="110" cy="110" r="70" fill="none" stroke="var(--cyan)" strokeOpacity="0.2" strokeWidth="1" />
              <circle cx="110" cy="110" r="40" fill="none" stroke="var(--cyan)" strokeOpacity="0.15" strokeWidth="1" />
              <g className="mmc-sweep">
                <path d="M110 110 L110 10 A100 100 0 0 1 180 40 Z" fill="var(--cyan)" fillOpacity="0.12" />
              </g>
            </svg>
          </div>

          <div className="flex items-center gap-2.5 text-[11px] font-bold tracking-[0.4em]" style={{ color: "var(--gold)" }}>
            <span style={{ width: 24, height: 1, background: "var(--gold)" }} />
            {t(lang, "components_menu_CreditsModal.operationCredits")}
          </div>
          <h2
            className="mt-3 text-[38px] font-black tracking-[0.14em]"
            style={{ color: "var(--text-primary)", textShadow: "0 0 26px rgb(var(--cyan-rgb) / 0.35)" }}
          >
            MY MANDAT
          </h2>
          <div className="mt-2 text-[12px] tracking-[0.06em]" style={{ color: "var(--text-muted)" }}>
            {t(lang, "components_menu_CreditsModal.tacticalElectionSimulatorExeRunBy")}
            <span className="mmc-caret ml-1 inline-block" style={{ width: 8, height: 13, background: "var(--cyan)", verticalAlign: -2 }} />
          </div>
        </div>

        <div className="px-11 pb-2 pt-7">
          <div className="mb-4 text-[11px] font-bold tracking-[0.32em]" style={{ color: "var(--text-muted)" }}>
            {t(lang, "components_menu_CreditsModal.personnelList")}
          </div>
          {ROSTER.map((r, i) => (
            <div
              key={r.idx}
              className="mmc-row grid items-center gap-4 py-3.5"
              style={{
                gridTemplateColumns: "30px 1fr auto",
                borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.12)",
                animationDelay: `${0.05 + i * 0.1}s`,
              }}
            >
              <div className="text-right text-[12px]" style={{ color: "rgb(var(--cyan-rgb) / 0.55)" }}>{r.idx}</div>
              <div>
                <div className="mb-1 text-[11px] font-bold tracking-[0.2em]" style={{ color: "var(--gold)" }}>{t(lang, `components_menu_CreditsModal.${r.roleKey}`)}</div>
                <div className="text-[17px] font-bold" style={{ color: r.lead ? "var(--cyan)" : "var(--text-primary)" }}>{t(lang, `components_menu_CreditsModal.${r.whoKey}`)}</div>
              </div>
              <div
                className="whitespace-nowrap border px-2.5 py-1 text-[10px] font-bold tracking-[0.18em]"
                style={{ borderColor: r.lead ? "rgb(var(--gold-rgb) / 0.4)" : "rgb(var(--cyan-rgb) / 0.2)", color: r.lead ? "var(--gold)" : "var(--text-muted)" }}
              >
                {r.tag}
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden whitespace-nowrap border-y py-2.5" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.2)", background: "rgb(var(--cyan-rgb) / 0.04)" }}>
          <span className="mmc-ticker-track inline-block text-[11px] tracking-[0.14em]" style={{ color: "rgb(var(--cyan-rgb) / 0.55)" }}>
            {tickerText}
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-6 px-11 py-6">
          <p className="max-w-[520px] text-[13px] leading-6" style={{ color: "var(--text-muted)" }}>
            {t(lang, "components_menu_CreditsModal.builtAsAnInteractivePoliticalSimulation")}
          </p>
          <div
            className="whitespace-nowrap border-2 px-3 py-1.5 text-[12px] font-black tracking-[0.24em]"
            style={{ color: "var(--neon-red)", borderColor: "var(--neon-red)", opacity: 0.75, transform: "rotate(-6deg)" }}
          >
            {t(lang, "components_menu_CreditsModal.simulationOnly")}
          </div>
        </div>
      </section>

      <style>{`
        @keyframes mmc-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }
        .mmc-dot { animation: mmc-blink 1.6s infinite; }
        .mmc-caret { animation: mmc-blink 1s infinite; }
        @keyframes mmc-spin { to { transform: rotate(360deg); } }
        .mmc-sweep { transform-origin: 110px 110px; animation: mmc-spin 4s linear infinite; }
        @keyframes mmc-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .mmc-row { opacity: 0; animation: mmc-rise 0.5s ease forwards; }
        @keyframes mmc-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .mmc-ticker-track { animation: mmc-scroll 22s linear infinite; }
      `}</style>
    </div>
  );
}
