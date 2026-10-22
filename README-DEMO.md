# GMS Demo — Panduan Menjalankan & Presentasi

Demo statis GMS Logistics. **Tanpa backend, tanpa database server** — seluruh
logika API GMS (RBAC, validasi, nomor AWB, audit log) dijalankan di browser
memakai kode Worker asli, dengan database SQLite (WASM) yang disimpan di
IndexedDB browser. Cocok untuk GitHub Pages.

---

## 1. Menjalankan

```bash
npm install
npm run dev        # http://localhost:5184
```

Build produksi statis:

```bash
npm run build      # hasil di dist/
npm run preview    # cek hasil build di http://localhost:5184
```

Deploy GitHub Pages:

1. Push repo ke GitHub (branch `main`).
2. Settings → Pages → Source: **GitHub Actions**.
3. Workflow `.github/workflows/deploy.yml` otomatis build + deploy. Base path
   `/<nama-repo>/` dihitung otomatis; untuk custom domain / `<user>.github.io`
   hasilnya `/`.

Halaman:

| Halaman | URL lokal |
|---|---|
| Situs publik | http://localhost:5184/ |
| Cek ongkir | http://localhost:5184/cek-ongkir |
| Lacak resi | http://localhost:5184/tracking |
| Portal Admin | http://localhost:5184/admin/login |
| Portal Driver | http://localhost:5184/driver/login |

---

## 2. Akun demo

Semua akun memakai password yang sama: **`Demo2026!`**

| Role | Email | Akses |
|---|---|---|
| Superadmin | `superadmin@gms-demo.id` | Semua menu, termasuk Rate Publish, User, Audit Log, Recycle Bin |
| Admin (GMS-Admin) | `admin@gms-demo.id` | Operasional: pengiriman, armada, klaim, feedback |
| Admin (GMS-Admin) | `ops@gms-demo.id` | Sama seperti di atas (contoh admin kedua) |
| Viewer | `viewer@gms-demo.id` | Lihat data, tanpa membuat/mengubah pengiriman |
| Client | `client@gms-demo.id` | Hanya data PT Acme Retail Indonesia (12 resi) |
| Client | `client2@gms-demo.id` | Hanya data PT Nusantara Distribusi Utama (7 resi) |
| Driver | `driver@gms-demo.id` | Portal Driver, unit B 9012 KCD (5 pengiriman) |
| Mitra | `mitra@gms-demo.id` | Hanya 2 resi yang diteruskan ke MITRA01 |

> Driver **wajib** login lewat Portal Driver (`/driver/login`), bukan portal admin.

---

## 3. Data demo yang tersedia

- **29 pengiriman** (AWB per client, mis. `ACME0001`, `NUSA0004`) tersebar
  dalam status: Dalam Persiapan (6), Hold (1), Berangkat (3), Transit (4),
  Dalam Perjalanan (3), Kendala (2), Tiba di Tujuan (2), Selesai/Terkirim (6),
  Dibatalkan (2).
- **Variasi detail**: berat kg, jumlah koli, nomor koli asuransi
  (`62001, 62002`), nilai asuransi, referensi PO, layanan LTL/FTL/Express/
  Regular/Kargo/Darat/Charter.
- **Timeline tracking** 95 event + **6 Proof of Delivery**, feedback bintang,
  notifikasi, audit log, quote request.
- **Master data**: 12 kota/titik (gudang, hub, transit, cabang, tujuan),
  8 armada + 6 driver, 4 client aktif + 1 nonaktif, 2 mitra, 7 layanan,
  tarif Cek Ongkir (migrasi 0023).
- Data dibuat relatif terhadap tanggal build, jadi selalu terlihat "baru".

---

## 4. Skenario presentasi (±10 menit)

1. **Publik** — buka `/`, tunjukkan hero, layanan, armada, coverage, lalu
   **Cek Ongkir** (Jakarta → Surabaya) dan **Lacak Resi** `ACME0010`
   (status Selesai + Proof of Delivery) atau `ACME0006` (Transit).
2. **Client** — login `client@gms-demo.id`: dashboard hanya berisi 12 resi
   Acme; buat pengiriman baru (nomor AWB otomatis `ACME0013`), lalu buka
   halaman tracking-nya.
3. **Admin** — login `admin@gms-demo.id`: dashboard 29 resi, 5 AWB macet,
   rating 4.6; Data Pengiriman → filter status; buka detail `ACME0006` →
   update tracking; konfirmasi klaim driver `ACME0003`; tangani permintaan
   pembatalan `ACME0002` atau pemulihan order `ACME0012`.
4. **Driver** — login `driver@gms-demo.id`: unit B 9012 KCD, 5 pengiriman,
   ambil foto bukti (tersimpan lokal), update status sampai POD.
5. **Superadmin** — login `superadmin@gms-demo.id`: Rate Publish, User,
   Audit Log, Recycle Bin, Client Company Profile, Pengaturan.
6. **Mitra** — login `mitra@gms-demo.id`: hanya 2 resi yang diteruskan.

Tips: siapkan dua jendela browser (publik + admin) agar perubahan status
langsung terlihat di tracking publik setelah refresh.

---

## 5. Reset & penyimpanan data

- Data demo tersimpan **per browser** (IndexedDB, key `gms-demo`). Refresh
  tidak menghapus data; perubahan (buat resi, update tracking, upload foto)
  tetap ada.
- Reset ke kondisi awal: buka `http://localhost:5184/admin/login?reset=1`
  (atau `/driver/login?reset=1`). Bisa juga hapus database `gms-demo` di
  DevTools → Application → IndexedDB.
- Mode Incognito selalu mulai dari data bersih.
- Bump `DEMO_DB_VERSION` di `src/demo/localBackend.ts` bila seed berubah, agar
  browser lama otomatis membangun ulang database.

---

## 6. Arsitektur singkat

```
Browser
├── React SPA (src/)
├── src/demo/localBackend.ts  → memuat kode Worker GMS asli di browser
│     ├── api-worker/src/...  (routing, RBAC, validasi, audit — sama dgn produksi)
│     ├── sqliteD1.ts         (shim D1Database di atas sql.js/SQLite WASM)
│     └── IndexedDB           (persistensi database demo)
└── seed: api-worker/migrations/*.sql + api-worker/seed/demo_seed.sql
```

- **Tanpa jaringan API**: `apiClient` tidak memanggil server saat
  `VITE_DEMO_MODE=true`.
- **Email** di-stub (tombol kirim tetap sukses, tidak ada email keluar).
- **Upload foto** disimpan sebagai BLOB di SQLite browser dan ditampilkan
  sebagai data URL.
- Regenerasi data: `npm run demo:seed` lalu `npm run build` (seed di-*bundle*
  saat build).

### Opsional: menjalankan Worker sebagai server lokal

Kode `api-worker/` masih bisa dijalankan dengan `wrangler dev` (D1 lokal)
untuk debugging backend, tetapi **tidak diperlukan** untuk demo/GitHub Pages.
