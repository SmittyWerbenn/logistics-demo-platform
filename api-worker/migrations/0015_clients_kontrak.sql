-- "Kontrak Kerja Sama / No. Pelanggan" of a Client: one free-text field that
-- holds either a cooperation-contract number or a customer number, whichever
-- the client has (e.g. "CTR/TATA/2026/001" or "CUST-00025"). Optional.
-- Only Superadmin may change it (enforced in routes/users.ts, not just in the UI).
ALTER TABLE clients ADD COLUMN kontrak_no_pelanggan TEXT;
