import { createHash } from "crypto";
import { dbInstances } from "@repo/db-customer";
import { storageService } from "../src/services/storage.service";
import { logger } from "../src/config/logger";

type VehicleType = "CAR" | "BIKE";

type Target = {
  vehicleType: VehicleType;
  make: string;
  model: string;
  variant: string | null;
  year?: number | null;
};

type HeroCandidate = {
  imageUrl: string;
  mimeType?: string;
  source: string;
  sourceRef?: string;
};

const ANGLES_COUNT = 12;
let wikimediaCooldownUntilMs = 0;
const WIKIMEDIA_COOLDOWN_MS = 60000;

function normalizeForMatch(s: string | null | undefined): string {
  return (s ?? "").toString().trim().replace(/\s+/g, " ");
}

function normalizeForKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cleanMake(make: string): string {
  return make
    .replace(
      /\b(india|ltd|limited|pvt|private|vehicles|auto|motorcycle|scooter|and|&|\(p\)|\.)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanModel(model: string): string {
  return model
    .replace(
      /\b(bs\s*iv|bs\s*vi|bs4|bs6|vdi|vxi|zxi|dlx|std)\b/gi,
      " ",
    )
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
    `${mk} ${md} ${typeHint} india`,
    `${mk} ${md} ${v}`,
    `${mk} ${md} ${typeHint}`,
    `${md} ${typeHint} india`,
    `${mk} ${md}`,
  ]
    .map((q) => q.replace(/\s+/g, " ").trim())
    .filter((q) => q.length >= 3);

  return Array.from(new Set(queries));
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

function isLikelyLowQualityTitle(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.includes(".djvu") ||
    t.includes(".svg") ||
    t.includes("logo") ||
    t.includes("poster") ||
    t.includes("book") ||
    t.includes("comic") ||
    t.includes("diagram") ||
    t.includes("map") ||
    t.includes("crash") ||
    t.includes("accident") ||
    t.includes("wreck") ||
    t.includes("traffic") ||
    t.includes("police") ||
    t.includes("street scene") ||
    t.includes("parking lot")
  );
}

function candidateScore(args: {
  title: string;
  query: string;
  target: Target;
  mimeType?: string;
}): number {
  const { title, query, target, mimeType } = args;
  const t = title.toLowerCase();
  const q = query.toLowerCase();
  const mk = cleanMake(target.make).toLowerCase();
  const md = cleanModel(target.model).toLowerCase();

  let score = 0;
  if (t.includes(mk)) score += 4;
  if (t.includes(md)) score += 5;
  if (q.includes("front view") && t.includes("front")) score += 2;
  if (q.includes("exterior") && t.includes("exterior")) score += 2;
  if (q.includes("studio") && t.includes("studio")) score += 2;
  if (t.includes("press") || t.includes("official")) score += 2;
  if (mimeType?.includes("jpeg") || mimeType?.includes("jpg")) score += 1;
  if (mimeType?.includes("png")) score += 1;
  if (t.length > 120) score -= 1;
  if (isLikelyLowQualityTitle(title)) score -= 10;
  return score;
}

async function fetchJsonWithRetry(
  url: string,
  opts?: { retries?: number; baseDelayMs?: number; maxDelayMs?: number },
): Promise<any> {
  const retries = opts?.retries ?? 6;
  const baseDelayMs = opts?.baseDelayMs ?? 1200;
  const maxDelayMs = opts?.maxDelayMs ?? 60000;

  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();

      const isRateLimited = res.status === 429;
      const isServerError = res.status >= 500 && res.status <= 599;

      if ((isRateLimited || isServerError) && attempt < retries) {
        const retryAfter = res.headers.get("retry-after");
        const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
        const delayMs = Math.min(
          Number.isFinite(retryAfterMs) ? retryAfterMs : baseDelayMs * Math.pow(2, attempt),
          maxDelayMs,
        );

        logger.warn(
          { attempt: attempt + 1, retries, delayMs, status: res.status },
          "Wikimedia API rate-limited / server error; retrying",
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      throw new Error(`Request failed (${res.status}) for url: ${url}`);
    } catch (err: any) {
      lastErr = err;
      if (attempt === retries) throw lastErr;
      const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw lastErr;
}

async function wikimediaFindFileTitles(
  query: string,
  limit: number,
  retryOpts?: { retries?: number; baseDelayMs?: number; maxDelayMs?: number },
): Promise<string[]> {
  const searchUrl =
    "https://commons.wikimedia.org/w/api.php" +
    `?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      query,
    )}&gsrlimit=${encodeURIComponent(String(limit))}&format=json`;

  const json = await fetchJsonWithRetry(searchUrl, retryOpts);
  const pages = (json?.query?.pages ?? {}) as Record<string, any>;
  const titles = Object.values(pages)
    .map((p: any) => p?.title)
    .filter(Boolean);
  return titles;
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

  const json = await fetchJsonWithRetry(url, {
    retries: 1,
    baseDelayMs: 1500,
    maxDelayMs: 5000,
  });
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

  if (!imageUrl)
    throw new Error(`No imageUrl in Wikimedia info for title: ${title}`);

  return { imageUrl, mimeType, licenseShort };
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function downloadImageBuffer(
  imageUrl: string,
  opts?: { retries?: number; baseDelayMs?: number; maxDelayMs?: number },
): Promise<{
  buffer: Buffer;
  mimeType?: string;
}> {
  const retries = opts?.retries ?? 5;
  const baseDelayMs = opts?.baseDelayMs ?? 1200;
  const maxDelayMs = opts?.maxDelayMs ?? 20000;

  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(imageUrl);
      if (!resp.ok) {
        const isRateLimited = resp.status === 429;
        const isServerError = resp.status >= 500 && resp.status <= 599;

        if ((isRateLimited || isServerError) && attempt < retries) {
          const retryAfter = resp.headers.get("retry-after");
          const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
          const delayMs = Math.min(
            Number.isFinite(retryAfterMs) ? retryAfterMs : baseDelayMs * Math.pow(2, attempt),
            maxDelayMs,
          );

          logger.warn(
            { attempt: attempt + 1, retries, delayMs, status: resp.status },
            "Download rate-limited / server error; retrying",
          );
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        throw new Error(
          `Failed downloading image (${resp.status}) for: ${imageUrl}`,
        );
      }

      const arrayBuffer = await resp.arrayBuffer();
      return { buffer: Buffer.from(arrayBuffer) };
    } catch (err: any) {
      lastErr = err;
      if (attempt === retries) throw lastErr;
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw lastErr;
}

async function pickHeroFromWikimedia(
  target: Target,
  queries: string[],
): Promise<HeroCandidate> {
  let best:
    | { score: number; imageUrl: string; mimeType?: string; title: string; query: string }
    | null = null;

  for (const q of queries) {
    const variants = [q, `${q} exterior`, `${q} front view`, `${q} studio`];
    for (const v of variants) {
      const titles = await wikimediaFindFileTitles(v, 6, {
        retries: 1,
        baseDelayMs: 1500,
        maxDelayMs: 5000,
      });
      for (const t of titles.slice(0, 4)) {
        if (isLikelyLowQualityTitle(t)) continue;
        const info = await wikimediaGetImageInfo(t);
        if (!isAcceptableLicense(info.licenseShort)) continue;
        const score = candidateScore({
          title: t,
          query: v,
          target,
          mimeType: info.mimeType,
        });
        if (!best || score > best.score) {
          best = {
            score,
            imageUrl: info.imageUrl,
            mimeType: info.mimeType,
            title: t,
            query: v,
          };
        }
      }
    }
  }
  if (!best) {
    throw new Error(`No suitable Wikimedia hero image found for queries: ${queries.join(" | ")}`);
  }
  logger.info(
    { target, pickedTitle: best.title, pickedQuery: best.query, score: best.score },
    "Picked best hero candidate",
  );
  return {
    imageUrl: best.imageUrl,
    mimeType: best.mimeType,
    source: "Wikimedia Commons",
    sourceRef: best.title,
  };
}

async function pickHeroCandidate(
  target: Target,
  queries: string[],
): Promise<HeroCandidate> {
  // Wikimedia-only hero source.

  const now = Date.now();
  if (wikimediaCooldownUntilMs > now) {
    const waitMs = wikimediaCooldownUntilMs - now;
    logger.warn(
      { target, waitMs },
      "Wikimedia is cooling down after throttling; waiting before next hero lookup",
    );
    await new Promise((r) => setTimeout(r, waitMs));
  }

  try {
    return await pickHeroFromWikimedia(target, queries);
  } catch (e) {
    const msg = String((e as any)?.message ?? "");
    if (msg.includes("(429)") || /5\d\d/.test(msg)) {
      wikimediaCooldownUntilMs = Date.now() + WIKIMEDIA_COOLDOWN_MS;
      logger.warn(
        { target, cooldownMs: WIKIMEDIA_COOLDOWN_MS },
        "Wikimedia throttled; applying cooldown before next target",
      );
    }
    logger.warn(
      { err: e, target },
      "Wikimedia hero failed quickly; no more fallbacks configured",
    );
  }
  throw new Error("No hero candidate found from Wikimedia");
}

const ANGLE_DESCRIPTORS: string[] = [
  "front view",
  "rear view",
  "left side",
  "right side",
  "front 3/4 view",
  "rear 3/4 view",
  "side view",
  "studio",
  "exterior",
  "top view",
  "wheel closeup",
  "three quarter front",
];

async function pickAngleFromWikimedia(args: {
  target: Target;
  angleIndex: number;
  selectedImageUrls: Set<string>;
}): Promise<{ imageUrl: string; mimeType?: string }> {
  const { target, angleIndex, selectedImageUrls } = args;
  const descriptor = ANGLE_DESCRIPTORS[angleIndex] ?? "front view";

  const mk = cleanMake(target.make);
  const md = cleanModel(target.model);
  const v = target.variant ? cleanModel(target.variant) : "";
  const typeHint = target.vehicleType === "BIKE" ? "motorcycle" : "car";
  const base = `${mk} ${md} ${v} ${typeHint}`.replace(/\s+/g, " ").trim();

  // Try a few query formats to improve match rate.
  const queries = [
    `${base} ${descriptor} india`,
    `${base} ${descriptor}`,
    `${mk} ${md} ${descriptor} ${typeHint}`,
    `${md} ${descriptor} ${typeHint}`,
  ].map((q) => q.replace(/\s+/g, " ").trim());

  for (const q of queries) {
    const titles = await wikimediaFindFileTitles(q, 6);
    for (const title of titles.slice(0, 4)) {
      const info = await wikimediaGetImageInfo(title);
      if (!isAcceptableLicense(info.licenseShort)) continue;
      if (selectedImageUrls.has(info.imageUrl)) continue;
      return { imageUrl: info.imageUrl, mimeType: info.mimeType };
    }
  }

  throw new Error(`No suitable Wikimedia angle image found (index=${angleIndex}) for target`);
}

async function uploadVehicleAssetToS3(args: {
  buffer: Buffer;
  mimeType?: string;
  assetType: "HERO" | "ANGLE";
  assetIndex: number;
  target: Target;
  assetHash: string;
}): Promise<{ url: string; s3Key?: string }> {
  const { buffer, mimeType, assetType, assetIndex, target, assetHash } = args;

  const safeMake = normalizeForKey(cleanMake(target.make));
  const safeModel = normalizeForKey(cleanModel(target.model));
  const safeVariant = target.variant ? normalizeForKey(cleanModel(target.variant)) : "default";

  const folder = `vehicle-catalog/${target.vehicleType.toLowerCase()}/assets/${safeMake}/${safeModel}/${safeVariant}/${assetType.toLowerCase()}/${assetIndex}`;

  // storageService adds Date.now(), but we still want predictable content + folder.
  const ext = (() => {
    if (mimeType?.includes("png")) return "png";
    if (mimeType?.includes("webp")) return "webp";
    return "jpg";
  })();

  const fauxFile = {
    buffer,
    originalname: `${assetType}-${assetIndex}-${assetHash}.${ext}`,
    mimetype: mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`,
  } as any;

  const uploaded = await storageService.uploadFile(fauxFile, folder);
  return { url: uploaded.url, s3Key: uploaded.key };
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
        code === "P1001" || /Can't reach database server|DatabaseNotReachable/i.test(msg);
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

function makeCatalogNormalizedKey(target: Target): string {
  const mk = normalizeForKey(cleanMake(target.make));
  const md = normalizeForKey(cleanModel(target.model));
  const v = target.variant ? normalizeForKey(cleanModel(target.variant)) : "";
  return `${target.vehicleType}|${mk}|${md}|${v}`;
}

async function ensureVehicleCatalog(target: Target) {
  const normalizedKey = makeCatalogNormalizedKey(target);

  // Use upsert to keep the catalog stable across reruns.
  return withDbRetry(() =>
    dbInstances.vehicleCatalog.upsert({
      where: { normalizedKey },
      create: {
        vehicleType: target.vehicleType,
        make: normalizeForMatch(target.make),
        model: normalizeForMatch(target.model),
        variant: target.variant ? normalizeForMatch(target.variant) : null,
        normalizedKey,
      },
      update: {
        make: normalizeForMatch(target.make),
        model: normalizeForMatch(target.model),
        variant: target.variant ? normalizeForMatch(target.variant) : null,
      },
    }),
  );
}

async function ensureCatalogAssetsForTarget(
  target: Target,
  opts?: { heroOnly?: boolean; forceHero?: boolean },
): Promise<string> {
  const heroOnly = opts?.heroOnly ?? false;
  const forceHero = opts?.forceHero ?? false;
  const catalog = await ensureVehicleCatalog(target);

  const existingAssets = await withDbRetry(() =>
    dbInstances.vehicleAsset.findMany({
      where: { catalogId: catalog.id },
      select: { type: true, assetIndex: true, assetUrl: true, assetHash: true },
    }),
  );

  const selectedHashes = new Set<string>();
  const selectedImageUrls = new Set<string>();
  for (const a of existingAssets) {
    if (a.assetHash) selectedHashes.add(a.assetHash);
  }

  const heroExisting = existingAssets.find(
    (a) => a.type === "HERO" && a.assetIndex === 0,
  );

  let heroAssetUrl = heroExisting?.assetUrl;

  if (!heroExisting || forceHero) {
    const queries = candidateQueries(target);
    logger.info({ target, queries }, "Finding hero (Wikimedia)");
    const hero = await pickHeroCandidate(target, queries);
    const imageUrl = hero.imageUrl;
    const mimeType = hero.mimeType;

    const { buffer } = await downloadImageBuffer(imageUrl);
    const assetHash = sha256Hex(buffer);
    selectedHashes.add(assetHash);
    selectedImageUrls.add(imageUrl);

    const uploaded = await uploadVehicleAssetToS3({
      buffer,
      mimeType,
      assetType: "HERO",
      assetIndex: 0,
      target,
      assetHash,
    });

    await withDbRetry(() =>
      dbInstances.vehicleAsset.upsert({
        where: {
          catalogId_type_assetIndex: {
            catalogId: catalog.id,
            type: "HERO",
            assetIndex: 0,
          },
        },
        create: {
          catalogId: catalog.id,
          type: "HERO",
          assetIndex: 0,
          assetUrl: uploaded.url,
          assetHash,
          mimeType,
          s3Key: uploaded.s3Key,
          source: hero.source,
        },
        update: {
          assetUrl: uploaded.url,
          assetHash,
          mimeType,
          s3Key: uploaded.s3Key,
          source: hero.source,
        },
      }),
    );
    heroAssetUrl = uploaded.url;
  }

  if (!heroAssetUrl) {
    throw new Error(`Hero asset missing after creation for catalogId=${catalog.id}`);
  }

  if (heroOnly) return heroAssetUrl;

  const angleExisting = new Map<number, string>();
  for (const a of existingAssets) {
    if (a.type === "ANGLE" && typeof a.assetIndex === "number") {
      angleExisting.set(a.assetIndex, a.assetUrl);
    }
  }

  for (let angleIndex = 0; angleIndex < ANGLES_COUNT; angleIndex++) {
    if (angleExisting.has(angleIndex)) continue;

    try {
      logger.info({ target, angleIndex }, "Finding angle (Wikimedia)");
      let lastPickErr: any;
      for (let pickAttempt = 0; pickAttempt < 3; pickAttempt++) {
        const picked = await pickAngleFromWikimedia({
          target,
          angleIndex,
          selectedImageUrls,
        });

        try {
          selectedImageUrls.add(picked.imageUrl);
          const { buffer } = await downloadImageBuffer(picked.imageUrl);
          const assetHash = sha256Hex(buffer);

          // Extremely rare, but avoid duplicates by content hash.
          if (selectedHashes.has(assetHash)) {
            selectedHashes.add(assetHash); // keep set warm
            lastPickErr = new Error("Duplicate content hash after download");
            continue;
          }

          selectedHashes.add(assetHash);

          const uploaded = await uploadVehicleAssetToS3({
            buffer,
            mimeType: picked.mimeType,
            assetType: "ANGLE",
            assetIndex: angleIndex,
            target,
            assetHash,
          });

          await withDbRetry(() =>
            dbInstances.vehicleAsset.create({
              data: {
                catalogId: catalog.id,
                type: "ANGLE",
                assetIndex: angleIndex,
                assetUrl: uploaded.url,
                assetHash,
                mimeType: picked.mimeType,
                s3Key: uploaded.s3Key,
                source: "Wikimedia Commons",
              },
            }),
          );

          lastPickErr = null;
          break;
        } catch (err: any) {
          lastPickErr = err;
          // remove the url so we can re-pick it within this angle if it failed due to download.
          selectedImageUrls.delete(picked.imageUrl);
        }
      }

      if (lastPickErr) throw lastPickErr;
    } catch (err: any) {
      logger.warn(
        { err, target, angleIndex },
        "Angle ingest failed; will retry later on next run",
      );
      if (String(err?.message ?? "").includes("429")) {
        // Wikimedia throttling is typically global to IP; pause longer before next angle slot.
        await new Promise((r) => setTimeout(r, 30000));
      }
    }

    // Mild rate limiting for Wikimedia + S3.
    await new Promise((r) => setTimeout(r, 800));
  }

  return heroAssetUrl;
}

function readTargetsFromCsv(csvText: string): Target[] {
  const lines = csvText
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  const targets: Target[] = [];
  for (const line of lines) {
    // Format: VEHICLE_TYPE,MAKE,MODEL,VARIANT(optional),YEAR(optional)
    const parts = line.split(",").map((p) => p.trim());
    const vehicleType = parts[0] as VehicleType;
    const make = parts[1] ?? "";
    const model = parts[2] ?? "";
    const variant = parts[3] ?? "";
    const year = parts[4] ? Number(parts[4]) : null;

    if (!vehicleType || (vehicleType !== "CAR" && vehicleType !== "BIKE")) continue;
    if (!make || !model) continue;

    targets.push({
      vehicleType,
      make,
      model,
      variant: variant && variant.length > 0 ? variant : null,
      year: Number.isFinite(year) ? year : null,
    });
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
  heroUrl: string,
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

  const res = await withDbRetry(() =>
    dbInstances.customerVehicle.updateMany({
      where,
      data: { imageUrl: heroUrl },
    }),
  );

  return res.count;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const heroOnly = args.includes("--heroOnly");
  const forceHero = args.includes("--forceHero");

  const targetsIdx = args.findIndex((a) => a === "--targetsFile");
  const targetsFile = targetsIdx >= 0 ? args[targetsIdx + 1] : undefined;

  const fileTargets = await loadTargetsFromFile(targetsFile);
  const targets: Target[] = fileTargets && fileTargets.length > 0 ? fileTargets : [];

  if (targets.length === 0) {
    throw new Error("No targets provided. Use --targetsFile path/to/top50cars_top30bikes_targets.csv");
  }

  logger.info(
    { targetsCount: targets.length, targetsFile, force, heroOnly, forceHero, angles: ANGLES_COUNT },
    "Starting vehicle catalog ingest (hero + angles)",
  );

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    try {
      const heroUrl = await ensureCatalogAssetsForTarget(t, {
        heroOnly,
        forceHero,
      });
      const updatedCount = await updateVehiclesForTarget(t, heroUrl, { force });

      logger.info(
        { i, total: targets.length, target: t, heroUrl, updatedCount },
        "Catalog assets ensured + CustomerVehicle updated (if dummy)",
      );
    } catch (err: any) {
      logger.error({ err, target: t, index: i }, "Failed ingest for target");
    }

    // Keep rate limits gentle.
    await new Promise((r) => setTimeout(r, 1200));
  }
}

main()
  .then(async () => {
    await dbInstances.$disconnect();
    logger.info("Vehicle catalog ingest finished");
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, "Vehicle catalog ingest crashed");
    await dbInstances.$disconnect();
    process.exit(1);
  });

