// Public, unauthenticated shipment lookup for the customer-facing tracking
// pages (TrackingResult, TrackingSearch) - hits /api/public/shipments/:awb,
// which only ever returns fields already shown on that public page (see
// api-worker/src/routes/public.ts).
import type { Shipment, ShipmentStatus, TimelineEvent, TimelineEventType } from "../types";
import { api, ApiError } from "./apiClient";
import { TRACKING_CAPTCHA_ENABLED, getHumanPass, clearHumanPass } from "./captchaApi";
import { resolveFileUrls, type FileRef } from "./resolveFiles";

interface RawPublicShipment {
  awb: string;
  tanggalDibuat: string;
  status: ShipmentStatus;
  pengirim?: { nama: string };
  penerima: { nama: string };
  alamatTujuan: string;
  kotaAsal: string;
  kotaTujuan: string;
  layanan: Shipment["layanan"];
  beratKg: number;
  jumlahKoli: number;
  deskripsiBarang: string;
  truckNomorUnit: string | null;
  truckJenis: string | null;
  truckDriverNama: string | null;
  estimasiTiba: string | null;
}

interface RawPublicTimelineRow {
  id: string;
  type: TimelineEventType;
  lokasi: string;
  tanggal: string;
  jam: string;
  keterangan: string;
  truck_nomor_unit: string | null;
  truck_driver_nama: string | null;
}

interface RawPublicPod {
  tanggal: string;
  jam: string;
  lokasi: string;
  nama_penerima: string;
  catatan: string | null;
}

export interface PublicShipmentResult {
  shipment: Shipment;
  hasFeedback: boolean;
}

/** Thrown when the lookup needs a (new) CAPTCHA verification first. */
export class HumanCheckRequiredError extends Error {}

export async function fetchPublicShipment(awb: string): Promise<PublicShipmentResult | null> {
  const pass = TRACKING_CAPTCHA_ENABLED ? getHumanPass() : null;
  if (TRACKING_CAPTCHA_ENABLED && !pass) throw new HumanCheckRequiredError();
  try {
    const res = await api.get<{
      shipment: RawPublicShipment;
      timeline: RawPublicTimelineRow[];
      pod: RawPublicPod | null;
      files: FileRef[];
      hasFeedback: boolean;
    }>(`/api/public/shipments/${encodeURIComponent(awb)}`, { auth: false, headers: pass ? { "X-Human-Pass": pass } : undefined });

    const urlMap = await resolveFileUrls(res.files, true);
    const podBarangUrls = urlMap.get(`pod_barang:${res.shipment.awb}`) ?? [];
    const podSuratJalanUrls = urlMap.get(`pod_surat_jalan:${res.shipment.awb}`) ?? [];

    const timeline: TimelineEvent[] = res.timeline.map((row) => ({
      id: row.id,
      type: row.type,
      lokasi: row.lokasi,
      tanggal: row.tanggal,
      jam: row.jam,
      keterangan: row.keterangan,
      foto: urlMap.get(`timeline_photo:${row.id}`),
      truck: row.truck_nomor_unit ? { nomorUnit: row.truck_nomor_unit, jenis: "-", driver: row.truck_driver_nama ?? undefined } : undefined,
    }));

    const shipment: Shipment = {
      awb: res.shipment.awb,
      tanggalDibuat: res.shipment.tanggalDibuat,
      jamDibuat: "",
      status: res.shipment.status,
      pengirim: { nama: res.shipment.pengirim?.nama ?? "", telepon: "", email: "" },
      penerima: { nama: res.shipment.penerima.nama, telepon: "", email: "" },
      alamatAsal: "",
      kotaAsal: res.shipment.kotaAsal,
      alamatTujuan: res.shipment.alamatTujuan,
      kotaTujuan: res.shipment.kotaTujuan,
      deskripsiBarang: res.shipment.deskripsiBarang,
      layanan: res.shipment.layanan,
      beratKg: res.shipment.beratKg,
      jumlahKoli: res.shipment.jumlahKoli,
      asuransi: false,
      koliAsuransi: null,
      nilaiAsuransi: null,
      truck: {
        nomorUnit: res.shipment.truckNomorUnit ?? "-",
        jenis: res.shipment.truckJenis ?? "-",
        driver: res.shipment.truckDriverNama ?? undefined,
      },
      timeline,
      pod: res.pod
        ? {
            tanggal: res.pod.tanggal,
            jam: res.pod.jam,
            lokasi: res.pod.lokasi,
            namaPenerima: res.pod.nama_penerima,
            catatan: res.pod.catatan ?? undefined,
            fotoBarang: podBarangUrls[0],
            fotoSuratJalan: podSuratJalanUrls[0] ?? "",
          }
        : undefined,
      emailTerkirim: false,
      estimasiTiba: res.shipment.estimasiTiba ?? undefined,
    };

    return { shipment, hasFeedback: res.hasFeedback };
  } catch (err) {
    if (err instanceof ApiError && err.status === 428) {
      clearHumanPass();
      throw new HumanCheckRequiredError();
    }
    return null;
  }
}
