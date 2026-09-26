"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useUIStore } from "../../store/uiStore";
import { useLang, t } from "../../i18n/useLang";

const TRACKS = [
  { id: "expedition", file: "/music/expedition.mp3", label: "EXPEDITION" },
  { id: "indream",    file: "/music/indream.mp3",    label: "IN DREAM" },
  { id: "thunder",    file: "/music/thunder.mp3",    label: "THUNDER" },
];

export default function AmbientMusic() {
  const lang = useLang();
  const musicEnabled  = useUIStore((s) => s.musicEnabled);
  const musicVolume   = useUIStore((s) => s.musicVolume);
  const toggleMusic   = useUIStore((s) => s.toggleMusic);
  const setMusicEnabled = useUIStore((s) => s.setMusicEnabled);

  // The 3D kawasan map has its own procedural city soundscape (horns, LRT,
  // traffic — see citySound.ts) which would otherwise play underneath this
  // background music. Suppress the track (and hide this widget) on that
  // route rather than touching musicEnabled/localStorage, so the player's
  // actual music preference is untouched and comes right back elsewhere.
  const pathname = usePathname();
  const suppressed = pathname?.startsWith("/kawasan") ?? false;
  const effectiveEnabled = musicEnabled && !suppressed;

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const [trackIdx, setTrackIdx]   = useState(0);
  const [ready, setReady]         = useState(false);
  const [error, setError]         = useState(false);
  const gesturedRef = useRef(false);

  const track = TRACKS[trackIdx];

  // Create / recreate audio element when track changes
  useEffect(() => {
    const prev = audioRef.current;
    if (prev) { prev.pause(); prev.src = ""; }

    const audio = new Audio(track.file);
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(1, musicVolume / 100));
    audio.preload = "auto";
    audio.oncanplaythrough = () => { setReady(true); setError(false); };
    audio.onerror = () => { setError(true); setReady(false); };
    audioRef.current = audio;

    // If already enabled + user has gestured, start playing immediately
    if (effectiveEnabled && gesturedRef.current) {
      audio.play().catch(() => setError(true));
    }

    return () => { audio.pause(); audio.src = ""; };
  }, [trackIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = effectiveEnabled
        ? Math.max(0, Math.min(1, musicVolume / 100))
        : 0;
    }
  }, [musicVolume, effectiveEnabled]);

  // Play / pause based on store (and on entering/leaving the suppressed
  // /kawasan route, so its own city soundscape doesn't play underneath this).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !gesturedRef.current) return;
    if (effectiveEnabled) {
      audio.volume = Math.max(0, Math.min(1, musicVolume / 100));
      audio.play().catch(() => setError(true));
    } else {
      audio.pause();
    }
  }, [effectiveEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // First gesture → start if enabled
  useEffect(() => {
    const onGesture = () => {
      if (gesturedRef.current) return;
      gesturedRef.current = true;
      if (effectiveEnabled && audioRef.current) {
        audioRef.current.volume = Math.max(0, Math.min(1, musicVolume / 100));
        audioRef.current.play().catch(() => setError(true));
      }
    };
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  const prevTrack = () => {
    setTrackIdx((i) => (i - 1 + TRACKS.length) % TRACKS.length);
    setReady(false);
  };
  const nextTrack = () => {
    setTrackIdx((i) => (i + 1) % TRACKS.length);
    setReady(false);
  };

  const statusLabel = error
    ? t(lang, "components_layout_AmbientMusic.noFile")
    : !ready
    ? t(lang, "components_layout_AmbientMusic.loading")
    : musicEnabled ? t(lang, "components_layout_AmbientMusic.on") : t(lang, "components_layout_AmbientMusic.off");

  // Hidden on /kawasan — the city's own soundscape (horns/LRT/traffic)
  // is the audio there; the toggle/track-switcher would otherwise sit on
  // screen controlling a track that's deliberately silent.
  // A missing optional audio asset is not useful player-facing information.
  // Hide the widget rather than exposing the technical "NO FILE" state.
  // It will retry cleanly on the next route load.
  if (suppressed || error) return null;

  return (
    <div
      className="fixed bottom-1 right-3 z-[60] flex items-center"
      style={{ fontFamily: "'Space Mono', monospace" }}
    >
      {/* Track switcher — only show when music is on */}
      {musicEnabled && !error && (
        <>
          <button
            onClick={prevTrack}
            className="border px-2 py-1.5 text-[9px] font-black transition hover:brightness-125"
            style={{
              borderColor: "rgb(var(--gold-rgb) / 0.35)",
              color: "var(--gold)",
              background: "rgb(var(--bg-rgb) / 0.78)",
              borderRight: "none",
            }}
            title={t(lang, "components_layout_AmbientMusic.previousTrack")}
          >
            ‹
          </button>
          <div
            className="border-y px-2 py-1.5 text-[8px] font-black tracking-[0.16em]"
            style={{
              borderColor: "rgb(var(--gold-rgb) / 0.35)",
              color: "var(--gold)",
              background: "rgb(var(--bg-rgb) / 0.78)",
              minWidth: "86px",
              textAlign: "center",
            }}
          >
            {track.label}
          </div>
          <button
            onClick={nextTrack}
            className="border px-2 py-1.5 text-[9px] font-black transition hover:brightness-125"
            style={{
              borderColor: "rgb(var(--gold-rgb) / 0.35)",
              color: "var(--gold)",
              background: "rgb(var(--bg-rgb) / 0.78)",
              borderLeft: "none",
              borderRight: "none",
            }}
            title={t(lang, "components_layout_AmbientMusic.nextTrack")}
          >
            ›
          </button>
        </>
      )}

      {/* Main toggle button */}
      <button
        type="button"
        onClick={() => {
          if (!musicEnabled) {
            setMusicEnabled(true);
            // Trigger gesture manually so it plays immediately
            if (!gesturedRef.current) {
              gesturedRef.current = true;
            }
            if (audioRef.current) {
              audioRef.current.volume = Math.max(0, Math.min(1, musicVolume / 100));
              audioRef.current.play().catch(() => setError(true));
            }
          } else {
            toggleMusic();
          }
        }}
        className="border px-3 py-1.5 text-[9px] font-black tracking-[0.22em] transition hover:scale-[1.03]"
        style={{
          borderColor: musicEnabled && !error
            ? "rgb(var(--gold-rgb) / 0.45)"
            : "rgb(var(--cyan-rgb) / 0.24)",
          background: musicEnabled && !error
            ? "linear-gradient(135deg, rgb(var(--gold-rgb) / 0.16), rgb(var(--bg-rgb) / 0.86))"
            : "rgb(var(--bg-rgb) / 0.72)",
          color: musicEnabled && !error ? "var(--gold)" : "var(--text-muted)",
          boxShadow: musicEnabled && !error ? "0 0 18px rgb(var(--gold-rgb) / 0.16)" : "none",
        }}
        title={t(lang, "components_layout_AmbientMusic.toggleBackgroundMusic")}
      >
        {t(lang, "components_layout_AmbientMusic.music")} {statusLabel}
      </button>
    </div>
  );
}
