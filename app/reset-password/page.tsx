"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import AuthShell from "../components/auth/AuthShell";
import { useLang, t } from "../i18n/useLang";

export default function ResetPasswordPage() {
  const router = useRouter();
  const lang = useLang();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // The reset link's recovery token lives in the URL fragment, so
  // supabase-js needs a tick after mount to parse it and open a session
  // before updateUser() has anything to act on — show a brief "checking
  // link" state instead of rendering the form before that's ready.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let supabase;
    try {
      supabase = createClient();
    } catch {
      setError(t(lang, "Set semula kata laluan belum dikonfigurasi untuk deployment ini.", "Password reset isn't configured for this deployment yet."));
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError(t(lang, "Pautan set semula tidak sah atau telah tamat tempoh. Minta pautan baharu.", "This reset link is invalid or has expired. Request a new one."));
      }
      setReady(true);
    });
  }, [lang]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t(lang, "Kata laluan tidak sepadan.", "Passwords don't match."));
      return;
    }

    setLoading(true);

    let supabase;
    try {
      supabase = createClient();
    } catch {
      setLoading(false);
      setError(t(lang, "Set semula kata laluan belum dikonfigurasi untuk deployment ini.", "Password reset isn't configured for this deployment yet."));
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
    setTimeout(() => {
      router.push("/login");
    }, 2000);
  };

  if (done) {
    return (
      <AuthShell
        title={t(lang, "KATA LALUAN DIKEMASKINI", "PASSWORD UPDATED")}
        subtitle={t(lang, "Kata laluan baharu anda telah disimpan.", "Your new password has been saved.")}
      >
        <p className="text-center text-[12px] leading-6" style={{ color: "#d7e7f5" }}>
          {t(lang, "Mengalihkan ke log masuk…", "Redirecting to login…")}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t(lang, "KATA LALUAN BAHARU", "NEW PASSWORD")}
      subtitle={t(lang, "Masukkan kata laluan baharu untuk akaun anda.", "Enter a new password for your account.")}
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
            {t(lang, "KATA LALUAN BAHARU", "NEW PASSWORD")}
          </label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full"
            disabled={!ready}
          />
        </div>

        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
            {t(lang, "SAHKAN KATA LALUAN", "CONFIRM PASSWORD")}
          </label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full"
            disabled={!ready}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !ready}
          className="mt-2 w-full border py-2.5 text-[12px] font-black tracking-[0.24em] transition-all disabled:opacity-50"
          style={{
            borderColor: "rgb(var(--gold-rgb) / 0.9)",
            background: "linear-gradient(90deg, #ffb42f, #f7a81f)",
            color: "#05080e",
            boxShadow: "0 0 24px rgb(var(--gold-rgb) / 0.28)",
          }}
        >
          {loading ? t(lang, "MENGEMASKINI…", "UPDATING…") : t(lang, "KEMASKINI KATA LALUAN »", "UPDATE PASSWORD »")}
        </button>
      </form>
    </AuthShell>
  );
}
