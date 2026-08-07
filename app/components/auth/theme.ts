// Shared palette for /login and /register chrome (TacticalAuthShell,
// AuthBackground). Its own module — not exported from TacticalAuthShell.tsx
// itself — so AuthBackground can import it without a circular dependency
// (TacticalAuthShell renders <AuthBackground />, so the reverse import
// would eval AuthBackground's top-level color usage before
// TacticalAuthShell finishes initializing its own exports).
export const BG = "#04060c";
export const PANEL = "rgba(10,15,24,0.9)";
export const BORDER = "#263042";
export const INPUT_BG = "#0d1320";
export const TEXT = "#e5e9f0";
export const TEXT_DIM = "#8b95a5";
export const TEXT_FAINT = "#5b6576";
export const CYAN = "#55dcff";
export const GOLD = "#ffb22c";
export const RED = "#c11f2c";
export const GREEN = "#22c55e";
