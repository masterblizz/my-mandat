"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Anton, Oswald } from "next/font/google";
import { createClient } from "@/app/utils/supabase/client";
import { useLang, t } from "../i18n/useLang";
import { useUIStore, type Lang } from "../store/uiStore";

// Deliberately NOT AuthShell here — this page's brief was "redevelop using
// this [vintage election-poster] design", a completely different visual
// language from the rest of the app's dark cyan/gold tactical HUD (and
// from AuthShell, which register/forgot-password/reset-password still use
// unchanged). next/font here rather than adding to globals.css's Google
// Fonts @import, so Anton/Oswald only ever get downloaded on this one page.
const anton = Anton({ subsets: ["latin"], weight: "400" });
const oswald = Oswald({ subsets: ["latin"], weight: ["500", "700"] });

const INK = "#1c1a17";
const RED = "#c11f2c";
const RED_DARK = "#7c1119";
const PAPER = "#e9e1d1";
const CARD = "#f5efe1";
const MUTED = "#8a8171";

function StripeBar() {
  return (
    <div
      style={{
        height: 14,
        backgroundImage: `repeating-linear-gradient(45deg, ${RED} 0 18px, ${INK} 18px 36px)`,
      }}
    />
  );
}

function LangToggle() {
  const lang = useLang();
  const setLanguage = useUIStore((s) => s.setLanguage);
  const codes: Lang[] = ["ms", "en"];
  return (
    <div className="absolute right-4 top-6 z-20 flex gap-1">
      {codes.map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLanguage(code)}
            className={oswald.className}
            style={{
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              border: `1.5px solid ${active ? RED : MUTED}`,
              color: active ? RED : MUTED,
              background: active ? "rgba(193,31,44,0.08)" : "transparent",
            }}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

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
    <main className="relative flex min-h-screen flex-col" style={{ background: PAPER, color: INK }}>
      {/* globals.css's generic input:focus rule (cyan border-glow, tuned
          for the rest of the app's dark theme) doesn't fit this page's
          palette — box-shadow in particular has nothing inline to compete
          with it, so it always wins. Scoped override, red-toned to match. */}
      <style>{`
        .mm-login-input:focus {
          border-bottom-color: ${RED} !important;
          box-shadow: none !important;
          outline: none !important;
        }
      `}</style>
      <StripeBar />
      <LangToggle />

      <div className="mx-auto flex w-full flex-1 flex-col items-center justify-center px-6 py-12" style={{ maxWidth: 480 }}>
        {/* Stamp seal */}
        <div
          className="mb-8 flex items-center justify-center rounded-full"
          style={{
            width: 132,
            height: 132,
            border: `3px solid ${RED}`,
            transform: "rotate(-4deg)",
          }}
        >
          <span
            className={oswald.className}
            style={{ color: RED, fontWeight: 700, fontSize: 20, letterSpacing: "0.12em" }}
          >
            {t(lang, "UNDI", "VOTE")}
          </span>
        </div>

        {/* Wordmark */}
        <h1
          className={anton.className}
          style={{
            fontSize: 56,
            lineHeight: 0.92,
            textAlign: "center",
            color: INK,
            textShadow: `5px 5px 0 ${RED}`,
            letterSpacing: "0.01em",
          }}
        >
          MY<br />MANDAT
        </h1>

        <div className="mt-4 mb-10 flex flex-col items-center gap-1.5" style={{ width: "100%", maxWidth: 300 }}>
          <div style={{ height: 3, width: "100%", background: INK }} />
          <span
            className={oswald.className}
            style={{ color: RED, fontWeight: 700, fontSize: 13, letterSpacing: "0.32em" }}
          >
            {t(lang, "SIMULATOR KEMPEN", "CAMPAIGN SIMULATOR")}
          </span>
          <div style={{ height: 3, width: "100%", background: INK }} />
        </div>

        {/* Card */}
        <section
          className="relative w-full"
          style={{ background: CARD, border: `2px dashed ${MUTED}`, padding: "32px 28px" }}
        >
          <span
            className={oswald.className}
            style={{
              position: "absolute",
              top: -14,
              right: 20,
              background: RED,
              color: "#fff",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.16em",
              padding: "5px 14px",
              transform: "rotate(4deg)",
              boxShadow: `3px 3px 0 ${RED_DARK}`,
            }}
          >
            {t(lang, "RAHSIA", "CONFIDENTIAL")}
          </span>

          <h2 className={anton.className} style={{ fontSize: 26, marginBottom: 22 }}>
            {t(lang, "LOG MASUK", "LOG IN")}
          </h2>

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
                className={`${oswald.className} mm-login-input`}
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
                className={`${oswald.className} mm-login-input`}
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
        </section>

        <p className={oswald.className} style={{ marginTop: 28, textAlign: "center", fontSize: 12, color: INK }}>
          {t(lang, "Belum ada akaun? ", "Don't have an account? ")}
          <a href="/register" style={{ color: RED, fontWeight: 700, textDecoration: "underline" }}>
            {t(lang, "Daftar di sini", "Register here")}
          </a>
        </p>
      </div>

      <StripeBar />
    </main>
  );
}
