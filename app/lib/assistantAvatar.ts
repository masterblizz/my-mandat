// Each campaign PA is a paired identity: the video/headshot and the office
// full-body asset are authored from the very same person.  Keep the pair in
// one record so a location can never accidentally show a different face.
const ASSISTANT_PROFILES = [
  {
    portrait: "/candidate-portraits/v3/v3-001.png",
    standing: "/personal-assistant-01-standing.png",
    gender: "male",
  },
  {
    portrait: "/candidate-portraits/v3/v3-062.png",
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
