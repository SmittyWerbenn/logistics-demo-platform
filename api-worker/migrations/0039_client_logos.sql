-- Client Company Profile: 13 logo yang sekarang hardcoded di
-- src/data/compro/assetsMap.ts (clientLogos) dipindah ke tabel sisi-server
-- supaya Superadmin bisa kelola lewat Portal Admin tanpa deploy ulang.
--
-- Dua mode gambar:
--   * external_url  -> logo statis yang sudah ada di /assets (public), tidak
--                      perlu object storage
--   * file_id       -> logo upload lewat Portal Admin (MinIO + tabel files)
CREATE TABLE IF NOT EXISTS client_logos (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  aktif INTEGER NOT NULL DEFAULT 1,
  external_url TEXT,
  file_id TEXT REFERENCES files(id),
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT,
  updated_by TEXT,
  deleted_at TEXT,
  CHECK (external_url IS NOT NULL OR file_id IS NOT NULL)
);

-- Aktif saja + urutan tampilan: satu index buat dipakai publik + admin.
CREATE INDEX IF NOT EXISTS idx_client_logos_active_order ON client_logos(aktif, sort_order, created_at)
  WHERE deleted_at IS NULL;

-- 13 logo existing, urutan = urutan tampilan saat ini di COMPRO.
INSERT INTO client_logos (id, nama, alt_text, sort_order, aktif, external_url, created_at)
VALUES
  ('cl_jnt',            'J&T Express',      'J&T Express',      1,  1, '/assets/01.jnt.webp',            '2026-10-11T00:00:00.000Z'),
  ('cl_cimory',         'Cimory',           'Cimory',           2,  1, '/assets/02.cimory.webp',         '2026-10-11T00:00:00.000Z'),
  ('cl_transkon',       'Transkon Rent',    'Transkon Rent',    3,  1, '/assets/03.transkon.webp',      '2026-10-11T00:00:00.000Z'),
  ('cl_bukaka',         'Bukaka',           'Bukaka',           4,  1, '/assets/04.bukaka.webp',         '2026-10-11T00:00:00.000Z'),
  ('cl_bach',           'Bach Group',       'Bach Group',       5,  1, '/assets/05-bach-group.webp',    '2026-10-11T00:00:00.000Z'),
  ('cl_philips',        'Philips',          'Philips',          6,  1, '/assets/06-philips.webp',       '2026-10-11T00:00:00.000Z'),
  ('cl_haefele',        'Häfele',           'Häfele',           7,  1, '/assets/07-haefele.webp',       '2026-10-11T00:00:00.000Z'),
  ('cl_shopee',         'Shopee Xpress',    'Shopee Xpress',    8,  1, '/assets/08-shopee-xpress.webp', '2026-10-11T00:00:00.000Z'),
  ('cl_antv',           'ANTV',             'ANTV',             9,  1, '/assets/09-antv.webp',          '2026-10-11T00:00:00.000Z'),
  ('cl_lion',           'Lion Parcel',      'Lion Parcel',      10, 1, '/assets/10-lion-parcel.webp',   '2026-10-11T00:00:00.000Z'),
  ('cl_lazada',         'Lazada Express',   'Lazada Express',   11, 1, '/assets/11-lazada-express.webp','2026-10-11T00:00:00.000Z'),
  ('cl_sicepat',        'SiCepat Ekspres',  'SiCepat Ekspres',  12, 1, '/assets/12-sicepat-ekspres.webp','2026-10-11T00:00:00.000Z'),
  ('cl_tata',           'Tata Motors',      'Tata Motors',      13, 1, '/assets/13-tata-motors.webp',   '2026-10-11T00:00:00.000Z');