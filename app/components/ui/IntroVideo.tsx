"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../../i18n/useLang";

interface IntroVideoProps {
  leaderName: string;
  partyName: string;
  partyAbbr: string;
  partyColor: string;
  difficulty: string;
  onComplete: () => void;
}

export default function IntroVideo({ leaderName, partyName, partyAbbr, partyColor, difficulty, onComplete }: IntroVideoProps) {
  const lang = useLang();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completed = useRef(false);
  const [awaitingStart, setAwaitingStart] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const videoSrc = useMemo(
    () => lang === "ms" ? "/intro/my-mandat-intro-ms.mp4" : "/intro/my-mandat-intro-en.mp4",
    [lang]
  );

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  }, [onComplete]);

  const playVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video || videoFailed) return;
    try {
      await video.play();
      setAwaitingStart(false);
    } catch {
      setAwaitingStart(true);
    }
  }, [videoFailed]);

  useEffect(() => {
    completed.current = false;
    setAwaitingStart(false);
    setVideoFailed(false);
  }, [videoSrc]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && awaitingStart) void playVideo();
      if (event.key === "Escape" || event.key === " ") finish();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [awaitingStart, finish, playVideo]);

  useEffect(() => {
    void playVideo();
  }, [playVideo, videoSrc]);

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{
        background: "#02050a",
        color: "#eaf2f8",
        fontFamily: "'IBM Plex Mono', 'Space Mono', monospace",
      }}
    >
      <style>{`
        @keyframes mandat-video-scan {
          from { transform: translateY(-140px); }
          to { transform: translateY(100vh); }
        }
        @keyframes mandat-video-pulse {
          0%, 100% { opacity: .42; }
          50% { opacity: .92; }
        }
      `}</style>

      <video
        ref={videoRef}
        key={videoSrc}
        src={videoSrc}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        playsInline
        preload="auto"
        onCanPlay={() => void playVideo()}
        onEnded={finish}
        onError={() => setVideoFailed(true)}
      />

      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 50%, transparent 0%, rgba(2,5,10,.18) 52%, rgba(2,5,10,.72) 100%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "linear-gradient(rgba(63,214,227,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(63,214,227,.08) 1px, transparent 1px)", backgroundSize: "58px 58px" }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 2px, rgba(0,0,0,.18) 2px 3px)", mixBlendMode: "multiply" }} />
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-[140px]" style={{ background: "linear-gradient(180deg, rgba(63,214,227,.16), transparent)", animation: "mandat-video-scan 4.4s linear infinite" }} />

      <div className="pointer-events-none absolute left-8 top-8 h-[54px] w-[54px] border-l-2 border-t-2" style={{ borderColor: "rgba(63,214,227,.6)" }} />
      <div className="pointer-events-none absolute right-8 top-8 h-[54px] w-[54px] border-r-2 border-t-2" style={{ borderColor: "rgba(63,214,227,.6)" }} />
      <div className="pointer-events-none absolute bottom-8 left-8 h-[54px] w-[54px] border-b-2 border-l-2" style={{ borderColor: "rgba(63,214,227,.6)" }} />
      <div className="pointer-events-none absolute bottom-8 right-8 h-[54px] w-[54px] border-b-2 border-r-2" style={{ borderColor: "rgba(63,214,227,.6)" }} />

      <div className="absolute left-8 top-8 max-w-[430px] border px-4 py-3" style={{ borderColor: "rgb(var(--cyan-rgb) / .28)", background: "rgba(2,5,10,.58)", backdropFilter: "blur(8px)" }}>
        <div className="text-[10px] font-black tracking-[0.28em]" style={{ color: "var(--gold)" }}>
          {lang === "ms" ? "INTRO RASMI · VIDEO" : "OFFICIAL INTRO · VIDEO"}
        </div>
        <div className="mt-1 text-[13px] font-bold tracking-[0.18em]" style={{ color: partyColor || "#ffffff" }}>{partyAbbr || partyName || "MY MANDAT"}</div>
        <div className="mt-1 text-[10px] tracking-[0.12em]" style={{ color: "#91a6bb" }}>
          {leaderName} · {difficulty.toUpperCase()} · {lang === "ms" ? "VERSI BAHASA MELAYU" : "ENGLISH VERSION"}
        </div>
      </div>

      {(awaitingStart || videoFailed) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-6 text-center">
          <div className="max-w-xl border p-6" style={{ borderColor: "rgb(var(--gold-rgb) / .45)", background: "rgba(2,5,10,.86)", boxShadow: "0 0 42px rgb(var(--gold-rgb) / .18)" }}>
            <div className="text-[11px] font-black tracking-[0.32em]" style={{ color: "var(--gold)" }}>
              {videoFailed ? (lang === "ms" ? "VIDEO INTRO TIDAK DAPAT DIMUAT" : "INTRO VIDEO COULD NOT LOAD") : (lang === "ms" ? "KLIK UNTUK MAIN INTRO" : "CLICK TO PLAY INTRO")}
            </div>
            <div className="mt-3 text-sm leading-6" style={{ color: "#9fb0c2" }}>
              {videoFailed
                ? (lang === "ms" ? "Fail video tidak tersedia. Anda boleh terus masuk ke permainan." : "The video file is unavailable. You can continue into the game.")
                : (lang === "ms" ? "Pelayar memerlukan interaksi sebelum video dimainkan." : "The browser needs a user gesture before video playback.")}
            </div>
            {!videoFailed && (
              <button
                onClick={() => void playVideo()}
                className="mt-5 px-6 py-3 text-[12px] font-black tracking-[0.22em]"
                style={{ color: "#05080e", background: "var(--gold)", border: "1px solid rgb(var(--gold-rgb) / .8)" }}
              >
                ▶ {lang === "ms" ? "MAIN INTRO" : "PLAY INTRO"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="absolute bottom-8 right-8 flex items-center gap-3">
        <div className="text-[10px] tracking-[0.24em]" style={{ color: "#72869b", animation: "mandat-video-pulse 1.8s ease-in-out infinite" }}>
          ESC / SPACE {lang === "ms" ? "UNTUK LANGKAU" : "TO SKIP"}
        </div>
        <button
          onClick={finish}
          className="px-4 py-2 text-[10px] font-black tracking-[0.22em] transition hover:scale-[1.03]"
          style={{ color: "var(--cyan)", border: "1px solid rgb(var(--cyan-rgb) / .42)", background: "rgba(0,212,255,.08)" }}
        >
          {lang === "ms" ? "LANGKAU" : "SKIP"}
        </button>
      </div>
    </div>
  );
}
