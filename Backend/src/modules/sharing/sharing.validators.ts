import { z } from "zod";

export const shareVehicleSchema = z.object({
    vehicleId: z.string().min(1, "Vehicle ID is required"),
    phoneNumber: z.string().min(10, "Valid phone number is required"),
    role: z.enum(["VIEWER", "EDITOR"]).default("VIEWER"),
});

export type ShareVehicleInput = z.infer<typeof shareVehicleSchema>;
