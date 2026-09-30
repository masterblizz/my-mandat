"use client";

import { useEffect, useState } from "react";
import { t, useLang } from "../../i18n/useLang";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Registers the offline shell and exposes the browser's native install flow. */
export default function MobileAppShell() {
  const lang = useLang();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {
        // A failed offline cache must never block the game from loading.
      });
    }

    const standalone = window.matchMedia("(display-mode: standalone)");
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    setInstalled(standalone.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    standalone.addEventListener("change", onInstalled);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      standalone.removeEventListener("change", onInstalled);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  };

  if (installed || !installPrompt) return null;

  return (
    <button type="button" className="mobile-install-game" onClick={install}>
      <span aria-hidden="true">↓</span>
      {t(lang, "Pasang Game", "Install Game")}
    </button>
  );
}
