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
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "MY MANDAT — Malaysian Political Campaign Simulator",
  description: "Tactical election command simulator. 14 states. 222 seats. Win 112 to govern.",
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
        {children}
        <MobileGameDock />
        <DayRecap />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
