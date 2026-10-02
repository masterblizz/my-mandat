// Campaign-scoped PA portraits. Candidate portraits provide a mixed pool of
// faces, while the stored index makes one assistant feel consistent for the
// duration of an individual campaign.
export const ASSISTANT_AVATAR_COUNT = 132;

export function assistantAvatarSrc(index: number | undefined) {
  const safeIndex = Number.isInteger(index) && (index as number) >= 0
    ? (index as number) % ASSISTANT_AVATAR_COUNT
    : 0;
  return `/candidate-portraits/v3/v3-${String(safeIndex + 1).padStart(3, "0")}.png`;
}

export function nextAssistantAvatar(previous?: number) {
  const current = Number.isInteger(previous) ? previous as number : -1;
  let candidate = Math.floor(Math.random() * ASSISTANT_AVATAR_COUNT);
  if (ASSISTANT_AVATAR_COUNT > 1 && candidate === current) {
    candidate = (candidate + 1) % ASSISTANT_AVATAR_COUNT;
  }
  return candidate;
}
