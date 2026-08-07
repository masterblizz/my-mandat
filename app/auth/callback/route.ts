import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../utils/supabase/server";

// Standard Supabase + Next.js App Router OAuth callback: Google redirects
// here with a `code` query param after the user approves the consent
// screen (see the Google button's signInWithOAuth({ redirectTo: ... }) in
// /login), and this exchanges it for a real session cookie before sending
// the user on into the app.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL("/", request.url));
}
