import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "./components/layout/ThemeProvider";
import StoreHydrator from "./components/layout/StoreHydrator";
import JourneyGuard from "./components/layout/JourneyGuard";
import AutoSave from "./components/layout/AutoSave";
import AmbientMusic from "./components/layout/AmbientMusic";
import DayRecap from "./components/layout/DayRecap";
import PlayerProgressTracker from "./components/layout/PlayerProgressTracker";
import MobileGameDock from "./components/layout/MobileGameDock";
import RotateOverlay from "./components/layout/RotateOverlay";
import MobileAppShell from "./components/layout/MobileAppShell";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "MY MANDAT — Malaysian Political Simulator",
  description: "Serve your seat as a YB for five years, then defend it at the next election. 222 Parliament and 600 DUN seats, real census data.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MY MANDAT" },
  icons: { apple: "/logo-peti-undi.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#080c14",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ background: "var(--bg)", fontFamily: "'Space Mono', 'JetBrains Mono', monospace" }}>
        <ThemeProvider />
        <StoreHydrator />
        <AutoSave />
        <PlayerProgressTracker />
        <JourneyGuard />
        <AmbientMusic />
        <MobileAppShell />
        {children}
        <MobileGameDock />
        <RotateOverlay />
        <DayRecap />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
