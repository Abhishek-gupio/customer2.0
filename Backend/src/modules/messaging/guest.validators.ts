import { z } from "zod";

export const submitGuestMessageSchema = z.object({
  guestName: z.string().max(80).optional(),
  guestContact: z.string().max(120).optional(),
  text: z.string().max(2000).optional(),
  guestToken: z.string().optional(),
});

export const ownerReplySchema = z.object({
  text: z.string().min(1).max(2000),
});

export const ownerGuestStatusSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "CLOSED"]),
});

export type SubmitGuestMessageInput = z.infer<typeof submitGuestMessageSchema>;
export type OwnerReplyInput = z.infer<typeof ownerReplySchema>;
export type OwnerGuestStatusInput = z.infer<typeof ownerGuestStatusSchema>;
