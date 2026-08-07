import { IBM_Plex_Mono, Inter } from "next/font/google";

// Own module for the same circular-import reason as theme.ts: AuthBackground
// needs plexMono for its capital-marker tooltips, but TacticalAuthShell
// (which imports AuthBackground) is also where these were originally
// declared — importing back from it would hit the same
// "Cannot access '...' before initialization" TDZ crash CYAN did.
export const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
export const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "700", "800"] });
