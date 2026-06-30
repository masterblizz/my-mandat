"use client";

import { useEffect, useRef, useState } from "react";
import { useUIStore } from "../../store/uiStore";

const TRACKS = [
  { id: "expedition", file: "/music/expedition.mp3", label: "EXPEDITION" },
  { id: "indream",    file: "/music/indream.mp3",    label: "IN DREAM" },
  { id: "thunder",    file: "/music/thunder.mp3",    label: "THUNDER" },
];

export default function AmbientMusic() {
  const musicEnabled  = useUIStore((s) => s.musicEnabled);
  const musicVolume   = useUIStore((s) => s.musicVolume);
  const toggleMusic   = useUIStore((s) => s.toggleMusic);
  const setMusicEnabled = useUIStore((s) => s.setMusicEnabled);

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
    if (musicEnabled && gesturedRef.current) {
      audio.play().catch(() => setError(true));
    }

    return () => { audio.pause(); audio.src = ""; };
  }, [trackIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicEnabled
        ? Math.max(0, Math.min(1, musicVolume / 100))
        : 0;
    }
  }, [musicVolume, musicEnabled]);

  // Play / pause based on store
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !gesturedRef.current) return;
    if (musicEnabled) {
      audio.volume = Math.max(0, Math.min(1, musicVolume / 100));
      audio.play().catch(() => setError(true));
    } else {
      audio.pause();
    }
  }, [musicEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // First gesture → start if enabled
  useEffect(() => {
    const onGesture = () => {
      if (gesturedRef.current) return;
      gesturedRef.current = true;
      if (musicEnabled && audioRef.current) {
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
    ? "NO FILE"
    : !ready
    ? "LOADING"
    : musicEnabled ? "ON" : "OFF";

  return (
    <div
      className="fixed bottom-[104px] right-3 z-[9998] flex items-center"
      style={{ fontFamily: "'Space Mono', monospace" }}
    >
      {/* Track switcher — only show when music is on */}
      {musicEnabled && !error && (
        <>
          <button
            onClick={prevTrack}
            className="border px-2 py-2 text-[9px] font-black transition hover:brightness-125"
            style={{
              borderColor: "rgb(var(--gold-rgb) / 0.35)",
              color: "var(--gold)",
              background: "rgba(3,8,15,.78)",
              borderRight: "none",
            }}
            title="Previous track"
          >
            ‹
          </button>
          <div
            className="border-y px-2 py-2 text-[8px] font-black tracking-[0.16em]"
            style={{
              borderColor: "rgb(var(--gold-rgb) / 0.35)",
              color: "var(--gold)",
              background: "rgba(3,8,15,.78)",
              minWidth: "86px",
              textAlign: "center",
            }}
          >
            {track.label}
          </div>
          <button
            onClick={nextTrack}
            className="border px-2 py-2 text-[9px] font-black transition hover:brightness-125"
            style={{
              borderColor: "rgb(var(--gold-rgb) / 0.35)",
              color: "var(--gold)",
              background: "rgba(3,8,15,.78)",
              borderLeft: "none",
              borderRight: "none",
            }}
            title="Next track"
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
        className="border px-3 py-2 text-[9px] font-black tracking-[0.22em] transition hover:scale-[1.03]"
        style={{
          borderColor: musicEnabled && !error
            ? "rgb(var(--gold-rgb) / 0.45)"
            : "rgb(var(--cyan-rgb) / 0.24)",
          background: musicEnabled && !error
            ? "linear-gradient(135deg, rgb(var(--gold-rgb) / 0.16), rgba(3,8,15,.86))"
            : "rgba(3,8,15,.72)",
          color: musicEnabled && !error ? "var(--gold)" : "#718397",
          boxShadow: musicEnabled && !error ? "0 0 18px rgb(var(--gold-rgb) / 0.16)" : "none",
        }}
        title="Toggle background music"
      >
        MUSIC {statusLabel}
      </button>
    </div>
  );
}
