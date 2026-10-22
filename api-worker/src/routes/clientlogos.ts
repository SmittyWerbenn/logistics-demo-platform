import type { Router } from "../router";
import type { Ctx } from "../types";
import { ok, Errors } from "../http";
import { parseJsonBody, reqString, optString, optBool } from "../validate";
import { newId } from "../crypto";
import { requirePermission } from "../authMiddleware";
import { putObject, presignGet, deleteObject } from "../storage";
import { writeAuditLog } from "../audit";
import { parsePagination, pageMeta, likeTerm } from "../pagination";

/**
 * Client Company Profile logos ("Trusted by Our Clients").
 *
 * Public read:            GET  /api/public/client-logos
 * Superadmin CRUD:        GET    /api/client-logos
 *                         POST   /api/client-logos          (JSON, or multipart with logoFile)
 *                         PATCH  /api/client-logos/:id      (JSON, or multipart with logoFile)
 *                         DELETE /api/client-logos/:id      -> refused; use Recycle Bin (soft delete)
 *
 * Permission: `client_logos.manage` - granted ONLY to Superadmin (see rbac.ts).
 * Every mutation is audited. Delete uses the existing Recycle Bin flow
 * (entityType "client_logo").
 *
 * Logos uploaded from the admin are stored in MinIO via the same mechanism as
 * the other uploads (putObject + file row + presigned GET). The 13 pre-existing
 * logos stay as static /assets files (external_url) - they are never re-uploaded.
 */

const NAMA_MAX = 120;
const ALT_MAX = 200;
const SORT_MAX = 9999;
const LOGO_MAX_BYTES = 8 * 1024 * 1024;
/** Accept a webp/jpg/png upload; keep the original extension (content type decides). */
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

interface LogoRow {
  id: string;
  nama: string;
  alt_text: string | null;
  sort_order: number;
  aktif: number;
  external_url: string | null;
  file_id: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

function toDto(row: LogoRow) {
  return {
    id: row.id,
    nama: row.nama,
    altText: row.alt_text,
    sortOrder: row.sort_order,
    aktif: row.aktif === 1,
    externalUrl: row.external_url,
    fileId: row.file_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function requireLogoManage(ctx: Ctx) {
  return requirePermission(ctx, "client_logos.manage");
}

async function findLogo(ctx: Ctx, id: string): Promise<LogoRow> {
  const row = await ctx.env.DB.prepare(
    `SELECT id, nama, alt_text, sort_order, aktif, external_url, file_id, created_at, created_by, updated_at, updated_by
     FROM client_logos WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(id)
    .first<LogoRow>();
  if (!row) throw Errors.notFound("Logo client tidak ditemukan.");
  return row;
}

/** Reject a duplicate name (case-insensitive) among non-deleted rows, allowing the given id. */
async function assertUniqueName(ctx: Ctx, nama: string, exceptId?: string) {
  const dupe = await ctx.env.DB.prepare(
    `SELECT nama FROM client_logos WHERE deleted_at IS NULL AND LOWER(TRIM(nama)) = LOWER(TRIM(?)) AND id != ?`,
  )
    .bind(nama, exceptId ?? "")
    .first<{ nama: string }>();
  if (dupe) throw Errors.conflict(`Client "${dupe.nama}" sudah terdaftar. Gunakan nama lain.`);
}

/** The claimed maximum sort_order currently in use, for auto-ordering when the
 * admin leaves the field empty. */
async function nextSortOrder(ctx: Ctx): Promise<number> {
  const r = await ctx.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), 0) AS m FROM client_logos WHERE deleted_at IS NULL`,
  ).first<{ m: number }>();
  return (r?.m ?? 0) + 1;
}

/**
 * Handle the "logoFile" part of a multipart request: validates type/size,
 * stores the bytes in MinIO under `client_logo/<id>/...` and records the row
 * in `files`. Returns the file id; deletes the object again if the caller
 * later fails (so no orphaned blob stays behind).
 */
async function storeUploadedLogo(ctx: Ctx, logoId: string, file: File, actorId: string): Promise<string> {
  if (!(file.type in EXT_BY_MIME)) {
    throw Errors.badRequest("Format logo tidak didukung. Gunakan PNG, JPG/JPEG, atau WebP.");
  }
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > LOGO_MAX_BYTES) {
    throw Errors.badRequest(`Ukuran logo maksimal ${LOGO_MAX_BYTES / 1024 / 1024}MB.`);
  }
  const ext = EXT_BY_MIME[file.type];
  const objectKey = `client_logo/${logoId}/${newId()}.${ext}`;
  await putObject(ctx.env, objectKey, buffer, file.type);

  const fileId = newId();
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO files (id, object_key, filename, mime_type, size_bytes, uploaded_by, entity_type, entity_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'client_logo', ?, ?)`,
    )
      .bind(fileId, objectKey, file.name || objectKey, file.type, buffer.byteLength, actorId, logoId, new Date().toISOString())
      .run();
  } catch (err) {
    // Roll back the object so a DB failure doesn't orphan a blob.
    try {
      await deleteObject(ctx.env, objectKey);
    } catch {
      /* best effort */
    }
    throw err;
  }
  return fileId;
}

/** Resolve an uploaded (file_id) logo to a short-lived signed URL for <img> tags. */
async function logoUrl(ctx: Ctx, r: { external_url: string | null; file_id: string | null }): Promise<string | null> {
  if (r.external_url) return r.external_url;
  if (!r.file_id) return null;
  const file = await ctx.env.DB.prepare(`SELECT object_key FROM files WHERE id = ?`).bind(r.file_id).first<{ object_key: string }>();
  return file ? presignGet(ctx.env, file.object_key) : null;
}

/** Parse a request that may be JSON or multipart/form-data. Returns the parsed
 * body fields (multipart values as strings, files pulled out separately).
 * The Content-Type header decides which parser runs - reading the body once
 * matters: trying formData() first on a JSON body consumes the stream and
 * makes request.json() fail with a confusing 400. */
async function readBody(ctx: Ctx): Promise<{ body: Record<string, unknown>; logoFile: File | null }> {
  const ct = ctx.request.headers.get("Content-Type") ?? "";
  if (ct.startsWith("multipart/form-data")) {
    const form = await ctx.request.formData();
    const body: Record<string, unknown> = {};
    let logoFile: File | null = null;
    for (const [k, v] of form.entries()) {
      if (k === "logoFile") {
        if (v instanceof File) logoFile = v;
      } else {
        const s = String(v);
        // multipart values arrive as strings; coerce booleans/numeric fields
        // back to real types so the same validation runs for both encodings.
        body[k] = s === "true" ? true : s === "false" ? false : s === "" ? "" : s;
      }
    }
    return { body, logoFile };
  }
  return { body: await parseJsonBody(ctx.request), logoFile: null };
}

export function registerClientLogoRoutes(router: Router) {
  // ---- Public read (no auth) ----
  router.get("/api/public/client-logos", async (ctx: Ctx) => {
    const rows = await ctx.env.DB.prepare(
      `SELECT id, nama, alt_text, external_url, file_id
       FROM client_logos
       WHERE aktif = 1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, created_at ASC`,
    ).all<{ id: string; nama: string; alt_text: string | null; external_url: string | null; file_id: string | null }>();

    const items = [];
    for (const r of rows.results ?? []) {
      const url = await logoUrl(ctx, r);
      items.push({ id: r.id, nama: r.nama, altText: r.alt_text ?? r.nama, url });
    }
    return ok({ items });
  });

  // ---- Admin list (Superadmin) ----
  router.get("/api/client-logos", async (ctx: Ctx) => {
    requireLogoManage(ctx);
    const url = new URL(ctx.request.url);
    const { page, limit, offset } = parsePagination(url);
    const q = url.searchParams.get("q")?.trim();
    const where: string[] = ["deleted_at IS NULL"];
    const binds: unknown[] = [];
    if (q) {
      // Note: SQLite's ESCAPE clause needs a single-character literal. In a JS
      // template string that is ESCAPE '\' (one backslash) - writing '\\' would
      // send two backslashes and D1 fails with "ESCAPE expression must be a
      // single character".
      where.push("nama LIKE ? ESCAPE '\\'");
      binds.push(likeTerm(q));
    }
    const status = url.searchParams.get("status");
    if (status === "aktif") where.push("aktif = 1");
    else if (status === "nonaktif") where.push("aktif = 0");
    const whereSql = `WHERE ${where.join(" AND ")}`;
    const total = await ctx.env.DB.prepare(`SELECT COUNT(*) AS c FROM client_logos ${whereSql}`).bind(...binds).first<{ c: number }>();
    const rows = await ctx.env.DB.prepare(
      `SELECT id, nama, alt_text, sort_order, aktif, external_url, file_id, created_at, created_by, updated_at, updated_by
       FROM client_logos ${whereSql}
       ORDER BY sort_order ASC, created_at ASC
       LIMIT ? OFFSET ?`,
    )
      .bind(...binds, limit, offset)
      .all<LogoRow>();

    const items = [];
    for (const r of rows.results ?? []) {
      const url = await logoUrl(ctx, r);
      items.push({ ...toDto(r), url });
    }
    return ok({ items, meta: pageMeta(page, limit, total?.c ?? 0) });
  });

  // ---- Create (Superadmin) ----
  router.post("/api/client-logos", async (ctx: Ctx) => {
    const actor = requireLogoManage(ctx);
    const { body, logoFile } = await readBody(ctx);

    const nama = reqString(body, "nama", { max: NAMA_MAX });
    await assertUniqueName(ctx, nama);
    const altText = optString(body, "altText") ?? nama;
    if (altText.length > ALT_MAX) throw Errors.badRequest(`Alt text maksimal ${ALT_MAX} karakter.`);

    // sortOrder optional: auto = max+1. Keep the numeric field if sent by the UI.
    let sortOrder: number;
    if (body.sortOrder === undefined || body.sortOrder === null || body.sortOrder === "") {
      sortOrder = await nextSortOrder(ctx);
    } else {
      sortOrder = Math.round(Number(body.sortOrder));
      if (!Number.isFinite(sortOrder) || sortOrder < 1 || sortOrder > SORT_MAX) {
        throw Errors.badRequest(`Urutan tampilan antara 1-${SORT_MAX}.`);
      }
    }
    const aktif = optBool(body, "aktif") ?? true;

    if (!logoFile && !body.externalUrl) {
      throw Errors.badRequest("Logo wajib diunggah.");
    }
    if (logoFile && body.externalUrl) {
      throw Errors.badRequest("Kirim salah satu: file logo atau externalUrl, tidak keduanya.");
    }

    const id = newId();
    const now = new Date().toISOString();

    const externalUrl = typeof body.externalUrl === "string" && body.externalUrl.trim() ? body.externalUrl.trim() : null;

    // Uploaded logo: store object first; if the DB insert fails we roll back
    // both the object and the files row.
    let fileId: string | null = null;
    if (logoFile) {
      fileId = await storeUploadedLogo(ctx, id, logoFile, actor.id);
    }
    try {
      await ctx.env.DB.prepare(
        `INSERT INTO client_logos (id, nama, alt_text, sort_order, aktif, external_url, file_id, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, nama, altText, sortOrder, aktif ? 1 : 0, externalUrl, fileId, now, actor.id, now, actor.id)
        .run();
    } catch (err) {
      if (fileId) {
        try {
          const f = await ctx.env.DB.prepare(`SELECT object_key FROM files WHERE id = ?`).bind(fileId).first<{ object_key: string }>();
          if (f) await deleteObject(ctx.env, f.object_key);
          await ctx.env.DB.prepare(`DELETE FROM files WHERE id = ?`).bind(fileId).run();
        } catch {
          /* best effort */
        }
      }
      throw err;
    }

    await writeAuditLog(ctx.env, actor, {
      action: "CREATE_CLIENT_LOGO",
      actionLabel: "CREATE CLIENT LOGO",
      module: "Client Company Profile",
      description: `Client "${nama}" ditambahkan ke Company Profile.`,
    });

    return ok({ id, nama, altText, sortOrder, aktif: aktif ? 1 : 0, createdAt: now }, {}, 201);
  });

  // ---- Update (Superadmin) ----
  router.patch("/api/client-logos/:id", async (ctx: Ctx, params) => {
    const actor = requireLogoManage(ctx);
    const existing = await findLogo(ctx, params.id);
    const { body, logoFile } = await readBody(ctx);

    const sets: string[] = [];
    const values: unknown[] = [];
    const now = new Date().toISOString();

    if (body.nama !== undefined) {
      const nama = reqString(body, "nama", { max: NAMA_MAX });
      await assertUniqueName(ctx, nama, params.id);
      sets.push("nama = ?");
      values.push(nama);
    }
    if (Object.prototype.hasOwnProperty.call(body, "altText")) {
      const altText = optString(body, "altText");
      if (altText !== undefined && altText.length > ALT_MAX) throw Errors.badRequest(`Alt text maksimal ${ALT_MAX} karakter.`);
      sets.push("alt_text = ?");
      values.push(altText ?? null);
    }
    if (body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== "") {
      const sortOrder = Math.round(Number(body.sortOrder));
      if (!Number.isFinite(sortOrder) || sortOrder < 1 || sortOrder > SORT_MAX) {
        throw Errors.badRequest(`Urutan tampilan antara 1-${SORT_MAX}.`);
      }
      sets.push("sort_order = ?");
      values.push(sortOrder);
    }
    if (body.aktif !== undefined) {
      const aktif = optBool(body, "aktif");
      sets.push("aktif = ?");
      values.push(aktif ? 1 : 0);
    }

    // Replace the logo: old MinIO object + old files row are removed only after
    // the new one is saved, so a live page is never left with a broken image.
    let newFileId: string | null = null;
    if (logoFile) {
      newFileId = await storeUploadedLogo(ctx, params.id, logoFile, actor.id);
      sets.push("file_id = ?", "external_url = ?");
      values.push(newFileId, null);
    }

    if (sets.length === 0) {
      throw Errors.badRequest("Tidak ada perubahan yang dikirim.");
    }

    sets.push("updated_at = ?", "updated_by = ?");
    values.push(now, actor.id, params.id);
    await ctx.env.DB.prepare(`UPDATE client_logos SET ${sets.join(", ")} WHERE id = ? AND deleted_at IS NULL`).bind(...values).run();

    // Cleanup old uploaded image (only after the new one is safely stored).
    if (logoFile && existing.file_id) {
      try {
        const oldFile = await ctx.env.DB.prepare(`SELECT object_key FROM files WHERE id = ?`).bind(existing.file_id).first<{ object_key: string }>();
        if (oldFile) {
          await deleteObject(ctx.env, oldFile.object_key);
          await ctx.env.DB.prepare(`DELETE FROM files WHERE id = ?`).bind(existing.file_id).run();
        }
      } catch {
        /* best effort - an orphaned blob is harmless */
      }
    }

    await writeAuditLog(ctx.env, actor, {
      action: "UPDATE_CLIENT_LOGO",
      actionLabel: "UPDATE CLIENT LOGO",
      module: "Client Company Profile",
      description: `Client "${existing.nama}" diperbarui.`,
    });

    return ok({ updated: true });
  });

  // ---- Delete -> Recycle Bin (soft delete, Superadmin). The actual bin move
  // happens through /api/recycle/delete with entityType "client_logo"; this
  // DELETE endpoint is kept explicit and refuses - the UI uses the Recycle Bin
  // helper like every other Master Data page.
  router.delete("/api/client-logos/:id", async (ctx: Ctx) => {
    requireLogoManage(ctx);
    throw Errors.forbidden("Gunakan Recycle Bin untuk menghapus logo client.");
  });
}