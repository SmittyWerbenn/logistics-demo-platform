import type { Router } from "../router";
import type { Ctx, AuthedUser } from "../types";
import { ok, Errors, HttpError } from "../http";
import { parseJsonBody, reqString, reqEnum, reqNumber, reqEmail, optString, optNumber } from "../validate";
import { findActiveLayanan, resolveLayananForOrder } from "../layanan";
import { newId } from "../crypto";
import { requireAuth, requirePermission } from "../authMiddleware";
import { writeAuditLog } from "../audit";
import { parsePagination, pageMeta, likeTerm, orderBy } from "../pagination";
import { generateClientAwb, isDuplicateAwbError } from "../awb";
import { wibNow } from "../wib";
import { TIMELINE_EVENT_TYPES, eventTypeToShipmentStatus, isForwardTransition, type TimelineEventType } from "../status";
import { addBusinessDays } from "../sla";
import { cancelPolicy, creatorRoleOf, pickupEvidenceSql } from "../cancellation";
import { holdPolicy } from "../hold";

const POD_EDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Client accounts never learn which Mitra (partner agent) handles an order. */
function forActor(summary: ReturnType<typeof shipmentSummary>, role: string) {
  if (role === "Mitra") return { ...summary, createdByName: null, createdByRole: null as unknown as typeof summary.createdByRole, hold: null, holdPolicy: undefined };
  return role === "Client" ? { ...summary, mitraId: null, mitraNama: null } : summary;
}

function shipmentSummary(row: Record<string, unknown>) {
  return {
    awb: row.awb,
    reference: row.reference ?? null,
    tanggalDibuat: row.tanggal_dibuat,
    jamDibuat: row.jam_dibuat,
    status: row.status,
    pengirim: { nama: row.pengirim_nama, telepon: row.pengirim_telepon, email: row.pengirim_email },
    penerima: { nama: row.penerima_nama, telepon: row.penerima_telepon, email: row.penerima_email },
    alamatAsal: row.alamat_asal,
    kotaAsal: row.kota_asal,
    alamatTujuan: row.alamat_tujuan,
    kotaTujuan: row.kota_tujuan,
    deskripsiBarang: row.deskripsi_barang,
    layanan: row.layanan,
    beratKg: row.berat_kg,
    jumlahKoli: row.jumlah_koli,
    asuransi: !!row.asuransi,
    koliAsuransi: row.koli_asuransi ?? null,
    nilaiAsuransi: row.nilai_asuransi ?? null,
    truckId: row.truck_id,
    truckNomorUnit: row.truck_nomor_unit ?? null,
    truckJenis: row.truck_jenis ?? null,
    truckDriverNama: row.truck_driver_nama ?? null,
    customerId: row.customer_id ?? null,
    slaValue: row.sla_value ?? null,
    slaUnit: row.sla_unit ?? null,
    estimasiTiba: row.estimasi_tiba ?? null,
    claimStatus: row.claim_status ?? null,
    claimDriverNama: row.claim_driver_nama ?? null,
    claimDriverTelepon: row.claim_driver_telepon ?? null,
    claimRequestedAt: row.claim_requested_at ?? null,
    claimDriverId: row.claim_driver_id ?? null,
    claimTruck: row.claim_truck_id ? { id: row.claim_truck_id, nomorUnit: row.claim_truck_nomor_unit, jenis: row.claim_truck_jenis } : null,
    mitraId: row.mitra_id ?? null,
    mitraNama: row.mitra_nama ?? null,
    emailTerkirim: !!row.email_terkirim,
    emailTerkirimAt: row.email_terkirim_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pod: row.pod_tanggal
      ? { tanggal: row.pod_tanggal, jam: row.pod_jam, namaPenerima: row.pod_nama_penerima }
      : null,
    lastUpdate: row.last_tanggal ? { tanggal: row.last_tanggal, jam: row.last_jam } : null,
    recovery: row.recovery_status
      ? { status: row.recovery_status, requestedAt: row.recovery_requested_at, rejectionReason: row.recovery_rejection_reason ?? null }
      : null,
    hold: row.status === "Hold" && row.h_id
      ? {
          reason: row.h_reason,
          holdAt: row.h_at,
          holdBy: row.h_by,
          holdByRole: row.h_by_role,
          previousStatus: row.h_prev,
        }
      : null,
    createdByName: row.created_by_name ?? null,
    createdByRole: creatorRoleOf({ created_by_role: row.created_by_role as string | null, customer_id: row.customer_id as string | null }),
    cancellation: row.cr_id
      ? {
          id: row.cr_id,
          status: row.cr_status,
          reason: row.cr_reason,
          requestedBy: row.cr_requested_by_name,
          requestedByRole: row.cr_requested_by_role,
          requestedAt: row.cr_requested_at,
          decidedBy: row.cr_decided_by_name ?? null,
          decidedByRole: row.cr_decided_by_role ?? null,
          decidedAt: row.cr_decided_at ?? null,
          decisionReason: row.cr_decision_reason ?? null,
        }
      : null,
  };
}

/** Whether this actor may Hold / Release this order (ownership + state, computed on the server). */
function withHoldPolicy<T extends ReturnType<typeof shipmentSummary>>(summary: T, row: Record<string, unknown>, actor: AuthedUser) {
  return {
    ...summary,
    holdPolicy: holdPolicy(
      {
        status: String(row.status),
        customer_id: (row.customer_id as string | null) ?? null,
        created_by: (row.created_by as string | null) ?? null,
        created_by_role: (row.created_by_role as string | null) ?? null,
        has_pickup: Number(row.has_pickup ?? 0),
        pending_cancel: row.cr_status === "PENDING",
      },
      actor,
    ),
  };
}

/** What this actor may do about cancelling the order (computed on the server; the UI only renders it). */
function withCancelPolicy(summary: ReturnType<typeof shipmentSummary>, row: Record<string, unknown>, actor: AuthedUser) {
  return {
    ...summary,
    cancel: cancelPolicy(
      {
        status: String(row.status),
        customer_id: (row.customer_id as string | null) ?? null,
        created_by_role: (row.created_by_role as string | null) ?? null,
        has_pickup: Number(row.has_pickup ?? 0),
        pending_request: row.cr_status === "PENDING",
      },
      actor,
    ),
  };
}

export function registerShipmentRoutes(router: Router) {
  router.get("/api/shipments", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "shipments.view");
    const url = new URL(ctx.request.url);
    const { page, limit, offset } = parsePagination(url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("q")?.trim();

    const where: string[] = ["s.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (status) { where.push("s.status = ?"); params.push(status); }
    // Client only ever sees its own customer's shipments - forced
    // server-side, regardless of any status/search filters the client sends.
    if (actor.role === "Client" || (actor.role === "Viewer" && actor.customerId)) {
      where.push("s.customer_id = ?");
      params.push(actor.customerId);
    }
    // Mitra only ever sees shipments explicitly forwarded/assigned to it -
    // an unassigned (mitra_id IS NULL) shipment never shows up, and this
    // also means a Mitra with no mitraId linked yet sees nothing at all.
    if (actor.role === "Mitra") {
      where.push("s.mitra_id = ?");
      params.push(actor.mitraId);
    }
    // Hold orders are not operational yet: Driver/Mitra never receive them (filtered in SQL, before pagination).
    if (actor.role === "Driver" || actor.role === "Mitra") where.push("s.status != 'Hold'");
    // Cancelled orders are "data batal order" - a separate bucket, not part
    // of the everyday Data Pengiriman view. They're excluded from the
    // default ("Semua") list for every role, including Superadmin/Admin/
    // Client, and only surface when explicitly filtered by
    // status=Dibatalkan. Viewer/Driver/Mitra never see them, even then.
    if (!status) {
      where.push("s.status != 'Dibatalkan'");
    } else if (status === "Dibatalkan" && (actor.role === "Viewer" || actor.role === "Driver" || actor.role === "Mitra")) {
      where.push("1 = 0");
    }
    if (search) {
      where.push("(s.awb LIKE ? ESCAPE '\\' OR s.reference LIKE ? ESCAPE '\\' OR s.pengirim_nama LIKE ? ESCAPE '\\' OR s.penerima_nama LIKE ? ESCAPE '\\')");
      const like = likeTerm(search);
      params.push(like, like, like, like);
    }
    // Client ID filter ("__none__" = orders without one), created-date range
    // and stagnant ("macet" = no tracking update for N days, not yet delivered).
    const customer = url.searchParams.get("customer");
    if (customer === "__none__") where.push("s.customer_id IS NULL");
    else if (customer) { where.push("s.customer_id = ?"); params.push(customer); }
    const dateFrom = url.searchParams.get("from");
    const dateTo = url.searchParams.get("to");
    if (dateFrom) { where.push("s.tanggal_dibuat >= ?"); params.push(dateFrom); }
    if (dateTo) { where.push("s.tanggal_dibuat <= ?"); params.push(dateTo); }
    const macet = Number(url.searchParams.get("macet"));
    if (Number.isFinite(macet) && macet > 0) {
      const cutoff = new Date(Date.now() + 7 * 3600_000 - macet * 86_400_000).toISOString().slice(0, 16);
      where.push("s.status NOT IN ('Selesai / Terkirim', 'Hold')");
      where.push(
        "(SELECT e.tanggal || 'T' || e.jam FROM shipment_timeline_events e WHERE e.awb = s.awb ORDER BY e.seq DESC LIMIT 1) <= ?",
      );
      params.push(cutoff);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const order = orderBy(
      url,
      { tanggal: "s.tanggal_dibuat", awb: "s.awb", status: "s.status", pengirim: "s.pengirim_nama COLLATE NOCASE", penerima: "s.penerima_nama COLLATE NOCASE" },
      "s.tanggal_dibuat DESC, s.jam_dibuat DESC",
    );

    const total = await ctx.env.DB.prepare(`SELECT COUNT(*) as c FROM shipments s ${whereSql}`)
      .bind(...params)
      .first<{ c: number }>();

    const rows = await ctx.env.DB.prepare(
      `SELECT s.*, t.nomor_unit as truck_nomor_unit, d.nama as truck_driver_nama,
              cd.nama as claim_driver_nama, cd.telepon as claim_driver_telepon,
              m.nama as mitra_nama,
              p.tanggal as pod_tanggal, p.jam as pod_jam, p.nama_penerima as pod_nama_penerima,
              le.tanggal as last_tanggal, le.jam as last_jam,
              rr.status as recovery_status, rr.requested_at as recovery_requested_at, rr.rejection_reason as recovery_rejection_reason,
              ${pickupEvidenceSql("s.awb")} AS has_pickup,
              cr.id as cr_id, cr.status as cr_status, cr.reason as cr_reason, cr.requested_by_name as cr_requested_by_name,
              cr.requested_by_role as cr_requested_by_role, cr.requested_at as cr_requested_at, cr.decided_by_name as cr_decided_by_name,
              cr.decided_by_role as cr_decided_by_role, cr.decided_at as cr_decided_at, cr.decision_reason as cr_decision_reason,
              h.id as h_id, h.previous_status as h_prev, h.hold_reason as h_reason, h.hold_at as h_at, h.hold_by_name as h_by, h.hold_by_role as h_by_role
       FROM shipments s
       LEFT JOIN trucks t ON t.id = s.truck_id
       LEFT JOIN drivers d ON d.id = t.driver_id
       LEFT JOIN drivers cd ON cd.id = s.claim_driver_id
       LEFT JOIN mitras m ON m.kode_mitra = s.mitra_id
       LEFT JOIN shipment_pod p ON p.awb = s.awb
       LEFT JOIN (
         SELECT e1.awb, e1.tanggal, e1.jam FROM shipment_timeline_events e1
         WHERE e1.seq = (SELECT MAX(e2.seq) FROM shipment_timeline_events e2 WHERE e2.awb = e1.awb)
       ) le ON le.awb = s.awb
       LEFT JOIN order_recovery_requests rr ON rr.id = (
         SELECT x.id FROM order_recovery_requests x WHERE x.awb = s.awb ORDER BY x.requested_at DESC LIMIT 1
       )
       LEFT JOIN shipment_holds h ON h.awb = s.awb AND h.released_at IS NULL
       LEFT JOIN cancellation_requests cr ON cr.id = (
         SELECT y.id FROM cancellation_requests y WHERE y.awb = s.awb ORDER BY y.requested_at DESC LIMIT 1
       )
       ${whereSql}
       ORDER BY ${order}
       LIMIT ? OFFSET ?`,
    )
      .bind(...params, limit, offset)
      .all();

    return ok({
      items: (rows.results ?? []).map((r) => forActor(withHoldPolicy(withCancelPolicy(shipmentSummary(r), r, actor), r, actor), actor.role)),
      meta: pageMeta(page, limit, total?.c ?? 0),
    });
  });

  // Distinct Client IDs (with order counts) for the list's Client filter. Same
  // row visibility as the list itself.
  router.get("/api/shipments/clients", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "shipments.view");
    const where = ["deleted_at IS NULL", "status != 'Dibatalkan'"];
    const params: unknown[] = [];
    if (actor.role === "Client" || (actor.role === "Viewer" && actor.customerId)) { where.push("customer_id = ?"); params.push(actor.customerId); }
    if (actor.role === "Mitra") { where.push("mitra_id = ?"); params.push(actor.mitraId); }
    const rows = await ctx.env.DB.prepare(
      `SELECT customer_id, COUNT(*) AS c FROM shipments WHERE ${where.join(" AND ")} GROUP BY customer_id ORDER BY customer_id`,
    )
      .bind(...params)
      .all<{ customer_id: string | null; c: number }>();
    return ok({ items: (rows.results ?? []).map((r) => ({ customerId: r.customer_id, count: r.c })) });
  });

  router.post("/api/shipments", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "shipments.create");
    const body = await parseJsonBody(ctx.request);

    const pengirimNama = reqString(body, "pengirimNama", { max: 100 });
    const pengirimTelepon = reqString(body, "pengirimTelepon", { max: 30 });
    const pengirimEmail = reqEmail(body, "pengirimEmail");
    const penerimaNama = reqString(body, "penerimaNama", { max: 100 });
    const penerimaTelepon = reqString(body, "penerimaTelepon", { max: 30 });
    const penerimaEmail = reqEmail(body, "penerimaEmail");
    const alamatAsal = reqString(body, "alamatAsal", { max: 300 });
    const kotaAsal = reqString(body, "kotaAsal", { max: 80 });
    const alamatTujuan = reqString(body, "alamatTujuan", { max: 300 });
    const kotaTujuan = reqString(body, "kotaTujuan", { max: 80 });
    const deskripsiBarang = optString(body, "deskripsiBarang") ?? "";
    // Validated against Master Layanan (active entries only); anything
    // unknown/inactive/missing falls back to LTL instead of failing the order.
    const { nama: layanan, fellBack: layananFellBack } = await resolveLayananForOrder(
      ctx.env,
      typeof body.layanan === "string" ? body.layanan : undefined,
    );
    const beratKg = reqNumber(body, "beratKg", { min: 0.01, max: 100000 });
    const jumlahKoli = reqNumber(body, "jumlahKoli", { min: 1, max: 100000 });
    const truckId = optString(body, "truckId");
    const slaValue = optNumber(body, "slaValue", { min: 1, max: 365 });
    // "Referensi": the customer's own order identifier (optional). Unique per Client ID, case-insensitive.
    const referenceRaw = optString(body, "reference");
    const reference = referenceRaw ? referenceRaw.trim().replace(/\s+/g, " ") : null;
    if (reference && reference.length > 100) throw Errors.badRequest("Referensi maksimal 100 karakter.");
    // Client can only ever create shipments tagged with its own
    // customer_id - any value it sends in the body is ignored. Every other
    // creator role must supply one explicitly.
    const customerId = actor.role === "Client" ? actor.customerId : optString(body, "customerId");
    if (!customerId) {
      throw Errors.badRequest("Client ID wajib diisi.");
    }
    // Mitra can never be set by a Client account - only an internal
    // Superadmin/Admin forwards a shipment to a Mitra, at creation or later
    // via POST /api/shipments/:awb/assign-mitra.
    const mitraId = actor.role === "Client" ? undefined : optString(body, "mitraId");
    // Optional "Hold Pengiriman" at creation: the AWB is issued (e.g. for invoicing) but the order is parked.
    // Needs the hold permission and a reason; the creator is the one who can release it later.
    const holdAtCreate = body.hold === true;
    let holdReason = "";
    if (holdAtCreate) {
      requirePermission(ctx, "shipments.hold");
      holdReason = typeof body.holdReason === "string" ? body.holdReason.trim() : "";
      if (!holdReason) throw Errors.badRequest("Alasan Hold wajib diisi.");
      if (holdReason.length > 500) throw Errors.badRequest("Alasan Hold maksimal 500 karakter.");
    }

    // Insurance: optional at creation. When asuransi = true, koliAsuransi
    // (free-text, e.g. "62001, 62004" or any koli identifier) and
    // nilaiAsuransi (Rupiah > 0) are required. No range validation — the
    // field accepts any text the user enters.
    const asuransi = body.asuransi === true;
    let koliAsuransi: string | null = null;
    let nilaiAsuransi: number | null = null;
    if (asuransi) {
      const rawKoli = optString(body, "koliAsuransi");
      if (!rawKoli || !rawKoli.trim()) throw Errors.badRequest("Nomor koli yang diasuransikan wajib diisi ketika Asuransi = Ya.");
      koliAsuransi = rawKoli.trim();
      if (koliAsuransi.length > 500) throw Errors.badRequest("Nomor koli yang diasuransikan maksimal 500 karakter.");
      nilaiAsuransi = optNumber(body, "nilaiAsuransi", { min: 1, max: 10_000_000_000 }) ?? null;
      if (nilaiAsuransi === null || nilaiAsuransi <= 0) {
        throw Errors.badRequest("Nilai barang yang diasuransikan wajib diisi dan lebih dari 0 ketika Asuransi = Ya.");
      }
    }

    // Same Referensi again (re-import, retry, double click): never a second AWB - answer with the one that exists.
    const dupReference = async () => {
      if (!reference) return;
      const existing = await ctx.env.DB.prepare(`SELECT awb FROM shipments WHERE customer_id = ? AND reference = ? COLLATE NOCASE`)
        .bind(customerId, reference)
        .first<{ awb: string }>();
      if (existing) {
        throw new HttpError(409, "DUPLICATE_REFERENCE", `Referensi ${reference} sudah digunakan oleh AWB ${existing.awb}.`, { existingAwb: existing.awb, reference });
      }
    };
    await dupReference();

    if (truckId) {
      const truck = await ctx.env.DB.prepare(`SELECT id, status FROM trucks WHERE id = ? AND deleted_at IS NULL`).bind(truckId).first<{ id: string; status: string }>();
      if (!truck) throw Errors.badRequest("Truck yang dipilih tidak ditemukan.");
      // A Client may only use units dedicated to ITS OWN Client ID (from the session), with an ACTIVE assignment and an active unit.
      if (actor.role === "Client") {
        const own = await ctx.env.DB.prepare(
          `SELECT 1 FROM fleet_client_assignments WHERE truck_id = ? AND customer_id = ? AND status = 'ACTIVE'`,
        ).bind(truckId, customerId).first();
        if (!own || truck.status === "Inactive") throw Errors.badRequest("Armada yang dipilih tidak tersedia untuk Client Anda.");
      }
    }
    if (mitraId) {
      const mitra = await ctx.env.DB.prepare(`SELECT kode_mitra, aktif FROM mitras WHERE kode_mitra = ? AND deleted_at IS NULL`)
        .bind(mitraId)
        .first<{ kode_mitra: string; aktif: number }>();
      if (!mitra) throw Errors.badRequest("Mitra yang dipilih tidak ditemukan.");
      if (mitra.aktif !== 1) throw Errors.badRequest("Mitra yang dipilih nonaktif.");
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const { tanggal: tanggalDibuat, jam: jamDibuat } = wibNow(now);
    // ETA is always derived from SLA + the shipment's own start date - never
    // entered directly, and never fabricated when no SLA was given.
    const slaUnit = slaValue !== undefined ? "hari_kerja" : null;
    const estimasiTiba = slaValue !== undefined ? addBusinessDays(tanggalDibuat, slaValue) : null;

    // The AWB number comes from the Client ID resolved on the server (never
    // from the request body for a Client account). Shipment + first timeline
    // event are written in one transaction, and a duplicate AWB - which the
    // shipments.awb PRIMARY KEY would reject - is retried with the next number.
    let awb = "";
    let saved = false;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      awb = await generateClientAwb(ctx.env.DB, customerId);
      try {
        await ctx.env.DB.batch([
          ctx.env.DB.prepare(
            `INSERT INTO shipments (
              awb, tanggal_dibuat, jam_dibuat, status,
              pengirim_nama, pengirim_telepon, pengirim_email,
              penerima_nama, penerima_telepon, penerima_email,
              alamat_asal, kota_asal, alamat_tujuan, kota_tujuan,
              deskripsi_barang, layanan, berat_kg, jumlah_koli, truck_id,
              sla_value, sla_unit, estimasi_tiba, customer_id, mitra_id,
              email_terkirim, created_at, updated_at, created_by, updated_by, created_by_role, created_by_name, reference,
              asuransi, koli_asuransi, nilai_asuransi
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            awb, tanggalDibuat, jamDibuat, holdAtCreate ? "Hold" : "Dalam Persiapan",
            pengirimNama, pengirimTelepon, pengirimEmail,
            penerimaNama, penerimaTelepon, penerimaEmail,
            alamatAsal, kotaAsal, alamatTujuan, kotaTujuan,
            deskripsiBarang, layanan, beratKg, jumlahKoli, truckId ?? null,
            slaValue ?? null, slaUnit, estimasiTiba, customerId, mitraId ?? null,
            nowIso, nowIso, actor.id, actor.id, actor.role, actor.nama, reference,
            asuransi ? 1 : 0, koliAsuransi, nilaiAsuransi,
          ),
          ctx.env.DB.prepare(
            `INSERT INTO shipment_timeline_events (id, awb, seq, type, lokasi, tanggal, jam, keterangan, truck_id, input_by_user_id, input_by_name, input_at, created_at)
             VALUES (?, ?, 1, 'Barang Diterima', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(newId(), awb, `Gudang ${kotaAsal}`, tanggalDibuat, jamDibuat, "Barang diterima dan siap dikirim.", truckId ?? null, actor.id, actor.nama, nowIso, nowIso),
          ...(holdAtCreate
            ? [
                ctx.env.DB.prepare(
                  `INSERT INTO shipment_holds (id, awb, previous_status, hold_reason, hold_at, hold_by_user_id, hold_by_name, hold_by_role)
                   VALUES (?, ?, 'Dalam Persiapan', ?, ?, ?, ?, ?)`,
                ).bind(newId(), awb, holdReason, nowIso, actor.id, actor.nama, actor.role),
              ]
            : []),
        ]);
        saved = true;
      } catch (err) {
        // Lost a race on the same Referensi (two requests at once): report the AWB that won.
        if (reference && String((err as Error)?.message ?? "").includes("reference")) {
          await dupReference();
        }
        if (!isDuplicateAwbError(err)) throw err;
      }
    }
    if (!saved) {
      throw Errors.internal("Gagal membuat nomor AWB yang unik. Silakan coba lagi.");
    }

    await writeAuditLog(ctx.env, actor, {
      action: "CREATE_AWB",
      actionLabel: "CREATE AWB",
      module: "Shipment",
      awb,
      description:
        `Resi diterbitkan untuk pengiriman ${kotaAsal} -> ${kotaTujuan}.` +
        (holdAtCreate ? ` Langsung di-Hold. Alasan: ${holdReason}.` : "") +
        (layananFellBack
          ? typeof body.layanan === "string" && body.layanan.trim()
            ? ` Layanan "${body.layanan.trim()}" tidak tersedia di Master Layanan (tidak ditemukan atau nonaktif), otomatis memakai ${layanan}.`
            : ` Layanan tidak diisi, otomatis memakai ${layanan}.`
          : ""),
    });

    return ok({ awb, reference, layanan, layananFallback: layananFellBack, hold: holdAtCreate }, {}, 201);
  });

  router.get("/api/shipments/:awb", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "shipments.view");
    const row = await ctx.env.DB.prepare(
      `SELECT s.*, t.nomor_unit as truck_nomor_unit, t.jenis as truck_jenis, d.nama as truck_driver_nama,
              cd.nama as claim_driver_nama, cd.telepon as claim_driver_telepon,
              ct.id as claim_truck_id, ct.nomor_unit as claim_truck_nomor_unit, ct.jenis as claim_truck_jenis,
              m.nama as mitra_nama,
              rr.status as recovery_status, rr.requested_at as recovery_requested_at, rr.rejection_reason as recovery_rejection_reason,
              ${pickupEvidenceSql("s.awb")} AS has_pickup,
              cr.id as cr_id, cr.status as cr_status, cr.reason as cr_reason, cr.requested_by_name as cr_requested_by_name,
              cr.requested_by_role as cr_requested_by_role, cr.requested_at as cr_requested_at, cr.decided_by_name as cr_decided_by_name,
              cr.decided_by_role as cr_decided_by_role, cr.decided_at as cr_decided_at, cr.decision_reason as cr_decision_reason,
              h.id as h_id, h.previous_status as h_prev, h.hold_reason as h_reason, h.hold_at as h_at, h.hold_by_name as h_by, h.hold_by_role as h_by_role
       FROM shipments s
       LEFT JOIN trucks t ON t.id = s.truck_id
       LEFT JOIN drivers d ON d.id = t.driver_id
       LEFT JOIN drivers cd ON cd.id = s.claim_driver_id
       LEFT JOIN trucks ct ON ct.id = (SELECT id FROM trucks WHERE driver_id = s.claim_driver_id AND deleted_at IS NULL ORDER BY nomor_unit LIMIT 1)
       LEFT JOIN mitras m ON m.kode_mitra = s.mitra_id
       LEFT JOIN order_recovery_requests rr ON rr.id = (
         SELECT x.id FROM order_recovery_requests x WHERE x.awb = s.awb ORDER BY x.requested_at DESC LIMIT 1
       )
       LEFT JOIN shipment_holds h ON h.awb = s.awb AND h.released_at IS NULL
       LEFT JOIN cancellation_requests cr ON cr.id = (
         SELECT y.id FROM cancellation_requests y WHERE y.awb = s.awb ORDER BY y.requested_at DESC LIMIT 1
       )
       WHERE s.awb = ? AND s.deleted_at IS NULL`,
    )
      .bind(params.awb)
      .first<Record<string, unknown>>();
    if (!row) throw Errors.notFound("AWB tidak ditemukan.");
    if ((actor.role === "Viewer" || actor.role === "Driver" || actor.role === "Mitra") && row.status === "Dibatalkan") {
      throw Errors.notFound("AWB tidak ditemukan.");
    }
    if ((actor.role === "Client" || (actor.role === "Viewer" && actor.customerId)) && row.customer_id !== actor.customerId) {
      throw Errors.forbidden("Anda tidak memiliki akses ke pengiriman ini.");
    }
    if (actor.role === "Mitra" && row.mitra_id !== actor.mitraId) {
      throw Errors.forbidden("Anda tidak memiliki akses ke pengiriman ini.");
    }
    if ((actor.role === "Driver" || actor.role === "Mitra") && row.status === "Hold") throw Errors.notFound("AWB tidak ditemukan.");

    const timeline = await ctx.env.DB.prepare(
      `SELECT e.*, t.nomor_unit as truck_nomor_unit, d.nama as truck_driver_nama,
              pt.nomor_unit as truck_sebelumnya_nomor_unit
       FROM shipment_timeline_events e
       LEFT JOIN trucks t ON t.id = e.truck_id
       LEFT JOIN drivers d ON d.id = t.driver_id
       LEFT JOIN trucks pt ON pt.id = e.truck_sebelumnya_id
       WHERE e.awb = ? ORDER BY e.seq ASC`,
    )
      .bind(params.awb)
      .all();

    const pod = await ctx.env.DB.prepare(`SELECT * FROM shipment_pod WHERE awb = ?`).bind(params.awb).first();

    // Every Hold episode, newest first (never overwritten).
    const holds = await ctx.env.DB.prepare(
      `SELECT id, previous_status as previousStatus, hold_reason as holdReason, hold_at as holdAt, hold_by_name as holdBy, hold_by_role as holdByRole,
              released_at as releasedAt, released_by_name as releasedBy, released_by_role as releasedByRole, release_reason as releaseReason
       FROM shipment_holds WHERE awb = ? ORDER BY hold_at DESC`,
    )
      .bind(params.awb)
      .all();

    const files = await ctx.env.DB.prepare(
      `SELECT id, entity_type, entity_id FROM files WHERE (entity_type IN ('shipment_photo','shipment_surat_jalan','pod_barang','pod_surat_jalan') AND entity_id = ?)
         OR (entity_type = 'timeline_photo' AND entity_id IN (SELECT id FROM shipment_timeline_events WHERE awb = ?))
         ORDER BY created_at DESC`,
    )
      .bind(params.awb, params.awb)
      .all();

    return ok({ shipment: forActor(withHoldPolicy(withCancelPolicy(shipmentSummary(row), row, actor), row, actor), actor.role), timeline: timeline.results, pod: pod ?? null, files: files.results ?? [], holds: actor.role === "Mitra" || actor.role === "Driver" ? [] : holds.results ?? [] });
    });

    // Last position reported by the driver ("Perbarui Posisi" button on the
    // driver portal) - so the admin's detail page can show where the unit last
    // reported from, instead of only the driver ever seeing it. Row-level
    // access rules mirror GET /api/shipments/:awb exactly.
    router.get("/api/shipments/:awb/position", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "shipments.view");
    const row = await ctx.env.DB.prepare(
    `SELECT status, customer_id, mitra_id FROM shipments WHERE awb = ? AND deleted_at IS NULL`,
    )
    .bind(params.awb)
    .first<{ status: string; customer_id: string | null; mitra_id: string | null }>();
    if (!row) throw Errors.notFound("AWB tidak ditemukan.");
    if ((actor.role === "Viewer" || actor.role === "Driver" || actor.role === "Mitra") && row.status === "Dibatalkan") {
    throw Errors.notFound("AWB tidak ditemukan.");
    }
    if ((actor.role === "Driver" || actor.role === "Mitra") && row.status === "Hold") throw Errors.notFound("AWB tidak ditemukan.");
    if ((actor.role === "Client" || (actor.role === "Viewer" && actor.customerId)) && row.customer_id !== actor.customerId) {
    throw Errors.forbidden("Anda tidak memiliki akses ke pengiriman ini.");
    }
    if (actor.role === "Mitra" && row.mitra_id !== actor.mitraId) {
    throw Errors.forbidden("Anda tidak memiliki akses ke pengiriman ini.");
    }

    const lastPosition = await ctx.env.DB.prepare(
    `SELECT p.latitude, p.longitude, p.accuracy, p.created_at, u.nama as driver_nama
    FROM driver_position_reports p
    LEFT JOIN users u ON u.id = p.driver_user_id
    WHERE p.awb = ?
    ORDER BY p.created_at DESC LIMIT 1`,
    )
    .bind(params.awb)
    .first();

    return ok({ lastPosition: lastPosition ?? null });
    });

    router.patch("/api/shipments/:awb", async (ctx: Ctx, params) => {
    // Superadmin/Admin edit any open shipment. A Client may edit ALL data of its
    // own customer's shipments, but only while still "Dalam Persiapan" - and never
    // the internal fields (SLA/ETA, truck, mitra), which stay admin-only.
    const actor = requireAuth(ctx);
    const isClient = actor.role === "Client";
    if (!isClient) requirePermission(ctx, "shipments.update_info");
    const shipment = await ctx.env.DB.prepare(
      `SELECT status, tanggal_dibuat, sla_value, estimasi_tiba, layanan, customer_id, jumlah_koli FROM shipments WHERE awb = ? AND deleted_at IS NULL`,
    )
      .bind(params.awb)
      .first<{ status: string; tanggal_dibuat: string; sla_value: number | null; estimasi_tiba: string | null; layanan: string; customer_id: string | null; jumlah_koli: number }>();
    if (!shipment) throw Errors.notFound("AWB tidak ditemukan.");
    if (isClient) {
      if (!actor.customerId || shipment.customer_id !== actor.customerId) throw Errors.forbidden("Anda tidak memiliki akses ke pengiriman ini.");
      if (shipment.status !== "Dalam Persiapan" && shipment.status !== "Hold") {
        throw Errors.unprocessable("Data pengiriman hanya bisa diubah selama status masih Dalam Persiapan.");
      }
    } else if (shipment.status === "Selesai / Terkirim" || shipment.status === "Dibatalkan") {
      throw Errors.unprocessable("Pengiriman yang sudah Selesai/Terkirim atau Dibatalkan tidak bisa diubah lagi.");
    }

    const body = await parseJsonBody(ctx.request);
    const pengirimNama = reqString(body, "pengirimNama", { max: 100 });
    const pengirimTelepon = reqString(body, "pengirimTelepon", { max: 30 });
    const pengirimEmail = reqEmail(body, "pengirimEmail");
    const penerimaNama = reqString(body, "penerimaNama", { max: 100 });
    const penerimaTelepon = reqString(body, "penerimaTelepon", { max: 30 });
    const penerimaEmail = reqEmail(body, "penerimaEmail");
    const alamatAsal = reqString(body, "alamatAsal", { max: 300 });
    const kotaAsal = reqString(body, "kotaAsal", { max: 80 });
    const alamatTujuan = reqString(body, "alamatTujuan", { max: 300 });
    const kotaTujuan = reqString(body, "kotaTujuan", { max: 80 });
    // SLA is optional in this payload (older callers won't send it) - only
    // touch sla/eta when the field is actually present in the request.
    const slaProvided = !isClient && Object.prototype.hasOwnProperty.call(body, "slaValue");
    const slaValue = slaProvided ? optNumber(body, "slaValue", { min: 1, max: 365 }) : undefined;

    const sets = [
      "pengirim_nama=?", "pengirim_telepon=?", "pengirim_email=?", "penerima_nama=?", "penerima_telepon=?", "penerima_email=?",
      "alamat_asal=?", "kota_asal=?", "alamat_tujuan=?", "kota_tujuan=?", "updated_at=?", "updated_by=?",
    ];
    const values: unknown[] = [
      pengirimNama, pengirimTelepon, pengirimEmail, penerimaNama, penerimaTelepon, penerimaEmail,
      alamatAsal, kotaAsal, alamatTujuan, kotaTujuan, new Date().toISOString(), actor.id,
    ];
    // Barang details: optional, only touched when sent (older callers omit them).
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
    if (has("deskripsiBarang")) {
      sets.push("deskripsi_barang=?");
      values.push(optString(body, "deskripsiBarang") ?? "");
    }
    if (has("beratKg")) {
      sets.push("berat_kg=?");
      values.push(reqNumber(body, "beratKg", { min: 0.01, max: 100000 }));
    }
    if (has("jumlahKoli")) {
      sets.push("jumlah_koli=?");
      values.push(reqNumber(body, "jumlahKoli", { min: 1, max: 100000 }));
    }
    // Insurance: only touched when the "asuransi" key is present.
    // Asuransi fields are ONLY editable while status is "Dalam Persiapan" or "Hold"
    // (before the cargo has been picked up). Once the order moves past preparation,
    // insurance data is locked.
    if (has("asuransi")) {
      if (shipment.status !== "Dalam Persiapan" && shipment.status !== "Hold") {
        throw Errors.unprocessable("Data asuransi hanya dapat diubah selama status masih Dalam Persiapan.");
      }
      const asuransiOn = body.asuransi === true;
      if (asuransiOn) {
        const rawKoli = optString(body, "koliAsuransi");
        if (!rawKoli || !rawKoli.trim()) throw Errors.badRequest("Nomor koli yang diasuransikan wajib diisi ketika Asuransi = Ya.");
        const koliText = rawKoli.trim();
        if (koliText.length > 500) throw Errors.badRequest("Nomor koli yang diasuransikan maksimal 500 karakter.");
        const nilaiAsuransi = optNumber(body, "nilaiAsuransi", { min: 1, max: 10_000_000_000 }) ?? null;
        if (nilaiAsuransi === null || nilaiAsuransi <= 0) {
          throw Errors.badRequest("Nilai barang yang diasuransikan wajib diisi dan lebih dari 0 ketika Asuransi = Ya.");
        }
        sets.push("asuransi=?", "koli_asuransi=?", "nilai_asuransi=?");
        values.push(1, koliText, nilaiAsuransi);
      } else {
        sets.push("asuransi=?", "koli_asuransi=?", "nilai_asuransi=?");
        values.push(0, null, null);
      }
    }
    let newEta: string | null = shipment.estimasi_tiba;
    if (slaProvided) {
      newEta = slaValue !== undefined ? addBusinessDays(shipment.tanggal_dibuat, slaValue) : null;
      sets.push("sla_value=?", "sla_unit=?", "estimasi_tiba=?");
      values.push(slaValue ?? null, slaValue !== undefined ? "hari_kerja" : null, newEta);
    }

    // Layanan is optional on edit (older callers don't send it). Omitted, or
    // the same value the order already has, leaves it untouched - so editing
    // other fields never rewrites a layanan that was deactivated later. A
    // CHANGE must be to an active Master Layanan entry: unlike order
    // creation there is no silent LTL fallback here, because overwriting a
    // deliberate existing choice on a typo would be worse than an error.
    let layananChange: { from: string; to: string } | null = null;
    if (typeof body.layanan === "string" && body.layanan.trim().toLowerCase() !== shipment.layanan.toLowerCase()) {
      const valid = await findActiveLayanan(ctx.env, body.layanan);
      if (!valid) {
        throw Errors.badRequest(`Layanan "${body.layanan.trim()}" tidak tersedia atau tidak aktif di Master Layanan.`);
      }
      if (valid !== shipment.layanan) {
        sets.push("layanan=?");
        values.push(valid);
        layananChange = { from: shipment.layanan, to: valid };
      }
    }
    values.push(params.awb);

    await ctx.env.DB.prepare(`UPDATE shipments SET ${sets.join(", ")} WHERE awb=?`).bind(...values).run();

    await writeAuditLog(ctx.env, actor, {
      action: "UPDATE_SHIPMENT_INFO",
      actionLabel: "UPDATE SHIPMENT INFO",
      module: "Shipment",
      awb: params.awb,
      description: "Data pengiriman diperbarui.",
    });

    if (layananChange) {
      await writeAuditLog(ctx.env, actor, {
        action: "UPDATE_LAYANAN_ORDER",
        actionLabel: "UPDATE LAYANAN ORDER",
        module: "Shipment",
        awb: params.awb,
        description: `Layanan: ${layananChange.from} -> ${layananChange.to}.`,
      });
    }

    if (slaProvided && slaValue !== shipment.sla_value) {
      await writeAuditLog(ctx.env, actor, {
        action: "UPDATE_ETA",
        actionLabel: "UPDATE ETA",
        module: "Shipment",
        awb: params.awb,
        description: `Target Pengiriman: ${shipment.sla_value ?? "-"} -> ${slaValue ?? "-"} Hari. ETA: ${shipment.estimasi_tiba ?? "-"} -> ${newEta ?? "-"}.`,
      });
    }

    return ok({ updated: true });
  });

  // Narrow, self-service address correction for Client - unlike the
  // full PATCH /api/shipments/:awb above (Superadmin/Admin only, any
  // field), this only ever touches alamat/kota asal & tujuan, only while
  // the shipment is still "Dalam Persiapan" (before a truck has actually
  // departed), and only for the Client's own customer_id.
  router.patch("/api/shipments/:awb/alamat", async (ctx: Ctx, params) => {
    const actor = requireAuth(ctx);
    if (actor.role !== "Client" && actor.role !== "Superadmin" && actor.role !== "Admin") {
      throw Errors.forbidden();
    }
    const shipment = await ctx.env.DB.prepare(`SELECT status, customer_id FROM shipments WHERE awb = ? AND deleted_at IS NULL`)
      .bind(params.awb)
      .first<{ status: string; customer_id: string | null }>();
    if (!shipment) throw Errors.notFound("AWB tidak ditemukan.");
    if (actor.role === "Client") {
      if (shipment.customer_id !== actor.customerId) throw Errors.forbidden("Anda tidak memiliki akses ke pengiriman ini.");
      if (shipment.status !== "Dalam Persiapan" && shipment.status !== "Hold") {
        throw Errors.unprocessable("Alamat hanya bisa diubah selama status masih Dalam Persiapan.");
      }
    } else if (shipment.status === "Selesai / Terkirim" || shipment.status === "Dibatalkan") {
      throw Errors.unprocessable("Pengiriman ini sudah terkunci dan tidak bisa diubah.");
    }

    const body = await parseJsonBody(ctx.request);
    const alamatAsal = reqString(body, "alamatAsal", { max: 300 });
    const kotaAsal = reqString(body, "kotaAsal", { max: 80 });
    const alamatTujuan = reqString(body, "alamatTujuan", { max: 300 });
    const kotaTujuan = reqString(body, "kotaTujuan", { max: 80 });

    await ctx.env.DB.prepare(
      `UPDATE shipments SET alamat_asal = ?, kota_asal = ?, alamat_tujuan = ?, kota_tujuan = ?, updated_at = ?, updated_by = ? WHERE awb = ?`,
    )
      .bind(alamatAsal, kotaAsal, alamatTujuan, kotaTujuan, new Date().toISOString(), actor.id, params.awb)
      .run();

    await writeAuditLog(ctx.env, actor, {
      action: "UPDATE_SHIPMENT_INFO",
      actionLabel: "UPDATE ALAMAT",
      module: "Shipment",
      awb: params.awb,
      description: `Alamat pengiriman diperbarui oleh ${actor.nama}.`,
    });

    return ok({ updated: true });
  });

  router.post("/api/shipments/:awb/timeline", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "tracking.update");
    const shipment = await ctx.env.DB.prepare(`SELECT * FROM shipments WHERE awb = ? AND deleted_at IS NULL`).bind(params.awb).first<
      Record<string, unknown>
    >();
    if (!shipment) throw Errors.notFound("AWB tidak ditemukan.");
    if (shipment.status === "Selesai / Terkirim" || shipment.status === "Dibatalkan") {
      throw Errors.unprocessable("Pengiriman ini sudah Selesai/Terkirim atau Dibatalkan, dan terkunci.");
    }
    if (shipment.status === "Hold") {
      throw Errors.unprocessable("Pengiriman ini sedang di-Hold dan belum boleh diproses. Lepas Hold terlebih dahulu.");
    }
    if (actor.role === "Driver") {
      const owns = await ctx.env.DB.prepare(
        `SELECT 1 FROM trucks t JOIN drivers d ON d.id = t.driver_id WHERE t.id = ? AND d.user_id = ?`,
      )
        .bind(shipment.truck_id, actor.id)
        .first();
      if (!owns) throw Errors.forbidden("Pengiriman ini bukan tugas Anda.");
    }
    if (actor.role === "Mitra") {
      if (shipment.mitra_id !== actor.mitraId) throw Errors.forbidden("Pengiriman ini bukan tugas Mitra Anda.");
    }

    const body = await parseJsonBody(ctx.request);
    const type = reqEnum(body, "type", TIMELINE_EVENT_TYPES.filter((t) => t !== "Barang Diterima") as readonly TimelineEventType[]);
    // Diverting or pulling back a shipment is an operations/admin decision, like a truck transfer.
    if ((type === "Re-route" || type === "Penarikan") && (actor.role === "Driver" || actor.role === "Mitra")) {
      throw Errors.forbidden(`Status ${type} hanya dapat dicatat oleh admin.`);
    }
    const tanggal = reqString(body, "tanggal");
    const jam = reqString(body, "jam");
    const keterangan = reqString(body, "keterangan", { max: 500 });
    const truckId = optString(body, "truckId");
    const titikId = optString(body, "titikId");
    // A driver/mitra reports their own operational progress only -
    // reassigning the truck (including via a Transfer Unit event) is a
    // dispatch/admin decision. truckId is only treated as a change attempt
    // when it actually differs from the shipment's current truck, since the
    // form always submits the current value alongside every ordinary update.
    const truckIdChanged = !!truckId && truckId !== shipment.truck_id;
    if ((actor.role === "Driver" || actor.role === "Mitra") && (type === "Transfer Unit" || truckIdChanged)) {
      throw Errors.forbidden(
        actor.role === "Driver" ? "Driver tidak dapat mengubah unit truck." : "Mitra tidak dapat mengubah unit truck.",
      );
    }
    const isSelesai = type === "Selesai / Terkirim";
    const lokasi = isSelesai ? String(shipment.kota_tujuan) : reqString(body, "lokasi", { max: 150 });
    const namaPenerima = isSelesai ? reqString(body, "namaPenerima", { max: 100 }) : undefined;

    if (!isForwardTransition(String(shipment.status), type)) {
      throw Errors.unprocessable(
        `Status "${type}" tidak bisa dipilih dari status saat ini ("${shipment.status}") - pipeline tidak bisa dibuat mundur.`,
      );
    }
    if (truckId) {
      const truck = await ctx.env.DB.prepare(`SELECT id FROM trucks WHERE id = ? AND deleted_at IS NULL`).bind(truckId).first();
      if (!truck) throw Errors.badRequest("Truck yang dipilih tidak ditemukan.");
    }

    const newStatus = eventTypeToShipmentStatus(type);
    const nowIso = new Date().toISOString();
    const seqRow = await ctx.env.DB.prepare(`SELECT COALESCE(MAX(seq), 0) + 1 as next FROM shipment_timeline_events WHERE awb = ?`)
      .bind(params.awb)
      .first<{ next: number }>();
    const seq = seqRow?.next ?? 1;
    const isTransfer = type === "Transfer Unit";
    const previousTruckId = isTransfer ? (shipment.truck_id as string | null) : null;
    const eventId = newId();

    await ctx.env.DB.prepare(
      `INSERT INTO shipment_timeline_events (id, awb, seq, type, lokasi, titik_id, tanggal, jam, keterangan, truck_id, truck_sebelumnya_id, input_by_user_id, input_by_name, input_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(eventId, params.awb, seq, type, lokasi, titikId ?? null, tanggal, jam, keterangan, truckId ?? shipment.truck_id ?? null, previousTruckId, actor.id, actor.nama, nowIso, nowIso)
      .run();

    await ctx.env.DB.prepare(`UPDATE shipments SET status = ?, truck_id = COALESCE(?, truck_id), updated_at = ?, updated_by = ? WHERE awb = ?`)
      .bind(newStatus, truckId ?? null, nowIso, actor.id, params.awb)
      .run();

    // --- ETA recalculation on Berangkat ---
    // When the shipment first departs, ETA is recalculated from the actual
    // departure date (the timeline event's "tanggal") instead of the order
    // creation date. This applies to both normal orders and those that came
    // through Hold → UNHOLD → Berangkat. A second Berangkat event is
    // impossible (pipeline rank prevents backward transitions), so this runs
    // exactly once.
    if (newStatus === "Berangkat") {
      const slaValue = shipment.sla_value as number | null;
      if (slaValue != null) {
        const newEta = addBusinessDays(tanggal, slaValue);
        await ctx.env.DB.prepare(
          `UPDATE shipments SET estimasi_tiba = ?, updated_at = ?, updated_by = ? WHERE awb = ?`,
        )
          .bind(newEta, nowIso, actor.id, params.awb)
          .run();
        await writeAuditLog(ctx.env, actor, {
          action: "UPDATE_ETA",
          actionLabel: "UPDATE ETA",
          module: "Shipment",
          awb: params.awb,
          description: `Status berubah menjadi Berangkat. ETA diperbarui: ${shipment.estimasi_tiba ?? "-"} -> ${newEta}.`,
        });
      }
    }

    // Cargo is moving: a still-pending cancellation request can no longer be honoured.
    await ctx.env.DB.prepare(
      `UPDATE cancellation_requests SET status = 'EXPIRED', decided_at = ?, decided_by_name = 'System', decided_by_role = 'System', decision_reason = ?
       WHERE awb = ? AND status = 'PENDING'`,
    )
      .bind(nowIso, `Status order berubah menjadi ${newStatus} sebelum Client memberi keputusan.`, params.awb)
      .run();

    if (isSelesai) {
      await ctx.env.DB.prepare(
        `INSERT INTO shipment_pod (awb, tanggal, jam, lokasi, nama_penerima, catatan, delivered_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(params.awb, tanggal, jam, lokasi, namaPenerima, keterangan, nowIso, nowIso)
        .run();
    }

    const actionMap: Record<string, { action: string; label: string; description: string }> = {
      "Transfer Unit": { action: "TRANSFER_TRUCK", label: "TRANSFER TRUCK", description: `Truck dipindahkan di ${lokasi}.` },
      Kendala: { action: "ADD_ISSUE", label: "ADD ISSUE", description: `Kendala dicatat: ${keterangan}` },
      "Re-route": { action: "REROUTE_SHIPMENT", label: "REROUTE SHIPMENT", description: `Pengiriman dialihkan (re-route) di ${lokasi}: ${keterangan}` },
      Penarikan: { action: "PULLBACK_SHIPMENT", label: "PULLBACK SHIPMENT", description: `Penarikan barang ke gudang asal dicatat di ${lokasi}: ${keterangan}` },
    };
    if (isSelesai) {
      await writeAuditLog(ctx.env, actor, { action: "UPLOAD_POD", actionLabel: "UPLOAD POD", module: "Shipment", awb: params.awb, description: "Bukti serah terima dicatat." });
      await writeAuditLog(ctx.env, actor, { action: "CLOSE_SHIPMENT", actionLabel: "CLOSE SHIPMENT", module: "Shipment", awb: params.awb, description: `Status berubah: ${shipment.status} -> Selesai / Terkirim. Data dikunci.` });
    } else if (actionMap[type]) {
      const a = actionMap[type];
      await writeAuditLog(ctx.env, actor, { action: a.action, actionLabel: a.label, module: "Shipment", awb: params.awb, description: a.description });
    } else {
      await writeAuditLog(ctx.env, actor, { action: "UPDATE_STATUS", actionLabel: "UPDATE STATUS", module: "Shipment", awb: params.awb, description: `Status berubah: ${shipment.status} -> ${newStatus} (${lokasi}).` });
    }

    if (type === "Kendala" || isSelesai) {
      const trigger = type === "Kendala" ? "KENDALA" : "SELESAI";
      const subject = type === "Kendala"
        ? `Update Pengiriman - Terdapat Kendala (AWB ${params.awb})`
        : `Pengiriman Anda Telah Selesai (AWB ${params.awb})`;
      await ctx.env.DB.prepare(
        `INSERT INTO notifications (id, awb, trigger_type, subject, to_email, to_name, recipient_role, created_at) VALUES (?, ?, ?, ?, ?, ?, 'penerima', ?)`,
      )
        .bind(newId(), params.awb, trigger, subject, shipment.penerima_email, shipment.penerima_nama, nowIso)
        .run();
      await writeAuditLog(ctx.env, null, {
        action: "SEND_NOTIFICATION",
        actionLabel: "SEND NOTIFICATION",
        module: "Notification",
        awb: params.awb,
        description: `Notifikasi "${subject}" dibuat untuk customer.`,
      });
    }

    return ok({ updated: true, status: newStatus, eventId }, {}, 201);
  });

  router.patch("/api/shipments/:awb/pod-photo", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "tracking.update");
    const pod = await ctx.env.DB.prepare(`SELECT delivered_at FROM shipment_pod WHERE awb = ?`).bind(params.awb).first<{
      delivered_at: string;
    }>();
    if (!pod) throw Errors.notFound("POD untuk AWB ini belum ada.");

    const deliveredAtMs = new Date(pod.delivered_at).getTime();
    if (Date.now() - deliveredAtMs > POD_EDIT_WINDOW_MS) {
      throw Errors.unprocessable("Batas waktu 30 hari untuk mengganti foto POD sudah lewat.");
    }

    const body = await parseJsonBody(ctx.request);
    const fotoFileId = optString(body, "fotoFileId");
    const slot = optString(body, "slot");
    const isSuratJalan = slot === "suratJalan";

    await ctx.env.DB.prepare(`UPDATE shipment_pod SET updated_at = ? WHERE awb = ?`)
      .bind(new Date().toISOString(), params.awb)
      .run();

    if (fotoFileId) {
      await ctx.env.DB.prepare(`UPDATE files SET entity_id = ? WHERE id = ?`).bind(params.awb, fotoFileId).run();
    }

    await writeAuditLog(ctx.env, actor, {
      action: "UPDATE_POD_PHOTO",
      actionLabel: "UPDATE POD PHOTO",
      module: "Shipment",
      awb: params.awb,
      description: isSuratJalan
        ? "Foto surat jalan (bukti serah terima) diganti."
        : "Foto barang diterima (bukti serah terima) diganti.",
    });

    return ok({ updated: true });
  });

  // The unit a claiming driver would run the shipment with: the truck assigned to
  // that driver in Master Armada. One definition for the list, confirm and reject
  // so what the admin sees is exactly what gets assigned.
  const CLAIM_TRUCK_ID = `(SELECT id FROM trucks WHERE driver_id = s.claim_driver_id AND deleted_at IS NULL ORDER BY nomor_unit LIMIT 1)`;

  // Shipments a driver has requested to claim - across all AWBs, so admin
  // doesn't have to open each shipment detail to notice a pending request.
  router.get("/api/shipments/claims/pending", async (ctx: Ctx) => {
    requirePermission(ctx, "shipments.update_info");
    const rows = await ctx.env.DB.prepare(
      `SELECT s.awb, s.kota_asal, s.kota_tujuan, s.alamat_tujuan, s.deskripsi_barang, s.claim_requested_at,
              d.id as driver_id, d.nama as driver_nama, d.telepon as driver_telepon,
              t.id as truck_id, t.nomor_unit as truck_nomor_unit, t.jenis as truck_jenis
       FROM shipments s
       JOIN drivers d ON d.id = s.claim_driver_id
       LEFT JOIN trucks t ON t.id = ${CLAIM_TRUCK_ID}
       WHERE s.claim_status = 'pending' AND s.deleted_at IS NULL
       ORDER BY s.claim_requested_at ASC`,
    ).all();
    return ok({
      items: (rows.results ?? []).map((row: Record<string, unknown>) => ({
        awb: row.awb,
        kotaAsal: row.kota_asal,
        kotaTujuan: row.kota_tujuan,
        alamatTujuan: row.alamat_tujuan,
        deskripsiBarang: row.deskripsi_barang,
        claimRequestedAt: row.claim_requested_at,
        driver: { id: row.driver_id, nama: row.driver_nama, telepon: row.driver_telepon },
        truck: row.truck_id ? { id: row.truck_id, nomorUnit: row.truck_nomor_unit, jenis: row.truck_jenis } : null,
      })),
    });
  });

  const CLAIM_PROCESSED = "Request sudah diproses oleh user lain.";
  const CLAIM_CHANGED = "Data driver/unit pada request ini sudah berubah sejak halaman dibuka. Muat ulang halaman lalu periksa kembali sebelum memutuskan.";

  /** Loads the pending claim exactly as it stands NOW (driver + the unit it would
   * use) and, when the caller says which driver/unit it was looking at, refuses to
   * go on if either has changed - never silently acting on stale data. */
  async function loadPendingClaim(ctx: Ctx, awb: string) {
    const row = await ctx.env.DB.prepare(
      `SELECT s.claim_status, s.claim_driver_id, d.id AS driver_id, d.nama AS driver_nama,
              t.id AS truck_id, t.nomor_unit AS truck_nomor_unit, t.jenis AS truck_jenis
       FROM shipments s
       LEFT JOIN drivers d ON d.id = s.claim_driver_id
       LEFT JOIN trucks t ON t.id = ${CLAIM_TRUCK_ID}
       WHERE s.awb = ? AND s.deleted_at IS NULL`,
    )
      .bind(awb)
      .first<{
        claim_status: string | null;
        claim_driver_id: string | null;
        driver_id: string | null;
        driver_nama: string | null;
        truck_id: string | null;
        truck_nomor_unit: string | null;
        truck_jenis: string | null;
      }>();
    if (!row) throw Errors.notFound("AWB tidak ditemukan.");
    if (row.claim_status !== "pending" || !row.claim_driver_id) throw Errors.conflict(CLAIM_PROCESSED);
    if (!row.driver_id) throw Errors.unprocessable("Driver pada request ini sudah tidak valid.");

    const body = await parseJsonBody(ctx.request).catch(() => ({}) as Record<string, unknown>);
    const expDriver = optString(body, "driverId");
    const expTruck = optString(body, "truckId");
    if ((expDriver !== undefined && expDriver !== row.driver_id) || (expTruck !== undefined && expTruck !== (row.truck_id ?? ""))) {
      throw Errors.conflict(CLAIM_CHANGED);
    }
    return row;
  }

  // Approves a driver's claim request - actually assigns the driver's
  // truck, which is what makes the shipment show up on their dashboard.
  router.post("/api/shipments/:awb/claim/confirm", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "shipments.update_info");
    const claim = await loadPendingClaim(ctx, params.awb);
    if (!claim.truck_id) throw Errors.badRequest("Driver ini belum memiliki unit truck di Master Armada.");
    const held = await ctx.env.DB.prepare(`SELECT 1 FROM shipments WHERE awb = ? AND status = 'Hold'`).bind(params.awb).first();
    if (held) throw Errors.unprocessable("Pengiriman ini sedang di-Hold, penugasan driver tidak dapat dikonfirmasi. Lepas Hold terlebih dahulu.");

    const now = new Date().toISOString();
    // Atomic: only the first reviewer's update still finds the claim pending for this driver.
    const res = await ctx.env.DB.prepare(
      `UPDATE shipments SET truck_id = ?, claim_status = NULL, claim_driver_id = NULL, claim_requested_at = NULL,
              updated_at = ?, updated_by = ?
       WHERE awb = ? AND claim_status = 'pending' AND claim_driver_id = ? AND status != 'Hold'`,
    )
      .bind(claim.truck_id, now, actor.id, params.awb, claim.driver_id)
      .run();
    if ((res.meta?.changes ?? 0) === 0) throw Errors.conflict(CLAIM_PROCESSED);

    await writeAuditLog(ctx.env, actor, {
      action: "CONFIRM_CLAIM",
      actionLabel: "CONFIRM CLAIM",
      module: "Shipment",
      awb: params.awb,
      description: `Klaim driver ${claim.driver_nama} dikonfirmasi - pengiriman ditugaskan ke unit ${claim.truck_nomor_unit}${claim.truck_jenis ? ` (${claim.truck_jenis})` : ""}.`,
    });

    return ok({ confirmed: true, truckId: claim.truck_id });
  });

  // Declines a driver's claim request - shipment goes back to the open
  // pool for other drivers, unchanged otherwise.
  router.post("/api/shipments/:awb/claim/reject", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "shipments.update_info");
    const claim = await loadPendingClaim(ctx, params.awb);

    const res = await ctx.env.DB.prepare(
      `UPDATE shipments SET claim_status = NULL, claim_driver_id = NULL, claim_requested_at = NULL
       WHERE awb = ? AND claim_status = 'pending' AND claim_driver_id = ?`,
    )
      .bind(params.awb, claim.driver_id)
      .run();
    if ((res.meta?.changes ?? 0) === 0) throw Errors.conflict(CLAIM_PROCESSED);

    await writeAuditLog(ctx.env, actor, {
      action: "REJECT_CLAIM",
      actionLabel: "REJECT CLAIM",
      module: "Shipment",
      awb: params.awb,
      description: `Klaim driver ${claim.driver_nama}${claim.truck_nomor_unit ? ` (unit ${claim.truck_nomor_unit}${claim.truck_jenis ? `, ${claim.truck_jenis}` : ""})` : ""} ditolak - pengiriman dikembalikan ke daftar terbuka.`,
    });

    return ok({ rejected: true });
  });

  // Unassigns an already-confirmed driver, sending the shipment back to
  // the open pool - only while nothing has actually happened yet (still
  // "Dalam Persiapan"), so an en-route shipment can't be yanked from under
  // a driver mid-trip.
  router.post("/api/shipments/:awb/unassign", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "shipments.update_info");
    const shipment = await ctx.env.DB.prepare(`SELECT status, truck_id FROM shipments WHERE awb = ? AND deleted_at IS NULL`)
      .bind(params.awb)
      .first<{ status: string; truck_id: string | null }>();
    if (!shipment) throw Errors.notFound("AWB tidak ditemukan.");
    if (!shipment.truck_id) throw Errors.badRequest("Pengiriman ini belum ditugaskan ke driver manapun.");
    if (shipment.status !== "Dalam Persiapan") {
      throw Errors.unprocessable(
        "Pengiriman yang sudah berjalan (status selain Dalam Persiapan) tidak bisa dibatalkan penugasannya.",
      );
    }

    await ctx.env.DB.prepare(
      `UPDATE shipments SET truck_id = NULL, updated_at = ?, updated_by = ? WHERE awb = ?`,
    )
      .bind(new Date().toISOString(), actor.id, params.awb)
      .run();

    await writeAuditLog(ctx.env, actor, {
      action: "UNASSIGN_DRIVER",
      actionLabel: "UNASSIGN DRIVER",
      module: "Shipment",
      awb: params.awb,
      description: "Penugasan driver dibatalkan - pengiriman dikembalikan ke daftar terbuka.",
    });

    return ok({ unassigned: true });
  });

  // Forwards/assigns (or reassigns/unassigns, mitraId: null) a shipment to a
  // Mitra - Superadmin/Admin only (same permission as every other
  // dispatch/assignment action here), never the Mitra itself, which has no
  // "shipments.update_info" permission at all (see rbac.ts).
  router.post("/api/shipments/:awb/assign-mitra", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "shipments.update_info");
    const shipment = await ctx.env.DB.prepare(`SELECT status, mitra_id FROM shipments WHERE awb = ? AND deleted_at IS NULL`)
      .bind(params.awb)
      .first<{ status: string; mitra_id: string | null }>();
    if (!shipment) throw Errors.notFound("AWB tidak ditemukan.");
    if (shipment.status === "Selesai / Terkirim" || shipment.status === "Dibatalkan") {
      throw Errors.unprocessable("Pengiriman yang sudah Selesai/Terkirim atau Dibatalkan tidak bisa diubah lagi.");
    }
    if (shipment.status === "Hold") throw Errors.unprocessable("Pengiriman yang sedang di-Hold tidak dapat diteruskan ke Mitra. Lepas Hold terlebih dahulu.");

    const body = await parseJsonBody(ctx.request);
    const mitraIdProvided = Object.prototype.hasOwnProperty.call(body, "mitraId");
    const mitraId = mitraIdProvided ? optString(body, "mitraId") ?? null : undefined;
    if (mitraId === undefined) throw Errors.badRequest("mitraId wajib dikirim (boleh null untuk membatalkan penugasan).");

    let mitraNama: string | null = null;
    if (mitraId) {
      const mitra = await ctx.env.DB.prepare(`SELECT kode_mitra, nama, aktif FROM mitras WHERE kode_mitra = ? AND deleted_at IS NULL`)
        .bind(mitraId)
        .first<{ kode_mitra: string; nama: string; aktif: number }>();
      if (!mitra) throw Errors.badRequest("Mitra yang dipilih tidak ditemukan.");
      if (mitra.aktif !== 1) throw Errors.badRequest("Mitra yang dipilih nonaktif.");
      mitraNama = mitra.nama;
    }

    await ctx.env.DB.prepare(`UPDATE shipments SET mitra_id = ?, updated_at = ?, updated_by = ? WHERE awb = ?`)
      .bind(mitraId, new Date().toISOString(), actor.id, params.awb)
      .run();

    await writeAuditLog(ctx.env, actor, {
      action: mitraId ? "ASSIGN_MITRA" : "UNASSIGN_MITRA",
      actionLabel: mitraId ? "ASSIGN MITRA" : "UNASSIGN MITRA",
      module: "Shipment",
      awb: params.awb,
      description: mitraId
        ? `Pengiriman diteruskan ke Mitra ${mitraNama} (${mitraId}).`
        : `Penugasan Mitra dibatalkan - pengiriman dikembalikan ke status belum diteruskan.`,
    });

    return ok({ mitraId, mitraNama });
  });
}
