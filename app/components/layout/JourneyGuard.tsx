"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGameStore } from "../../store/gameStore";
import { resumeRoute } from "../../store/journey";

export default function JourneyGuard() {
  const pathname = usePathname(), router = useRouter();
  const game = useGameStore();
  useEffect(() => {
    if (game.phase !== "playing" && game.phase !== "ended") return;
    if (game.day >= game.totalDays && game.journey.chapter === "campaign") {
      game.finishElection();
      return;
    }
    const postElection = ["/results", "/elected", "/mandate", "/formation", "/cabinet", "/swearing-in"];
    if (game.day < game.totalDays && postElection.includes(pathname)) router.replace("/warroom");
    if (["government", "opposition", "rebuilding"].includes(game.journey.chapter) && ["/warroom", "/campaign", "/messaging"].includes(pathname)) router.replace(resumeRoute(game));
    if (["/cabinet", "/swearing-in"].includes(pathname) && !game.journey.coalitionConfirmed) router.replace("/formation");
  }, [game.day, game.totalDays, game.phase, game.journey.chapter, game.journey.coalitionConfirmed, pathname, router]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
