/**
 * OEM scraper health-check / audit script.
 *
 * Pure read-only network diagnostic: does NOT touch the database and does NOT import
 * Prisma or warranty.service.ts directly. It reuses the real parsing logic
 * (OEM_URL_CONFIG, parseOemHtml, parsePdfIntervals) from oem-scraper.service.ts so the
 * results reflect exactly what production would parse, without writing anything back.
 * For OEMs with a config.customParser (see OEM_URL_CONFIG in oem-scraper.service.ts),
 * that site-specific parser is used instead of the generic parseOemHtml, matching
 * production's customParser-preferred-else-generic behavior.
 *
 * Run from Backend/:
 *   npx ts-node scripts/audit-oem-scrapers.ts
 */
import path from "path";
// Load Backend .env (for GEMINI_API_KEY, used by parsePdfIntervals) relative to this
// script's location, same pattern as scripts/test-telematics-full-flow.ts, since cwd
// when invoking ts-node may not be Backend/.
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

import axios from "axios";
import {
  OEM_URL_CONFIG,
  parseOemHtml,
  parsePdfIntervals,
} from "../src/services/oem-scraper.service";

type OemConfigEntry = (typeof OEM_URL_CONFIG)[number];

/** Per-request timeout: bounded at 15-20s so one hanging site can't stall the whole audit. */
const PER_REQUEST_TIMEOUT_MS = 20000;

type ParsedSample = { partType: string; intervalKm: number; intervalMonths: number };

type AuditResult = {
  makeKey: string;
  url: string;
  type: "html" | "pdf";
  status: "WORKING" | "BROKEN";
  httpStatus?: number;
  fetchError?: string;
  parsedCount: number;
  samples: ParsedSample[];
  /** Only set when status === "BROKEN": distinguishes an unreachable/blocked site from a page whose HTML structure we no longer understand. */
  problem?: "FETCH_FAILURE" | "PARSE_FAILURE";
};

async function auditOne(config: OemConfigEntry): Promise<AuditResult> {
  const { makeKey, url, type } = config;

  try {
    if (type === "html") {
      const res = await axios.get(url, {
        timeout: PER_REQUEST_TIMEOUT_MS,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; GupioApp/1.0; +https://gupio.com)",
        },
        maxRedirects: 3,
        validateStatus: () => true,
      });

      if (res.status >= 400) {
        return {
          makeKey,
          url,
          type,
          status: "BROKEN",
          httpStatus: res.status,
          fetchError: `HTTP ${res.status}`,
          parsedCount: 0,
          samples: [],
          problem: "FETCH_FAILURE",
        };
      }

      const html = res.data as string;
      // Prefer the OEM's site-specific parser (if wired in) so the audit reflects exactly
      // what production would parse, matching the customParser-preferred-else-generic
      // pattern in oem-scraper.service.ts's fetchAndSaveIntervalsForVehicle.
      const intervals = config.customParser
        ? config.customParser(html) // no modelHint -- surface everything parseable
        : parseOemHtml(html); // no modelHint -- surface everything parseable
      return {
        makeKey,
        url,
        type,
        httpStatus: res.status,
        parsedCount: intervals.length,
        samples: intervals
          .slice(0, 3)
          .map((i) => ({ partType: i.partType, intervalKm: i.intervalKm, intervalMonths: i.intervalMonths })),
        status: intervals.length > 0 ? "WORKING" : "BROKEN",
        problem: intervals.length > 0 ? undefined : "PARSE_FAILURE",
      };
    }

    // type === "pdf"
    const urlObj = new URL(url);
    const origin = `${urlObj.protocol}//${urlObj.host}`;
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: PER_REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/pdf,*/*",
        Referer: origin + "/",
      },
      validateStatus: () => true,
    });

    if (res.status >= 400) {
      return {
        makeKey,
        url,
        type,
        status: "BROKEN",
        httpStatus: res.status,
        fetchError: `HTTP ${res.status}`,
        parsedCount: 0,
        samples: [],
        problem: "FETCH_FAILURE",
      };
    }

    const pdfBuffer = Buffer.from(res.data);
    const intervals = await parsePdfIntervals(pdfBuffer);
    return {
      makeKey,
      url,
      type,
      httpStatus: res.status,
      parsedCount: intervals.length,
      samples: intervals
        .slice(0, 3)
        .map((i) => ({ partType: i.partType, intervalKm: i.intervalKm, intervalMonths: i.intervalMonths })),
      status: intervals.length > 0 ? "WORKING" : "BROKEN",
      problem: intervals.length > 0 ? undefined : "PARSE_FAILURE",
    };
  } catch (err: any) {
    return {
      makeKey,
      url,
      type,
      status: "BROKEN",
      fetchError: err?.message || String(err),
      parsedCount: 0,
      samples: [],
      problem: "FETCH_FAILURE",
    };
  }
}

async function main() {
  console.log(`Auditing ${OEM_URL_CONFIG.length} OEM scraper configs (concurrently, ${PER_REQUEST_TIMEOUT_MS / 1000}s timeout each)...\n`);

  const results = await Promise.all(
    OEM_URL_CONFIG.map((config) =>
      auditOne(config).catch(
        (err): AuditResult => ({
          makeKey: config.makeKey,
          url: config.url,
          type: config.type,
          status: "BROKEN",
          fetchError: err?.message || String(err),
          parsedCount: 0,
          samples: [],
          problem: "FETCH_FAILURE",
        }),
      ),
    ),
  );

  console.log("=".repeat(100));
  console.log("OEM SCRAPER HEALTH AUDIT — DETAIL");
  console.log("=".repeat(100));

  for (const r of results) {
    console.log(`\n[${r.status}] ${r.makeKey} (${r.type.toUpperCase()})`);
    console.log(`  URL: ${r.url}`);
    console.log(
      `  HTTP status: ${r.httpStatus ?? "N/A"}${r.fetchError ? `  |  Error: ${r.fetchError}` : ""}`,
    );
    console.log(`  Parsed intervals: ${r.parsedCount}`);
    if (r.status === "BROKEN") {
      const label =
        r.problem === "FETCH_FAILURE"
          ? "FETCH FAILURE (URL/site unreachable or blocking us)"
          : "PARSE FAILURE (page loaded fine, but HTML-table parsing logic doesn't understand its structure anymore)";
      console.log(`  Problem: ${label}`);
    }
    if (r.samples.length > 0) {
      console.log("  Sample parsed intervals:");
      for (const s of r.samples) {
        console.log(`    - ${s.partType}: ${s.intervalKm} km / ${s.intervalMonths} months`);
      }
    }
  }

  console.log("\n" + "=".repeat(100));
  console.log("SUMMARY");
  console.log("=".repeat(100));

  const working = results.filter((r) => r.status === "WORKING");
  const broken = results.filter((r) => r.status === "BROKEN");

  console.log(`\nTotal: ${results.length}  |  WORKING: ${working.length}  |  BROKEN: ${broken.length}\n`);

  console.log("makeKey".padEnd(14) + "status".padEnd(10) + "type".padEnd(6) + "httpStatus".padEnd(12) + "parsedCount");
  console.log("-".repeat(60));
  for (const r of results) {
    console.log(
      r.makeKey.padEnd(14) +
        r.status.padEnd(10) +
        r.type.padEnd(6) +
        String(r.httpStatus ?? "-").padEnd(12) +
        String(r.parsedCount),
    );
  }

  if (broken.length > 0) {
    console.log("\nBroken details:");
    for (const r of broken) {
      const reason =
        r.problem === "FETCH_FAILURE"
          ? `fetch failure: ${r.fetchError || `HTTP ${r.httpStatus}`}`
          : `parse failure: HTTP ${r.httpStatus} OK but 0 intervals parsed`;
      console.log(`  - ${r.makeKey}: ${reason}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Audit script failed:", err);
    process.exit(1);
  });
