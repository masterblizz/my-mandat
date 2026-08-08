"use client";
import { useState } from "react";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import StatBar from "../components/ui/StatBar";
import Toggle from "../components/ui/Toggle";
import { useGameStore } from "../store/gameStore";
import { useUIStore } from "../store/uiStore";
import { useLang, t } from "../i18n/useLang";
import { states } from "../data/states";

// ─── Types ───────────────────────────────────────────────────────────────────

type SettingsTab =
  | "GAMEPLAY"
  | "AUDIO"
  | "DISPLAY"
  | "CONTROLS"
  | "NOTIFICATIONS"
  | "LANGUAGE"
  | "ABOUT";

// ─── Difficulty presets ───────────────────────────────────────────────────────

const DIFFICULTY_PRESETS = {
  easy: { opposition: 30, media: 25, events: 40, economy: 80 },
  normal: { opposition: 60, media: 50, events: 60, economy: 50 },
  hard: { opposition: 75, media: 70, events: 75, economy: 35 },
  nightmare: { opposition: 95, media: 90, events: 95, economy: 15 },
} as const;

type DifficultyKey = keyof typeof DIFFICULTY_PRESETS;

// ─── Sidebar Tab Item ─────────────────────────────────────────────────────────

function SidebarTab({
  label,
  active,
  onClick,
}: {
  id: SettingsTab;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 transition-all"
      style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: "13px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: active ? "var(--text-primary)" : "var(--text-muted)",
        background: active ? "rgb(var(--gold-rgb) / 0.07)" : "transparent",
        borderLeft: active ? "2px solid var(--gold)" : "2px solid transparent",
        borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.06)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ─── Setting Row wrapper ──────────────────────────────────────────────────────

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.1)" }}>
      <span className="text-text-muted uppercase" style={{ fontSize: "13px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// ─── Volume Slider ────────────────────────────────────────────────────────────

function VolumeSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-4 py-3" style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.1)" }}>
      <span className="text-text-muted uppercase shrink-0" style={{ fontSize: "13px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em", minWidth: "140px" }}>
        {label}
      </span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" style={{ accentColor: "var(--cyan)" }} />
      <span className="text-cyan font-bold tabular-nums" style={{ fontSize: "14px", fontFamily: "'Space Mono', monospace", minWidth: "36px", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

// ─── GAMEPLAY TAB ─────────────────────────────────────────────────────────────

function GameplayTab() {
  const lang = useLang();
  const { settings, updateSettings } = useGameStore();
  const difficulty = settings.difficulty as DifficultyKey;
  const preset = DIFFICULTY_PRESETS[difficulty];
  const [localFund, setLocalFund] = useState(settings.startingFund);
  const [saved, setSaved] = useState(false);

  const adjustFund = (delta: number) => {
    const next = Math.max(500000, Math.min(10000000, localFund + delta));
    setLocalFund(next);
    updateSettings({ startingFund: next });
  };

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <TacticalPanel title={t(lang, "settings_page.gameplaySettings")}>
          <SettingRow label={t(lang, "settings_page.campaignLength")}>
            <select value={settings.campaignLength} onChange={(e) => updateSettings({ campaignLength: e.target.value as "full" | "short" | "custom" })} style={{ minWidth: "200px" }}>
              <option value="full">{t(lang, "settings_page.fullCampaign")}</option>
              <option value="short">{t(lang, "settings_page.shortCampaign")}</option>
              <option value="custom">{t(lang, "settings_page.custom")}</option>
            </select>
          </SettingRow>

          <SettingRow label={t(lang, "settings_page.electionMode")}>
            <div className="flex flex-col gap-2" style={{ minWidth: "260px" }}>
              <select value={settings.electionScope ?? "pru"} onChange={(e) => updateSettings({ electionScope: e.target.value as "pru" | "prn" })}>
                <option value="pru">{t(lang, "settings_page.geGeneralElection")}</option>
                <option value="prn">{t(lang, "settings_page.stateElection")}</option>
              </select>
              {(settings.electionScope ?? "pru") === "prn" && (
                <select value={settings.prnStateId ?? "selangor"} onChange={(e) => updateSettings({ prnStateId: e.target.value })}>
                  {states.filter((state) => state.dunSeats > 0).map((state) => <option key={state.id} value={state.id}>{state.name} · {state.dunSeats} {t(lang, "settings_page.seats")}</option>)}
                </select>
              )}
            </div>
          </SettingRow>

          <SettingRow label={t(lang, "settings_page.difficulty")}>
            <select value={settings.difficulty} onChange={(e) => updateSettings({ difficulty: e.target.value as DifficultyKey })} style={{ minWidth: "200px" }}>
              <option value="easy">{t(lang, "settings_page.easy")}</option>
              <option value="normal">{t(lang, "settings_page.normal")}</option>
              <option value="hard">{t(lang, "settings_page.hard")}</option>
              <option value="nightmare">{t(lang, "settings_page.nightmare")}</option>
            </select>
          </SettingRow>

          <SettingRow label={t(lang, "settings_page.startingFund")}>
            <div className="flex items-center gap-2">
              <button onClick={() => adjustFund(-100000)} style={{ fontFamily: "'Space Mono', monospace", fontSize: "19px", background: "rgb(var(--cyan-rgb) / 0.1)", border: "1px solid rgb(var(--cyan-rgb) / 0.3)", padding: "2px 10px", cursor: "pointer", color: "var(--cyan)" }}>−</button>
              <span className="text-white font-bold tabular-nums" style={{ fontSize: "16px", fontFamily: "'Space Mono', monospace", minWidth: "130px", textAlign: "center" }}>RM {localFund.toLocaleString()}</span>
              <button onClick={() => adjustFund(100000)} style={{ fontFamily: "'Space Mono', monospace", fontSize: "19px", background: "rgb(var(--cyan-rgb) / 0.1)", border: "1px solid rgb(var(--cyan-rgb) / 0.3)", padding: "2px 10px", cursor: "pointer", color: "var(--cyan)" }}>+</button>
            </div>
          </SettingRow>

          <div className="py-3" style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.1)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-text-muted uppercase" style={{ fontSize: "13px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em" }}>{t(lang, "settings_page.oppositionStrength")}</span>
              <span className="text-cyan font-bold tabular-nums" style={{ fontSize: "14px", fontFamily: "'Space Mono', monospace" }}>{settings.oppositionStrength}</span>
            </div>
            <input type="range" min={0} max={100} value={settings.oppositionStrength} onChange={(e) => updateSettings({ oppositionStrength: Number(e.target.value) })} className="w-full" style={{ accentColor: "var(--neon-red)" }} />
          </div>

          <SettingRow label={t(lang, "settings_page.mediaBias")}>
            <div className="flex" style={{ border: "1px solid rgb(var(--cyan-rgb) / 0.3)" }}>
              {(["pro", "balanced", "hostile"] as const).map((bias) => {
                const labels = {
                  pro:      t(lang, "settings_page.proMandat"),
                  balanced: t(lang, "settings_page.balanced"),
                  hostile:  t(lang, "settings_page.hostile"),
                };
                const active = settings.mediaBias === bias;
                return (
                  <button key={bias} onClick={() => updateSettings({ mediaBias: bias })} style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", padding: "5px 10px", background: active ? "var(--gold)" : "transparent", color: active ? "#000" : "var(--text-muted)", border: "none", cursor: "pointer", transition: "all 0.15s" }}>
                    {labels[bias]}
                  </button>
                );
              })}
            </div>
          </SettingRow>

          <SettingRow label={t(lang, "settings_page.realisticPolls")}>
            <Toggle value={settings.realisticPolls} onChange={(v) => updateSettings({ realisticPolls: v })} />
          </SettingRow>
          <SettingRow label={t(lang, "settings_page.eventRandomness")}>
            <Toggle value={settings.eventRandomness} onChange={(v) => updateSettings({ eventRandomness: v })} />
          </SettingRow>
          <SettingRow label={t(lang, "settings_page.permanentConsequences")}>
            <Toggle value={settings.permanentConsequences} onChange={(v) => updateSettings({ permanentConsequences: v })} />
          </SettingRow>
        </TacticalPanel>
      </div>

      <div style={{ width: "280px", flexShrink: 0 }}>
        <TacticalPanel title={t(lang, "settings_page.difficultyPreview")} goldBorder>
          <div className="flex flex-col items-center mb-4">
            <div className="text-gold font-bold uppercase tracking-widest mb-2" style={{ fontSize: "34px", fontFamily: "'Space Mono', monospace" }}>
              {t(lang, `settings_page.preset_${difficulty}_label`)}
            </div>
            <div className="text-text-muted text-center" style={{ fontSize: "13px", fontFamily: "'Space Mono', monospace", lineHeight: "1.6" }}>
              {t(lang, `settings_page.preset_${difficulty}_desc`)}
            </div>
          </div>
          <div className="space-y-3 mb-6">
            <StatBar label={t(lang, "settings_page.oppStrength")} value={preset.opposition} color="var(--neon-red)" />
            <StatBar label={t(lang, "settings_page.mediaChallenge")} value={preset.media} color="var(--warn-orange)" />
            <StatBar label={t(lang, "settings_page.eventFrequency")} value={preset.events} color="var(--cyan)" />
            <StatBar label={t(lang, "settings_page.econConditions")} value={preset.economy} color="var(--neon-green)" />
          </div>
          <button
            className="btn-primary w-full"
            style={{ fontSize: "13px", letterSpacing: "0.12em", background: saved ? "var(--neon-green)" : undefined }}
            onClick={() => {
              updateSettings({ startingFund: localFund });
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }}
          >
            {saved ? t(lang, "settings_page.saved") : t(lang, "settings_page.saveApply")}
          </button>
        </TacticalPanel>
      </div>
    </div>
  );
}

// ─── AUDIO TAB ────────────────────────────────────────────────────────────────

function AudioTab() {
  const lang = useLang();
  const [master, setMaster] = useState(70);
  const [sfx, setSfx] = useState(80);
  const [uiSfx, setUiSfx] = useState(true);
  const { musicEnabled, musicVolume, setMusicEnabled, setMusicVolume } = useUIStore();

  return (
    <TacticalPanel title={t(lang, "settings_page.audioSettings")}>
      <VolumeSlider label={t(lang, "settings_page.masterVolume")} value={master} onChange={setMaster} />
      <VolumeSlider label={t(lang, "settings_page.musicVolume")} value={musicVolume} onChange={setMusicVolume} />
      <VolumeSlider label={t(lang, "settings_page.sfxVolume")} value={sfx} onChange={setSfx} />
      <SettingRow label={t(lang, "settings_page.backgroundMusic")}>
        <Toggle value={musicEnabled} onChange={setMusicEnabled} />
      </SettingRow>
      <SettingRow label={t(lang, "settings_page.uiSoundEffects")}>
        <Toggle value={uiSfx} onChange={setUiSfx} />
      </SettingRow>
      <p className="mt-4 text-[11px] leading-5" style={{ color: "var(--text-muted)" }}>
        {t(lang, "settings_page.musicStartsAfterTheFirstClick")}
      </p>
    </TacticalPanel>
  );
}

// ─── DISPLAY TAB ──────────────────────────────────────────────────────────────

function DisplayTab() {
  const lang = useLang();
  const { theme, setTheme } = useUIStore();
  const [scanLine, setScanLine] = useState(true);
  const [glow, setGlow] = useState(true);
  const [animations, setAnimations] = useState(true);
  const [fps, setFps] = useState("60");

  const themes: ("dark" | "light")[] = ["dark", "light"];

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <TacticalPanel title={t(lang, "settings_page.displaySettings")}>
          <div className="mb-1">
            <span className="text-text-muted uppercase" style={{ fontSize: "13px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em" }}>
              {t(lang, "settings_page.theme")}
            </span>
            <div className="flex gap-3 mt-3 mb-4">
              {themes.map((th) => {
                const active = theme === th;
                return (
                  <button key={th} onClick={() => setTheme(th)} className="flex-1 text-left p-3 transition-all" style={{ background: active ? "rgb(var(--gold-rgb) / 0.08)" : "var(--panel-dark)", border: active ? "2px solid var(--gold)" : "2px solid rgb(var(--cyan-rgb) / 0.2)", cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>
                    <div className="font-bold uppercase mb-1" style={{ fontSize: "12px", color: active ? "var(--gold)" : "var(--text-primary)", letterSpacing: "0.1em" }}>
                      {active ? "▶ " : ""}{t(lang, th === "dark" ? "settings_page.darkTactical" : "settings_page.lightOps")}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      {t(lang, `settings_page.themeDesc_${th}`)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <SettingRow label={t(lang, "settings_page.scanLineEffect")}><Toggle value={scanLine} onChange={setScanLine} /></SettingRow>
          <SettingRow label={t(lang, "settings_page.glowEffects")}><Toggle value={glow} onChange={setGlow} /></SettingRow>
          <SettingRow label={t(lang, "settings_page.animations")}><Toggle value={animations} onChange={setAnimations} /></SettingRow>
          <SettingRow label="FPS">
            <select value={fps} onChange={(e) => setFps(e.target.value)} style={{ minWidth: "120px" }}>
              <option value="30">30</option>
              <option value="60">60</option>
              <option value="unlimited">{t(lang, "settings_page.unlimited")}</option>
            </select>
          </SettingRow>
        </TacticalPanel>
      </div>

      <div style={{ width: "220px", flexShrink: 0 }}>
        <TacticalPanel title={t(lang, "settings_page.themePreview")} goldBorder>
          <div className="text-center py-2">
            <div className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: "13px", color: "var(--gold)" }}>
              {theme === "light" ? t(lang, "settings_page.lightOps") : t(lang, "settings_page.darkTactical")}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.5" }}>
              {theme === "light"
                ? t(lang, "settings_page.daylightFieldworkModeSuitedForBright")
                : t(lang, "settings_page.commandCentreModeLowLightTactical")}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full shrink-0" style={{ background: "var(--cyan)" }} /><span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t(lang, "settings_page.accentCyan")}</span></div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full shrink-0" style={{ background: "var(--gold)" }} /><span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t(lang, "settings_page.accentGold")}</span></div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full shrink-0" style={{ background: "var(--panel)" }} /><span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t(lang, "settings_page.panelBg")}</span></div>
          </div>
          <div className="mt-4 text-center" style={{ fontSize: "11px", color: "var(--neon-green)", letterSpacing: "0.08em" }}>
            ✓ {t(lang, "settings_page.appliedLive")}
          </div>
        </TacticalPanel>
      </div>
    </div>
  );
}

// ─── CONTROLS TAB ─────────────────────────────────────────────────────────────

function ControlsTab() {
  const lang = useLang();
  const shortcuts: [string, string][] = [
    ["↑ ↓", "settings_page.shortcutNavigateMenus"],
    ["↵",   "settings_page.shortcutSelectConfirm"],
    ["ESC", "settings_page.shortcutBackCancel"],
    ["M",   "settings_page.shortcutOpenMap"],
    ["H",   "settings_page.shortcutCampaignHq"],
    ["P",   "settings_page.shortcutPollingData"],
  ];

  return (
    <TacticalPanel title={t(lang, "settings_page.keyboardShortcuts")}>
      <div className="space-y-0">
        {shortcuts.map(([key, labelKey]) => (
          <div key={key} className="flex items-center gap-4 py-3" style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.1)" }}>
            <div className="flex items-center justify-center shrink-0" style={{ minWidth: "56px", padding: "4px 10px", background: "var(--panel-dark)", border: "1px solid rgb(var(--cyan-rgb) / 0.4)", color: "var(--cyan)", fontFamily: "'Space Mono', monospace", fontSize: "16px", fontWeight: "bold", letterSpacing: "0.05em", boxShadow: "0 0 8px rgb(var(--cyan-rgb) / 0.15)" }}>
              {key}
            </div>
            <span className="text-white uppercase tracking-wider" style={{ fontSize: "13px", fontFamily: "'Space Mono', monospace" }}>
              {t(lang, labelKey)}
            </span>
          </div>
        ))}
      </div>
    </TacticalPanel>
  );
}

// ─── NOTIFICATIONS TAB ───────────────────────────────────────────────────────

function NotificationsTab() {
  const lang = useLang();
  const [eventAlerts, setEventAlerts] = useState(true);
  const [pollUpdates, setPollUpdates] = useState(true);
  const [opCompletion, setOpCompletion] = useState(true);
  const [mediaAlerts, setMediaAlerts] = useState(true);

  return (
    <TacticalPanel title={t(lang, "settings_page.notificationSettings")}>
      <SettingRow label={t(lang, "settings_page.eventAlerts")}><Toggle value={eventAlerts} onChange={setEventAlerts} /></SettingRow>
      <SettingRow label={t(lang, "settings_page.pollUpdates")}><Toggle value={pollUpdates} onChange={setPollUpdates} /></SettingRow>
      <SettingRow label={t(lang, "settings_page.opCompletion")}><Toggle value={opCompletion} onChange={setOpCompletion} /></SettingRow>
      <SettingRow label={t(lang, "settings_page.mediaAlerts")}><Toggle value={mediaAlerts} onChange={setMediaAlerts} /></SettingRow>
    </TacticalPanel>
  );
}

// ─── LANGUAGE TAB ────────────────────────────────────────────────────────────

function LanguageTab() {
  const { language: lang, setLanguage: setLang } = useUIStore();

  const langs: { id: "en" | "ms"; label: string; native: string }[] = [
    { id: "ms", label: "BAHASA MALAYSIA", native: "Bahasa Malaysia" },
    { id: "en", label: "ENGLISH",         native: "English" },
  ];

  return (
    <TacticalPanel title="LANGUAGE / BAHASA">
      <div className="space-y-3 mt-2">
        {langs.map((l) => {
          const active = lang === l.id;
          return (
            <button key={l.id} onClick={() => setLang(l.id)} className="w-full text-left flex items-center gap-4 p-4 transition-all" style={{ background: active ? "rgb(var(--gold-rgb) / 0.08)" : "var(--panel-dark)", border: active ? "1px solid var(--gold)" : "1px solid rgb(var(--cyan-rgb) / 0.2)", cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>
              <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: "20px", height: "20px", border: `2px solid ${active ? "var(--gold)" : "var(--text-muted)"}` }}>
                {active && <div className="rounded-full" style={{ width: "10px", height: "10px", background: "var(--gold)" }} />}
              </div>
              <div>
                <div className="uppercase font-bold" style={{ fontSize: "14px", color: active ? "var(--gold)" : "var(--text-primary)", letterSpacing: "0.1em" }}>{l.label}</div>
                <div className="text-text-muted" style={{ fontSize: "13px", marginTop: "2px" }}>{l.native}</div>
              </div>
            </button>
          );
        })}
      </div>
    </TacticalPanel>
  );
}

// ─── ABOUT TAB ───────────────────────────────────────────────────────────────

function AboutTab() {
  const lang = useLang();
  return (
    <TacticalPanel title={t(lang, "settings_page.about")}>
      <div className="space-y-6 py-2">
        <div className="text-center">
          <div className="text-gold font-bold uppercase tracking-widest" style={{ fontSize: "34px", fontFamily: "'Space Mono', monospace", textShadow: "0 0 20px rgb(var(--gold-rgb) / 0.4)" }}>MY MANDAT</div>
          <div className="text-text-muted mt-1" style={{ fontSize: "13px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.15em" }}>
            {t(lang, "settings_page.malaysianPoliticalCampaignSimulator")}
          </div>
          <div className="text-cyan mt-2 font-bold" style={{ fontSize: "16px", fontFamily: "'Space Mono', monospace" }}>v1.0.0</div>
        </div>

        <div style={{ height: "1px", background: "rgb(var(--cyan-rgb) / 0.2)" }} />

        <div>
          <div className="panel-header mb-3">{t(lang, "settings_page.techStack")}</div>
          <div className="space-y-2">
            {[
              [t(lang, "settings_page.framework"), "Next.js 14 (App Router)"],
              [t(lang, "settings_page.language"),  "TypeScript"],
              [t(lang, "settings_page.styling"),   "Tailwind CSS + Space Mono"],
              [t(lang, "settings_page.state"),     "Zustand"],
              [t(lang, "settings_page.platform"),  "Browser / Web"],
            ].map(([label, val]) => (
              <div key={label} className="flex gap-3">
                <span className="text-text-muted uppercase shrink-0" style={{ fontSize: "12px", fontFamily: "'Space Mono', monospace", minWidth: "90px" }}>{label}</span>
                <span className="text-white" style={{ fontSize: "13px", fontFamily: "'Space Mono', monospace" }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: "1px", background: "rgb(var(--cyan-rgb) / 0.2)" }} />

        <div className="text-center text-text-muted" style={{ fontSize: "12px", fontFamily: "'Space Mono', monospace", lineHeight: "1.8", letterSpacing: "0.05em" }}>
          <div>BUILT WITH NEXT.JS, TYPESCRIPT, TAILWIND CSS</div>
          <div className="mt-2 text-gold">© 2024 PARTI MANDAT MY</div>
          <div className="mt-1">{t(lang, "settings_page.allRightsReserved")}</div>
        </div>
      </div>
    </TacticalPanel>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TAB_IDS: SettingsTab[] = [
  "GAMEPLAY", "AUDIO", "DISPLAY", "CONTROLS", "NOTIFICATIONS", "LANGUAGE", "ABOUT",
];

export default function SettingsPage() {
  const lang = useLang();
  const [activeTab, setActiveTab] = useState<SettingsTab>("GAMEPLAY");

  const TAB_LABELS: Record<SettingsTab, string> = {
    GAMEPLAY:      t(lang, "settings_page.gameplay"),
    AUDIO:         t(lang, "settings_page.audio"),
    DISPLAY:       t(lang, "settings_page.display"),
    CONTROLS:      t(lang, "settings_page.controls"),
    NOTIFICATIONS: t(lang, "settings_page.notifications"),
    LANGUAGE:      t(lang, "settings_page.language"),
    ABOUT:         t(lang, "settings_page.about"),
  };

  return (
    <div className="min-h-screen font-mono" style={{ background: "var(--bg)", paddingTop: "40px", paddingBottom: "36px" }}>
      <Header />

      <div className="flex items-center px-4" style={{ height: "44px", background: "var(--panel)", borderBottom: "1px solid rgb(var(--gold-rgb) / 0.3)", fontFamily: "'Space Mono', monospace" }}>
        <span className="text-gold font-bold uppercase tracking-widest" style={{ fontSize: "13px" }}>
          {t(lang, "settings_page.settingsConfigurationCalibrateOptimiseDeploy")}
        </span>
      </div>

      <div className="flex gap-6 px-6 py-4" style={{ minHeight: "calc(100vh - 40px - 36px - 44px)" }}>
        <div style={{ width: "220px", flexShrink: 0 }}>
          <TacticalPanel noPadding>
            <div>
              {TAB_IDS.map((tab) => (
                <SidebarTab key={tab} id={tab} label={TAB_LABELS[tab]} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
              ))}
            </div>
          </TacticalPanel>
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === "GAMEPLAY"      && <GameplayTab />}
          {activeTab === "AUDIO"         && <AudioTab />}
          {activeTab === "DISPLAY"       && <DisplayTab />}
          {activeTab === "CONTROLS"      && <ControlsTab />}
          {activeTab === "NOTIFICATIONS" && <NotificationsTab />}
          {activeTab === "LANGUAGE"      && <LanguageTab />}
          {activeTab === "ABOUT"         && <AboutTab />}
        </div>
      </div>

      <StatusBar
        leftText={t(lang, "settings_page.settingsGameplayActive")}
        rightText={t(lang, "settings_page.navigateSelectEscBack")}
      />
    </div>
  );
}
