import type { GameState } from "./gameStore";
import type { CityZone } from "./journey";
import { journal, reduceJourney, shiftSupport } from "./journey";
import { repSide, seatStateId } from "./representative";
import {
  ISSUE_LIFETIME_DAYS, ISSUE_SPAWN_PER_MILLE, MAX_OPEN_ISSUES, PRESENCE_DECAY_PER_DAY, QUARTER_DAYS,
  STAMINA_MAX, STAMINA_REGEN_PER_DAY, TERM_DAYS, WEEK_SLOTS, YB_ISSUES, YB_ISSUE_TYPES,
  ZONE_STAT_LABEL, dewanSitting, getYbActivity, type YbActivityId, type YbIssue, type ZoneStatKey,
} from "../data/ybService";

// The representative's term clock. Time moves in days: stamina recovers,
// presence fades, a fresh set of agenda slots arrives every week, and
// complaints surface (and lapse) in the kawasan. Every 91st day closes the
// quarter through the existing quarter reducer (budget, construction,
// trust), so the city-builder economy and the calendar stay one system.

type Bilingual = { ms: string; en: string };

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

export function clockRunnable(s: Pick<GameState, "journey" | "careerProgress">) {
  return !!repSide(s.journey) && s.careerProgress.month < 60 && s.journey.termDay < TERM_DAYS;
}

function seatZones(s: GameState): CityZone[] {
  return s.journey.cityZones[s.leader.homeConstituencyId] ?? [];
}

function withZone(s: GameState, zoneId: string, stat: ZoneStatKey, delta: number): GameState["journey"]["cityZones"] {
  const seat = s.leader.homeConstituencyId;
  const zones = s.journey.cityZones[seat];
  if (!zones) return s.journey.cityZones;
  return {
    ...s.journey.cityZones,
    [seat]: zones.map((zone) => {
      if (zone.id !== zoneId) return zone;
      const next = { ...zone, [stat]: clamp(zone[stat] + delta) };
      return { ...next, sentiment: Math.round((next.infra + next.welfare + next.economy) / 3) };
    }),
  };
}

function weakestStat(zone: CityZone): ZoneStatKey {
  return (["infra", "welfare", "economy"] as const).reduce((low, key) => (zone[key] < zone[low] ? key : low));
}

/** Older saves (or a quarter advanced from the term dashboard) keep the clock on the quarter grid. */
function alignedTermDay(s: GameState) {
  return Math.max(s.journey.termDay, Math.round((s.careerProgress.month - 1) / 3) * QUARTER_DAYS);
}

/** Advance the term by `days` game days. Stops at the end of the term. */
export function advanceTerm(s: GameState, days: number): Partial<GameState> {
  if (!clockRunnable(s) || days <= 0) return {};
  let state: GameState = { ...s, journey: { ...s.journey, termDay: alignedTermDay(s) } };
  const seat = s.leader.homeConstituencyId;
  for (let step = 0; step < days; step++) {
    const j = state.journey;
    const day = j.termDay + 1;
    if (day > TERM_DAYS) break;
    const service = {
      ...j.service,
      stamina: clamp(j.service.stamina + STAMINA_REGEN_PER_DAY, 0, STAMINA_MAX),
      presence: round1(clamp(j.service.presence - PRESENCE_DECAY_PER_DAY)),
      slots: day % 7 === 0 ? WEEK_SLOTS : j.service.slots,
    };
    let cityZones = j.cityZones;
    let trust = j.trust;
    let entries = j.journal;
    // Complaints nobody answered in time hurt the zone and the YB.
    const lapsed = service.issues.filter((issue) => issue.expires <= day);
    for (const issue of lapsed) {
      const info = YB_ISSUES[issue.type];
      cityZones = withZone({ ...state, journey: { ...j, cityZones } }, issue.zone, info.stat, -4);
      trust = clamp(trust - 1);
      entries = journal({ ...j, journal: entries },
        `Aduan tidak dilayan: ${info.title.ms}. Penduduk kecewa (${ZONE_STAT_LABEL[info.stat].ms} −4, kepercayaan −1).`,
        `Complaint ignored: ${info.title.en}. Residents are let down (${ZONE_STAT_LABEL[info.stat].en} −4, trust −1).`);
    }
    service.issues = service.issues.filter((issue) => issue.expires > day);
    service.missed += lapsed.length;
    // New complaints surface deterministically per seat, term and day.
    const zones = cityZones[seat] ?? [];
    const roll = hash(`${seat}:${state.careerProgress.term}:${day}`);
    if (zones.length && service.issues.length < MAX_OPEN_ISSUES && roll % 1000 < ISSUE_SPAWN_PER_MILLE) {
      const type = YB_ISSUE_TYPES[(roll >>> 10) % YB_ISSUE_TYPES.length];
      const zone = zones[(roll >>> 16) % zones.length];
      const issue: YbIssue = { id: `${state.careerProgress.term}-${day}-${type}`, type, zone: zone.id, day, expires: day + ISSUE_LIFETIME_DAYS };
      service.issues = [...service.issues, issue];
      entries = journal({ ...j, journal: entries },
        `Aduan baharu: ${YB_ISSUES[type].title.ms}. Selesaikan dalam ${ISSUE_LIFETIME_DAYS} hari.`,
        `New complaint: ${YB_ISSUES[type].title.en}. Resolve it within ${ISSUE_LIFETIME_DAYS} days.`);
    }
    state = { ...state, journey: { ...j, termDay: day, service, cityZones, trust, journal: entries } };
    if (day % QUARTER_DAYS === 0) state = { ...state, ...reduceJourney(state, { type: "quarter" }) };
    if (state.careerProgress.month >= 60) break;
  }
  return { journey: state.journey, careerProgress: state.careerProgress, states: state.states };
}

/** Why an agenda activity cannot be done right now, or null if it can. */
export function ybActivityBlocker(s: GameState, id: YbActivityId, zoneId?: string): Bilingual | null {
  const activity = getYbActivity(id);
  if (!activity || !repSide(s.journey)) return { ms: "Hanya untuk YB yang sedang berkhidmat.", en: "Only for a serving YB." };
  if (s.careerProgress.month >= 60) return { ms: "Penggal sudah tamat.", en: "The term is over." };
  const service = s.journey.service;
  if (service.slots < activity.slots) return { ms: "Jadual minggu ini penuh.", en: "This week's schedule is full." };
  if (service.stamina < activity.stamina) return { ms: "Tenaga tidak mencukupi — berehat dahulu.", en: "Not enough stamina — rest first." };
  if (s.resources.funds < activity.cost) return { ms: "Dana pejabat tidak mencukupi.", en: "Not enough office funds." };
  if (activity.sittingOnly && !dewanSitting(alignedTermDay(s))) return { ms: "Dewan tidak bersidang sekarang.", en: "The Dewan is not sitting now." };
  if (activity.zone && !seatZones(s).some((zone) => zone.id === zoneId)) return { ms: "Pilih zon dalam bandar dahulu.", en: "Select a zone in the city first." };
  return null;
}

function resolveIssue(s: GameState, issue: YbIssue) {
  const info = YB_ISSUES[issue.type];
  return {
    cityZones: withZone(s, issue.zone, info.stat, 3),
    issues: s.journey.service.issues.filter((item) => item.id !== issue.id),
    note: { ms: ` Aduan "${info.title.ms}" selesai (${ZONE_STAT_LABEL[info.stat].ms} +3).`, en: ` Complaint "${info.title.en}" resolved (${ZONE_STAT_LABEL[info.stat].en} +3).` },
  };
}

/** Spend agenda slots, stamina and office funds on one activity. */
export function performYbActivity(s: GameState, id: YbActivityId, zoneId?: string): Partial<GameState> {
  if (ybActivityBlocker(s, id, zoneId)) return {};
  const activity = getYbActivity(id)!;
  const j = s.journey;
  const side = repSide(j)!;
  const service = { ...j.service, slots: j.service.slots - activity.slots, stamina: clamp(j.service.stamina - activity.stamina, 0, STAMINA_MAX) };
  let cityZones = j.cityZones;
  let trust = j.trust;
  let organisation = j.organisation;
  let publicBudget = j.publicBudget;
  let funds = s.resources.funds - activity.cost;
  let mediaSentiment = s.mediaSentiment;
  let states = s.states;
  let resolvedNote: Bilingual = { ms: "", en: "" };
  const settle = (issue?: YbIssue) => {
    if (!issue) return;
    const outcome = resolveIssue({ ...s, journey: { ...j, cityZones } }, issue);
    cityZones = outcome.cityZones;
    service.issues = outcome.issues;
    service.resolved += 1;
    service.presence = round1(clamp(service.presence + 3));
    trust = clamp(trust + 1);
    resolvedNote = outcome.note;
  };
  switch (id) {
    case "clinic":
      service.presence = round1(clamp(service.presence + 6));
      trust = clamp(trust + 1);
      settle([...service.issues].sort((a, b) => a.day - b.day)[0]);
      break;
    case "visit": {
      const zone = seatZones(s).find((item) => item.id === zoneId)!;
      service.presence = round1(clamp(service.presence + 5));
      cityZones = withZone({ ...s, journey: { ...j, cityZones } }, zone.id, weakestStat(zone), 2);
      settle(service.issues.find((issue) => issue.zone === zoneId));
      break;
    }
    case "kenduri":
      service.presence = round1(clamp(service.presence + 4));
      organisation = clamp(organisation + 1);
      cityZones = withZone({ ...s, journey: { ...j, cityZones } }, zoneId!, "welfare", 1);
      break;
    case "ceramah": {
      service.presence = round1(clamp(service.presence + 3));
      const seatState = seatStateId(s);
      states = shiftSupport({ ...s, leader: { ...s.leader, homeState: seatState } }, 0.15, true);
      break;
    }
    case "sitting":
      trust = clamp(trust + (side === "opposition" ? 3 : 2));
      if (side === "government") publicBudget += 20_000;
      break;
    case "media":
      service.presence = round1(clamp(service.presence + 3));
      mediaSentiment = "positive";
      if (side === "opposition") trust = clamp(trust + 1);
      break;
    case "fundraise":
      funds += 30_000;
      organisation = clamp(organisation + 1);
      break;
    case "rest":
      service.stamina = clamp(service.stamina + 45, 0, STAMINA_MAX);
      break;
  }
  return {
    states,
    mediaSentiment,
    resources: { ...s.resources, funds },
    journey: {
      ...j, service, cityZones, trust, organisation, publicBudget,
      journal: journal(j, `${activity.title.ms} selesai.${resolvedNote.ms}`, `${activity.title.en} done.${resolvedNote.en}`),
    },
  };
}
