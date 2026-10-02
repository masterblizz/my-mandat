// Campaign-scoped PA portraits. Candidate portraits provide a mixed pool of
// faces, while the stored index makes one assistant feel consistent for the
// duration of an individual campaign.
export const ASSISTANT_AVATAR_COUNT = 132;
// Portrait v3 is authored as two contiguous casts: the first 61 are male
// advisers and the remaining portraits are female advisers. Keep this
// mapping in one place so every in-world presentation matches the campaign.
const FEMALE_ASSISTANT_START = 61;

export type AssistantGender = "male" | "female";

export function assistantAvatarSrc(index: number | undefined) {
  const safeIndex = Number.isInteger(index) && (index as number) >= 0
    ? (index as number) % ASSISTANT_AVATAR_COUNT
    : 0;
  return `/candidate-portraits/v3/v3-${String(safeIndex + 1).padStart(3, "0")}.png`;
}

export function assistantGender(index: number | undefined): AssistantGender {
  const safeIndex = Number.isInteger(index) && (index as number) >= 0
    ? (index as number) % ASSISTANT_AVATAR_COUNT
    : 0;
  return safeIndex < FEMALE_ASSISTANT_START ? "male" : "female";
}

export function assistantStandingSrc(index: number | undefined) {
  return assistantGender(index) === "male"
    ? "/personal-assistant-standing-male.png"
    : "/personal-assistant-standing.png";
}

export function nextAssistantAvatar(previous?: number) {
  const current = Number.isInteger(previous) ? previous as number : -1;
  let candidate = Math.floor(Math.random() * ASSISTANT_AVATAR_COUNT);
  if (ASSISTANT_AVATAR_COUNT > 1 && candidate === current) {
    candidate = (candidate + 1) % ASSISTANT_AVATAR_COUNT;
  }
  return candidate;
}
