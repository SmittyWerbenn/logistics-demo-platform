-- WhatsApp Admin / WhatsApp Superadmin (Pengaturan > Informasi Bantuan).
--
-- Until now one number, labelled "WhatsApp (CS / Admin)" (settings key
-- help_phone_number), served both the public Compro and every Admin help
-- button. It stays as WhatsApp CS. So the help buttons keep working the moment
-- the new code is deployed, WhatsApp Admin is seeded from that same number
-- (only when it isn't already set); the Superadmin can change it afterwards.
-- WhatsApp Superadmin has no previous equivalent and is intentionally left
-- unset: its button reports "belum dikonfigurasi" until it is filled in.
INSERT OR IGNORE INTO settings (key, value, updated_at, updated_by)
SELECT 'help_whatsapp_admin', value, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL
FROM settings
WHERE key = 'help_phone_number' AND TRIM(value) <> '';
