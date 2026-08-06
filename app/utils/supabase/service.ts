import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client — full DB access, bypasses Row Level
// Security entirely. NEVER import this from a "use client" file or
// anything that ships to the browser; only from server-only contexts with
// no user session to act as, i.e. the Stripe webhook route. The anon-key
// clients in ./client.ts and ./server.ts remain correct everywhere else,
// including /api/checkout, which does have a real user session.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service-role client is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
