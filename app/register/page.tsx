"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import AuthShell from "../components/auth/AuthShell";
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
      <AuthShell
        title={t(lang, "SEMAK EMEL ANDA", "CHECK YOUR EMAIL")}
        subtitle={t(lang, "Satu langkah lagi sebelum kempen anda bermula.", "One more step before your campaign begins.")}
      >
        <div className="space-y-4 text-center">
          <p className="text-[12px] leading-6" style={{ color: "#d7e7f5" }}>
            {t(
              lang,
              `Pautan pengesahan telah dihantar ke ${email}. Sahkan emel anda, kemudian log masuk untuk mula kempen.`,
              `A confirmation link was sent to ${email}. Verify it, then log in to start your campaign.`
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
      title={t(lang, "DAFTAR OPERASI BAHARU", "REGISTER NEW OPERATIVE")}
      subtitle={t(lang, "Cipta akaun untuk mula kempen pilihan raya anda.", "Create an account to launch your election campaign.")}
      footNote={t(lang, "Data kempen disimpan pada akaun anda merentasi peranti.", "Campaign data is tied to your account across devices.")}
    >
      <form onSubmit={handleRegister} className="space-y-4">
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
            {t(lang, "NAMA PENGGUNA", "USERNAME")}
          </label>
          <input
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full"
          />
        </div>

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
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full"
          />
          <div className="mt-1 text-[9px] tracking-[0.06em]" style={{ color: "var(--text-muted)" }}>
            {t(lang, "Minimum 6 aksara.", "Minimum 6 characters.")}
          </div>
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
          {loading ? t(lang, "MENDAFTAR…", "REGISTERING…") : t(lang, "DAFTAR »", "REGISTER »")}
        </button>

        <p className="pt-1 text-center text-[10px] tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
          {t(lang, "Dah ada akaun? ", "Already have an account? ")}
          <a href="/login" className="font-bold" style={{ color: "var(--cyan)" }}>
            {t(lang, "Log masuk di sini", "Log in here")}
          </a>
        </p>
      </form>
    </AuthShell>
  );
}
