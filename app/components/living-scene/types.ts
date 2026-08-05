// Shared vocabulary for every LivingScene instance across the game. Keeping
// this in one place means War Room, Election Night, Government, etc. all
// describe their mood with the same finite set of states instead of each
// screen inventing its own ad-hoc "isBad"/"isGood" flags.
export type SceneState =
  | "idle"
  | "briefing"
  | "warning"
  | "crisis"
  | "success"
  | "defeat"
  | "celebration"
  | "negotiation"
  | "election-night"
  | "government"
  | "opposition";

export interface SceneStateMeta {
  color: string;
  labelMS: string;
  labelEN: string;
}

// Colors reference the existing CSS variables from globals.css (--cyan,
// --gold, --warn-orange, --neon-red, --neon-green) so scenes automatically
// follow the dark/light theme switch — never a hardcoded hex here.
export const SCENE_STATE_META: Record<SceneState, SceneStateMeta> = {
  idle: { color: "var(--cyan)", labelMS: "SEDIA", labelEN: "STANDBY" },
  briefing: { color: "var(--cyan)", labelMS: "TAKLIMAT", labelEN: "BRIEFING" },
  warning: { color: "var(--warn-orange)", labelMS: "AMARAN", labelEN: "WARNING" },
  crisis: { color: "var(--neon-red)", labelMS: "KRISIS", labelEN: "CRISIS" },
  success: { color: "var(--neon-green)", labelMS: "BERJAYA", labelEN: "SUCCESS" },
  defeat: { color: "var(--neon-red)", labelMS: "KALAH", labelEN: "DEFEAT" },
  celebration: { color: "var(--gold)", labelMS: "SAMBUTAN", labelEN: "CELEBRATION" },
  negotiation: { color: "var(--gold)", labelMS: "RUNDINGAN", labelEN: "NEGOTIATION" },
  "election-night": { color: "var(--gold)", labelMS: "MALAM KEPUTUSAN", labelEN: "ELECTION NIGHT" },
  government: { color: "var(--cyan)", labelMS: "KERAJAAN", labelEN: "GOVERNMENT" },
  opposition: { color: "var(--warn-orange)", labelMS: "PEMBANGKANG", labelEN: "OPPOSITION" },
};

export interface SceneMotionContextValue {
  /** false when reduced-motion is on, the tab is hidden, or the scene hasn't mounted yet. */
  animate: boolean;
  state: SceneState;
}
