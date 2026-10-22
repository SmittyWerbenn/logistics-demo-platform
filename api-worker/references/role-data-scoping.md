# Role-based data scoping di API endpoints

## Pola umum

Setiap endpoint yang menampilkan data terikat AWB/resi perlu di-scope per role
agar Client/Viewer/Mitra hanya melihat data miliknya sendiri.

Pola kode di `api-worker/src/routes/*.ts`:

```ts
const custScope = actor.role === "Client" || (actor.role === "Viewer" && !!actor.customerId);
const mitraScope = actor.role === "Mitra";
```

Kemudian WHERE clause disusun berdasarkan scope:

```ts
const where = custScope
  ? "WHERE n.awb IN (SELECT awb FROM shipments WHERE customer_id = ?)"
  : mitraScope
    ? "WHERE n.awb IN (SELECT awb FROM shipments WHERE mitra_id = ?)"
    : "";
const bind: unknown[] = custScope ? [actor.customerId] : mitraScope ? [actor.mitraId] : [];
```

Bind parameters dilewatkan sebagai spread `...bind` sebelum limit/offset.

## Endpoint yang sudah di-scope

| Endpoint | File | Scope via | Keterangan |
|---|---|---|---|
| `GET /api/shipments` | `shipments.ts` | customer_id / mitra_id | Existing sejak awal |
| `GET /api/dashboard/stats` | `dashboard.ts` | customer_id / mitra_id | + avgRating discope via subquery feedback JOIN shipments |
| `GET /api/feedback` | `feedback.ts` | customer_id / mitra_id | Summary (rating breakdown) juga ikut discope |
| `GET /api/notifications` | `notifications.ts` | customer_id / mitra_id | + read-all discope juga |
| `POST /api/notifications/read-all` | `notifications.ts` | customer_id / mitra_id | Mitra/Client/Viewer hanya mark notif sendiri |

## Yang TIDAK di-scope

- Superadmin, Admin, Driver → selalu global (lihat semua data)
- `POST /api/public/feedback` — endpoint publik untuk submit, tidak perlu scope
- Notifikasi/Customer Rating untuk role selain Client/Viewer/Mitra tetap global

## Catatan

- `actor.customerId` di-set hanya untuk role Client dan Viewer (yang memiliki
  `customer_id` di tabel users). `actor.mitraId` hanya untuk Mitra.
- Scope berasal dari token (loadUserFromRequest), BUKAN dari body/query frontend.
- Jangan pernah percaya `customerId`/`mitraId` yang dikirim klien.
- Pola `custBind(...extra)` di dashboard.ts menggabungkan bind params scope
  dengan params tambahan (misal stagnantCutoff). Untuk endpoint lain cukup
  spread langsung.
