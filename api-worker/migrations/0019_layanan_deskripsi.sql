-- Master Layanan: optional free-text description per layanan.
-- Additive and nullable - existing rows (and the five seeded layanan) simply
-- have no description until an admin fills one in.
ALTER TABLE layanans ADD COLUMN deskripsi TEXT;
