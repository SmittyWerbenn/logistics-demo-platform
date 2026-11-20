/** Pulls the AWB out of either a bare code ("G260911001") or a full
 * tracking URL (e.g. the QR codes this app itself prints encode the URL).
 * Shared by the camera scanner and the manual AWB entry so both accept the
 * same input. */
export function extractAwb(rawText: string): string {
  const urlMatch = rawText.match(/\/tracking\/([^/?#]+)/i);
  return (urlMatch ? urlMatch[1] : rawText).trim();
}
