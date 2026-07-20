import { z } from "zod";

const washTypeEnum = z.enum([
  "EXTERIOR", "INTERIOR", "FOAM", "PRESSURE", "STEAM", "WATERLESS", "DETAILING",
  "CERAMIC_COATING", "WAX_POLISH", "ENGINE_CLEAN", "TYRE_POLISH", "GLASS_TREATMENT",
  "UNDERCARRIAGE", "SANITIZATION", "BIKE_WASH", "EV_SAFE_WASH",
]);

// ── Customer-facing ─────────────────────────────────────────────

export const searchCentersSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().default(10),
});

export const getSlotsSchema = z.object({
  date: z.coerce.date(),
});

export const createBookingSchema = z
  .object({
    serviceModel: z.enum(["VISIT_CENTER", "DOORSTEP"]),
    washType: washTypeEnum,
    vehicleId: z.string().optional(),
    // Visit-center only
    centerId: z.string().optional(),
    slotId: z.string().optional(),
    // Doorstep only
    partnerId: z.string().optional(),
    addressLine: z.string().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    scheduledAt: z.coerce.date().optional(),
    /** Client-generated, stable across retries of the same tap — prevents double-booking on network retry. */
    idempotencyKey: z.string().min(10).max(100).optional(),
  })
  .refine((v) => v.serviceModel !== "VISIT_CENTER" || (v.centerId && v.slotId), {
    message: "centerId and slotId are required for a visit-center booking",
    path: ["centerId"],
  })
  .refine((v) => v.serviceModel !== "DOORSTEP" || (v.partnerId && v.addressLine), {
    message: "partnerId and addressLine are required for a doorstep booking",
    path: ["partnerId"],
  });

// ── Partner-facing ───────────────────────────────────────────────

export const partnerLoginSchema = z.object({
  phoneNumber: z.string().min(6),
  password: z.string().min(1),
});

export const createTechnicianSchema = z.object({
  name: z.string().min(1),
  phoneNumber: z.string().min(6),
  password: z.string().min(8),
  photoUrl: z.string().optional(),
});

export const technicianLoginSchema = z.object({
  phoneNumber: z.string().min(6),
  password: z.string().min(1),
});

export const createCenterSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  supportsBike: z.coerce.boolean().default(true),
  supportsCar: z.coerce.boolean().default(true),
  supportsEV: z.coerce.boolean().default(true),
});

export const createSlotsSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  intervalHours: z.coerce.number().int().min(1).max(12).default(2),
  capacity: z.coerce.number().int().positive().default(1),
});

export const assignTechnicianSchema = z.object({
  technicianId: z.string().min(1),
});

// ── Admin-facing (Gupio ops onboarding a wash partner) ──────────

export const adminCreatePartnerSchema = z.object({
  name: z.string().min(1),
  phoneNumber: z.string().min(6),
  password: z.string().min(8),
});

export type SearchCentersInput = z.infer<typeof searchCentersSchema>;
export type GetSlotsInput = z.infer<typeof getSlotsSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type PartnerLoginInput = z.infer<typeof partnerLoginSchema>;
export type CreateTechnicianInput = z.infer<typeof createTechnicianSchema>;
export type TechnicianLoginInput = z.infer<typeof technicianLoginSchema>;
export type CreateCenterInput = z.infer<typeof createCenterSchema>;
export type CreateSlotsInput = z.infer<typeof createSlotsSchema>;
export type AssignTechnicianInput = z.infer<typeof assignTechnicianSchema>;
export type AdminCreatePartnerInput = z.infer<typeof adminCreatePartnerSchema>;
