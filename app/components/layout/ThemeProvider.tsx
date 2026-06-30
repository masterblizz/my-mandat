"use client";
import { useEffect } from "react";
import { useUIStore } from "../../store/uiStore";

export default function ThemeProvider() {
  const { theme } = useUIStore();

  // Apply/remove data-theme attribute whenever theme changes
  useEffect(() => {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [theme]);

  return null;
}
