import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../config/logger";
import { dbInstances } from "@repo/db-customer";
import { saveSuggestedIntervals } from "./oem-interval.service";
import type { SuggestedInterval } from "./oem-interval.service";

const db = dbInstances as any;

/** Skip re-fetch for same make (and optional model) within this window. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map<string, number>();

/** Max fetch attempts with exponential backoff (base delay ms). */
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1500;

/** OEM page config: normalized make key -> URL and type. */
const OEM_URL_CONFIG: { makeKey: string; url: string; type: "html" | "pdf" }[] = [
  {
    makeKey: "hyundai",
    url: "https://www.hyundai.com/in/en/connect-to-service/hyundai-service/pms-charts.html",
    type: "html",
  },
  {
    makeKey: "mahindra",
    url: "https://www.withyouhamesha.com/care-maintenance.aspx",
    type: "html",
  },
  {
    makeKey: "honda",
    url: "https://www.hondacarindia.com/honda-services/periodic-maintenance-schedule",
    type: "html",
  },
  {
    makeKey: "toyota",
    url: "https://www.toyotabharat.com/toyota-connect/book-your-service/maintenance-schedule/",
    type: "html",
  },
  {
    makeKey: "hero",
    url: "https://www.heromotocorp.com/en-in/services/service-maintenance-schedule.html",
    type: "html",
  },
  {
    makeKey: "bajaj",
    url: "https://www.bajajauto.com/service/periodic-maintenance",
    type: "html",
  },
  {
    makeKey: "maruti",
    url: "https://marutistoragenew.blob.core.windows.net/msilintiwebpdf/Alto_OM_Website.pdf",
    type: "pdf",
  },
  {
    makeKey: "tata",
    url: "https://tmlcars.tatamotors.com/images/service/owners/owners-manual/pdf/nexon/Nexon_EV.pdf",
    type: "pdf",
  },
  {
    makeKey: "tvs",
    url: "https://www.tvsmotor.com/our-service/user-manual",
    type: "html",
  },
  {
    makeKey: "royalenfield",
    url: "https://www.royalenfield.com/in/en/support/owners-manual/",
    type: "html",
  },
  {
    makeKey: "suzuki",
    url: "https://www.suzukimotorcycle.co.in/service-schedule",
    type: "html",
  },
  {
    makeKey: "ktm",
    url: "https://www.ktmindia.com/service-maintenance",
    type: "html",
  },
];

function normalizeMake(make: string): string {
  return (make || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Parse "10K Km/1Yr" or "30K Km/3Yr" or "60K Km" -> { km, months }. */
function parseIntervalText(text: string): { km: number; months: number } | null {
  if (!text || typeof text !== "string") return null;
  const t = text.replace(/,/g, "").trim();
  let km = 0;
  let months = 0;
  const kmMatch = t.match(/(\d+)\s*K\s*Km/i) || t.match(/(\d+)\s*,?\s*000\s*Km/i);
  if (kmMatch) km = parseInt(kmMatch[1], 10) * (t.includes("000") && !t.includes("K Km") ? 1 : 1000);
  const yrMatch = t.match(/(\d+)\s*Yr/i);
  if (yrMatch) months = parseInt(yrMatch[1], 10) * 12;
  if (km === 0 && months === 0) return null;
  if (km === 0 && months > 0) km = 50000; // fallback
  if (months === 0 && km > 0) months = 12;
  return { km, months };
}

/** Map Hyundai PMS column header to our part type(s). Returns array so one column can map to two parts (e.g. Engine Oil & Filter). */
function columnToPartTypes(header: string): string[] {
  const h = header.toLowerCase();
  if (h.includes("engine oil") && h.includes("filter")) return ["ENGINE_OIL", "OIL_FILTER"];
  if (h.includes("air filter")) return ["AIR_FILTER"];
  if (h.includes("fuel filter")) return ["OTHER_PART"];
  if (h.includes("ac filter")) return ["AC_FILTER"];
  if (h.includes("coolant")) return ["COOLANT"];
  if (h.includes("spark plug")) return ["SPARK_PLUGS"];
  if (h.includes("brake oil")) return ["OTHER_PART"];
  return [];
}

/** Parse Hyundai PMS HTML page and return intervals. Optionally filter by model (e.g. "i20", "Creta"). */
/** Parse generic OEM HTML page and return intervals. Optionally filter by model hint. */
function parseOemHtml(html: string, modelHint?: string): SuggestedInterval[] {
  const intervals: SuggestedInterval[] = [];
  const seen = new Set<string>();

  const $ = cheerio.load(html);
  $("table").each((_, table) => {
    const $table = $(table);
    const $allTr = $table.find("tr");
    if ($allTr.length < 2) return;

    // Try to find header row (contains 'km' or 'mileage' or 'period')
    let headerRowIndex = 0;
    const headers: { text: string; index: number }[] = [];
    
    $allTr.each((i, row) => {
      const $cells = $(row).find("th, td");
      let isHeader = false;
      $cells.each((___, cell) => {
        const text = $(cell).text().toLowerCase();
        if (text.includes("km") || text.includes("month") || text.includes("year") || text.includes("interval")) {
          isHeader = true;
        }
      });
      if (isHeader) {
        headerRowIndex = i;
        $cells.each((j, cell) => {
          const text = $(cell).text().trim();
          if (text) headers.push({ text, index: j });
        });
        return false; // stop looking for header
      }
    });

    if (headers.length === 0) return;

    const dataRows = $allTr.slice(headerRowIndex + 1).get();
    for (const tr of dataRows) {
      const cells: string[] = [];
      $(tr).find("td, th").each((__, td) => { cells.push($(td).text().trim()); });
      if (cells.length < 2) continue;

      const firstCell = cells[0] || "";
      // If we have a modelHint, only consider rows that mention it
      if (modelHint && !firstCell.toLowerCase().includes(modelHint.toLowerCase())) {
        continue;
      }

      headers.forEach(({ text, index }) => {
        const cellText = cells[index] || "";
        const parsed = parseIntervalText(cellText);
        if (!parsed) return;
        
        const partTypes = columnToPartTypes(text || firstCell); // Check header or first cell for part name
        partTypes.forEach((partType) => {
          const key = `${partType}-${parsed.km}-${parsed.months}`;
          if (seen.has(key)) return;
          seen.add(key);
          intervals.push({
            partType,
            intervalKm: parsed.km,
            intervalMonths: parsed.months,
            source: "OEM_WEBSITE",
          });
        });
      });
    }
  });

  return intervals;
}

import { suggestIntervalsFromAI } from "./oem-interval.service";

/**
 * Fetch OEM intervals from the internet for the given vehicle (make/model/year)
 * and save to PartReplacementInterval with source OEM_WEBSITE.
 * Called when customer adds a vehicle so the app has real intervals for "when to change" by odometer.
 */
export async function fetchAndSaveIntervalsForVehicle(
  vehicleId: string,
): Promise<{ saved: number; source: string; errors?: string[] }> {
  const vehicle = await db.customerVehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, make: true, model: true, manufacturingMonthYear: true },
  });

  if (!vehicle) {
    logger.warn({ vehicleId }, "Vehicle not found for OEM interval fetch");
    return { saved: 0, source: "NONE" };
  }

  const make = (vehicle.make ?? "").trim() || "";
  const model = (vehicle.model ?? "").trim() || "";

  // Extract year from manufacturingMonthYear (format: "MM/YYYY")
  let year: number | null = null;
  if (vehicle?.manufacturingMonthYear) {
    const parts = vehicle.manufacturingMonthYear.split("/");
    const yearStr = parts.length > 1 ? parts[1] : parts[0];
    const parsedYear = parseInt(yearStr);
    if (!isNaN(parsedYear)) year = parsedYear;
  }
  const makeKey = normalizeMake(make);

  if (!make) {
    logger.debug({ vehicleId }, "Vehicle has no make, skip OEM fetch");
    return { saved: 0, source: "NONE" };
  }

  const config = OEM_URL_CONFIG.find((c) => makeKey.includes(c.makeKey));

  // Helper for falling back to AI suggest
  const fallbackToAI = async (reason: string) => {
    logger.info({ vehicleId, make, model, reason }, "Falling back to AI for vehicle intervals");
    const intervals = await suggestIntervalsFromAI(make, model, year);
    if (intervals.length === 0) return { saved: 0, source: "NONE" };
    const { saved, errors } = await saveSuggestedIntervals(make, model, year, intervals);
    return { saved, source: "AI_SUGGESTED", errors: errors.length ? errors : undefined };
  };

  if (!config) {
    logger.info({ makeKey, vehicleId }, "No OEM URL config for make, use AI suggest");
    return fallbackToAI("NO_URL_CONFIG");
  }

  const cacheKey = `${makeKey}:${(model || "").toLowerCase()}`;
  const lastFetch = cache.get(cacheKey);
  if (lastFetch != null && Date.now() - lastFetch < CACHE_TTL_MS) {
    logger.debug({ cacheKey, vehicleId }, "OEM interval fetch skipped (memory cache)");
    return { saved: 0, source: "CACHE" };
  }

  // Check DB before external fetch to reuse across vehicles
  const existingInDb = await db.partReplacementInterval.findFirst({
    where: {
      make: { equals: make, mode: "insensitive" },
      model: model ? { equals: model, mode: "insensitive" } : undefined,
    },
  });

  if (existingInDb) {
    logger.info({ make, model, vehicleId }, "OEM intervals already exist in DB, reusing");
    cache.set(cacheKey, Date.now());
    return { saved: 0, source: "DB" };
  }

  const fetchWithRetries = async <T>(
    fn: () => Promise<T>,
    label: string,
  ): Promise<T> => {
    let lastErr: any;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_MS * Math.pow(2, attempt);
          logger.debug({ attempt: attempt + 1, delay, label }, "OEM fetch retry");
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastErr;
  };

  try {
    if (config.type === "html") {
      const res = await fetchWithRetries(
        () =>
          axios.get(config.url, {
            timeout: 15000,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; GupioApp/1.0; +https://gupio.com)",
            },
            maxRedirects: 3,
          }),
        "HTML",
      );
      const html = res.data as string;
      const intervals = parseOemHtml(html, model || undefined);
      if (intervals.length === 0) {
        logger.debug({ vehicleId, makeKey }, "No intervals parsed from OEM HTML, fallback to AI");
        return fallbackToAI("HTML_PARSE_EMPTY");
      }
      const saveMake = make || "Hyundai";
      const saveModel = model || "All";
      const { saved, errors } = await saveSuggestedIntervals(
        saveMake,
        saveModel,
        year,
        intervals,
      );
      cache.set(cacheKey, Date.now());
      logger.info(
        { vehicleId, make: saveMake, model: saveModel, saved },
        "OEM intervals fetched and saved from website",
      );
      return { saved, source: "OEM_WEBSITE", errors: errors.length ? errors : undefined };
    }

    if (config.type === "pdf") {
      const urlObj = new URL(config.url);
      const origin = `${urlObj.protocol}//${urlObj.host}`;
      const res = await fetchWithRetries(
        () =>
          axios.get(config.url, {
            responseType: "arraybuffer",
            timeout: 30000,
            maxRedirects: 5,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "application/pdf,*/*",
              Referer: origin + "/",
            },
          }),
        "PDF",
      );
      const pdfBuffer = Buffer.from(res.data);
      const intervals = await parsePdfIntervals(pdfBuffer);
      if (intervals.length === 0) {
        logger.debug({ vehicleId, makeKey }, "No intervals parsed from OEM PDF, fallback to AI");
        return fallbackToAI("PDF_PARSE_EMPTY");
      }
      const saveMake = make || "Unknown";
      const saveModel = model || "All";
      const { saved, errors } = await saveSuggestedIntervals(
        saveMake,
        saveModel,
        year,
        intervals,
      );
      cache.set(cacheKey, Date.now());
      logger.info(
        { vehicleId, make: saveMake, model: saveModel, saved },
        "OEM intervals fetched and saved from PDF",
      );
      return { saved, source: "OEM_WEBSITE", errors: errors.length ? errors : undefined };
    }
  } catch (err: any) {
    logger.error(
      { err: err?.message || err, vehicleId, makeKey, url: config?.url },
      "OEM interval fetch failed, trying AI fallback",
    );
    return fallbackToAI(`FETCH_FAILED:${err?.message || "unknown"}`);
  }

  return { saved: 0, source: "NONE" };
}

/** Parse PDF buffer: extract text and use Gemini to get intervals. */
async function parsePdfIntervals(pdfBuffer: Buffer): Promise<SuggestedInterval[]> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(pdfBuffer);
    const text = (data?.text || "").slice(0, 12000);
    if (!text) return [];

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const { env } = await import("../config/env");
    if (!env.GEMINI_API_KEY) return [];
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `
From this vehicle manual / service schedule text, extract maintenance intervals.
Return a JSON array. Each object: { "partType": "ENGINE_OIL" | "OIL_FILTER" | "AIR_FILTER" | "BRAKE_PADS" | "BRAKE_DISCS" | "BATTERY" | "TYRES_FRONT" | "TYRES_REAR" | "CLUTCH_PLATE" | "SPARK_PLUGS" | "COOLANT" | "TIMING_BELT" | "AC_FILTER" | "WIPER_BLADES" | "HEADLIGHT_BULB" | "OTHER_PART", "intervalKm": number, "intervalMonths": number }.
Use partType only from the list. intervalKm in km (e.g. 10000), intervalMonths in months (e.g. 6 or 12).
Return ONLY the JSON array, no markdown.

Text:
${text}
`;
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonStr = responseText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonStr) as SuggestedInterval[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p) =>
          p.partType &&
          typeof p.intervalKm === "number" &&
          typeof p.intervalMonths === "number",
      )
      .map((p) => ({ ...p, source: "OEM_WEBSITE" }));
  } catch (e) {
    logger.warn({ err: e }, "PDF interval parse failed");
    return [];
  }
}
