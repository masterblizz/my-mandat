// Stripe Price IDs for gated features — filled in via env vars once the
// real products/prices exist in the Stripe Dashboard (see .env.local.example).
// Price IDs aren't secret (they're sent to Stripe.js/Checkout client-side
// anyway), so NEXT_PUBLIC_ is correct here, unlike STRIPE_SECRET_KEY.
// prnMode: one-time purchase example from the brief (mode: "payment").
// premiumMonthly: recurring subscription example (mode: "subscription").
// Both grant the same usePremiumStatus().hasPremium — this app doesn't
// track per-product entitlements, just "has some premium_tier or not" —
// so either purchase unlocks every gated feature below, including
// Nightmare difficulty, which isn't its own separate product.
export const PREMIUM_PRICE_IDS = {
  prnMode: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRN ?? "",
  premiumMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY ?? "",
};
