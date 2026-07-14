import Razorpay from "razorpay";
import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils";
import { dbInstances } from "@repo/db-customer";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { paymentEvents } from "../../services/payment-events";
import type { CreateOrderInput, VerifyOrderInput } from "./payments.validators";

let razorpayClient: Razorpay | null = null;

function getRazorpayClient(): Razorpay {
  if (razorpayClient) return razorpayClient;
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw AppError.internal(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      "RAZORPAY_NOT_CONFIGURED",
    );
  }
  razorpayClient = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
  return razorpayClient;
}

export const paymentsService = {
  async createOrder(customerId: string, input: CreateOrderInput) {
    const razorpay = getRazorpayClient();

    const order = await dbInstances.customerOrder.create({
      data: {
        customerId,
        purpose: input.purpose,
        referenceId: input.referenceId,
        amountPaise: input.amountPaise,
        status: "CREATED",
      },
    });

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: input.amountPaise,
        currency: "INR",
        receipt: order.id,
        notes: { purpose: input.purpose, referenceId: input.referenceId, customerId },
      });
    } catch (err) {
      await dbInstances.customerOrder.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      });
      logger.error({ err, orderId: order.id }, "Razorpay order creation failed");
      throw AppError.internal("Could not create payment order");
    }

    const updated = await dbInstances.customerOrder.update({
      where: { id: order.id },
      data: { razorpayOrderId: razorpayOrder.id, status: "ATTEMPTED" },
    });

    return {
      orderId: updated.id,
      razorpayOrderId: razorpayOrder.id,
      amountPaise: updated.amountPaise,
      currency: updated.currency,
      keyId: env.RAZORPAY_KEY_ID,
    };
  },

  async getOrder(customerId: string, orderId: string) {
    const order = await dbInstances.customerOrder.findUnique({
      where: { id: orderId },
      include: { attempts: true, refunds: true },
    });
    if (!order || order.customerId !== customerId) {
      throw AppError.notFound("Order not found");
    }
    return order;
  },

  async listHistory(customerId: string) {
    return dbInstances.customerOrder.findMany({
      where: { customerId },
      include: { refunds: true },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Ops visibility: support/admin staff couldn't otherwise see a payment
   * stuck without a webhook ever arriving, short of querying the DB by hand.
   */
  async adminListOrders(filters: { status?: string; stuckOnly?: boolean; page?: number; limit?: number }) {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
    const stuckCutoff = new Date(Date.now() - 15 * 60 * 1000);

    const where: Record<string, unknown> = {};
    if (filters.stuckOnly) {
      where.status = { in: ["CREATED", "ATTEMPTED"] };
      where.createdAt = { lt: stuckCutoff };
    } else if (filters.status) {
      where.status = filters.status;
    }

    const [orders, total] = await Promise.all([
      dbInstances.customerOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, phoneNumber: true } },
          attempts: { orderBy: { createdAt: "desc" }, take: 1 },
          refunds: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbInstances.customerOrder.count({ where }),
    ]);

    return {
      data: orders.map((order) => ({
        ...order,
        isStuck: (order.status === "CREATED" || order.status === "ATTEMPTED") && order.createdAt < stuckCutoff,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Re-derives the same checkout payload a client would have gotten from
   * createOrder, without calling Razorpay again — used when a booking
   * create request is replayed (idempotency) and the order already exists.
   */
  async getCheckoutInfo(orderId: string | null) {
    if (!orderId) return null;
    const order = await dbInstances.customerOrder.findUnique({ where: { id: orderId } });
    if (!order?.razorpayOrderId) return null;
    return {
      orderId: order.id,
      razorpayOrderId: order.razorpayOrderId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID,
    };
  },

  /**
   * Optional immediate client-side check for a snappy UI. The webhook
   * (processWebhook below) remains the source of truth for order status —
   * this never flips `CustomerOrder.status` itself.
   */
  async verifyOrder(customerId: string, orderId: string, input: VerifyOrderInput) {
    const order = await this.getOrder(customerId, orderId);
    if (!order.razorpayOrderId) {
      throw AppError.badRequest("Order has no Razorpay order to verify");
    }
    if (!env.RAZORPAY_KEY_SECRET) {
      throw AppError.internal("Razorpay is not configured");
    }

    const valid = validatePaymentVerification(
      { order_id: order.razorpayOrderId, payment_id: input.razorpayPaymentId },
      input.razorpaySignature,
      env.RAZORPAY_KEY_SECRET,
    );

    await dbInstances.customerPaymentAttempt.create({
      data: {
        orderId: order.id,
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
        status: valid ? "SUCCESS" : "FAILED",
        paidAt: valid ? new Date() : undefined,
      },
    });

    return { valid };
  },

  /** Called in-process by other modules (e.g. Parking cancellation) — never over HTTP. */
  async refund(orderId: string, amountPaise: number, reason?: string) {
    const razorpay = getRazorpayClient();
    const order = await dbInstances.customerOrder.findUnique({ where: { id: orderId } });
    if (!order) throw AppError.notFound("Order not found");
    if (order.status !== "PAID") {
      throw AppError.badRequest("Only a paid order can be refunded");
    }

    const successfulAttempt = await dbInstances.customerPaymentAttempt.findFirst({
      where: { orderId, status: "SUCCESS" },
      orderBy: { paidAt: "desc" },
    });
    if (!successfulAttempt?.razorpayPaymentId) {
      throw AppError.internal("No successful payment attempt found to refund");
    }

    const refund = await dbInstances.customerRefund.create({
      data: { orderId, amountPaise, reason, status: "INITIATED" },
    });

    try {
      const rzpRefund = await razorpay.payments.refund(successfulAttempt.razorpayPaymentId, {
        amount: amountPaise,
      });
      await dbInstances.customerRefund.update({
        where: { id: refund.id },
        data: { razorpayRefundId: rzpRefund.id, status: "PROCESSED", processedAt: new Date() },
      });
    } catch (err) {
      await dbInstances.customerRefund.update({
        where: { id: refund.id },
        data: { status: "FAILED" },
      });
      logger.error({ err, orderId }, "Razorpay refund failed");
      throw AppError.internal("Refund could not be processed");
    }

    paymentEvents.emitRefundProcessed({
      purpose: order.purpose,
      referenceId: order.referenceId,
      orderId: order.id,
      customerId: order.customerId,
      amountPaise,
    });

    return refund;
  },

  /**
   * Signature-verified, idempotent processing of inbound Razorpay webhooks.
   * `rawBody` must be the exact bytes Razorpay signed — see app.ts's
   * express.json() `verify` hook, which stashes it on `req.rawBody`.
   */
  async processWebhook(rawBody: Buffer, signatureHeader: string | undefined) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      throw AppError.internal("RAZORPAY_WEBHOOK_SECRET is not configured");
    }
    if (!signatureHeader) {
      throw AppError.badRequest("Missing X-Razorpay-Signature header");
    }

    const rawBodyString = rawBody.toString("utf8");
    const signatureValid = Razorpay.validateWebhookSignature(
      rawBodyString,
      signatureHeader,
      env.RAZORPAY_WEBHOOK_SECRET,
    );

    const payload = JSON.parse(rawBodyString);
    const eventType: string = payload.event ?? "unknown";
    const entityId: string =
      payload?.payload?.payment?.entity?.id ??
      payload?.payload?.refund?.entity?.id ??
      payload?.payload?.order?.entity?.id ??
      "no-entity-id";
    const dedupeKey = `${eventType}:${entityId}`;

    if (!signatureValid) {
      logger.warn({ eventType, dedupeKey }, "Razorpay webhook signature invalid");
      await dbInstances.webhookEvent.upsert({
        where: { dedupeKey },
        create: { eventType, dedupeKey, payload, signatureValid: false },
        update: {},
      });
      throw AppError.unauthorized("Invalid webhook signature");
    }

    const existing = await dbInstances.webhookEvent.findUnique({ where: { dedupeKey } });
    if (existing?.processedAt) {
      logger.info({ dedupeKey }, "Razorpay webhook already processed — skipping");
      return { deduped: true };
    }

    const event = await dbInstances.webhookEvent.upsert({
      where: { dedupeKey },
      create: { eventType, dedupeKey, payload, signatureValid: true },
      update: { payload, signatureValid: true },
    });

    await this.applyWebhookEvent(eventType, payload);

    await dbInstances.webhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });

    return { deduped: false };
  },

  async applyWebhookEvent(eventType: string, payload: any): Promise<void> {
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const paymentEntity = payload?.payload?.payment?.entity;
      const razorpayOrderId: string | undefined = paymentEntity?.order_id;
      if (!razorpayOrderId) return;

      const order = await dbInstances.customerOrder.findUnique({
        where: { razorpayOrderId },
      });
      if (!order) {
        logger.warn({ razorpayOrderId }, "Webhook: no matching CustomerOrder");
        return;
      }
      if (order.status === "PAID") return; // already handled by an earlier delivery

      await dbInstances.customerPaymentAttempt.upsert({
        where: { razorpayPaymentId: paymentEntity.id },
        create: {
          orderId: order.id,
          razorpayPaymentId: paymentEntity.id,
          method: paymentEntity.method,
          status: "SUCCESS",
          paidAt: new Date(),
        },
        update: { status: "SUCCESS", paidAt: new Date() },
      });
      await dbInstances.customerOrder.update({
        where: { id: order.id },
        data: { status: "PAID" },
      });

      paymentEvents.emitSucceeded({
        purpose: order.purpose,
        referenceId: order.referenceId,
        orderId: order.id,
        customerId: order.customerId,
        amountPaise: order.amountPaise,
      });
      return;
    }

    if (eventType === "payment.failed") {
      const paymentEntity = payload?.payload?.payment?.entity;
      const razorpayOrderId: string | undefined = paymentEntity?.order_id;
      if (!razorpayOrderId) return;

      const order = await dbInstances.customerOrder.findUnique({
        where: { razorpayOrderId },
      });
      if (!order || order.status === "PAID") return;

      await dbInstances.customerPaymentAttempt.upsert({
        where: { razorpayPaymentId: paymentEntity.id },
        create: {
          orderId: order.id,
          razorpayPaymentId: paymentEntity.id,
          method: paymentEntity.method,
          status: "FAILED",
          failureReason: paymentEntity.error_description ?? undefined,
        },
        update: { status: "FAILED", failureReason: paymentEntity.error_description ?? undefined },
      });
      await dbInstances.customerOrder.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      });

      paymentEvents.emitFailed({
        purpose: order.purpose,
        referenceId: order.referenceId,
        orderId: order.id,
        customerId: order.customerId,
        failureReason: paymentEntity.error_description ?? undefined,
      });
      return;
    }

    if (eventType === "refund.processed") {
      const refundEntity = payload?.payload?.refund?.entity;
      if (!refundEntity) return;
      await dbInstances.customerRefund.updateMany({
        where: { razorpayRefundId: refundEntity.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      return;
    }

    logger.info({ eventType }, "Razorpay webhook: no handler for this event type — ignored");
  },
};
