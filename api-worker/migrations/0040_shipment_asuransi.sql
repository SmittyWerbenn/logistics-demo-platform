-- 0040_shipment_asuransi.sql
-- Add insurance fields to shipments. Safe for existing data: all columns
-- have defaults / are nullable, so old shipments (no insurance info) stay
-- readable with asuransi = 0 (Tidak), koli_asuransi = NULL, nilai_asuransi = NULL.
--
-- koli_asuransi: comma-separated koli numbers that are insured (e.g. "1,3,5").
--                NULL when insurance is not active.
-- nilai_asuransi: insured value in Rupiah. NULL when insurance is not active.

ALTER TABLE shipments ADD COLUMN asuransi INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shipments ADD COLUMN koli_asuransi TEXT;
ALTER TABLE shipments ADD COLUMN nilai_asuransi REAL;
