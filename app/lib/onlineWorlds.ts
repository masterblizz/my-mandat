import { generateConstituencies } from "../data/constituencies";
import { states } from "../data/states";

export const ONLINE_AVATARS = [
  "player-standing-01.png", "player-standing-02.png", "player-standing-03.png", "player-standing-04.png", "player-standing-05.png",
] as const;
export const MAX_WORLD_NAME_LENGTH = 60;
export const MAX_CHARACTER_NAME_LENGTH = 32;

export type OnlineWorld = {
  id: string; name: string; slug: string; description: string; geography_template: "malaysia-v1";
  visibility: "public" | "private"; lifecycle_status: "open" | "locked" | "archived"; capacity: number; character_slot_limit: number;
  creator_id?: string; created_at?: string; member_count?: number;
};
export type OnlineCharacter = { id: string; world_id: string; name: string; avatar_ref: string; biography: string; home_constituency_id: string; lifecycle_status: "active" | "retired"; created_at: string };

const malaysiaSeats = states.flatMap((state) => generateConstituencies(state).map((seat) => ({ id: seat.id, name: seat.name, state: state.name, code: seat.code })));
export const MALAYSIA_HOME_CONSTITUENCIES = malaysiaSeats;

export function isValidMalaysiaConstituency(id: string) {
  return malaysiaSeats.some((seat) => seat.id === id);
}

export function normaliseSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function validateCharacterInput(input: unknown): { name: string; avatarRef: string; biography: string; homeConstituencyId: string } | { error: string } {
  if (!input || typeof input !== "object") return { error: "Invalid character request." };
  const value = input as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const avatarRef = typeof value.avatarRef === "string" ? value.avatarRef : "";
  const biography = typeof value.biography === "string" ? value.biography.trim() : "";
  const homeConstituencyId = typeof value.homeConstituencyId === "string" ? value.homeConstituencyId : "";
  if (!/^[A-Za-z0-9 .'\-]{3,32}$/.test(name)) return { error: "Character names must be 3–32 letters, numbers, spaces, apostrophes, periods, or hyphens." };
  if (!(ONLINE_AVATARS as readonly string[]).includes(avatarRef)) return { error: "Choose an available avatar." };
  if (biography.length > 280) return { error: "Biography must be 280 characters or fewer." };
  if (!isValidMalaysiaConstituency(homeConstituencyId)) return { error: "Choose a valid Malaysian parliamentary constituency." };
  return { name, avatarRef, biography, homeConstituencyId };
}

export function validateWorldInput(input: unknown): { name: string; slug: string; description: string; visibility: "public" | "private" } | { error: string } {
  if (!input || typeof input !== "object") return { error: "Invalid world request." };
  const value = input as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const slug = normaliseSlug(typeof value.slug === "string" && value.slug.trim() ? value.slug : name);
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const visibility = value.visibility === "private" ? "private" : value.visibility === "public" ? "public" : null;
  if (name.length < 3 || name.length > MAX_WORLD_NAME_LENGTH) return { error: "World name must be 3–60 characters." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return { error: "World slug may contain lowercase letters, numbers, and single hyphens." };
  if (description.length > 500) return { error: "Description must be 500 characters or fewer." };
  if (!visibility) return { error: "Choose public or private visibility." };
  return { name, slug, description, visibility };
}

export function validatePartyInput(input: unknown): { name: string; abbreviation: string; colour: string } | { error: string } {
  if (!input || typeof input !== "object") return { error: "Invalid party request." };
  const value = input as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim().replace(/\s+/g, " ") : "";
  const abbreviation = typeof value.abbreviation === "string" ? value.abbreviation.trim().toUpperCase() : "";
  const colour = typeof value.colour === "string" ? value.colour.trim() : "";
  if (name.length < 3 || name.length > 60) return { error: "Party names must be 3–60 characters." };
  if (!/^[A-Z0-9]{2,8}$/.test(abbreviation)) return { error: "Party abbreviations must be 2–8 capital letters or numbers." };
  if (!/^#[0-9A-Fa-f]{6}$/.test(colour)) return { error: "Choose a six-digit hex party colour." };
  return { name, abbreviation, colour };
}

export function validateNominationInput(input: unknown): { partyId: string; characterId: string; constituencyId: string } | { error: string } {
  if (!input || typeof input !== "object") return { error: "Invalid nomination request." };
  const value = input as Record<string, unknown>;
  const partyId = typeof value.partyId === "string" ? value.partyId : "";
  const characterId = typeof value.characterId === "string" ? value.characterId : "";
  const constituencyId = typeof value.constituencyId === "string" ? value.constituencyId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(partyId) || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(characterId)) return { error: "Choose a valid party and character." };
  if (!isValidMalaysiaConstituency(constituencyId)) return { error: "Choose a valid Malaysian parliamentary constituency." };
  return { partyId, characterId, constituencyId };
}
