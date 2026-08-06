"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import AuthShell from "../components/auth/AuthShell";
import { useLang, t } from "../i18n/useLang";

export default function LoginPage() {
  const router = useRouter();
  const lang = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Created on submit, not at module/render scope: createClient() throws
    // synchronously when Supabase isn't configured (see middleware.ts's
    // fallback comment), which would otherwise crash this page's render
    // for anyone who lands here directly instead of just failing the
    // submit with a readable message.
    let supabase;
    try {
      supabase = createClient();
    } catch {
      setLoading(false);
      setError(t(lang, "Log masuk belum dikonfigurasi untuk deployment ini.", "Login isn't configured for this deployment yet."));
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Back to "/" (not straight to /kawasan) so the normal opening-video /
    // main-menu entry flow decides where the player lands, same as any
    // other session start.
    router.push("/");
    router.refresh();
  };

  return (
    <AuthShell
      title={t(lang, "LOG MASUK OPERASI", "OPERATOR LOGIN")}
      subtitle={t(lang, "Sahkan identiti untuk sambung kempen anda.", "Verify identity to resume your campaign.")}
      footNote={t(lang, "Data kempen disimpan pada akaun anda merentasi peranti.", "Campaign data is tied to your account across devices.")}
      showBack={false}
    >
      <form onSubmit={handleLogin} className="space-y-4">
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

        <div>
          <label className="mb-1 block text-[9px] font-bold tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
            {t(lang, "KATA LALUAN", "PASSWORD")}
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? t(lang, "MENGESAHKAN…", "VERIFYING…") : t(lang, "LOG MASUK »", "LOG IN »")}
        </button>

        <p className="text-center text-[10px] tracking-[0.08em]">
          <a href="/forgot-password" className="font-bold" style={{ color: "var(--cyan)" }}>
            {t(lang, "Lupa kata laluan?", "Forgot password?")}
          </a>
        </p>

        <p className="pt-1 text-center text-[10px] tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
          {t(lang, "Belum ada akaun? ", "Don't have an account? ")}
          <a href="/register" className="font-bold" style={{ color: "var(--cyan)" }}>
            {t(lang, "Daftar di sini", "Register here")}
          </a>
        </p>
      </form>
    </AuthShell>
  );
}
