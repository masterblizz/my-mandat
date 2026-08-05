import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "./components/layout/ThemeProvider";
import StoreHydrator from "./components/layout/StoreHydrator";
import AutoSave from "./components/layout/AutoSave";
import AmbientMusic from "./components/layout/AmbientMusic";
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  title: "MY MANDAT — Malaysian Political Campaign Simulator",
  description: "Tactical election command simulator. 14 states. 222 seats. Win 112 to govern.",
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
        <AmbientMusic />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
