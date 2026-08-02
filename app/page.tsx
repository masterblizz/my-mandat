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
      router.replace("/kawasan");
      return;
    }
    setShowOpening(true);
  }, [router]);

  // /kawasan is the landing screen — it renders fine on pure defaults (no
  // leader/campaign yet) and now carries its own start/continue/load/
  // settings hub bar (see app/kawasan/page.tsx) covering what /menu used
  // to be the only way to reach.
  const enterLanding = () => {
    window.sessionStorage.setItem(OPENING_SEEN_KEY, "1");
    router.replace("/kawasan");
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
      onComplete={enterLanding}
    />
  );
}
