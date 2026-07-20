import { randomBytes } from "crypto";
import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { notificationService } from "../../services/notification.service";
import { getIO } from "../../socket";

function generateGuestToken(): string {
  return randomBytes(20).toString("base64url");
}

function truncate(text: string | undefined): string {
  const t = (text ?? "").trim();
  return t.length > 140 ? `${t.slice(0, 140)}…` : t;
}

async function resolveVehicleAndOwner(vehicleQrToken: string) {
  const qrToken = await dbInstances.vehicleQrToken.findUnique({
    where: { token: vehicleQrToken },
    include: {
      vehicle: {
        select: {
          id: true,
          registrationNumber: true,
          make: true,
          model: true,
          color: true,
          imageUrl: true,
          customerId: true,
        },
      },
    },
  });
  if (!qrToken) throw AppError.notFound("This QR code isn't linked to a vehicle");
  return qrToken.vehicle;
}

export const guestService = {
  /** Public — what the anonymous web page shows. Never the owner's name, phone, or email. */
  async resolveForGuest(vehicleQrToken: string) {
    const vehicle = await resolveVehicleAndOwner(vehicleQrToken);
    return {
      vehicleId: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      color: vehicle.color,
      imageUrl: vehicle.imageUrl,
    };
  },

  /**
   * First call from a guest has no `existingGuestToken` — a new GuestConversation
   * is created and its token returned for the browser to store (localStorage) and
   * send back on every later call, so replies land in the same thread.
   */
  async submitMessage(
    vehicleQrToken: string,
    input: { guestName?: string; guestContact?: string; text?: string; imageUrls?: string[] },
    existingGuestToken?: string,
  ) {
    if (!input.text?.trim() && (!input.imageUrls || input.imageUrls.length === 0)) {
      throw AppError.badRequest("Message text or a photo is required");
    }

    let conversation = existingGuestToken
      ? await dbInstances.guestConversation.findUnique({ where: { guestToken: existingGuestToken } })
      : null;

    if (existingGuestToken && !conversation) {
      throw AppError.notFound("This conversation link is no longer valid");
    }

    if (!conversation) {
      const vehicle = await resolveVehicleAndOwner(vehicleQrToken);
      conversation = await dbInstances.guestConversation.create({
        data: {
          vehicleId: vehicle.id,
          ownerId: vehicle.customerId,
          guestToken: generateGuestToken(),
          guestName: input.guestName,
          guestContact: input.guestContact,
        },
      });
    } else if (conversation.status === "CLOSED") {
      throw AppError.badRequest("This conversation is closed");
    }

    const preview = input.imageUrls?.length ? "📷 Photo" : truncate(input.text);

    const entry = await dbInstances.guestMessageEntry.create({
      data: {
        conversationId: conversation.id,
        sender: "GUEST",
        text: input.text,
        imageUrls: input.imageUrls ?? [],
      },
    });

    await dbInstances.guestConversation.update({
      where: { id: conversation.id },
      data: { lastMessage: preview, lastMessageAt: entry.createdAt, status: "OPEN" },
    });

    try {
      getIO().to(conversation.ownerId).emit("new_guest_message", { conversationId: conversation.id, entry });
    } catch (err) {
      logger.error({ err, conversationId: conversation.id }, "Failed to emit new_guest_message socket event");
    }

    void notificationService.notifyCustomer(conversation.ownerId, {
      title: "Someone messaged you about your vehicle",
      body: preview || "New message",
      type: "VEHICLE_GUEST_MESSAGE",
      link: `/messaging/guest-conversations/${conversation.id}`,
      metadata: { guestConversationId: conversation.id },
    });

    return { guestToken: conversation.guestToken, entry };
  },

  /** Public — lets the guest's browser revisit the thread and see any owner reply. */
  async getByGuestToken(guestToken: string) {
    const conversation = await dbInstances.guestConversation.findUnique({
      where: { guestToken },
      include: {
        vehicle: { select: { registrationNumber: true, make: true, model: true, imageUrl: true } },
        entries: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!conversation) throw AppError.notFound("This conversation link is no longer valid");
    return conversation;
  },

  // ── Owner-facing (authenticated, Mobile app) ─────────────────────

  async ownerListConversations(ownerId: string) {
    return dbInstances.guestConversation.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
      include: { vehicle: { select: { registrationNumber: true, make: true, model: true, imageUrl: true } } },
    });
  },

  async ownerGetConversation(ownerId: string, id: string) {
    const conversation = await dbInstances.guestConversation.findUnique({
      where: { id },
      include: {
        vehicle: { select: { registrationNumber: true, make: true, model: true, imageUrl: true } },
        entries: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!conversation || conversation.ownerId !== ownerId) {
      throw AppError.notFound("Conversation not found");
    }
    return conversation;
  },

  async ownerReply(ownerId: string, id: string, text: string) {
    const conversation = await dbInstances.guestConversation.findUnique({ where: { id } });
    if (!conversation || conversation.ownerId !== ownerId) {
      throw AppError.notFound("Conversation not found");
    }
    if (conversation.status === "CLOSED") {
      throw AppError.badRequest("This conversation is closed");
    }
    const entry = await dbInstances.guestMessageEntry.create({
      data: { conversationId: id, sender: "OWNER", text },
    });
    await dbInstances.guestConversation.update({
      where: { id },
      data: { lastMessage: truncate(text), lastMessageAt: entry.createdAt },
    });
    return entry;
  },

  async ownerUpdateStatus(ownerId: string, id: string, status: "OPEN" | "RESOLVED" | "CLOSED") {
    const conversation = await dbInstances.guestConversation.findUnique({ where: { id } });
    if (!conversation || conversation.ownerId !== ownerId) {
      throw AppError.notFound("Conversation not found");
    }
    return dbInstances.guestConversation.update({ where: { id }, data: { status } });
  },
};
