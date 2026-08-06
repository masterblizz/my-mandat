import Stripe from "stripe";

// Server-only Stripe client — must never be imported from a "use client"
// file. Only the checkout and webhook API routes should import this.
// Throws at import time when unconfigured, same fallback-free pattern the
// Supabase browser client already uses (see app/utils/supabase/client.ts) —
// unlike middleware.ts, these routes are only ever hit when a purchase is
// actually attempted, so failing loudly here is correct rather than a
// silent no-op.
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set — Stripe checkout/webhook routes are unavailable until it's configured.");
}

export const stripe = new Stripe(secretKey, {
  apiVersion: "2026-07-29.dahlia",
});
