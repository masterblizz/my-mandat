"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import IntroVideo from "./components/ui/IntroVideo";

const OPENING_SEEN_KEY = "mymandat-opening-seen";

export default function Home() {
  const router = useRouter();
  const [showOpening, setShowOpening] = useState(false);

  useEffect(() => {
    const hasSeenOpening = window.sessionStorage.getItem(OPENING_SEEN_KEY) === "1";
    if (hasSeenOpening) {
      router.replace("/menu");
      return;
    }
    setShowOpening(true);
  }, [router]);

  const enterMainMenu = () => {
    window.sessionStorage.setItem(OPENING_SEEN_KEY, "1");
    router.replace("/menu");
  };

  if (!showOpening) {
    return (
      <main
        className="min-h-screen"
        style={{
          background: "#04060b",
          color: "var(--text-primary)",
        }}
      />
    );
  }

  return (
    <IntroVideo
      leaderName="COMMANDER"
      partyName="MyMandat"
      partyAbbr="MANDAT"
      partyColor="var(--cyan)"
      difficulty="normal"
      onComplete={enterMainMenu}
    />
  );
}
