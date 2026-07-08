/**
 * TVS Motor maintenance-interval parser.
 *
 * INVESTIGATION RESULT (verified against the live page on 2026-07-08):
 *
 *   URL fetched: https://www.tvsmotor.com/our-service/user-manual
 *   HTTP status: 200 OK (fetched with curl + a realistic desktop Chrome
 *   User-Agent, following redirects; page size ~279 KB).
 *
 *   This page is NOT a maintenance-schedule/service-interval page at all.
 *   Its own <title> is "TVS Motor User Manuals - Motorcycles, Scooters,
 *   Moped" and its content is a filterable directory of ~99 PDF *owner's
 *   manual* download links (one or more PDFs per model/variant, e.g.
 *   "/-/media/Feature/Owners/.../TVS-Apache-RTR-160-2V.pdf",
 *   "/-/media/Feature/Owners/UserManual2026/.../TVS-Jupiter-...pdf", etc.),
 *   organized under headings like "Vehicle User Manual" > "Motorcycle" /
 *   "Scooter" / "Moped", with client-side dropdown filters for Vehicle
 *   Type / Vehicle Name / Manufactured Date.
 *
 *   Concretely, in the raw HTML actually returned by axios/curl for this
 *   URL:
 *     - There are zero <table> elements (grep for "<table" and "<th"
 *       both return 0 matches) and zero div/card elements that visually
 *       lay out a maintenance schedule (no "km"/"interval"/"schedule"
 *       wording anywhere in the document).
 *     - There is no __NEXT_DATA__ or other embedded JSON blob containing
 *       structured interval data.
 *     - The page's own script (/assets/js/userManual.js) was also fetched
 *       and inspected: it only does client-side jQuery filtering/toggling
 *       of the already server-rendered `.filterListWrap` PDF-link blocks
 *       (by vehicle type / name / manufactured date). It contains no
 *       $.ajax/fetch/axios calls and references no API endpoint that
 *       returns interval/schedule JSON.
 *     - There is consequently no discoverable API endpoint to call
 *       instead of parsing HTML.
 *
 *   In short: TVS does not publish a maintenance-interval table (HTML,
 *   card-based, or JSON) anywhere on this page or via an API it calls.
 *   The actual service-interval information (if published at all) would
 *   live inside the individual per-model PDF owner's-manual documents
 *   themselves (99 separate PDF files), which would require downloading
 *   and OCR/text-extracting each PDF per model -- a fundamentally
 *   different scraping strategy (PDF parsing, akin to this codebase's
 *   existing parsePdfIntervals()) rather than an HTML/table/JS-API parser,
 *   and is out of scope for this file.
 *
 *   Per the honesty requirement for this task: this function deliberately
 *   returns an empty array rather than fabricating plausible-looking but
 *   unverified interval numbers. A human should decide whether it's worth
 *   building a PDF-based extraction path (locate the right PDF for a given
 *   model, download it, and text/OCR-parse its maintenance-schedule
 *   section) as a follow-up, separate from this HTML parser.
 */

import type { SuggestedInterval } from "../oem-interval.service";

export function parseTvsIntervals(
  html: string,
  modelHint?: string,
): SuggestedInterval[] {
  // No server-rendered table, card layout, embedded JSON, or discoverable
  // API endpoint contains real maintenance-interval data on the TVS
  // user-manual page (see file header for the full investigation notes).
  // Returning an empty array intentionally instead of guessing.
  return [];
}
