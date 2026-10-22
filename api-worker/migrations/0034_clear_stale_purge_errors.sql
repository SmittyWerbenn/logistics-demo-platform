-- Shipments binned with Hold / cancellation history could not be purged because those child tables
-- (shipment_holds, cancellation_requests) were not cleared first. The purge now removes them, so the
-- stale "FOREIGN KEY constraint failed" notes on still-binned rows are cleared; a future failure re-records its own reason.
UPDATE recycle_bin
SET purge_error = NULL
WHERE status = 'IN_BIN' AND purge_error LIKE '%FOREIGN KEY constraint failed%';
