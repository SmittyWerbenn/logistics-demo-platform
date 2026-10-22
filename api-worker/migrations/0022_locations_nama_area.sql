-- Kota & Titik Transit: add "Nama Area" (shown right after Kode).
-- Additive and nullable: no existing column or value is touched.
ALTER TABLE locations ADD COLUMN nama_area TEXT;
