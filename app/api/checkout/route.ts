import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "../../utils/stripe";
import { createClient } from "../../utils/supabase/server";

interface CheckoutRequestBody {
  priceId?: string;
  mode?: "payment" | "subscription";
  // Where to send the user back if they abandon Stripe Checkout — the page
  // they clicked "Unlock" from (e.g. /setup), not a fixed page, so
  // cancelling doesn't strand them somewhere unrelated. Optional; defaults
  // to /settings below.
  cancelPath?: string;
}

// Only ever used as `${origin}${cancelPath}` (origin is fixed server-side,
// see below) — but guard against a caller passing a protocol-relative path
// ("//evil.com/x") or anything not starting with a single "/", so this
// can't be turned into an open redirect off this app's own domain.
function sanitizeCancelPath(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/settings";
  return path;
}

export async function POST(request: NextRequest) {
  let body: CheckoutRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { priceId, mode, cancelPath } = body;
  if (!priceId || (mode !== "payment" && mode !== "subscription")) {
    return NextResponse.json(
      { error: "priceId and a valid mode ('payment' or 'subscription') are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Reuse the existing Stripe customer if this user already has one, so a
  // repeat purchase doesn't create a duplicate customer record in Stripe.
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Payments are not configured on this deployment" }, { status: 500 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      customer: profile?.stripe_customer_id ?? undefined,
      // Only set customer_email when there's no existing Stripe customer —
      // passing both customer and customer_email is a Stripe API error.
      customer_email: profile?.stripe_customer_id ? undefined : (user.email ?? undefined),
      // Stripe replaces {CHECKOUT_SESSION_ID} with the real session id —
      // /purchase-confirmation polls /api/purchase-status with it to find
      // out whether the webhook has finished granting premium yet.
      success_url: `${origin}/purchase-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${sanitizeCancelPath(cancelPath)}?purchase=cancelled`,
      // This is how the webhook later identifies which Supabase user paid —
      // never rely on email matching, see the webhook route's comments.
      metadata: { supabase_user_id: user.id },
      subscription_data:
        mode === "subscription" ? { metadata: { supabase_user_id: user.id } } : undefined,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout session creation failed:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
