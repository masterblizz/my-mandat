"use client";

import { useLang, t } from "../i18n/useLang";
import { useCityDestinations, type CityDestination } from "./CityDestinations";

// Short HUD labels; the full name and detail live in the tooltip.
const SHORT: Record<string, { ms: string; en: string }> = {
  office: { ms: "Pejabat", en: "Office" },
  party: { ms: "Parti", en: "Party HQ" },
  operations: { ms: "War Room", en: "War Room" },
  calendar: { ms: "Jadual", en: "Calendar" },
  media: { ms: "Media", en: "Media" },
  commission: { ms: "Tinjauan", en: "Polls" },
  cabinet: { ms: "Kabinet", en: "Cabinet" },
  administration: { ms: "Pentadbiran", en: "Admin" },
  national: { ms: "Negara", en: "Nation" },
  report: { ms: "Rekod", en: "Record" },
  continue: { ms: "Teruskan", en: "Continue" },
};

/**
 * The city is the game hub: this bar keeps every room of the current
 * chapter one tap away, so the player never has to leave the kawasan to
 * find the next screen. The map markers (📍) remain for exploring.
 */
export default function CityHubBar({ onEnter }: { onEnter: (destination: CityDestination) => void }) {
  const lang = useLang();
  const destinations = useCityDestinations();
  if (!destinations.length) return null;
  return (
    <nav className="city-hub-bar city-hud-box" aria-label={t(lang, "Hub bandar", "City hub")}>
      <span className="city-hub-bar__tag" aria-hidden>HUB</span>
      <div className="city-hub-bar__track">
        {destinations.map((destination) => {
          const copy = destination[lang];
          const short = SHORT[destination.id]?.[lang] ?? copy.name;
          const primary = destination.id === "continue";
          return (
            <button
              key={destination.id}
              type="button"
              onClick={() => onEnter(destination)}
              title={`${copy.name} — ${copy.detail}`}
              aria-label={copy.name}
              data-hub={destination.id}
              className={`city-hub-bar__item${primary ? " city-hub-bar__item--primary" : ""}`}
            >
              <span className="city-hub-bar__icon" aria-hidden>{destination.icon}</span>
              <span className="city-hub-bar__label">{short}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
