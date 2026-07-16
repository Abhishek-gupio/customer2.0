import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { storageService } from "../../services/storage.service";
import { communityService } from "./community.service";
import {
  createCommunitySchema,
  discoverCommunitiesSchema,
  createPostSchema,
  feedQuerySchema,
  createCommentSchema,
  reactionSchema,
  reportSchema,
  searchQuerySchema,
} from "./community.validators";

function parseInput<T>(
  raw: unknown,
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      data?: T;
      error?: { issues: { message: string }[] };
    };
  },
): T {
  const result = schema.safeParse(raw);
  if (!result.success && result.error) {
    const first = result.error.issues[0]?.message ?? "Validation failed";
    throw AppError.badRequest(first);
  }
  return result.data!;
}

export const communityController = {
  createCommunity: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, createCommunitySchema);
    const community = await communityService.createCommunity(req.customer.id, body);
    success(res, community, 201);
  }),

  discover: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const query = parseInput(req.query, discoverCommunitiesSchema);
    const communities = await communityService.discover(req.customer.id, query);
    success(res, communities);
  }),

  getCommunity: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const community = await communityService.getCommunity(req.customer.id, req.params.id as string);
    success(res, community);
  }),

  join: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const membership = await communityService.join(req.customer.id, req.params.id as string);
    success(res, membership, 201);
  }),

  leave: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    await communityService.leave(req.customer.id, req.params.id as string);
    success(res, { ok: true });
  }),

  createPost: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, createPostSchema);

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length > 5) throw AppError.badRequest("Maximum 5 media files per post");
    const mediaUrls = await Promise.all(
      files.map(async (file) => (await storageService.uploadFile(file, "community", true)).url),
    );

    const post = await communityService.createPost(req.customer.id, body, mediaUrls);
    success(res, post, 201);
  }),

  getFeed: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const query = parseInput(req.query, feedQuerySchema);
    const feed = await communityService.getFeed(req.customer.id, query);
    success(res, feed);
  }),

  getPost: asyncHandler(async (req: Request, res: Response) => {
    const post = await communityService.getPost(req.params.id as string);
    success(res, post);
  }),

  deletePost: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    await communityService.deletePost(req.customer.id, req.params.id as string);
    success(res, { ok: true });
  }),

  search: asyncHandler(async (req: Request, res: Response) => {
    const query = parseInput(req.query, searchQuerySchema);
    const results = await communityService.search(query);
    success(res, results);
  }),

  createComment: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, createCommentSchema);
    const comment = await communityService.createComment(req.customer.id, req.params.id as string, body);
    success(res, comment, 201);
  }),

  listComments: asyncHandler(async (req: Request, res: Response) => {
    const comments = await communityService.listComments(req.params.id as string);
    success(res, comments);
  }),

  reactToPost: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, reactionSchema);
    const result = await communityService.reactToPost(req.customer.id, req.params.id as string, body.emoji);
    success(res, result);
  }),

  reactToComment: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, reactionSchema);
    const result = await communityService.reactToComment(req.customer.id, req.params.id as string, body.emoji);
    success(res, result);
  }),

  follow: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const follow = await communityService.follow(req.customer.id, req.params.customerId as string);
    success(res, follow, 201);
  }),

  unfollow: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    await communityService.unfollow(req.customer.id, req.params.customerId as string);
    success(res, { ok: true });
  }),

  report: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, reportSchema);
    const report = await communityService.report(req.customer.id, body);
    success(res, report, 201);
  }),
};
