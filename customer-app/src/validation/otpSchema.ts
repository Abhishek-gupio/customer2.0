import { z } from 'zod';

export const otpSchema = z.object({
  otp: z
    .string()
    .length(4, 'OTP must be 4 digits')
    .regex(/^\d{4}$/, 'OTP must be 4 digits'),
});
