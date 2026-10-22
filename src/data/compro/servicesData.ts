import { Plane, Ship, Truck, Package, Boxes, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { L } from "./fleetData";

export type ServiceId = "ltl" | "ftl" | "fcl" | "lcl" | "air-express" | "procargo";

export interface Service {
  id: ServiceId;
  name: string;
  fullName: L;
  icon: LucideIcon;
  mode: L;
  capacity: L;
  speed: L;
  cost: L;
  description: L;
  useCases: L[];
}

export const services: Service[] = [
  {
    id: "ltl",
    name: "LTL",
    fullName: { id: "Less Than Truckload", en: "Less Than Truckload" },
    icon: Package,
    mode: { id: "Darat", en: "Land" },
    capacity: { id: "Sebagian truk", en: "Partial truck capacity" },
    speed: { id: "Sedang", en: "Medium" },
    cost: { id: "Lebih ekonomis", en: "More economical" },
    description: {
      id: "Layanan pengiriman untuk muatan yang tidak memenuhi satu kapasitas truk penuh, dengan solusi transportasi yang lebih fleksibel dan ekonomis.",
      en: "Shipping service for cargo that does not fill a full truck capacity, with more flexible and economical transportation solutions.",
    },
    useCases: [
      { id: "Pengiriman retail dan e-commerce", en: "Retail and e-commerce shipments" },
      { id: "Distribusi barang dengan volume sedang", en: "Distribution of medium-volume goods" },
      { id: "Pengiriman antar kota reguler", en: "Regular intercity shipments" },
    ],
  },
  {
    id: "ftl",
    name: "FTL",
    fullName: { id: "Full Truckload", en: "Full Truckload" },
    icon: Truck,
    mode: { id: "Darat", en: "Land" },
    capacity: { id: "1 truk penuh", en: "Full truck" },
    speed: { id: "Cepat", en: "Fast" },
    cost: { id: "Tinggi", en: "Higher" },
    description: {
      id: "Layanan pengiriman dengan penggunaan satu armada secara penuh untuk satu pengiriman, cocok untuk muatan dengan volume besar atau kebutuhan perjalanan langsung.",
      en: "Shipping service using a full fleet for one shipment, ideal for large-volume cargo or direct transportation needs.",
    },
    useCases: [
      { id: "Pengiriman muatan besar dalam satu tujuan", en: "Large shipments to a single destination" },
      { id: "Proyek konstruksi dan industrial", en: "Construction and industrial projects" },
      { id: "Pengiriman long-haul antar pulau", en: "Long-haul inter-island shipments" },
    ],
  },
  {
    id: "fcl",
    name: "FCL",
    fullName: { id: "Full Container Load", en: "Full Container Load" },
    icon: Ship,
    mode: { id: "Laut", en: "Sea" },
    capacity: { id: "1 kontainer penuh", en: "Full container" },
    speed: { id: "Sedang", en: "Medium" },
    cost: { id: "Efisien untuk volume besar", en: "Efficient for large volumes" },
    description: {
      id: "Layanan pengiriman menggunakan satu kontainer penuh untuk kebutuhan pengiriman dengan volume besar.",
      en: "Shipping service using a full container for large-volume delivery needs.",
    },
    useCases: [
      { id: "Ekspor-impor ke seluruh dunia", en: "Export-import worldwide" },
      { id: "Pengiriman muatan besar via laut", en: "Large cargo shipments by sea" },
      { id: "Produk dalam jumlah besar dari supplier", en: "Bulk products from suppliers" },
    ],
  },
  {
    id: "lcl",
    name: "LCL",
    fullName: { id: "Less Than Container Load", en: "Less Than Container Load" },
    icon: Boxes,
    mode: { id: "Laut", en: "Sea" },
    capacity: { id: "Sebagian kontainer", en: "Partial container" },
    speed: { id: "Lebih lama", en: "Longer" },
    cost: { id: "Ekonomis untuk volume kecil", en: "Economical for small volumes" },
    description: {
      id: "Layanan pengiriman dengan penggunaan sebagian kapasitas kontainer, cocok untuk muatan yang belum memenuhi satu kontainer penuh.",
      en: "Shipping service using partial container capacity, ideal for cargo that does not fill a full container.",
    },
    useCases: [
      { id: "Pengiriman ekspor dengan volume sedang", en: "Medium-volume export shipments" },
      { id: "Konsolidasi cargo dari berbagai shipper", en: "Cargo consolidation from multiple shippers" },
      { id: "Impor barang dengan volume terbatas", en: "Limited-volume import goods" },
    ],
  },
  {
    id: "air-express",
    name: "Air Express",
    fullName: { id: "Air Express", en: "Air Express" },
    icon: Plane,
    mode: { id: "Udara", en: "Air" },
    capacity: { id: "Fleksibel", en: "Flexible" },
    speed: { id: "Sangat cepat", en: "Very fast" },
    cost: { id: "Premium", en: "Premium" },
    description: {
      id: "Layanan pengiriman melalui transportasi udara untuk kebutuhan pengiriman yang membutuhkan waktu lebih cepat.",
      en: "Air transport shipping service for deliveries requiring faster transit times.",
    },
    useCases: [
      { id: "Pengiriman urgent dan time-sensitive", en: "Urgent and time-sensitive shipments" },
      { id: "Barang bernilai tinggi dan fragile", en: "High-value and fragile items" },
      { id: "Pharmaceutical dan perishable goods", en: "Pharmaceutical and perishable goods" },
    ],
  },
  {
    id: "procargo",
    name: "Project Cargo",
    fullName: { id: "Project Cargo", en: "Project Cargo" },
    icon: Zap,
    mode: { id: "Darat/Laut/Udara", en: "Land/Sea/Air" },
    capacity: { id: "Oversize/Heavy Lift", en: "Oversize/Heavy Lift" },
    speed: { id: "Sesuai proyek", en: "Project-based" },
    cost: { id: "Khusus", en: "Custom" },
    description: {
      id: "Solusi transportasi untuk kebutuhan project cargo, oversize cargo, heavy lift, dan pengiriman khusus yang membutuhkan perencanaan serta penanganan terkoordinasi.",
      en: "Transportation solution for project cargo, oversize cargo, heavy lift, and special shipments requiring coordinated planning and handling.",
    },
    useCases: [
      { id: "Pengiriman heavy equipment dan machinery", en: "Heavy equipment and machinery transport" },
      { id: "Project cargo dengan handling khusus", en: "Project cargo with special handling" },
      { id: "Oversized dan non-standard shipments", en: "Oversized and non-standard shipments" },
    ],
  },
];

export const serviceMap = new Map(services.map((s) => [s.id, s]));

export function tr(v: L, lang: "id" | "en"): string {
  return v[lang];
}
