import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Email or phone is required')
    .refine(
      (val) => {
        // Simple email or phone check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\d{10}$/;
        return emailRegex.test(val) || phoneRegex.test(val);
      },
      {
        message: 'Enter a valid email or 10-digit phone number',
      }
    ),
});
