import { z } from "zod";

export const addVehicleSchema = z.object({
  registrationNumber: z
    .string()
    .min(4)
    .max(20)
    .transform((v) => v.toUpperCase().replace(/\s/g, "")),
  make: z.string().optional(),
  model: z.string().optional(),
  variant: z.string().optional(),
  year: z.coerce
    .number()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),
  fuelType: z.preprocess(
    (val) => (typeof val === "string" ? val.toUpperCase() : val),
    z.enum(["PETROL", "DIESEL", "CNG", "EV", "HYBRID", "OTHER"])
  ).optional(),
  vehicleType: z.preprocess(
    (val) => (typeof val === "string" ? val.toUpperCase() : val),
    z.enum(["LUV", "SUV", "SEDAN", "BIKE", "HATCHBACK", "TRUCK", "CAR", "MOTORCYCLE"])
  ).optional(),
  engineNumber: z.string().optional(),
  chassisNumber: z.string().optional(),
  registrationDate: z.coerce.date().optional(),
  currentOdometer: z.coerce.number().min(0).optional(),
  ownerName: z.string().optional(),
  rto: z.string().optional(),
  vehicleClass: z.string().optional(),
  fuelNorms: z.string().optional(),
  rcStatus: z.string().optional(),
  unloadedWeight: z.string().optional(),
  fitnessUpto: z.string().optional(),
  insuranceUpto: z.string().optional(),
  pollutionUpto: z.string().optional(),
  mileage: z.string().optional(),
  brand: z.string().optional(),
  color: z.string().optional(),
  seatingCapacity: z.string().optional(),
  cylinderCount: z.string().optional(),
  cubicCapacity: z.string().optional(),
  grossWeight: z.string().optional(),
  bodyType: z.string().optional(),
  ownerAddress: z.string().optional(),
});

export const updateVehicleSchema = addVehicleSchema.partial();

export const addOdometerSchema = z.object({
  reading: z.coerce.number().min(0),
  date: z.coerce.date().default(() => new Date()),
});

export type AddVehicleInput = z.infer<typeof addVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type AddOdometerInput = z.infer<typeof addOdometerSchema>;
