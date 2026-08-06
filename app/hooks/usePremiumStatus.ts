"use client";

import { useEffect, useState } from "react";
import { createClient } from "../utils/supabase/client";

export interface PremiumStatus {
  tier: string | null;
  isLoading: boolean;
  hasPremium: boolean;
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

    async function load() {
      let supabase;
      try {
        supabase = createClient();
      } catch {
        // Supabase isn't configured for this deployment — same
        // local-fallback posture as the rest of the auth system; treat as
        // "no premium" rather than crashing the caller.
        if (!cancelled) setIsLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setTier(null);
          setExpiresAt(null);
          setIsLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("premium_tier, premium_expires_at")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setTier(data?.premium_tier ?? null);
        setExpiresAt(data?.premium_expires_at ?? null);
        setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const notExpired = expiresAt === null || new Date(expiresAt).getTime() > Date.now();
  const hasPremium = tier !== null && notExpired;

  return { tier: hasPremium ? tier : null, isLoading, hasPremium };
}
