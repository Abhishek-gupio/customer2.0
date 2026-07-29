import { dbInstances, Prisma } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { notificationService } from "../../services/notification.service";
import { storageService } from "../../services/storage.service";
import type {
  CreateCommunityInput,
  DiscoverCommunitiesInput,
  CreatePostInput,
  FeedQueryInput,
  CreateCommentInput,
} from "./community.validators";

const HASHTAG_RE = /#([a-zA-Z0-9_]{2,40})/g;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function extractAndLinkHashtags(postId: string, text?: string | null) {
  if (!text) return;
  const tags = [...new Set([...text.matchAll(HASHTAG_RE)].map((m) => m[1]!.toLowerCase()))];
  if (tags.length === 0) return;

  for (const tag of tags) {
    const hashtag = await dbInstances.hashtag.upsert({
      where: { tag },
      create: { tag, postCount: 1 },
      update: { postCount: { increment: 1 } },
    });
    await dbInstances.postHashtag.create({ data: { postId, hashtagId: hashtag.id } }).catch(() => {
      // already linked (shouldn't happen for a brand-new post) — ignore duplicate
    });
  }
}

async function assertMembership(communityId: string, customerId: string) {
  const membership = await dbInstances.communityMembership.findUnique({
    where: { communityId_customerId: { communityId, customerId } },
  });
  if (!membership) {
    throw AppError.forbidden("Join this community before posting in it");
  }
}

function postAuthorSelect() {
  return { select: { id: true, fullName: true, profilePic: true } } as const;
}

async function transformAuthorPic<T extends { author: { profilePic: string | null } } | null>(item: T): Promise<T> {
  if (item && item.author && item.author.profilePic) {
    item.author.profilePic = await storageService.ensureReadableUrl(item.author.profilePic);
  }
  return item;
}

async function transformAuthorPics<T extends { author: { profilePic: string | null } }>(items: T[]): Promise<T[]> {
  return Promise.all(items.map((item) => transformAuthorPic(item)));
}

export const communityService = {
  // ── Communities ──

  async createCommunity(customerId: string, input: CreateCommunityInput) {
    const baseSlug = slugify(input.name);
    if (!baseSlug) throw AppError.badRequest("Community name must contain at least one letter or number");
    let slug = baseSlug;
    let suffix = 1;
    while (await dbInstances.community.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++suffix}`;
    }

    const community = await dbInstances.community.create({
      data: {
        slug,
        name: input.name,
        type: input.type,
        localKind: input.type === "LOCAL" ? input.localKind : null,
        description: input.description,
        createdBy: customerId,
      },
    });

    await dbInstances.communityMembership.create({
      data: { communityId: community.id, customerId, role: "ADMIN" },
    });
    await dbInstances.community.update({ where: { id: community.id }, data: { memberCount: 1 } });

    return community;
  },

  async discover(customerId: string, input: DiscoverCommunitiesInput) {
    const communities = await dbInstances.community.findMany({
      where: {
        ...(input.type ? { type: input.type } : {}),
        ...(input.q ? { name: { contains: input.q, mode: "insensitive" } } : {}),
        ...(input.cursor ? { id: { lt: input.cursor } } : {}),
      },
      orderBy: { memberCount: "desc" },
      take: input.limit,
    });

    const memberships = await dbInstances.communityMembership.findMany({
      where: { customerId, communityId: { in: communities.map((c) => c.id) } },
      select: { communityId: true },
    });
    const joined = new Set(memberships.map((m) => m.communityId));

    return communities.map((c) => ({ ...c, isMember: joined.has(c.id) }));
  },

  async getCommunity(customerId: string, communityId: string) {
    const community = await dbInstances.community.findUnique({ where: { id: communityId } });
    if (!community) throw AppError.notFound("Community not found");
    const membership = await dbInstances.communityMembership.findUnique({
      where: { communityId_customerId: { communityId, customerId } },
    });
    return { ...community, isMember: !!membership, role: membership?.role ?? null };
  },

  async join(customerId: string, communityId: string) {
    const community = await dbInstances.community.findUnique({ where: { id: communityId } });
    if (!community) throw AppError.notFound("Community not found");

    const existing = await dbInstances.communityMembership.findUnique({
      where: { communityId_customerId: { communityId, customerId } },
    });
    if (existing) return existing;

    const membership = await dbInstances.communityMembership.create({
      data: { communityId, customerId, role: "MEMBER" },
    });
    await dbInstances.community.update({ where: { id: communityId }, data: { memberCount: { increment: 1 } } });
    return membership;
  },

  async leave(customerId: string, communityId: string) {
    const membership = await dbInstances.communityMembership.findUnique({
      where: { communityId_customerId: { communityId, customerId } },
    });
    if (!membership) return;
    if (membership.role === "ADMIN") {
      const otherAdmins = await dbInstances.communityMembership.count({
        where: { communityId, role: "ADMIN", customerId: { not: customerId } },
      });
      if (otherAdmins === 0) {
        throw AppError.badRequest("You're the only admin — promote another member first");
      }
    }
    await dbInstances.communityMembership.delete({
      where: { communityId_customerId: { communityId, customerId } },
    });
    await dbInstances.community.update({ where: { id: communityId }, data: { memberCount: { decrement: 1 } } });
  },

  // ── Posts & feed ──

  async createPost(customerId: string, input: CreatePostInput, mediaUrls: string[] = []) {
    if (input.communityId) {
      await assertMembership(input.communityId, customerId);
    }
    if (input.type === "TEXT" && !input.text?.trim()) {
      throw AppError.badRequest("Post text is required");
    }
    if ((input.type === "IMAGE" || input.type === "VIDEO") && mediaUrls.length === 0) {
      throw AppError.badRequest("At least one media file is required");
    }
    if (input.type === "POLL" && (!input.pollOptions || input.pollOptions.length < 2)) {
      throw AppError.badRequest("A poll needs at least 2 options");
    }
    if (input.type === "LOCATION" && (input.latitude == null || input.longitude == null)) {
      throw AppError.badRequest("Location coordinates are required");
    }

    const post = await dbInstances.post.create({
      data: {
        authorId: customerId,
        communityId: input.communityId,
        vehicleId: input.vehicleId,
        type: input.type,
        text: input.text,
        mediaUrls,
        latitude: input.latitude,
        longitude: input.longitude,
        pollOptions: input.pollOptions
          ? input.pollOptions.map((label, i) => ({ id: String(i), label, voteCount: 0 }))
          : undefined,
      },
      include: { author: postAuthorSelect() },
    });

    await extractAndLinkHashtags(post.id, input.text);
    if (input.communityId) {
      await dbInstances.community.update({ where: { id: input.communityId }, data: { postCount: { increment: 1 } } });
    }

    return transformAuthorPic(post);
  },

  async getPost(postId: string) {
    const post = await dbInstances.post.findUnique({
      where: { id: postId },
      include: { author: postAuthorSelect(), community: { select: { id: true, name: true, slug: true } } },
    });
    if (!post || post.status !== "PUBLISHED") throw AppError.notFound("Post not found");
    return transformAuthorPic(post);
  },

  async deletePost(customerId: string, postId: string) {
    const post = await dbInstances.post.findUnique({ where: { id: postId } });
    if (!post) throw AppError.notFound("Post not found");
    if (post.authorId !== customerId) {
      if (post.communityId) {
        const membership = await dbInstances.communityMembership.findUnique({
          where: { communityId_customerId: { communityId: post.communityId, customerId } },
        });
        if (!membership || membership.role === "MEMBER") throw AppError.forbidden("You can't delete this post");
      } else {
        throw AppError.forbidden("You can't delete this post");
      }
    }
    await dbInstances.post.update({ where: { id: postId }, data: { status: "REMOVED" } });
  },

  /**
   * v1 ranking: (reactions×1 + comments×2 + shares×3) / (hours_since_post+2)^1.5,
   * computed with $queryRaw over a recent-post window. See
   * docs/gupio-community-platform-plan.md §8 for the Redis-backed version this
   * is meant to graduate into once write volume makes per-request scoring slow.
   */
  async getFeed(customerId: string, input: FeedQueryInput) {
    if (input.feedType === "trending") {
      const communityFilter = input.communityId
        ? Prisma.sql`AND "communityId" = ${input.communityId}`
        : Prisma.empty;
      const rows = await dbInstances.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "customer"."Post"
        WHERE "status" = 'PUBLISHED'
          AND "createdAt" > NOW() - INTERVAL '14 days'
          ${communityFilter}
        ORDER BY (
          ("reactionCount" * 1 + "commentCount" * 2 + "shareCount" * 3)::float
          / POWER(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600 + 2, 1.5)
        ) DESC
        LIMIT ${input.limit}
      `;
      const ids = rows.map((r) => r.id);
      const posts = await dbInstances.post.findMany({
        where: { id: { in: ids } },
        include: { author: postAuthorSelect(), community: { select: { id: true, name: true, slug: true } } },
      });
      const byId = new Map(posts.map((p) => [p.id, p]));
      const sorted = ids.map((id) => byId.get(id)).filter(Boolean) as any[];
      return transformAuthorPics(sorted);
    }

    if (input.feedType === "following") {
      const [follows, memberships] = await Promise.all([
        dbInstances.follow.findMany({ where: { followerId: customerId }, select: { followingId: true } }),
        dbInstances.communityMembership.findMany({ where: { customerId }, select: { communityId: true } }),
      ]);
      const authorIds = follows.map((f) => f.followingId);
      const communityIds = memberships.map((m) => m.communityId);
      if (authorIds.length === 0 && communityIds.length === 0) return [];

      const posts = await dbInstances.post.findMany({
        where: {
          status: "PUBLISHED",
          OR: [
            ...(authorIds.length ? [{ authorId: { in: authorIds } }] : []),
            ...(communityIds.length ? [{ communityId: { in: communityIds } }] : []),
          ],
          ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: { author: postAuthorSelect(), community: { select: { id: true, name: true, slug: true } } },
      });
      return transformAuthorPics(posts);
    }

    // latest
    const posts = await dbInstances.post.findMany({
      where: {
        status: "PUBLISHED",
        ...(input.communityId ? { communityId: input.communityId } : {}),
        ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      include: { author: postAuthorSelect(), community: { select: { id: true, name: true, slug: true } } },
    });
    return transformAuthorPics(posts);
  },

  async search(input: { q: string; limit: number }) {
    const [posts, communities] = await Promise.all([
      dbInstances.post.findMany({
        where: { status: "PUBLISHED", text: { contains: input.q, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: { author: postAuthorSelect() },
      }),
      dbInstances.community.findMany({
        where: { name: { contains: input.q, mode: "insensitive" } },
        take: input.limit,
      }),
    ]);
    return { posts, communities };
  },

  // ── Comments ──

  async createComment(customerId: string, postId: string, input: CreateCommentInput) {
    const post = await dbInstances.post.findUnique({ where: { id: postId } });
    if (!post || post.status !== "PUBLISHED") throw AppError.notFound("Post not found");
    if (!input.text?.trim() && !input.imageUrl) throw AppError.badRequest("Comment can't be empty");

    if (input.parentId) {
      const parent = await dbInstances.comment.findUnique({ where: { id: input.parentId } });
      if (!parent || parent.postId !== postId) throw AppError.notFound("Parent comment not found");
    }

    const comment = await dbInstances.comment.create({
      data: {
        postId,
        authorId: customerId,
        parentId: input.parentId,
        text: input.text,
        imageUrl: input.imageUrl,
      },
      include: { author: postAuthorSelect() },
    });

    await dbInstances.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });

    if (post.authorId !== customerId) {
      void notificationService.notifyCustomer(post.authorId, {
        title: "New comment on your post",
        body: comment.text ?? "Someone commented on your post",
        type: "COMMUNITY_COMMENT",
        link: `/community/posts/${postId}`,
        metadata: { postId, commentId: comment.id },
      });
    }

    return transformAuthorPic(comment);
  },

  async listComments(postId: string) {
    const post = await dbInstances.post.findUnique({ where: { id: postId } });
    if (!post) throw AppError.notFound("Post not found");
    const comments = await dbInstances.comment.findMany({
      where: { postId, status: "PUBLISHED" },
      orderBy: { createdAt: "asc" },
      include: { author: postAuthorSelect() },
    });
    return transformAuthorPics(comments);
  },

  // ── Reactions ──

  async reactToPost(customerId: string, postId: string, emoji: string) {
    const post = await dbInstances.post.findUnique({ where: { id: postId } });
    if (!post || post.status !== "PUBLISHED") throw AppError.notFound("Post not found");

    // Prisma's compound-unique findUnique rejects an explicit null for a
    // nullable key member, so the one-reaction-per-post lookup goes through
    // findFirst instead (real DB-level enforcement is the partial unique
    // indexes noted on the Reaction model in schema.prisma).
    const existing = await dbInstances.reaction.findFirst({
      where: { customerId, postId, commentId: null },
    });
    if (existing) {
      if (existing.emoji === emoji) {
        await dbInstances.reaction.delete({ where: { id: existing.id } });
        await dbInstances.post.update({ where: { id: postId }, data: { reactionCount: { decrement: 1 } } });
        return { removed: true };
      }
      const updated = await dbInstances.reaction.update({ where: { id: existing.id }, data: { emoji } });
      return updated;
    }

    const reaction = await dbInstances.reaction.create({ data: { customerId, postId, emoji } });
    await dbInstances.post.update({ where: { id: postId }, data: { reactionCount: { increment: 1 } } });
    return reaction;
  },

  async reactToComment(customerId: string, commentId: string, emoji: string) {
    const comment = await dbInstances.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.status !== "PUBLISHED") throw AppError.notFound("Comment not found");

    const existing = await dbInstances.reaction.findFirst({
      where: { customerId, postId: null, commentId },
    });
    if (existing) {
      if (existing.emoji === emoji) {
        await dbInstances.reaction.delete({ where: { id: existing.id } });
        await dbInstances.comment.update({ where: { id: commentId }, data: { reactionCount: { decrement: 1 } } });
        return { removed: true };
      }
      const updated = await dbInstances.reaction.update({ where: { id: existing.id }, data: { emoji } });
      return updated;
    }

    const reaction = await dbInstances.reaction.create({ data: { customerId, commentId, emoji } });
    await dbInstances.comment.update({ where: { id: commentId }, data: { reactionCount: { increment: 1 } } });
    return reaction;
  },

  // ── Follow ──

  async follow(customerId: string, targetId: string) {
    if (customerId === targetId) throw AppError.badRequest("You can't follow yourself");
    const target = await dbInstances.customer.findUnique({ where: { id: targetId } });
    if (!target) throw AppError.notFound("Customer not found");
    return dbInstances.follow.upsert({
      where: { followerId_followingId: { followerId: customerId, followingId: targetId } },
      create: { followerId: customerId, followingId: targetId },
      update: {},
    });
  },

  async unfollow(customerId: string, targetId: string) {
    await dbInstances.follow.deleteMany({ where: { followerId: customerId, followingId: targetId } });
  },

  // ── Moderation ──

  async report(customerId: string, input: { targetType: "POST" | "COMMENT"; targetId: string; reason: string }) {
    if (input.targetType === "POST") {
      const post = await dbInstances.post.findUnique({ where: { id: input.targetId } });
      if (!post) throw AppError.notFound("Post not found");
    } else {
      const comment = await dbInstances.comment.findUnique({ where: { id: input.targetId } });
      if (!comment) throw AppError.notFound("Comment not found");
    }
    return dbInstances.contentReport.create({
      data: {
        reporterId: customerId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
      },
    });
  },

  // ── Admin-facing (mounted under adminAuthMiddleware in modules/admin) ──

  async adminListReports(status?: string) {
    return dbInstances.contentReport.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: "desc" },
      include: { reporter: { select: { id: true, fullName: true, phoneNumber: true } } },
    });
  },

  async adminResolveReport(reportId: string, status: "REVIEWED" | "DISMISSED" | "ACTIONED") {
    return dbInstances.contentReport.update({
      where: { id: reportId },
      data: { status, resolvedAt: new Date() },
    });
  },

  async adminAnalytics() {
    const [totalCommunities, totalPosts, totalComments, pendingReports] = await Promise.all([
      dbInstances.community.count(),
      dbInstances.post.count({ where: { status: "PUBLISHED" } }),
      dbInstances.comment.count({ where: { status: "PUBLISHED" } }),
      dbInstances.contentReport.count({ where: { status: "PENDING" } }),
    ]);
    return { totalCommunities, totalPosts, totalComments, pendingReports };
  },
};
