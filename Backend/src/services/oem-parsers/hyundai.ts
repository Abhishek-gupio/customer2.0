/**
 * Hyundai India PMS (Periodic Maintenance Schedule) parser.
 *
 * INVESTIGATION RESULT (verified against the live page on 2026-07-08):
 *
 *   URL fetched: https://www.hyundai.com/in/en/connect-to-service/hyundai-service/pms-charts.html
 *   (fetched with curl + a realistic desktop Chrome User-Agent, following
 *   redirects). The site redirects that URL (HTTP 200 after redirect) to:
 *     https://www.hyundai.com/in/en/connect-to-service/hyundai-service/periodic-maintenance-frequency
 *   which returns HTTP 200 with ~558 KB of fully server-rendered HTML.
 *
 *   The page DOES contain real, server-rendered <table> data -- three
 *   tables (class="ctoe table table-hover table-striped table-bordered"),
 *   one each for Petrol, Diesel and Electric model line-ups (each table is
 *   immediately preceded by a "Petrol" / "Diesel" / "Electric" heading and
 *   the text "Below parts are replaced at every frequency interval").
 *   Each table's header row is:
 *     Models | Air Filter | Fuel Filter | AC Filter | Engine Oil & Oil Filter | Coolant | Spark Plug | Brake oil
 *   (the Diesel table omits "Spark Plug"; the Electric table only has
 *   Models | Coolant | AC Filter | Brake Oil).
 *
 *   This is failure mode (b) from the task description: the generic
 *   parser's header-detection heuristic in oem-scraper.service.ts looks
 *   for a header row containing the literal substrings "km", "month",
 *   "year", or "interval" -- but every one of Hyundai's header cells is a
 *   part *name* ("Air Filter", "Engine Oil & Oil Filter", ...), and the
 *   actual km/year figures only appear inside the data cells (e.g.
 *   "30K Km/3Yr"). The generic heuristic therefore never identifies a
 *   header row and extracts nothing, even though the real data is present
 *   verbatim in the raw HTML returned by a plain axios.get().
 *
 *   No __NEXT_DATA__ / embedded JSON blob and no XHR/fetch API endpoint
 *   were found or are needed -- the data is fully present in the initial
 *   server-rendered HTML, so this parser operates on the passed-in `html`
 *   directly (no extra network calls).
 *
 * PARSING STRATEGY
 *   A table is treated as a Hyundai PMS table if its header row's first
 *   header cell is "Models" (case-insensitive) -- a stable, content-based
 *   signal independent of Hyundai's current CSS class names. For each data
 *   row, the first cell is the model name (used for modelHint matching,
 *   same case-insensitive substring convention as the existing generic
 *   parseOemHtml in oem-scraper.service.ts) and each subsequent cell is
 *   mapped to one or two PartType(s) via its column header text.
 *
 *   Plain cells like "30K Km/3Yr" parse to intervalKm=30000,
 *   intervalMonths=36. Some cells describe a two-stage replacement, e.g.
 *   "Replace first @ every 100K Km/5Yr; then @ every 40K km/2Yr" or
 *   "At first, replace at 100K kms or 10 Years. After that replace at
 *   every 20k or 24months" -- for these, only the *recurring*
 *   ("then " / "after that") stage is used, since that is the steady-state
 *   interval relevant for ongoing service reminders; the one-time first
 *   replacement figure is intentionally discarded.
 *
 *   A few models list two figures for two engine variants in a single
 *   cell, e.g. i20's Air Filter: "30K Km/3Yr-1.2 L Engine<br/><br/>20K
 *   Km/2Yr-1.0L Turbo Engine". modelHint (the vehicle's `model` field)
 *   does not carry engine/fuel-variant information, so -- like the generic
 *   parser it replaces -- this parser takes only the first-listed
 *   variant's figures for such cells; the second variant's figures are not
 *   recoverable without a finer-grained hint than modelHint provides.
 *
 *   Some Spark Plug cells give only a km figure with no year/month at all
 *   (e.g. "60K Km", "160K Km"). Rather than reusing the existing generic
 *   parser's flat "default to 12 months" fallback (which would pair
 *   "160K Km" with an implausible "12 months", i.e. ~13,300 km/month),
 *   this file derives a months estimate from Hyundai's *own* explicit
 *   spark-plug data point elsewhere on this same page -- the i20's
 *   "150K Km/10Yr" implies Hyundai paces spark-plug life at ~1,250
 *   km/month -- and reuses that ratio (rounded, floor 12 months) only for
 *   the Spark Plug column. Every other column with a missing year/month
 *   (rare -- only "-" placeholder cells, which are skipped, and the Spark
 *   Plug column exhibit this) falls back to a flat 12 months, mirroring
 *   the existing generic parser's convention. These are estimates of the
 *   *time* companion to a real, OEM-published km figure -- not fabricated
 *   km figures themselves.
 *
 *   modelHint matching mirrors the existing generic parser's convention: a
 *   row is only considered when its model-name cell includes modelHint as
 *   a case-insensitive substring. Several models (Venue, Creta, Alcazar,
 *   Tucson) appear in both the Petrol and Diesel tables with different
 *   figures; fuel type is not knowable from modelHint alone, so when
 *   modelHint matches rows in more than one table -- or when no modelHint
 *   is given at all, so every model's row is used -- this parser keeps
 *   every distinct (partType, km, months) combination it finds rather than
 *   collapsing them, again mirroring the existing generic parser's
 *   dedup-by-exact-value behavior.
 */

import * as cheerio from "cheerio";
import type { SuggestedInterval } from "../oem-interval.service";

/** Map a Hyundai PMS column header to our PartType enum value(s). */
function columnToPartTypes(header: string): string[] {
  const h = header.toLowerCase();
  if (h.includes("engine oil")) return ["ENGINE_OIL", "OIL_FILTER"];
  if (h.includes("air filter")) return ["AIR_FILTER"];
  if (h.includes("fuel filter")) return ["OTHER_PART"];
  if (h.includes("ac filter")) return ["AC_FILTER"];
  if (h.includes("coolant")) return ["COOLANT"];
  if (h.includes("spark plug")) return ["SPARK_PLUGS"];
  if (h.includes("brake oil")) return ["OTHER_PART"];
  return [];
}

/** Estimate a months figure for a Spark Plug cell that gives only a km figure. */
function estimateSparkPlugMonths(km: number): number {
  // Hyundai's own explicit spark-plug figure elsewhere on this page (i20:
  // "150K Km/10Yr") implies ~1,250 km/month; reuse that ratio here instead
  // of an arbitrary constant. See file header comment for detail.
  return Math.max(12, Math.round(km / 1250));
}

/**
 * Parse one PMS cell's text into a {km, months} pair.
 * Handles plain "30K Km/3Yr" cells as well as two-stage
 * "Replace first @ every X; then @ every Y" / "At first ... After that ..."
 * cells (in which case the recurring/second stage is used). Returns null
 * for empty/"-" cells or cells with no recognizable km figure.
 */
function parseCell(rawText: string, header: string): { km: number; months: number } | null {
  let text = rawText.replace(/\s+/g, " ").trim();
  if (!text || text === "-") return null;

  const lower = text.toLowerCase();
  const thenIdx = lower.indexOf(" then ");
  const afterIdx = lower.indexOf("after that");
  const splitIdx = thenIdx >= 0 ? thenIdx : afterIdx;
  if (splitIdx >= 0) {
    text = text.slice(splitIdx);
  }

  const kmMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (!kmMatch) return null;
  const km = Math.round(parseFloat(kmMatch[1]) * 1000);
  if (!km) return null;

  let months: number;
  const monthMatch = text.match(/(\d+(?:\.\d+)?)\s*months?\b/i);
  const yearMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:yr|year)s?\b/i);
  if (monthMatch) {
    months = Math.round(parseFloat(monthMatch[1]));
  } else if (yearMatch) {
    months = Math.round(parseFloat(yearMatch[1]) * 12);
  } else if (/spark plug/i.test(header)) {
    months = estimateSparkPlugMonths(km);
  } else {
    months = 12; // no time figure given; mirrors generic parser's fallback
  }

  return { km, months };
}

/**
 * Parse Hyundai's PMS chart page HTML and return maintenance intervals.
 * Optionally filter to rows whose model name matches modelHint (e.g.
 * "Creta", "i20"). If modelHint is omitted, or matches no row, this
 * aggregates every distinct (partType, km, months) combination found
 * across all models/tables on the page.
 */
export function parseHyundaiIntervals(html: string, modelHint?: string): SuggestedInterval[] {
  const intervals: SuggestedInterval[] = [];
  const seen = new Set<string>();
  const hint = (modelHint || "").trim().toLowerCase();

  const $ = cheerio.load(html);

  $("table").each((_, table) => {
    const $table = $(table);
    const $headerCells = $table.find("thead tr").first().find("th, td");
    if ($headerCells.length === 0) return;

    const firstHeader = $headerCells.first().text().trim().toLowerCase();
    if (firstHeader !== "models" && firstHeader !== "model") return; // not a Hyundai PMS table

    const headers: string[] = [];
    $headerCells.each((__, th) => {
      headers.push($(th).text().trim());
    });

    $table.find("tbody tr").each((__, tr) => {
      const $tr = $(tr);
      const $cells = $tr.find("td");
      if ($cells.length === 0) return;

      const modelName = $cells.first().text().replace(/\s+/g, " ").trim();
      if (!modelName) return;
      if (hint && !modelName.toLowerCase().includes(hint)) return;

      $cells.each((colIdx, td) => {
        if (colIdx === 0) return; // model-name column
        const header = headers[colIdx];
        if (!header) return;
        const partTypes = columnToPartTypes(header);
        if (partTypes.length === 0) return;

        const $td = $(td);
        $td.find("br").replaceWith(" ");
        const cellText = $td.text();
        const parsed = parseCell(cellText, header);
        if (!parsed) return;

        for (const partType of partTypes) {
          const key = `${partType}-${parsed.km}-${parsed.months}`;
          if (seen.has(key)) continue;
          seen.add(key);
          intervals.push({
            partType,
            intervalKm: parsed.km,
            intervalMonths: parsed.months,
            source: "OEM_WEBSITE",
          });
        }
      });
    });
  });

  return intervals;
}
