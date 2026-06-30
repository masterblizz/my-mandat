import { create } from "zustand";

export type Lang = "en" | "ms";

interface UIState {
  theme: "dark" | "light";
  language: Lang;
  musicEnabled: boolean;
  musicVolume: number;
  setTheme: (theme: "dark" | "light") => void;
  setLanguage: (language: Lang) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  toggleMusic: () => void;
}

// Default state — StoreHydrator in layout.tsx reads localStorage after mount
export const useUIStore = create<UIState>()((set) => ({
  theme: "dark",
  language: "ms" as Lang,
  musicEnabled: true,
  musicVolume: 42,
  setTheme: (theme) => {
    if (typeof window !== "undefined") localStorage.setItem("mandat-theme", theme);
    set({ theme });
  },
  setLanguage: (language) => {
    if (typeof window !== "undefined") localStorage.setItem("mandat-lang", language);
    set({ language });
  },
  setMusicEnabled: (enabled) => {
    if (typeof window !== "undefined") localStorage.setItem("mandat-music-enabled", String(enabled));
    set({ musicEnabled: enabled });
  },
  setMusicVolume: (volume) => {
    const next = Math.max(0, Math.min(100, volume));
    if (typeof window !== "undefined") localStorage.setItem("mandat-music-volume", String(next));
    set({ musicVolume: next });
  },
  toggleMusic: () =>
    set((state) => {
      const next = !state.musicEnabled;
      if (typeof window !== "undefined") localStorage.setItem("mandat-music-enabled", String(next));
      return { musicEnabled: next };
    }),
}));
