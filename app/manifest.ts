import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MY MANDAT",
    short_name: "MY MANDAT",
    description: "Malaysian political strategy game.",
    start_url: "/",
    display: "standalone",
    background_color: "#080c14",
    theme_color: "#080c14",
    orientation: "portrait-primary",
    categories: ["games", "strategy", "simulation"],
    icons: [
      { src: "/logo-peti-undi.png", sizes: "any", type: "image/png", purpose: "maskable" },
    ],
  };
}
