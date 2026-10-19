import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isValidMalaysiaConstituency, normaliseSlug, validateCharacterInput, validateNominationInput, validatePartyInput, validateWorldInput } from "../app/lib/onlineWorlds";

assert.equal(isValidMalaysiaConstituency("johor-0"), true);
assert.equal(isValidMalaysiaConstituency("johor-26"), false);
assert.equal(isValidMalaysiaConstituency("not-a-seat"), false);
assert.equal(normaliseSlug("  Malaysia: New Dawn! "), "malaysia-new-dawn");
assert.equal("error" in validateWorldInput({ name: "World", slug: "world", description: "", visibility: "public" }), false);
assert.equal("error" in validateWorldInput({ name: "x", visibility: "public" }), true);
// The create form sends an empty slug when the field is left blank.
assert.deepEqual(validateWorldInput({ name: "Dunia Baru", slug: "  ", description: "", visibility: "public" }), { name: "Dunia Baru", slug: "dunia-baru", description: "", visibility: "public" });
assert.equal("error" in validateCharacterInput({ name: "Alya Rahman", avatarRef: "player-standing-01.png", biography: "", homeConstituencyId: "johor-0" }), false);
assert.equal("error" in validateCharacterInput({ name: "A", avatarRef: "bad.png", biography: "", homeConstituencyId: "johor-26" }), true);
assert.equal("error" in validatePartyInput({ name: "Parti Masa Depan", abbreviation: "pmd", colour: "#00d4ff" }), false);
assert.equal("error" in validatePartyInput({ name: "x", abbreviation: "too-long-9", colour: "blue" }), true);
assert.equal("error" in validateNominationInput({ partyId: "00000000-0000-4000-8000-000000000001", characterId: "00000000-0000-4000-8000-000000000002", constituencyId: "johor-0" }), false);
assert.equal("error" in validateNominationInput({ partyId: "bad", characterId: "bad", constituencyId: "not-a-seat" }), true);
const onlineCitySource = readFileSync(resolve(process.cwd(), "app/online/components/OnlineWorldCity.tsx"), "utf8");
assert.equal(/gameStore|saveGame|store\/journey|StoreHydrator/.test(onlineCitySource), false, "online city must not import solo gameplay or persistence");
console.log("online world validation tests passed");
