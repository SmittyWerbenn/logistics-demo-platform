import type { Router } from "../router";
import type { Ctx, AuthedUser } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody, reqString, optString, optNumber, optBool } from "../validate";
import { requirePermission } from "../authMiddleware";
import { writeAuditLog } from "../audit";
import { newId } from "../crypto";

/**
 * Ekspedisi - Order & Price Management (Phase 1).
 * Captures operational knowledge (living price table, payment schemes,
 * customer preferences) so operations survive an admin leaving.
 * Not a TMS: no tracking/fleet here.
 */

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const ORDER_STATUSES = ["Baru", "Dijemput", "Dikirim", "Tiba", "Selesai", "Batal"] as const;
const RECV_STATUSES = ["Belum Ditagih", "Ditagih", "Lunas"] as const;
const UNITS = ["kg", "koli", "flat"] as const;
const SCHEMES = ["PAD", "TOP", "CASH"] as const;

async function getSetting(ctx: Ctx, key: string, fallback: string): Promise<string> {
  const r = await ctx.env.DB.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first<{ value: string }>();
  return r?.value ?? fallback;
}
async function setSetting(ctx: Ctx, key: string, value: string, actor: AuthedUser) {
  await ctx.env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  ).bind(key, value, now(), actor.id).run();
}

function pickEnum<T extends string>(v: unknown, allowed: readonly T[], label: string): T {
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw Errors.badRequest(`${label} harus salah satu dari: ${allowed.join(", ")}.`);
  }
  return v as T;
}
const idOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

function mapCustomer(r: Row) {
  return {
    id: r.id, nama: r.nama, npwp: r.npwp, pic: r.pic, telepon: r.telepon, email: r.email, alamat: r.alamat,
    paymentScheme: r.payment_scheme, termDays: r.term_days, preferences: r.preferences, notes: r.notes,
    aktif: r.aktif === 1, createdAt: r.created_at,
  };
}
function mapRoute(r: Row) {
  return {
    id: r.id, asal: r.asal, tujuan: r.tujuan, publishRate: r.publish_rate, unit: r.unit,
    transitDays: r.transit_days, notes: r.notes, aktif: r.aktif === 1,
  };
}

interface Resolved { price: number | null; unit: string; source: "exact" | "route_sender" | "publish" | "manual"; priceId: string | null; label: string }

/** Fallback: exact (route+sender+receiver+payer) -> route+sender -> publish rate -> manual. */
async function resolvePrice(ctx: Ctx, q: { routeId: string | null; senderId: string | null; receiverId: string | null; payerId: string | null; goodsType: string | null; weight: number | null }): Promise<Resolved> {
  if (q.routeId) {
    const rows = (await ctx.env.DB.prepare(`SELECT * FROM ep_prices WHERE route_id = ? AND deleted_at IS NULL`).bind(q.routeId).all<Row>()).results ?? [];
    const match = (r: Row, withRecvPayer: boolean) => {
      if (q.senderId && r.sender_id !== q.senderId) return false;
      if (!q.senderId && r.sender_id) return false;
      if (withRecvPayer) {
        if ((r.receiver_id ?? null) !== (q.receiverId ?? null)) return false;
        if ((r.payer_id ?? null) !== (q.payerId ?? null)) return false;
      } else {
        if (r.receiver_id || r.payer_id) return false;
      }
      if (r.goods_type && q.goodsType && String(r.goods_type).toLowerCase() !== q.goodsType.toLowerCase()) return false;
      if (r.goods_type && !q.goodsType) return false;
      if (r.min_weight != null && (q.weight ?? 0) < (r.min_weight as number)) return false;
      return true;
    };
    // Prefer the most specific (goods type + highest min_weight) within a tier.
    const rank = (r: Row) => (r.goods_type ? 1000 : 0) + ((r.min_weight as number) ?? 0);
    for (const [tier, withRP, source, label] of [
      ["exact", true, "exact", "Harga khusus (rute + pengirim + penerima + pembayar)"],
      ["partial", false, "route_sender", "Harga rute + pengirim"],
    ] as const) {
      void tier;
      if (!q.senderId && source === "route_sender") continue;
      const hit = rows.filter((r) => match(r, withRP)).sort((a, b) => rank(b) - rank(a))[0];
      if (hit) return { price: hit.price as number, unit: hit.unit as string, source, priceId: hit.id as string, label };
    }
    const route = await ctx.env.DB.prepare(`SELECT * FROM ep_routes WHERE id = ? AND deleted_at IS NULL`).bind(q.routeId).first<Row>();
    if (route?.publish_rate != null) {
      return { price: route.publish_rate as number, unit: route.unit as string, source: "publish", priceId: null, label: "Harga publish rute (belum ada harga khusus)" };
    }
  }
  return { price: null, unit: "kg", source: "manual", priceId: null, label: "Harga belum ada - isi manual" };
}

function computeTotal(price: number | null, unit: string | null, weight: number | null, koli: number | null): number | null {
  if (price == null) return null;
  if (unit === "kg") return Math.round(price * (weight ?? 0));
  if (unit === "koli") return Math.round(price * (koli ?? 0));
  return price;
}

async function nextResi(ctx: Ctx): Promise<string> {
  const fmt = await getSetting(ctx, "ep.resi_format", "EXP-{YYYY}-{NNNNN}");
  const year = String(new Date().getFullYear());
  const key = `ep.resi_seq.${year}`;
  for (let i = 0; i < 50; i++) {
    const cur = parseInt(await getSetting(ctx, key, "0"), 10) || 0;
    const seq = cur + 1;
    await ctx.env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(key, String(seq), now()).run();
    const resi = fmt
      .replace("{YYYY}", year)
      .replace("{MM}", String(new Date().getMonth() + 1).padStart(2, "0"))
      .replace(/\{N{1,10}\}/, (m) => String(seq).padStart(m.length - 2, "0"));
    const dup = await ctx.env.DB.prepare(`SELECT 1 FROM ep_orders WHERE resi = ?`).bind(resi).first();
    if (!dup) return resi;
  }
  throw Errors.conflict("Gagal membuat nomor resi unik.");
}

export function registerEkspedisiRoutes(router: Router) {
  // ------------------------------------------------------------ customers
  router.get("/api/ep/customers", async (ctx: Ctx) => {
    requirePermission(ctx, "ekspedisi.manage");
    const q = new URL(ctx.request.url).searchParams.get("q")?.trim();
    const rows = q
      ? await ctx.env.DB.prepare(`SELECT * FROM ep_customers WHERE deleted_at IS NULL AND (nama LIKE ? OR pic LIKE ?) ORDER BY nama COLLATE NOCASE`).bind(`%${q}%`, `%${q}%`).all<Row>()
      : await ctx.env.DB.prepare(`SELECT * FROM ep_customers WHERE deleted_at IS NULL ORDER BY nama COLLATE NOCASE`).all<Row>();
    return ok({ items: (rows.results ?? []).map(mapCustomer) });
  });

  const customerBody = async (ctx: Ctx, partial: boolean) => {
    const body = await parseJsonBody(ctx.request);
    const out: Record<string, unknown> = {};
    if (!partial || body.nama !== undefined) out.nama = reqString(body, "nama", { max: 150 }).trim();
    for (const [f, c, max] of [["npwp", "npwp", 40], ["pic", "pic", 100], ["telepon", "telepon", 30], ["email", "email", 150], ["alamat", "alamat", 400], ["preferences", "preferences", 2000], ["notes", "notes", 2000]] as const) {
      if (!partial || Object.prototype.hasOwnProperty.call(body, f)) out[c] = optString(body, f)?.slice(0, max) ?? null;
    }
    if (body.paymentScheme !== undefined) out.payment_scheme = pickEnum(body.paymentScheme, SCHEMES, "Skema pembayaran");
    const td = optNumber(body, "termDays", { min: 0, max: 365 });
    if (td !== undefined) out.term_days = td;
    const aktif = optBool(body, "aktif");
    if (aktif !== undefined) out.aktif = aktif ? 1 : 0;
    return out;
  };

  router.post("/api/ep/customers", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "ekspedisi.manage");
    const d = await customerBody(ctx, false);
    const id = newId();
    const t = now();
    const days = (d.term_days as number | undefined) ?? (parseInt(await getSetting(ctx, "ep.pad_default_days", "30"), 10) || 30);
    await ctx.env.DB.prepare(
      `INSERT INTO ep_customers (id, nama, npwp, pic, telepon, email, alamat, payment_scheme, term_days, preferences, notes, aktif, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).bind(id, d.nama, d.npwp ?? null, d.pic ?? null, d.telepon ?? null, d.email ?? null, d.alamat ?? null, d.payment_scheme ?? "PAD", days, d.preferences ?? null, d.notes ?? null, t, t).run();
    await writeAuditLog(ctx.env, actor, { action: "CREATE_EP_CUSTOMER", actionLabel: "CREATE CUSTOMER", module: "Ekspedisi", description: `Customer "${d.nama}" ditambahkan.` });
    return ok({ id }, {}, 201);
  });

  router.patch("/api/ep/customers/:id", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "ekspedisi.manage");
    const d = await customerBody(ctx, true);
    const keys = Object.keys(d);
    if (!keys.length) throw Errors.badRequest("Tidak ada perubahan yang dikirim.");
    const res = await ctx.env.DB.prepare(`UPDATE ep_customers SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(...keys.map((k) => d[k]), now(), params.id).run();
    if (!res.meta?.changes) throw Errors.notFound("Customer tidak ditemukan.");
    await writeAuditLog(ctx.env, actor, { action: "UPDATE_EP_CUSTOMER", actionLabel: "UPDATE CUSTOMER", module: "Ekspedisi", description: `Customer ${params.id} diperbarui.` });
    return ok({ id: params.id });
  });

  router.delete("/api/ep/customers/:id", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "ekspedisi.manage");
    await ctx.env.DB.prepare(`UPDATE ep_customers SET deleted_at = ? WHERE id = ?`).bind(now(), params.id).run();
    await writeAuditLog(ctx.env, actor, { action: "DELETE_EP_CUSTOMER", actionLabel: "DELETE CUSTOMER", module: "Ekspedisi", description: `Customer ${params.id} dihapus.` });
    return ok({ id: params.id });
  });

  /** Customer history: orders (as sender/receiver/payer), special prices and receivables. */
  router.get("/api/ep/customers/:id/history", async (ctx: Ctx, params) => {
    requirePermission(ctx, "ekspedisi.manage");
    const c = await ctx.env.DB.prepare(`SELECT * FROM ep_customers WHERE id = ? AND deleted_at IS NULL`).bind(params.id).first<Row>();
    if (!c) throw Errors.notFound("Customer tidak ditemukan.");
    const orders = await ctx.env.DB.prepare(orderSelect(`WHERE (o.sender_id = ?1 OR o.receiver_id = ?1 OR o.payer_id = ?1)`) + ` ORDER BY o.order_date DESC, o.created_at DESC LIMIT 100`).bind(params.id).all<Row>();
    const prices = await ctx.env.DB.prepare(priceSelect(`WHERE p.deleted_at IS NULL AND (p.sender_id = ?1 OR p.receiver_id = ?1 OR p.payer_id = ?1)`) + ` ORDER BY p.updated_at DESC`).bind(params.id).all<Row>();
    const recv = await ctx.env.DB.prepare(`SELECT r.*, o.resi FROM ep_receivables r JOIN ep_orders o ON o.id = r.order_id WHERE r.customer_id = ? ORDER BY r.created_at DESC`).bind(params.id).all<Row>();
    return ok({
      customer: mapCustomer(c),
      orders: (orders.results ?? []).map(mapOrder),
      prices: (prices.results ?? []).map(mapPrice),
      receivables: (recv.results ?? []).map(mapReceivable),
    });
  });

  // --------------------------------------------------------------- routes
  router.get("/api/ep/routes", async (ctx: Ctx) => {
    requirePermission(ctx, "ekspedisi.manage");
    const rows = await ctx.env.DB.prepare(`SELECT * FROM ep_routes WHERE deleted_at IS NULL ORDER BY asal COLLATE NOCASE, tujuan COLLATE NOCASE`).all<Row>();
    return ok({ items: (rows.results ?? []).map(mapRoute) });
  });

  const routeBody = async (ctx: Ctx, partial: boolean) => {
    const body = await parseJsonBody(ctx.request);
    const out: Record<string, unknown> = {};
    if (!partial || body.asal !== undefined) out.asal = reqString(body, "asal", { max: 100 }).trim();
    if (!partial || body.tujuan !== undefined) out.tujuan = reqString(body, "tujuan", { max: 100 }).trim();
    if (Object.prototype.hasOwnProperty.call(body, "publishRate")) out.publish_rate = optNumber(body, "publishRate", { min: 0 }) ?? null;
    if (body.unit !== undefined) out.unit = pickEnum(body.unit, UNITS, "Satuan");
    if (Object.prototype.hasOwnProperty.call(body, "transitDays")) out.transit_days = optNumber(body, "transitDays", { min: 0, max: 365 }) ?? null;
    if (Object.prototype.hasOwnProperty.call(body, "notes")) out.notes = optString(body, "notes")?.slice(0, 1000) ?? null;
    const aktif = optBool(body, "aktif");
    if (aktif !== undefined) out.aktif = aktif ? 1 : 0;
    return out;
  };

  router.post("/api/ep/routes", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "ekspedisi.manage");
    const d = await routeBody(ctx, false);
    const id = newId();
    const t = now();
    await ctx.env.DB.prepare(`INSERT INTO ep_routes (id, asal, tujuan, publish_rate, unit, transit_days, notes, aktif, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
      .bind(id, d.asal, d.tujuan, d.publish_rate ?? null, d.unit ?? "kg", d.transit_days ?? null, d.notes ?? null, t, t).run();
    await writeAuditLog(ctx.env, actor, { action: "CREATE_EP_ROUTE", actionLabel: "CREATE RUTE", module: "Ekspedisi", description: `Rute ${d.asal} - ${d.tujuan} ditambahkan.` });
    return ok({ id }, {}, 201);
  });

  router.patch("/api/ep/routes/:id", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "ekspedisi.manage");
    const d = await routeBody(ctx, true);
    const keys = Object.keys(d);
    if (!keys.length) throw Errors.badRequest("Tidak ada perubahan yang dikirim.");
    const res = await ctx.env.DB.prepare(`UPDATE ep_routes SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(...keys.map((k) => d[k]), now(), params.id).run();
    if (!res.meta?.changes) throw Errors.notFound("Rute tidak ditemukan.");
    await writeAuditLog(ctx.env, actor, { action: "UPDATE_EP_ROUTE", actionLabel: "UPDATE RUTE", module: "Ekspedisi", description: `Rute ${params.id} diperbarui.` });
    return ok({ id: params.id });
  });

  router.delete("/api/ep/routes/:id", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "ekspedisi.manage");
    await ctx.env.DB.prepare(`UPDATE ep_routes SET deleted_at = ? WHERE id = ?`).bind(now(), params.id).run();
    await writeAuditLog(ctx.env, actor, { action: "DELETE_EP_ROUTE", actionLabel: "DELETE RUTE", module: "Ekspedisi", description: `Rute ${params.id} dihapus.` });
    return ok({ id: params.id });
  });

  // --------------------------------------------------------------- prices
  const priceSelect = (where: string) =>
    `SELECT p.*, r.asal, r.tujuan, s.nama AS sender_nama, v.nama AS receiver_nama, y.nama AS payer_nama,
       (SELECT COUNT(*) FROM ep_price_log l WHERE l.price_id = p.id AND l.status = 'pending') AS pending_count
     FROM ep_prices p
     LEFT JOIN ep_routes r ON r.id = p.route_id
     LEFT JOIN ep_customers s ON s.id = p.sender_id
     LEFT JOIN ep_customers v ON v.id = p.receiver_id
     LEFT JOIN ep_customers y ON y.id = p.payer_id ${where}`;
  function mapPrice(r: Row) {
    return {
      id: r.id, routeId: r.route_id, route: `${r.asal ?? "?"} → ${r.tujuan ?? "?"}`,
      senderId: r.sender_id, senderNama: r.sender_nama, receiverId: r.receiver_id, receiverNama: r.receiver_nama,
      payerId: r.payer_id, payerNama: r.payer_nama, goodsType: r.goods_type, minWeight: r.min_weight,
      price: r.price, unit: r.unit, notes: r.notes, updatedAt: r.updated_at, pendingCount: r.pending_count ?? 0,
    };
  }

  router.get("/api/ep/prices", async (ctx: Ctx) => {
    requirePermission(ctx, "ekspedisi.manage");
    const url = new URL(ctx.request.url);
    const where = ["p.deleted_at IS NULL"];
    const params: unknown[] = [];
    for (const [qp, col] of [["routeId", "p.route_id"], ["senderId", "p.sender_id"], ["receiverId", "p.receiver_id"], ["payerId", "p.payer_id"]] as const) {
      const v = url.searchParams.get(qp);
      if (v) { where.push(`${col} = ?`); params.push(v); }
    }
    const q = url.searchParams.get("q")?.trim();
    if (q) { where.push(`(r.asal LIKE ? OR r.tujuan LIKE ? OR s.nama LIKE ? OR v.nama LIKE ? OR y.nama LIKE ?)`); params.push(...Array(5).fill(`%${q}%`)); }
    const rows = await ctx.env.DB.prepare(priceSelect(`WHERE ${where.join(" AND ")}`) + ` ORDER BY r.asal, r.tujuan, s.nama`).bind(...params).all<Row>();
    return ok({ items: (rows.results ?? []).map(mapPrice) });
  });

  router.post("/api/ep/prices", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "ekspedisi.manage");
    const body = await parseJsonBody(ctx.request);
    const routeId = reqString(body, "routeId", { max: 64 });
    const route = await ctx.env.DB.prepare(`SELECT 1 FROM ep_routes WHERE id = ? AND deleted_at IS NULL`).bind(routeId).first();
    if (!route) throw Errors.badRequest("Rute tidak ditemukan.");
    const price = optNumber(body, "price", { min: 0 });
    if (price === undefined) throw Errors.badRequest('Field "price" wajib diisi.');
    const unit = body.unit === undefined ? "kg" : pickEnum(body.unit, UNITS, "Satuan");
    const id = newId();
    const t = now();
    await ctx.env.DB.prepare(
      `INSERT INTO ep_prices (id, route_id, sender_id, receiver_id, payer_id, goods_type, min_weight, price, unit, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, routeId, idOrNull(body.senderId), idOrNull(body.receiverId), idOrNull(body.payerId), optString(body, "goodsType")?.slice(0, 100) ?? null,
      optNumber(body, "minWeight", { min: 0 }) ?? null, price, unit, optString(body, "notes")?.slice(0, 1000) ?? null, t, t).run();
    await ctx.env.DB.prepare(`INSERT INTO ep_price_log (id, price_id, old_price, new_price, reason, status, requested_by, requested_at, decided_by, decided_at) VALUES (?, ?, NULL, ?, ?, 'applied', ?, ?, ?, ?)`)
      .bind(newId(), id, price, "Harga baru", actor.nama, t, actor.nama, t).run();
    await writeAuditLog(ctx.env, actor, { action: "CREATE_EP_PRICE", actionLabel: "CREATE HARGA", module: "Ekspedisi", description: `Harga baru ${price} (${id}).` });
    return ok({ id }, {}, 201);
  });

  /** Update price. With ep.price_approval on, an Admin's change is queued as pending until an Owner approves. */
  router.patch("/api/ep/prices/:id", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "ekspedisi.manage");
    const cur = await ctx.env.DB.prepare(`SELECT * FROM ep_prices WHERE id = ? AND deleted_at IS NULL`).bind(params.id).first<Row>();
    if (!cur) throw Errors.notFound("Harga tidak ditemukan.");
    const body = await parseJsonBody(ctx.request);
    const t = now();
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (body.unit !== undefined) { sets.push("unit = ?"); vals.push(pickEnum(body.unit, UNITS, "Satuan")); }
    if (Object.prototype.hasOwnProperty.call(body, "notes")) { sets.push("notes = ?"); vals.push(optString(body, "notes")?.slice(0, 1000) ?? null); }
    if (Object.prototype.hasOwnProperty.call(body, "goodsType")) { sets.push("goods_type = ?"); vals.push(optString(body, "goodsType")?.slice(0, 100) ?? null); }
    if (Object.prototype.hasOwnProperty.call(body, "minWeight")) { sets.push("min_weight = ?"); vals.push(optNumber(body, "minWeight", { min: 0 }) ?? null); }
    let pending = false;
    const newPrice = optNumber(body, "price", { min: 0 });
    if (newPrice !== undefined && newPrice !== cur.price) {
      const reason = optString(body, "reason")?.slice(0, 500) ?? null;
      const needsApproval = (await getSetting(ctx, "ep.price_approval", "false")) === "true" && actor.role !== "Superadmin";
      if (needsApproval) {
        pending = true;
        await ctx.env.DB.prepare(`INSERT INTO ep_price_log (id, price_id, old_price, new_price, reason, status, requested_by, requested_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`)
          .bind(newId(), params.id, cur.price, newPrice, reason, actor.nama, t).run();
      } else {
        sets.push("price = ?"); vals.push(newPrice);
        await ctx.env.DB.prepare(`INSERT INTO ep_price_log (id, price_id, old_price, new_price, reason, status, requested_by, requested_at, decided_by, decided_at) VALUES (?, ?, ?, ?, ?, 'applied', ?, ?, ?, ?)`)
          .bind(newId(), params.id, cur.price, newPrice, reason, actor.nama, t, actor.nama, t).run();
      }
    }
    if (sets.length) {
      await ctx.env.DB.prepare(`UPDATE ep_prices SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, params.id).run();
    } else if (!pending && newPrice === undefined) {
      throw Errors.badRequest("Tidak ada perubahan yang dikirim.");
    }
    await writeAuditLog(ctx.env, actor, { action: "UPDATE_EP_PRICE", actionLabel: "UPDATE HARGA", module: "Ekspedisi", description: `Harga ${params.id} diubah${pending ? " (menunggu persetujuan Owner)" : ""}.` });
    return ok({ id: params.id, pending });
  });

  router.delete("/api/ep/prices/:id", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "ekspedisi.manage");
    await ctx.env.DB.prepare(`UPDATE ep_prices SET deleted_at = ? WHERE id = ?`).bind(now(), params.id).run();
    await writeAuditLog(ctx.env, actor, { action: "DELETE_EP_PRICE", actionLabel: "DELETE HARGA", module: "Ekspedisi", description: `Harga ${params.id} dihapus.` });
    return ok({ id: params.id });
  });

  /** Change log; optionally for a single price, or only pending ones. */
  router.get("/api/ep/price-log", async (ctx: Ctx) => {
    requirePermission(ctx, "ekspedisi.manage");
    const url = new URL(ctx.request.url);
    const where: string[] = [];
    const params: unknown[] = [];
    const pid = url.searchParams.get("priceId");
    if (pid) { where.push("l.price_id = ?"); params.push(pid); }
    if (url.searchParams.get("status")) { where.push("l.status = ?"); params.push(url.searchParams.get("status")); }
    const rows = await ctx.env.DB.prepare(
      `SELECT l.*, r.asal, r.tujuan, s.nama AS sender_nama
       FROM ep_price_log l JOIN ep_prices p ON p.id = l.price_id
       LEFT JOIN ep_routes r ON r.id = p.route_id LEFT JOIN ep_customers s ON s.id = p.sender_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY l.requested_at DESC LIMIT 200`,
    ).bind(...params).all<Row>();
    return ok({
      items: (rows.results ?? []).map((r) => ({
        id: r.id, priceId: r.price_id, route: `${r.asal ?? "?"} → ${r.tujuan ?? "?"}`, senderNama: r.sender_nama,
        oldPrice: r.old_price, newPrice: r.new_price, reason: r.reason, status: r.status,
        requestedBy: r.requested_by, requestedAt: r.requested_at, decidedBy: r.decided_by, decidedAt: r.decided_at,
      })),
    });
  });

  router.post("/api/ep/price-log/:id/decision", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "ekspedisi.approve");
    const body = await parseJsonBody(ctx.request);
    const approve = optBool(body, "approve");
    if (approve === undefined) throw Errors.badRequest('Field "approve" wajib diisi.');
    const log = await ctx.env.DB.prepare(`SELECT * FROM ep_price_log WHERE id = ? AND status = 'pending'`).bind(params.id).first<Row>();
    if (!log) throw Errors.notFound("Perubahan harga pending tidak ditemukan.");
    const t = now();
    await ctx.env.DB.prepare(`UPDATE ep_price_log SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?`).bind(approve ? "applied" : "rejected", actor.nama, t, params.id).run();
    if (approve) await ctx.env.DB.prepare(`UPDATE ep_prices SET price = ?, updated_at = ? WHERE id = ?`).bind(log.new_price, t, log.price_id).run();
    await writeAuditLog(ctx.env, actor, { action: "DECIDE_EP_PRICE", actionLabel: approve ? "APPROVE HARGA" : "REJECT HARGA", module: "Ekspedisi", description: `Perubahan harga ${log.price_id} ${approve ? "disetujui" : "ditolak"}.` });
    return ok({ id: params.id, status: approve ? "applied" : "rejected" });
  });

  router.post("/api/ep/price-resolve", async (ctx: Ctx) => {
    requirePermission(ctx, "ekspedisi.manage");
    const body = await parseJsonBody(ctx.request);
    const r = await resolvePrice(ctx, {
      routeId: idOrNull(body.routeId), senderId: idOrNull(body.senderId), receiverId: idOrNull(body.receiverId), payerId: idOrNull(body.payerId),
      goodsType: optString(body, "goodsType") ?? null, weight: optNumber(body, "weight", { min: 0 }) ?? null,
    });
    return ok(r);
  });

  // --------------------------------------------------------------- orders
  const orderSelect = (where: string) =>
    `SELECT o.*, r.asal, r.tujuan, s.nama AS sender_nama, v.nama AS receiver_nama, y.nama AS payer_nama,
       s.alamat AS sender_alamat, v.alamat AS receiver_alamat, y.alamat AS payer_alamat,
       y.payment_scheme AS payer_scheme
     FROM ep_orders o
     LEFT JOIN ep_routes r ON r.id = o.route_id
     LEFT JOIN ep_customers s ON s.id = o.sender_id
     LEFT JOIN ep_customers v ON v.id = o.receiver_id
     LEFT JOIN ep_customers y ON y.id = o.payer_id ${where}`;
  function mapOrder(r: Row) {
    return {
      id: r.id, resi: r.resi, orderDate: r.order_date, status: r.status, routeId: r.route_id,
      route: r.asal ? `${r.asal} → ${r.tujuan}` : null, asal: r.asal, tujuan: r.tujuan,
      senderId: r.sender_id, senderNama: r.sender_nama, senderAlamat: r.sender_alamat,
      receiverId: r.receiver_id, receiverNama: r.receiver_nama, receiverAlamat: r.receiver_alamat,
      payerId: r.payer_id, payerNama: r.payer_nama, payerAlamat: r.payer_alamat, payerScheme: r.payer_scheme,
      goodsType: r.goods_type, koli: r.koli, weight: r.weight, price: r.price, priceUnit: r.price_unit,
      priceSource: r.price_source, total: r.total, internalNote: r.internal_note, createdAt: r.created_at,
    };
  }

  router.get("/api/ep/orders", async (ctx: Ctx) => {
    requirePermission(ctx, "ekspedisi.manage");
    const url = new URL(ctx.request.url);
    const where: string[] = [];
    const params: unknown[] = [];
    const status = url.searchParams.get("status");
    if (status) { where.push("o.status = ?"); params.push(status); }
    const cust = url.searchParams.get("customerId");
    if (cust) { where.push("(o.sender_id = ? OR o.receiver_id = ? OR o.payer_id = ?)"); params.push(cust, cust, cust); }
    const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
    if (from) { where.push("o.order_date >= ?"); params.push(from); }
    if (to) { where.push("o.order_date <= ?"); params.push(to); }
    const q = url.searchParams.get("q")?.trim();
    if (q) { where.push("(o.resi LIKE ? OR s.nama LIKE ? OR v.nama LIKE ? OR y.nama LIKE ? OR r.asal LIKE ? OR r.tujuan LIKE ?)"); params.push(...Array(6).fill(`%${q}%`)); }
    const rows = await ctx.env.DB.prepare(orderSelect(where.length ? "WHERE " + where.join(" AND ") : "") + ` ORDER BY o.order_date DESC, o.created_at DESC LIMIT 500`).bind(...params).all<Row>();
    return ok({ items: (rows.results ?? []).map(mapOrder) });
  });

  router.get("/api/ep/orders/:id", async (ctx: Ctx, params) => {
    requirePermission(ctx, "ekspedisi.manage");
    const o = await ctx.env.DB.prepare(orderSelect(`WHERE o.id = ?`)).bind(params.id).first<Row>();
    if (!o) throw Errors.notFound("Order tidak ditemukan.");
    const hist = await ctx.env.DB.prepare(`SELECT * FROM ep_order_status WHERE order_id = ? ORDER BY at ASC`).bind(params.id).all<Row>();
    const recv = await ctx.env.DB.prepare(`SELECT r.*, o.resi FROM ep_receivables r JOIN ep_orders o ON o.id = r.order_id WHERE r.order_id = ?`).bind(params.id).first<Row>();
    return ok({
      ...mapOrder(o),
      history: (hist.results ?? []).map((h) => ({ status: h.status, note: h.note, at: h.at, by: h.by_name })),
      receivable: recv ? mapReceivable(recv) : null,
    });
  });

  router.post("/api/ep/orders", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "ekspedisi.manage");
    const body = await parseJsonBody(ctx.request);
    const senderId = idOrNull(body.senderId);
    const receiverId = idOrNull(body.receiverId);
    const payerId = idOrNull(body.payerId) ?? senderId;
    const routeId = idOrNull(body.routeId);
    if (!senderId || !receiverId) throw Errors.badRequest("Pengirim dan penerima wajib diisi.");
    const goodsType = optString(body, "goodsType")?.slice(0, 100) ?? null;
    const koli = optNumber(body, "koli", { min: 0 }) ?? null;
    const weight = optNumber(body, "weight", { min: 0 }) ?? null;

    // Price: server resolves unless the admin overrides it manually.
    const resolved = await resolvePrice(ctx, { routeId, senderId, receiverId, payerId, goodsType, weight });
    const manual = optNumber(body, "price", { min: 0 });
    let price = resolved.price, unit = resolved.unit, source: string = resolved.source;
    if (manual !== undefined && (resolved.price == null || manual !== resolved.price)) {
      price = manual; source = "manual";
      if (body.unit !== undefined) unit = pickEnum(body.unit, UNITS, "Satuan");
    }
    const total = computeTotal(price, unit, weight, koli);

    const id = newId();
    const resi = await nextResi(ctx);
    const t = now();
    const date = optString(body, "orderDate")?.slice(0, 10) || today();
    await ctx.env.DB.prepare(
      `INSERT INTO ep_orders (id, resi, order_date, status, route_id, sender_id, receiver_id, payer_id, goods_type, koli, weight, price, price_unit, price_source, total, internal_note, created_at, created_by, updated_at)
       VALUES (?, ?, ?, 'Baru', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, resi, date, routeId, senderId, receiverId, payerId, goodsType, koli, weight, price, unit, source, total, optString(body, "internalNote")?.slice(0, 2000) ?? null, t, actor.nama, t).run();
    await ctx.env.DB.prepare(`INSERT INTO ep_order_status (id, order_id, status, note, at, by_name) VALUES (?, ?, 'Baru', 'Order dibuat', ?, ?)`).bind(newId(), id, t, actor.nama).run();

    // PAD payers get a receivable tracked from the start.
    const payer = await ctx.env.DB.prepare(`SELECT payment_scheme, term_days FROM ep_customers WHERE id = ?`).bind(payerId).first<Row>();
    if (payer && payer.payment_scheme !== "CASH" && total != null) {
      const due = new Date(date); due.setDate(due.getDate() + ((payer.term_days as number) || 30));
      await ctx.env.DB.prepare(`INSERT INTO ep_receivables (id, order_id, customer_id, invoice_no, amount, due_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'Belum Ditagih', ?, ?)`)
        .bind(newId(), id, payerId, `INV-${resi}`, total, due.toISOString().slice(0, 10), t, t).run();
    }
    await writeAuditLog(ctx.env, actor, { action: "CREATE_EP_ORDER", actionLabel: "CREATE ORDER", module: "Ekspedisi", awb: resi, description: `Order ${resi} dibuat (harga: ${source}).` });
    return ok({ id, resi, price, priceSource: source, total }, {}, 201);
  });

  router.patch("/api/ep/orders/:id", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "ekspedisi.manage");
    const o = await ctx.env.DB.prepare(`SELECT * FROM ep_orders WHERE id = ?`).bind(params.id).first<Row>();
    if (!o) throw Errors.notFound("Order tidak ditemukan.");
    const body = await parseJsonBody(ctx.request);
    const t = now();
    if (Object.prototype.hasOwnProperty.call(body, "internalNote")) {
      await ctx.env.DB.prepare(`UPDATE ep_orders SET internal_note = ?, updated_at = ? WHERE id = ?`).bind(optString(body, "internalNote")?.slice(0, 2000) ?? null, t, params.id).run();
    }
    if (body.status !== undefined) {
      const status = pickEnum(body.status, ORDER_STATUSES, "Status");
      if (status !== o.status) {
        await ctx.env.DB.prepare(`UPDATE ep_orders SET status = ?, updated_at = ? WHERE id = ?`).bind(status, t, params.id).run();
        await ctx.env.DB.prepare(`INSERT INTO ep_order_status (id, order_id, status, note, at, by_name) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(newId(), params.id, status, optString(body, "note")?.slice(0, 500) ?? null, t, actor.nama).run();
        // PAD clock starts at delivery completion.
        if (status === "Selesai") {
          const c = await ctx.env.DB.prepare(`SELECT term_days FROM ep_customers WHERE id = ?`).bind(o.payer_id).first<Row>();
          const due = new Date(); due.setDate(due.getDate() + ((c?.term_days as number) || 30));
          await ctx.env.DB.prepare(`UPDATE ep_receivables SET due_date = ?, updated_at = ? WHERE order_id = ? AND status != 'Lunas'`).bind(due.toISOString().slice(0, 10), t, params.id).run();
        }
        await writeAuditLog(ctx.env, actor, { action: "UPDATE_EP_ORDER_STATUS", actionLabel: "UPDATE STATUS ORDER", module: "Ekspedisi", awb: String(o.resi), description: `Status order ${o.resi}: ${o.status} → ${status}.` });
      }
    }
    return ok({ id: params.id });
  });

  // ---------------------------------------------------------- receivables
  function mapReceivable(r: Row) {
    const due = r.due_date as string | null;
    const overdue = r.status !== "Lunas" && !!due && due < today();
    return {
      id: r.id, orderId: r.order_id, resi: r.resi, customerId: r.customer_id, customerNama: r.customer_nama,
      invoiceNo: r.invoice_no, amount: r.amount, dueDate: due, status: r.status, paidAt: r.paid_at,
      overdue, daysOverdue: overdue && due ? Math.floor((Date.now() - new Date(due).getTime()) / 86400000) : 0,
    };
  }

  router.get("/api/ep/receivables", async (ctx: Ctx) => {
    requirePermission(ctx, "ekspedisi.manage");
    const url = new URL(ctx.request.url);
    const where: string[] = [];
    const params: unknown[] = [];
    const status = url.searchParams.get("status");
    if (status && status !== "Overdue") { where.push("r.status = ?"); params.push(status); }
    if (status === "Overdue") { where.push("r.status != 'Lunas' AND r.due_date < ?"); params.push(today()); }
    const cust = url.searchParams.get("customerId");
    if (cust) { where.push("r.customer_id = ?"); params.push(cust); }
    const rows = await ctx.env.DB.prepare(
      `SELECT r.*, o.resi, c.nama AS customer_nama FROM ep_receivables r
       JOIN ep_orders o ON o.id = r.order_id LEFT JOIN ep_customers c ON c.id = r.customer_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY r.due_date ASC LIMIT 500`,
    ).bind(...params).all<Row>();
    const items = (rows.results ?? []).map(mapReceivable);
    const open = items.filter((i) => i.status !== "Lunas");
    return ok({
      items,
      summary: {
        outstanding: open.reduce((a, i) => a + (i.amount as number), 0),
        overdue: open.filter((i) => i.overdue).reduce((a, i) => a + (i.amount as number), 0),
        overdueCount: open.filter((i) => i.overdue).length,
        openCount: open.length,
      },
    });
  });

  router.patch("/api/ep/receivables/:id", async (ctx: Ctx, params) => {
    const actor = requirePermission(ctx, "ekspedisi.manage");
    const body = await parseJsonBody(ctx.request);
    const cur = await ctx.env.DB.prepare(`SELECT * FROM ep_receivables WHERE id = ?`).bind(params.id).first<Row>();
    if (!cur) throw Errors.notFound("Piutang tidak ditemukan.");
    const sets: string[] = []; const vals: unknown[] = [];
    if (body.status !== undefined) {
      const st = pickEnum(body.status, RECV_STATUSES, "Status");
      sets.push("status = ?"); vals.push(st);
      sets.push("paid_at = ?"); vals.push(st === "Lunas" ? (optString(body, "paidAt")?.slice(0, 10) || today()) : null);
    }
    if (Object.prototype.hasOwnProperty.call(body, "invoiceNo")) { sets.push("invoice_no = ?"); vals.push(optString(body, "invoiceNo")?.slice(0, 60) ?? null); }
    if (Object.prototype.hasOwnProperty.call(body, "dueDate")) { sets.push("due_date = ?"); vals.push(optString(body, "dueDate")?.slice(0, 10) ?? null); }
    if (!sets.length) throw Errors.badRequest("Tidak ada perubahan yang dikirim.");
    await ctx.env.DB.prepare(`UPDATE ep_receivables SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, now(), params.id).run();
    await writeAuditLog(ctx.env, actor, { action: "UPDATE_EP_RECEIVABLE", actionLabel: "UPDATE PIUTANG", module: "Ekspedisi", description: `Piutang ${params.id} diperbarui${body.status ? ` → ${body.status}` : ""}.` });
    return ok({ id: params.id });
  });

  // ------------------------------------------------------------- settings
  const SETTING_KEYS = ["ep.resi_format", "ep.invoice_header", "ep.invoice_bank", "ep.invoice_footer", "ep.pad_default_days", "ep.price_approval"] as const;

  router.get("/api/ep/settings", async (ctx: Ctx) => {
    requirePermission(ctx, "ekspedisi.manage");
    const out: Record<string, string> = {};
    for (const k of SETTING_KEYS) out[k.slice(3)] = await getSetting(ctx, k, "");
    return ok(out);
  });

  router.patch("/api/ep/settings", async (ctx: Ctx) => {
    const actor = requirePermission(ctx, "ekspedisi.approve"); // Owner only
    const body = await parseJsonBody(ctx.request);
    for (const k of SETTING_KEYS) {
      const f = k.slice(3);
      if (body[f] !== undefined) {
        const v = String(body[f]).slice(0, 500);
        if (f === "resi_format" && !/\{N{3,10}\}/.test(v)) throw Errors.badRequest("Format resi harus memuat {NNNNN} (nomor urut).");
        await setSetting(ctx, k, v, actor);
      }
    }
    await writeAuditLog(ctx.env, actor, { action: "UPDATE_EP_SETTINGS", actionLabel: "UPDATE PENGATURAN", module: "Ekspedisi", description: "Pengaturan Ekspedisi diperbarui." });
    return ok({ updated: true });
  });
}
