"use client";

import { useState } from "react";
import { createClient } from "@/app/utils/supabase/client";
import AuthShell from "../components/auth/AuthShell";
import { useLang, t } from "../i18n/useLang";

export default function ForgotPasswordPage() {
  const lang = useLang();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let supabase;
    try {
      supabase = createClient();
    } catch {
      setLoading(false);
      setError(t(lang, "Set semula kata laluan belum dikonfigurasi untuk deployment ini.", "Password reset isn't configured for this deployment yet."));
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell
        title={t(lang, "SEMAK EMEL ANDA", "CHECK YOUR EMAIL")}
        subtitle={t(lang, "Pautan set semula kata laluan telah dihantar.", "A password reset link is on its way.")}
      >
        <div className="space-y-4 text-center">
          <p className="text-[12px] leading-6" style={{ color: "#d7e7f5" }}>
            {t(
              lang,
              `Jika ${email} berdaftar, pautan set semula kata laluan telah dihantar. Sahkan emel anda untuk teruskan.`,
              `If ${email} is registered, a password reset link has been sent. Check your inbox to continue.`
            )}
          </p>
          <a
            href="/login"
            className="inline-block w-full border py-2.5 text-[12px] font-black tracking-[0.24em]"
            style={{
              borderColor: "rgb(var(--gold-rgb) / 0.9)",
              background: "linear-gradient(90deg, #ffb42f, #f7a81f)",
              color: "#05080e",
              boxShadow: "0 0 24px rgb(var(--gold-rgb) / 0.28)",
            }}
          >
            {t(lang, "KE LOG MASUK »", "GO TO LOGIN »")}
          </a>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t(lang, "SET SEMULA KATA LALUAN", "RESET PASSWORD")}
      subtitle={t(lang, "Masukkan emel untuk terima pautan set semula.", "Enter your email to receive a reset link.")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p
            className="border px-3 py-2 text-[11px] leading-5"
            style={{ borderColor: "rgb(var(--neon-red-rgb) / 0.4)", background: "rgb(var(--neon-red-rgb) / 0.08)", color: "var(--neon-red)" }}
          >
            {error}
          </p>
        )}

        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
            {t(lang, "EMEL", "EMAIL")}
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full border py-2.5 text-[12px] font-black tracking-[0.24em] transition-all disabled:opacity-50"
          style={{
            borderColor: "rgb(var(--gold-rgb) / 0.9)",
            background: "linear-gradient(90deg, #ffb42f, #f7a81f)",
            color: "#05080e",
            boxShadow: "0 0 24px rgb(var(--gold-rgb) / 0.28)",
          }}
        >
          {loading ? t(lang, "MENGHANTAR…", "SENDING…") : t(lang, "HANTAR PAUTAN »", "SEND LINK »")}
        </button>

        <p className="pt-1 text-center text-[10px] tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
          <a href="/login" className="font-bold" style={{ color: "var(--cyan)" }}>
            {t(lang, "Kembali ke log masuk", "Back to login")}
          </a>
        </p>
      </form>
    </AuthShell>
  );
}
