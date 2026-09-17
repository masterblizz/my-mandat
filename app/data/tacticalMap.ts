import type { Constituency } from "./constituencies";
import type { StateData } from "./states";
import type { Operation } from "../store/gameStore";

export type TacticalOverlay = "default" | "marginal" | "opponent" | "swing" | "reach" | "sentiment";

export interface TacticalVisual {
  active: boolean;
  intensity: number;
  color: string;
  fill: string;
  label: { ms: string; en: string };
  detail: { ms: string; en: string };
}

const inactive: TacticalVisual = {
  active: false,
  intensity: 0,
  color: "rgba(148,163,184,0.25)",
  fill: "rgba(15,23,42,0.42)",
  label: { ms: "Tiada isyarat", en: "No signal" },
  detail: { ms: "Di luar penapis aktif", en: "Outside the active filter" },
};

const visual = (active: boolean, intensity: number, color: string, fill: string, ms: string, en: string, detailMS: string, detailEN: string): TacticalVisual => active
  ? { active, intensity: Math.max(0, Math.min(1, intensity)), color, fill, label: { ms, en }, detail: { ms: detailMS, en: detailEN } }
  : inactive;

export function operationsInState(operations: Operation[], stateId: string) {
  return operations.filter(operation => operation.stateIds.includes(stateId) && (operation.status === "active" || operation.status === "ongoing"));
}

export function stateTacticalVisual(
  state: StateData,
  overlay: TacticalOverlay,
  operations: Operation[] = [],
  mediaSentiment: "positive" | "neutral" | "negative" = "neutral",
): TacticalVisual {
  const margin = Math.abs(state.mandatSupport - state.lawanSupport);
  const stateOperations = operationsInState(operations, state.id);
  if (overlay === "marginal") return visual(margin <= 8, 1 - margin / 9, "#ffd166", "rgba(255,209,102,0.24)", "Negeri marginal", "Marginal state", `Jurang MANDAT–LAWAN ${margin.toFixed(1)} mata`, `MANDAT–LAWAN gap ${margin.toFixed(1)} points`);
  if (overlay === "opponent") {
    const lead = state.lawanSupport - state.mandatSupport;
    return visual(lead >= 4, Math.min(1, lead / 24), "#ff4d5e", "rgba(255,77,94,0.24)", "Kubu LAWAN", "LAWAN stronghold", `LAWAN mendahului ${Math.max(0, lead).toFixed(1)} mata`, `LAWAN leads by ${Math.max(0, lead).toFixed(1)} points`);
  }
  if (overlay === "swing") return visual(state.swingProbability >= 18 || state.status === "contested", Math.min(1, state.swingProbability / 35), "#ff9f43", "rgba(255,159,67,0.24)", "Hotspot ayunan", "Swing hotspot", `Kebarangkalian ayunan ${state.swingProbability}%`, `Swing probability ${state.swingProbability}%`);
  if (overlay === "reach") {
    const field = stateOperations.filter(operation => ["ceramah", "door-to-door", "rural"].includes(operation.type)).length;
    const digital = stateOperations.filter(operation => ["digital", "youth"].includes(operation.type)).length;
    const strength = field * 1.2 + digital;
    return visual(strength > 0, Math.min(1, strength / 3), "#35d9ff", "rgba(53,217,255,0.22)", "Capaian kempen", "Campaign reach", `${field} operasi lapangan · ${digital} digital`, `${field} field operations · ${digital} digital`);
  }
  if (overlay === "sentiment") {
    const digital = stateOperations.filter(operation => ["digital", "youth"].includes(operation.type)).length;
    const media = mediaSentiment === "positive" ? .8 : mediaSentiment === "negative" ? -.8 : 0;
    const score = state.trend + digital * .35 + media;
    const positive = score > .35;
    const negative = score < -.35;
    return visual(true, Math.min(1, Math.abs(score) / 4 + .25), positive ? "#00e5a8" : negative ? "#ff4d5e" : "#ffd166", positive ? "rgba(0,229,168,0.22)" : negative ? "rgba(255,77,94,0.22)" : "rgba(255,209,102,0.2)", positive ? "Sentimen positif" : negative ? "Sentimen negatif" : "Sentimen mendatar", positive ? "Positive sentiment" : negative ? "Negative sentiment" : "Flat sentiment", `Indeks sentimen ${score >= 0 ? "+" : ""}${score.toFixed(1)}`, `Sentiment index ${score >= 0 ? "+" : ""}${score.toFixed(1)}`);
  }
  const status = state.status === "winning" ? ["Mendahului", "Leading"] : state.status === "losing" ? ["Ketinggalan", "Trailing"] : ["Bertanding", "Contested"];
  const color = state.status === "winning" ? "#22d3ee" : state.status === "losing" ? "#ff4d5e" : "#ffd166";
  const fill = state.status === "winning" ? "rgba(34,211,238,0.18)" : state.status === "losing" ? "rgba(255,77,94,0.18)" : "rgba(255,209,102,0.18)";
  return visual(true, .7, color, fill, status[0], status[1], `Sokongan MANDAT ${state.mandatSupport}%`, `MANDAT support ${state.mandatSupport}%`);
}

export function seatTacticalVisual(
  seat: Constituency,
  state: StateData,
  overlay: TacticalOverlay,
  operations: Operation[] = [],
  mediaSentiment: "positive" | "neutral" | "negative" = "neutral",
): TacticalVisual {
  const closestOpponent = Math.max(seat.lawan, seat.others);
  const margin = Math.abs(seat.mandat - closestOpponent);
  const stateOperations = operationsInState(operations, state.id);
  if (overlay === "marginal") return visual(margin <= 6, 1 - margin / 7, "#ffd166", "rgba(255,209,102,0.32)", "Kerusi marginal", "Marginal seat", `Jurang ${margin.toFixed(1)} mata`, `${margin.toFixed(1)}-point gap`);
  if (overlay === "opponent") {
    const lead = seat.lawan - seat.mandat;
    return visual(seat.winner === "lawan" && lead >= 8, Math.min(1, lead / 25), "#ff4d5e", "rgba(255,77,94,0.32)", "Kubu LAWAN", "LAWAN stronghold", `LAWAN +${Math.max(0, lead).toFixed(1)}`, `LAWAN +${Math.max(0, lead).toFixed(1)}`);
  }
  if (overlay === "swing") return visual(margin <= 11, 1 - margin / 12, "#ff9f43", "rgba(255,159,67,0.32)", "Hotspot ayunan", "Swing hotspot", `Jurang boleh diubah: ${margin.toFixed(1)} mata`, `Movable gap: ${margin.toFixed(1)} points`);
  if (overlay === "reach") {
    const field = stateOperations.filter(operation => ["ceramah", "door-to-door", "rural"].includes(operation.type)).length;
    const digital = stateOperations.filter(operation => ["digital", "youth"].includes(operation.type)).length;
    return visual(field + digital > 0, Math.min(1, (field * 1.2 + digital) / 3), "#35d9ff", "rgba(53,217,255,0.28)", "Dalam capaian", "Within reach", `${field} lapangan · ${digital} digital`, `${field} field · ${digital} digital`);
  }
  if (overlay === "sentiment") {
    const media = mediaSentiment === "positive" ? 2 : mediaSentiment === "negative" ? -2 : 0;
    const digital = stateOperations.filter(operation => ["digital", "youth"].includes(operation.type)).length;
    const score = seat.mandat - closestOpponent + state.trend + digital + media;
    const positive = score > 2;
    const negative = score < -2;
    return visual(true, Math.min(1, Math.abs(score) / 18 + .2), positive ? "#00e5a8" : negative ? "#ff4d5e" : "#ffd166", positive ? "rgba(0,229,168,0.32)" : negative ? "rgba(255,77,94,0.32)" : "rgba(255,209,102,0.28)", positive ? "Sentimen positif" : negative ? "Sentimen negatif" : "Sentimen bercampur", positive ? "Positive sentiment" : negative ? "Negative sentiment" : "Mixed sentiment", `Indeks ${score >= 0 ? "+" : ""}${score.toFixed(1)}`, `Index ${score >= 0 ? "+" : ""}${score.toFixed(1)}`);
  }
  const color = seat.safety === "safe" ? "#22d3ee" : seat.safety === "marginal" ? "#ffd166" : "#ff4d5e";
  const fill = seat.safety === "safe" ? "rgba(34,211,238,0.3)" : seat.safety === "marginal" ? "rgba(255,209,102,0.3)" : "rgba(255,77,94,0.3)";
  return visual(true, .7, color, fill, seat.safety === "safe" ? "Selamat" : seat.safety === "marginal" ? "Bertanding" : "Bahaya", seat.safety === "safe" ? "Safe" : seat.safety === "marginal" ? "Contested" : "Danger", `MANDAT ${seat.mandat}%`, `MANDAT ${seat.mandat}%`);
}
