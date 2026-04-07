import { z } from "zod";

/**
 * TRIP EXPENSE VALIDATORS
 * Validates input for trip expense calculation endpoints.
 */

export const calculateTripExpenseSchema = z.object({
  from: z
    .string()
    .min(2, "Origin location is required (e.g. 'Mysuru, Karnataka')")
    .max(500),
  to: z
    .string()
    .min(2, "Destination location is required (e.g. 'Kochi, Kerala')")
    .max(500),
  waypoints: z.array(z.string().min(2).max(500)).max(10).optional(),
  vehicleId: z.string().optional(),
  vehicleType: z
    .enum(["CAR", "SUV", "SEDAN", "HATCHBACK", "BIKE", "MOTORCYCLE", "SCOOTER", "TRUCK", "BUS", "AUTO"])
    .optional(),
  fuelType: z
    .enum(["PETROL", "DIESEL", "CNG", "ELECTRIC"])
    .optional(),
  fuelEfficiency: z
    .object({
      city: z.number().min(1).max(100),
      hwy: z.number().min(1).max(100),
    })
    .optional(),
});

export type CalculateTripExpenseInput = z.infer<typeof calculateTripExpenseSchema>;
