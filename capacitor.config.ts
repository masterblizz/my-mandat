import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "my.mandat.game",
  appName: "MY MANDAT",
  // The bundled page is a safe fallback. Set CAPACITOR_REMOTE_URL only for
  // internal/live testing; a store build should use the static `out` bundle.
  webDir: "mobile-web",
  android: {
    backgroundColor: "#080c14",
  },
  ...(process.env.CAPACITOR_REMOTE_URL ? {
    server: { url: process.env.CAPACITOR_REMOTE_URL },
  } : {}),
};

export default config;
