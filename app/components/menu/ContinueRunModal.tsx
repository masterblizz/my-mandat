"use client";

import type { SavedGameSlot } from "../../store/saveGame";
import { t, type Lang } from "../../i18n/useLang";

function formatSavedAt(savedAt: string, lang: Lang) {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(lang === "ms" ? "ms-MY" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ContinueRunModal({ lang, slot, onConfirm, onClose }: {
  lang: Lang;
  slot: SavedGameSlot;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="continue-run-title"
      className="fixed inset-0 z-[9998] flex items-center justify-center px-4"
      style={{ background: "rgb(var(--bg-rgb) / 0.88)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <section
        className="relative w-full max-w-[560px] overflow-hidden border p-6"
        style={{
          borderColor: "rgb(var(--cyan-rgb) / 0.42)",
          background: "linear-gradient(145deg, var(--panel), var(--panel-dark))",
          boxShadow: "0 0 42px rgb(var(--cyan-rgb) / .13), inset 0 0 28px rgb(var(--cyan-rgb) / .05)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="pointer-events-none absolute left-2 top-2 h-5 w-5 border-l-2 border-t-2" style={{ borderColor: "var(--cyan)" }} />
        <span className="pointer-events-none absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2" style={{ borderColor: "var(--cyan)" }} />
        <div className="flex items-center gap-2 text-[10px] font-black tracking-[.28em]" style={{ color: "var(--cyan)" }}>
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--cyan)" }} />
          {t(lang, "menu_page.savedGameDetected")}
        </div>
        <h2 id="continue-run-title" className="mt-3 text-xl font-black tracking-[.12em] text-white">
          {t(lang, "menu_page.continueLastSavedGame")}
        </h2>
        <p className="mt-3 text-xs leading-6" style={{ color: "var(--text-muted)" }}>
          {t(lang, "menu_page.continueSaveExplanation")}
        </p>

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-y py-4 text-[11px]" style={{ borderColor: "rgb(var(--cyan-rgb) / .2)" }}>
          <dt style={{ color: "var(--text-muted)" }}>{t(lang, "menu_page.saveSlot")}</dt>
          <dd className="font-bold text-white">{slot.slotNumber.toString().padStart(2, "0")}</dd>
          <dt style={{ color: "var(--text-muted)" }}>{t(lang, "menu_page.campaign")}</dt>
          <dd className="font-bold text-white">{slot.label}</dd>
          <dt style={{ color: "var(--text-muted)" }}>{t(lang, "menu_page.constituency")}</dt>
          <dd className="font-bold text-white">{slot.state.leader.homeConstituencyName || "—"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>{t(lang, "menu_page.leaderName")}</dt>
          <dd className="font-bold text-white">{slot.state.leader.name || "—"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>{t(lang, "menu_page.party")}</dt>
          <dd className="font-bold" style={{ color: slot.state.leader.partyColor || "var(--cyan)" }}>{slot.state.leader.partyAbbr || slot.state.leader.party || "—"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>{t(lang, "menu_page.lastSaved")}</dt>
          <dd className="font-bold" style={{ color: "var(--gold)" }}>{formatSavedAt(slot.savedAt, lang)}</dd>
        </dl>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="border px-4 py-2.5 text-[10px] font-black tracking-[.16em]" style={{ borderColor: "rgb(var(--cyan-rgb) / .28)", color: "var(--text-muted)" }}>
            {t(lang, "menu_page.cancel")}
          </button>
          <button type="button" onClick={onConfirm} className="border px-4 py-2.5 text-[10px] font-black tracking-[.16em]" style={{ borderColor: "var(--gold)", background: "var(--gold)", color: "#05080e" }}>
            {t(lang, "menu_page.continueGame")}
          </button>
        </div>
      </section>
    </div>
  );
}
