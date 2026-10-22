// Driver-portal API calls (see api-worker/src/routes/driver.ts). Every
// endpoint here is scoped server-side to the logged-in driver's own
// shipments - never pass an AWB the driver doesn't already have in hand.
import { api } from "./apiClient";

export interface DriverShipmentSummary {
  awb: string;
  status: string;
  tanggalDibuat: string;
  jamDibuat: string;
  pengirim?: { nama: string };
  penerima: { nama: string; telepon: string };
  alamatAsal: string;
  kotaAsal: string;
  alamatTujuan: string;
  kotaTujuan: string;
  deskripsiBarang: string;
  layanan: string;
  beratKg: number;
  jumlahKoli: number;
  truckNomorUnit: string | null;
  estimasiTiba: string | null;
  /** Free-text "Nomor Pelanggan" entered when the order was created
   * (e.g. "IDTMDI001") - not an internal database id. */
  customerId?: string | null;
  /** Display name derived from the Client account owning that
   * customer id, when one exists. */
  customerName?: string | null;
}

export interface DriverTruckInfo {
  id: string;
  nomorUnit: string;
  jenis: string;
}

export interface DriverTimelineEvent {
  id: string;
  type: string;
  lokasi: string;
  tanggal: string;
  jam: string;
  keterangan: string;
  input_at: string;
}

export interface DriverShipmentDetail {
  shipment: DriverShipmentSummary;
  timeline: DriverTimelineEvent[];
}

export interface OpenShipmentSummary extends DriverShipmentSummary {
  claimStatus: "pending" | null;
  /** True when THIS driver is the one with the pending claim on it. */
  isMine: boolean;
}

export interface DriverLastPosition {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  created_at: string;
}

export async function fetchDriverShipments(): Promise<DriverShipmentSummary[]> {
  const res = await api.get<{ items: DriverShipmentSummary[] }>("/api/driver/shipments");
  return res.items;
}

/** Truck unit(s) assigned to the logged-in driver - normally one, but
 * lists all if the data model ever links more than one. */
export async function fetchDriverTrucks(): Promise<DriverTruckInfo[]> {
  const res = await api.get<{ items: DriverTruckInfo[] }>("/api/driver/trucks");
  return res.items;
}

export async function fetchDriverShipmentDetail(awb: string): Promise<DriverShipmentDetail> {
  return api.get<DriverShipmentDetail>(`/api/driver/shipments/${encodeURIComponent(awb)}`);
}

export async function reportDriverPosition(
  awb: string,
  coords: { latitude: number; longitude: number; accuracy?: number },
): Promise<void> {
  await api.post(`/api/driver/shipments/${encodeURIComponent(awb)}/position`, coords);
}

export async function fetchDriverLastPosition(awb: string): Promise<DriverLastPosition | null> {
  const res = await api.get<{ lastPosition: DriverLastPosition | null }>(
    `/api/driver/shipments/${encodeURIComponent(awb)}/position`,
  );
  return res.lastPosition;
}

/** Unassigned shipments any driver may browse and request to claim. */
export async function fetchOpenShipments(): Promise<OpenShipmentSummary[]> {
  const res = await api.get<{ items: OpenShipmentSummary[] }>("/api/driver/open-shipments");
  return res.items;
}

export async function claimShipment(awb: string): Promise<void> {
  await api.post(`/api/driver/shipments/${encodeURIComponent(awb)}/claim`);
}

export async function cancelShipmentClaim(awb: string): Promise<void> {
  await api.post(`/api/driver/shipments/${encodeURIComponent(awb)}/claim/cancel`);
}
