"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import TacticalAuthShell, { plexMono, BORDER, INPUT_BG, TEXT, TEXT_DIM, TEXT_FAINT, CYAN, GOLD, RED } from "../components/auth/TacticalAuthShell";
import { useLang, t } from "../i18n/useLang";
import { useGameStore } from "../store/gameStore";
import { useHistoryStore } from "../store/historyStore";
import { clearAllSavedGameData } from "../store/saveGame";

export default function RegisterPage() {
  const router = useRouter();
  const lang = useLang();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Set once signUp succeeds but Supabase requires email confirmation
  // before a session exists — the player isn't logged in yet, so there's
  // nowhere authenticated to route them; show the "check your inbox" state
  // in place of the form instead.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const anyLoading = loading || googleLoading;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Created on submit, not at module/render scope — see the matching
    // comment in /login: createClient() throws synchronously when
    // Supabase isn't configured, which would otherwise crash this page's
    // render instead of just failing the submit with a readable message.
    let supabase;
    try {
      supabase = createClient();
    } catch {
      setLoading(false);
      setError(t(lang, "Pendaftaran belum dikonfigurasi untuk deployment ini.", "Registration isn't configured for this deployment yet."));
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        // Without this, Supabase sends the confirmation link to whatever
        // "Site URL" is set in the dashboard (defaults to localhost:3000),
        // which would break the flow on every non-local deployment.
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // A brand-new account must start with zero leftover game memory —
    // otherwise whoever last played on this browser/device (game in
    // progress, save slots, win/loss history) would bleed into the new
    // player's account, since saves currently live in this browser's
    // localStorage rather than a per-account backend. Wipe unconditionally
    // once signUp has actually succeeded, regardless of whether email
    // confirmation is still pending.
    useGameStore.getState().resetGame();
    useHistoryStore.getState().clearHistory();
    clearAllSavedGameData();

    if (!data.session) {
      setAwaitingConfirmation(true);
      return;
    }

    router.push("/");
    router.refresh();
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setGoogleLoading(true);

    let supabase;
    try {
      supabase = createClient();
    } catch {
      setGoogleLoading(false);
      setError(t(lang, "Pendaftaran belum dikonfigurasi untuk deployment ini.", "Registration isn't configured for this deployment yet."));
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

  if (awaitingConfirmation) {
    return (
      <TacticalAuthShell
        eyebrow={t(lang, "SIMULATOR KEMPEN PILIHAN RAYA", "ELECTION CAMPAIGN SIMULATOR")}
        heading={t(lang, "Semak Emel Anda", "Check Your Email")}
      >
        <p className={plexMono.className} style={{ fontSize: 12, lineHeight: 1.7, color: TEXT_DIM, marginBottom: 22 }}>
          {t(
            lang,
            `Pautan pengesahan telah dihantar ke ${email}. Sahkan emel anda, kemudian log masuk untuk mula kempen.`,
            `A confirmation link was sent to ${email}. Verify it, then log in to start your campaign.`
          )}
        </p>
        <a
          href="/login"
          className={plexMono.className}
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            background: GOLD,
            color: "#1a1204",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 1,
            padding: 13,
          }}
        >
          {t(lang, "KE LOG MASUK »", "GO TO LOGIN »")}
        </a>
      </TacticalAuthShell>
    );
  }

  return (
    <TacticalAuthShell
      eyebrow={t(lang, "SIMULATOR KEMPEN PILIHAN RAYA", "ELECTION CAMPAIGN SIMULATOR")}
      heading={t(lang, "Daftar Operator Baharu", "Register New Operator")}
    >
      {error && (
        <p
          className={plexMono.className}
          style={{ marginBottom: 16, padding: "10px 12px", fontSize: 11, lineHeight: 1.6, border: `1px solid ${RED}`, background: "rgba(193,31,44,0.1)", color: "#ff8a93" }}
        >
          {error}
        </p>
      )}

      <form onSubmit={handleRegister}>
        <div className="mb-4 flex flex-col gap-1.5">
          <label className={plexMono.className} style={{ fontSize: 10, color: TEXT_DIM, letterSpacing: 1 }}>
            {t(lang, "NAMA PENGGUNA", "USERNAME")}
          </label>
          <input
            type="text"
            required
            autoComplete="username"
            placeholder={t(lang, "cth. operator01", "e.g. operator01")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={plexMono.className}
            style={{ background: INPUT_BG, border: `1px solid ${BORDER}`, color: TEXT, padding: "11px 12px", fontSize: 13, outline: "none" }}
          />
        </div>

        <div className="mb-4 flex flex-col gap-1.5">
          <label className={plexMono.className} style={{ fontSize: 10, color: TEXT_DIM, letterSpacing: 1 }}>
            {t(lang, "ID PENGGUNA / EMEL", "USER ID / EMAIL")}
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={plexMono.className}
            style={{ background: INPUT_BG, border: `1px solid ${BORDER}`, color: TEXT, padding: "11px 12px", fontSize: 13, outline: "none" }}
          />
        </div>

        <div className="mb-5 flex flex-col gap-1.5">
          <label className={plexMono.className} style={{ fontSize: 10, color: TEXT_DIM, letterSpacing: 1 }}>
            {t(lang, "KATA LALUAN", "PASSWORD")}
          </label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={plexMono.className}
            style={{ background: INPUT_BG, border: `1px solid ${BORDER}`, color: TEXT, padding: "11px 12px", fontSize: 13, outline: "none" }}
          />
          <div className={plexMono.className} style={{ fontSize: 10, letterSpacing: 0.5, color: TEXT_FAINT }}>
            {t(lang, "Minimum 6 aksara.", "Minimum 6 characters.")}
          </div>
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
            opacity: anyLoading && !loading ? 0.5 : loading ? 0.6 : 1,
            marginBottom: 12,
          }}
        >
          {loading ? t(lang, "MENDAFTAR…", "REGISTERING…") : t(lang, "DAFTAR »", "REGISTER »")}
        </button>

        <div className="my-3.5 flex items-center gap-2.5">
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <div className={plexMono.className} style={{ fontSize: 9, color: TEXT_FAINT }}>{t(lang, "ATAU", "OR")}</div>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignUp}
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
          }}
        >
          {googleLoading ? t(lang, "MENYAMBUNG…", "CONNECTING…") : t(lang, "DAFTAR DENGAN GOOGLE", "SIGN UP WITH GOOGLE")}
        </button>

        <div className={plexMono.className} style={{ textAlign: "center", fontSize: 11, color: TEXT_FAINT, marginTop: 18 }}>
          {t(lang, "DAH ADA AKAUN? ", "ALREADY HAVE AN ACCOUNT? ")}
          <a href="/login" style={{ color: CYAN }}>{t(lang, "LOG MASUK DI SINI", "LOG IN HERE")}</a>
        </div>
      </form>
    </TacticalAuthShell>
  );
}
