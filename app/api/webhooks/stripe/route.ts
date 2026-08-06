import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "../../../utils/stripe";
import { createServiceClient } from "../../../utils/supabase/service";
import { PREMIUM_PRICE_IDS } from "../../../config/premiumProducts";

// Next.js App Router Route Handlers never auto-parse the request body (that
// bodyParser config only existed for the old Pages Router API routes), so
// no special export is needed to get the raw body — just read it with
// request.text() below instead of request.json(), and don't touch the body
// any other way before constructEvent() has verified it.
export const runtime = "nodejs"; // the Stripe SDK needs Node crypto, not Edge

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

// Maps a Stripe Price ID to the premium_tier label written to profiles.
// Reads the same NEXT_PUBLIC_STRIPE_PRICE_* env vars the client-side
// UpgradeButton call sites use (see app/config/premiumProducts.ts) rather
// than hardcoding the Price IDs a second time here.
const PRICE_TIER_MAP: Record<string, string> = {
  [PREMIUM_PRICE_IDS.prnMode]: "prn",
  [PREMIUM_PRICE_IDS.premiumMonthly]: "premium",
};

function tierForPrice(priceId: string | null | undefined): string {
  if (priceId && PRICE_TIER_MAP[priceId]) return PRICE_TIER_MAP[priceId];
  return "premium";
}

// Subscription events carry the Stripe customer id but metadata is only
// reliably present when the subscription was created through our own
// /api/checkout (see subscription_data.metadata there). Fall back to
// resolving via profiles.stripe_customer_id for cases where it isn't
// (e.g. a subscription edited manually in the Stripe Dashboard).
async function resolveUserId(supabase: SupabaseServiceClient, subscription: Stripe.Subscription): Promise<string | null> {
  if (subscription.metadata?.supabase_user_id) return subscription.metadata.supabase_user_id;

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return data?.id ?? null;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error("Stripe webhook hit without a signature header or STRIPE_WEBHOOK_SECRET configured.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Raw bytes only — constructEvent() re-derives the signature from this
  // exact string. Never trust an unverified payload (e.g. body fields read
  // before this point) for anything security-sensitive like granting
  // premium access.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;

        if (!userId) {
          console.error("checkout.session.completed missing supabase_user_id metadata", session.id);
          break;
        }

        // Persist the Stripe customer id for reuse on the next checkout —
        // see /api/checkout's stripe_customer_id lookup — regardless of mode.
        if (session.customer) {
          await supabase
            .from("profiles")
            .upsert({ id: userId, stripe_customer_id: String(session.customer) }, { onConflict: "id" });
        }

        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        const priceId = lineItems.data[0]?.price?.id ?? null;

        if (session.mode === "payment") {
          // One-time purchase: log it in `purchases` and unlock permanently
          // (premium_expires_at stays null) right here — there is no later
          // subscription event to depend on for a one-time payment.
          const paymentIntentId =
            typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
          const productName = lineItems.data[0]?.description || "One-time purchase";

          await supabase.from("purchases").insert({
            user_id: userId,
            stripe_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId,
            product_name: productName,
            amount: session.amount_total,
            currency: session.currency,
            status: "completed",
          });

          await supabase
            .from("profiles")
            .update({ premium_tier: tierForPrice(priceId), premium_expires_at: null })
            .eq("id", userId);
        } else if (session.mode === "subscription") {
          // Subscription: grant the tier immediately for a snappy unlock —
          // don't make the user wait on a second webhook round-trip that in
          // practice arrives moments later anyway. premium_expires_at is
          // deliberately left alone here; customer.subscription.created
          // (handled right below, and always fired for a brand-new
          // subscription alongside this event) is the single source of
          // truth for the actual expiry date, so it isn't duplicated here.
          await supabase
            .from("profiles")
            .update({ premium_tier: tierForPrice(priceId) })
            .eq("id", userId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(supabase, subscription);

        if (!userId) {
          console.error(`${event.type} could not resolve a Supabase user`, subscription.id);
          break;
        }

        // current_period_end lives on the subscription ITEM, not the
        // subscription itself, since Stripe's "flexible billing" API
        // change (each item can renew on its own cycle) — this API
        // version's Subscription type no longer has a top-level
        // current_period_end at all.
        const item = subscription.items.data[0];
        const priceId = item?.price?.id ?? null;
        const isActive = subscription.status === "active" || subscription.status === "trialing";

        await supabase
          .from("profiles")
          .update({
            premium_tier: isActive ? tierForPrice(priceId) : null,
            premium_expires_at: item ? new Date(item.current_period_end * 1000).toISOString() : null,
          })
          .eq("id", userId);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(supabase, subscription);

        if (!userId) {
          console.error("customer.subscription.deleted could not resolve a Supabase user", subscription.id);
          break;
        }

        await supabase
          .from("profiles")
          .update({ premium_tier: null, premium_expires_at: null })
          .eq("id", userId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // Logged only for now, as requested — wire this into the app's
        // alerts/notification system (see gameStore's `alerts`) if/when
        // failed-payment emails or in-app warnings are needed.
        console.warn("Stripe invoice payment failed", { invoice: invoice.id, customer: invoice.customer });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Error handling Stripe webhook event ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
