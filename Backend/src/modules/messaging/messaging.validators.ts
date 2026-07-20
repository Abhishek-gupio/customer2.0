import { z } from "zod";

export const createConversationSchema = z.object({
  vehicleId: z.string().min(1),
  category: z.enum(["PARKING", "EMERGENCY", "DAMAGE", "LOST_ITEM", "SECURITY", "GENERAL"]).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["RESOLVED", "CLOSED", "OPEN"]),
});

export const sendMessageSchema = z.object({
  type: z.enum(["TEXT", "IMAGE", "LOCATION"]).default("TEXT"),
  text: z.string().max(2000).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  priority: z.enum(["NORMAL", "URGENT", "EMERGENCY"]).optional(),
  quickReplyKey: z.string().optional(),
});

export const reactionSchema = z.object({
  emoji: z.enum(["👍", "🙏", "✅", "❤️"]),
});

export const reportConversationSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const blockContactSchema = z.object({
  customerId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
export type ReportConversationInput = z.infer<typeof reportConversationSchema>;
export type BlockContactInput = z.infer<typeof blockContactSchema>;
