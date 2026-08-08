"use client";
import { useUIStore } from "../../store/uiStore";
import { useLang, t } from "../../i18n/useLang";

// Compact MS/EN + dark/light controls meant to drop into any page's own
// top bar (Header.tsx, TacticalAuthShell, menu/load-game's custom bars) —
// state lives in useUIStore, already persisted+hydrated app-wide (see
// StoreHydrator), this component is just a visible control surface for it.
export default function LangThemeToggle() {
  const lang = useLang();
  const theme = useUIStore((s) => s.theme);
  const setLanguage = useUIStore((s) => s.setLanguage);
  const setTheme = useUIStore((s) => s.setTheme);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {(["ms", "en"] as const).map((code) => {
          const active = lang === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider transition-colors"
              style={{
                border: `1px solid ${active ? "var(--gold)" : "rgb(var(--cyan-rgb) / 0.25)"}`,
                color: active ? "var(--gold)" : "var(--text-muted)",
                background: active ? "rgb(var(--gold-rgb) / 0.08)" : "transparent",
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {code.toUpperCase()}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label={theme === "dark" ? t(lang, "components_layout_LangThemeToggle.switchToLight") : t(lang, "components_layout_LangThemeToggle.switchToDark")}
        title={theme === "dark" ? t(lang, "components_layout_LangThemeToggle.switchToLight") : t(lang, "components_layout_LangThemeToggle.switchToDark")}
        className="px-1.5 py-0.5 text-[11px] leading-none transition-colors"
        style={{ border: "1px solid rgb(var(--cyan-rgb) / 0.25)", color: "var(--cyan)", background: "transparent" }}
      >
        {theme === "dark" ? "☀" : "☾"}
      </button>
    </div>
  );
}
