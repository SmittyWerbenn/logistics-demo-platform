-- One-time data migration: renames existing AWBs from the old
-- "GMS<YYMMDD>-<NNN>" format to the new "G<YYMMDD><NNN>" format (see
-- src/awb.ts). Confirmed with the business owner that already-shared
-- tracking links/printed resi under the old format will stop resolving.
--
-- shipments.awb is a PRIMARY KEY referenced (ON UPDATE NO ACTION) by
-- several child tables, so a straight UPDATE would violate those FK
-- constraints while children still point at the old value. Instead:
-- duplicate each shipment row under its new awb (old+new coexist),
-- repoint every child table to the new value (now satisfiable), then
-- drop the old shipment rows.

INSERT INTO shipments (
  awb, tanggal_dibuat, jam_dibuat, status,
  pengirim_nama, pengirim_telepon, pengirim_email,
  penerima_nama, penerima_telepon, penerima_email,
  alamat_asal, kota_asal, alamat_tujuan, kota_tujuan,
  deskripsi_barang, layanan, berat_kg, jumlah_koli, truck_id,
  email_terkirim, email_terkirim_at, estimasi_tiba,
  created_at, updated_at, created_by, updated_by,
  sla_value, sla_unit, claim_status, claim_driver_id, claim_requested_at
)
SELECT
  'G' || substr(awb,4,6) || substr(awb,11), tanggal_dibuat, jam_dibuat, status,
  pengirim_nama, pengirim_telepon, pengirim_email,
  penerima_nama, penerima_telepon, penerima_email,
  alamat_asal, kota_asal, alamat_tujuan, kota_tujuan,
  deskripsi_barang, layanan, berat_kg, jumlah_koli, truck_id,
  email_terkirim, email_terkirim_at, estimasi_tiba,
  created_at, updated_at, created_by, updated_by,
  sla_value, sla_unit, claim_status, claim_driver_id, claim_requested_at
FROM shipments
WHERE awb LIKE 'GMS%';

UPDATE shipment_timeline_events SET awb = 'G' || substr(awb,4,6) || substr(awb,11) WHERE awb LIKE 'GMS%';
UPDATE shipment_pod SET awb = 'G' || substr(awb,4,6) || substr(awb,11) WHERE awb LIKE 'GMS%';
UPDATE notifications SET awb = 'G' || substr(awb,4,6) || substr(awb,11) WHERE awb LIKE 'GMS%';
UPDATE feedback SET awb = 'G' || substr(awb,4,6) || substr(awb,11) WHERE awb LIKE 'GMS%';
UPDATE driver_position_reports SET awb = 'G' || substr(awb,4,6) || substr(awb,11) WHERE awb LIKE 'GMS%';
UPDATE files SET entity_id = 'G' || substr(entity_id,4,6) || substr(entity_id,11)
  WHERE entity_type IN ('shipment_photo','shipment_surat_jalan','pod_barang','pod_surat_jalan') AND entity_id LIKE 'GMS%';
UPDATE audit_log SET awb = 'G' || substr(awb,4,6) || substr(awb,11) WHERE awb LIKE 'GMS%';

DELETE FROM shipments WHERE awb LIKE 'GMS%';
