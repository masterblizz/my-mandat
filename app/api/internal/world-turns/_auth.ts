import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Scheduler auth. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`;
 * other trusted schedulers may use WORLD_TURN_CRON_SECRET. Either is accepted.
 */
export function isAuthorizedScheduler(request: NextRequest) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!supplied) return false;
  return [process.env.WORLD_TURN_CRON_SECRET, process.env.CRON_SECRET].some((expected) => {
    if (!expected) return false;
    const a = Buffer.from(supplied); const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
