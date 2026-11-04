"use client";

import { t, type Lang } from "../i18n/useLang";

type ZoneLike = { kind: string; sentiment: number };

// Zone kinds grouped into the four things a representative watches.
const GROUPS: { id: string; icon: string; ms: string; en: string; kinds: string[] }[] = [
  { id: "home", icon: "🏘️", ms: "Perumahan", en: "Housing", kinds: ["housing", "village"] },
  { id: "trade", icon: "🏪", ms: "Niaga", en: "Business", kinds: ["commercial", "urban", "market"] },
  { id: "work", icon: "🏭", ms: "Industri", en: "Industry", kinds: ["industry"] },
  { id: "people", icon: "🏫", ms: "Komuniti", en: "Community", kinds: ["education", "community", "river"] },
];

const tone = (v: number) => (v >= 60 ? "#5be39a" : v >= 45 ? "#f2b01e" : "#e8603c");

/**
 * Thin strip along the top of the city: residents' mood for each part of
 * the constituency (average zone sentiment), like a city builder's demand
 * meters. Read-only; never takes input.
 */
export default function CityPulseBar({ zones, lang }: { zones: ZoneLike[]; lang: Lang }) {
  const rows = GROUPS.map((group) => {
    const list = zones.filter((zone) => group.kinds.includes(zone.kind));
    const value = list.length ? Math.round(list.reduce((sum, zone) => sum + zone.sentiment, 0) / list.length) : null;
    return { ...group, value };
  }).filter((row) => row.value !== null) as (typeof GROUPS[number] & { value: number })[];
  if (!rows.length) return null;
  return (
    <div className="city-pulse-bar city-hud-box pointer-events-none" aria-label={t(lang, "Sentimen kawasan", "Constituency mood")}>
      {rows.map((row) => (
        <div key={row.id} className="city-pulse-bar__item" title={`${t(lang, row.ms, row.en)} ${row.value}`}>
          <span aria-hidden className="city-pulse-bar__icon">{row.icon}</span>
          <span className="city-pulse-bar__label">{t(lang, row.ms, row.en)}</span>
          <span className="city-pulse-bar__track">
            <span className="city-pulse-bar__fill" style={{ width: `${row.value}%`, background: tone(row.value) }} />
            <span className="city-pulse-bar__mid" />
          </span>
          <b style={{ color: tone(row.value) }}>{row.value}</b>
        </div>
      ))}
    </div>
  );
}
