import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { notificationService } from "../../services/notification.service";
import { getIO, isUserOnline } from "../../socket";
import type {
  CreateConversationInput,
  SendMessageInput,
  UpdateStatusInput,
} from "./messaging.validators";

/** Spam protection: max brand-new conversations one customer can start per day. */
const MAX_NEW_CONVERSATIONS_PER_DAY = 5;

export const QUICK_REPLIES: { key: string; label: string; category: string }[] = [
  { key: "move_vehicle", label: "Please move your vehicle", category: "PARKING" },
  { key: "found_belongings", label: "I found your belongings", category: "LOST_ITEM" },
  { key: "headlights_on", label: "Your headlights are on", category: "GENERAL" },
  { key: "blocking", label: "Your car is blocking me", category: "PARKING" },
  { key: "flat_tyre", label: "Flat tyre", category: "DAMAGE" },
  { key: "window_open", label: "Window is open", category: "SECURITY" },
  { key: "accident", label: "Accident", category: "EMERGENCY" },
  { key: "suspicious", label: "Suspicious activity", category: "SECURITY" },
];

function truncatePreview(input: SendMessageInput): string {
  if (input.type === "IMAGE") return "📷 Photo";
  if (input.type === "LOCATION") return "📍 Location";
  const text = input.text?.trim() ?? "";
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

async function assertNotBlockedOrSuspended(customerId: string, ownerId: string) {
  const [me, blocked] = await Promise.all([
    dbInstances.customer.findUnique({ where: { id: customerId }, select: { isSuspended: true } }),
    dbInstances.blockedContact.findUnique({
      where: { ownerId_blockedId: { ownerId, blockedId: customerId } },
    }),
  ]);
  if (me?.isSuspended) {
    throw AppError.forbidden("Your account is suspended from messaging");
  }
  if (blocked) {
    throw AppError.forbidden("You can no longer contact this vehicle's owner");
  }
}

function conversationRole(conversation: { customerId: string; ownerId: string }, userId: string): "OWNER" | "CUSTOMER" {
  return conversation.ownerId === userId ? "OWNER" : "CUSTOMER";
}

function otherPartyId(conversation: { customerId: string; ownerId: string }, userId: string): string {
  return conversation.ownerId === userId ? conversation.customerId : conversation.ownerId;
}

export const messagingService = {
  /** "Does conversation already exist? YES → open it. NO → create it." */
  async getOrCreateConversation(customerId: string, input: CreateConversationInput) {
    const vehicle = await dbInstances.customerVehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw AppError.notFound("Vehicle not found");
    const ownerId = vehicle.customerId;

    if (ownerId === customerId) {
      throw AppError.badRequest("You can't message yourself about your own vehicle");
    }

    const existing = await dbInstances.conversation.findUnique({
      where: { vehicleId_customerId: { vehicleId: input.vehicleId, customerId } },
    });
    if (existing) return existing;

    await assertNotBlockedOrSuspended(customerId, ownerId);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await dbInstances.conversation.count({
      where: { customerId, createdAt: { gte: since } },
    });
    if (recentCount >= MAX_NEW_CONVERSATIONS_PER_DAY) {
      throw AppError.tooManyRequests(
        `You've started ${MAX_NEW_CONVERSATIONS_PER_DAY} new conversations today — try again tomorrow`,
      );
    }

    return dbInstances.conversation.create({
      data: {
        vehicleId: input.vehicleId,
        customerId,
        ownerId,
        category: input.category ?? "GENERAL",
      },
    });
  },

  /** Unified inbox — satisfies both "Owner Inbox" and "Customer Inbox" from one query, labelled per row by role. */
  async listMyConversations(userId: string) {
    const conversations = await dbInstances.conversation.findMany({
      where: { OR: [{ customerId: userId }, { ownerId: userId }] },
      orderBy: { updatedAt: "desc" },
      include: {
        vehicle: { select: { registrationNumber: true, make: true, model: true, imageUrl: true } },
        customer: { select: { id: true, fullName: true, profilePic: true } },
        owner: { select: { id: true, fullName: true, profilePic: true } },
      },
    });

    return conversations.map((c) => {
      const role = conversationRole(c, userId);
      const other = role === "OWNER" ? c.customer : c.owner;
      return {
        id: c.id,
        vehicle: c.vehicle,
        role,
        otherParty: { id: other.id, name: other.fullName, profilePic: other.profilePic, online: isUserOnline(other.id) },
        category: c.category,
        priority: c.priority,
        status: c.status,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        unreadCount: role === "OWNER" ? c.unreadCountOwner : c.unreadCountCustomer,
        updatedAt: c.updatedAt,
      };
    });
  },

  async getConversation(userId: string, conversationId: string, cursor?: string, limit = 50) {
    const conversation = await dbInstances.conversation.findUnique({
      where: { id: conversationId },
      include: {
        vehicle: { select: { registrationNumber: true, make: true, model: true, imageUrl: true } },
        customer: { select: { id: true, fullName: true, profilePic: true } },
        owner: { select: { id: true, fullName: true, profilePic: true } },
      },
    });
    if (!conversation || (conversation.customerId !== userId && conversation.ownerId !== userId)) {
      throw AppError.notFound("Conversation not found");
    }

    const messages = await dbInstances.message.findMany({
      where: { conversationId, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });

    const role = conversationRole(conversation, userId);
    const other = role === "OWNER" ? conversation.customer : conversation.owner;

    return {
      id: conversation.id,
      vehicle: conversation.vehicle,
      role,
      otherParty: { id: other.id, name: other.fullName, profilePic: other.profilePic, online: isUserOnline(other.id) },
      category: conversation.category,
      priority: conversation.priority,
      status: conversation.status,
      messages: messages.reverse(),
    };
  },

  async updateStatus(userId: string, conversationId: string, input: UpdateStatusInput) {
    const conversation = await dbInstances.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || (conversation.customerId !== userId && conversation.ownerId !== userId)) {
      throw AppError.notFound("Conversation not found");
    }
    const updated = await dbInstances.conversation.update({
      where: { id: conversationId },
      data: { status: input.status },
    });
    getIO().to(otherPartyId(conversation, userId)).emit("conversation_status_changed", {
      conversationId,
      status: input.status,
    });
    return updated;
  },

  async sendMessage(userId: string, conversationId: string, input: SendMessageInput, imageUrls: string[] = []) {
    const conversation = await dbInstances.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || (conversation.customerId !== userId && conversation.ownerId !== userId)) {
      throw AppError.notFound("Conversation not found");
    }
    if (conversation.status === "CLOSED") {
      throw AppError.badRequest("This conversation is closed");
    }
    if (input.type === "TEXT" && !input.text?.trim()) {
      throw AppError.badRequest("Message text is required");
    }
    if (input.type === "IMAGE" && imageUrls.length === 0) {
      throw AppError.badRequest("At least one photo is required");
    }
    if (input.type === "LOCATION" && (input.latitude == null || input.longitude == null)) {
      throw AppError.badRequest("Location coordinates are required");
    }

    const role = conversationRole(conversation, userId);
    const receiverId = otherPartyId(conversation, userId);
    const preview = truncatePreview(input);

    const message = await dbInstances.message.create({
      data: {
        conversationId,
        senderId: userId,
        receiverId,
        type: input.type,
        text: input.text,
        imageUrls,
        latitude: input.latitude,
        longitude: input.longitude,
        quickReplyKey: input.quickReplyKey,
      },
    });

    // CLOSED is already rejected above, so any message always reopens the
    // conversation into "waiting on the other party" — including from RESOLVED.
    const nextStatus = role === "OWNER" ? "WAITING_FOR_CUSTOMER" : "WAITING_FOR_OWNER";

    await dbInstances.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: preview,
        lastMessageAt: message.createdAt,
        lastSenderId: userId,
        status: nextStatus,
        priority: input.priority ?? conversation.priority,
        ...(role === "OWNER"
          ? { unreadCountCustomer: { increment: 1 } }
          : { unreadCountOwner: { increment: 1 } }),
      },
    });

    try {
      getIO().to(receiverId).emit("new_message", { conversationId, message });
    } catch (err) {
      logger.error({ err, conversationId }, "Failed to emit new_message socket event");
    }

    const title = role === "OWNER" ? "Vehicle owner replied" : "Someone sent you a message regarding your vehicle";
    void notificationService.notifyCustomer(receiverId, {
      title,
      body: preview || "New message",
      type: "VEHICLE_MESSAGE",
      link: `/messaging/conversations/${conversationId}`,
      metadata: { conversationId },
    });

    return message;
  },

  async markRead(userId: string, conversationId: string) {
    const conversation = await dbInstances.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || (conversation.customerId !== userId && conversation.ownerId !== userId)) {
      throw AppError.notFound("Conversation not found");
    }
    const now = new Date();
    await dbInstances.message.updateMany({
      where: { conversationId, receiverId: userId, isRead: false },
      data: { isRead: true, readAt: now },
    });
    const role = conversationRole(conversation, userId);
    await dbInstances.conversation.update({
      where: { id: conversationId },
      data: role === "OWNER" ? { unreadCountOwner: 0 } : { unreadCountCustomer: 0 },
    });
    getIO().to(otherPartyId(conversation, userId)).emit("message_read", { conversationId, readAt: now });
  },

  async markDelivered(userId: string, conversationId: string) {
    const conversation = await dbInstances.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || (conversation.customerId !== userId && conversation.ownerId !== userId)) {
      throw AppError.notFound("Conversation not found");
    }
    const now = new Date();
    await dbInstances.message.updateMany({
      where: { conversationId, receiverId: userId, deliveredAt: null },
      data: { deliveredAt: now },
    });
    getIO().to(otherPartyId(conversation, userId)).emit("message_delivered", { conversationId, deliveredAt: now });
  },

  async addReaction(userId: string, messageId: string, emoji: string) {
    const message = await dbInstances.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!message) throw AppError.notFound("Message not found");
    const { conversation } = message;
    if (conversation.customerId !== userId && conversation.ownerId !== userId) {
      throw AppError.notFound("Message not found");
    }
    const updated = await dbInstances.message.update({ where: { id: messageId }, data: { reaction: emoji } });
    getIO().to(otherPartyId(conversation, userId)).emit("message_reaction", { messageId, emoji });
    return updated;
  },

  async reportConversation(userId: string, conversationId: string, reason: string) {
    const conversation = await dbInstances.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || (conversation.customerId !== userId && conversation.ownerId !== userId)) {
      throw AppError.notFound("Conversation not found");
    }
    return dbInstances.conversationReport.create({
      data: {
        conversationId,
        reporterId: userId,
        reportedId: otherPartyId(conversation, userId),
        reason,
      },
    });
  },

  async blockContact(ownerId: string, blockedId: string, reason?: string) {
    if (ownerId === blockedId) throw AppError.badRequest("You can't block yourself");
    return dbInstances.blockedContact.upsert({
      where: { ownerId_blockedId: { ownerId, blockedId } },
      create: { ownerId, blockedId, reason },
      update: { reason },
    });
  },

  async unblockContact(ownerId: string, blockedId: string) {
    await dbInstances.blockedContact.deleteMany({ where: { ownerId, blockedId } });
  },

  async listBlocked(ownerId: string) {
    return dbInstances.blockedContact.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" } });
  },

  listQuickReplies() {
    return QUICK_REPLIES;
  },

  /** BullMQ sweep job — see jobs/workers.ts. No delayed-per-record job needed. */
  async autoCloseIdleConversations() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await dbInstances.conversation.updateMany({
      where: {
        status: { notIn: ["CLOSED"] },
        OR: [{ lastMessageAt: { lt: cutoff } }, { lastMessageAt: null, createdAt: { lt: cutoff } }],
      },
      data: { status: "CLOSED" },
    });
    if (result.count > 0) {
      logger.info({ count: result.count }, "Auto-closed idle vehicle-message conversations");
    }
    return result.count;
  },

  // ── Admin-facing (mounted under adminAuthMiddleware in modules/admin) ──

  async adminListReports(status?: string) {
    return dbInstances.conversationReport.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: "desc" },
      include: { conversation: { include: { vehicle: { select: { registrationNumber: true } } } } },
    });
  },

  async adminResolveReport(reportId: string, status: "REVIEWED" | "DISMISSED" | "ACTIONED") {
    return dbInstances.conversationReport.update({
      where: { id: reportId },
      data: { status, resolvedAt: new Date() },
    });
  },

  async adminListConversations(params: { page?: number; limit?: number }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const [data, total] = await Promise.all([
      dbInstances.conversation.findMany({
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          vehicle: { select: { registrationNumber: true } },
          customer: { select: { fullName: true, phoneNumber: true } },
          owner: { select: { fullName: true, phoneNumber: true } },
          _count: { select: { messages: true, reports: true } },
        },
      }),
      dbInstances.conversation.count(),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async adminDeleteConversation(conversationId: string) {
    await dbInstances.conversation.delete({ where: { id: conversationId } });
  },

  async adminSuspendCustomer(customerId: string, reason: string) {
    return dbInstances.customer.update({
      where: { id: customerId },
      data: { isSuspended: true, suspendedReason: reason, suspendedAt: new Date() },
    });
  },

  async adminUnsuspendCustomer(customerId: string) {
    return dbInstances.customer.update({
      where: { id: customerId },
      data: { isSuspended: false, suspendedReason: null, suspendedAt: null },
    });
  },

  async adminAnalytics() {
    const [totalConversations, totalMessages, resolvedOrClosed, pendingReports, mostReportedRaw, activeToday] =
      await Promise.all([
        dbInstances.conversation.count(),
        dbInstances.message.count(),
        dbInstances.conversation.count({ where: { status: { in: ["RESOLVED", "CLOSED"] } } }),
        dbInstances.conversationReport.count({ where: { status: "PENDING" } }),
        dbInstances.conversationReport.groupBy({
          by: ["conversationId"],
          _count: { conversationId: true },
          orderBy: { _count: { conversationId: "desc" } },
          take: 5,
        }),
        dbInstances.message.findMany({
          where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          select: { conversationId: true },
          distinct: ["conversationId"],
        }),
      ]);

    // Average first-owner-response time: time from conversation creation to the owner's first message,
    // sampled over the most recent conversations that have at least one message.
    const recentConversations = await dbInstances.conversation.findMany({
      where: { messages: { some: {} } },
      select: { id: true, createdAt: true, ownerId: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    let avgResponseMs: number | null = null;
    if (recentConversations.length > 0) {
      const samples = await Promise.all(
        recentConversations.map(async (c) => {
          const firstOwnerMsg = await dbInstances.message.findFirst({
            where: { conversationId: c.id, senderId: c.ownerId },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          });
          return firstOwnerMsg ? firstOwnerMsg.createdAt.getTime() - c.createdAt.getTime() : null;
        }),
      );
      const valid = samples.filter((s): s is number => s != null && s >= 0);
      avgResponseMs = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    }

    return {
      totalConversations,
      totalMessages,
      resolutionRate: totalConversations > 0 ? resolvedOrClosed / totalConversations : 0,
      pendingReports,
      dailyActiveConversations: activeToday.length,
      avgOwnerResponseTimeMinutes: avgResponseMs != null ? Math.round(avgResponseMs / 60000) : null,
      mostReportedConversationIds: mostReportedRaw.map((r) => ({
        conversationId: r.conversationId,
        reportCount: r._count.conversationId,
      })),
    };
  },
};
