import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../utils/supabase/service";

// supabase.auth.signInWithPassword() only ever accepts an email (or
// phone) — there is no "sign in by username" on the client SDK. /login
// lets the player type either, so this route resolves a typed username to
// its account's real email server-side (profiles.username is readable by
// RLS only for your OWN row — see the profiles migration — so the client
// can never look this up itself) before the browser calls
// signInWithPassword with the resolved email.
export async function POST(request: NextRequest) {
  let body: { identifier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const identifier = body.identifier?.trim();
  if (!identifier) {
    return NextResponse.json({ error: "identifier is required" }, { status: 400 });
  }

  // Already an email — nothing to resolve.
  if (identifier.includes("@")) {
    return NextResponse.json({ email: identifier });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Login isn't configured for this deployment" }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", identifier)
    .maybeSingle();

  // Same "email: null" shape whether the username doesn't exist or
  // something else went wrong resolving it — /login turns this into the
  // same generic "invalid credentials" message signInWithPassword itself
  // would give for a wrong password, so this endpoint can't be used to
  // enumerate which usernames are registered.
  if (!profile) {
    return NextResponse.json({ email: null });
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.id);
  if (userError || !userData.user?.email) {
    return NextResponse.json({ email: null });
  }

  return NextResponse.json({ email: userData.user.email });
}
