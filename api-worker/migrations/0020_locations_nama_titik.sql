-- Kota & Titik Transit: add "Nama Titik Transit".
--
-- The list is now Kota / Kabupaten | Provinsi | Nama Titik Transit:
--  * "Kota / Kabupaten" is the existing nama_kota column (just relabelled -
--    values such as Meulaboh or Kuta are untouched; shipments keep storing
--    this value as their city, so no transaction data is affected).
--  * "Provinsi" is the existing provinsi column, unchanged.
--  * nama_titik is new and nullable: existing rows have no transit-point name
--    yet; it is filled when the admin re-imports the completed file.
--
-- Backward compatible with the currently deployed Worker/frontend: no column
-- is renamed, removed or rewritten, and no existing value is modified.
ALTER TABLE locations ADD COLUMN nama_titik TEXT;

-- One row per (Kota / Kabupaten, Provinsi, Nama Titik Transit), case-insensitive.
-- Legacy rows have a NULL nama_titik, and NULLs never collide in a unique index,
-- so this cannot conflict with existing data - it only guards new/imported rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_unik
  ON locations(nama_kota COLLATE NOCASE, provinsi COLLATE NOCASE, nama_titik COLLATE NOCASE);
