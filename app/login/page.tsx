"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import TacticalAuthShell, { plexMono, BORDER, INPUT_BG, TEXT, TEXT_DIM, TEXT_FAINT, CYAN, GOLD, RED } from "../components/auth/TacticalAuthShell";
import { useLang, t } from "../i18n/useLang";
import { useGameStore } from "../store/gameStore";
import { useHistoryStore } from "../store/historyStore";
import { clearAllSavedGameData } from "../store/saveGame";

export default function LoginPage() {
  const router = useRouter();
  const lang = useLang();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const anyLoading = loading || googleLoading || guestLoading;

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
      setError(t(lang, "Log masuk belum dikonfigurasi untuk deployment ini.", "Login isn't configured for this deployment yet."));
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

  const handleGuestLogin = async () => {
    setError(null);
    setGuestLoading(true);

    let supabase;
    try {
      supabase = createClient();
    } catch {
      setGuestLoading(false);
      setError(t(lang, "Log masuk belum dikonfigurasi untuk deployment ini.", "Login isn't configured for this deployment yet."));
      return;
    }

    const { error } = await supabase.auth.signInAnonymously();
    setGuestLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Same reasoning as /register: a brand-new session (anonymous or not)
    // must start with zero leftover game memory from whoever last played
    // on this browser, since saves live in localStorage rather than a
    // per-account backend.
    useGameStore.getState().resetGame();
    useHistoryStore.getState().clearHistory();
    clearAllSavedGameData();

    router.push("/");
    router.refresh();
  };

  return (
    <TacticalAuthShell
      eyebrow={t(lang, "SIMULATOR KEMPEN PILIHAN RAYA", "ELECTION CAMPAIGN SIMULATOR")}
      heading={t(lang, "Log Masuk ke Mandat", "Log In to Mandat")}
    >
      {error && (
        <p
          className={plexMono.className}
          style={{ marginBottom: 16, padding: "10px 12px", fontSize: 11, lineHeight: 1.6, border: `1px solid ${RED}`, background: "rgba(193,31,44,0.1)", color: "#ff8a93" }}
        >
          {error}
        </p>
      )}

      <form onSubmit={handleLogin}>
        <div className="mb-4 flex flex-col gap-1.5">
          <label className={plexMono.className} style={{ fontSize: 10, color: TEXT_DIM, letterSpacing: 1 }}>
            {t(lang, "ID PENGGUNA / EMEL", "USER ID / EMAIL")}
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder={t(lang, "cth. operator01", "e.g. operator01")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={plexMono.className}
            style={{ background: INPUT_BG, border: `1px solid ${BORDER}`, color: TEXT, padding: "11px 12px", fontSize: 13, outline: "none" }}
          />
        </div>

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label className={plexMono.className} style={{ fontSize: 10, color: TEXT_DIM, letterSpacing: 1 }}>
            {t(lang, "KATA LALUAN", "PASSWORD")}
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
            {t(lang, "INGAT SAYA", "REMEMBER ME")}
          </label>
          <a href="/forgot-password" className={plexMono.className} style={{ fontSize: 11, color: CYAN }}>
            {t(lang, "LUPA KATA LALUAN", "FORGOT PASSWORD")}
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
          {loading ? t(lang, "MENGESAHKAN…", "VERIFYING…") : t(lang, "MULA KEMPEN »", "START CAMPAIGN »")}
        </button>

        <div className="my-3.5 flex items-center gap-2.5">
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <div className={plexMono.className} style={{ fontSize: 9, color: TEXT_FAINT }}>{t(lang, "ATAU", "OR")}</div>
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
            color: "#c4cbd6",
            border: `1px solid ${BORDER}`,
            padding: 10,
            fontSize: 11,
            letterSpacing: 1,
            cursor: anyLoading ? "not-allowed" : "pointer",
            opacity: anyLoading && !googleLoading ? 0.5 : 1,
            marginBottom: 10,
          }}
        >
          {googleLoading ? t(lang, "MENYAMBUNG…", "CONNECTING…") : t(lang, "MASUK DENGAN GOOGLE", "SIGN IN WITH GOOGLE")}
        </button>

        <button
          type="button"
          onClick={handleGuestLogin}
          disabled={anyLoading}
          className={plexMono.className}
          style={{
            width: "100%",
            background: "transparent",
            color: TEXT_DIM,
            border: `1px solid ${BORDER}`,
            padding: 10,
            fontSize: 11,
            letterSpacing: 1,
            cursor: anyLoading ? "not-allowed" : "pointer",
            opacity: anyLoading && !guestLoading ? 0.5 : 1,
          }}
        >
          {guestLoading ? t(lang, "MEMULAKAN…", "STARTING…") : t(lang, "MASUK SEBAGAI TETAMU", "CONTINUE AS GUEST")}
        </button>

        <div className={plexMono.className} style={{ textAlign: "center", fontSize: 11, color: TEXT_FAINT, marginTop: 18 }}>
          {t(lang, "TIADA AKAUN? ", "NO ACCOUNT? ")}
          <a href="/register" style={{ color: CYAN }}>{t(lang, "DAFTAR SEKARANG", "REGISTER NOW")}</a>
        </div>
      </form>
    </TacticalAuthShell>
  );
}
