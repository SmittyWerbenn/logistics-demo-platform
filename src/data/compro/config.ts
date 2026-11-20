import type { L } from "./fleetData";
import { PULAU_KOTA } from "../ongkirData";

/**
 * ==== COMPANY PROFILE CONFIG - edit values here ====
 * Nothing here is invented: figures marked "business" come from existing
 * business-provided numbers; anything unknown is left empty/placeholder.
 */

/** Existing business-provided figures (also used earlier on the old Home). */
export const COMPANY_STATS = {
  totalShipments: "9.355+",
  citiesCovered: "50+",
  fleetUnits: "70+",
};

/** About-section highlight tiles. Replace values when actual figures change. */
export const ABOUT_STATS: { value: string; label: L }[] = [
  { value: "15+", label: { id: "Jenis Armada", en: "Fleet Types" } },
  { value: "National", label: { id: "Coverage", en: "Coverage" } },
  { value: "Real-Time", label: { id: "Tracking", en: "Tracking" } },
  { value: "Professional", label: { id: "Operations", en: "Operations" } },
];

/** Fleet statistics band. `capacityTon` / `trailerFt` are derived from fleetData in the UI where possible. */
export const FLEET_STATS_CONFIG = {
  fleetTypes: "15+",
  maxCapacity: "28 Ton",
  trailer: "40 FT",
  coverage: "National",
};

/** Hero / section photos. Put real photos in /public/images and set the path here. */
export const SITE_IMAGES = {
  about: "" as string, // e.g. "/images/about-team.jpg"
};
/** Social links. Leave empty to hide. */
export const SOCIAL_LINKS: { label: string; url: string }[] = [];

/** Coverage grouped by island, from the existing master city data. */
export function coverageByIsland(): { island: string; cities: string[] }[] {
  const map = new Map<string, string[]>();
  for (const [city, island] of Object.entries(PULAU_KOTA)) {
    map.set(island, [...(map.get(island) ?? []), city]);
  }
  return [...map.entries()].map(([island, cities]) => ({ island, cities }));
}

export const SITE_URL = "https://gms-logistics.id";
