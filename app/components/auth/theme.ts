// Shared palette for /login and /register chrome (TacticalAuthShell,
// AuthBackground). Its own module — not exported from TacticalAuthShell.tsx
// itself — so AuthBackground can import it without a circular dependency
// (TacticalAuthShell renders <AuthBackground />, so the reverse import
// would eval AuthBackground's top-level color usage before
// TacticalAuthShell finishes initializing its own exports).
// Values are CSS var() references (see [data-theme] rules in globals.css),
// not raw hex, so every consumer of these constants automatically follows
// the dark/light theme toggle without needing its own hook subscription —
// the browser resolves the var against whatever data-theme is set on <html>.
export const BG = "var(--auth-bg)";
export const PANEL = "var(--auth-panel)";
export const BORDER = "var(--auth-border)";
export const INPUT_BG = "var(--auth-input-bg)";
export const TEXT = "var(--auth-text)";
export const TEXT_DIM = "var(--auth-text-dim)";
export const TEXT_FAINT = "var(--auth-text-faint)";
export const CYAN = "rgb(var(--auth-cyan-rgb))";
export const GOLD = "rgb(var(--auth-gold-rgb))";
export const RED = "rgb(var(--auth-red-rgb))";
export const GREEN = "rgb(var(--auth-green-rgb))";
export const ERROR_TEXT = "var(--auth-error-text)";
