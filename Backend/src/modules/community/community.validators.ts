import { z } from "zod";

export const createCommunitySchema = z.object({
  name: z.string().min(3).max(80),
  type: z.enum(["TOPIC", "LOCAL"]),
  localKind: z.enum(["CITY", "DISTRICT", "COLLEGE", "COMPANY", "APARTMENT", "HIGHWAY", "PARKING_AREA"]).optional(),
  description: z.string().max(500).optional(),
});

export const discoverCommunitiesSchema = z.object({
  type: z.enum(["TOPIC", "LOCAL"]).optional(),
  q: z.string().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createPostSchema = z.object({
  communityId: z.string().min(1).optional(),
  vehicleId: z.string().min(1).optional(),
  type: z.enum(["TEXT", "IMAGE", "VIDEO", "POLL", "QUESTION", "LOCATION"]).default("TEXT"),
  text: z.string().max(3000).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  pollOptions: z.array(z.string().min(1).max(80)).min(2).max(6).optional(),
});

export const feedQuerySchema = z.object({
  feedType: z.enum(["following", "trending", "latest"]).default("latest"),
  communityId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createCommentSchema = z.object({
  text: z.string().min(1).max(1000).optional(),
  imageUrl: z.string().url().optional(),
  parentId: z.string().min(1).optional(),
});

export const reactionSchema = z.object({
  emoji: z.enum(["👍", "❤️", "😂", "😮", "😢", "🔥"]),
});

export const reportSchema = z.object({
  targetType: z.enum(["POST", "COMMENT"]),
  targetId: z.string().min(1),
  reason: z.string().min(3).max(500),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type DiscoverCommunitiesInput = z.infer<typeof discoverCommunitiesSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type FeedQueryInput = z.infer<typeof feedQuerySchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
