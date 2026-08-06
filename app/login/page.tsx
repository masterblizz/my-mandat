"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import PosterShell, { oswald, INK, RED, RED_DARK, MUTED, POSTER_INPUT_CLASS } from "../components/auth/PosterShell";
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
    <PosterShell
      heading={t(lang, "LOG MASUK", "LOG IN")}
      footNote={
        <>
          {t(lang, "Belum ada akaun? ", "Don't have an account? ")}
          <a href="/register" style={{ color: RED, fontWeight: 700, textDecoration: "underline" }}>
            {t(lang, "Daftar di sini", "Register here")}
          </a>
        </>
      }
    >
      <form onSubmit={handleLogin}>
        {error && (
          <p
            className={oswald.className}
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              fontSize: 12,
              lineHeight: 1.5,
              border: `1.5px solid ${RED}`,
              background: "rgba(193,31,44,0.08)",
              color: RED_DARK,
            }}
          >
            {error}
          </p>
        )}

        <div className="mb-5">
          <label
            className={oswald.className}
            style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: MUTED }}
          >
            {t(lang, "EMEL", "EMAIL")}
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${oswald.className} ${POSTER_INPUT_CLASS}`}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${MUTED}`,
              borderRadius: 0,
              padding: "6px 2px",
              fontSize: 15,
              color: INK,
            }}
          />
        </div>

        <div className="mb-7">
          <label
            className={oswald.className}
            style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: MUTED }}
          >
            {t(lang, "KATA LALUAN", "PASSWORD")}
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${oswald.className} ${POSTER_INPUT_CLASS}`}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${MUTED}`,
              borderRadius: 0,
              padding: "6px 2px",
              fontSize: 15,
              color: INK,
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={oswald.className}
          style={{
            width: "100%",
            border: "none",
            background: RED,
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.2em",
            padding: "14px 0",
            boxShadow: loading ? "none" : `6px 6px 0 ${RED_DARK}`,
            transform: loading ? "translate(6px, 6px)" : "none",
            opacity: loading ? 0.75 : 1,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "transform 0.1s, box-shadow 0.1s, opacity 0.1s",
          }}
        >
          {loading ? t(lang, "MENGESAHKAN…", "VERIFYING…") : t(lang, "LOG MASUK »", "LOG IN »")}
        </button>

        <p className={oswald.className} style={{ marginTop: 18, textAlign: "center", fontSize: 12 }}>
          <a href="/forgot-password" style={{ color: RED, fontWeight: 700, textDecoration: "underline" }}>
            {t(lang, "Lupa kata laluan?", "Forgot password?")}
          </a>
        </p>
      </form>
    </PosterShell>
  );
}
