/**
 * Royal Enfield maintenance-interval parser.
 *
 * INVESTIGATION RESULT (verified against the live page on 2026-07-08):
 *
 *   URL fetched: https://www.royalenfield.com/in/en/support/owners-manual/
 *   HTTP status: 200 OK (fetched with curl + a realistic desktop Chrome
 *   User-Agent, following redirects; page size ~354 KB / 5792 lines).
 *
 *   This page is NOT a maintenance-schedule/service-interval page at all.
 *   Its own <title> is "Download Motorcycle Owner's Manual Online | Royal
 *   Enfield" and its content is a directory of 27 "Download Owner's Manual"
 *   buttons, one per motorcycle model/variant (Classic 350, Hunter 350,
 *   Himalayan, Interceptor, Continental GT, Bullet 350/500/ES, Meteor,
 *   Super Meteor 650, Shotgun 650, Scram 411/440, Guerrilla 450, etc.).
 *   Each button carries a `data-json` attribute listing one or more
 *   BS-IV/BS-VI variant entries, each pointing at a `pdfAssetPath` for that
 *   model's full owner's-manual PDF (e.g.
 *   "/content/dam/open-pdf/royal-enfield-classic_350_single-channel-owners-manual-english.pdf").
 *
 *   Concretely, in the raw HTML actually returned for this URL:
 *     - There are zero <table> elements (grep for "<table" returns 0
 *       matches) and zero div/card elements that visually lay out a
 *       maintenance schedule -- there is not a single occurrence of "km"
 *       (case-insensitive) anywhere in the document, nor of "first
 *       service"/"service interval"/"periodic maintenance"/"maintenance
 *       schedule".
 *     - There is no __NEXT_DATA__ or other embedded JSON blob containing
 *       structured interval data. The only embedded JSON (`data-json` on
 *       each download button) contains PDF asset paths/labels only
 *       (dropdownText/buttonText/modelValue/pdfAssetPath), never numbers.
 *     - Grepped the page for every "api.royalenfield.com/..." reference
 *       findable in its scripts: they are all auth/login/OTP/feedback/
 *       owners-manual-*form*-submission endpoints (facebook-login,
 *       google-login, otp-verification, owners-manual/create, etc.) --
 *       none of them return maintenance-schedule/interval JSON. There is
 *       consequently no discoverable API endpoint that serves this data
 *       either.
 *
 *   In short: like TVS's "user-manual" directory page, Royal Enfield does
 *   not publish a maintenance-interval table (HTML, card-based, or JSON)
 *   anywhere on this page or via an API it calls. The actual
 *   service-interval information lives inside the individual per-model PDF
 *   owner's-manual documents themselves (27 separate PDF files, ~5-15 MB
 *   each), which is a fundamentally different scraping strategy (PDF
 *   parsing, akin to this codebase's existing parsePdfIntervals()) than an
 *   HTML/table/JS-API parser -- and is out of scope for a synchronous
 *   function that only receives this listing page's HTML string.
 *
 *   Extra diligence performed beyond what this file's exported function can
 *   act on (documented here for whoever evaluates whether a PDF-based
 *   pipeline is worth building for this OEM): one of the linked PDFs
 *   (the "All New Classic 350" BS-VI single-channel owner's manual) was
 *   downloaded and run through this repo's existing `pdf-parse` dependency.
 *   Its text extracted cleanly (not a scanned image) and page 84-90 contain
 *   a real "PERIODICAL MAINTENANCE" chart: a matrix of part descriptions
 *   (e.g. "Engine oil (level check/replace)", "Air filter element", "Spark
 *   plug", "Rear wheel drive chain") against 11 km columns
 *   (500 / 5,000 / 10,000 / ... / 50,000 km) with per-cell codes
 *   (R=Replace, I=Inspect, C=Clean, A=Adjust, L=Lubricate). For example,
 *   the engine-oil row's code string "RIRIRIRIRIR" lines up 1:1 with the
 *   11 declared km columns, decoding to: replace at 500 km (first service),
 *   then replace every 10,000 km thereafter (10k/20k/30k/40k/50k), with an
 *   inspection-only check at the intermediate 5k marks -- this matches
 *   Royal Enfield's publicly known 10,000 km service interval for its
 *   J-platform engines, so the numbers are genuine, not noise.
 *
 *   However, reliably automating this is materially harder than a normal
 *   table parser and does not fit this file's required synchronous
 *   `(html: string) => SuggestedInterval[]` shape:
 *     1. The model must first be resolved (via modelHint) to the correct
 *        one of 27 `pdfAssetPath` values embedded in this listing page's
 *        `data-json` attributes.
 *     2. That specific PDF (several MB) must then be fetched over the
 *        network -- an async operation -- and passed through pdf-parse.
 *     3. Only rows whose flattened code string length exactly equals the
 *        number of declared km columns (11 here) can be safely decoded
 *        position-by-position; pdf-parse's plain-text extraction discards
 *        column/x-coordinate alignment, so rows with fewer characters than
 *        columns (meaning some columns have no action at all) cannot be
 *        unambiguously re-aligned to specific km values without guessing --
 *        exactly the kind of "confidently wrong number" risk this task
 *        asked us to avoid. Every model's PDF would also need this chart
 *        located and re-verified independently (page numbers, columns, and
 *        row wording differ per model/engine platform).
 *
 *   Per the honesty requirement for this task: this function deliberately
 *   returns an empty array rather than fabricating plausible-looking but
 *   unverified interval numbers from the listing-page HTML it is actually
 *   given (which contains none). A human should decide whether it's worth
 *   building a dedicated async PDF pipeline (resolve model -> pdfAssetPath
 *   -> fetch PDF -> pdf-parse -> decode the "PERIODICAL MAINTENANCE" matrix
 *   per the alignment caveat above) as a follow-up, separate from this HTML
 *   parser -- the Classic 350 manual investigated above shows the data is
 *   real and worth the investment if per-model chart layouts turn out to be
 *   consistent enough to decode safely.
 */

import type { SuggestedInterval } from "../oem-interval.service";

export function parseRoyalEnfieldIntervals(
  html: string,
  modelHint?: string,
): SuggestedInterval[] {
  // No server-rendered table, card layout, embedded JSON, or discoverable
  // API endpoint contains real maintenance-interval data on the Royal
  // Enfield owners-manual listing page (see file header for the full
  // investigation notes). The real chart lives inside per-model PDFs this
  // page merely links to, which requires a separate async PDF-fetch +
  // parse pipeline outside this function's scope. Returning an empty array
  // intentionally instead of guessing.
  return [];
}
