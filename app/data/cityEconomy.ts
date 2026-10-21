import type { CityZone, Journey } from "../store/journey";

// Quarterly treasury for the player's own kawasan while in government.
// Single source of truth for both the quarter reducer (journey.ts) and the
// city HUD forecast (/kawasan), so the number the player is shown is the
// number the quarter actually books. All figures are simulated.
export const CITY_BASE_GRANT = 100_000;
/** Local tax take per point of average zone economy. */
export const CITY_TAX_PER_ECONOMY_POINT = 1_200;
/** Running cost of every completed public facility, per quarter. */
export const CITY_PROJECT_UPKEEP = 4_000;
/** Home-state support gained for each facility delivered in a quarter. */
export const CITY_SUPPORT_PER_PROJECT = 0.3;
/** Average sentiment below this draws resident complaints (trust penalty). */
export const CITY_COMPLAINT_SENTIMENT = 40;
export const CITY_COMPLAINT_TRUST = 2;

export interface CityLedger {
  grant: number;
  tax: number;
  upkeep: number;
  net: number;
  built: number;
  avgEconomy: number;
  avgSentiment: number;
}

export function cityLedger(zones: Pick<CityZone, "economy" | "sentiment" | "projects">[], grant = CITY_BASE_GRANT): CityLedger {
  const count = zones.length;
  const avgEconomy = count ? Math.round(zones.reduce((sum, zone) => sum + zone.economy, 0) / count) : 0;
  const avgSentiment = count ? Math.round(zones.reduce((sum, zone) => sum + zone.sentiment, 0) / count) : 0;
  const built = zones.reduce((sum, zone) => sum + zone.projects.length, 0);
  const tax = Math.round((avgEconomy * CITY_TAX_PER_ECONOMY_POINT) / 1000) * 1000;
  const upkeep = built * CITY_PROJECT_UPKEEP;
  return { grant, tax, upkeep, net: grant + tax - upkeep, built, avgEconomy, avgSentiment };
}

export function cityLedgerForSeats(cityZones: Record<string, CityZone[]>, grant?: number): CityLedger {
  return cityLedger(Object.values(cityZones).flat(), grant);
}

type ConstructionWork = Journey["construction"][number];

/**
 * Applies the works finishing this quarter (remaining === 1) to one seat's
 * zones: stat boost, facility added, sentiment recomputed. Used by the
 * quarter reducer and by the city HUD's next-quarter forecast.
 */
export function applyCompletedWorks<Z extends CityZone>(zones: Z[], works: ConstructionWork[], seat: string): Z[] {
  const finishing = works.filter((work) => work.seat === seat && work.remaining === 1);
  return zones.map((zone) => {
    let next = { ...zone, projects: [...zone.projects] };
    for (const work of finishing.filter((w) => w.zone === zone.id)) {
      next = { ...next, [work.target]: Math.min(100, next[work.target] + work.boost), projects: [...next.projects, work.project] };
    }
    next.sentiment = Math.round((next.infra + next.welfare + next.economy) / 3);
    return next;
  });
}
