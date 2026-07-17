import { z } from "zod";

export const createOrderSchema = z.object({
  purpose: z.enum(["PARKING_BOOKING", "CAR_WASH_BOOKING"]),
  referenceId: z.string().min(1),
  amountPaise: z.coerce.number().int().positive(),
});

export const verifyOrderSchema = z.object({
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyOrderInput = z.infer<typeof verifyOrderSchema>;
