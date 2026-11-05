// The player's leader avatar: the full-body figure picked in setup, the
// head-and-shoulders portrait cut from that same image, and the matching
// 3D body. One record per avatar so the portrait, the standing figure and
// the 3D character can never disagree (a woman stays a woman everywhere).
const PLAYER_AVATARS = [
  { standing: "/avatars/player-standing-01.png", portrait: "/avatars/player-portrait-01.jpg", gender: "female" },
  { standing: "/avatars/player-standing-02.png", portrait: "/avatars/player-portrait-02.jpg", gender: "male" },
  { standing: "/avatars/player-standing-03.png", portrait: "/avatars/player-portrait-03.jpg", gender: "female" },
  { standing: "/avatars/player-standing-04.png", portrait: "/avatars/player-portrait-04.jpg", gender: "male" },
  { standing: "/avatars/player-standing-05.png", portrait: "/avatars/player-portrait-05.jpg", gender: "female" },
] as const;

export const PLAYER_AVATAR_COUNT = PLAYER_AVATARS.length;
export type PlayerGender = "male" | "female";

function profile(index: number | undefined) {
  const i = Number.isInteger(index) && (index as number) >= 0 ? (index as number) % PLAYER_AVATAR_COUNT : 0;
  return PLAYER_AVATARS[i];
}

export const playerStandingSrc = (index: number | undefined) => profile(index).standing;
export const playerPortraitSrc = (index: number | undefined) => profile(index).portrait;
export const playerGender = (index: number | undefined): PlayerGender => profile(index).gender;
/** The Godot body for the player's avatar. */
export const playerModel = (index: number | undefined): "pa_female" | "pa_male" => (playerGender(index) === "female" ? "pa_female" : "pa_male");
