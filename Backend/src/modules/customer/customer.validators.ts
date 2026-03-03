import { z } from "zod";

export const updateProfileSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  fullName: z.string().max(200).optional(),
  profilePic: z.string().optional().or(z.literal("")),
});

export const registerDeviceSchema = z.object({
  platform: z.enum(["ios", "android"]),
  deviceToken: z.string().optional(),
  deviceInfo: z.string().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
