// Stripe Price IDs for gated features — filled in via env vars once the
// real products/prices exist in the Stripe Dashboard (see .env.local.example).
// Price IDs aren't secret (they're sent to Stripe.js/Checkout client-side
// anyway), so NEXT_PUBLIC_ is correct here, unlike STRIPE_SECRET_KEY.
// prnMode: one-time purchase example from the brief (mode: "payment").
// premiumMonthly: recurring subscription example (mode: "subscription").
// Ultimate is a separate recurring tier. It includes the normal Premium
// benefits and is required for Scenario Archive access.
export const PREMIUM_PRICE_IDS = {
  prnMode: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRN ?? "",
  premiumMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY ?? "",
  ultimateMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ULTIMATE_MONTHLY ?? "",
};
