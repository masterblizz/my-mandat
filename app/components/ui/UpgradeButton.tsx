"use client";

import { CSSProperties, useState } from "react";
import { useLang, t } from "../../i18n/useLang";

interface UpgradeButtonProps {
  priceId: string;
  mode: "payment" | "subscription";
  label?: string;
  className?: string;
  style?: CSSProperties;
}

// Calls /api/checkout, then hands off to Stripe Checkout via a full
// redirect — no client-side Stripe.js/Elements needed for this flow since
// Checkout is hosted by Stripe.
export default function UpgradeButton({ priceId, mode, label, className, style }: UpgradeButtonProps) {
  const lang = useLang();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, mode }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? t(lang, "Gagal mulakan pembayaran.", "Failed to start checkout."));
      }

      window.location.href = data.url;
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : t(lang, "Ralat tidak dijangka.", "Unexpected error."));
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className ?? "border px-4 py-2 text-[11px] font-black tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-50"}
        style={
          style ?? {
            borderColor: "rgb(var(--gold-rgb) / 0.9)",
            background: "linear-gradient(90deg, #ffb42f, #f7a81f)",
            color: "#05080e",
            boxShadow: "0 0 24px rgb(var(--gold-rgb) / 0.28)",
          }
        }
      >
        {loading ? t(lang, "MEMUATKAN…", "LOADING…") : label ?? t(lang, "BUKA PREMIUM", "UNLOCK PREMIUM")}
      </button>
      {error && (
        <div className="mt-1 text-[10px]" style={{ color: "var(--neon-red)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
