-- Client on/off switch. aktif = 0 freezes every account linked to the
-- Client ID (login + existing sessions rejected) without touching the users rows.
ALTER TABLE clients ADD COLUMN aktif INTEGER NOT NULL DEFAULT 1;
