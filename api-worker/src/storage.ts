import { AwsClient } from "aws4fetch";
import type { Env } from "./types";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB raw upload ceiling (frontend already compresses images client-side)

function client(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
    service: "s3",
    region: "us-east-1",
  });
}

/** Demo clone: with DEMO_MODE=true the worker keeps uploaded images in the
 * local D1 database instead of MinIO, so the demo runs with no Docker/cloud
 * dependencies. `demo_files` is created by migration 0041. */
function demoMode(env: Env): boolean {
  return env.DEMO_MODE === "true";
}

/** Object keys contain slashes; base64url makes them a single URL segment. */
function demoFileId(objectKey: string): string {
  return btoa(objectKey).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Base64 for a byte array, chunked so large photos don't blow the call stack. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function validateUpload(mimeType: string, sizeBytes: number): void {
  if (!IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(`Tipe file "${mimeType}" tidak didukung. Gunakan JPG, PNG, atau WEBP.`);
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file melebihi batas (${MAX_UPLOAD_BYTES / 1024 / 1024}MB).`);
  }
}

export async function putObject(env: Env, objectKey: string, body: ArrayBuffer, contentType: string): Promise<void> {
  if (demoMode(env)) {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO demo_files (id, object_key, mime_type, body, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(demoFileId(objectKey), objectKey, contentType, body, new Date().toISOString())
      .run();
    return;
  }
  const url = `${env.MINIO_ENDPOINT}/${env.MINIO_BUCKET}/${objectKey}`;
  const res = await client(env).fetch(url, {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gagal mengunggah file ke storage (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function deleteObject(env: Env, objectKey: string): Promise<void> {
  if (demoMode(env)) {
    await env.DB.prepare(`DELETE FROM demo_files WHERE object_key = ?`).bind(objectKey).run();
    return;
  }
  const url = `${env.MINIO_ENDPOINT}/${env.MINIO_BUCKET}/${objectKey}`;
  await client(env).fetch(url, { method: "DELETE" });
}

/** Presigned GET so private objects can be shown in <img> tags without
 * making the bucket public. 24h expiry - a 15min default caused a real bug:
 * anyone leaving a tracking/admin page open past that window (or a mobile
 * browser evicting and re-fetching an image from memory) got a 403 from
 * MinIO ("Request has expired"), which renders as a broken-image icon with
 * no visible error. Every URL is signed fresh per page load anyway, so this
 * only widens the window during a single viewing session - it doesn't make
 * links long-lived or shareable beyond that. */
export async function presignGet(env: Env, objectKey: string, expiresSeconds = 60 * 60 * 24): Promise<string> {
  if (demoMode(env)) {
    // Static demo: files live in SQLite inside the browser, so return the
    // image inline as a data URL. <img src> then works with no server route.
    const row = await env.DB.prepare(`SELECT mime_type, body FROM demo_files WHERE object_key = ?`)
      .bind(objectKey)
      .first<{ mime_type: string; body: ArrayBuffer | number[] | Uint8Array }>();
    if (!row) return "";
    const raw = row.body;
    const bytes =
      raw instanceof ArrayBuffer
        ? new Uint8Array(raw)
        : ArrayBuffer.isView(raw)
          ? new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
          : new Uint8Array(raw as number[]);
    return `data:${row.mime_type};base64,${bytesToBase64(bytes)}`;
  }
  const u = new URL(`${env.MINIO_ENDPOINT}/${env.MINIO_BUCKET}/${objectKey}`);
  u.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  const signed = await client(env).sign(u.toString(), { method: "GET", aws: { signQuery: true } });
  return signed.url;
}
