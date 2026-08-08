"use client";
import { useUIStore, type Lang } from "../store/uiStore";
import { dictionary } from "./dictionary";

export type { Lang };

export function useLang(): Lang {
  return useUIStore((s) => s.language);
}

// Two ways to call this:
//   t(lang, "ms text", "en text")     — inline strings (legacy/simple cases)
//   t(lang, "namespace.key", vars?)   — looks up app/i18n/strings/<namespace>.ts,
//                                        interpolating {varName} placeholders
// `b` being a string means the caller passed literal ms/en text directly;
// an object (or undefined) means `a` is a dictionary key instead.
export function t(lang: Lang, a: string, b?: string | Record<string, string | number | undefined>): string {
  if (typeof b === "string") {
    return lang === "ms" ? a : b;
  }

  const dot = a.indexOf(".");
  const entry = dot === -1 ? undefined : dictionary[a.slice(0, dot)]?.[a.slice(dot + 1)];
  if (!entry) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] missing dictionary key: "${a}"`);
    }
    return a;
  }

  const raw = lang === "ms" ? entry.ms : entry.en;
  if (!b) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, key) => (key in b ? String(b[key]) : match));
}
