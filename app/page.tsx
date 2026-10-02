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

  const enterLanding = () => {
    window.sessionStorage.setItem(OPENING_SEEN_KEY, "1");
    router.replace("/menu");
  };

  if (!showOpening) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-4"
        style={{
          background: "#04060b",
          color: "var(--text-primary)",
          fontFamily: "'Space Mono', monospace",
        }}
      >
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-cyan/20 border-t-cyan" />
        <p className="text-[10px] font-bold tracking-[0.26em] text-cyan">MENYEDIAKAN PUSAT ARAHAN…</p>
      </main>
    );
  }

  return (
    <IntroVideo
      leaderName="COMMANDER"
      partyName="MyMandat"
      partyAbbr="MANDAT"
      partyColor="var(--cyan)"
      difficulty="normal"
      onComplete={enterLanding}
    />
  );
}
