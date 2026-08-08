"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import TacticalAuthShell, { plexMono, BORDER, INPUT_BG, TEXT, TEXT_DIM, TEXT_FAINT, CYAN, GOLD, RED, ERROR_TEXT } from "../components/auth/TacticalAuthShell";
import { useLang, t } from "../i18n/useLang";

export default function LoginPage() {
  const router = useRouter();
  const lang = useLang();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const anyLoading = loading || googleLoading;

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
      setError(t(lang, "login_page.loginIsnTConfiguredForThis"));
      return;
    }

    // "Ingat saya" (remember me) — Supabase's own session already persists
    // by default (localStorage, survives closing the tab), so there's no
    // separate persistent-vs-session storage mode to toggle here. Kept as
    // a real controlled checkbox matching the design rather than removed,
    // but it doesn't change auth behavior; wire it to an actual session-
    // length option if that distinction is ever added.
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

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);

    let supabase;
    try {
      supabase = createClient();
    } catch {
      setGoogleLoading(false);
      setError(t(lang, "login_page.loginIsnTConfiguredForThis"));
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    // On success the browser navigates away to Google's consent screen —
    // nothing more to do here. Only reachable on failure (e.g. Google
    // provider not enabled in the Supabase dashboard yet).
    setGoogleLoading(false);
    if (error) setError(error.message);
  };

  return (
    <TacticalAuthShell
      eyebrow={t(lang, "login_page.electionCampaignSimulator")}
      heading={t(lang, "login_page.logInToMymandat")}
    >
      {error && (
        <p
          className={plexMono.className}
          style={{ marginBottom: 16, padding: "10px 12px", fontSize: 11, lineHeight: 1.6, border: `1px solid ${RED}`, background: "rgb(var(--auth-red-rgb) / 0.1)", color: ERROR_TEXT }}
        >
          {error}
        </p>
      )}

      <form onSubmit={handleLogin}>
        <div className="mb-4 flex flex-col gap-1.5">
          <label className={plexMono.className} style={{ fontSize: 10, color: TEXT_DIM, letterSpacing: 1 }}>
            {t(lang, "login_page.email")}
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder={t(lang, "login_page.eGOperator01EmailCom")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={plexMono.className}
            style={{ background: INPUT_BG, border: `1px solid ${BORDER}`, color: TEXT, padding: "11px 12px", fontSize: 13, outline: "none" }}
          />
        </div>

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label className={plexMono.className} style={{ fontSize: 10, color: TEXT_DIM, letterSpacing: 1 }}>
            {t(lang, "login_page.password")}
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={plexMono.className}
            style={{ background: INPUT_BG, border: `1px solid ${BORDER}`, color: TEXT, padding: "11px 12px", fontSize: 13, outline: "none" }}
          />
        </div>

        <div className="mb-5 flex items-center justify-between">
          <label className={plexMono.className} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: TEXT_DIM, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ accentColor: GOLD }}
            />
            {t(lang, "login_page.rememberMe")}
          </label>
          <a href="/forgot-password" className={plexMono.className} style={{ fontSize: 11, color: CYAN }}>
            {t(lang, "login_page.forgotPassword")}
          </a>
        </div>

        <button
          type="submit"
          disabled={anyLoading}
          className={plexMono.className}
          style={{
            width: "100%",
            background: GOLD,
            color: "#1a1204",
            border: "none",
            padding: 13,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 1,
            cursor: anyLoading ? "not-allowed" : "pointer",
            opacity: anyLoading && !loading ? 0.5 : 1,
            marginBottom: 12,
          }}
        >
          {loading ? t(lang, "login_page.verifying") : t(lang, "login_page.startCampaign")}
        </button>

        <div className="my-3.5 flex items-center gap-2.5">
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <div className={plexMono.className} style={{ fontSize: 9, color: TEXT_FAINT }}>{t(lang, "login_page.or")}</div>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={anyLoading}
          className={plexMono.className}
          style={{
            width: "100%",
            background: "transparent",
            color: TEXT,
            border: `1px solid ${BORDER}`,
            padding: 10,
            fontSize: 11,
            letterSpacing: 1,
            cursor: anyLoading ? "not-allowed" : "pointer",
            opacity: anyLoading && !googleLoading ? 0.5 : 1,
          }}
        >
          {googleLoading ? t(lang, "login_page.connecting") : t(lang, "login_page.signInWithGoogle")}
        </button>

        <div className={plexMono.className} style={{ textAlign: "center", fontSize: 11, color: TEXT_FAINT, marginTop: 18 }}>
          {t(lang, "login_page.noAccount")}
          <a href="/register" style={{ color: CYAN }}>{t(lang, "login_page.registerNow")}</a>
        </div>
      </form>
    </TacticalAuthShell>
  );
}
