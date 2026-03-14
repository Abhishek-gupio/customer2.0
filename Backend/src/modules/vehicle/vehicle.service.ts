import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import {
  AddVehicleInput,
  UpdateVehicleInput,
  AddOdometerInput,
} from "./vehicle.validators";
import { logger } from "../../config/logger";
import { predictionService } from "../../services/prediction.service";
import { ocrService } from "../../services/ocr.service";
import { fetchAndSaveIntervalsForVehicle } from "../../services/oem-scraper.service";

// ─── Gemini Config ─────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TEXT_URL = `${GEMINI_BASE}/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_IMAGE_URL = `${GEMINI_BASE}/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const FALLBACK_CAR_IMAGE =
  "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800";

async function geminiPost(url: string, body: object): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText}`);
  }
  return res.json();
}

export const vehicleService = {
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

    // Generate AI image for the vehicle in parallel with DB creation
    let imageUrl: string | undefined;
    try {
      // Pass the model/make along with the vehicleType (e.g., "BIKE")
      // so the image generator knows exactly what kind of vehicle it is
      const imageQuery = `${input.model || input.make || ""} ${input.vehicleType || "SEDAN"}`;
      imageUrl = await vehicleService.generateVehicleImage(imageQuery);
    } catch (err) {
      logger.warn({ err }, "generateVehicleImage failed — using fallback");
      imageUrl = FALLBACK_CAR_IMAGE;
    }

    // Create vehicle with imageUrl — column now exists in DB after db push
    const [vehicle] = await dbInstances.$transaction([
      dbInstances.customerVehicle.create({
        data: { ...input, customerId, imageUrl },
      }),
    ]);

    logger.info({ vehicleId: vehicle.id, registrationNumber: vehicle.registrationNumber }, "Vehicle successfully created in DB");

    // imageUrl is now saved in DB. Also keep it on the response object.
    const vehicleWithImage = { ...vehicle, imageUrl };

    // Initialize health score (default 100)
    await dbInstances.vehicleHealthScore.create({
      data: {
        vehicleId: vehicle.id,
        overallScore: 100,
        explanations: ["New vehicle added. Health calculation pending."],
      },
    });

    // If odometer provided, add first log
    if (input.currentOdometer) {
      await this.addOdometerLog(customerId, vehicle.id, {
        reading: input.currentOdometer,
        date: new Date(),
      });
    }

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

    // 1. Get last log to prevent "Rewinding" odometer
    const lastLog = await (dbInstances as any).odometerLog.findFirst({
      where: { vehicleId },
      orderBy: { date: "desc" },
    });

    if (lastLog && input.reading < lastLog.reading) {
      throw AppError.badRequest(
        `New reading (${input.reading}) cannot be lower than the previous reading (${lastLog.reading})`,
      );
    }

    const log = await (dbInstances as any).odometerLog.create({
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
    // ... (rest of the service)
    return dbInstances.customerVehicle.findMany({
      where: {
        OR: [
          { customerId, isActive: true },
          { accessList: { some: { customerId } }, isActive: true },
        ],
      },
      include: {
        healthScore: true,
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });
  },

  async getVehicle(customerId: string, vehicleId: string) {
    const vehicle = await dbInstances.customerVehicle.findUnique({
      where: { id: vehicleId },
      include: {
        healthScore: true,
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

    return vehicle;
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

    // Re-fetch OEM intervals when make/model/year change (real data from website)
    if (input.make !== undefined || input.model !== undefined || input.year !== undefined) {
      fetchAndSaveIntervalsForVehicle(vehicleId).catch((err) =>
        logger.warn({ err, vehicleId }, "OEM interval fetch failed on update (non-blocking)"),
      );
    }

    return updated;
  },

  async deleteVehicle(customerId: string, vehicleId: string) {
    const vehicle = await this.getVehicle(customerId, vehicleId);

    if (vehicle.customerId !== customerId) {
      throw AppError.forbidden("Only the owner can delete this vehicle");
    }

    // ─── Transactional Hard Delete ──────────────────────────────────────────
    // We clean up non-cascading relations first, then delete the vehicle.
    // Prisma cascading (onDelete: Cascade) handles logs, challans, etc.
    return dbInstances.$transaction(async (tx) => {
      // 1. Unlink documents & expenses (keep them but remove vehicle ref)
      await tx.customerDocument.updateMany({
        where: { vehicleId },
        data: { vehicleId: null },
      });

      await tx.expense.updateMany({
        where: { vehicleId },
        data: { vehicleId: null },
      });

      // 2. Remove AI embeddings for this vehicle if they exist
      await tx.documentEmbedding.deleteMany({
        where: { entityId: vehicleId, entityType: "VEHICLE" },
      });

      // 3. Final Hard Delete
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

    // 2. Set new primary
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
    const reading = await ocrService.parseOdometer(file.buffer, file.mimetype);

    if (!reading) {
      throw AppError.badRequest(
        "Could not extract odometer reading from photo. Please ensure the dashboard is clear.",
      );
    }

    return this.addOdometerLog(customerId, vehicleId, {
      reading,
      date: new Date(),
    });
  },

  // ─── AI: Gemini RTO Lookup ───────────────────────────────────────────────────
  /**
   * Called by GET /v1/vehicles/lookup/:plate
   * Returns RTO details for the given Indian license plate via Gemini.
   * The API key is NEVER exposed to the client.
   */
  async lookupRTO(plate: string, model?: string) {
    const prompt = `Act as an Indian RTO database. Fetch details for registration number ${plate}${model ? ` (Model: ${model})` : ""}.
Return ONLY a valid JSON object with these fields, detecting the correct values for this specific vehicle:
{
  "ownerName": "...",
  "rto": "City RTO, State",
  "chassisNo": "...",
  "engineNo": "...",
  "fuelType": "PETROL/DIESEL/CNG/EV",
  "fuelNorms": "BHARAT STAGE VI",
  "priceRange": "...",
  "rating": 4.5,
  "transmission": "Manual/Automatic",
  "mileage": "...",
  "regDate": "...",
  "fitnessUpto": "...",
  "insuranceUpto": "...",
  "pollutionUpto": "...",
  "unloadedWeight": "...",
  "rcStatus": "ACTIVE",
  "brand": "Detect Brand (e.g. Honda, Suzuki, Tata)"
}
Return ONLY the JSON.`;

    // Fetch RTO text + vehicle image in parallel
    const [rtoData, imageUrl] = await Promise.all([
      geminiPost(GEMINI_TEXT_URL, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
      vehicleService.generateVehicleImage(model || "Sedan Car"),
    ]);

    const raw = rtoData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw AppError.badRequest("Gemini returned empty RTO data");

    const clean = raw.replace(/```json|```/g, "").trim();
    const rtoDetails = JSON.parse(clean);
    return { ...rtoDetails, imageUrl };
  },

  // ─── AI: Generate Vehicle Image URL ─────────────────────────────────────────
  /**
   * Returns a VERIFIED Unsplash car image URL based on model keywords.
   * We do NOT ask Gemini to invent URLs because it hallucinates photo IDs
   * (e.g. photo-162913207773146471e24934a) which return 404.
   * All IDs in VEHICLE_IMAGES below are real, verified Unsplash photos.
   */
  // ─── AI: Generate Vehicle Image URL via Imagen 4.0 ──────────────────────
  /**
   * Generates a photorealistic vehicle image using Google's Imagen 4.0 model,
   * uploads the base64 output via storageService, and returns the URL.
   */
  async generateVehicleImage(model: string): Promise<string> {
    try {
      const q = model.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Vehicle";
      const prompt = `A highly detailed, photorealistic 4k professional studio photography of a ${q}. Cinematic lighting, pure black background, dramatic reflections, ultra sharp focus.`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_API_KEY}`;
      const body = {
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          outputOptions: { mimeType: "image/jpeg" },
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Imagen 4.0 error ${res.status}: ${errText}`);
      }

      const json = await res.json();
      const b64 = json?.predictions?.[0]?.bytesBase64Encoded;
      
      if (!b64) {
        throw new Error("No image generated by Imagen API");
      }

      // Convert Base64 to a mock Multer File and save it via our StorageService
      const buffer = Buffer.from(b64, "base64");
      const mockFile = {
        buffer,
        mimetype: "image/jpeg",
        originalname: `ai-${Date.now()}.jpg`,
        fieldname: "file",
        encoding: "7bit",
        size: buffer.length,
      } as Express.Multer.File;

      const { storageService } = require("../../services/storage.service");
      const uploadResult = await storageService.uploadFile(mockFile, "vehicles", true);
      
      // If we're using local storage, prepend the base backend URL so the app can load it.
      // Usually mobile apps need full http://.../uploads/... URLs
      if (uploadResult.url.startsWith("/")) {
         return `http://localhost:9000${uploadResult.url}`;
      }

      return uploadResult.url;
    } catch (err) {
      logger.error({ err, model }, "Imagen 4.0 generation failed. Falling back to default.");
      // Fallback
      if (model.toLowerCase().includes("bike")) {
        return "https://images.pexels.com/photos/2116475/pexels-photo-2116475.jpeg?auto=compress&cs=tinysrgb&w=800";
      }
      return "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=800";
    }
  },
};

