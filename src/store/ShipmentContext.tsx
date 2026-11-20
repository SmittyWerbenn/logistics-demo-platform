import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type {
  RecoveryStatus,
  Shipment,
  ShipmentFormData,
  ShipmentStatus,
  TimelineEvent,
  TimelineEventType,
  TrackingUpdateFormData,
  UpdateShipmentInfoData,
} from "../types";
import { api, ApiError, uploadFile } from "../utils/apiClient";
import { resolveFileUrls, type FileRef } from "../utils/resolveFiles";
import { sendAdminDeliveryEmail } from "../utils/sendEmail";
import { adminResiUrl } from "../utils/urls";
import { useAuth } from "./AuthContext";

/** `layanan` is the service actually stored; `layananFallback` is true when
 * the requested one wasn't an active Master Layanan entry and the API
 * substituted LTL. */
export interface CreatedShipment {
  awb: string;
  reference?: string | null;
  layanan?: string;
  layananFallback?: boolean;
}

interface RawShipmentSummary {
  awb: string;
  reference?: string | null;
  tanggalDibuat: string;
  jamDibuat: string;
  status: ShipmentStatus;
  pengirim: { nama: string; telepon: string; email: string };
  penerima: { nama: string; telepon: string; email: string };
  alamatAsal: string;
  kotaAsal: string;
  alamatTujuan: string;
  kotaTujuan: string;
  deskripsiBarang: string;
  layanan: Shipment["layanan"];
  beratKg: number;
  jumlahKoli: number;
  asuransi?: boolean;
  koliAsuransi?: string | null;
  nilaiAsuransi?: number | null;
  truckId: string | null;
  truckNomorUnit: string | null;
  truckJenis: string | null;
  truckDriverNama: string | null;
  customerId: string | null;
  mitraId: string | null;
  mitraNama: string | null;
  emailTerkirim: boolean;
  emailTerkirimAt: string | null;
  slaValue: number | null;
  slaUnit: string | null;
  estimasiTiba: string | null;
  claimStatus: "pending" | null;
  claimDriverNama: string | null;
  claimDriverTelepon: string | null;
  claimRequestedAt: string | null;
  claimDriverId?: string | null;
  claimTruck?: { id: string; nomorUnit: string; jenis: string } | null;
  recovery?: { status: RecoveryStatus; requestedAt: string; rejectionReason: string | null } | null;
  createdByName?: string | null;
  createdByRole?: Shipment["createdByRole"];
  cancel?: Shipment["cancel"];
  hold?: Shipment["hold"] | null;
  holdPolicy?: Shipment["holdPolicy"];
  cancellation?: Shipment["cancellation"] | null;
  pod: { tanggal: string; jam: string; namaPenerima: string } | null;
  lastUpdate: { tanggal: string; jam: string } | null;
}

export interface ClaimSeen {
  driverId: string;
  truckId: string | null;
}

export interface PendingClaim {
  awb: string;
  kotaAsal: string;
  kotaTujuan: string;
  alamatTujuan: string;
  deskripsiBarang: string;
  claimRequestedAt: string;
  driver: { id: string; nama: string; telepon: string };
  /** The unit this driver would run the shipment with (Master Armada). */
  truck: { id: string; nomorUnit: string; jenis: string } | null;
}

interface RawTimelineRow {
  id: string;
  type: TimelineEventType;
  lokasi: string;
  titik_id: string | null;
  tanggal: string;
  jam: string;
  keterangan: string;
  truck_id: string | null;
  truck_nomor_unit: string | null;
  truck_driver_nama: string | null;
  truck_sebelumnya_nomor_unit: string | null;
  input_by_name: string | null;
  input_at: string;
}

interface RawPodRow {
  tanggal: string;
  jam: string;
  lokasi: string;
  nama_penerima: string;
  catatan: string | null;
}

function toShipment(row: RawShipmentSummary): Shipment {
  return {
    awb: row.awb,
    reference: row.reference ?? undefined,
    tanggalDibuat: row.tanggalDibuat,
    jamDibuat: row.jamDibuat,
    status: row.status,
    pengirim: row.pengirim,
    penerima: row.penerima,
    alamatAsal: row.alamatAsal,
    kotaAsal: row.kotaAsal,
    alamatTujuan: row.alamatTujuan,
    kotaTujuan: row.kotaTujuan,
    deskripsiBarang: row.deskripsiBarang,
    layanan: row.layanan,
    beratKg: row.beratKg,
    jumlahKoli: row.jumlahKoli,
    asuransi: row.asuransi ?? false,
    koliAsuransi: row.koliAsuransi ?? null,
    nilaiAsuransi: row.nilaiAsuransi ?? null,
    truck: {
      nomorUnit: row.truckNomorUnit ?? "-",
      jenis: row.truckJenis ?? "-",
      driver: row.truckDriverNama ?? undefined,
    },
    truckId: row.truckId ?? undefined,
    customerId: row.customerId ?? undefined,
    mitraId: row.mitraId ?? undefined,
    mitraNama: row.mitraNama ?? undefined,
    timeline: row.lastUpdate
      ? [{ id: "last", type: row.status as TimelineEventType, lokasi: "", tanggal: row.lastUpdate.tanggal, jam: row.lastUpdate.jam, keterangan: "" }]
      : [],
    pod: row.pod
      ? { tanggal: row.pod.tanggal, jam: row.pod.jam, namaPenerima: row.pod.namaPenerima, lokasi: "", fotoSuratJalan: "" }
      : undefined,
    emailTerkirim: row.emailTerkirim,
    emailTerkirimAt: row.emailTerkirimAt ?? undefined,
    slaValue: row.slaValue ?? undefined,
    slaUnit: row.slaUnit ?? undefined,
    estimasiTiba: row.estimasiTiba ?? undefined,
    claimStatus: row.claimStatus ?? undefined,
    claimDriverNama: row.claimDriverNama ?? undefined,
    claimDriverTelepon: row.claimDriverTelepon ?? undefined,
    claimRequestedAt: row.claimRequestedAt ?? undefined,
    claimDriverId: row.claimDriverId ?? undefined,
    claimTruck: row.claimTruck ?? undefined,
    recovery: row.recovery
      ? { status: row.recovery.status, requestedAt: row.recovery.requestedAt, rejectionReason: row.recovery.rejectionReason ?? undefined }
      : undefined,
    createdByName: row.createdByName ?? undefined,
    createdByRole: row.createdByRole,
    cancel: row.cancel,
    hold: row.hold ?? undefined,
    holdPolicy: row.holdPolicy,
    cancellation: row.cancellation ?? undefined,
  };
}

function toTimelineEvent(row: RawTimelineRow, fotoUrls: string[]): TimelineEvent {
  return {
    id: row.id,
    type: row.type,
    lokasi: row.lokasi,
    titikId: row.titik_id ?? undefined,
    tanggal: row.tanggal,
    jam: row.jam,
    keterangan: row.keterangan,
    foto: fotoUrls.length > 0 ? fotoUrls : undefined,
    truck: row.truck_nomor_unit ? { nomorUnit: row.truck_nomor_unit, jenis: "-", driver: row.truck_driver_nama ?? undefined } : undefined,
    truckId: row.truck_id ?? undefined,
    truckSebelumnya: row.truck_sebelumnya_nomor_unit ? { nomorUnit: row.truck_sebelumnya_nomor_unit, jenis: "-" } : undefined,
    inputBy: row.input_by_name ?? undefined,
    inputAt: row.input_at,
  };
}

interface ShipmentDetailResponse {
  shipment: RawShipmentSummary;
  timeline: RawTimelineRow[];
  pod: RawPodRow | null;
  files: FileRef[];
  holds?: Shipment["holds"];
}

interface ShipmentListResponse {
  items: RawShipmentSummary[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ShipmentListParams {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
  /** Client ID, or "__none__" for orders without one. */
  customer?: string;
  /** Created-date range (YYYY-MM-DD, inclusive). */
  from?: string;
  to?: string;
  /** Only stagnant orders: no tracking update for this many days. */
  macet?: number;
}

function listQuery(params: ShipmentListParams, defaultLimit: number): URLSearchParams {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? defaultLimit));
  search.set("page", String(params.page ?? 1));
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  if (params.customer) search.set("customer", params.customer);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.macet) search.set("macet", String(params.macet));
  return search;
}

/** One page of orders matching the filters, independent of the shared list state. */
export async function fetchShipmentsPage(params: ShipmentListParams): Promise<Shipment[]> {
  const res = await api.get<ShipmentListResponse>(`/api/shipments?${listQuery(params, 20).toString()}`);
  return res.items.map(toShipment);
}

/** Every order matching the filters, fetched 100 per request (for exports). */
export async function fetchAllShipments(params: ShipmentListParams): Promise<Shipment[]> {
  const all: Shipment[] = [];
  for (let page = 1; page <= 200; page++) {
    const res = await api.get<ShipmentListResponse>(`/api/shipments?${listQuery({ ...params, page, limit: 100 }, 100).toString()}`);
    all.push(...res.items.map(toShipment));
    if (page >= res.meta.totalPages) break;
  }
  return all;
}

interface ShipmentContextValue {
  shipments: Shipment[];
  isLoading: boolean;
  listMeta: { total: number; totalPages: number; page: number; limit: number };
  refresh: (params?: ShipmentListParams) => Promise<void>;
  getByAwb: (awb: string) => Promise<Shipment | null>;
  createShipment: (data: ShipmentFormData) => Promise<CreatedShipment>;
  markEmailSent: (awb: string) => void;
  addTrackingUpdate: (data: TrackingUpdateFormData) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateShipmentInfo: (awb: string, data: UpdateShipmentInfoData) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateShipmentAlamat: (
    awb: string,
    data: { alamatAsal: string; kotaAsal: string; alamatTujuan: string; kotaTujuan: string },
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Client only: asks GMS to restore a cancelled order (does not change the order). */
  requestRecovery: (awb: string, alasan?: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  updatePodPhoto: (awb: string, slot: "barang" | "suratJalan", fotoDataUrl: string | undefined) => Promise<void>;
  fetchPendingClaims: () => Promise<PendingClaim[]>;
  /** `seen` = the driver/unit the admin was looking at; the API refuses if either changed since. */
  confirmClaim: (awb: string, seen?: ClaimSeen) => Promise<{ ok: true } | { ok: false; error: string }>;
  rejectClaim: (awb: string, seen?: ClaimSeen) => Promise<{ ok: true } | { ok: false; error: string }>;
  unassignDriver: (awb: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Forward/assign (mitraId) or unassign (null) a shipment to a Mitra. */
  assignMitra: (awb: string, mitraId: string | null) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const ShipmentContext = createContext<ShipmentContextValue | null>(null);

export function ShipmentProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listMeta, setListMeta] = useState({ total: 0, totalPages: 1, page: 1, limit: 100 });

  // Several callers refresh with different filters (the provider on login, a
  // list page with its own status/search). Only the most recent call may write
  // the list, otherwise a slower earlier answer (e.g. the unfiltered one, which
  // hides cancelled orders) could replace a filtered view.
  const refreshSeq = useRef(0);

  async function refresh(params: ShipmentListParams = {}) {
    const seq = ++refreshSeq.current;
    setIsLoading(true);
    try {
      const search = listQuery(params, 20);
      const res = await api.get<ShipmentListResponse>(`/api/shipments?${search.toString()}`);
      if (seq !== refreshSeq.current) return;
      setShipments(res.items.map(toShipment));
      setListMeta({ total: res.meta.total, totalPages: res.meta.totalPages, page: res.meta.page, limit: res.meta.limit });
    } catch {
      if (seq === refreshSeq.current) setShipments([]);
    } finally {
      if (seq === refreshSeq.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    // A page that mounted first (child effects run before this one) has already
    // asked for its own filtered list - don't clobber it with the default one.
    if (isAuthenticated) {
      if (refreshSeq.current === 0) refresh();
    } else {
      refreshSeq.current = 0;
      setShipments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function getByAwb(awb: string): Promise<Shipment | null> {
    try {
      const res = await api.get<ShipmentDetailResponse>(`/api/shipments/${encodeURIComponent(awb)}`);
      const urlMap = await resolveFileUrls(res.files);
      const fotoBarangUrls = urlMap.get(`shipment_photo:${res.shipment.awb}`) ?? [];
      const fotoSuratJalanUrls = urlMap.get(`shipment_surat_jalan:${res.shipment.awb}`) ?? [];
      const podBarangUrls = urlMap.get(`pod_barang:${res.shipment.awb}`) ?? [];
      const podSuratJalanUrls = urlMap.get(`pod_surat_jalan:${res.shipment.awb}`) ?? [];

      const timeline = res.timeline.map((row) => toTimelineEvent(row, urlMap.get(`timeline_photo:${row.id}`) ?? []));

      return {
        ...toShipment(res.shipment),
        holds: res.holds ?? [],
        fotoBarang: fotoBarangUrls[0],
        fotoSuratJalan: fotoSuratJalanUrls[0],
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
      };
    } catch {
      return null;
    }
  }

  async function createShipment(data: ShipmentFormData): Promise<CreatedShipment> {
    const res = await api.post<CreatedShipment>("/api/shipments", {
      pengirimNama: data.pengirim.nama,
      pengirimTelepon: data.pengirim.telepon,
      pengirimEmail: data.pengirim.email,
      penerimaNama: data.penerima.nama,
      penerimaTelepon: data.penerima.telepon,
      penerimaEmail: data.penerima.email,
      alamatAsal: data.alamatAsal,
      kotaAsal: data.kotaAsal,
      alamatTujuan: data.alamatTujuan,
      kotaTujuan: data.kotaTujuan,
      deskripsiBarang: data.deskripsiBarang,
      reference: data.reference?.trim() || undefined,
      layanan: data.layanan,
      beratKg: data.beratKg,
      jumlahKoli: data.jumlahKoli,
      truckId: data.truckId || undefined,
      slaValue: data.slaValue,
      customerId: data.customerId || undefined,
      hold: data.hold || undefined,
      holdReason: data.hold ? data.holdReason?.trim() : undefined,
      asuransi: data.asuransi || undefined,
      koliAsuransi: data.asuransi ? data.koliAsuransi : undefined,
      nilaiAsuransi: data.asuransi ? data.nilaiAsuransi : undefined,
    });

    if (data.fotoBarang) {
      await uploadFile(data.fotoBarang, "shipment_photo", res.awb).catch(() => {});
    }
    if (data.fotoSuratJalan) {
      await uploadFile(data.fotoSuratJalan, "shipment_surat_jalan", res.awb).catch(() => {});
    }

    await refresh();
    return res;
  }

  function markEmailSent(awb: string) {
    setShipments((prev) => prev.map((s) => (s.awb === awb ? { ...s, emailTerkirim: true, emailTerkirimAt: new Date().toISOString() } : s)));
  }

  // Notifies every active Admin/Superadmin by email once a shipment reaches
  // "Selesai / Terkirim" - triggered from either the admin or driver portal
  // (both funnel through addTrackingUpdate), so admins learn a delivery
  // completed without needing to be the one who marked it done.
  async function notifyAdminsDelivered(awb: string) {
    const [shipment, adminsRes] = await Promise.all([
      getByAwb(awb),
      api.get<{ items: { nama: string; email: string }[] }>("/api/admin-emails"),
    ]);
    if (!shipment || adminsRes.items.length === 0) return;

    const detailUrl = adminResiUrl(awb);
    await Promise.all(
      adminsRes.items.map((admin) =>
        sendAdminDeliveryEmail(shipment, detailUrl, admin.email, admin.nama).catch(() => {}),
      ),
    );
  }

  async function addTrackingUpdate(data: TrackingUpdateFormData) {
    try {
      const isSelesai = data.type === "Selesai / Terkirim";
      const res = await api.post<{ eventId: string }>(`/api/shipments/${encodeURIComponent(data.awb)}/timeline`, {
        type: data.type,
        lokasi: data.lokasi,
        titikId: data.titikId,
        tanggal: data.tanggal,
        jam: data.jam,
        keterangan: data.keterangan,
        truckId: data.truckId,
        namaPenerima: data.namaPenerima,
      });

      if (data.foto && data.foto.length > 0) {
        if (isSelesai) {
          await uploadFile(data.foto[0], "pod_barang", data.awb).catch(() => {});
          await uploadFile(data.foto[1] ?? data.foto[0], "pod_surat_jalan", data.awb).catch(() => {});
        } else {
          await Promise.all(data.foto.map((f) => uploadFile(f, "timeline_photo", res.eventId).catch(() => {})));
        }
      }

      await refresh();
      // Fire-and-forget - never let a slow/failed internal email delay or
      // fail the status update itself, which is already saved by this point.
      if (isSelesai) notifyAdminsDelivered(data.awb).catch(() => {});
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof ApiError ? err.message : "Gagal menyimpan update tracking." };
    }
  }

  async function updateShipmentInfo(awb: string, data: UpdateShipmentInfoData) {
    try {
      await api.patch(`/api/shipments/${encodeURIComponent(awb)}`, {
        pengirimNama: data.pengirim.nama,
        pengirimTelepon: data.pengirim.telepon,
        pengirimEmail: data.pengirim.email,
        penerimaNama: data.penerima.nama,
        penerimaTelepon: data.penerima.telepon,
        penerimaEmail: data.penerima.email,
        alamatAsal: data.alamatAsal,
        kotaAsal: data.kotaAsal,
        alamatTujuan: data.alamatTujuan,
        kotaTujuan: data.kotaTujuan,
        ...(data.layanan ? { layanan: data.layanan } : {}),
        ...(data.deskripsiBarang !== undefined ? { deskripsiBarang: data.deskripsiBarang } : {}),
        ...(data.beratKg !== undefined ? { beratKg: data.beratKg } : {}),
        ...(data.jumlahKoli !== undefined ? { jumlahKoli: data.jumlahKoli } : {}),
        ...(data.asuransi !== undefined ? { asuransi: data.asuransi, koliAsuransi: data.koliAsuransi, nilaiAsuransi: data.nilaiAsuransi } : {}),
        ...(data.slaValue !== undefined ? { slaValue: data.slaValue } : {}),
      });
      await refresh();
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof ApiError ? err.message : "Gagal menyimpan perubahan." };
    }
  }

  async function updateShipmentAlamat(
    awb: string,
    data: { alamatAsal: string; kotaAsal: string; alamatTujuan: string; kotaTujuan: string },
  ) {
    try {
      await api.patch(`/api/shipments/${encodeURIComponent(awb)}/alamat`, {
        alamatAsal: data.alamatAsal,
        kotaAsal: data.kotaAsal,
        alamatTujuan: data.alamatTujuan,
        kotaTujuan: data.kotaTujuan,
      });
      await refresh();
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof ApiError ? err.message : "Gagal menyimpan perubahan alamat." };
    }
  }

  async function requestRecovery(awb: string, alasan?: string) {
    try {
      await api.post(`/api/shipments/${encodeURIComponent(awb)}/recovery-request`, { alasan });
      await refresh({ status: "Dibatalkan" });
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof ApiError ? err.message : "Gagal mengajukan pemulihan." };
    }
  }

  async function updatePodPhoto(awb: string, slot: "barang" | "suratJalan", fotoDataUrl: string | undefined) {
    if (!fotoDataUrl) return;
    const entityType = slot === "suratJalan" ? "pod_surat_jalan" : "pod_barang";
    const uploaded = await uploadFile(fotoDataUrl, entityType, awb);
    await api.patch(`/api/shipments/${encodeURIComponent(awb)}/pod-photo`, { fotoFileId: uploaded.id, slot });
  }

  async function fetchPendingClaims(): Promise<PendingClaim[]> {
    const res = await api.get<{ items: PendingClaim[] }>("/api/shipments/claims/pending");
    return res.items;
  }

  async function confirmClaim(awb: string, seen?: ClaimSeen) {
    try {
      await api.post(`/api/shipments/${encodeURIComponent(awb)}/claim/confirm`, seen ? { driverId: seen.driverId, truckId: seen.truckId ?? "" } : undefined);
      await refresh();
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof ApiError ? err.message : "Gagal mengonfirmasi klaim." };
    }
  }

  async function rejectClaim(awb: string, seen?: ClaimSeen) {
    try {
      await api.post(`/api/shipments/${encodeURIComponent(awb)}/claim/reject`, seen ? { driverId: seen.driverId, truckId: seen.truckId ?? "" } : undefined);
      await refresh();
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof ApiError ? err.message : "Gagal menolak klaim." };
    }
  }

  async function unassignDriver(awb: string) {
    try {
      await api.post(`/api/shipments/${encodeURIComponent(awb)}/unassign`);
      await refresh();
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof ApiError ? err.message : "Gagal membatalkan penugasan." };
    }
  }

  async function assignMitra(awb: string, mitraId: string | null) {
    try {
      await api.post(`/api/shipments/${encodeURIComponent(awb)}/assign-mitra`, { mitraId });
      await refresh();
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof ApiError ? err.message : "Gagal meneruskan ke Mitra." };
    }
  }

  return (
    <ShipmentContext.Provider
      value={{
        shipments,
        isLoading,
        listMeta,
        refresh,
        getByAwb,
        createShipment,
        markEmailSent,
        addTrackingUpdate,
        updateShipmentInfo,
        updateShipmentAlamat,
        requestRecovery,
        updatePodPhoto,
        fetchPendingClaims,
        confirmClaim,
        rejectClaim,
        unassignDriver,
        assignMitra,
      }}
    >
      {children}
    </ShipmentContext.Provider>
  );
}

export function useShipments() {
  const ctx = useContext(ShipmentContext);
  if (!ctx) throw new Error("useShipments must be used within ShipmentProvider");
  return ctx;
}
