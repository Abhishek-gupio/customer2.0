import { z } from "zod";

/** Indian mobile: 10 digits starting with 6–9, optional +91 prefix. */
const phoneSchema = z
  .string()
  .min(10, "Phone must be at least 10 digits")
  .max(14, "Phone too long")
  .regex(/^\+?91?[6-9]\d{9}$|^[6-9]\d{9}$/, "Invalid phone number");

export const signupSchema = z.object({
  phoneNumber: phoneSchema,
  email: z.string().email().optional().or(z.literal("")),
  fullName: z.string().max(200).optional(),
});

export const sendOtpSchema = z.object({
  phoneNumber: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phoneNumber: phoneSchema,
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must be numeric"),
});

export const loginSchema = z.object({
  phoneNumber: phoneSchema,
});

export const googleSignInSchema = z.object({
  idToken: z.string().min(1, "Google ID token is required"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;
