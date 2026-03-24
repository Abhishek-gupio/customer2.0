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
    makeKey: "maruti",
    url: "https://marutistoragenew.blob.core.windows.net/msilintiwebpdf/Alto_OM_Website.pdf",
    type: "pdf",
  },
  {
    makeKey: "tata",
    url: "https://tmlcars.tatamotors.com/images/service/owners/owners-manual/pdf/nexon/Nexon_EV.pdf",
    type: "pdf",
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
function parseHyundaiPmsHtml(html: string, modelHint?: string): SuggestedInterval[] {
  const intervals: SuggestedInterval[] = [];
  const seen = new Set<string>();

  const $ = cheerio.load(html);
  $("table").each((_, table) => {
    const $table = $(table);
    const $allTr = $table.find("tr");
    if ($allTr.length < 2) return;

    const $headerRow = $allTr.first();
    const headers: { text: string; index: number }[] = [];
    $headerRow.find("th, td").each((i, el) => {
      const text = $(el).text().trim();
      if (text && !/^models?$/i.test(text)) headers.push({ text, index: i });
    });

    if (headers.length === 0) return;

    let bestRow: { cells: string[] } | null = null;
    const dataRows = $allTr.slice(1).get();
    for (let i = 0; i < dataRows.length; i++) {
      const tr = dataRows[i];
      const cells: string[] = [];
      $(tr).find("td, th").each((__, td) => { cells.push($(td).text().trim()); });
      if (cells.length < 2) continue;
      const modelCell = cells[0] || "";
      if (modelHint && modelCell.toLowerCase().includes(modelHint.toLowerCase())) {
        bestRow = { cells };
        break;
      }
      if (!bestRow) bestRow = { cells };
    }

    if (!bestRow) return;

    headers.forEach(({ text, index }) => {
      const cellText = bestRow!.cells[index] || "";
      const parsed = parseIntervalText(cellText);
      if (!parsed) return;
      const partTypes = columnToPartTypes(text);
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
  });

  return intervals;
}

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
    select: { make: true, model: true, manufacturingMonthYear: true },
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
      const parts = vehicle.manufacturingMonthYear.split('/');
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
  if (!config) {
    logger.debug({ makeKey, vehicleId }, "No OEM URL config for make, skip fetch");
    return { saved: 0, source: "NONE" };
  }

  const cacheKey = `${makeKey}:${(model || "").toLowerCase()}`;
  const lastFetch = cache.get(cacheKey);
  if (lastFetch != null && Date.now() - lastFetch < CACHE_TTL_MS) {
    logger.debug({ cacheKey, vehicleId }, "OEM interval fetch skipped (cache)");
    return { saved: 0, source: "CACHE" };
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
      const intervals = parseHyundaiPmsHtml(html, model || undefined);
      if (intervals.length === 0) {
        logger.debug({ vehicleId, makeKey }, "No intervals parsed from OEM HTML");
        return { saved: 0, source: "OEM_WEBSITE" };
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
            timeout: 25000,
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
        logger.debug({ vehicleId, makeKey }, "No intervals parsed from OEM PDF");
        return { saved: 0, source: "OEM_WEBSITE" };
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
      "OEM interval fetch failed",
    );
    return { saved: 0, source: "OEM_WEBSITE", errors: [err?.message || "Fetch failed"] };
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
Return a JSON array. Each object: { "partType": "ENGINE_OIL" | "OIL_FILTER" | "AIR_FILTER" | "BRAKE_PADS" | "COOLANT" | "SPARK_PLUGS" | "AC_FILTER" | "OTHER_PART", "intervalKm": number, "intervalMonths": number }.
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
