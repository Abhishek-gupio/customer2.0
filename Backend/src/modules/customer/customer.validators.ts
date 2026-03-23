import { z } from "zod";

export const updateProfileSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  fullName: z.string().max(200).refine((val) => val === undefined || !/^\d+$/.test(val.trim()), { message: "Full name cannot contain only numbers" }).optional(),
  profilePic: z.string().optional().or(z.literal("")),
  phoneNumber: z.string().length(10, 'Phone number must be exactly 10 digits').regex(/^\d{10}$/, 'Phone number must contain only numbers').optional(),
});

export const registerDeviceSchema = z.object({
  platform: z.enum(["ios", "android"]),
  deviceToken: z.string().optional(),
  deviceInfo: z.string().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
