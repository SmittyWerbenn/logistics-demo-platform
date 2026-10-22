-- "Referensi": the customer's own order identifier from the order template. Stored on the shipment so the AWB the
-- system issues is tied to the right order by reference (never by row position). Unique per Client ID,
-- case-insensitive, so re-importing the same template can never create a second AWB for the same reference.
ALTER TABLE shipments ADD COLUMN reference TEXT;
CREATE UNIQUE INDEX idx_shipments_customer_reference ON shipments(customer_id, reference COLLATE NOCASE) WHERE reference IS NOT NULL;
