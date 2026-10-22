import { ClipboardList, Navigation, PackageCheck, Smartphone, Truck, Warehouse, type LucideIcon } from "lucide-react";
import { COMPRO_IMAGES } from "./imagesData";
import type { L } from "./fleetData";

export interface JourneyStep {
  id: "order" | "pickup" | "transit" | "update" | "arrived" | "delivered";
  /** Short timeline label */
  short: L;
  title: L;
  description: L;
  /** Status badge text (system status wording). */
  status: string;
  /** Photo path in /public (e.g. "/journey/order.jpg"). Empty -> branded illustration. */
  image?: string;
  imageAlt: L;
  icon: LucideIcon;
}

/**
 * ==== JOURNEY STEPS - edit here only ====
 * Set `image` to a real photo path to replace the illustration; no component
 * change needed.
 */
export const journeySteps: JourneyStep[] = [
  {
    id: "order",
    short: { id: "Order", en: "Order" },
    title: { id: "Order & Planning", en: "Order & Planning" },
    description: {
      id: "Tim operasional memproses detail pengiriman, menyiapkan armada, dan mengatur jadwal perjalanan.",
      en: "The operations team processes shipment details, prepares the fleet, and schedules the trip.",
    },
    status: "ORDER CREATED",
    image: COMPRO_IMAGES.journey.order.url,
    imageAlt: COMPRO_IMAGES.journey.order.alt as any,
    icon: ClipboardList,
  },
  {
    id: "pickup",
    short: { id: "Pickup", en: "Pickup" },
    title: { id: "Pickup & Loading", en: "Pickup & Loading" },
    description: {
      id: "Barang dipersiapkan dan dimuat ke armada sesuai dengan kebutuhan pengiriman.",
      en: "Goods are prepared and loaded onto the vehicle according to shipment needs.",
    },
    status: "PICKUP",
    image: COMPRO_IMAGES.journey.pickup.url,
    imageAlt: COMPRO_IMAGES.journey.pickup.alt as any,
    icon: Warehouse,
  },
  {
    id: "transit",
    short: { id: "In Transit", en: "In Transit" },
    title: { id: "On The Way", en: "On The Way" },
    description: {
      id: "Driver membawa barang menuju tujuan dengan perjalanan yang dipantau secara berkala.",
      en: "The driver carries the goods to the destination with periodically monitored progress.",
    },
    status: "IN TRANSIT",
    image: COMPRO_IMAGES.journey.transit.url,
    imageAlt: COMPRO_IMAGES.journey.transit.alt as any,
    icon: Truck,
  },
  {
    id: "update",
    short: { id: "Live Update", en: "Live Update" },
    title: { id: "Real-Time Update", en: "Real-Time Update" },
    description: {
      id: "Status perjalanan, lokasi, dan informasi pengiriman diperbarui secara berkala melalui sistem.",
      en: "Trip status, location, and shipment information are updated periodically through the system.",
    },
    status: "LIVE UPDATE",
    image: COMPRO_IMAGES.journey.update.url,
    imageAlt: COMPRO_IMAGES.journey.update.alt as any,
    icon: Smartphone,
  },
  {
    id: "arrived",
    short: { id: "Arrived", en: "Arrived" },
    title: { id: "Tiba di Tujuan", en: "Arrived at Destination" },
    description: {
      id: "Armada tiba di lokasi tujuan dan proses serah terima dipersiapkan.",
      en: "The vehicle arrives at the destination and the handover is prepared.",
    },
    status: "ARRIVED",
    image: COMPRO_IMAGES.journey.arrived.url,
    imageAlt: COMPRO_IMAGES.journey.arrived.alt as any,
    icon: Navigation,
  },
  {
    id: "delivered",
    short: { id: "Delivered", en: "Delivered" },
    title: { id: "Serah Terima Barang", en: "Cargo Handover" },
    description: {
      id: "Barang diterima oleh pihak tujuan dengan proses serah terima yang terdokumentasi.",
      en: "Goods are received by the recipient with a documented handover.",
    },
    status: "DELIVERED",
    image: COMPRO_IMAGES.journey.delivered.url,
    imageAlt: COMPRO_IMAGES.journey.delivered.alt as any,
    icon: PackageCheck,
  },
];
