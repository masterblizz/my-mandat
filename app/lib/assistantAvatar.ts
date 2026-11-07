// Each campaign PA is a paired identity: the headshot and the office
// full-body asset are the very same person. The headshots are rendered from
// the 3D office's own cast models (godot/world/cast/pa_*.glb, standing pose;
// see scripts/pa-portrait), so the PA in dialogs is the PA in the office.
// Keep the pair in one record so a location can never show a different face.
const ASSISTANT_PROFILES = [
  {
    portrait: "/assistant/pa-male-3d.png",
    standing: "/personal-assistant-01-standing.png",
    gender: "male",
  },
  {
    portrait: "/assistant/pa-female-3d.png",
    standing: "/personal-assistant-02-standing.png",
    gender: "female",
  },
] as const;

export const ASSISTANT_AVATAR_COUNT = ASSISTANT_PROFILES.length;

export type AssistantGender = "male" | "female";

function assistantProfile(index: number | undefined) {
  const safeIndex = Number.isInteger(index) && (index as number) >= 0
    ? (index as number) % ASSISTANT_AVATAR_COUNT
    : 0;
  return ASSISTANT_PROFILES[safeIndex];
}

export function assistantAvatarSrc(index: number | undefined) {
  return assistantProfile(index).portrait;
}

export function assistantGender(index: number | undefined): AssistantGender {
  return assistantProfile(index).gender;
}

export function assistantStandingSrc(index: number | undefined) {
  return assistantProfile(index).standing;
}

export function nextAssistantAvatar(previous?: number) {
  const current = Number.isInteger(previous) ? previous as number : -1;
  let candidate = Math.floor(Math.random() * ASSISTANT_AVATAR_COUNT);
  if (ASSISTANT_AVATAR_COUNT > 1 && candidate === current) {
    candidate = (candidate + 1) % ASSISTANT_AVATAR_COUNT;
  }
  return candidate;
}
