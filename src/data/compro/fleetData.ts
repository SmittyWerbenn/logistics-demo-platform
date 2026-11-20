import type { Language } from "../translations";
import { fleetAssets } from "./assetsMap";

/** Bilingual text. */
export type L = { id: string; en: string };
export const tr = (v: L, lang: Language) => v[lang];

export type FleetGroup =
  | "pickup"
  | "blindvan"
  | "cde"
  | "cdd"
  | "fuso"
  | "tronton"
  | "reefer"
  | "trailer"
  | "heavy";

export type TruckArtKind =
  | "pickup"
  | "van"
  | "cde"
  | "cdd"
  | "fuso"
  | "tronton"
  | "reefer"
  | "trailer"
  | "lowbed";

/** One concrete, supplier-confirmed spec row (shown only when data exists). */
export interface FleetSpec {
  label: string;
  tires: number;
  dimensions: string; // P x L x T (meter)
  capacity: string;
  volume: string;
}

export interface FleetItem {
  id: string;
  name: string;
  group: FleetGroup;
  /** Length range label, e.g. "6 – 9 Meter". Omit when not defined. */
  length?: L;
  bodyTypes: string[];
  /** Verified spec rows. Leave empty when technical data is not available yet. */
  specs: FleetSpec[];
  /** Photo path (e.g. "/fleet/fuso.jpg" in /public). When empty, a vector placeholder is drawn. */
  image?: string;
  art: TruckArtKind;
  description: L;
  useCases: L[];
  /** Navy + gold treatment. */
  heavy?: boolean;
}

/**
 * ==== FLEET DATA - edit here only ====
 * Add / change a vehicle by editing this array; the UI (cards, filter,
 * search, detail modal, finder) is fully data-driven.
 * Do NOT invent specs: leave `specs: []` until real data is available.
 */
export const fleetData: FleetItem[] = [
  {
    id: "pickup",
    name: "Pickup",
    group: "pickup",
    bodyTypes: ["Bak", "Box"],
    specs: [{ label: "Pickup", tires: 4, dimensions: "2.8 x 1.6 x 1.5", capacity: "1.5 Ton", volume: "6 CBM" }],
    art: "pickup",
    description: {
      id: "Armada ringan yang lincah untuk pengiriman barang berukuran kecil hingga menengah.",
      en: "Agile light vehicle for small to medium-sized shipments.",
    },
    useCases: [
      { id: "Barang umum volume kecil", en: "Small-volume general cargo" },
      { id: "Pengiriman dalam kota", en: "Intra-city delivery" },
    ],
  },
  {
    id: "blind-van",
    name: "Blind Van",
    group: "blindvan",
    bodyTypes: ["Blind Van"],
    specs: [{ label: "Van", tires: 4, dimensions: "2.5 x 1.5 x 1.5", capacity: "1 Ton", volume: "4 CBM" }],
    art: "van",
    description: {
      id: "Ruang muat tertutup untuk barang yang perlu terlindung dari cuaca.",
      en: "Enclosed cargo space for goods that need protection from the weather.",
    },
    useCases: [
      { id: "Paket dan barang tertutup", en: "Parcels and enclosed cargo" },
      { id: "Distribusi dalam kota", en: "City distribution" },
    ],
  },
  {
    id: "cde",
    name: "CDE",
    group: "cde",
    bodyTypes: ["Bak", "Box", "Treway"],
    specs: [
      { label: "CDE Bak", tires: 4, dimensions: "3.5 x 1.8 x 1.6", capacity: "3 Ton", volume: "10 CBM" },
      { label: "CDE Box", tires: 4, dimensions: "3.5 x 1.8 x 1.7", capacity: "3 Ton", volume: "11 CBM" },
    ],
    art: "cde",
    description: {
      id: "Pilihan menengah untuk distribusi barang dengan beragam jenis body.",
      en: "Mid-size option for distribution with multiple body types.",
    },
    useCases: [
      { id: "Distribusi barang umum", en: "General cargo distribution" },
      { id: "Pengiriman antar kota", en: "Intercity delivery" },
    ],
  },
  {
    id: "cde-long",
    name: "CDE Long",
    group: "cde",
    bodyTypes: ["Bak", "Box"],
    specs: [{ label: "CDE Long", tires: 4, dimensions: "4.5 x 1.8 x 1.8", capacity: "3.5 Ton", volume: "14 CBM" }],
    art: "cde",
    description: {
      id: "Versi bak lebih panjang untuk muatan yang membutuhkan ruang lebih.",
      en: "Longer body version for loads that need more space.",
    },
    useCases: [
      { id: "Barang umum volume sedang", en: "Medium-volume general cargo" },
      { id: "Distribusi ritel", en: "Retail distribution" },
    ],
  },
  {
    id: "cdd",
    name: "CDD",
    group: "cdd",
    bodyTypes: ["Bak", "Box", "Treway", "Losbak"],
    specs: [
      { label: "CDD Box", tires: 6, dimensions: "5.0 x 2.0 x 2.0", capacity: "5 Ton", volume: "20 CBM" },
      { label: "CDD Bak", tires: 6, dimensions: "5.0 x 2.0 x 1.8", capacity: "5 Ton", volume: "18 CBM" },
    ],
    art: "cdd",
    description: {
      id: "Armada serbaguna untuk pengiriman reguler dengan kapasitas menengah.",
      en: "Versatile vehicle for regular shipments at medium capacity.",
    },
    useCases: [
      { id: "Pengiriman reguler antar kota", en: "Regular intercity shipments" },
      { id: "Distribusi barang umum", en: "General cargo distribution" },
    ],
  },
  {
    id: "cdd-long",
    name: "CDD Long",
    group: "cdd",
    bodyTypes: ["Bak", "Box", "Treway", "Losbak", "Wingbox (WB)"],
    specs: [{ label: "CDD Long", tires: 6, dimensions: "6.0 x 2.0 x 1.8", capacity: "6 Ton", volume: "24 CBM" }],
    art: "cdd",
    description: {
      id: "Ruang muat lebih panjang dengan pilihan body paling lengkap, termasuk Wingbox.",
      en: "Longer cargo space with the widest body options, including Wingbox.",
    },
    useCases: [
      { id: "Barang volume besar", en: "Large-volume cargo" },
      { id: "Bongkar muat samping (Wingbox)", en: "Side loading (Wingbox)" },
    ],
  },
  {
    id: "fuso",
    name: "Fuso",
    group: "fuso",
    length: { id: "6 – 9 Meter", en: "6 – 9 Meters" },
    bodyTypes: ["Bak", "Box", "Losbak", "Wingbox (WB)", "Treway"],
    specs: [
      { label: "Fuso 6M", tires: 6, dimensions: "6.0 x 2.2 x 2.2", capacity: "8 Ton", volume: "29 CBM" },
      { label: "Fuso 10M", tires: 6, dimensions: "9.5 x 2.4 x 2.2", capacity: "10 Ton", volume: "40 CBM" },
    ],
    art: "fuso",
    description: {
      id: "Armada kapasitas besar untuk pengiriman antar kota dengan volume tinggi.",
      en: "High-capacity vehicle for large-volume intercity shipments.",
    },
    useCases: [
      { id: "General Cargo", en: "General Cargo" },
      { id: "Distribusi", en: "Distribution" },
      { id: "Barang volume besar", en: "Large-volume cargo" },
      { id: "Pengiriman antar kota", en: "Intercity delivery" },
    ],
  },
  {
    id: "tronton",
    name: "Tronton",
    group: "tronton",
    length: { id: "9 – 10 Meter", en: "9 – 10 Meters" },
    bodyTypes: ["Bak", "Box", "Wingbox (WB)", "Treway", "Losbak"],
    specs: [
      { label: "Tronton 10M", tires: 10, dimensions: "9.5 x 2.4 x 2.2", capacity: "15 Ton", volume: "50 CBM" },
      { label: "Tronton Wingbox 12M", tires: 10, dimensions: "12.0 x 2.4 x 2.5", capacity: "22 Ton", volume: "72 CBM" },
    ],
    art: "tronton",
    description: {
      id: "Kapasitas tinggi untuk muatan berat dan volume besar pada rute jarak jauh.",
      en: "High capacity for heavy, large-volume loads on long routes.",
    },
    useCases: [
      { id: "Barang berat", en: "Heavy cargo" },
      { id: "Pengiriman jarak jauh", en: "Long-distance delivery" },
      { id: "Muatan volume besar", en: "Large-volume loads" },
    ],
  },
  {
    id: "tronton-reefer",
    name: "Tronton Reefer",
    group: "reefer",
    length: { id: "9 Meter", en: "9 Meters" },
    bodyTypes: ["Reefer"],
    specs: [],
    art: "reefer",
    description: {
      id: "Armada berpendingin untuk muatan yang membutuhkan kontrol suhu.",
      en: "Refrigerated vehicle for loads that require temperature control.",
    },
    useCases: [
      { id: "Muatan berpendingin", en: "Temperature-controlled cargo" },
      { id: "Special Transportation", en: "Special Transportation" },
    ],
  },
  {
    id: "trailer",
    name: "Trailer",
    group: "trailer",
    bodyTypes: ["20 Feet Flatbed", "40 Feet Flatbed", "Flatbed + Container"],
    specs: [
      { label: "Trailer 40FT Flatbed", tires: 12, dimensions: "12.0 x 2.4 x 2.6", capacity: "28 Ton", volume: "85 CBM" },
    ],
    art: "trailer",
    description: {
      id: "Pengangkut container dan muatan panjang dengan kapasitas terbesar.",
      en: "Container and long-load carrier with the largest capacity.",
    },
    useCases: [
      { id: "Container Transportation", en: "Container Transportation" },
      { id: "Project Cargo", en: "Project Cargo" },
      { id: "Muatan berat dan panjang", en: "Heavy and long cargo" },
    ],
  },
  {
    id: "heavy-haul",
    name: "Lowbed / Dolly / Multi Axle",
    group: "heavy",
    bodyTypes: ["Lowbed", "Dolly", "Multi Axle"],
    specs: [],
    art: "lowbed",
    heavy: true,
    description: {
      id: "Solusi transportasi khusus untuk muatan di luar dimensi dan bobot standar.",
      en: "Special transport for cargo beyond standard dimensions and weight.",
    },
    useCases: [
      { id: "Heavy Cargo", en: "Heavy Cargo" },
      { id: "Oversize Cargo", en: "Oversize Cargo" },
      { id: "Special Transportation", en: "Special Transportation" },
      { id: "Project Cargo", en: "Project Cargo" },
    ],
  },
];

/** One concrete vehicle photo = one card. Order: light -> heavy. Capacity / length
 * on the card come from the fleetData items of the same group (no duplicated specs). */
export interface FleetVehicle {
  id: string;
  group: FleetGroup;
  name: string;
  /** Body label(s) shown as badges / in the detail gallery. */
  bodies: string[];
  src: string;
  alt: string;
}

const v = (id: string, group: FleetGroup, name: string, bodies: string[], file: keyof typeof fleetAssets): FleetVehicle => ({
  id,
  group,
  name,
  bodies,
  src: fleetAssets[file],
  alt: `Armada ${name} GMS Logistics`,
});

export const fleetVehicles: FleetVehicle[] = [
  v("pickup-bak", "pickup", "Pickup Bak", ["Bak"], "pickup-bak"),
  v("pickup-box", "pickup", "Pickup Box", ["Box"], "pickup-box"),
  v("blind-van", "blindvan", "Blind Van", ["Blind Van"], "blind-van"),
  v("cde-bak-triway", "cde", "CDE Bak Triway", ["Bak", "Triway"], "cde-bak-triway"),
  v("cdd-bak-sentral", "cdd", "CDD Bak Sentral", ["Bak"], "cdd-bak-sentral"),
  v("cdd-triway", "cdd", "CDD Triway", ["Triway"], "cdd-bak-triway"),
  v("cdd-box-long", "cdd", "CDD Box Long", ["Box"], "cdd-box-long"),
  v("cdd-losbak", "cdd", "CDD Losbak", ["Losbak"], "cdd-losbak"),
  v("cdd-wingbox", "cdd", "CDD Wingbox", ["Wingbox"], "cdd-wingbox"),
  v("fuso-box", "fuso", "Fuso Box", ["Box"], "fuso-box"),
  v("fuso-triway", "fuso", "Fuso Triway", ["Triway"], "fuso-triway"),
  v("fuso-losbak", "fuso", "Fuso Losbak", ["Losbak"], "fuso-losbak"),
  v("fuso-wingbox", "fuso", "Fuso Wingbox", ["Wingbox"], "fuso-wingbox"),
  v("tronton-bak-triway", "tronton", "Tronton Bak Triway", ["Bak", "Triway"], "tronton-bak-triway"),
  v("tronton-losbak", "tronton", "Tronton Losbak", ["Losbak"], "tronton-losbak"),
  v("tronton-wingbox", "tronton", "Tronton Wingbox", ["Wingbox"], "tronton-wingbox"),
  v("fuso-reefer", "reefer", "Fuso Reefer Thermo King", ["Reefer"], "fuso-refer-termoking"),
  v("tronton-reefer", "reefer", "Tronton Reefer Thermo King", ["Reefer"], "tronton-refer-termoking"),
  v("trailer-20ft", "trailer", "Trailer 20 Feet", ["20 Feet Flatbed"], "trailer-20ft"),
  v("trailer-40ft", "trailer", "Trailer 40 Feet", ["40 Feet Flatbed"], "trailer-40ft"),
  v("trailer-big-mama", "trailer", "Trailer Big Mama Wingbox", ["Wingbox"], "trailer-big-mama-wingbox"),
  v("lowbed", "heavy", "Lowbed", ["Lowbed"], "lowbed"),
  v("dolly", "heavy", "Dolly", ["Dolly"], "dolly"),
];

/** Group meta used by the detail dialog (gallery = every vehicle of the group). */
export interface FleetCategory {
  group: FleetGroup;
  name: string;
  hero: string;
  alt: string;
  variants: { label: string; src: string }[];
}

const GROUP_NAMES: Record<FleetGroup, string> = {
  pickup: "Pickup",
  blindvan: "Blind Van",
  cde: "CDE",
  cdd: "CDD",
  fuso: "Fuso",
  tronton: "Tronton",
  reefer: "Reefer",
  trailer: "Trailer",
  heavy: "Heavy Haul",
};

export const fleetCategories: FleetCategory[] = (Object.keys(GROUP_NAMES) as FleetGroup[]).map((group) => {
  const vs = fleetVehicles.filter((x) => x.group === group);
  return { group, name: GROUP_NAMES[group], hero: vs[0].src, alt: `Armada ${GROUP_NAMES[group]} GMS Logistics`, variants: vs.map((x) => ({ label: x.name, src: x.src })) };
});

/** Filter tabs (order = display order). */
export const fleetFilters: { id: "all" | FleetGroup; label: L }[] = [
  { id: "all", label: { id: "Semua", en: "All" } },
  { id: "pickup", label: { id: "Pickup", en: "Pickup" } },
  { id: "blindvan", label: { id: "Blind Van", en: "Blind Van" } },
  { id: "cde", label: { id: "CDE", en: "CDE" } },
  { id: "cdd", label: { id: "CDD", en: "CDD" } },
  { id: "fuso", label: { id: "Fuso", en: "Fuso" } },
  { id: "tronton", label: { id: "Tronton", en: "Tronton" } },
  { id: "reefer", label: { id: "Reefer", en: "Reefer" } },
  { id: "trailer", label: { id: "Trailer", en: "Trailer" } },
  { id: "heavy", label: { id: "Heavy Haul", en: "Heavy Haul" } },
];

/** Quick Fleet Finder: cargo type -> relevant fleet groups (only from the categories above). */
export const cargoTypes: { id: string; label: L; groups: FleetGroup[] }[] = [
  { id: "general", label: { id: "Barang Umum", en: "General Cargo" }, groups: ["pickup", "blindvan", "cde", "cdd", "fuso"] },
  { id: "large", label: { id: "Barang Besar", en: "Large Cargo" }, groups: ["fuso", "tronton", "trailer"] },
  { id: "heavy", label: { id: "Barang Berat", en: "Heavy Goods" }, groups: ["tronton", "trailer", "heavy"] },
  { id: "container", label: { id: "Container", en: "Container" }, groups: ["trailer"] },
  { id: "project", label: { id: "Project Cargo", en: "Project Cargo" }, groups: ["trailer", "heavy"] },
  { id: "heavycargo", label: { id: "Heavy Cargo", en: "Heavy Cargo" }, groups: ["heavy"] },
  { id: "special", label: { id: "Special Cargo", en: "Special Cargo" }, groups: ["reefer", "heavy"] },
];

/** Numeric helper: "1.5 Ton" -> 1.5 */
export function parseTon(capacity: string): number {
  return parseFloat(capacity);
}

/** Capacity range summary for a card, derived from verified specs only. */
export function capacitySummary(item: FleetItem): string | null {
  if (item.specs.length === 0) return null;
  const tons = item.specs.map((s) => parseTon(s.capacity));
  const min = Math.min(...tons);
  const max = Math.max(...tons);
  return min === max ? `${max} Ton` : `${min} – ${max} Ton`;
}

export function maxCapacityTon(): number {
  return Math.max(...fleetData.flatMap((f) => f.specs.map((s) => parseTon(s.capacity))));
}
