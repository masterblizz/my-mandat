"use client";

// Opening film: shots of the game's own 3D city (rendered from real seats:
// KL's towers, Langkawi's coast, Cameron's tea hills, Sabak Bernam town,
// Kuantan's waterfront), slow pans with cinema bars and titles in the same
// look as the in-game aerial fly-in, ending on the MY MANDAT title card.
// No video file: a handful of stills and CSS motion, so it loads fast.

import { useCallback, useEffect, useRef, useState } from "react";
import { useLang, t } from "../../i18n/useLang";

type Shot = { src: string; kicker: [string, string]; title: [string, string]; from: string; to: string };

const SHOTS: Shot[] = [
  { src: "/intro/film-bb-wide.webp", kicker: ["222 KERUSI PARLIMEN · 600 DUN", "222 PARLIAMENT SEATS · 600 STATE SEATS"], title: ["Satu mandat.", "One mandate."], from: "scale(1.04) translate(0, 1%)", to: "scale(1.16) translate(-2%, -1%)" },
  { src: "/intro/film-lkw-coast.webp", kicker: ["P.004 LANGKAWI", "P.004 LANGKAWI"], title: ["Dari pantai pelancong…", "From the tourist coast…"], from: "scale(1.14) translate(2%, 0)", to: "scale(1.04) translate(-1%, 1%)" },
  { src: "/intro/film-cam-tea.webp", kicker: ["P.078 CAMERON HIGHLANDS", "P.078 CAMERON HIGHLANDS"], title: ["…ke ladang teh di tanah tinggi.", "…to the highland tea estates."], from: "scale(1.05) translate(-1%, 1%)", to: "scale(1.15) translate(1%, -1%)" },
  { src: "/intro/film-sb-town.webp", kicker: ["BANCI 2020 · DOSM", "2020 CENSUS · DOSM"], title: ["Setiap rumah, satu isi rumah sebenar.", "Every home, one real household."], from: "scale(1.12) translate(1%, -1%)", to: "scale(1.03) translate(-1%, 1%)" },
  { src: "/intro/film-bb-close.webp", kicker: ["WAKIL RAKYAT", "YOUR REPRESENTATIVE"], title: ["Dengar rakyat. Bina kawasan.", "Hear the people. Build the seat."], from: "scale(1.03) translate(0, 0)", to: "scale(1.14) translate(2%, -1%)" },
  { src: "/intro/film-kua-wide.webp", kicker: ["PILIHAN RAYA SETERUSNYA", "THE NEXT ELECTION"], title: ["Pertahankan kerusi anda.", "Defend your seat."], from: "scale(1.15) translate(-1%, 0)", to: "scale(1.05) translate(1%, 1%)" },
];
const SHOT_MS = 3600;
const FADE_MS = 900;

export default function IntroFilm({ onComplete }: { onComplete: () => void }) {
  const lang = useLang();
  const li = lang === "ms" ? 0 : 1;
  const [shot, setShot] = useState(0);
  const [ready, setReady] = useState(false);
  const done = useRef(false);
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onComplete();
  }, [onComplete]);

  // wait for the stills (so the first shot doesn't pop in half-loaded)
  useEffect(() => {
    let left = SHOTS.length;
    const imgs = SHOTS.map((s) => { const im = new Image(); im.onload = im.onerror = () => { if (--left === 0) setReady(true); }; im.src = s.src; return im; });
    const fallback = window.setTimeout(() => setReady(true), 4000);
    return () => { window.clearTimeout(fallback); imgs.forEach((im) => { im.onload = im.onerror = null; }); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (shot >= SHOTS.length + 1) return;
    const id = window.setTimeout(() => setShot((n) => n + 1), shot === SHOTS.length ? 3400 : SHOT_MS);
    return () => window.clearTimeout(id);
  }, [ready, shot]);
  useEffect(() => { if (shot > SHOTS.length) finish(); }, [shot, finish]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === " " || e.key === "Enter") finish(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [finish]);

  const titleCard = shot >= SHOTS.length;
  return (
    <div className="intro-film fixed inset-0 z-[9999] overflow-hidden" style={{ background: "#060d1a", color: "#fff", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes intro-film-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes intro-film-logo { 0% { opacity: 0; letter-spacing: .5em; } 100% { opacity: 1; letter-spacing: .04em; } }
        @keyframes intro-film-bar { from { width: 0; } to { width: 100%; } }
      `}</style>

      {SHOTS.map((s, i) => {
        const on = i === shot || (titleCard && i === SHOTS.length - 1);
        return (
          <div key={s.src} className="absolute inset-0" style={{ opacity: ready && on ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.src} alt="" className="absolute inset-0 h-full w-full object-cover"
              style={{ transform: on ? s.to : s.from, transition: on ? `transform ${SHOT_MS + FADE_MS * 2}ms linear` : "none", filter: titleCard ? "blur(3px) brightness(.55)" : "none" }} />
          </div>
        );
      })}

      {/* grade: navy at the edges like the game's HUD vignette */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 85% 80% at 50% 45%, transparent 55%, rgb(6 13 26 / .55) 100%), linear-gradient(180deg, rgb(6 13 26 / .25), transparent 30%, transparent 55%, rgb(6 13 26 / .75))" }} />
      {/* cinema bars, as in the in-game aerial fly-in */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[9vh] bg-black" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[9vh] bg-black" />

      {!titleCard && ready && (
        <div key={shot} className="pointer-events-none absolute bottom-[calc(9vh+68px)] left-[6vw] right-[6vw]" style={{ animation: "intro-film-in .7s ease-out both", animationDelay: ".35s" }}>
          <div className="inline-block rounded px-2 py-0.5 text-[11px] font-black tracking-[.28em] sm:text-[13px]" style={{ color: "#ffcc29", background: "rgb(6 13 26 / .72)" }}>{SHOTS[shot].kicker[li]}</div>
          <div className="mt-1 text-[26px] font-black leading-tight [text-shadow:0_2px_14px_rgba(0,0,0,.85),0_0_2px_rgba(0,0,0,.9)] sm:text-[42px]">{SHOTS[shot].title[li]}</div>
        </div>
      )}

      {titleCard && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[18px] font-black italic tracking-[.2em] text-white/90 sm:text-[22px]" style={{ animation: "intro-film-in .6s ease-out both" }}>MY</div>
          <div className="text-[56px] font-black italic leading-none sm:text-[84px]" style={{ animation: "intro-film-logo 1.2s ease-out both", textShadow: "0 4px 24px rgb(0 0 0 / .5)" }}>MANDAT</div>
          <div className="mt-2 h-[4px] w-[min(320px,60vw)] overflow-hidden rounded-full" style={{ background: "rgb(255 255 255 / .12)" }}>
            <div className="h-full rounded-full" style={{ background: "#e53935", animation: "intro-film-bar 1.4s ease-out .3s both" }} />
          </div>
          <div className="mt-4 text-[12px] font-bold tracking-[.28em] text-white/75 sm:text-[14px]" style={{ animation: "intro-film-in .7s ease-out .9s both" }}>
            {t(lang, "SIMULASI POLITIK MALAYSIA", "MALAYSIAN POLITICAL SIMULATOR")}
          </div>
        </div>
      )}

      {/* progress + skip */}
      <div className="absolute inset-x-0 top-[9vh] flex gap-1 px-[6vw] pt-3" aria-hidden>
        {SHOTS.map((s, i) => (
          <div key={s.src} className="h-[3px] flex-1 overflow-hidden rounded-full" style={{ background: "rgb(255 255 255 / .18)" }}>
            <div className="h-full rounded-full" style={{ background: "#ffcc29", width: i < shot ? "100%" : "0%", ...(i === shot && ready ? { animation: `intro-film-bar ${SHOT_MS}ms linear both` } : {}) }} />
          </div>
        ))}
      </div>
      <button type="button" onClick={finish}
        className="absolute bottom-[calc(9vh+14px)] right-[6vw] rounded-full px-5 py-2 text-[12px] font-black tracking-[.18em]"
        style={{ background: "rgb(14 26 48 / .82)", border: "1px solid rgb(140 190 255 / .35)", backdropFilter: "blur(10px)" }}>
        {titleCard ? t(lang, "MULA ▶", "START ▶") : t(lang, "LANGKAU ▶▶", "SKIP ▶▶")}
      </button>
    </div>
  );
}
