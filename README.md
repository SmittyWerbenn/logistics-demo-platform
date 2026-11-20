# Sinartrans Logistics — Demo Platform

[![Deploy demo to GitHub Pages](https://github.com/SmittyWerbenn/logistics-demo-platform/actions/workflows/deploy.yml/badge.svg)](https://github.com/SmittyWerbenn/logistics-demo-platform/actions/workflows/deploy.yml)

**Live demo:** https://logistics-demo.frel.cloud/

A fully static demo of the Sinartrans Logistics tracking & resi system. No backend,
no database server: the real Sinartrans Worker code runs in the browser against a
SQLite (WASM) database stored in IndexedDB, seeded with fictional demo data.

- Run locally: `npm install && npm run dev` → http://localhost:5184
- Demo guide (accounts, scenarios): [README-DEMO.md](README-DEMO.md)
- Deploy: push to GitHub, then Settings → Pages → Source: **GitHub Actions**
  (`.github/workflows/deploy.yml` handles the build and the base path).

What is inside:

- React 19 + Vite + TypeScript + Tailwind SPA (public site, admin portal,
  driver portal).
- `api-worker/` — the real Cloudflare Worker (routing, RBAC, validation, AWB
  numbering, audit log) plus its D1 migrations and demo seed. It is compiled
  into the static build and runs in-browser via `src/demo/`.
- `cloudflare-worker/` — production email worker (kept for reference, not used
  by the demo; email sending is stubbed).

## Modul Ekspedisi — Order & Price Management

Modul ini mengikuti *Ekspedisi — Order & Price Management System Product Brief*: bukan TMS (tanpa tracking driver / fleet),
fokusnya menyimpan pengetahuan operasional admin agar operasional tidak bergantung pada satu orang.

Menu admin: **Ekspedisi** → Order & Resi, Master Customer, Master Rute, Master Harga, Piutang (PAD), Pengaturan (Owner).

- **Master Customer / Rute / Harga** — harga hidup berdasarkan rute + pengirim + penerima + pembayar (+ berat / jenis barang).
  Urutan fallback: *exact* → *rute + pengirim* → *harga publish rute* → *manual*.
- **Log perubahan harga** — setiap perubahan tercatat; bila `Persetujuan harga` aktif, perubahan Admin menunggu persetujuan Owner.
- **Order** — resi otomatis (format dapat diatur, default `EXP-{YYYY}-{NNNNN}`), harga terisi otomatis dari tabel harga, riwayat status
  (Baru → Dijemput → Dikirim → Tiba → Selesai / Batal).
- **Piutang PAD** — Belum Ditagih / Ditagih / Lunas, overdue dihitung otomatis dari jatuh tempo.
- **Cetak PDF** — resi, surat jalan, invoice.
- **RBAC** — `ekspedisi.manage` (Admin, Superadmin) dan `ekspedisi.approve` (Superadmin = Owner).

Di mode demo, data contoh (4 customer, 4 rute, 7 order, piutang termasuk overdue, 1 usulan harga pending) dibuat oleh
`npm run demo:seed`. Di luar lingkup fase 1: portal customer, notifikasi WA, tracking driver, laporan keuangan.

## Dashboard Keuangan

Superadmin/Admin melihat **Laporan Keuangan** di Dashboard: pendapatan bulan ini & tren, piutang (PAD) berjalan/jatuh tempo, aging piutang, top customer & rute, ekspor CSV dan cetak. Endpoint: `GET /api/dashboard/finance?months=6` (permission `ekspedisi.manage`).
