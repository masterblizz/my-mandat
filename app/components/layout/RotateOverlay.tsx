"use client";

import { useEffect } from "react";
import { t, useLang } from "../../i18n/useLang";

type LockableOrientation = ScreenOrientation & { lock?: (o: "landscape") => Promise<void> };

function lockLandscape() {
  const orientation = screen.orientation as LockableOrientation | undefined;
  orientation?.lock?.("landscape").catch(() => {
    // Most browsers only allow a lock in fullscreen or an installed app.
  });
}

/**
 * MY MANDAT plays in landscape. On a phone held upright this covers the
 * game and asks the player to turn it; CSS decides when it shows (see
 * .rotate-overlay in globals.css), so desktops and tablets never see it.
 * The Android app is locked to landscape in its manifest.
 */
export default function RotateOverlay() {
  const lang = useLang();

  // An installed app (or one already in fullscreen) can hold the lock itself.
  useEffect(() => {
    lockLandscape();
  }, []);

  const playFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
    } catch {
      // iOS Safari has no element fullscreen; the player rotates by hand.
    }
    lockLandscape();
  };

  return (
    <div className="rotate-overlay" role="dialog" aria-modal="true" aria-labelledby="rotate-title">
      <div className="rotate-overlay__phone" aria-hidden="true"><span /></div>
      <div className="rotate-overlay__eyebrow">MY MANDAT</div>
      <h2 id="rotate-title" className="rotate-overlay__title">{t(lang, "Pusingkan telefon anda", "Turn your phone sideways")}</h2>
      <p className="rotate-overlay__text">{t(lang, "Permainan ini dimainkan dalam mod landskap.", "This game is played in landscape.")}</p>
      <button type="button" className="rotate-overlay__button" onClick={playFullscreen}>
        {t(lang, "MAIN SKRIN PENUH ▸", "PLAY FULLSCREEN ▸")}
      </button>
    </div>
  );
}
