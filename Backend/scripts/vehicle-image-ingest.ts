import { randomUUID } from "crypto";
import { dbInstances } from "@repo/db-customer";
import { storageService } from "../src/services/storage.service";
import { logger } from "../src/config/logger";

type VehicleType = "CAR" | "BIKE";

type Target = {
  vehicleType: VehicleType;
  make: string;
  model: string;
  variant: string | null;
};

function normalizeForMatch(s: string | null | undefined): string {
  return (s ?? "").toString().trim().replace(/\s+/g, " ");
}

function normalizeForKey(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function cleanMake(make: string): string {
  return make
    .replace(/\b(india|ltd|limited|pvt|private|vehicles|auto|motorcycle|scooter|and|&|\(p\)|\.)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanModel(model: string): string {
  return model
    .replace(/\b(bs\s*iv|bs\s*vi|bs4|bs6|vdi|vxi|zxi|dlx|std)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateQueries(target: Target): string[] {
  const mk = cleanMake(target.make);
  const md = cleanModel(target.model);
  const v = target.variant ? cleanModel(target.variant) : "";
  const typeHint = target.vehicleType === "BIKE" ? "motorcycle" : "car";

  const queries = [
    `${mk} ${md} ${v} ${typeHint} india`,
    `${mk} ${md} ${typeHint}`,
    `${md} ${typeHint} india`,
    `${mk} ${md}`,
    `${md}`,
  ]
    .map((q) => q.replace(/\s+/g, " ").trim())
    .filter((q) => q.length >= 3);

  return Array.from(new Set(queries));
}

function isLikelyDummyUnsplash(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.includes("images.unsplash.com/photo-");
}

async function withDbRetry<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; baseDelayMs?: number },
): Promise<T> {
  const retries = opts?.retries ?? 6;
  const baseDelayMs = opts?.baseDelayMs ?? 1500;

  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const code = err?.code ?? err?.meta?.code;
      const msg = String(err?.message ?? "");
      const shouldRetry =
        code === "P1001" ||
        /Can't reach database server|DatabaseNotReachable/i.test(msg);

      if (!shouldRetry) throw err;
      if (attempt === retries) break;

      const delay = baseDelayMs * Math.pow(2, attempt);
      logger.warn(
        { attempt: attempt + 1, retries, delayMs: delay, code },
        "DB not reachable; retrying",
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function isLikelyBadTitle(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.includes(".djvu") ||
    t.includes("book") ||
    t.includes("comic") ||
    t.includes("poster") ||
    t.includes("logo") ||
    t.includes("badge") ||
    t.includes("diagram") ||
    t.includes("map") ||
    t.includes("tornado")
  );
}

function titleMatchesQuery(title: string, query: string): boolean {
  const t = title.toLowerCase();
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((x) => x.length >= 3 && !["car", "bike", "india", "motorcycle", "front", "view", "exterior"].includes(x));
  if (tokens.length === 0) return true;
  return tokens.some((tok) => t.includes(tok));
}

async function wikimediaFindFileTitles(query: string): Promise<string[]> {
  const searchUrl =
    "https://commons.wikimedia.org/w/api.php" +
    `?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      query,
    )}&gsrlimit=20&format=json`;

  const res = await fetch(searchUrl);
  if (!res.ok) throw new Error(`Wikimedia search failed (${res.status})`);
  const json = await res.json();
  const pages = (json?.query?.pages ?? {}) as Record<string, any>;
  const titles = Object.values(pages)
    .map((p: any) => p?.title)
    .filter(Boolean);
  return titles.filter((tt: string) => !isLikelyBadTitle(tt) && titleMatchesQuery(tt, query));
}

async function wikimediaGetImageInfo(title: string): Promise<{
  imageUrl: string;
  mimeType?: string;
  licenseShort?: string;
}> {
  const url =
    "https://commons.wikimedia.org/w/api.php" +
    `?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1600&format=json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikimedia info failed (${res.status})`);
  const json = await res.json();
  const pages = (json?.query?.pages ?? {}) as Record<string, any>;
  const page = Object.values(pages)[0] as any;
  const info = page?.imageinfo?.[0] as any;

  const imageUrl: string | undefined = info?.url ?? info?.thumburl;
  const mimeType: string | undefined = info?.mime;
  const extmetadata = info?.extmetadata ?? {};
  const licenseShort: string | undefined =
    extmetadata?.LicenseShortName?.value ??
    extmetadata?.License?.value ??
    extmetadata?.LicenseName?.value;

  if (!imageUrl) throw new Error(`No imageUrl in Wikimedia info for ${title}`);

  return { imageUrl, mimeType, licenseShort };
}

function isAcceptableLicense(licenseShort?: string): boolean {
  if (!licenseShort) return true; // best-effort; some results don't return license metadata
  const l = licenseShort.toLowerCase();
  return (
    l.includes("creative commons") ||
    l.includes("cc by") ||
    l.includes("cc-by") ||
    l.includes("cc") ||
    l.includes("public domain") ||
    l.includes("pd")
  );
}

async function pickHeroFromWikimedia(queries: string[]): Promise<{
  imageUrl: string;
  mimeType?: string;
}> {
  for (const q of queries) {
    const variants = [q, `${q} exterior`, `${q} front view`];
    for (const v of variants) {
      const titles = await wikimediaFindFileTitles(v);
      for (const title of titles.slice(0, 6)) {
        const info = await wikimediaGetImageInfo(title);
        if (!isAcceptableLicense(info.licenseShort)) continue;
        const imageUrlLc = (info.imageUrl || "").toLowerCase();
        if (imageUrlLc.includes(".svg") || imageUrlLc.includes(".djvu")) continue;
        return { imageUrl: info.imageUrl, mimeType: info.mimeType };
      }
    }
  }
  throw new Error(`No suitable Wikimedia hero image found for queries: ${queries.join(" | ")}`);
}

async function ingestOneTarget(target: Target): Promise<string> {
  const queries = candidateQueries(target);
  logger.info({ target, queries }, "Ingesting hero image for target");

  const { imageUrl, mimeType } = await pickHeroFromWikimedia(queries);
  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`Failed downloading image (${resp.status})`);
  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ext = (() => {
    if (mimeType?.includes("png")) return "png";
    if (mimeType?.includes("webp")) return "webp";
    return "jpg";
  })();

  const safeMake = normalizeForKey(target.make);
  const safeModel = normalizeForKey(target.model);
  const safeVariant = target.variant ? normalizeForKey(target.variant) : "default";

  const folder = `vehicle-catalog/${target.vehicleType.toLowerCase()}/hero/${safeMake}/${safeModel}/${safeVariant}`;
  const originalname = `${safeMake}-${safeModel}-${safeVariant}.${ext}`;

  const fauxFile = {
    buffer,
    originalname,
    mimetype: mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`,
  } as any;

  const uploaded = await storageService.uploadFile(fauxFile, folder);
  return uploaded.url;
}

function readTargetsFromCsv(csvText: string): Target[] {
  const lines = csvText
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  const targets: Target[] = [];
  for (const line of lines) {
    // Format: CAR,make,model,variant(optional),year(optional)
    const parts = line.split(",").map((p) => p.trim());
    const vehicleType = parts[0] as VehicleType;
    const make = parts[1] ?? "";
    const model = parts[2] ?? "";
    const variant = parts[3] ?? "";

    if (!vehicleType || (vehicleType !== "CAR" && vehicleType !== "BIKE")) continue;
    if (!make || !model) continue;

    const v = variant && variant.length > 0 ? variant : null;
    targets.push({ vehicleType, make, model, variant: v });
  }
  return targets;
}

async function loadTargetsFromFile(path?: string): Promise<Target[] | null> {
  if (!path) return null;
  const fs = await import("fs/promises");
  const csvText = await fs.readFile(path, "utf-8");
  return readTargetsFromCsv(csvText);
}

async function updateVehiclesForTarget(
  target: Target,
  imageUrl: string,
  opts?: { force?: boolean },
): Promise<number> {
  const force = opts?.force ?? false;

  const makeNeedle = cleanMake(target.make);
  const modelNeedle = cleanModel(target.model);
  const variantNeedle = target.variant ? cleanModel(target.variant) : null;

  const where: any = {
    isActive: true,
    vehicleType: target.vehicleType,
    ...(makeNeedle ? { make: { contains: makeNeedle, mode: "insensitive" } } : {}),
    ...(modelNeedle ? { model: { contains: modelNeedle, mode: "insensitive" } } : {}),
    ...(variantNeedle
      ? { variant: { contains: variantNeedle, mode: "insensitive" } }
      : {}),
  };

  if (!force) {
    where.OR = [
      { imageUrl: null },
      {
        imageUrl: {
          contains: "images.unsplash.com/photo-",
          mode: "insensitive",
        },
      },
    ];
  }

  const res = await dbInstances.customerVehicle.updateMany({
    where,
    data: { imageUrl },
  });

  return res.count;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");

  const targetsIdx = args.findIndex((a) => a === "--targetsFile");
  const targetsFile = targetsIdx >= 0 ? args[targetsIdx + 1] : undefined;

  const fileTargets = await loadTargetsFromFile(targetsFile);
  const targets: Target[] =
    fileTargets && fileTargets.length > 0 ? fileTargets : [];

  const targetsMode = targets.length > 0 ? "LIST" : "DB_DUMMY_REUSE";

  if (targetsMode === "LIST") {
    logger.info({ targetsCount: targets.length, targetsFile, force }, "Starting vehicle image ingest (explicit list)");
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      try {
        // Avoid ingestion when nothing in DB needs update for this target.
        const makeNeedle = cleanMake(t.make);
        const modelNeedle = cleanModel(t.model);
        const variantNeedle = t.variant ? cleanModel(t.variant) : null;

        const where: any = {
          isActive: true,
          vehicleType: t.vehicleType,
          ...(makeNeedle ? { make: { contains: makeNeedle, mode: "insensitive" } } : {}),
          ...(modelNeedle ? { model: { contains: modelNeedle, mode: "insensitive" } } : {}),
          ...(variantNeedle ? { variant: { contains: variantNeedle, mode: "insensitive" } } : {}),
          ...(force
            ? {}
            : {
                OR: [
                  { imageUrl: null },
                  {
                    imageUrl: {
                      contains: "images.unsplash.com/photo-",
                      mode: "insensitive",
                    },
                  },
                ],
              }),
        };

        const countToUpdate = await withDbRetry(() =>
          dbInstances.customerVehicle.count({ where }),
        );
        if (countToUpdate === 0) {
          logger.info({ i, total: targets.length, target: t }, "Skip: no dummy vehicles to update");
          continue;
        }

        const url = await ingestOneTarget(t);
        const updatedCount = await withDbRetry(() =>
          updateVehiclesForTarget(t, url, { force }),
        );
        logger.info(
          { i, total: targets.length, target: t, url, updatedCount },
          "Vehicle image ingested + DB updated",
        );
      } catch (err: any) {
        logger.error({ err, target: t, index: i }, "Failed to ingest target");
      }

      await new Promise((r) => setTimeout(r, 1200));
    }
    return;
  }

  // Legacy behavior: DB-based grouping of dummy-image vehicles.
  const vehicles = await dbInstances.customerVehicle.findMany({
    where: {
      isActive: true,
      vehicleType: { in: ["CAR", "BIKE"] },
      make: { not: null },
      model: { not: null },
    },
    select: {
      vehicleType: true,
      make: true,
      model: true,
      variant: true,
      imageUrl: true,
    },
  });

  const groups = new Map<
    string,
    { target: Target; count: number; needsUpdate: boolean }
  >();

  for (const v of vehicles) {
    const vehicleType = (v.vehicleType as VehicleType) ?? "CAR";
    const make = v.make ?? "";
    const model = v.model ?? "";
    if (!make || !model) continue;

    const variant = v.variant ?? null;
    const key = `${vehicleType}|${make.toLowerCase()}|${model.toLowerCase()}|${(variant ?? "").toLowerCase()}`;

    const existing = groups.get(key);
    const needsUpdate = isLikelyDummyUnsplash(v.imageUrl);

    if (!existing) {
      groups.set(key, {
        target: {
          vehicleType,
          make: normalizeForMatch(make),
          model: normalizeForMatch(model),
          variant: variant ? normalizeForMatch(variant) : null,
        },
        count: 1,
        needsUpdate,
      });
    } else {
      existing.count += 1;
      existing.needsUpdate = existing.needsUpdate || needsUpdate;
    }
  }

  const all = Array.from(groups.values());

  const cars = all
    .filter((g) => g.target.vehicleType === "CAR" && g.needsUpdate)
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
  const bikes = all
    .filter((g) => g.target.vehicleType === "BIKE" && g.needsUpdate)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  const targets2: Target[] = [...cars.map((c) => c.target), ...bikes.map((b) => b.target)];

  logger.info(
    { targetsCount: targets2.length, cars: cars.length, bikes: bikes.length },
    "Vehicle image ingest targets built",
  );

  for (let i = 0; i < targets2.length; i++) {
    const t = targets2[i];
    try {
      const url = await ingestOneTarget(t);
      logger.info({ i, total: targets2.length, target: t, url }, "Vehicle image ingested");

      await updateVehiclesForTarget(t, url, { force });
    } catch (err: any) {
      logger.error({ err, target: t, index: i }, "Failed to ingest target");
    }

    await new Promise((r) => setTimeout(r, 1200));
  }
}

main()
  .then(async () => {
    await dbInstances.$disconnect();
    logger.info("Vehicle image ingest finished");
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, "Vehicle image ingest crashed");
    await dbInstances.$disconnect();
    process.exit(1);
  });

