"use client";

import { useEffect, useState } from "react";
import { createClient } from "../utils/supabase/client";

export interface PremiumStatus {
  tier: string | null;
  isLoading: boolean;
  hasPremium: boolean;
  hasUltimate: boolean;
}

// Reads profiles.premium_tier/premium_expires_at for the signed-in user.
// A subscription past its premium_expires_at is treated as expired here
// even if the profile row hasn't been updated yet — Stripe's renewal/
// cancellation webhook can lag a little behind the exact expiry instant,
// so this is a client-side belt-and-braces check on top of it, not a
// replacement for the webhook keeping premium_tier itself correct.
export function usePremiumStatus(): PremiumStatus {
  const [tier, setTier] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Do not strand premium controls in a permanent "checking" state when
    // the auth service is unavailable. A late successful response may still
    // update the entitlement after this safe fallback is shown.
    const loadingTimeout = window.setTimeout(() => {
      if (!cancelled) setIsLoading(false);
    }, 8000);

    async function load() {
      try {
        // Some Supabase client versions defer invalid-config failures until
        // the first request, so guard the local/offline deployment explicitly.
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
        const supabase = createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("profiles")
          .select("premium_tier, premium_expires_at")
          .eq("id", user.id)
          .maybeSingle();

        if (!cancelled) {
          setTier(data?.premium_tier ?? null);
          setExpiresAt(data?.premium_expires_at ?? null);
        }
      } catch {
        // Network/auth failures mean no verified entitlement. Fail closed
        // without crashing or leaving the surrounding screen unusable.
        if (!cancelled) {
          setTier(null);
          setExpiresAt(null);
        }
      } finally {
        window.clearTimeout(loadingTimeout);
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimeout);
    };
  }, []);

  const notExpired = expiresAt === null || new Date(expiresAt).getTime() > Date.now();
  const hasPremium = tier !== null && notExpired;
  const hasUltimate = tier === "ultimate" && notExpired;

  return { tier: hasPremium ? tier : null, isLoading, hasPremium, hasUltimate };
}
