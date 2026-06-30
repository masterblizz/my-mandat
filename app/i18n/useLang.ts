"use client";
import { useUIStore, type Lang } from "../store/uiStore";

export type { Lang };

export function useLang(): Lang {
  return useUIStore((s) => s.language);
}

export function t(lang: Lang, ms: string, en: string): string {
  return lang === "ms" ? ms : en;
}
