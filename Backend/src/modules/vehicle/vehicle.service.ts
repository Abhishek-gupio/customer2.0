import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { storageService } from "../../services/storage.service";
import {
  AddVehicleInput,
  UpdateVehicleInput,
  AddOdometerInput,
} from "./vehicle.validators";
import { logger } from "../../config/logger";
import { predictionService } from "../../services/prediction.service";
import { ocrService } from "../../services/ocr.service";
import { fetchAndSaveIntervalsForVehicle } from "../../services/oem-scraper.service";
import { rcVerificationService } from "../../services/rc-verification.service";
import { warrantyService } from "../../services/warranty.service";

function normalizeForMatch(s: string | null | undefined): string {
  return (s ?? "").toString().trim().replace(/\s+/g, " ").toLowerCase();
}

function tokenizeForFuzzyMatch(s: string | null | undefined): string[] {
  return normalizeForMatch(s)
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(" ")
    .map((w) => w.trim())
    .filter(Boolean);
}

function overlapCount(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let count = 0;
  for (const token of new Set(a)) {
    if (setB.has(token)) count += 1;
  }
  return count;
}

function isLegacyUnsplashUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("images.unsplash.com/photo-");
}

// Catalog matching helpers (must stay consistent with `scripts/vehicle-catalog-image-ingest.ts`)
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
      /\b(india|ltd|limited|pvt|private|vehicles|auto|motorcycle|scooter|and|&|\(p\)|\.|motors|passenger)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanModel(model: string, make?: string): string {
  let cleaned = model.replace(
    /\b(bs\s*iv|bs\s*vi|bs4|bs6|vdi|vxi|zxi|dlx|std)\b/gi,
    " ",
  );

  // Remove make from model if it starts with it (e.g. "Tata Nexon" -> "Nexon")
  if (make) {
    const makeWords = make.toLowerCase().split(' ');
    const firstWordOfMake = makeWords[0];
    if (cleaned.toLowerCase().startsWith(firstWordOfMake)) {
      cleaned = cleaned.substring(firstWordOfMake.length).trim();
    }
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

function vehicleTypeBucket(vehicleType?: string | null): "CAR" | "BIKE" {
  const v = (vehicleType ?? "").toUpperCase();
  if (v.includes("BIKE") || v.includes("MOTORCYCLE")) return "BIKE";
  return "CAR";
}

function makeCatalogNormalizedKey(args: {
  vehicleType: "CAR" | "BIKE";
  make?: string | null;
  model?: string | null;
  variant?: string | null;
}): string {
  const mk = normalizeForKey(cleanMake(args.make ?? ""));
  const md = normalizeForKey(cleanModel(args.model ?? "", args.make ?? ""));
  const v = args.variant ? normalizeForKey(cleanModel(args.variant, args.make ?? "")) : "";
  return `${args.vehicleType}|${mk}|${md}|${v}`;
}

async function resolveCatalogHeroImageUrl(args: {
  vehicleType: "CAR" | "BIKE";
  make?: string | null;
  model?: string | null;
  variant?: string | null;
}): Promise<string | null> {
  if (!args.make || !args.model) return null;

  const normalizedKey = makeCatalogNormalizedKey(args);

  let catalog: any = await dbInstances.vehicleCatalog.findUnique({
    where: { normalizedKey },
  });

  if (!catalog) {
    const makeNeedle = normalizeForMatch(cleanMake(args.make));
    const modelNeedle = normalizeForMatch(cleanModel(args.model, args.make ?? undefined));
    const variantNeedle = args.variant
      ? normalizeForMatch(cleanModel(args.variant, args.make ?? undefined))
      : null;
    const makeTokens = tokenizeForFuzzyMatch(makeNeedle);
    const modelTokens = tokenizeForFuzzyMatch(modelNeedle);
    const variantTokens = tokenizeForFuzzyMatch(variantNeedle);
    const makeFirst = makeTokens[0] ?? null;
    const modelFirst = modelTokens[0] ?? null;
    const modelFirstTwo = modelTokens.slice(0, 2).join(" ");

    let candidates = await dbInstances.vehicleCatalog.findMany({
      where: {
        vehicleType: args.vehicleType,
        ...(makeFirst
          ? { make: { contains: makeFirst, mode: "insensitive" } }
          : {}),
        ...(modelFirst
          ? { model: { contains: modelFirst, mode: "insensitive" } }
          : {}),
      },
      take: 250,
      orderBy: { updatedAt: "desc" },
    });

    // If model's first word is too different, widen to same make bucket only.
    if (candidates.length === 0 && makeFirst) {
      candidates = await dbInstances.vehicleCatalog.findMany({
        where: {
          vehicleType: args.vehicleType,
          make: { contains: makeFirst, mode: "insensitive" },
        },
        take: 250,
        orderBy: { updatedAt: "desc" },
      });
    }

    let bestScore = -1;
    let bestCatalog: any = null;

    for (const c of candidates) {
      const cMake = normalizeForMatch(cleanMake(c.make ?? ""));
      const cModel = normalizeForMatch(cleanModel(c.model ?? "", c.make ?? undefined));
      const cVariant = normalizeForMatch(cleanModel(c.variant ?? "", c.make ?? undefined));
      const cModelTokens = tokenizeForFuzzyMatch(cModel);
      const cVariantTokens = tokenizeForFuzzyMatch(cVariant);

      let score = 0;

      if (cMake === makeNeedle) score += 40;
      if (makeFirst && (cMake.includes(makeFirst) || makeFirst.includes(cMake))) score += 16;
      if (cMake && makeNeedle && (cMake.includes(makeNeedle) || makeNeedle.includes(cMake))) score += 12;

      if (cModel === modelNeedle) score += 90;
      if (modelFirstTwo && (cModel.includes(modelFirstTwo) || modelFirstTwo.includes(cModel))) score += 48;
      if (modelFirst && (cModel.includes(modelFirst) || modelFirst.includes(cModel))) score += 24;
      score += overlapCount(modelTokens, cModelTokens) * 8;

      if (variantNeedle) {
        if (cVariant && (cVariant.includes(variantNeedle) || variantNeedle.includes(cVariant))) score += 18;
        score += overlapCount(variantTokens, cVariantTokens) * 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCatalog = c;
      }
    }

    // Threshold tuned so "same make + nearby first 1-2 model words" matches,
    // while reducing accidental wrong-model picks.
    if (bestCatalog && bestScore >= 48) {
      catalog = bestCatalog;
    }
  }

  if (!catalog) return null;

  const hero = await dbInstances.vehicleAsset.findFirst({
    where: { catalogId: catalog.id, type: "HERO" },
    orderBy: { assetIndex: "asc" },
  });

  return hero?.assetUrl ?? null;
}

async function resolveCatalogHeroForVehicleRecord(vehicle: {
  vehicleType?: string | null;
  make?: string | null;
  model?: string | null;
}): Promise<string | null> {
  if (!vehicle?.make || !vehicle?.model) return null;
  return resolveCatalogHeroImageUrl({
    vehicleType: vehicleTypeBucket(vehicle.vehicleType),
    make: vehicle.make,
    model: vehicle.model,
    variant: null,
  });
}

export const vehicleService = {
  async resolveVehicleId(customerId: string, preferredId?: string | null): Promise<string | null> {
    // 1. My owned vehicles
    const myVehicles = await dbInstances.customerVehicle.findMany({
      where: { customerId, isActive: true },
      select: { id: true, isPrimary: true },
    });

    // 2. Shared vehicles I have access to
    const sharedVehicles = await dbInstances.customerVehicle.findMany({
      where: {
        isActive: true,
        accessList: {
          some: { customerId }
        }
      },
      select: { id: true, isPrimary: true },
    });

    const allVehicles = [...myVehicles, ...sharedVehicles];
    if (allVehicles.length === 0) return null;

    if (preferredId && preferredId.trim()) {
      const pid = preferredId.trim();
      if (allVehicles.some((v) => v.id === pid)) return pid;
    }

    const primary = allVehicles.find((v) => v.isPrimary);
    if (primary) return primary.id;

    return allVehicles[0].id;
  },

  /**
   * Centralized Access Control: Ensures a user can interact with a vehicle
   * Logic: Owners always have access. Shared users must have a matching role.
   */
  async ensureVehicleAccess(
    customerId: string,
    vehicleId: string,
    requiredRoles: ("OWNER" | "EDITOR" | "DRIVER" | "VIEWER")[] = ["OWNER", "EDITOR", "DRIVER"]
  ) {
    const vehicle = await dbInstances.customerVehicle.findUnique({
      where: { id: vehicleId },
      include: {
        accessList: {
          where: { customerId },
        },
      },
    });

    if (!vehicle) throw AppError.notFound("Vehicle not found");

    const isOwner = vehicle.customerId === customerId;
    if (isOwner) return { vehicle, role: "OWNER" as const };

    const matchingAccess = vehicle.accessList?.[0];
    if (!matchingAccess) {
      throw AppError.forbidden("You do not have access to this vehicle");
    }

    const role = matchingAccess.role as "EDITOR" | "DRIVER" | "VIEWER";
    if (!requiredRoles.includes(role)) {
      throw AppError.forbidden(
        `Your access role (${role}) is insufficient for this action. Required: ${requiredRoles.join("/")}`
      );
    }

    return { vehicle, role };
  },

  async addVehicle(customerId: string, input: AddVehicleInput) {
    logger.info({ customerId, registrationNumber: input.registrationNumber }, "Attempting to add vehicle");
    
    // Check if registration number already exists
    const existing = await dbInstances.customerVehicle.findUnique({
      where: { registrationNumber: input.registrationNumber },
    });

    if (existing) {
      logger.warn({ registrationNumber: input.registrationNumber }, "Vehicle already exists");
      throw AppError.conflict(
        "Vehicle with this registration number already exists",
      );
    }

    const normalizedMake = normalizeForMatch(input.make);
    const normalizedModel = normalizeForMatch(input.model);
    // Resolve image only from catalog assets table (VehicleCatalog + VehicleAsset).
    let imageUrl: string | undefined;
    if (normalizedMake && normalizedModel) {
      imageUrl = (await resolveCatalogHeroImageUrl({
        vehicleType: vehicleTypeBucket(input.vehicleType),
        make: input.make ?? null,
        model: input.model ?? null,
        variant: input.variant ?? null,
      })) ?? undefined;
    }
    if (!imageUrl) {
      logger.warn(
        { registrationNumber: input.registrationNumber, make: input.make, model: input.model },
        "No VehicleAsset hero found for this make/model. Saving vehicle without catalog image",
      );
    }

    console.log('Adding Vehicle to DB. Input Data:', JSON.stringify(input, null, 2));

    const { variant, ...vehicleData } = input;

    // Create vehicle with imageUrl
    const [vehicle] = await dbInstances.$transaction([
      dbInstances.customerVehicle.create({
        data: {
          ...vehicleData,
          customerId,
          // Store normalized make/model/variant for consistent matching later.
          make: vehicleData.make ? vehicleData.make.trim() : undefined,
          model: vehicleData.model ? vehicleData.model.trim() : undefined,
          imageUrl,
        },
      }),
    ]);

    logger.info({ vehicleId: vehicle.id, registrationNumber: vehicle.registrationNumber }, "Vehicle successfully created in DB");

    const vehicleWithImage = {
      ...vehicle,
      imageUrl: imageUrl
        ? await storageService.ensureReadableUrl(imageUrl)
        : undefined,
    };

    // Initialize health score (default 100)
    await dbInstances.vehicleHealthScore.create({
      data: {
        vehicleId: vehicle.id,
        overallScore: 100,
        explanations: ["New vehicle added."],
      },
    });
    // If odometer provided, add first log
    if (input.currentOdometer) {
      await this.addOdometerLog(customerId, vehicle.id, {
        reading: input.currentOdometer,
        date: new Date(),
      });
    }

    // Initialize all parts to 100% health (as if all service is done) at current odo
    await warrantyService.initializeMaintenance(vehicle.id, input.currentOdometer || 0);

    // Trigger health recalculation immediately
    await this.calculateHealthScore(vehicle.id);

    // Fetch OEM intervals in background
    fetchAndSaveIntervalsForVehicle(vehicle.id).catch((err) =>
      logger.warn({ err, vehicleId: vehicle.id }, "OEM interval fetch failed (non-blocking)"),
    );

    return vehicleWithImage;
  },

  async addOdometerLog(
    customerId: string,
    vehicleId: string,
    input: AddOdometerInput,
  ) {
    const vehicle = await this.getVehicle(customerId, vehicleId);

    const isOwner = vehicle.customerId === customerId;
    const hasWriteAccess =
      vehicle.accessList?.some(
        (a: any) => a.role === "EDITOR" || a.role === "DRIVER",
      ) ?? false;

    if (!isOwner && !hasWriteAccess) {
      throw AppError.forbidden(
        "You have view-only access to this vehicle and cannot update the odometer",
      );
    }

    const lastLog = await dbInstances.odometerLog.findFirst({
      where: { vehicleId },
      orderBy: { date: "desc" },
    });

    if (lastLog && input.reading < lastLog.reading) {
      throw AppError.badRequest(
        `New reading (${input.reading}) cannot be lower than the previous reading (${lastLog.reading})`,
      );
    }

    const log = await dbInstances.odometerLog.create({
      data: {
        vehicleId,
        reading: input.reading,
        date: input.date,
      },
    });

    // Update current odometer on vehicle
    await dbInstances.customerVehicle.update({
      where: { id: vehicleId },
      data: { currentOdometer: input.reading },
    });

    // Trigger health recalculation
    this.calculateHealthScore(vehicleId);

    return log;
  },

  async listVehicles(customerId: string) {
    const vehicles = await dbInstances.customerVehicle.findMany({
      where: {
        OR: [
          { customerId, isActive: true },
          { accessList: { some: { customerId } }, isActive: true },
        ],
      },
      include: {
        healthScore: true,
        telematicsDevice: {
          select: { id: true, isActive: true }
        }
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });
    // Ensure vehicle image comes from catalog assets when available.
    return Promise.all(
      vehicles.map(async (v: any) => {
        const shouldResolveFromCatalog = !v.imageUrl || isLegacyUnsplashUrl(v.imageUrl);
        const catalogHero = shouldResolveFromCatalog
          ? await resolveCatalogHeroForVehicleRecord(v)
          : null;
        const resolvedImageUrl = catalogHero ?? (shouldResolveFromCatalog ? null : v.imageUrl);

        // Backfill DB once catalog hero is found, so future reads stay consistent.
        if (catalogHero && catalogHero !== v.imageUrl) {
          dbInstances.customerVehicle.update({
            where: { id: v.id },
            data: { imageUrl: catalogHero },
          }).catch((err) =>
            logger.warn({ err, vehicleId: v.id }, "Failed to backfill catalog hero image"),
          );
        }

        return {
          ...v,
          imageUrl: resolvedImageUrl
            ? await storageService.ensureReadableUrl(resolvedImageUrl)
            : null,
        };
      }),
    );
  },

  async getVehicle(customerId: string, vehicleId: string) {
    const vehicle = await dbInstances.customerVehicle.findUnique({
      where: { id: vehicleId },
      include: {
        healthScore: true,
        telematicsDevice: {
          select: { id: true, isActive: true }
        },
        accessList: {
          where: { customerId },
        },
      },
    });

    if (
      !vehicle ||
      (vehicle.customerId !== customerId && vehicle.accessList.length === 0)
    ) {
      throw AppError.notFound("Vehicle not found");
    }

    // A4: Explainability – add scoreChangeReason and components for "Why this score?" and "What to do next?"
    if (vehicle.healthScore) {
      const recs = Array.isArray(vehicle.healthScore.recommendations)
        ? (vehicle.healthScore.recommendations as string[])
        : [];
      const expls = Array.isArray(vehicle.healthScore.explanations)
        ? (vehicle.healthScore.explanations as string[])
        : [];
      const scoreChangeReason =
        recs[0] ?? expls[0] ?? "Score based on maintenance, documents, and driving data.";
      const components: { name: string; score: number | null; label: string }[] = [
        {
          name: "maintenance",
          score: vehicle.healthScore.maintenanceScore ?? null,
          label: "Maintenance",
        },
        {
          name: "driving",
          score: vehicle.healthScore.drivingScore ?? null,
          label: "Driving",
        },
        {
          name: "age",
          score: vehicle.healthScore.ageScore ?? null,
          label: "Age",
        },
        {
          name: "mileage",
          score: vehicle.healthScore.mileageScore ?? null,
          label: "Mileage",
        },
      ];
      (vehicle as any).healthScore = {
        ...vehicle.healthScore,
        scoreChangeReason,
        components,
        recommendations: recs,
        explanations: expls,
      };
    }

    const shouldResolveFromCatalog = !vehicle?.imageUrl || isLegacyUnsplashUrl(vehicle?.imageUrl);
    const catalogHero = shouldResolveFromCatalog
      ? await resolveCatalogHeroForVehicleRecord(vehicle)
      : null;
    const resolvedImageUrl = catalogHero ?? (shouldResolveFromCatalog ? null : vehicle?.imageUrl ?? null);

    if (catalogHero && catalogHero !== vehicle?.imageUrl) {
      dbInstances.customerVehicle.update({
        where: { id: vehicle.id },
        data: { imageUrl: catalogHero },
      }).catch((err) =>
        logger.warn({ err, vehicleId: vehicle.id }, "Failed to backfill catalog hero image"),
      );
    }

    return {
      ...vehicle,
      imageUrl: resolvedImageUrl
        ? await storageService.ensureReadableUrl(resolvedImageUrl)
        : null,
    };
  },

  async getVehicleAssets(customerId: string, vehicleId: string) {
    // Ensure the vehicle exists + customer can access it.
    const vehicle: any = await this.getVehicle(customerId, vehicleId);

    const make = vehicle.make ?? null;
    const model = vehicle.model ?? null;
    const variant = vehicle.variant ?? null;

    if (!make || !model) {
      return { heroUrl: null, angles: [] as string[] };
    }

    const bucket = vehicleTypeBucket(vehicle.vehicleType);
    const normalizedKey = makeCatalogNormalizedKey({
      vehicleType: bucket,
      make,
      model,
      variant,
    });

    // 1) Exact normalizedKey lookup (preferred; deterministic)
    let catalog: any = await dbInstances.vehicleCatalog.findUnique({
      where: { normalizedKey },
    });

    // 2) Fallback fuzzy lookup (in case make/model strings differ slightly)
    if (!catalog) {
      const makeNeedle = normalizeForMatch(cleanMake(make));
      const modelNeedle = normalizeForMatch(cleanModel(model));
      const variantNeedle = variant ? normalizeForMatch(cleanModel(variant)) : null;

      // Pass 1: variant-aware fuzzy match.
      catalog = await dbInstances.vehicleCatalog.findFirst({
        where: {
          vehicleType: bucket,
          make: { contains: makeNeedle, mode: "insensitive" },
          model: { contains: modelNeedle, mode: "insensitive" },
          ...(variantNeedle
            ? { variant: { contains: variantNeedle, mode: "insensitive" } }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
      });

      // Pass 2: ignore variant for broader make+model match.
      if (!catalog) {
        catalog = await dbInstances.vehicleCatalog.findFirst({
          where: {
            vehicleType: bucket,
            make: { contains: makeNeedle, mode: "insensitive" },
            model: { contains: modelNeedle, mode: "insensitive" },
          },
          orderBy: { updatedAt: "desc" },
        });
      }
    }

    if (!catalog) {
      return { heroUrl: null, angles: [] as string[] };
    }

    const hero = await dbInstances.vehicleAsset.findFirst({
      where: { catalogId: catalog.id, type: "HERO", assetIndex: 0 },
    });

    const angleAssets = await dbInstances.vehicleAsset.findMany({
      where: { catalogId: catalog.id, type: "ANGLE" },
      orderBy: { assetIndex: "asc" },
      take: 12,
    });

    const heroUrl =
      hero?.assetUrl != null
        ? await storageService.ensureReadableUrl(hero.assetUrl)
        : null;

    const angles = await Promise.all(
      (angleAssets ?? []).map(async (a: any) => {
        if (!a?.assetUrl) return null;
        return storageService.ensureReadableUrl(a.assetUrl);
      }),
    );

    return { heroUrl, angles: angles.filter(Boolean) as string[] };
  },

  async updateVehicle(
    customerId: string,
    vehicleId: string,
    input: UpdateVehicleInput,
  ) {
    const vehicle = await this.getVehicle(customerId, vehicleId);

    if (vehicle.customerId !== customerId) {
      throw AppError.forbidden("Only the owner can update vehicle details");
    }

    const updated = await dbInstances.customerVehicle.update({
      where: { id: vehicleId },
      data: input,
    });

    if (input.make !== undefined || input.model !== undefined) {
      fetchAndSaveIntervalsForVehicle(vehicleId).catch((err) =>
        logger.warn({ err, vehicleId }, "OEM interval fetch failed on update (non-blocking)"),
      );
    }

    const shouldRecalculateHealth =
      input.currentOdometer !== undefined ||
      input.registrationDate !== undefined ||
      input.insuranceUpto !== undefined ||
      input.pollutionUpto !== undefined;

    if (shouldRecalculateHealth) {
      void this.calculateHealthScore(vehicleId).catch((err) =>
        logger.warn(
          { err, vehicleId },
          "Health recalculation failed after vehicle update",
        ),
      );
    }

    return updated;
  },

  async deleteVehicle(customerId: string, vehicleId: string) {
    const vehicle = await this.getVehicle(customerId, vehicleId);

    if (vehicle.customerId !== customerId) {
      throw AppError.forbidden("Only the owner can delete this vehicle");
    }

    return dbInstances.$transaction(async (tx) => {
      await tx.vehicleDocument.updateMany({
        where: { vehicleId },
        data: { vehicleId: null },
      });

      await tx.expense.updateMany({
        where: { vehicleId },
        data: { vehicleId: null },
      });

      await tx.documentEmbedding.deleteMany({
        where: { entityId: vehicleId, entityType: "VEHICLE" },
      });

      return tx.customerVehicle.delete({
        where: { id: vehicleId },
      });
    });
  },

  async setPrimary(customerId: string, vehicleId: string) {
    const vehicle = await this.getVehicle(customerId, vehicleId);

    if (vehicle.customerId !== customerId) {
      throw AppError.forbidden("Only the owner can set a primary vehicle");
    }

    // 1. Unset existing primary
    await dbInstances.customerVehicle.updateMany({
      where: { customerId, isPrimary: true },
      data: { isPrimary: false },
    });

    return dbInstances.customerVehicle.update({
      where: { id: vehicleId },
      data: { isPrimary: true },
    });
  },

  async calculateHealthScore(vehicleId: string) {
    logger.info({ vehicleId }, "Predicting advanced vehicle health score...");
    return predictionService.calculateAdvancedHealthScore(vehicleId);
  },

  async updateOdometerViaAI(
    customerId: string,
    vehicleId: string,
    file: Express.Multer.File,
  ) {
    const reading = await this.extractOdometerViaAI(customerId, vehicleId, file);

    return this.addOdometerLog(customerId, vehicleId, {
      reading,
      date: new Date(),
    });
  },

  async extractOdometerViaAI(
    customerId: string,
    vehicleId: string,
    file: Express.Multer.File,
  ): Promise<number> {
    const vehicle = await this.getVehicle(customerId, vehicleId);

    const isOwner = vehicle.customerId === customerId;
    const hasWriteAccess =
      vehicle.accessList?.some(
        (a: any) => a.role === "EDITOR" || a.role === "DRIVER",
      ) ?? false;

    if (!isOwner && !hasWriteAccess) {
      throw AppError.forbidden(
        "You have view-only access to this vehicle and cannot update the odometer",
      );
    }

    const reading = await ocrService.parseOdometer(file.buffer, file.mimetype);
    if (!reading) {
      throw AppError.badRequest("Could not extract odometer reading from photo.");
    }

    return reading;
  },

  /**
   * Stubbed lookupRTO — Gemini removed as per user request.
   */
  async lookupRTO(plate: string, model?: string) {
    logger.info({ plate, model }, "lookupRTO called (Gemini disabled)");
    // We return minimal dummy data to avoid breaking the frontend totally,
    // though the frontend lookup step should be removed.
    return {
      registrationNumber: plate,
      brand: "Unknown",
      model: "Unknown",
      fuelType: "PETROL",
      imageUrl: null
    };
  },

  async generateVehicleImage(_type: string): Promise<string | null> {
    return null;
  },

  async verifyVehicle(regNo: string) {
    const normalizedRegNo = regNo.toUpperCase().replace(/\s/g, "");
    logger.info({ normalizedRegNo }, "Starting vehicle verification");

    // 1. Check if vehicle already exists in any customer's account
    const existingVehicle = await dbInstances.customerVehicle.findUnique({
      where: { registrationNumber: normalizedRegNo },
    });

    if (existingVehicle) {
      logger.info({ normalizedRegNo }, "Returning vehicle data from existing customer_vehicle record");
      return {
        registrationNumber: existingVehicle.registrationNumber,
        ownerName: existingVehicle.ownerName,
        rto: existingVehicle.rto,
        make: existingVehicle.make,
        brand: existingVehicle.brand,
        model: existingVehicle.model,
        vehicleClass: existingVehicle.vehicleClass,
        engineNumber: existingVehicle.engineNumber,
        chassisNumber: existingVehicle.chassisNumber,
        fuelType: existingVehicle.fuelType,
        fuelNorms: existingVehicle.fuelNorms,
        rcStatus: existingVehicle.rcStatus,
        unloadedWeight: existingVehicle.unloadedWeight,
        fitnessUpto: existingVehicle.fitnessUpto,
        insuranceUpto: existingVehicle.insuranceUpto,
        pollutionUpto: existingVehicle.pollutionUpto,
        mileage: existingVehicle.mileage,
        color: existingVehicle.color,
        manufacturingMonthYear: existingVehicle.manufacturingMonthYear,
        vehicleType: existingVehicle.vehicleType || 'CAR'
      };
    }

    // 2. Not in DB, call external API
    const rcData = await rcVerificationService.verifyRC(normalizedRegNo);

    if (!rcData) {
      throw AppError.badRequest("RC details not found for this vehicle number");
    }

    // 3. Return data (don't store yet, user saves it when they add vehicle)
    logger.info({ normalizedRegNo }, "Vehicle details fetched from RC API");
    return rcData;
  },
};
