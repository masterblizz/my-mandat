import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "../../utils/stripe";
import { createClient } from "../../utils/supabase/server";

// Polled by /purchase-confirmation right after Stripe redirects back.
// Stripe's own session.payment_status can say "paid" the instant checkout
// completes, but our webhook (which actually grants premium_tier) runs
// asynchronously and can lag a few seconds behind — so "completed" here
// specifically means "the webhook has finished," not just "Stripe took the
// payment," which is what the polling on the confirmation page is for.
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Payments are not configured on this deployment" }, { status: 500 });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  } catch {
    // Unknown/expired/malformed session id — not the caller's business to
    // distinguish "doesn't exist" from "exists but something broke", so a
    // flat not_found covers both without leaking Stripe error internals.
    return NextResponse.json({ status: "not_found" });
  }

  // Never confirm a session that isn't this user's own — return the exact
  // same response as a genuinely unknown session id, so this endpoint can't
  // be used to probe whether some other session id exists or who it
  // belongs to (see /api/checkout — every session we create carries this
  // metadata, so a legitimate session always has it).
  if (session.metadata?.supabase_user_id !== user.id) {
    return NextResponse.json({ status: "not_found" });
  }

  const productName =
    session.line_items?.data[0]?.description ||
    (session.mode === "subscription" ? "Subscription" : "One-time purchase");

  const { data: profile } = await supabase
    .from("profiles")
    .select("premium_tier, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  // One-time purchases: the webhook inserts a `purchases` row the moment it
  // processes checkout.session.completed — that row's presence (not just
  // Stripe's own payment_status) is the "webhook is done" signal.
  //
  // Subscriptions never get a `purchases` row (see the webhook route) —
  // for those, "webhook is done" instead means profiles.premium_tier has
  // been set AND stripe_customer_id matches this session's customer,
  // confirming it was THIS checkout that set it (not a stale premium_tier
  // from some earlier unrelated purchase).
  let completed = false;
  if (session.mode === "payment") {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("status")
      .eq("stripe_session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    completed = purchase?.status === "completed";
  } else if (session.mode === "subscription") {
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    completed = Boolean(profile?.premium_tier) && Boolean(customerId) && profile?.stripe_customer_id === customerId;
  }

  return NextResponse.json({
    status: completed ? "completed" : "pending",
    productName,
    premiumTier: profile?.premium_tier ?? null,
  });
}
