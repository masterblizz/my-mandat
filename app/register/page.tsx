"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import PosterShell, { oswald, INK, RED, RED_DARK, MUTED, POSTER_INPUT_CLASS } from "../components/auth/PosterShell";
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
  // Set once signUp succeeds but Supabase requires email confirmation
  // before a session exists — the player isn't logged in yet, so there's
  // nowhere authenticated to route them; show the "check your inbox" state
  // in place of the form instead.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

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

  if (awaitingConfirmation) {
    return (
      <PosterShell heading={t(lang, "SEMAK EMEL ANDA", "CHECK YOUR EMAIL")}>
        <p className={oswald.className} style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 22 }}>
          {t(
            lang,
            `Pautan pengesahan telah dihantar ke ${email}. Sahkan emel anda, kemudian log masuk untuk mula kempen.`,
            `A confirmation link was sent to ${email}. Verify it, then log in to start your campaign.`
          )}
        </p>
        <a
          href="/login"
          className={oswald.className}
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            background: RED,
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.2em",
            padding: "14px 0",
            boxShadow: `6px 6px 0 ${RED_DARK}`,
          }}
        >
          {t(lang, "KE LOG MASUK »", "GO TO LOGIN »")}
        </a>
      </PosterShell>
    );
  }

  return (
    <PosterShell
      heading={t(lang, "DAFTAR OPERASI", "REGISTER")}
      footNote={
        <>
          {t(lang, "Dah ada akaun? ", "Already have an account? ")}
          <a href="/login" style={{ color: RED, fontWeight: 700, textDecoration: "underline" }}>
            {t(lang, "Log masuk di sini", "Log in here")}
          </a>
        </>
      }
    >
      <form onSubmit={handleRegister}>
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
            {t(lang, "NAMA PENGGUNA", "USERNAME")}
          </label>
          <input
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
            minLength={6}
            autoComplete="new-password"
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
          <div className={oswald.className} style={{ marginTop: 6, fontSize: 10, letterSpacing: "0.06em", color: MUTED }}>
            {t(lang, "Minimum 6 aksara.", "Minimum 6 characters.")}
          </div>
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
          {loading ? t(lang, "MENDAFTAR…", "REGISTERING…") : t(lang, "DAFTAR »", "REGISTER »")}
        </button>
      </form>
    </PosterShell>
  );
}
