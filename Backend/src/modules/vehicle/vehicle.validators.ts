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
  fuelType: z
    .enum(["PETROL", "DIESEL", "CNG", "EV", "HYBRID", "OTHER"])
    .optional(),
  vehicleType: z
    .enum(["LUV", "SUV", "SEDAN", "BIKE", "HATCHBACK", "TRUCK"])
    .optional(),
  engineNumber: z.string().optional(),
  chassisNumber: z.string().optional(),
  registrationDate: z.coerce.date().optional(),
  currentOdometer: z.coerce.number().min(0).optional(),
});

export const updateVehicleSchema = addVehicleSchema.partial();

export const addOdometerSchema = z.object({
  reading: z.coerce.number().min(0),
  date: z.coerce.date().default(() => new Date()),
});

export type AddVehicleInput = z.infer<typeof addVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type AddOdometerInput = z.infer<typeof addOdometerSchema>;
