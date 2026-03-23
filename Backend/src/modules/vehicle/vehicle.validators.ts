import { z } from "zod";

/** JSON clients often send `null`; Zod's `.optional()` only allows `undefined`. */
const jsonOptionalString = z.preprocess(
  (v) => (v === null ? undefined : v),
  z.string().optional(),
);

export const addVehicleSchema = z.object({
  registrationNumber: z
    .string()
    .min(4)
    .max(20)
    .transform((v) => v.toUpperCase().replace(/\s/g, "")),
  make: jsonOptionalString,
  model: jsonOptionalString,
  variant: jsonOptionalString,
  year: z.preprocess(
    (v) => (v === null ? undefined : v),
    z.coerce
      .number()
      .min(1900)
      .max(new Date().getFullYear() + 1)
      .optional(),
  ),
  fuelType: z.preprocess(
    (val) => {
      if (val === null || val === undefined) return undefined;
      return typeof val === "string" ? val.toUpperCase() : val;
    },
    z.enum(["PETROL", "DIESEL", "CNG", "EV", "HYBRID", "OTHER"]).optional(),
  ),
  vehicleType: z.preprocess(
    (val) => {
      if (val === null || val === undefined) return undefined;
      return typeof val === "string" ? val.toUpperCase() : val;
    },
    z
      .enum([
        "LUV",
        "SUV",
        "SEDAN",
        "BIKE",
        "HATCHBACK",
        "TRUCK",
        "CAR",
        "MOTORCYCLE",
      ])
      .optional(),
  ),
  engineNumber: jsonOptionalString,
  chassisNumber: jsonOptionalString,
  registrationDate: z.preprocess(
    (v) => (v === null ? undefined : v),
    z.coerce.date().optional(),
  ),
  currentOdometer: z.preprocess(
    (v) => (v === null ? undefined : v),
    z.coerce.number().min(0).optional(),
  ),
  ownerName: jsonOptionalString,
  rto: jsonOptionalString,
  vehicleClass: jsonOptionalString,
  fuelNorms: jsonOptionalString,
  rcStatus: jsonOptionalString,
  unloadedWeight: jsonOptionalString,
  fitnessUpto: jsonOptionalString,
  insuranceUpto: jsonOptionalString,
  pollutionUpto: jsonOptionalString,
  mileage: jsonOptionalString,
  brand: jsonOptionalString,
  color: jsonOptionalString,
  seatingCapacity: jsonOptionalString,
  cylinderCount: jsonOptionalString,
  cubicCapacity: jsonOptionalString,
  grossWeight: jsonOptionalString,
  bodyType: jsonOptionalString,
  ownerAddress: jsonOptionalString,
});

export const updateVehicleSchema = addVehicleSchema.partial();

export const addOdometerSchema = z.object({
  reading: z.coerce.number().min(0),
  date: z.coerce.date().default(() => new Date()),
});

export type AddVehicleInput = z.infer<typeof addVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type AddOdometerInput = z.infer<typeof addOdometerSchema>;
