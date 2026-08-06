import Stripe from "stripe";

// Server-only Stripe client — must never be imported from a "use client"
// file. Only the checkout and webhook API routes should call this.
//
// Deliberately a lazy factory, NOT a module-scope `export const stripe =
// new Stripe(...)`: Next.js's build step imports every API route module to
// collect its metadata (runtime, dynamic/static, etc.) even though the
// route itself only ever executes at request time. A top-level throw here
// fired during that import step too, which crashed `next build` on Vercel
// whenever STRIPE_SECRET_KEY wasn't set yet — not just requests to the
// route, the entire deployment. Deferring the check into a function called
// from inside each route handler (see app/utils/supabase/client.ts's
// createClient() for the same pattern already used for Supabase) means the
// throw only ever happens if/when a route handler actually runs.
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set — Stripe checkout/webhook routes are unavailable until it's configured.");
  }

  cached = new Stripe(secretKey, { apiVersion: "2026-07-29.dahlia" });
  return cached;
}
